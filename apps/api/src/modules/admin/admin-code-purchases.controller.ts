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
import { AdminCodePurchasesService } from './admin-code-purchases.service';
import { IssueCodeDto, RejectReasonDto } from './admin.dto';
import { toAdminCodePurchase, type AdminCodePurchaseRowDto } from './admin.mapper';

function clientMeta(req: Request) {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;
  const userAgent = req.headers['user-agent'];
  return { ip, userAgent };
}

@Controller('admin/code-purchases')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR', 'SUPER_ADMIN')
export class AdminCodePurchasesController {
  constructor(private readonly service: AdminCodePurchasesService) {}

  @Get()
  async list(
    @Query('status') status: string | undefined,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor: string | undefined,
  ): Promise<{ items: AdminCodePurchaseRowDto[]; nextCursor: string | null }> {
    const { items, nextCursor } = await this.service.list({ status, limit, cursor });
    return { items: items.map(toAdminCodePurchase), nextCursor };
  }

  @Post(':id/issue')
  async issue(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: IssueCodeDto,
    @Req() req: Request,
  ): Promise<AdminCodePurchaseRowDto> {
    const meta = clientMeta(req);
    const p = await this.service.issue({
      actorId: actor.sub,
      purchaseId: id,
      code: body.code,
      amountMinor: BigInt(body.amountMinor),
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toAdminCodePurchase(p);
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: RejectReasonDto,
    @Req() req: Request,
  ): Promise<AdminCodePurchaseRowDto> {
    const meta = clientMeta(req);
    const p = await this.service.reject({
      actorId: actor.sub,
      purchaseId: id,
      reason: body.reason,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toAdminCodePurchase(p);
  }
}
