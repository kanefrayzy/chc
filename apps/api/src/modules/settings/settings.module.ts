import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { TranslationsController } from './translations.controller';

@Global()
@Module({
  providers: [SettingsService],
  controllers: [SettingsController, TranslationsController],
  exports: [SettingsService],
})
export class SettingsModule {}
