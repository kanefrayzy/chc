'use client';

import { useMemo, useState } from 'react';
import type { TimeseriesPoint } from '../../../lib/api/admin';

type Metric = 'finance' | 'ggr' | 'registrations';

const W = 1000;
const H = 320;
const PAD_L = 64;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;
const INNER_W = W - PAD_L - PAD_R;
const INNER_H = H - PAD_T - PAD_B;

function azn(minor: string): number {
  return Number(minor) / 100;
}

function formatAzn(v: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v);
}

function formatDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

/** «Хорошие» деления оси Y. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

export function StatisticsCharts({ points }: { points: TimeseriesPoint[] }): JSX.Element {
  const [metric, setMetric] = useState<Metric>('finance');

  const series = useMemo(() => {
    if (metric === 'registrations') {
      return {
        bars: [{ key: 'reg', color: '#6366f1', label: 'Регистрации', values: points.map((p) => p.registrations) }],
        allowNegative: false,
      };
    }
    if (metric === 'ggr') {
      return {
        bars: [{ key: 'ggr', color: '#10b981', label: 'GGR', values: points.map((p) => azn(p.ggrMinor)) }],
        allowNegative: true,
      };
    }
    return {
      bars: [
        { key: 'dep', color: '#10b981', label: 'Пополнения', values: points.map((p) => azn(p.depositsAmountMinor)) },
        { key: 'wd', color: '#ef4444', label: 'Выводы', values: points.map((p) => azn(p.withdrawalsAmountMinor)) },
      ],
      allowNegative: false,
    };
  }, [metric, points]);

  const n = points.length;
  const allValues = series.bars.flatMap((b) => b.values);
  const rawMax = Math.max(1, ...allValues);
  const rawMin = Math.min(0, ...allValues);
  const maxV = niceMax(rawMax);
  const minV = series.allowNegative ? -niceMax(Math.abs(rawMin)) : 0;
  const range = maxV - minV || 1;

  const yOf = (v: number): number => PAD_T + INNER_H - ((v - minV) / range) * INNER_H;
  const zeroY = yOf(0);

  const slotW = INNER_W / Math.max(n, 1);
  const groupCount = series.bars.length;
  const barGap = 2;
  const barW = Math.max(1, (slotW - 4 - barGap * (groupCount - 1)) / groupCount);

  // Подписи оси Y (5 делений)
  const yTicks = Array.from({ length: 5 }, (_, i) => minV + (range * i) / 4);
  // Подписи оси X (примерно 8)
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  const tabs: { key: Metric; label: string }[] = [
    { key: 'finance', label: 'Финансы' },
    { key: 'ggr', label: 'GGR' },
    { key: 'registrations', label: 'Регистрации' },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-ink-700">График по дням</h3>
        <div className="flex gap-1 rounded-lg bg-ink-50 p-1">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setMetric(tb.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                metric === tb.key ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-4">
        {/* Легенда */}
        <div className="mb-2 flex flex-wrap gap-4 px-2">
          {series.bars.map((b) => (
            <div key={b.key} className="flex items-center gap-1.5 text-xs text-ink-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: b.color }} />
              {b.label}
            </div>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }} role="img">
          {/* Сетка + подписи Y */}
          {yTicks.map((t, i) => {
            const y = yOf(t);
            return (
              <g key={i}>
                <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e5e7eb" strokeWidth={1} />
                <text x={PAD_L - 8} y={y + 4} textAnchor="end" fontSize={11} fill="#9ca3af">
                  {formatAzn(t)}
                </text>
              </g>
            );
          })}

          {/* Нулевая линия для отрицательных значений */}
          {series.allowNegative && (
            <line x1={PAD_L} y1={zeroY} x2={W - PAD_R} y2={zeroY} stroke="#9ca3af" strokeWidth={1.5} />
          )}

          {/* Бары */}
          {points.map((p, idx) => {
            const slotX = PAD_L + idx * slotW + 2;
            return (
              <g key={p.date}>
                {series.bars.map((b, gi) => {
                  const v = b.values[idx] ?? 0;
                  const x = slotX + gi * (barW + barGap);
                  const y = v >= 0 ? yOf(v) : zeroY;
                  const h = Math.abs(yOf(v) - zeroY);
                  return (
                    <rect
                      key={b.key}
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(0, h)}
                      rx={1.5}
                      fill={b.color}
                      opacity={0.9}
                    >
                      <title>{`${formatDay(p.date)} · ${b.label}: ${formatAzn(v)}`}</title>
                    </rect>
                  );
                })}
                {idx % labelEvery === 0 && (
                  <text
                    x={slotX + slotW / 2 - 2}
                    y={H - PAD_B + 18}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#9ca3af"
                  >
                    {formatDay(p.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
