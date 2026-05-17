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
import { AdminUsersService } from './admin-users.service';
import { BalanceAdjustDto, UserStatusDto, UserRoleDto } from './admin.dto';
import { toAdminUser, type AdminUserRowDto } from './admin.mapper';

function clientMeta(req: Request) {
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;
  const userAgent = req.headers['user-agent'];
  return { ip, userAgent };
}

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  async list(
    @Query('search') search: string | undefined,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor: string | undefined,
  ): Promise<{ items: AdminUserRowDto[]; nextCursor: string | null }> {
    const { items, nextCursor } = await this.users.list({ search, limit, cursor });
    return { items: items.map(toAdminUser), nextCursor };
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<AdminUserRowDto> {
    const u = await this.users.getById(id);
    return toAdminUser(u);
  }

  @Post(':id/balance-adjust')
  @Roles('SUPER_ADMIN')
  async adjust(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: BalanceAdjustDto,
    @Req() req: Request,
  ): Promise<AdminUserRowDto> {
    const meta = clientMeta(req);
    const u = await this.users.adjustBalance({
      actorId: actor.sub,
      userId: id,
      amountMinor: BigInt(body.amountMinor),
      reason: body.reason,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toAdminUser(u);
  }

  @Post(':id/status')
  @Roles('SUPER_ADMIN')
  async setStatus(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: UserStatusDto,
    @Req() req: Request,
  ): Promise<AdminUserRowDto> {
    const meta = clientMeta(req);
    const u = await this.users.setStatus({
      actorId: actor.sub,
      userId: id,
      status: body.status,
      reason: body.reason,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toAdminUser(u);
  }

  @Post(':id/role')
  @Roles('SUPER_ADMIN')
  async setRole(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: UserRoleDto,
    @Req() req: Request,
  ): Promise<AdminUserRowDto> {
    const meta = clientMeta(req);
    const u = await this.users.setRole({
      actorId: actor.sub,
      userId: id,
      role: body.role,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return toAdminUser(u);
  }
}
