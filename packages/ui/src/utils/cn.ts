import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Объединение Tailwind-классов с правильной приоритезацией.
 * Использовать ВЕЗДЕ вместо ручной конкатенации className.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
