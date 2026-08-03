import { Global, Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { BotWinnersService } from './bot-winners.service';

/** Глобальный — ленту собирает roulette.service, ему нужен доступ без импорта. */
@Global()
@Module({
  imports: [SettingsModule],
  providers: [BotWinnersService],
  exports: [BotWinnersService],
})
export class WinnersModule {}
