'use client';

import { useEffect, useRef, useState } from 'react';
import type { RouletteColor } from '@/lib/api/roulette';
import { ROULETTE_SLOTS } from '../constants';

// ──────────────────────────────────────────────────────────────────────────────
// Цвета и иконки для каждого типа слота
// ──────────────────────────────────────────────────────────────────────────────
const FILL: Record<RouletteColor, string> = {
  GREEN: '#00ff88',
  RED: '#ff3b5c',
  BLACK: '#1a2035',
};
const LABEL_COLOR: Record<RouletteColor, string> = {
  GREEN: '#07090c',
  RED: '#ffffff',
  BLACK: '#ffffff',
};
const ICON: Record<RouletteColor, string> = {
  GREEN: '★',
  RED: '♦',
  BLACK: '♠',
};

const TOTAL = ROULETTE_SLOTS.length; // 15
const DEG_PER_SLOT = 360 / TOTAL;   // 24°

export interface RouletteWheelProps {
  winningSlot: number | null;
  status: 'BETTING' | 'ROLLING' | 'COMPLETED' | 'CANCELLED';
}

/**
 * Настоящее круглое SVG-колесо: 15 секторов (7 RED, 7 BLACK, 1 GREEN).
 * Крутится при ROLLING, снапается к выигрышному слоту при COMPLETED.
 */
