'use client';

import { useEffect, useRef, useState } from 'react';
import type { RouletteColor } from '@/lib/api/roulette';
import { ROULETTE_SLOTS } from '../constants';

// ──────────────────────────────────────────────────────────────────────────────
// Цвета и иконки секторов
// ──────────────────────────────────────────────────────────────────────────────
const COLORS: Record<RouletteColor, { base: string; hi: string; lo: string; label: string; icon: string }> = {
  GREEN: { base: '#00ff88', hi: '#7cffc1', lo: '#00a85a', label: '#07090c', icon: '★' },
  RED:   { base: '#ff3b5c', hi: '#ff7888', lo: '#b71b34', label: '#ffffff', icon: '♦' },
  BLACK: { base: '#222a39', hi: '#3a4658', lo: '#0d1219', label: '#ffffff', icon: '♠' },
};

const TOTAL = ROULETTE_SLOTS.length;       // 15
const DEG_PER_SLOT = 360 / TOTAL;          // 24°
const VB = 360;                            // viewBox size
const CX = VB / 2;
const CY = VB / 2;
const R_OUT = 174;                         // внешний радиус сектора
const R_IN = 70;                           // внутренний радиус (ступица)
const R_RIM = 178;                         // золотой ободок

export interface RouletteWheelProps {
  winningSlot: number | null;
  status: 'BETTING' | 'ROLLING' | 'COMPLETED' | 'CANCELLED';
}

/**
 * Премиальное круглое колесо рулетки.
 * - Золотой внешний ободок с заклёпками
 * - Сектора с радиальным градиентом (объём)
 * - Стрелка-указатель сверху с тенью
 * - Плавная анимация ease-out 5 секунд + bounce в конце
 * - При COMPLETED — снап к нужному слоту с подсветкой
 */
