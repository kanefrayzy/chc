import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';

@Module({
  imports: [AuthModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
