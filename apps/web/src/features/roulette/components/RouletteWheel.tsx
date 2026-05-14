'use client';

import { useEffect, useRef, useState } from 'react';
import type { RouletteColor } from '@/lib/api/roulette';
import { ROULETTE_SLOTS } from '../constants';
import { playTick, playSlow } from '@/lib/sound';

// ──────────────────────────────────────────────────────────────────────────────
// Палитра
// ──────────────────────────────────────────────────────────────────────────────
const COLOR_FILL: Record<RouletteColor, string> = {
  GREEN: '#00ff88',
  RED:   '#ff3b5c',
  BLACK: '#1d2533',
};
const COLOR_GLOW: Record<RouletteColor, string> = {
  GREEN: 'rgba(0,255,136,0.75)',
  RED:   'rgba(255,59,92,0.6)',
  BLACK: 'rgba(60,75,100,0.4)',
};

const TOTAL = ROULETTE_SLOTS.length;          // 15
const DEG_PER_SLOT = 360 / TOTAL;             // 24°
const VB = 400;                               // viewBox с запасом по краям для теней и пина
const CX = VB / 2;
const CY = VB / 2;
const R_OUTER = 170;
const R_INNER = 132;
const R_CROWN = (R_OUTER + R_INNER) / 2;
const CELL_GAP_DEG = 3;
const CELL_SPAN_DEG = DEG_PER_SLOT - CELL_GAP_DEG;

export const ROULETTE_SPIN_MS = 9500; // длительность анимации — экспортируем, чтобы Layout мог синхронизировать toast

export interface RouletteWheelProps {
  /**
   * Идентификатор последнего РАЗЫГРАННОГО раунда (даже когда уже стартовал новый).
   * Должен меняться при каждом новом результате.
   */
  resultRoundId: string | null;
  /** Слот, на который должно сесть колесо после анимации. */
  resultSlot: number | null;
  /** Цвет результата — используется для подсветки рамки. */
  resultColor: RouletteColor | null;
  /** Сбрасывает выделение победителя (когда новый раунд активно идёт). */
  highlightWinner: boolean;
  center?: React.ReactNode;
}

/**
 * Колесо. Анимация запускается, когда мы впервые видим новый `resultRoundId`
 * с непустым `resultSlot` — и доводится до конца независимо от того, что
 * родительский раунд тем временем сменился.
 */
