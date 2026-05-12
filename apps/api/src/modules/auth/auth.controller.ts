import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import type { Request, Response } from 'express';
import { AuthService, type AuthTokens } from './auth.service';
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
  constructor(private readonly auth: AuthService) {}

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
      path: '/auth',
    });
  }

  private clearAuthCookies(res: Response): void {
    const cfg = this.auth.getAuthConfig();
    res.clearCookie(AUTH_COOKIE.access, { domain: cfg.cookieDomain, path: '/' });
    res.clearCookie(AUTH_COOKIE.refresh, { domain: cfg.cookieDomain, path: '/auth' });
  }

  private getClientIp(req: Request): string | undefined {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string') return fwd.split(',')[0]?.trim();
    if (Array.isArray(fwd)) return fwd[0];
    return req.ip;
  }
}
