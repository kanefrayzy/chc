import { randomBytes, createHash } from 'node:crypto';
import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { PrismaService } from '../../common/prisma/prisma.module';
import { UsersService } from '../users/users.service';
import { type AuthConfig, loadAuthConfig } from './auth.config';
import type { PublicUserDto } from '../users/users.mapper';
import type { User } from '@prisma/client';
import { Prisma } from '@prisma/client';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: User['role'];
}

export interface RegisterInput {
  email: string;
  phone: string;
  username: string;
  password: string;
  language?: 'ru' | 'az';
  referralCode?: string;
}

export interface LoginInput {
  identifier: string;
  password: string;
  userAgent?: string;
  ip?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly config: AuthConfig = loadAuthConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async register(input: RegisterInput): Promise<{ user: PublicUserDto; tokens: AuthTokens }> {
    const email = input.email.trim().toLowerCase() || null;
    const phone = input.phone.trim() || null;
    const username = input.username.trim();

    // referral
    let referredById: string | undefined;
    if (input.referralCode) {
      const referrer = await this.users.findByReferralCode(input.referralCode.trim());
      if (referrer) referredById = referrer.id;
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const referralCode = this.generateReferralCode();

    try {
      const user = await this.users.create({
        email,
        phone,
        username,
        passwordHash,
        language: input.language ?? 'ru',
        referralCode,
        ...(referredById ? { referredBy: { connect: { id: referredById } } } : {}),
      });
      const tokens = await this.issueTokens(user);
      return { user: this.users.toPublic(user), tokens };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = (e.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
        throw new ConflictException(`User with this ${target} already exists`);
      }
      throw e;
    }
  }

  async login(input: LoginInput): Promise<{ user: PublicUserDto; tokens: AuthTokens }> {
    const user = await this.users.findByIdentifier(input.identifier);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');

    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.issueTokens(user, { userAgent: input.userAgent, ip: input.ip });
    await this.users.touchLogin(user.id, input.ip);
    return { user: this.users.toPublic(user), tokens };
  }

  async refresh(refreshToken: string, meta: { userAgent?: string; ip?: string }): Promise<AuthTokens> {
    let payload: { sub: string; jti: string };
    try {
      payload = jwt.verify(refreshToken, this.config.jwtRefreshSecret) as typeof payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const dbToken = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!dbToken || dbToken.revokedAt || dbToken.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token revoked or expired');
    }
    if (dbToken.userId !== payload.sub) throw new UnauthorizedException('Token mismatch');

    const user = await this.users.findByIdOrThrow(payload.sub);

    // ротация: отзываем старый, выдаём новый
    await this.prisma.refreshToken.update({
      where: { id: dbToken.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user, meta);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken
      .updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }

  async me(userId: string): Promise<PublicUserDto> {
    const user = await this.users.findByIdOrThrow(userId);
    return this.users.toPublic(user);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return jwt.verify(token, this.config.jwtAccessSecret) as AccessTokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  getAuthConfig(): AuthConfig {
    return this.config;
  }

  // ─── internals ──────────────────────────────────────────────────────────

  private async issueTokens(user: User, meta?: { userAgent?: string; ip?: string }): Promise<AuthTokens> {
    const now = Date.now();
    const accessTokenExpiresAt = new Date(now + this.config.accessTokenTtlSec * 1000);
    const refreshTokenExpiresAt = new Date(now + this.config.refreshTokenTtlSec * 1000);

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };
    const accessOptions: SignOptions = { expiresIn: this.config.accessTokenTtlSec };
    const accessToken = jwt.sign(accessPayload, this.config.jwtAccessSecret, accessOptions);

    const jti = randomBytes(16).toString('hex');
    const refreshOptions: SignOptions = { expiresIn: this.config.refreshTokenTtlSec, jwtid: jti };
    const refreshToken = jwt.sign({ sub: user.id }, this.config.jwtRefreshSecret, refreshOptions);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        userAgent: meta?.userAgent ?? null,
        ip: meta?.ip ?? null,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return { accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateReferralCode(): string {
    return randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars
  }
}
