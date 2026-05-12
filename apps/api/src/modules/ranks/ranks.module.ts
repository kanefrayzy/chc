import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RanksService } from './ranks.service';
import { RanksController } from './ranks.controller';

@Module({
  imports: [AuthModule],
  providers: [RanksService],
  controllers: [RanksController],
  exports: [RanksService],
})
export class RanksModule {}
