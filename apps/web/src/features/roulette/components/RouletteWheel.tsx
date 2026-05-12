'use client';

import { useEffect, useRef, useState } from 'react';
import type { RouletteColor } from '@/lib/api/roulette';
import { ROULETTE_SLOTS } from '../constants';
import { playTick, playWin, playSlow } from '@/lib/sound';

// ──────────────────────────────────────────────────────────────────────────────
// Палитра секторов
// ──────────────────────────────────────────────────────────────────────────────
const COLOR_FILL: Record<RouletteColor, string> = {
  GREEN: '#00ff88',
  RED:   '#ff3b5c',
  BLACK: '#2a3344',
};
const COLOR_GLOW: Record<RouletteColor, string> = {
  GREEN: 'rgba(0,255,136,0.65)',
  RED:   'rgba(255,59,92,0.55)',
  BLACK: 'rgba(60,75,100,0.45)',
};

const TOTAL = ROULETTE_SLOTS.length;     // 15
const DEG_PER_SLOT = 360 / TOTAL;        // 24°
const VB = 360;
const CX = VB / 2;
const CY = VB / 2;
// Тонкое кольцо как на референсе
const R_OUTER = 168;                     // внешняя кромка кольца
const R_INNER = 138;                     // внутренняя кромка кольца
const CELL_GAP_DEG = 4;                  // зазор между ячейками
const CELL_SPAN_DEG = DEG_PER_SLOT - CELL_GAP_DEG; // 20° — сам цвет

export interface RouletteWheelProps {
  winningSlot: number | null;
  status: 'BETTING' | 'ROLLING' | 'COMPLETED' | 'CANCELLED';
  /** компактное содержимое в центре колеса (таймер/статус) */
  center?: React.ReactNode;
}

/**
 * Колесо в виде тонкого кольца с маленькими цветными ячейками.
 * Дизайн опирается на референс (Roobet-подобный круговой ринг):
 *  - тёмная подложка кольца
 *  - яркие ячейки с собственным glow
 *  - небольшой пин-указатель сверху
 *  - центр свободен под таймер/статус (`center`)
 */
