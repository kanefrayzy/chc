import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import type { ProgressiveTier } from '@prisma/client';
import { minorToJson } from '@chcgreen/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { ProgressiveService } from '../progressive/progressive.service';
import { AdminAuditService } from './admin-audit.service';

const minorString = z.string().regex(/^\d+$/);

export const updateJackpotSchema = z.object({
  seedMinor: minorString.optional(),
  currentMinor: minorString.optional(),
  contributionBps: z.number().int().min(0).max(2000).optional(),
  enabled: z.boolean().optional(),
});
export class UpdateJackpotDto extends createZodDto(updateJackpotSchema) {}

export const awardJackpotSchema = z.object({
  userId: z.string().min(1),
});
export class AwardJackpotDto extends createZodDto(awardJackpotSchema) {}

const TIERS = ['GRAND', 'MAJOR', 'MINOR', 'MINI'] as const;

function parseTier(value: string): ProgressiveTier {
  const upper = value.toUpperCase() as ProgressiveTier;
  if (!TIERS.includes(upper as (typeof TIERS)[number])) {
    throw new Error('UNKNOWN_TIER');
  }
  return upper;
}

@Controller('admin/progressive')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR', 'SUPER_ADMIN')
export class AdminProgressiveController {
  constructor(
    private readonly progressive: ProgressiveService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  async list() {
    const items = await this.progressive.listAdmin();
    return {
      items: items.map((i) => ({
        tier: i.tier,
        seedMinor: minorToJson(i.seedMinor),
        currentMinor: minorToJson(i.currentMinor),
        contributionBps: i.contributionBps,
        enabled: i.enabled,
        lastWinnerName: i.lastWinnerName,
        lastWinMinor: minorToJson(i.lastWinMinor),
        lastWonAt: i.lastWonAt ? i.lastWonAt.toISOString() : null,
      })),
    };
  }

  @Get('wins')
  async wins() {
    const rows = await this.progressive.recentWins(20);
    return {
      items: rows.map((w) => ({
        id: w.id,
        tier: w.tier,
        username: w.user?.username ?? null,
        amountMinor: minorToJson(w.amountMinor),
        createdAt: w.createdAt.toISOString(),
      })),
    };
  }

  @Patch(':tier')
  async update(@Param('tier') tier: string, @Body() body: UpdateJackpotDto) {
    await this.progressive.updateSettings(parseTier(tier), {
      ...(body.seedMinor !== undefined ? { seedMinor: BigInt(body.seedMinor) } : {}),
      ...(body.currentMinor !== undefined ? { currentMinor: BigInt(body.currentMinor) } : {}),
      ...(body.contributionBps !== undefined ? { contributionBps: body.contributionBps } : {}),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    });
    return { ok: true };
  }

  /** Срыв копилки: вся сумма уходит выбранному игроку. */
  @Post(':tier/award')
  async award(
    @CurrentUser() actor: AccessTokenPayload,
    @Param('tier') tier: string,
    @Body() body: AwardJackpotDto,
    @Req() req: Request,
  ) {
    const result = await this.progressive.award({
      tier: parseTier(tier),
      userId: body.userId,
      moderatorId: actor.sub,
    });

    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip;
    await this.audit.log({
      actorId: actor.sub,
      action: 'progressive.award',
      entityType: 'progressive_win',
      entityId: result.id,
      payload: {
        tier: result.tier,
        amountMinor: result.amountMinor.toString(),
        username: result.username,
      },
      ip,
      userAgent: req.headers['user-agent'],
    });

    return {
      id: result.id,
      tier: result.tier,
      username: result.username,
      amountMinor: minorToJson(result.amountMinor),
    };
  }
}
