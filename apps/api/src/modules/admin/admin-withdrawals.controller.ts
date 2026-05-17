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
import { AdminWithdrawalsService } from './admin-withdrawals.service';
import { ApproveWithdrawalDto, RejectReasonDto } from './admin.dto';
import { toAdminWithdrawal, type AdminWithdrawalRowDto } from './admin.mapper';

function clientMeta(req: Request) {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;
  const userAgent = req.headers['user-agent'];
  return { ip, userAgent };
}

@Controller('admin/withdrawals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminWithdrawalsController {
  constructor(private readonly service: AdminWithdrawalsService) {}

  @Get()
  async list(
    @Query('status') status: string | undefined,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor: string | undefined,
  ): Promise<{ items: AdminWithdrawalRowDto[]; nextCursor: string | null }> {
    const { items, nextCursor } = await this.service.list({ status, limit, cursor });
    return { items: items.map(toAdminWithdrawal), nextCursor };
  }

  @Post(':id/approve')
  async approve(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: ApproveWithdrawalDto,
    @Req() req: Request,
  ): Promise<AdminWithdrawalRowDto> {
    const meta = clientMeta(req);
    const w = await this.service.approve({
      actorId: actor.sub,
      withdrawalId: id,
      externalId: body.externalId,
      note: body.note,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toAdminWithdrawal(w);
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: RejectReasonDto,
    @Req() req: Request,
  ): Promise<AdminWithdrawalRowDto> {
    const meta = clientMeta(req);
    const w = await this.service.reject({
      actorId: actor.sub,
      withdrawalId: id,
      reason: body.reason,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toAdminWithdrawal(w);
  }
}

