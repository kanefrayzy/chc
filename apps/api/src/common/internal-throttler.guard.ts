import { Injectable, type ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/** Заголовок, которым web/admin помечают серверные (SSR) запросы. */
export const INTERNAL_CLIENT_HEADER = 'x-internal-client';

/**
 * Лимит частоты считается по IP. Но страницы рендерятся на сервере: web ходит
 * в API из контейнера, и запросы всех посетителей приходят с одного адреса.
 * На тестовом запуске (~50 человек) общий счётчик выбирался за секунды, API
 * начинал отвечать 429, SSR падал — и страница отдавалась как 500.
 *
 * Поэтому запросы от собственных сервисов, подтверждённые общим секретом
 * (`INTERNAL_API_KEY`), из-под лимита выводятся: до API снаружи не достучаться,
 * а браузерный трафик по-прежнему ограничен по IP пользователя.
 */
@Injectable()
export class InternalAwareThrottlerGuard extends ThrottlerGuard {
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return super.shouldSkip(context);

    const secret = process.env.INTERNAL_API_KEY;
    if (!secret) return super.shouldSkip(context);

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers[INTERNAL_CLIENT_HEADER];
    const value = Array.isArray(header) ? header[0] : header;
    if (value && value === secret) return true;

    return super.shouldSkip(context);
  }
}
