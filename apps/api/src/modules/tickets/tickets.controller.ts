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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { TicketsService } from './tickets.service';
import { SendMessageDto } from './tickets.dto';
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
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ): Promise<{ items: PublicMessageDto[] }> {
    const items = await this.tickets.listMessages({
      userId: user.sub,
      ticketId: id,
      ...(afterId ? { afterId } : {}),
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
}
