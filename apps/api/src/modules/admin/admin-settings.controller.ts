import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { SettingsService, type SettingRow } from '../settings/settings.service';
import { AdminAuditService } from './admin-audit.service';

const SetSettingSchema = z.object({
  value: z.unknown(),
});
class SetSettingDto extends createZodDto(SetSettingSchema) {}

function clientMeta(req: Request): { ip?: string; userAgent?: string } {
  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    req.ip ??
    undefined;
  const userAgent = req.headers['user-agent'] ?? undefined;
  return { ip, userAgent };
}

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR', 'SUPER_ADMIN')
export class AdminSettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  async list(): Promise<{ items: SettingRow[] }> {
    const items = await this.settings.listAll();
    return { items };
  }

  /** Только SUPER_ADMIN может изменять настройки. */
  @Post(':key')
  async set(
    @Param('key') key: string,
    @Body() body: SetSettingDto,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<SettingRow> {
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can change settings');
    }
    const row = await this.settings.set(key, body.value);
    const meta = clientMeta(req);
    await this.audit.log({
      actorId: user.sub,
      action: 'settings.set',
      entityType: 'setting',
      entityId: key,
      payload: { value: body.value as Prisma.InputJsonValue },
      ...(meta.ip ? { ip: meta.ip } : {}),
      ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
    });
    return row;
  }
}
