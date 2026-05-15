import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SettingsService } from '../settings/settings.service';

const SUPPORTED = ['ru', 'az'] as const;

@Controller('translations')
export class TranslationsController {
  constructor(private readonly settings: SettingsService) {}

  /**
   * GET /translations/:locale
   * Публичный endpoint: возвращает JSON переводов.
   * Если в БД есть переопределение — возвращает его.
   * Иначе читает встроенный дефолтный файл.
   * Если файл тоже не найден — 404.
   */
  @Get(':locale')
  async get(@Param('locale') locale: string): Promise<Record<string, unknown>> {
    if (!(SUPPORTED as readonly string[]).includes(locale)) {
      throw new NotFoundException('Locale not found');
    }
    const override = await this.settings.get<Record<string, unknown> | null>(
      `translations.${locale}`,
    );
    if (override && typeof override === 'object' && Object.keys(override).length > 0) {
      return override as Record<string, unknown>;
    }
    const filePath = path.join('/app', 'translations', `${locale}.json`);
    try {
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new NotFoundException('Translations not found');
    }
  }
}
