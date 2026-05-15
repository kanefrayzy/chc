import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SettingsService } from '../settings/settings.service';

const SUPPORTED = ['ru', 'az'] as const;

/** Рекурсивно сливает base и override. override имеет приоритет для конечных значений. */
function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    const bv = base[key];
    const ov = override[key];
    if (
      ov !== null &&
      typeof ov === 'object' &&
      !Array.isArray(ov) &&
      bv !== null &&
      typeof bv === 'object' &&
      !Array.isArray(bv)
    ) {
      result[key] = deepMerge(
        bv as Record<string, unknown>,
        ov as Record<string, unknown>,
      );
    } else {
      result[key] = ov;
    }
  }
  return result;
}

@Controller('translations')
export class TranslationsController {
  constructor(private readonly settings: SettingsService) {}

  /**
   * GET /translations/:locale
   * Публичный endpoint: возвращает JSON переводов.
   * Всегда читает встроенный файл как base, поверх него накладывает
   * DB-оверрайд (если есть), чтобы новые ключи из файла были доступны всегда.
   */
  @Get(':locale')
  async get(@Param('locale') locale: string): Promise<Record<string, unknown>> {
    if (!(SUPPORTED as readonly string[]).includes(locale)) {
      throw new NotFoundException('Locale not found');
    }
    const filePath = path.join('/app', 'translations', `${locale}.json`);
    let fileMessages: Record<string, unknown> = {};
    try {
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      fileMessages = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // файл не найден — используем пустую базу
    }
    if (Object.keys(fileMessages).length === 0) {
      throw new NotFoundException('Translations not found');
    }
    const override = await this.settings.get<Record<string, unknown> | null>(
      `translations.${locale}`,
    );
    if (override && typeof override === 'object' && Object.keys(override).length > 0) {
      return deepMerge(fileMessages, override as Record<string, unknown>);
    }
    return fileMessages;
  }
}
