'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { lotteryApi, type LotteryInfoDto, type LotteryTicketDto } from '@/lib/api/lottery';
import { ApiException } from '@/lib/api/client';

/** Символы уровней — от самого крупного приза к мелкому. */
const SYMBOLS = ['⭐', '💎', '👑', '🔔', '🍀', '🍒', '🔥', '⚡', '🎈', '🪙'];

const ERRORS: Record<string, string> = {
  INSUFFICIENT_FUNDS: 'Недостаточно средств — пополните баланс',
  LOTTERY_DISABLED: 'Лотерея временно недоступна',
};

function formatAzn(minor: string): string {
  const value = BigInt(minor);
  const major = value / 100n;
  const frac = (value % 100n).toString().padStart(2, '0');
  return `${major.toLocaleString('ru-RU')},${frac}`;
}

function shortMultiplier(bps: number): string {
  const v = bps / 10_000;
  return v >= 1000 ? `×${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `×${v}`;
}

export interface ScratchCardProps {
  info: LotteryInfoDto;
  isAuthed: boolean;
  locale: string;
}

export function ScratchCard({ info, isAuthed, locale }: ScratchCardProps): JSX.Element {
  const [ticket, setTicket] = useState<LotteryTicketDto | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoLeft, setAutoLeft] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const autoRef = useRef(0);
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;

  const allRevealed = ticket !== null && revealed.size === ticket.symbols.length;
  const won = ticket !== null && BigInt(ticket.prizeMinor) > 0n;

  const buy = useCallback(async (): Promise<LotteryTicketDto | null> => {
    setError(null);
    setBuying(true);
    try {
      const t = await lotteryApi.buy();
      setTicket(t);
      setRevealed(new Set());
      return t;
    } catch (e) {
      const raw = e instanceof ApiException ? e.message : '';
      setError(ERRORS[raw] ?? raw ?? 'Не удалось купить билет');
      autoRef.current = 0;
      setAutoLeft(0);
      return null;
    } finally {
      setBuying(false);
    }
  }, []);

  function revealCell(index: number): void {
    if (!ticket) return;
    setRevealed((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }

  function revealAll(): void {
    if (!ticket) return;
    setRevealed(new Set(ticket.symbols.map((_, i) => i)));
  }

  // Автоигра: покупаем билет, сразу вскрываем, пауза, следующий.
  useEffect(() => {
    if (autoLeft <= 0) return;
    let cancelled = false;

    const run = async (): Promise<void> => {
      const t = await buy();
      if (cancelled || !t) return;
      setRevealed(new Set(t.symbols.map((_, i) => i)));
      setTimeout(() => {
        if (cancelled) return;
        autoRef.current -= 1;
        setAutoLeft(autoRef.current);
      }, 1200);
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [autoLeft, buy]);

  function startAuto(count: number): void {
    autoRef.current = count;
    setAutoLeft(count);
  }

  function stopAuto(): void {
    autoRef.current = 0;
    setAutoLeft(0);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
      {/* ── Карта ───────────────────────────────────────────────── */}
      <div>
        <div className="overflow-hidden rounded-2xl border-4 border-warning/40 bg-gradient-to-br from-warning/25 via-warning/10 to-bg-card p-4 shadow-glow">
          <div className="flex items-center justify-between">
            <span className="rounded bg-bg-base/70 px-2.5 py-1 text-sm font-black uppercase tracking-wider text-warning">
              Лотерея
            </span>
            <span className="font-mono text-sm font-bold text-text-primary">
              {formatAzn(info.betMinor)} AZN
            </span>
          </div>

          <p className="mt-3 text-center text-sm font-bold text-text-primary">
            Соберите 3 одинаковых символа
          </p>

          {/* Сетка 3×3 */}
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border-2 border-warning/30 bg-bg-base/50 p-2">
            {(ticket?.symbols ?? Array.from({ length: 9 }, () => -1)).map((symbol, i) => {
              const open = ticket !== null && revealed.has(i);
              const isWinningSymbol =
                open && ticket !== null && ticket.winningSymbol === symbol && won;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!ticket || open || autoLeft > 0}
                  onClick={() => revealCell(i)}
                  aria-label={open ? `Символ ${SYMBOLS[symbol] ?? '?'}` : 'Стереть покрытие'}
                  className={[
                    'flex aspect-square items-center justify-center rounded-lg text-3xl transition-all duration-200',
                    open
                      ? isWinningSymbol
                        ? 'scale-105 bg-brand/20 ring-2 ring-brand'
                        : 'bg-bg-card ring-1 ring-border'
                      : ticket
                        ? 'cursor-pointer bg-gradient-to-br from-warning/50 to-warning/25 ring-1 ring-warning/40 hover:from-warning/60'
                        : 'bg-bg-elevated ring-1 ring-border',
                  ].join(' ')}
                >
                  {open ? (SYMBOLS[symbol] ?? '?') : ticket ? '❓' : '·'}
                </button>
              );
            })}
          </div>

          {/* Результат */}
          <div className="mt-3 min-h-[52px] rounded-xl bg-bg-base/60 px-3 py-2 text-center">
            {!ticket ? (
              <p className="text-sm text-text-muted">
                Купите билет, чтобы начать игру
              </p>
            ) : !allRevealed ? (
              <p className="text-sm text-text-secondary">
                Открыто {revealed.size} из 9 — стирайте покрытие
              </p>
            ) : won ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand">
                  Выигрыш
                </p>
                <p className="font-mono text-2xl font-black tabular-nums text-brand">
                  +{formatAzn(ticket.prizeMinor)} AZN
                </p>
              </>
            ) : (
              <p className="py-2 text-sm font-semibold text-text-muted">
                Не повезло — попробуйте ещё раз
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Управление */}
        {isAuthed ? (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={buying || autoLeft > 0}
                onClick={() => void buy()}
                className="flex-1 rounded-xl bg-brand py-3.5 text-sm font-black uppercase tracking-wide text-bg-base transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {buying ? 'Покупаем…' : `Купить за ${formatAzn(info.betMinor)}`}
              </button>
              <button
                type="button"
                disabled={!ticket || allRevealed || autoLeft > 0}
                onClick={revealAll}
                className="rounded-xl border border-border px-4 py-3.5 text-sm font-bold text-text-secondary transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
              >
                Стереть всё
              </button>
            </div>

            {autoLeft > 0 ? (
              <button
                type="button"
                onClick={stopAuto}
                className="w-full rounded-xl border border-danger/40 py-2.5 text-sm font-bold text-danger transition-colors hover:bg-danger/10"
              >
                Остановить автоигру · осталось {autoLeft}
              </button>
            ) : (
              <div className="flex gap-2">
                {[5, 10, 25].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={buying}
                    onClick={() => startAuto(n)}
                    className="flex-1 rounded-xl border border-border py-2.5 text-xs font-bold text-text-secondary transition-colors hover:border-brand/40 hover:text-brand disabled:opacity-40"
                  >
                    Авто ×{n}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <a
            href={`${localePrefix}/login`}
            className="mt-3 block rounded-xl border border-brand/40 py-3.5 text-center text-sm font-bold text-brand transition-colors hover:bg-brand/10"
          >
            Войти, чтобы играть
          </a>
        )}

        {/* Честность игры */}
        {ticket && allRevealed && (
          <details className="mt-3 rounded-xl border border-border bg-bg-card px-4 py-3">
            <summary className="cursor-pointer text-xs font-semibold text-text-secondary">
              Проверить честность билета
            </summary>
            <dl className="mt-2 space-y-1.5 text-[11px]">
              <div>
                <dt className="text-text-muted">Хеш серверного сида (до игры)</dt>
                <dd className="break-all font-mono text-text-secondary">{ticket.serverSeedHash}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Серверный сид (раскрыт)</dt>
                <dd className="break-all font-mono text-text-secondary">{ticket.serverSeed}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Клиентский сид</dt>
                <dd className="break-all font-mono text-text-secondary">{ticket.clientSeed}</dd>
              </div>
            </dl>
          </details>
        )}
      </div>

      {/* ── Призы и правила ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-border bg-bg-card">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold text-text-primary">Призовая таблица</h2>
            <p className="mt-0.5 text-[11px] text-text-muted">
              Три одинаковых символа — приз этого уровня
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-2 text-left font-semibold">Символ</th>
                  <th className="px-4 py-2 text-right font-semibold">Выигрыш</th>
                  <th className="px-4 py-2 text-right font-semibold">Шанс</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {info.prizes.map((p) => (
                  <tr key={p.symbol} className="transition-colors hover:bg-bg-card-hover">
                    <td className="px-4 py-2.5">
                      <span className="mr-2 text-xl">{SYMBOLS[p.symbol] ?? '?'}</span>
                      <span className="font-mono text-xs text-text-muted">
                        {shortMultiplier(p.multiplierBps)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold tabular-nums text-text-primary">
                      {formatAzn(p.prizeMinor)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-text-muted">
                      1 : {p.oddsOneIn.toLocaleString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-bg-card">
          <button
            type="button"
            onClick={() => setShowRules((v) => !v)}
            aria-expanded={showRules}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-bold text-text-primary">Правила игры</span>
            <span className="text-text-muted">{showRules ? '−' : '+'}</span>
          </button>
          {showRules && (
            <div className="space-y-2 border-t border-border px-4 py-3 text-xs leading-relaxed text-text-secondary">
              <p>
                Билет стоит {formatAzn(info.betMinor)} AZN. На карте девять закрытых
                ячеек — стирайте покрытие вручную или нажмите «Стереть всё».
              </p>
              <p>
                Если открылись три одинаковых символа, вы получаете приз этого уровня.
                Выигрыш зачисляется на баланс сразу. Больше одного приза на карте быть
                не может.
              </p>
              <p>
                «Авто» покупает и вскрывает несколько билетов подряд — остановить можно
                в любой момент.
              </p>
              <p>
                Игра честная и проверяемая: хеш серверного сида фиксируется до покупки,
                а сам сид раскрывается после вскрытия карты — результат можно пересчитать.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
