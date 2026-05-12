import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.module';
import {
  SETTING_DEFINITIONS,
  SETTING_DEFINITION_MAP,
  type SettingDefinition,
} from './settings.constants';

interface CachedValue {
  value: unknown;
  expiresAt: number;
}

const TTL_MS = 60_000; // 1 минута

export interface SettingRow {
  key: string;
  value: unknown;
  type: SettingDefinition['type'];
  isPublic: boolean;
  description: string;
  isDefault: boolean;
  updatedAt: string | null;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly cache = new Map<string, CachedValue>();

  constructor(private readonly prisma: PrismaService) {}

  /** Получить значение настройки c учётом дефолта. Кэш — 1 минута. */
  async get<T = unknown>(key: string): Promise<T> {
    const def = SETTING_DEFINITION_MAP[key];
    if (!def) {
      throw new Error(`Unknown setting key: ${key}`);
    }
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    const value = (row?.value ?? def.defaultValue) as T;
    this.cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
    return value;
  }

  /** Возвращает все настройки (для admin UI), включая дефолтные. */
  async listAll(): Promise<SettingRow[]> {
    const rows = await this.prisma.appSetting.findMany();
    const map = new Map(rows.map((r) => [r.key, r]));
    return SETTING_DEFINITIONS.map((def) => {
      const row = map.get(def.key);
      return {
        key: def.key,
        value: row?.value ?? def.defaultValue,
        type: def.type,
        isPublic: def.isPublic,
        description: def.description,
        isDefault: !row,
        updatedAt: row?.updatedAt.toISOString() ?? null,
      };
    });
  }

  /** Возвращает только публичные ключи (для GET /settings/public). */
  async getPublic(): Promise<Record<string, unknown>> {
    const rows = await this.prisma.appSetting.findMany();
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const result: Record<string, unknown> = {};
    for (const def of SETTING_DEFINITIONS) {
      if (def.isPublic) {
        result[def.key] = map.get(def.key) ?? def.defaultValue;
      }
    }
    return result;
  }

  /**
   * Установить значение. Валидирует тип. Возвращает сохранённую строку.
   * Сбрасывает кэш по этому ключу.
   */
  async set(key: string, value: unknown): Promise<SettingRow> {
    const def = SETTING_DEFINITION_MAP[key];
    if (!def) {
      throw new Error(`Unknown setting key: ${key}`);
    }
    this.validateType(def, value);
    const row = await this.prisma.appSetting.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue },
      create: { key, value: value as Prisma.InputJsonValue },
    });
    this.cache.delete(key);
    this.logger.log(`Setting "${key}" updated`);
    return {
      key: row.key,
      value: row.value,
      type: def.type,
      isPublic: def.isPublic,
      description: def.description,
      isDefault: false,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private validateType(def: SettingDefinition, value: unknown): void {
    switch (def.type) {
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new Error(`Setting "${def.key}" must be boolean`);
        }
        break;
      case 'string':
        if (typeof value !== 'string') {
          throw new Error(`Setting "${def.key}" must be string`);
        }
        break;
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new Error(`Setting "${def.key}" must be a finite number`);
        }
        break;
      case 'json':
        if (value === null || typeof value !== 'object') {
          throw new Error(`Setting "${def.key}" must be a JSON object`);
        }
        break;
    }
  }
}
