import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { RanksModule } from '../ranks/ranks.module';
import { ClassicService } from './classic.service';
import { ClassicController } from './classic.controller';

@Module({
  imports: [AuthModule, ReferralsModule, RanksModule],
  providers: [ClassicService],
  controllers: [ClassicController],
  exports: [ClassicService],
})
export class ClassicModule {}
