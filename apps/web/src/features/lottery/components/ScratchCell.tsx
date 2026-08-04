'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** useLayoutEffect ломается при серверном рендере — на сервере берём обычный. */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Доля стёртого покрытия, после которой ячейка открывается целиком.
 * Высокий порог — чтобы карту действительно приходилось стирать, а не
 * задевать курсором.
 */
const REVEAL_THRESHOLD = 0.7;

/** Радиус кисти в долях ширины ячейки. Мелкая кисть = несколько проходов. */
const BRUSH_RATIO = 0.15;

/** Проверяем прогресс не на каждое движение — чтение пикселей недешёвое. */
const CHECK_EVERY = 8;

export interface ScratchCellProps {
  /** Меняется вместе с билетом — заставляет перерисовать покрытие. */
  ticketId: string;
  index: number;
  /** Сумма приза на ячейке. */
  label: string;
  /** Класс цвета суммы — по рангу приза. */
  tone: string;
  /** Ячейка входит в выигрышную тройку. */
  highlight: boolean;
  /** Билета нет или идёт автоигра — стирать нельзя. */
  locked: boolean;
  /** Открыть без стирания (кнопка «Стереть всё», автоигра). */
  forceReveal: boolean;
  onReveal: (index: number) => void;
}

export function ScratchCell({
  ticketId,
  index,
  label,
  tone,
  highlight,
  locked,
  forceReveal,
  onReveal,
}: ScratchCellProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [open, setOpen] = useState(false);
  const drawing = useRef(false);
  const moves = useRef(0);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  /** Рисует покрытие: тёмная фольга с диагональным блеском и крапом. */
  const paintCover = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, rect.width, rect.height);

    const base = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    base.addColorStop(0, '#26332c');
    base.addColorStop(0.42, '#33443a');
    base.addColorStop(0.55, '#405448');
    base.addColorStop(1, '#222e27');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Диагональная штриховка — покрытие не выглядит плоской заливкой
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = -rect.height; x < rect.width; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, rect.height);
      ctx.lineTo(x + rect.height, 0);
      ctx.stroke();
    }

    // Мелкий крап: фольга становится похожа на настоящую
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 90; i += 1) {
      const px = ((i * 37) % 100) / 100;
      const py = ((i * 61) % 100) / 100;
      ctx.fillRect(px * rect.width, py * rect.height, 1.5, 1.5);
    }

    setOpen(false);
    moves.current = 0;
    lastPoint.current = null;
  }, []);

  useIsoLayoutEffect(() => {
    paintCover();
  }, [paintCover, ticketId]);

  // Перерисовываем при изменении размера — иначе покрытие «съедет»
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (!open) paintCover();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [paintCover, open]);

  const finish = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setOpen(true);
    onReveal(index);
  }, [index, onReveal]);

  useEffect(() => {
    if (forceReveal && !open) finish();
  }, [forceReveal, open, finish]);

  /** Доля полностью прозрачных пикселей — считаем по выборке. */
  function clearedRatio(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): number {
    const { width, height } = canvas;
    if (width === 0 || height === 0) return 0;
    const data = ctx.getImageData(0, 0, width, height).data;
    let cleared = 0;
    let total = 0;
    // Каждый 16-й пиксель: точности хватает, цена в 16 раз меньше
    for (let i = 3; i < data.length; i += 4 * 16) {
      total += 1;
      // Полупрозрачные пиксели по краю кисти тоже считаем стёртыми
      if ((data[i] ?? 255) < 24) cleared += 1;
    }
    return total === 0 ? 0 : cleared / total;
  }

  /** Мягкая кисть: край размыт, как след от монетки. */
  function stamp(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    const gradient = ctx.createRadialGradient(x, y, radius * 0.35, x, y, radius);
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(0.7, 'rgba(0,0,0,0.75)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function scratchAt(clientX: number, clientY: number): void {
    const canvas = canvasRef.current;
    if (!canvas || open) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const radius = Math.max(7, rect.width * BRUSH_RATIO);

    ctx.globalCompositeOperation = 'destination-out';

    // Ведём непрерывную линию: при быстром движении не остаётся пропусков
    const prev = lastPoint.current;
    if (prev) {
      const dist = Math.hypot(x - prev.x, y - prev.y);
      const steps = Math.min(24, Math.max(1, Math.round(dist / (radius * 0.4))));
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        stamp(ctx, prev.x + (x - prev.x) * t, prev.y + (y - prev.y) * t, radius);
      }
    } else {
      stamp(ctx, x, y, radius);
    }
    lastPoint.current = { x, y };

    moves.current += 1;
    if (moves.current % CHECK_EVERY === 0 && clearedRatio(canvas, ctx) >= REVEAL_THRESHOLD) {
      finish();
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (locked || open) return;
    drawing.current = true;
    lastPoint.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
    scratchAt(e.clientX, e.clientY);
  }

  /**
   * Стираем и без нажатия: на мыши достаточно провести курсором, на телефоне
   * события всё равно приходят только во время касания.
   */
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (locked || open) return;
    scratchAt(e.clientX, e.clientY);
  }

  function stop(e: React.PointerEvent<HTMLCanvasElement>): void {
    lastPoint.current = null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    // На отпускании проверяем ещё раз — иначе ячейка может «залипнуть» стёртой
    if (canvas && ctx && !open && clearedRatio(canvas, ctx) >= REVEAL_THRESHOLD) finish();
    if (drawing.current) {
      drawing.current = false;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  }

  return (
    <div
      className={[
        'relative aspect-square select-none overflow-hidden rounded-lg transition-all duration-300',
        open && highlight
          ? 'bg-brand/20 ring-2 ring-brand shadow-[0_0_20px_-4px_rgba(0,255,136,0.6)]'
          : 'bg-bg-base ring-1 ring-border',
      ].join(' ')}
    >
      {/* Приз под покрытием */}
      <div
        className={[
          'absolute inset-0 flex flex-col items-center justify-center px-1 transition-transform duration-300',
          open ? 'scale-100' : 'scale-90',
        ].join(' ')}
      >
        <span
          className={`font-mono text-sm font-black leading-none tabular-nums sm:text-base ${tone}`}
        >
          {label}
        </span>
        <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-text-muted">
          AZN
        </span>
      </div>

      {/* Стираемое покрытие */}
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        aria-hidden={open}
        className={[
          'absolute inset-0 h-full w-full transition-opacity duration-300',
          open ? 'pointer-events-none opacity-0' : locked ? 'opacity-100' : 'cursor-pointer',
        ].join(' ')}
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}
