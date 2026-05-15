// Лёгкий звуковой движок на Web Audio API. Без файлов — все звуки генерятся в браузере.
// AudioContext создаётся лениво, после первого клика (требование браузеров).

let ctx: AudioContext | null = null;
let enabled = true;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new Ctor();
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

export function setSoundEnabled(v: boolean): void {
  enabled = v;
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem('chc.sound', v ? '1' : '0'); } catch { /* */ }
  }
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return enabled;
  try {
    const v = window.localStorage.getItem('chc.sound');
    if (v === '0') return false;
    if (v === '1') return true;
  } catch { /* */ }
  return enabled;
}

function envelope(g: GainNode, c: AudioContext, attack: number, decay: number, peak: number): void {
  const t = c.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function beep(freq: number, type: OscillatorType, duration: number, peak = 0.18): void {
  if (!isSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.connect(g);
  g.connect(c.destination);
  envelope(g, c, 0.005, duration, peak);
  o.start();
  o.stop(c.currentTime + duration + 0.05);
}

/** Короткий «тик» во время вращения (на каждый сектор). */
export function playTick(): void {
  beep(880, 'square', 0.04, 0.05);
}

/** Звук, когда колесо замедляется к концу. */
export function playSlow(): void {
  beep(440, 'sine', 0.18, 0.08);
}

/** Победный аккорд (мажор). */
export function playWin(): void {
  if (!isSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    setTimeout(() => beep(f, 'triangle', 0.35, 0.15), i * 90);
  });
}

/** Звук поражения — короткий тёмный «бууу». */
export function playLose(): void {
  if (!isSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(220, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(80, c.currentTime + 0.35);
  o.connect(g);
  g.connect(c.destination);
  envelope(g, c, 0.01, 0.35, 0.1);
  o.start();
  o.stop(c.currentTime + 0.5);
}

/** Щелчок при ставке. */
export function playClick(): void {
  beep(660, 'triangle', 0.06, 0.08);
}

/** Тик обратного отсчёта (последние 3 секунды). Отличается от игрового тика. */
export function playCountdownTick(): void {
  beep(1200, 'square', 0.07, 0.12);
}
