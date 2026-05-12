import { Controller, Get } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Публичные настройки для веба (фиче-флаги, лимиты). */
  @Get('public')
  async getPublic(): Promise<Record<string, unknown>> {
    return this.settings.getPublic();
  }
}
