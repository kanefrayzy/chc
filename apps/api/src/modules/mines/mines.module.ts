import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { RanksModule } from '../ranks/ranks.module';
import { RouletteModule } from '../roulette/roulette.module';
import { MinesService } from './mines.service';
import { MinesController } from './mines.controller';

@Module({
  imports: [AuthModule, ReferralsModule, RanksModule, RouletteModule],
  providers: [MinesService],
  controllers: [MinesController],
  exports: [MinesService],
})
export class MinesModule {}
