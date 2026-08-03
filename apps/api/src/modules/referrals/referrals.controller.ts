import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { minorToJson } from '@chcgreen/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { ReferralsService } from './referrals.service';
import {
  toPublicReferralEarning,
  toPublicReferral,
  type PublicReferralEarningDto,
  type PublicReferralDto,
  type ReferralSummaryDto,
} from './referrals.mapper';

@Controller('referrals')
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Get('me')
  async me(@CurrentUser() user: AccessTokenPayload): Promise<ReferralSummaryDto> {
    const s = await this.referrals.getDetailedSummary(user.sub);
    return {
      referralCode: s.referralCode,
      referralsCount: s.referralsCount,
      totalEarningsMinor: minorToJson(s.totalEarningsMinor),
      rates: s.rates,
      ftdCount: s.ftdCount,
      depositsCount: s.depositsCount,
      depositsMinor: minorToJson(s.depositsMinor),
      wageredMinor: minorToJson(s.wageredMinor),
    };
  }

  @Get('earnings')
  async earnings(
    @CurrentUser() user: AccessTokenPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): Promise<{ items: PublicReferralEarningDto[]; nextCursor: string | null }> {
    const { items, nextCursor } = await this.referrals.listEarnings({
      userId: user.sub,
      limit: Math.min(limit, 50),
      cursor,
    });
    return { items: items.map(toPublicReferralEarning), nextCursor };
  }

  @Get('list')
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): Promise<{ items: PublicReferralDto[]; nextCursor: string | null }> {
    const { items, nextCursor } = await this.referrals.listReferrals({
      userId: user.sub,
      limit: Math.min(limit, 50),
      cursor,
    });
    return { items: items.map(toPublicReferral), nextCursor };
  }
}
