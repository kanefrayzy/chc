'use client';

import { useState, useEffect } from 'react';

export function OnlineCounter(): JSX.Element {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const initial = 50 + Math.floor(Math.random() * 30); // 50–79
    setCount(initial);

    let timeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      const delay = 18000 + Math.floor(Math.random() * 22000); // 18–40 сек
      timeoutId = setTimeout(() => {
        setCount((prev) => {
          if (prev === null) return initial;
          const delta = Math.floor(Math.random() * 7) - 3; // -3..+3
          return Math.max(50, prev + delta);
        });
        tick();
      }, delay);
    }

    tick();
    return () => clearTimeout(timeoutId);
  }, []);

  if (count === null) return <></>;

  return (
    <span className="flex items-center gap-1.5 text-xs text-text-secondary select-none">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
      </span>
      <span>{count} онлайн</span>
    </span>
  );
}
