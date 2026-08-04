'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** useLayoutEffect ломается при серверном рендере — на сервере берём обычный. */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Доля стёртого покрытия, после которой ячейка открывается целиком. */
const REVEAL_THRESHOLD = 0.45;

/** Проверяем прогресс не на каждое движение — чтение пикселей недешёвое. */
const CHECK_EVERY = 6;

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

  /** Рисует покрытие: тёмная фольга с диагональным блеском. */
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
    base.addColorStop(0, '#243029');
    base.addColorStop(0.45, '#2f3d34');
    base.addColorStop(0.55, '#3b4d41');
    base.addColorStop(1, '#212b25');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Диагональная штриховка — покрытие не выглядит плоской заливкой
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (let x = -rect.height; x < rect.width; x += 7) {
      ctx.beginPath();
      ctx.moveTo(x, rect.height);
      ctx.lineTo(x + rect.height, 0);
      ctx.stroke();
    }

    setOpen(false);
    moves.current = 0;
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
      if (data[i] === 0) cleared += 1;
    }
    return total === 0 ? 0 : cleared / total;
  }

  function scratchAt(clientX: number, clientY: number): void {
    const canvas = canvasRef.current;
    if (!canvas || open) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(10, rect.width * 0.24), 0, Math.PI * 2);
    ctx.fill();

    moves.current += 1;
    if (moves.current % CHECK_EVERY === 0 && clearedRatio(canvas, ctx) >= REVEAL_THRESHOLD) {
      finish();
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (locked || open) return;
    drawing.current = true;
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
          ? 'bg-brand/15 ring-2 ring-brand'
          : 'bg-bg-base ring-1 ring-border',
      ].join(' ')}
    >
      {/* Приз под покрытием */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-1">
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
