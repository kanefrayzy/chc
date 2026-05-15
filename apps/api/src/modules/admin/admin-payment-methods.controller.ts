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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaymentMethodsService } from '../payment-methods/payment-methods.service';
import {
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
} from '../payment-methods/payment-methods.dto';
import {
  toAdminPaymentMethod,
  type AdminPaymentMethodDto,
} from '../payment-methods/payment-methods.mapper';

@Controller('admin/payment-methods')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminPaymentMethodsController {
  constructor(private readonly service: PaymentMethodsService) {}

  @Get()
  async list(): Promise<{ items: AdminPaymentMethodDto[] }> {
    const items = await this.service.listAll();
    return { items: items.map(toAdminPaymentMethod) };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<AdminPaymentMethodDto> {
    const m = await this.service.getById(id);
    return toAdminPaymentMethod(m);
  }

  @Post()
  async create(@Body() dto: CreatePaymentMethodDto): Promise<AdminPaymentMethodDto> {
    const m = await this.service.create(dto);
    return toAdminPaymentMethod(m);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ): Promise<AdminPaymentMethodDto> {
    const m = await this.service.update(id, dto);
    return toAdminPaymentMethod(m);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.remove(id);
  }

  @Post(':id/upload-icon')
  @UseInterceptors(FileInterceptor('file'))
  async uploadIcon(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<AdminPaymentMethodDto> {
    if (!file) throw new BadRequestException('No file uploaded');
    const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    if (!ALLOWED.includes(file.mimetype)) {
      throw new BadRequestException('Only PNG, JPEG, WEBP or SVG images are allowed');
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 2 MB)');
    }

    const iconDir = path.join('/tmp', 'uploads', 'payment-icons');
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
    const iconUrl = `${apiUrl}/uploads/payment-icons/${filename}`;
    const updated = await this.service.setIcon(id, iconUrl);
    return toAdminPaymentMethod(updated);
  }
}
