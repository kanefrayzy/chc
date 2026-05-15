import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ZodValidationPipe } from 'nestjs-zod';
import type { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { AuthService, type AuthTokens } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../common/prisma/prisma.module';
import { LoginRequestDto, RegisterRequestDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AccessTokenPayload } from './auth.service';
import { AUTH_COOKIE } from './auth.config';
import type { PublicUserDto } from '../users/users.mapper';

interface AuthResponseBody {
  user: PublicUserDto;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe()) dto: RegisterRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseBody> {
    const { user, tokens } = await this.auth.register({
      email: dto.email,
      phone: dto.phone,
      username: dto.username,
      password: dto.password,
      referralCode: dto.referralCode,
      language: dto.language,
    });
    this.setAuthCookies(res, tokens);
    void req;
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe()) dto: LoginRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseBody> {
    const { user, tokens } = await this.auth.login({
      identifier: dto.identifier,
      password: dto.password,
      userAgent: req.headers['user-agent'] ?? undefined,
      ip: this.getClientIp(req),
    });
    this.setAuthCookies(res, tokens);
    return { user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const rt = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE.refresh];
    const tokens = await this.auth.refresh(rt ?? '', {
      userAgent: req.headers['user-agent'] ?? undefined,
      ip: this.getClientIp(req),
    });
    this.setAuthCookies(res, tokens);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<{ ok: true }> {
    const rt = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE.refresh];
    await this.auth.logout(rt);
    this.clearAuthCookies(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AccessTokenPayload): Promise<{ user: PublicUserDto }> {
    return { user: await this.auth.me(user.sub) };
  }

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
        return cb(new BadRequestException('Разрешены только PNG, JPG, WEBP'), false);
      }
      cb(null, true);
    },
  }))
  async uploadAvatar(
    @CurrentUser() user: AccessTokenPayload,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<{ avatarUrl: string }> {
    void req;
    if (!file) throw new BadRequestException('Файл не загружен');

    const uploadDir = path.join('/app', 'uploads', 'avatars');
    await fs.mkdir(uploadDir, { recursive: true });

    const ext = 'webp';
    const filename = `${randomUUID()}.${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Сжимаем и конвертируем в WebP, max 256x256
    await sharp(file.buffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(filepath);

    const apiBase = process.env.API_PUBLIC_URL ?? `http://localhost:4000`;
    const avatarUrl = `${apiBase}/uploads/avatars/${filename}`;

    await this.prisma.user.update({
      where: { id: user.sub },
      data: { avatarUrl },
    });

    return { avatarUrl };
  }

  // ─── cookie helpers ─────────────────────────────────────────────────────

  private setAuthCookies(res: Response, tokens: AuthTokens): void {
    const cfg = this.auth.getAuthConfig();
    const base = {
      httpOnly: true,
      secure: cfg.cookieSecure,
      sameSite: 'lax' as const,
      domain: cfg.cookieDomain,
      path: '/',
    };
    res.cookie(AUTH_COOKIE.access, tokens.accessToken, {
      ...base,
      expires: tokens.accessTokenExpiresAt,
    });
    res.cookie(AUTH_COOKIE.refresh, tokens.refreshToken, {
      ...base,
      expires: tokens.refreshTokenExpiresAt,
      path: '/',
    });
  }

  private clearAuthCookies(res: Response): void {
    const cfg = this.auth.getAuthConfig();
    res.clearCookie(AUTH_COOKIE.access, { domain: cfg.cookieDomain, path: '/' });
    res.clearCookie(AUTH_COOKIE.refresh, { domain: cfg.cookieDomain, path: '/' });
  }

  private getClientIp(req: Request): string | undefined {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string') return fwd.split(',')[0]?.trim();
    if (Array.isArray(fwd)) return fwd[0];
    return req.ip;
  }
}
