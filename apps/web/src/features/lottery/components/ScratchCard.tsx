'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lotteryApi, type LotteryInfoDto, type LotteryTicketDto } from '@/lib/api/lottery';
import { ApiException } from '@/lib/api/client';
import { ScratchCell } from './ScratchCell';

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

/** Компактная запись для ячейки: без копеек, если их нет. */
function formatCell(minor: bigint): string {
  const major = minor / 100n;
  const frac = minor % 100n;
  if (frac === 0n) return major.toLocaleString('ru-RU');
  return `${major},${frac.toString().padStart(2, '0')}`;
}

/** Цвет суммы по рангу приза — крупные видно сразу. */
function toneFor(multiplierBps: number): string {
  if (multiplierBps >= 10_000_000) return 'text-danger';
  if (multiplierBps >= 500_000) return 'text-warning';
  if (multiplierBps >= 100_000) return 'text-brand';
  return 'text-text-secondary';
}

function formatMultiplier(bps: number): string {
  const v = bps / 10_000;
  if (v >= 1000) return `×${(v / 1000).toLocaleString('ru-RU')}k`;
  return `×${v.toLocaleString('ru-RU')}`;
}

export interface ScratchCardProps {
  info: LotteryInfoDto;
  isAuthed: boolean;
  locale: string;
}

