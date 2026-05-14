import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
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

  /** Загрузка логотипа бренда. Файл сохраняется в /tmp/uploads/logos/ */
  @Post('upload-logo')
  @UseInterceptors(FileInterceptor('file'))
  @Roles('SUPER_ADMIN')
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<SettingRow> {
    if (!file) throw new BadRequestException('No file uploaded');
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Only PNG, JPEG, WEBP or SVG images are allowed');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 2 MB)');
    }

    const logoDir = path.join('/tmp', 'uploads', 'logos');
    await fs.promises.mkdir(logoDir, { recursive: true });

    let filename: string;
    let buffer: Buffer;

    if (file.mimetype === 'image/svg+xml') {
      filename = `${randomUUID()}.svg`;
      buffer = file.buffer;
    } else {
      filename = `${randomUUID()}.webp`;
      buffer = await sharp(file.buffer).resize(512, 512, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    }

    const filePath = path.join(logoDir, filename);
    await fs.promises.writeFile(filePath, buffer);

    const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
    const logoUrl = `${apiUrl}/uploads/logos/${filename}`;

    const row = await this.settings.set('brand.logo_url', logoUrl);
    const meta = clientMeta(req);
    await this.audit.log({
      actorId: user.sub,
      action: 'settings.set',
      entityType: 'setting',
      entityId: 'brand.logo_url',
      payload: { value: logoUrl as Prisma.InputJsonValue },
      ...(meta.ip ? { ip: meta.ip } : {}),
      ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
    });
    return row;
  }

  /** Универсальная загрузка изображения для произвольного ключа (hero, плитки игр и т.п.). */
  @Post('upload-image/:key')
  @UseInterceptors(FileInterceptor('file'))
  @Roles('SUPER_ADMIN')
  async uploadImage(
    @Param('key') key: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AccessTokenPayload,
    @Req() req: Request,
  ): Promise<SettingRow> {
    if (!file) throw new BadRequestException('No file uploaded');
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Only PNG, JPEG or WEBP images are allowed');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 5 MB)');
    }
    if (!/^[a-z0-9_.-]+$/i.test(key)) {
      throw new BadRequestException('Invalid setting key');
    }

    const imgDir = path.join('/tmp', 'uploads', 'images');
    await fs.promises.mkdir(imgDir, { recursive: true });

    const filename = `${randomUUID()}.webp`;
    const buffer = await sharp(file.buffer)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const filePath = path.join(imgDir, filename);
    await fs.promises.writeFile(filePath, buffer);

    const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
    const imageUrl = `${apiUrl}/uploads/images/${filename}`;

    const row = await this.settings.set(key, imageUrl);
    const meta = clientMeta(req);
    await this.audit.log({
      actorId: user.sub,
      action: 'settings.set',
      entityType: 'setting',
      entityId: key,
      payload: { value: imageUrl as Prisma.InputJsonValue },
      ...(meta.ip ? { ip: meta.ip } : {}),
      ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
    });
    return row;
  }

  /** Только SUPER_ADMIN может изменять настройки. */
  @Post(':key')
  @Roles('SUPER_ADMIN')
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
