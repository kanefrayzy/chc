import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { RanksModule } from '../ranks/ranks.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { LotteryService } from './lottery.service';
import { LotteryController } from './lottery.controller';

@Module({
  imports: [AuthModule, SettingsModule, RanksModule, ReferralsModule],
  providers: [LotteryService],
  controllers: [LotteryController],
  exports: [LotteryService],
})
export class LotteryModule {}
