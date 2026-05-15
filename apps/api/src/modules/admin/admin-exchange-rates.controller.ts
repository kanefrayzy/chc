import { Controller, InternalServerErrorException, Logger, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SettingsService } from '../settings/settings.service';

interface ErApiResponse {
  result: string;
  rates: Record<string, number>;
}

@Controller('admin/exchange-rates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminExchangeRatesController {
  private readonly logger = new Logger(AdminExchangeRatesController.name);

  constructor(private readonly settings: SettingsService) {}

  /**
   * POST /admin/exchange-rates/refresh
   * Запрашивает актуальный курс с open.er-api.com (base = AZN) и сохраняет в настройках.
   */
  @Post('refresh')
  async refresh(): Promise<{ usd: number; rub: number; try: number; updatedAt: string }> {
    let data: ErApiResponse;
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/AZN', {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = (await res.json()) as ErApiResponse;
    } catch (err) {
      this.logger.error(`Failed to fetch exchange rates: ${String(err)}`);
      throw new InternalServerErrorException('Не удалось получить курсы с open.er-api.com');
    }

    if (data.result !== 'success') {
      throw new InternalServerErrorException('open.er-api вернул ошибку');
    }

    const usd = Math.round((data.rates['USD'] ?? 0) * 10000) / 10000;
    const rub = Math.round((data.rates['RUB'] ?? 0) * 100) / 100;
    const tryRate = Math.round((data.rates['TRY'] ?? 0) * 100) / 100;

    await Promise.all([
      this.settings.set('exchange_rate.usd', usd),
      this.settings.set('exchange_rate.rub', rub),
      this.settings.set('exchange_rate.try', tryRate),
    ]);

    this.logger.log(`Exchange rates updated: USD=${usd}, RUB=${rub}, TRY=${tryRate}`);
    return { usd, rub, try: tryRate, updatedAt: new Date().toISOString() };
  }
}
