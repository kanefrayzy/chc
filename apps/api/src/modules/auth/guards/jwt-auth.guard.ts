import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type AccessTokenPayload } from '../auth.service';
import { AUTH_COOKIE } from '../auth.config';
import { PrismaService } from '../../../common/prisma/prisma.module';

export interface AuthedRequest extends Request {
  user?: AccessTokenPayload;
}

/** Статус пользователя кэшируем ненадолго, чтобы не ходить в БД на каждый запрос. */
const STATUS_CACHE_TTL_MS = 15_000;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly statusCache = new Map<string, { status: string; role: string; at: number }>();

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Missing access token');
    const payload = this.auth.verifyAccessToken(token);

    // Подпись токена ничего не говорит о том, не забанили ли пользователя
    // и не сменили ли ему роль уже после выдачи токена — проверяем в БД.
    const current = await this.getUserState(payload.sub);
    if (!current) throw new UnauthorizedException('User not found');
    if (current.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');

    // Роль берём актуальную из БД, а не из токена (понижение прав действует сразу).
    req.user = { ...payload, role: current.role as AccessTokenPayload['role'] };
    return true;
  }

  private async getUserState(
    userId: string,
  ): Promise<{ status: string; role: string } | null> {
    const cached = this.statusCache.get(userId);
    const now = Date.now();
    if (cached && now - cached.at < STATUS_CACHE_TTL_MS) {
      return { status: cached.status, role: cached.role };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, role: true },
    });
    if (!user) {
      this.statusCache.delete(userId);
      return null;
    }

    // Простая защита от неограниченного роста кэша
    if (this.statusCache.size > 10_000) this.statusCache.clear();
    this.statusCache.set(userId, { status: user.status, role: user.role, at: now });
    return { status: user.status, role: user.role };
  }

  private extractToken(req: AuthedRequest): string | undefined {
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE.access];
    if (cookieToken) return cookieToken;
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
