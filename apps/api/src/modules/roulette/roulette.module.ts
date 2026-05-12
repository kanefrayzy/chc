import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { RanksModule } from '../ranks/ranks.module';
import { RouletteService } from './roulette.service';
import { RouletteController } from './roulette.controller';

@Module({
  imports: [AuthModule, ReferralsModule, RanksModule],
  providers: [RouletteService],
  controllers: [RouletteController],
  exports: [RouletteService],
})
export class RouletteModule {}
