import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, type AccessTokenPayload } from '../auth.service';
import { AUTH_COOKIE } from '../auth.config';

export interface AuthedRequest extends Request {
  user?: AccessTokenPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Missing access token');
    req.user = this.auth.verifyAccessToken(token);
    return true;
  }

  private extractToken(req: AuthedRequest): string | undefined {
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.[AUTH_COOKIE.access];
    if (cookieToken) return cookieToken;
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