export function RouletteWheel({
  resultRoundId,
  resultSlot,
  resultColor,
  highlightWinner,
  center,
}: RouletteWheelProps): JSX.Element {
  const [angleDeg, setAngleDeg] = useState(0);
  const angleRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const animatedRoundRef = useRef<string | null>(null);
  const lastTickSlotRef = useRef(0);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (resultRoundId === null || resultSlot === null) return;
    if (animatedRoundRef.current === resultRoundId) return; // уже анимировали этот раунд

    animatedRoundRef.current = resultRoundId;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    // Расчёт целевого угла: сектор i центрирован в θ_i = (i+0.5)*24 − 90.
    // Стрелка на экране смотрит вверх (−90°). После CSS rotate(α) (CW при y-вниз):
    //   θ_i + α ≡ −90 (mod 360) ⇒ α ≡ −(i+0.5)*24 (mod 360)
    const slotCenter = (resultSlot + 0.5) * DEG_PER_SLOT;
    const targetMod = ((-slotCenter) % 360 + 360) % 360;
    const curMod = ((angleRef.current % 360) + 360) % 360;
    let delta = targetMod - curMod;
    if (delta < 0) delta += 360;
    const totalDelta = delta + 360 * 6; // 6 полных оборотов

    const from = angleRef.current;
    const to = from + totalDelta;
    const start = performance.now();
    lastTickSlotRef.current = Math.floor(curMod / DEG_PER_SLOT);
    let slowFired = false;
    setSpinning(true);

    const step = (now: number): void => {
      const t = Math.min((now - start) / ROULETTE_SPIN_MS, 1);
      const ease = 1 - Math.pow(1 - t, 4); // cubic-out
      const v = from + (to - from) * ease;
      angleRef.current = v;
      setAngleDeg(v);

      const slotAt = Math.floor((((v % 360) + 360) % 360) / DEG_PER_SLOT);
      if (slotAt !== lastTickSlotRef.current) {
        lastTickSlotRef.current = slotAt;
        playTick();
      }
      if (!slowFired && t > 0.75) {
        slowFired = true;
        playSlow();
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        // финальная посадка строго на targetMod
        const finalAngle = from + totalDelta;
        angleRef.current = finalAngle;
        setAngleDeg(finalAngle);
        setSpinning(false);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    // НЕ возвращаем cleanup, чтобы смена пропсов раундом не убила анимацию.
  }, [resultRoundId, resultSlot]);

  // На размонтировании — отменим, чтобы не текло.
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // ── ячейки ──
  const toRad = (d: number): number => (d * Math.PI) / 180;

  type Cell = { d: string; color: RouletteColor; cx: number; cy: number; rot: number };
  const cells: Cell[] = ROULETTE_SLOTS.map((color, i) => {
    const c = (i + 0.5) * DEG_PER_SLOT - 90;
    const s = c - CELL_SPAN_DEG / 2;
    const e = c + CELL_SPAN_DEG / 2;
    const x1o = CX + R_OUTER * Math.cos(toRad(s));
    const y1o = CY + R_OUTER * Math.sin(toRad(s));
    const x2o = CX + R_OUTER * Math.cos(toRad(e));
    const y2o = CY + R_OUTER * Math.sin(toRad(e));
    const x1i = CX + R_INNER * Math.cos(toRad(s));
    const y1i = CY + R_INNER * Math.sin(toRad(s));
    const x2i = CX + R_INNER * Math.cos(toRad(e));
    const y2i = CY + R_INNER * Math.sin(toRad(e));
    const d = [
      `M ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
      `L ${x1o.toFixed(2)} ${y1o.toFixed(2)}`,
      `A ${R_OUTER} ${R_OUTER} 0 0 1 ${x2o.toFixed(2)} ${y2o.toFixed(2)}`,
      `L ${x2i.toFixed(2)} ${y2i.toFixed(2)}`,
      `A ${R_INNER} ${R_INNER} 0 0 0 ${x1i.toFixed(2)} ${y1i.toFixed(2)}`,
      'Z',
    ].join(' ');
    const ccx = CX + R_CROWN * Math.cos(toRad(c));
    const ccy = CY + R_CROWN * Math.sin(toRad(c));
    return { d, color, cx: ccx, cy: ccy, rot: c + 90 };
  });

  const isWinnerVisible = highlightWinner && resultColor !== null;

  return (
    <div
      className="relative flex items-center justify-center select-none"
      style={{ width: '100%', maxWidth: 460, aspectRatio: '1 / 1' }}
    >
      {/* мягкое свечение под цвет победителя */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: isWinnerVisible && resultColor
            ? `radial-gradient(circle, ${COLOR_GLOW[resultColor]}, transparent 60%)`
            : 'radial-gradient(circle, rgba(0,255,136,0.10), transparent 60%)',
          filter: 'blur(28px)',
          transition: 'background 0.5s ease',
        }}
      />

      {/* статичный декоративный кант (не вращается) */}
      <svg viewBox={`0 0 ${VB} ${VB}`} className="absolute inset-0 w-full h-full" aria-hidden>
        <defs>
          <radialGradient id="bgRim" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0a0e15" />
            <stop offset="78%" stopColor="#0a0e15" />
            <stop offset="92%" stopColor="#1c2435" />
            <stop offset="100%" stopColor="#0a0e15" />
          </radialGradient>
        </defs>
        <circle cx={CX} cy={CY} r={R_OUTER + 16} fill="url(#bgRim)" />
        <circle cx={CX} cy={CY} r={R_OUTER + 6} fill="none" stroke="#1a2333" strokeWidth="1" opacity="0.8" />
      </svg>

      {/* указатель сверху */}
      <div
        aria-hidden
        className="absolute z-30 pointer-events-none"
        style={{ top: '4%', left: '50%', transform: 'translateX(-50%)' }}
      >
        <svg width="28" height="40" viewBox="0 0 26 38">
          <defs>
            <linearGradient id="pin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff8a9c" />
              <stop offset="100%" stopColor="#a8132e" />
            </linearGradient>
            <filter id="pinShadow"><feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.55" /></filter>
          </defs>
          <g filter="url(#pinShadow)">
            <path d="M13 1 C 5 1, 1 9, 4 16 L 13 36 L 22 16 C 25 9, 21 1, 13 1 Z" fill="url(#pin)" stroke="#3a0a18" strokeWidth="1" />
            <circle cx="13" cy="11" r="3.5" fill="#fff" opacity="0.6" />
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
        }}
      >
        <defs>
          <linearGradient id="ringBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e2738" />
            <stop offset="100%" stopColor="#0b101a" />
          </linearGradient>
          {(['GREEN', 'RED', 'BLACK'] as RouletteColor[]).map((c) => (
            <radialGradient key={`grad-${c}`} id={`grad-${c}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={COLOR_FILL[c]} stopOpacity="1" />
              <stop offset="70%" stopColor={COLOR_FILL[c]} stopOpacity="0.95" />
              <stop offset="100%" stopColor={COLOR_FILL[c]} stopOpacity="0.7" />
            </radialGradient>
          ))}
        </defs>

        {/* подложка кольца */}
        <circle cx={CX} cy={CY} r={(R_OUTER + R_INNER) / 2} fill="none" stroke="url(#ringBg)" strokeWidth={R_OUTER - R_INNER + 6} />

        {/* ячейки */}
        {cells.map((cell, i) => {
          const isWinner = isWinnerVisible && i === resultSlot;
          const isGreen = cell.color === 'GREEN';
          return (
            <g key={i}>
              <path
                d={cell.d}
                fill={`url(#grad-${cell.color})`}
                stroke={isWinner ? '#fff' : 'rgba(255,255,255,0.08)'}
                strokeWidth={isWinner ? 1.5 : 0.5}
                opacity={isWinnerVisible && !isWinner ? 0.5 : 1}
                style={{
                  transition: 'opacity 0.4s, stroke 0.3s',
                  ...(isWinner ? { filter: `drop-shadow(0 0 10px ${COLOR_FILL[cell.color]})` } : {}),
                }}
              />
              {isGreen ? (
                <g transform={`translate(${cell.cx},${cell.cy}) rotate(${cell.rot})`}>
                  <CrownIcon size={14} />
                </g>
              ) : null}
            </g>
          );
        })}

        {/* центральный диск */}
        <circle cx={CX} cy={CY} r={R_INNER - 18} fill="#0a0e15" stroke="#1c2435" strokeWidth="1" />
        <circle cx={CX} cy={CY} r={R_INNER - 18} fill="none" stroke="#1e2940" strokeWidth="2" opacity="0.5" />
      </svg>

      {/* центр (таймер/статус) — НЕ вращается */}
      {center !== undefined && (
        <div
          className="absolute pointer-events-none flex items-center justify-center"
          style={{
            width: `${((R_INNER - 18) / VB) * 100 * 2}%`,
            height: `${((R_INNER - 18) / VB) * 100 * 2}%`,
            opacity: spinning ? 0.25 : 1,
            transition: 'opacity 0.3s',
          }}
        >
          {center}
        </div>
      )}
    </div>
  );
}

