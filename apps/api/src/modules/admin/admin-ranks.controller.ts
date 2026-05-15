import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RanksService } from '../ranks/ranks.service';
import { toPublicRank, type PublicRankDto } from '../ranks/ranks.mapper';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

const CreateRankSchema = z.object({
  order: z.number().int().min(0),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/),
  nameRu: z.string().min(1).max(100),
  nameAz: z.string().min(1).max(100),
  minWageredMinor: z.string().regex(/^\d+$/, 'Must be numeric string'),
  iconUrl: z.string().url().nullable().optional(),
});
class CreateRankDto extends createZodDto(CreateRankSchema) {}

const UpdateRankSchema = z.object({
  order: z.number().int().min(0).optional(),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/).optional(),
  nameRu: z.string().min(1).max(100).optional(),
  nameAz: z.string().min(1).max(100).optional(),
  minWageredMinor: z.string().regex(/^\d+$/).optional(),
  iconUrl: z.string().url().nullable().optional(),
});
class UpdateRankDto extends createZodDto(UpdateRankSchema) {}

// ─── Controller ───────────────────────────────────────────────────────────────

@Controller('admin/ranks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR', 'SUPER_ADMIN')
export class AdminRanksController {
  constructor(private readonly ranks: RanksService) {}

  @Get()
  async list(): Promise<{ items: PublicRankDto[] }> {
    this.ranks.invalidateCache();
    const items = await this.ranks.listAll();
    return { items: items.map(toPublicRank) };
  }

  @Post()
  @Roles('SUPER_ADMIN')
  async create(@Body() body: CreateRankDto): Promise<PublicRankDto> {
    const rank = await this.ranks.createRank({
      order: body.order,
      slug: body.slug,
      nameRu: body.nameRu,
      nameAz: body.nameAz,
      minWageredMinor: BigInt(body.minWageredMinor),
      iconUrl: body.iconUrl ?? null,
    });
    return toPublicRank(rank);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN')
  async update(@Param('id') id: string, @Body() body: UpdateRankDto): Promise<PublicRankDto> {
    const data: Parameters<typeof this.ranks.updateRank>[1] = {};
    if (body.order !== undefined) data.order = body.order;
    if (body.slug !== undefined) data.slug = body.slug;
    if (body.nameRu !== undefined) data.nameRu = body.nameRu;
    if (body.nameAz !== undefined) data.nameAz = body.nameAz;
    if (body.minWageredMinor !== undefined) data.minWageredMinor = BigInt(body.minWageredMinor);
    if ('iconUrl' in body) data.iconUrl = body.iconUrl ?? null;
    const rank = await this.ranks.updateRank(id, data);
    return toPublicRank(rank);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  async remove(@Param('id') id: string): Promise<void> {
    await this.ranks.deleteRank(id);
  }

  @Post(':id/upload-icon')
  @UseInterceptors(FileInterceptor('file'))
  @Roles('SUPER_ADMIN')
  async uploadIcon(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PublicRankDto> {
    if (!file) throw new BadRequestException('No file uploaded');

    const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!ALLOWED.includes(file.mimetype)) {
      throw new BadRequestException('Only PNG, JPEG, WEBP or SVG images are allowed');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 2 MB)');
    }

    const iconDir = path.join('/tmp', 'uploads', 'rank-icons');
    await fs.promises.mkdir(iconDir, { recursive: true });

    let filename: string;
    let buffer: Buffer;

    if (file.mimetype === 'image/svg+xml') {
      filename = `${randomUUID()}.svg`;
      buffer = file.buffer;
    } else {
      filename = `${randomUUID()}.webp`;
      buffer = await sharp(file.buffer)
        .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 90 })
        .toBuffer();
    }

    await fs.promises.writeFile(path.join(iconDir, filename), buffer);

    const apiUrl = process.env.API_PUBLIC_URL ?? 'http://localhost:4000';
    const iconUrl = `${apiUrl}/uploads/rank-icons/${filename}`;

    const rank = await this.ranks.updateRank(id, { iconUrl });
    return toPublicRank(rank);
  }
}