export function ScratchCard({ info, isAuthed, locale }: ScratchCardProps): JSX.Element {
  const [ticket, setTicket] = useState<LotteryTicketDto | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [revealAll, setRevealAll] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoLeft, setAutoLeft] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const autoRef = useRef(0);
  const localePrefix = locale === 'ru' ? '' : `/${locale}`;

  /** symbol → приз и множитель. */
  const prizeBySymbol = useMemo(() => {
    const map = new Map<number, { minor: bigint; multiplierBps: number }>();
    for (const p of info.prizes) {
      map.set(p.symbol, { minor: BigInt(p.prizeMinor), multiplierBps: p.multiplierBps });
    }
    return map;
  }, [info.prizes]);

  const allRevealed = ticket !== null && revealed.size === ticket.symbols.length;
  const won = ticket !== null && BigInt(ticket.prizeMinor) > 0n;

  const onCellReveal = useCallback((index: number) => {
    setRevealed((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const buy = useCallback(async (): Promise<LotteryTicketDto | null> => {
    setError(null);
    setBuying(true);
    try {
      const t = await lotteryApi.buy();
      setRevealAll(false);
      setRevealed(new Set());
      setTicket(t);
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

  // Автоигра: покупаем билет, сразу вскрываем, пауза, следующий.
  useEffect(() => {
    if (autoLeft <= 0) return;
    let cancelled = false;

    const run = async (): Promise<void> => {
      const t = await buy();
      if (cancelled || !t) return;
      setRevealAll(true);
      setTimeout(() => {
        if (cancelled) return;
        autoRef.current -= 1;
        setAutoLeft(autoRef.current);
      }, 1300);
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [autoLeft, buy]);

  const cells = ticket?.symbols ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,430px)_1fr]">
      {/* ── Билет ───────────────────────────────────────────────── */}
      <div>
        <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-bg-elevated to-bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-brand">
              Лотерея
            </span>
            <span className="font-mono text-sm font-bold text-text-primary">
              {formatAzn(info.betMinor)} AZN
            </span>
          </div>

          <div className="p-4">
            <p className="text-center text-sm font-semibold text-text-secondary">
              {ticket
                ? 'Стирайте покрытие — три одинаковые суммы дают выигрыш'
                : 'Купите билет, чтобы начать'}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {(ticket ? cells : Array.from({ length: 9 }, () => -1)).map((symbol, i) => {
                const prize = prizeBySymbol.get(symbol);
                const isWinning = ticket?.winningSymbol === symbol && won;
                return (
                  <ScratchCell
                    key={`${ticket?.id ?? 'empty'}-${i}`}
                    ticketId={ticket?.id ?? 'empty'}
                    index={i}
                    label={prize ? formatCell(prize.minor) : '—'}
                    tone={prize ? toneFor(prize.multiplierBps) : 'text-text-muted'}
                    highlight={Boolean(isWinning)}
                    locked={!ticket || autoLeft > 0}
                    forceReveal={revealAll}
                    onReveal={onCellReveal}
                  />
                );
              })}
            </div>

            {/* Результат */}
            <div className="mt-3 flex min-h-[64px] flex-col items-center justify-center rounded-xl border border-border bg-bg-base px-3 py-2 text-center">
              {!ticket ? (
                <span className="text-sm text-text-muted">Билет не куплен</span>
              ) : !allRevealed ? (
                <span className="text-sm text-text-secondary">
                  Открыто {revealed.size} из 9
                </span>
              ) : won ? (
                <>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand">
                    Выигрыш
                  </span>
                  <span className="font-mono text-2xl font-black tabular-nums text-brand">
                    +{formatAzn(ticket.prizeMinor)} AZN
                  </span>
                </>
              ) : (
                <span className="text-sm font-semibold text-text-muted">
                  Не повезло — попробуйте ещё раз
                </span>
              )}
            </div>
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
                {buying ? 'Покупаем' : `Купить за ${formatAzn(info.betMinor)}`}
              </button>
              <button
                type="button"
                disabled={!ticket || allRevealed || autoLeft > 0}
                onClick={() => setRevealAll(true)}
                className="rounded-xl border border-border px-4 py-3.5 text-sm font-bold text-text-secondary transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
              >
                Стереть всё
              </button>
            </div>

            {autoLeft > 0 ? (
              <button
                type="button"
                onClick={() => {
                  autoRef.current = 0;
                  setAutoLeft(0);
                }}
                className="w-full rounded-xl border border-danger/40 py-2.5 text-sm font-bold text-danger transition-colors hover:bg-danger/10"
              >
                Остановить автоигру — осталось {autoLeft}
              </button>
            ) : (
              <div className="flex gap-2">
                {[5, 10, 25].map((n) => (
                  <button
                    key={n}
                    type="button"
                    disabled={buying}
                    onClick={() => {
                      autoRef.current = n;
                      setAutoLeft(n);
                    }}
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
                <dt className="text-text-muted">Хеш серверного сида (зафиксирован до игры)</dt>
                <dd className="break-all font-mono text-text-secondary">{ticket.serverSeedHash}</dd>
              </div>
              <div>
                <dt className="text-text-muted">Серверный сид (раскрыт после)</dt>
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
              Билет {formatAzn(info.betMinor)} AZN — возврат в игру 96%
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-2 text-left font-semibold">Выигрыш</th>
                  <th className="px-4 py-2 text-right font-semibold">Множитель</th>
                  <th className="px-4 py-2 text-right font-semibold">Шанс</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {info.prizes.map((p) => (
                  <tr key={p.symbol} className="transition-colors hover:bg-bg-card-hover">
                    <td
                      className={`px-4 py-2.5 font-mono font-bold tabular-nums ${toneFor(p.multiplierBps)}`}
                    >
                      {formatAzn(p.prizeMinor)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-text-secondary">
                      {formatMultiplier(p.multiplierBps)}
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
            <span className="text-lg leading-none text-text-muted">{showRules ? '−' : '+'}</span>
          </button>
          {showRules && (
            <div className="space-y-2 border-t border-border px-4 py-3 text-xs leading-relaxed text-text-secondary">
              <p>
                Билет стоит {formatAzn(info.betMinor)} AZN. На карте девять закрытых ячеек,
                под каждой — сумма. Стирайте покрытие курсором или пальцем.
              </p>
              <p>
                Если открылись три одинаковые суммы, вы выигрываете эту сумму. Выигрыш
                зачисляется на баланс сразу. Больше одного приза на карте быть не может.
              </p>
              <p>
                Кнопка «Стереть всё» открывает карту целиком. «Авто» покупает и вскрывает
                несколько билетов подряд, остановить можно в любой момент.
              </p>
              <p>
                Игра проверяемо честная: хеш серверного сида фиксируется до покупки, сам
                сид раскрывается после вскрытия — результат можно пересчитать.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
