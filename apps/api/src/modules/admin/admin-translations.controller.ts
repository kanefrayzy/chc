import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SettingsService } from '../settings/settings.service';

const SUPPORTED_LOCALES = ['ru', 'az'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupported(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

/** Читает встроенный дефолтный файл переводов, скопированный из web при сборке. */
async function readDefaultMessages(locale: SupportedLocale): Promise<Record<string, unknown>> {
  const filePath = path.join('/app', 'translations', `${locale}.json`);
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

@Controller('admin/translations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminTranslationsController {
  constructor(private readonly settings: SettingsService) {}

  /**
   * GET /admin/translations/:locale
   * Возвращает { locale, messages, isCustom }.
   * messages — переопределение из БД, если есть, иначе дефолтный встроенный файл.
   */
  @Get(':locale')
  async get(@Param('locale') locale: string): Promise<{
    locale: string;
    messages: Record<string, unknown>;
    isCustom: boolean;
  }> {
    if (!isSupported(locale)) {
      throw new BadRequestException(`Locale must be one of: ${SUPPORTED_LOCALES.join(', ')}`);
    }
    const override = await this.settings.get<Record<string, unknown> | null>(
      `translations.${locale}`,
    );
    if (override && typeof override === 'object' && Object.keys(override).length > 0) {
      return { locale, messages: override as Record<string, unknown>, isCustom: true };
    }
    const defaults = await readDefaultMessages(locale);
    return { locale, messages: defaults, isCustom: false };
  }

  /**
   * POST /admin/translations/:locale
   * Сохраняет JSON переводов в настройках. Принимает тело { messages: {...} }.
   */
  @Post(':locale')
  async save(
    @Param('locale') locale: string,
    @Body() body: unknown,
  ): Promise<{ locale: string; isCustom: boolean }> {
    if (!isSupported(locale)) {
      throw new BadRequestException(`Locale must be one of: ${SUPPORTED_LOCALES.join(', ')}`);
    }
    const schema = z.object({ messages: z.record(z.unknown()) });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Body must be { messages: { ... } }');
    }
    await this.settings.set(`translations.${locale}`, parsed.data.messages);
    return { locale, isCustom: true };
  }

  /**
   * POST /admin/translations/:locale/reset
   * Сбрасывает переопределение, возвращая к встроенному файлу.
   */
  @Post(':locale/reset')
  async reset(@Param('locale') locale: string): Promise<{ locale: string; isCustom: boolean }> {
    if (!isSupported(locale)) {
      throw new BadRequestException(`Locale must be one of: ${SUPPORTED_LOCALES.join(', ')}`);
    }
    await this.settings.set(`translations.${locale}`, null);
    return { locale, isCustom: false };
  }
}
