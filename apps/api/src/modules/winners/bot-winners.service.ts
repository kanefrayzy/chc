import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

export interface BotWinner {
  username: string;
  avatarUrl: null;
  amountMinor: bigint;
  game: 'roulette' | 'mines' | 'classic' | 'lottery';
  multiplierBps: number;
  mineCount?: number;
  color?: 'RED' | 'BLACK' | 'GREEN';
  createdAt: Date;
  isBot: true;
}

/** Ники ботов — нейтральные, без намёка на реальных игроков. */
const NAMES = [
  'Player_92', 'Aysel', 'Kanan07', 'NightOwl', 'Rustam', 'LuckyAz', 'Elvin',
  'Murad_55', 'Sabina', 'GreenFox', 'Tural', 'Nigar', 'Vusal', 'AzWolf',
  'Samir88', 'Leyla', 'Orkhan', 'FastCat', 'Ramin', 'Gunel', 'Ilkin',
  'ZeroCool', 'Aynur', 'Farid', 'Baku_21', 'Nurlan', 'Sevinc', 'Emin_x',
];

const GAMES: BotWinner['game'][] = ['roulette', 'mines', 'classic', 'lottery'];
const COLORS: NonNullable<BotWinner['color']>[] = ['RED', 'BLACK', 'GREEN'];

/** Интервал появления новой записи, мс. */
const MIN_GAP_MS = 20_000;
const MAX_GAP_MS = 75_000;

/** Записи старше этого срока выбывают из ленты. */
const MAX_AGE_MS = 40 * 60 * 1000;

/** Сколько ботов держим в памяти максимум. */
const MAX_BOTS = 40;

/**
 * Боты для ленты последних выигрышей. Живут в памяти и «появляются» по одному
 * с реалистичным интервалом, поэтому лента не скачет между запросами: при
 * повторном обращении через секунду список тот же самый.
 *
 * Это витрина, а не игровая логика: боты не участвуют в расчётах, не влияют на
 * баланс, ранги и джекпот — они существуют только в ответе ленты.
 */
@Injectable()
export class BotWinnersService {
  private bots: BotWinner[] = [];
  private nextAt = 0;
  private seed = 0x2f6e2b1;

  constructor(private readonly settings: SettingsService) {}

  async enabled(): Promise<boolean> {
    try {
      return (await this.settings.get<boolean>('winners.bots_enabled')) !== false;
    } catch {
      return true;
    }
  }

  /** Детерминированный PRNG (xorshift) — не тянем зависимость ради витрины. */
  private random(): number {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >>> 17;
    this.seed ^= this.seed << 5;
    return ((this.seed >>> 0) % 1_000_000) / 1_000_000;
  }

  private pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.random() * list.length)]!;
  }

  /**
   * Сумма выигрыша: почти всегда небольшая, изредка крупная.
   * Распределение подобрано так, чтобы лента выглядела как реальная —
   * без «каждый второй сорвал тысячу».
   */
  private randomWin(): { amountMinor: bigint; multiplierBps: number } {
    const roll = this.random();
    let multiplier: number;
    if (roll < 0.55) multiplier = 2 + this.random() * 3;         // ×2–×5
    else if (roll < 0.85) multiplier = 5 + this.random() * 9;    // ×5–×14
    else if (roll < 0.97) multiplier = 14 + this.random() * 36;  // ×14–×50
    else multiplier = 50 + this.random() * 150;                  // ×50–×200

    const betAzn = 1 + Math.floor(this.random() * 40); // ставка 1–40 AZN
    const amountMinor = BigInt(Math.round(betAzn * multiplier * 100));
    return { amountMinor, multiplierBps: Math.round(multiplier * 10_000) };
  }

  private makeBot(at: number): BotWinner {
    const game = this.pick(GAMES);
    const { amountMinor, multiplierBps } = this.randomWin();
    const base: BotWinner = {
      username: this.pick(NAMES),
      avatarUrl: null,
      amountMinor,
      game,
      multiplierBps,
      createdAt: new Date(at),
      isBot: true,
    };
    if (game === 'mines') return { ...base, mineCount: 1 + Math.floor(this.random() * 8) };
    if (game === 'roulette') {
      const color = this.pick(COLORS);
      // Множитель рулетки фиксирован: ×2 на цвет, ×14 на зелёный
      return { ...base, color, multiplierBps: color === 'GREEN' ? 140_000 : 20_000 };
    }
    if (game === 'lottery') {
      // Лотерея — фиксированная ставка, поэтому выигрыш кратен ей
      return { ...base, multiplierBps };
    }
    return base;
  }

  /** Текущий список ботов; при необходимости досыпает новых. */
  list(now = Date.now()): BotWinner[] {
    // Первый вызов — заполняем ленту «задним числом», чтобы она не была пустой
    if (this.bots.length === 0) {
      let at = now;
      for (let i = 0; i < 12; i += 1) {
        at -= MIN_GAP_MS + Math.floor(this.random() * (MAX_GAP_MS - MIN_GAP_MS));
        this.bots.push(this.makeBot(at));
      }
      this.nextAt = now + MIN_GAP_MS + Math.floor(this.random() * (MAX_GAP_MS - MIN_GAP_MS));
    }

    while (now >= this.nextAt) {
      this.bots.unshift(this.makeBot(this.nextAt));
      this.nextAt += MIN_GAP_MS + Math.floor(this.random() * (MAX_GAP_MS - MIN_GAP_MS));
    }

    this.bots = this.bots
      .filter((b) => now - b.createdAt.getTime() < MAX_AGE_MS)
      .slice(0, MAX_BOTS);

    return this.bots;
  }
}