export function RouletteWheel({ winningSlot, status, center }: RouletteWheelProps): JSX.Element {
  const [angleDeg, setAngleDeg] = useState(0);
  const rafRef = useRef<number | null>(null);
  const prevStatus = useRef(status);
  const lastTickSlot = useRef<number>(0);
  const winSoundFired = useRef(false);

  // ── анимация ───────────────────────────────────────────────────────────
  useEffect(() => {
    const wasNotRolling = prevStatus.current !== 'ROLLING';
    const nowRolling = status === 'ROLLING';
    const nowCompleted = status === 'COMPLETED';

    if (wasNotRolling && nowRolling) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      winSoundFired.current = false;
      const start = performance.now();
      const dur = 4200;
      const from = angleDeg;
      const to = from + 360 * 6 + Math.random() * 180;
      lastTickSlot.current = Math.floor(((from % 360) + 360) % 360 / DEG_PER_SLOT);

      const tick = (now: number): void => {
        const t = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        const cur = from + (to - from) * ease;
        setAngleDeg(cur);

        // звук-тик когда сектор проходит под стрелкой
        const slotAt = Math.floor((((cur % 360) + 360) % 360) / DEG_PER_SLOT);
        if (slotAt !== lastTickSlot.current) {
          lastTickSlot.current = slotAt;
          playTick();
        }
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
        else playSlow();
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    if (nowCompleted && winningSlot !== null) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Сектор i центрирован в локальной системе в (i+0.5)*24 - 90 (от +x, CW в SVG).
      // Под стрелкой (вверх) — экранный угол 270°. Значит:
      //   α ≡ 360 - (i+0.5)*24  (mod 360)
      const slotCenter = (winningSlot + 0.5) * DEG_PER_SLOT;
      const desiredMod = (360 - slotCenter + 360) % 360;
      const cur = angleDeg;
      const curMod = ((cur % 360) + 360) % 360;
      let delta = desiredMod - curMod;
      if (delta < 0) delta += 360;
      // полтора оборота для эффектности
      delta += 360 * 1.5;

      const start = performance.now();
      const dur = 1500;
      const from = cur;
      const to = cur + delta;
      const startTickSlot = Math.floor(curMod / DEG_PER_SLOT);
      lastTickSlot.current = startTickSlot;
      const snap = (now: number): void => {
        const t = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - t, 4);
        const v = from + (to - from) * ease;
        setAngleDeg(v);
        const slotAt = Math.floor((((v % 360) + 360) % 360) / DEG_PER_SLOT);
        if (slotAt !== lastTickSlot.current) {
          lastTickSlot.current = slotAt;
          playTick();
        }
        if (t < 1) rafRef.current = requestAnimationFrame(snap);
        else if (!winSoundFired.current) {
          winSoundFired.current = true;
          playWin();
        }
      };
      rafRef.current = requestAnimationFrame(snap);
    }

    prevStatus.current = status;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, winningSlot]);

  // ── расчёт ячеек ──────────────────────────────────────────────────────
  const toRad = (d: number): number => (d * Math.PI) / 180;

  type Cell = { d: string; color: RouletteColor; cx: number; cy: number };
  const cells: Cell[] = ROULETTE_SLOTS.map((color, i) => {
    const center = (i + 0.5) * DEG_PER_SLOT - 90;
    const start = center - CELL_SPAN_DEG / 2;
    const end = center + CELL_SPAN_DEG / 2;

    const x1o = CX + R_OUTER * Math.cos(toRad(start));
    const y1o = CY + R_OUTER * Math.sin(toRad(start));
    const x2o = CX + R_OUTER * Math.cos(toRad(end));
    const y2o = CY + R_OUTER * Math.sin(toRad(end));
    const x1i = CX + R_INNER * Math.cos(toRad(start));
    const y1i = CY + R_INNER * Math.sin(toRad(start));
    const x2i = CX + R_INNER * Math.cos(toRad(end));
    const y2i = CY + R_INNER * Math.sin(toRad(end));

    const d = [
      `M ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
      `L ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
      `A ${R_OUTER} ${R_OUTER} 0 0 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)}`,
      `L ${x2i.toFixed(2)} ${y2i.toFixed(2)}`,
      `A ${R_INNER} ${R_INNER} 0 0 0 ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
      'Z',
    ].join(' ');

    const midR = (R_OUTER + R_INNER) / 2;
    const ccx = CX + midR * Math.cos(toRad(center));
    const ccy = CY + midR * Math.sin(toRad(center));
    return { d, color, cx: ccx, cy: ccy };
  });

  const winnerColor =
    status === 'COMPLETED' && winningSlot !== null ? ROULETTE_SLOTS[winningSlot] ?? null : null;

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: '100%', maxWidth: 420, aspectRatio: '1 / 1' }}>
      {/* мягкое внешнее свечение */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: winnerColor
            ? `radial-gradient(circle, ${COLOR_GLOW[winnerColor]}, transparent 60%)`
            : 'radial-gradient(circle, rgba(0,255,136,0.12), transparent 60%)',
          filter: 'blur(28px)',
          transform: 'scale(1.05)',
          transition: 'background 0.5s ease',
        }}
      />

      {/* указатель сверху (теардроп) */}
      <div
        aria-hidden
        className="absolute z-30 pointer-events-none"
        style={{ top: 0, left: '50%', transform: 'translate(-50%, -55%)' }}
      >
        <svg width="22" height="32" viewBox="0 0 22 32">
          <defs>
            <linearGradient id="pin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff7a8c" />
              <stop offset="100%" stopColor="#c11638" />
            </linearGradient>
            <filter id="pinShadow"><feDropShadow dx="0" dy="2" stdDeviation="1.5" floodOpacity="0.5" /></filter>
          </defs>
          <g filter="url(#pinShadow)">
            <path d="M11 1 C 4 1, 1 8, 4 14 L 11 30 L 18 14 C 21 8, 18 1, 11 1 Z" fill="url(#pin)" stroke="#3a0a18" strokeWidth="1" />
            <circle cx="11" cy="10" r="3" fill="#fff" opacity="0.55" />
          </g>
        </svg>
      </div>

      {/* колесо */}
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        width="100%"
        height="100%"
        style={{
          transform: `rotate(${angleDeg}deg)`,
          willChange: 'transform',
          transition: status === 'ROLLING' || status === 'COMPLETED' ? 'none' : 'transform 0.3s ease-out',
          filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.45))',
        }}
      >
        <defs>
          <radialGradient id="wheelBgGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#11161f" />
            <stop offset="80%" stopColor="#0a0e15" />
            <stop offset="100%" stopColor="#05080d" />
          </radialGradient>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c2433" />
            <stop offset="100%" stopColor="#0e1320" />
          </linearGradient>
          {(['GREEN', 'RED', 'BLACK'] as RouletteColor[]).map((c) => (
            <filter key={c} id={`glow-${c}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
        </defs>

        {/* фон */}
        <circle cx={CX} cy={CY} r={R_OUTER + 8} fill="url(#wheelBgGrad)" />
        {/* подложка кольца */}
        <circle cx={CX} cy={CY} r={(R_OUTER + R_INNER) / 2} fill="none" stroke="url(#ringGrad)" strokeWidth={R_OUTER - R_INNER + 4} />
        {/* тонкая декоративная линия по внутренней кромке */}
        <circle cx={CX} cy={CY} r={R_INNER - 12} fill="none" stroke="#1a2333" strokeWidth="1" opacity="0.6" />

        {/* ячейки */}
        {cells.map((cell, i) => {
          const isWinner = winnerColor !== null && i === winningSlot && status === 'COMPLETED';
          return (
            <path
              key={i}
              d={cell.d}
              fill={COLOR_FILL[cell.color]}
              filter={`url(#glow-${cell.color})`}
              opacity={status === 'COMPLETED' && !isWinner ? 0.55 : 1}
              style={{
                transition: 'opacity 0.4s',
                ...(isWinner ? { filter: `drop-shadow(0 0 8px ${COLOR_FILL[cell.color]})` } : {}),
              }}
            />
          );
        })}
      </svg>

      {/* центр (таймер/статус) — НЕ вращается */}
      {center !== undefined && (
        <div
          className="absolute pointer-events-none flex items-center justify-center"
          style={{
            width: `${(R_INNER / VB) * 100 * 2}%`,
            height: `${(R_INNER / VB) * 100 * 2}%`,
          }}
        >
          {center}
        </div>
      )}
    </div>
  );
}

// ── ColorTotalsBadge ──────────────────────────────────────────────────────────
const ICON: Record<RouletteColor, string> = { GREEN: '★', RED: '♦', BLACK: '♠' };

export interface ColorTotalsBadgeProps {
  color: RouletteColor;
  amountMinor: string;
  betsCount: number;
  multiplier: number;
}

export function ColorTotalsBadge({ color, amountMinor, betsCount, multiplier }: ColorTotalsBadgeProps): JSX.Element {
  const fill = COLOR_FILL[color];
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