function CrownIcon({ size = 14 }: { size?: number }): JSX.Element {
  const half = size / 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ overflow: 'visible' }}
      x={-half}
      y={-half}
    >
      <path
        d="M3 18 L 5 8 L 9 12 L 12 6 L 15 12 L 19 8 L 21 18 Z"
        fill="#ffd84a"
        stroke="#7a5800"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <rect x="3" y="18" width="18" height="2.5" fill="#ffb800" stroke="#7a5800" strokeWidth="0.5" />
      <circle cx="5" cy="8" r="1.2" fill="#fff3a8" />
      <circle cx="12" cy="6" r="1.4" fill="#fff3a8" />
      <circle cx="19" cy="8" r="1.2" fill="#fff3a8" />
    </svg>
  );
}

// ── ColorTotalsBadge (совместимость) ─────────────────────────────────────────
function ColorMarker({ color }: { color: RouletteColor }): JSX.Element {
  if (color === 'GREEN') return <CrownIcon size={12} />;
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 rounded-full"
      style={{ background: 'currentColor' }}
    />
  );
}

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
      <span style={{ color: fill }} className="flex items-center gap-1">
        <ColorMarker color={color} />
        ×{multiplier}
      </span>
      <span className="text-text-secondary">{betsCount} ставок</span>
      <span className="text-text-primary font-mono">{(Number(amountMinor) / 100).toFixed(2)} AZN</span>
    </div>
  );
}
