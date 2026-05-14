import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { AdminTicketsService } from './admin-tickets.service';
import { TicketMessageDto, BalanceAdjustDto } from './admin.dto';
import {
  toAdminTicket,
  toAdminMessage,
  type AdminTicketRowDto,
  type AdminMessageDto,
} from './admin.mapper';

function clientMeta(req: Request) {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;
  const userAgent = req.headers['user-agent'];
  return { ip, userAgent };
}

@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR', 'SUPER_ADMIN')
export class AdminTicketsController {
  constructor(private readonly service: AdminTicketsService) {}

  @Get()
  async list(
    @Query('status') status: string | undefined,
    @Query('type') type: string | undefined,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('cursor') cursor: string | undefined,
  ): Promise<{ items: AdminTicketRowDto[]; nextCursor: string | null }> {
    const { items, nextCursor } = await this.service.list({ status, type, limit, cursor });
    return { items: items.map(toAdminTicket), nextCursor };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<AdminTicketRowDto> {
    const t = await this.service.get(id);
    return toAdminTicket(t);
  }

  @Get(':id/messages')
  async messages(
    @Param('id') id: string,
    @Query('beforeId') beforeId?: string,
    @Query('afterId') afterId?: string,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit?: number,
  ): Promise<AdminMessageDto[]> {
    const msgs = await this.service.listMessages(id, { beforeId, afterId, limit: limit ?? 30 });
    return msgs.map(toAdminMessage);
  }

  @Post(':id/messages')
  async send(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: TicketMessageDto,
    @Req() req: Request,
  ): Promise<AdminMessageDto> {
    const meta = clientMeta(req);
    const msg = await this.service.postMessage({
      actorId: actor.sub,
      ticketId: id,
      body: body.body,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toAdminMessage(msg);
  }

  @Post(':id/close')
  async close(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<AdminTicketRowDto> {
    const meta = clientMeta(req);
    const t = await this.service.close({
      actorId: actor.sub,
      ticketId: id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toAdminTicket(t as never);
  }

  @Post(':id/balance-adjust')
  async balanceAdjust(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: BalanceAdjustDto,
    @Req() req: Request,
  ): Promise<{ balanceAfterMinor: string }> {
    const meta = clientMeta(req);
    return this.service.adjustBalance({
      actorId: actor.sub,
      ticketId: id,
      amountMinor: BigInt(body.amountMinor),
      reason: body.reason,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  }
}
