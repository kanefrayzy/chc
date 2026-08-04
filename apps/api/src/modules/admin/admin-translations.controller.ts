import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
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

type Dict = Record<string, unknown>;

function isSupported(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

function isPlainObject(value: unknown): value is Dict {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Читает встроенный дефолтный файл переводов, скопированный из web при сборке. */
async function readDefaultMessages(locale: SupportedLocale): Promise<Dict> {
  const filePath = path.join('/app', 'translations', `${locale}.json`);
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as Dict;
  } catch {
    return {};
  }
}

/** Раскладывает вложенный словарь в плоские ключи вида `lottery.buy`. */
function flatten(source: Dict, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    const full = `${prefix}${key}`;
    if (isPlainObject(value)) {
      Object.assign(out, flatten(value, `${full}.`));
    } else if (typeof value === 'string') {
      out[full] = value;
    }
  }
  return out;
}

/** Записывает значение по пути `a.b.c`, создавая недостающие уровни. */
function setDeep(target: Dict, keyPath: string, value: string): void {
  const parts = keyPath.split('.');
  let node = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i] as string;
    const next = node[part];
    if (!isPlainObject(next)) node[part] = {};
    node = node[part] as Dict;
  }
  node[parts[parts.length - 1] as string] = value;
}

/** Удаляет значение по пути и подчищает опустевшие ветки. */
function deleteDeep(target: Dict, keyPath: string): void {
  const parts = keyPath.split('.');
  const chain: Dict[] = [target];
  let node: Dict = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const next = node[parts[i] as string];
    if (!isPlainObject(next)) return;
    node = next;
    chain.push(node);
  }
  delete node[parts[parts.length - 1] as string];
  // Пустой объект в оверрайде выглядел бы как правка, которой нет
  for (let i = chain.length - 1; i > 0; i -= 1) {
    const current = chain[i] as Dict;
    if (Object.keys(current).length > 0) break;
    delete (chain[i - 1] as Dict)[parts[i - 1] as string];
  }
}

export interface TranslationEntryDto {
  /** Полный путь ключа: `lottery.buy`. */
  key: string;
  /** Значение из встроенного файла. */
  defaultValue: string;
  /** Что реально показывается сейчас. */
  value: string;
  /** Значение переопределено через админку. */
  overridden: boolean;
}

@Controller('admin/translations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AdminTranslationsController {
  constructor(private readonly settings: SettingsService) {}

  private async loadOverride(locale: SupportedLocale): Promise<Dict> {
    const override = await this.settings.get<Dict | null>(`translations.${locale}`);
    return isPlainObject(override) ? override : {};
  }

  /**
   * GET /admin/translations/:locale
   * Плоский список ключей: значение по умолчанию, текущее и признак правки.
   * `messages` оставлен для обратной совместимости со старым JSON-редактором.
   */
  @Get(':locale')
  async get(@Param('locale') locale: string): Promise<{
    locale: string;
    isCustom: boolean;
    entries: TranslationEntryDto[];
    messages: Dict;
  }> {
    if (!isSupported(locale)) {
      throw new BadRequestException(`Locale must be one of: ${SUPPORTED_LOCALES.join(', ')}`);
    }
    const defaults = await readDefaultMessages(locale);
    const override = await this.loadOverride(locale);
    const flatDefaults = flatten(defaults);
    const flatOverride = flatten(override);

    // Ключи из оверрайда, которых уже нет в файле, тоже показываем — иначе
    // их не удалить из админки
    const keys = [...new Set([...Object.keys(flatDefaults), ...Object.keys(flatOverride)])].sort();
    const entries: TranslationEntryDto[] = keys.map((key) => {
      const defaultValue = flatDefaults[key] ?? '';
      const overridden = Object.prototype.hasOwnProperty.call(flatOverride, key);
      return {
        key,
        defaultValue,
        value: overridden ? (flatOverride[key] as string) : defaultValue,
        overridden,
      };
    });

    return {
      locale,
      isCustom: Object.keys(flatOverride).length > 0,
      entries,
      messages: defaults,
    };
  }

  /**
   * PATCH /admin/translations/:locale
   * Точечная правка: `{ entries: { "lottery.buy": "Al" , "hero.badge": null } }`.
   * null сбрасывает ключ к встроенному значению. Хранится только разница,
   * поэтому новые ключи из сборки не перекрываются устаревшим снимком.
   */
  @Patch(':locale')
  async patch(
    @Param('locale') locale: string,
    @Body() body: unknown,
  ): Promise<{ locale: string; isCustom: boolean; changed: number }> {
    if (!isSupported(locale)) {
      throw new BadRequestException(`Locale must be one of: ${SUPPORTED_LOCALES.join(', ')}`);
    }
    const schema = z.object({
      entries: z.record(z.string().min(1).max(200), z.string().max(5000).nullable()),
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Body must be { entries: { "ns.key": "text" | null } }');
    }

    const override = await this.loadOverride(locale);
    const defaults = flatten(await readDefaultMessages(locale));
    let changed = 0;

    for (const [key, value] of Object.entries(parsed.data.entries)) {
      if (!/^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(key)) {
        throw new BadRequestException(`Invalid key: ${key}`);
      }
      // Значение, совпавшее с дефолтом, хранить незачем
      if (value === null || value === defaults[key]) {
        deleteDeep(override, key);
      } else {
        setDeep(override, key, value);
      }
      changed += 1;
    }

    const isCustom = Object.keys(override).length > 0;
    await this.settings.set(`translations.${locale}`, isCustom ? override : null);
    return { locale, isCustom, changed };
  }

  /**
   * POST /admin/translations/:locale
   * Полная замена словаря. Оставлен для совместимости; админка правит точечно.
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
   * Сбрасывает все правки, возвращая встроенные тексты.
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
