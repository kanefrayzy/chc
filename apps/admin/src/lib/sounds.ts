/**
 * Notification sounds via Web Audio API — no files needed.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  return ctx;
}

function beep(frequency: number, duration: number, volume: number, type: OscillatorType = 'sine'): void {
  const ac = getCtx();
  if (!ac) return;
  try {
    const oscillator = ac.createOscillator();
    const gainNode = ac.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ac.destination);
    oscillator.frequency.setValueAtTime(frequency, ac.currentTime);
    oscillator.type = type;
    gainNode.gain.setValueAtTime(0, ac.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ac.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    oscillator.start(ac.currentTime);
    oscillator.stop(ac.currentTime + duration);
  } catch {
    // Audio not available
  }
}

/** Мягкий звук для нового сообщения (клиент + модератор) */
export function playMessageSound(): void {
  beep(880, 0.15, 0.15, 'sine');
  setTimeout(() => beep(1100, 0.12, 0.12, 'sine'), 80);
}

/** Более заметный звук нового тикета (только для модератора/админа) */
export function playNewTicketSound(): void {
  beep(660, 0.12, 0.18, 'sine');
  setTimeout(() => beep(880, 0.12, 0.18, 'sine'), 100);
  setTimeout(() => beep(1100, 0.20, 0.18, 'sine'), 200);
}

/** Звук отправки (тихий, подтверждение) */
export function playSentSound(): void {
  beep(1200, 0.08, 0.08, 'sine');
}
