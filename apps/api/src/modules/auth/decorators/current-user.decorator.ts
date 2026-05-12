import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthedRequest } from '../guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth.service';

/** @CurrentUser() в контроллерах — извлекает JWT-payload (id, username, role). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload | undefined => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.user;
  },
);
