'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { TrophyIcon } from '@/components/icons';
import { getRealtimeSocket } from '@/lib/realtime/socket';
import {
  progressiveApi,
  type ProgressiveJackpotDto,
  type ProgressiveTier,
} from '@/lib/api/progressive';

/** Оформление уровней — от самого крупного к мелкому, как на витрине. */
const TIER_STYLE: Record<ProgressiveTier, { label: string; text: string; glow: string }> = {
  GRAND: { label: 'GRAND', text: 'text-danger', glow: 'shadow-[0_0_24px_-8px_rgb(239_68_68/0.6)]' },
  MAJOR: { label: 'MAJOR', text: 'text-warning', glow: 'shadow-[0_0_24px_-8px_rgb(245_158_11/0.6)]' },
  MINOR: { label: 'MINOR', text: 'text-brand', glow: 'shadow-[0_0_24px_-8px_rgb(34_197_94/0.6)]' },
  MINI: { label: 'MINI', text: 'text-info', glow: 'shadow-[0_0_24px_-8px_rgb(59_130_246/0.6)]' },
};

const ORDER: ProgressiveTier[] = ['GRAND', 'MAJOR', 'MINOR', 'MINI'];

/**
 * Сумма с копейками. Отчисление с одной ставки — доли копейки, поэтому без
 * дробной части витрина выглядела бы застывшей: чтобы целое число AZN
 * сдвинулось, нужны сотни ставок.
 */
function formatAmount(minor: bigint): string {
  const major = minor / 100n;
  const frac = (minor % 100n).toString().padStart(2, '0');
  return `${major.toLocaleString('ru-RU')},${frac}`;
}

/**
 * Плавно доводит показанное число до целевого за ~900 мс.
 * Анимируем только реальные изменения, полученные с сервера — никаких
 * выдуманных «подкруток» между обновлениями.
 */
function useCountUp(target: bigint): bigint {
  const [shown, setShown] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;

    const delta = target - from;
    // Большой скачок (первая загрузка) показываем сразу
    if (delta < 0n || delta > from / 2n) {
      fromRef.current = target;
      setShown(target);
      return;
    }

    const start = performance.now();
    const DURATION = 900;
    const tick = (now: number): void => {
      const p = Math.min(1, (now - start) / DURATION);
      const eased = 1 - (1 - p) * (1 - p);
      const value = from + (delta * BigInt(Math.round(eased * 1000))) / 1000n;
      setShown(value);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target]);

  return shown;
}

function TierCell({ tier, minor }: { tier: ProgressiveTier; minor: bigint }): JSX.Element {
  const style = TIER_STYLE[tier];
  const shown = useCountUp(minor);
  return (
    <div className="flex flex-col items-center justify-center px-2 py-1 text-center">
      <span className={`text-[11px] font-extrabold uppercase tracking-[0.15em] ${style.text}`}>
        {style.label}
      </span>
      <span className="mt-1 font-mono text-base font-black tabular-nums text-text-primary sm:text-xl">
        {formatAmount(shown)}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">AZN</span>
    </div>
  );
}

export interface ProgressiveJackpotProps {
  initialItems: ProgressiveJackpotDto[];
}

export function ProgressiveJackpot({ initialItems }: ProgressiveJackpotProps): JSX.Element | null {
  const t = useTranslations('jackpot');
  const [items, setItems] = useState<ProgressiveJackpotDto[]>(initialItems);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const socket = getRealtimeSocket();
    const onState = (payload: { items?: ProgressiveJackpotDto[] }): void => {
      if (Array.isArray(payload?.items)) {
        setItems(payload.items.filter((i) => i.enabled));
      }
    };
    socket.on('progressive:state', onState);

    // Подстраховка на случай пропущенного события
    const timer = setInterval(() => {
      progressiveApi
        .list()
        .then((r) => setItems(r.items))
        .catch(() => undefined);
    }, 60_000);

    return () => {
      socket.off('progressive:state', onState);
      clearInterval(timer);
    };
  }, []);

  const byTier = new Map(items.map((i) => [i.tier, i]));
  const visible = ORDER.filter((tier) => byTier.has(tier));
  if (visible.length === 0) return null;

  return (
    <section
      aria-labelledby="jackpot-title"
      className="mt-6 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-bg-card via-bg-card to-bg-elevated"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-2.5">
        <h2
          id="jackpot-title"
          className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-brand"
        >
          <TrophyIcon className="h-4 w-4" />
          {t('title')}
        </h2>
        <button
          type="button"
          onClick={() => setHint((v) => !v)}
          aria-expanded={hint}
          aria-label={t('help')}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-[10px] font-bold text-text-muted transition-colors hover:border-brand/40 hover:text-brand"
        >
          i
        </button>
      </div>

      <div className="grid grid-cols-4 divide-x divide-border/60 py-3">
        {visible.map((tier) => (
          <TierCell key={tier} tier={tier} minor={BigInt(byTier.get(tier)!.currentMinor)} />
        ))}
      </div>

      {hint && (
        <p className="border-t border-border/70 px-4 py-3 text-xs leading-relaxed text-text-secondary">
          {t('helpText')}
        </p>
      )}
    </section>
  );
}
