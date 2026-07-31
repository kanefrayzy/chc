import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import sharp from 'sharp';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { TicketsService } from './tickets.service';
import { SendMessageDto, CreateTicketDto } from './tickets.dto';
import {
  toPublicMessage,
  toPublicTicket,
  type PublicMessageDto,
  type PublicTicketDto,
} from './tickets.mapper';

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Throttle({ default: { ttl: 600_000, limit: 10 } })
  @Post()
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() body: CreateTicketDto,
  ): Promise<PublicTicketDto> {
    const ticket = await this.tickets.createTicket({
      userId: user.sub,
      type: body.type,
      subject: body.subject,
      initialMessage: body.initialMessage,
    });
    return toPublicTicket(ticket);
  }

  @Get()
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): Promise<{ items: PublicTicketDto[]; nextCursor: string | null }> {
    const { items, nextCursor } = await this.tickets.listForUser({
      userId: user.sub,
      limit,
      ...(cursor ? { cursor } : {}),
    });
    return { items: items.map(toPublicTicket), nextCursor };
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<PublicTicketDto> {
    const t = await this.tickets.getForUser({ userId: user.sub, ticketId: id });
    return toPublicTicket(t);
  }

  @Get(':id/messages')
  async listMessages(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Query('afterId') afterId?: string,
    @Query('beforeId') beforeId?: string,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit?: number,
  ): Promise<{ items: PublicMessageDto[] }> {
    const items = await this.tickets.listMessages({
      userId: user.sub,
      ticketId: id,
      ...(afterId ? { afterId } : {}),
      ...(beforeId ? { beforeId } : {}),
      ...(limit ? { limit } : {}),
    });
    return { items: items.map((m) => toPublicMessage(m, user.sub)) };
  }

  @Post(':id/messages')
  async post(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: SendMessageDto,
  ): Promise<PublicMessageDto> {
    const msg = await this.tickets.postUserMessage({
      userId: user.sub,
      ticketId: id,
      body: body.body,
    });
    return toPublicMessage(msg, user.sub);
  }

  @Post(':id/upload-image')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.mimetype)) {
        return cb(new BadRequestException('Разрешены только PNG, JPG, WEBP, GIF'), false);
      }
      cb(null, true);
    },
  }))
  async uploadImage(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<PublicMessageDto> {
    if (!file) throw new BadRequestException('Файл не загружен');

    const uploadDir = path.join('/app', 'uploads', 'ticket-images');
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `${randomUUID()}.webp`;
    const filepath = path.join(uploadDir, filename);
    // limitInputPixels + resize: «архивная бомба» (маленький файл, гигантский растр)
    // иначе положила бы процесс по памяти.
    await sharp(file.buffer, { limitInputPixels: 50_000_000 })
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(filepath);

    const apiBase = process.env.API_PUBLIC_URL ?? 'http://localhost:4000';
    const imageUrl = `${apiBase}/uploads/ticket-images/${filename}`;

    const msg = await this.tickets.postUserMessage({
      userId: user.sub,
      ticketId: id,
      body: imageUrl,
      kind: 'FILE',
    });
    return toPublicMessage(msg, user.sub);
  }
}