export function RouletteWheel({ winningSlot, status }: RouletteWheelProps): JSX.Element {
  const [angleDeg, setAngleDeg] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const rafRef = useRef<number | null>(null);
  const prevStatus = useRef(status);

  useEffect(() => {
    const nowRolling = status === 'ROLLING';
    const nowCompleted = status === 'COMPLETED';
    const wasNotRolling = prevStatus.current !== 'ROLLING';

    // ── ROLLING: длинный спин с ease-out cubic ────────────────────────────
    if (wasNotRolling && nowRolling) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setIsSpinning(true);
      const start = performance.now();
      const dur = 5000;
      const from = angleDeg;
      // 7 полных оборотов + случайный фрагмент
      const to = from + 360 * 7 + Math.random() * 360;
      const tick = (now: number): void => {
        const t = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        setAngleDeg(from + (to - from) * ease);
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
        else setIsSpinning(false);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    // ── COMPLETED: снап к выигрышному слоту ───────────────────────────────
    if (nowCompleted && winningSlot !== null) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setIsSpinning(true);

      // Центр сектора winningSlot в собственной системе колеса:
      //   slotCenter = (winningSlot + 0.5) * DEG_PER_SLOT
      // Стрелка указывает на угол -90° (вверх).
      // Угол поворота колеса α должен удовлетворять:
      //   (slotCenter + α) mod 360 = 270  (= -90 + 360)
      const slotCenter = (winningSlot + 0.5) * DEG_PER_SLOT;
      const desiredMod = (270 - slotCenter + 360) % 360;
      const cur = angleDeg;
      const curMod = ((cur % 360) + 360) % 360;
      // дельта вперёд (минимум полтора оборота для эффектности)
      let delta = desiredMod - curMod;
      if (delta < 0) delta += 360;
      delta += 360 * 1.5;

      const start = performance.now();
      const dur = 1400;
      const from = cur;
      const to = cur + delta;
      const tick = (now: number): void => {
        const t = Math.min((now - start) / dur, 1);
        // ease-out quart + лёгкий bounce
        const ease = 1 - Math.pow(1 - t, 4);
        setAngleDeg(from + (to - from) * ease);
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
        else setIsSpinning(false);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    prevStatus.current = status;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, winningSlot]);

  // ── Построение секторов ──────────────────────────────────────────────────
  type Sector = {
    d: string;
    color: RouletteColor;
    gradId: string;
    labelX: number;
    labelY: number;
    labelRot: number;
  };

  const toRad = (d: number): number => (d * Math.PI) / 180;

  const sectors: Sector[] = ROULETTE_SLOTS.map((color, i) => {
    // -90° чтобы 0° сектора был сверху
    const startDeg = i * DEG_PER_SLOT - 90;
    const endDeg = startDeg + DEG_PER_SLOT;

    const x1 = CX + R_OUT * Math.cos(toRad(startDeg));
    const y1 = CY + R_OUT * Math.sin(toRad(startDeg));
    const x2 = CX + R_OUT * Math.cos(toRad(endDeg));
    const y2 = CY + R_OUT * Math.sin(toRad(endDeg));
    const ix1 = CX + R_IN * Math.cos(toRad(startDeg));
    const iy1 = CY + R_IN * Math.sin(toRad(startDeg));
    const ix2 = CX + R_IN * Math.cos(toRad(endDeg));
    const iy2 = CY + R_IN * Math.sin(toRad(endDeg));

    const d = [
      `M ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
      `L ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${R_OUT} ${R_OUT} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
      `A ${R_IN} ${R_IN} 0 0 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
      'Z',
    ].join(' ');

    const midDeg = startDeg + DEG_PER_SLOT / 2;
    const labelR = (R_OUT + R_IN) / 2;
    const labelX = CX + labelR * Math.cos(toRad(midDeg));
    const labelY = CY + labelR * Math.sin(toRad(midDeg));
    // поворот текста чтобы он читался радиально
    const labelRot = midDeg + 90;

    return { d, color, gradId: `grad-${color}-${i}`, labelX, labelY, labelRot };
  });

  // Заклёпки на ободе
  const studs: { x: number; y: number }[] = [];
  for (let i = 0; i < 24; i++) {
    const deg = (360 / 24) * i;
    studs.push({
      x: CX + (R_RIM + 8) * Math.cos(toRad(deg - 90)),
      y: CY + (R_RIM + 8) * Math.sin(toRad(deg - 90)),
    });
  }

  const winnerColor = winningSlot !== null ? ROULETTE_SLOTS[winningSlot] ?? null : null;
  const completed = status === 'COMPLETED' && winnerColor !== null;

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div
        className="relative"
        style={{
          width: 'min(92vw, 420px)',
          aspectRatio: '1 / 1',
        }}
      >
        {/* Внешнее свечение */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              completed && winnerColor
                ? `radial-gradient(circle, ${COLORS[winnerColor].base}30, transparent 65%)`
                : 'radial-gradient(circle, rgba(0,255,136,0.18), transparent 65%)',
            filter: 'blur(20px)',
            transform: 'scale(1.15)',
            transition: 'background 0.4s ease',
          }}
        />

        {/* Стрелка-указатель (фиксированная сверху) */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          style={{ top: -4 }}
        >
          <svg width="36" height="48" viewBox="0 0 36 48">
            <defs>
              <linearGradient id="arrowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffe27a" />
                <stop offset="50%" stopColor="#f5b400" />
                <stop offset="100%" stopColor="#a87600" />
              </linearGradient>
              <filter id="arrowShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.5" />
              </filter>
            </defs>
            <g filter="url(#arrowShadow)">
              <path
                d="M 18 4 L 30 28 L 18 42 L 6 28 Z"
                fill="url(#arrowGrad)"
                stroke="#5a3e00"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <circle cx="18" cy="14" r="3" fill="#fff7d6" opacity="0.8" />
            </g>
          </svg>
        </div>

        {/* Само колесо */}
        <svg
          viewBox={`0 0 ${VB} ${VB}`}
          width="100%"
          height="100%"
          style={{
            position: 'absolute',
            inset: 0,
            transform: `rotate(${angleDeg}deg)`,
            transition: isSpinning ? 'none' : 'transform 0.2s ease-out',
            willChange: 'transform',
            filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.6))',
          }}
        >
          <defs>
            {/* Градиенты для каждого сектора */}
            {ROULETTE_SLOTS.map((c, i) => (
              <radialGradient
                key={`grad-${i}`}
                id={`grad-${c}-${i}`}
                cx="50%"
                cy="50%"
                r="65%"
                fx="50%"
                fy="50%"
              >
                <stop offset="0%" stopColor={COLORS[c].hi} stopOpacity="0.5" />
                <stop offset="55%" stopColor={COLORS[c].base} stopOpacity="1" />
                <stop offset="100%" stopColor={COLORS[c].lo} stopOpacity="1" />
              </radialGradient>
            ))}
            {/* Золотой обод */}
            <linearGradient id="goldRim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff1a8" />
              <stop offset="30%" stopColor="#f5b400" />
              <stop offset="60%" stopColor="#7a5300" />
              <stop offset="100%" stopColor="#f5b400" />
            </linearGradient>
            {/* Тёмный обод-вкладыш */}
            <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1a2230" />
              <stop offset="70%" stopColor="#0d1219" />
              <stop offset="100%" stopColor="#04060a" />
            </radialGradient>
            {/* Блик */}
            <linearGradient id="glossGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.18" />
              <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Золотой внешний обод */}
          <circle cx={CX} cy={CY} r={R_RIM + 6} fill="url(#goldRim)" />
          {/* Тёмный кант */}
          <circle cx={CX} cy={CY} r={R_RIM} fill="#04060a" />
          {/* Подложка под сектора */}
          <circle cx={CX} cy={CY} r={R_OUT + 2} fill="#0d111c" />

          {/* Сектора */}
          {sectors.map((s, i) => (
            <g key={i}>
              <path
                d={s.d}
                fill={`url(#${s.gradId})`}
                stroke="#04060a"
                strokeWidth="1.5"
              />
              <text
                x={s.labelX}
                y={s.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="22"
                fontWeight="800"
                fill={COLORS[s.color].label}
                transform={`rotate(${s.labelRot} ${s.labelX} ${s.labelY})`}
                style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
              >
                {COLORS[s.color].icon}
              </text>
            </g>
          ))}

          {/* Глянцевый блик поверх секторов (полукруг сверху) */}
          <ellipse
            cx={CX}
            cy={CY - 60}
            rx={R_OUT - 20}
            ry={70}
            fill="url(#glossGrad)"
            style={{ pointerEvents: 'none' }}
          />

          {/* Заклёпки на ободе */}
          {studs.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r="2.5"
              fill="#5a3e00"
              opacity="0.8"
            />
          ))}

          {/* Ступица */}
          <circle cx={CX} cy={CY} r={R_IN} fill="url(#hubGrad)" stroke="#f5b400" strokeWidth="2" />
          <circle cx={CX} cy={CY} r={R_IN - 12} fill="#0a0d13" stroke="#1e2530" strokeWidth="1.5" />
          {/* Логотип в центре */}
          <text
            x={CX}
            y={CY - 6}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="22"
            fontWeight="900"
            fill="#00ff88"
            letterSpacing="2"
            style={{ filter: 'drop-shadow(0 0 6px rgba(0,255,136,0.6))' }}
          >
            CHC
          </text>
          <text
            x={CX}
            y={CY + 16}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="10"
            fontWeight="700"
            fill="#94a0b4"
            letterSpacing="3"
          >
            GREEN
          </text>
        </svg>

        {/* Победная подсветка */}
        {completed && winnerColor && (
          <div
            aria-hidden
            className="absolute inset-0 rounded-full pointer-events-none animate-pulse"
            style={{
              boxShadow: `0 0 0 4px ${COLORS[winnerColor].base}, 0 0 60px ${COLORS[winnerColor].base}80`,
            }}
          />
        )}
      </div>

      {/* Бейдж результата под колесом */}
      {completed && winnerColor && (
        <div
          className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold"
          style={{
            background: COLORS[winnerColor].base,
            color: COLORS[winnerColor].label,
            boxShadow: `0 0 20px ${COLORS[winnerColor].base}80`,
          }}
        >
          <span className="text-lg">{COLORS[winnerColor].icon}</span>
          <span>
            {winnerColor === 'GREEN' ? 'GREEN ×14' : winnerColor === 'RED' ? 'RED ×2' : 'BLACK ×2'}
          </span>
        </div>
      )}

      {isSpinning && status === 'ROLLING' && (
        <div className="flex items-center gap-2 text-xs font-semibold text-brand">
          <span className="inline-block h-2 w-2 rounded-full bg-brand animate-ping" />
          Крутим колесо…
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
  const c = COLORS[color];
  return (
    <div
      className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-semibold"
      style={{ background: c.base + '22', border: `1px solid ${c.base}55` }}
    >
      <span style={{ color: c.base }}>{c.icon} ×{multiplier}</span>
      <span className="text-text-secondary">{betsCount} ставок</span>
      <span className="text-text-primary font-mono">{(Number(amountMinor) / 100).toFixed(2)} AZN</span>
    </div>
  );
}