export function RouletteWheel({ winningSlot, status }: RouletteWheelProps): JSX.Element {
  // angleDeg — угол поворота всего колеса (CSS transform rotate)
  const [angleDeg, setAngleDeg] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const rafRef = useRef<number | null>(null);
  const prevStatus = useRef(status);
  const startAngle = useRef(0);
  const startTime = useRef(0);
  const spinDuration = useRef(0);
  const targetAngle = useRef(0);

  useEffect(() => {
    const wasRolling = prevStatus.current === 'ROLLING';
    const nowCompleted = status === 'COMPLETED';
    const nowRolling = status === 'ROLLING';

    if (prevStatus.current !== 'ROLLING' && nowRolling) {
      // Начать вращение: плавное ускорение затем замедление
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setIsSpinning(true);
      startTime.current = performance.now();
      startAngle.current = angleDeg;
      // Повернуть на 5–8 полных оборотов за 4 секунды
      spinDuration.current = 4000;
      targetAngle.current = angleDeg + 360 * 6 + Math.random() * 360;

      const animate = (now: number): void => {
        const elapsed = now - startTime.current;
        const t = Math.min(elapsed / spinDuration.current, 1);
        // Ease-out cubic
        const ease = 1 - Math.pow(1 - t, 3);
        const cur = startAngle.current + (targetAngle.current - startAngle.current) * ease;
        setAngleDeg(cur);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          setIsSpinning(false);
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    }

    if ((nowCompleted || (wasRolling && nowCompleted)) && winningSlot !== null) {
      // Доворот к точному слоту: центр слота winningSlot окажется сверху (под стрелкой)
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setIsSpinning(false);

      // Верхний центр = 270° от SVG-нуля (который у нас направо).
      // Слот winningSlot начинается с угла winningSlot * DEG_PER_SLOT
      // Центр слота = (winningSlot + 0.5) * DEG_PER_SLOT
      // Чтобы он оказался под стрелкой (сверху = -90°):
      const slotCenter = (winningSlot + 0.5) * DEG_PER_SLOT;
      const base = Math.ceil(angleDeg / 360) * 360;
      const snapTo = base - slotCenter - 90;
      // Оставляем текущий angle и плавно доезжаем до snap
      startAngle.current = angleDeg;
      startTime.current = performance.now();
      spinDuration.current = 600;
      targetAngle.current = snapTo + 360 * Math.ceil((angleDeg - snapTo) / 360);

      const snap = (now: number): void => {
        const elapsed = now - startTime.current;
        const t = Math.min(elapsed / spinDuration.current, 1);
        const ease = 1 - Math.pow(1 - t, 4);
        setAngleDeg(startAngle.current + (targetAngle.current - startAngle.current) * ease);
        if (t < 1) rafRef.current = requestAnimationFrame(snap);
      };
      rafRef.current = requestAnimationFrame(snap);
    }

    prevStatus.current = status;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, winningSlot]);

  // Строим SVG-сектора
  const R = 150; // внешний радиус
  const r = 42;  // внутренний радиус (дырка = «ступица»)
  const cx = 160;
  const cy = 160;

  type SectorPath = {
    d: string;
    fill: string;
    labelColor: string;
    icon: string;
    labelX: number;
    labelY: number;
    color: RouletteColor;
  };

  const sectors: SectorPath[] = ROULETTE_SLOTS.map((color, i) => {
    const startDeg = i * DEG_PER_SLOT - 90; // -90 чтобы 0 был сверху
    const endDeg = startDeg + DEG_PER_SLOT;
    const toRad = (d: number): number => (d * Math.PI) / 180;

    const x1 = cx + R * Math.cos(toRad(startDeg));
    const y1 = cy + R * Math.sin(toRad(startDeg));
    const x2 = cx + R * Math.cos(toRad(endDeg));
    const y2 = cy + R * Math.sin(toRad(endDeg));
    const ix1 = cx + r * Math.cos(toRad(startDeg));
    const iy1 = cy + r * Math.sin(toRad(startDeg));
    const ix2 = cx + r * Math.cos(toRad(endDeg));
    const iy2 = cy + r * Math.sin(toRad(endDeg));

    const d = [
      `M ${ix1} ${iy1}`,
      `L ${x1} ${y1}`,
      `A ${R} ${R} 0 0 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${r} ${r} 0 0 0 ${ix1} ${iy1}`,
      'Z',
    ].join(' ');

    // Позиция текста — середина сектора по радиусу
    const midDeg = startDeg + DEG_PER_SLOT / 2;
    const labelR = (R + r) / 2 + 8;
    const labelX = cx + labelR * Math.cos(toRad(midDeg));
    const labelY = cy + labelR * Math.sin(toRad(midDeg));

    return { d, fill: FILL[color], labelColor: LABEL_COLOR[color], icon: ICON[color], labelX, labelY, color };
  });

  const winnerColor = winningSlot !== null ? ROULETTE_SLOTS[winningSlot] : null;

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      {/* Колесо */}
      <div className="relative" style={{ width: 320, height: 320 }}>
        {/* Внешний декоративный ободок */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, #1e2530, #2a3550, #1e2530, #2a3550, #1e2530)',
            boxShadow: '0 0 0 3px #1e2530, 0 0 40px rgba(0,255,136,0.12), inset 0 0 30px rgba(0,0,0,0.6)',
          }}
        />

        {/* SVG колесо */}
        <svg
          width={320}
          height={320}
          viewBox="0 0 320 320"
          style={{
            transform: `rotate(${angleDeg}deg)`,
            transition: isSpinning ? 'none' : 'transform 0.15s ease-out',
            position: 'absolute',
            inset: 0,
          }}
        >
          {/* Фон */}
          <circle cx={cx} cy={cy} r={R + 5} fill="#0d111c" />

          {/* Сектора */}
          {sectors.map((s, i) => (
            <g key={i}>
              <path
                d={s.d}
                fill={s.fill}
                stroke="#07090c"
                strokeWidth="1.5"
              />
              {/* Иконка/символ на секторе */}
              <text
                x={s.labelX}
                y={s.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={s.labelColor}
                fontSize={s.color === 'GREEN' ? '13' : '11'}
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                {s.icon}
              </text>
            </g>
          ))}

          {/* Разделители-штрихи */}
          {ROULETTE_SLOTS.map((_, i) => {
            const toRad = (d: number): number => (d * Math.PI) / 180;
            const deg = i * DEG_PER_SLOT - 90;
            return (
              <line
                key={i}
                x1={cx + (r - 2) * Math.cos(toRad(deg))}
                y1={cy + (r - 2) * Math.sin(toRad(deg))}
                x2={cx + (R + 4) * Math.cos(toRad(deg))}
                y2={cy + (R + 4) * Math.sin(toRad(deg))}
                stroke="#07090c"
                strokeWidth="2"
              />
            );
          })}

          {/* Ступица (центральный круг) */}
          <circle cx={cx} cy={cy} r={r - 2} fill="#0d111c" stroke="#1e2530" strokeWidth="2" />
          <circle cx={cx} cy={cy} r={r - 8} fill="#111419" />
          {/* Логотип/текст в центре */}
          <text x={cx} y={cy - 7} textAnchor="middle" dominantBaseline="middle" fill="#00ff88" fontSize="11" fontWeight="800" letterSpacing="1">CHC</text>
          <text x={cx} y={cy + 9} textAnchor="middle" dominantBaseline="middle" fill="#6b7280" fontSize="8">GREEN</text>
        </svg>

        {/* Стрелка-указатель сверху (фиксированная) */}
        <div
          className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
          style={{ top: -6 }}
        >
          <svg width="20" height="28" viewBox="0 0 20 28">
            <polygon
              points="10,2 18,18 10,24 2,18"
              fill="#ffffff"
              stroke="#07090c"
              strokeWidth="1.5"
            />
            <circle cx="10" cy="24" r="4" fill="#00ff88" stroke="#07090c" strokeWidth="1.5" />
          </svg>
        </div>

        {/* Выигрышная подсветка */}
        {status === 'COMPLETED' && winnerColor && (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: `0 0 0 3px ${FILL[winnerColor]}, 0 0 40px ${FILL[winnerColor]}60`,
              animation: 'pulse 1.5s ease infinite',
            }}
          />
        )}
      </div>

      {/* Результат под колесом */}
      {status === 'COMPLETED' && winnerColor && (
        <div
          className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold"
          style={{
            background: FILL[winnerColor],
            color: LABEL_COLOR[winnerColor],
            boxShadow: `0 0 20px ${FILL[winnerColor]}80`,
          }}
        >
          <span>{ICON[winnerColor]}</span>
          <span>
            {winnerColor === 'GREEN' ? 'GREEN ×14' : winnerColor === 'RED' ? 'RED ×2' : 'BLACK ×2'}
          </span>
        </div>
      )}

      {/* Индикатор вращения */}
      {isSpinning && (
        <div className="flex items-center gap-2 text-xs text-brand animate-pulse font-semibold">
          <span className="inline-block animate-spin">⟳</span> Крутим…
        </div>
      )}
    </div>
  );
}

// ── ColorTotalsBadge ──────────────────────────────────────────────────────────
export interface ColorTotalsBadgeProps {
  color: RouletteColor;
  amountMinor: string;
  betsCount: number;
  multiplier: number;
}

export function ColorTotalsBadge({ color, amountMinor, betsCount, multiplier }: ColorTotalsBadgeProps): JSX.Element {
  const fill = FILL[color];
  const textColor = LABEL_COLOR[color];
  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-semibold"
      style={{ background: fill + '22', border: `1px solid ${fill}55` }}
    >
      <span style={{ color: fill }}>{ICON[color]} ×{multiplier}</span>
      <span className="text-text-secondary">{betsCount} ставок</span>
      <span className="text-text-primary font-mono">{(Number(amountMinor) / 100).toFixed(2)} AZN</span>
    </div>
  );
}
