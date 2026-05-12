export function minorToAzn(minor: string | bigint, opts?: { sign?: boolean }): string {
  const big = typeof minor === 'bigint' ? minor : BigInt(minor);
  const negative = big < 0n;
  const abs = negative ? -big : big;
  const integer = abs / 100n;
  const frac = abs % 100n;
  const fracStr = frac.toString().padStart(2, '0');
  const intStr = integer.toLocaleString('en-US').replace(/,/g, ' ');
  const sign = negative ? '-' : opts?.sign ? '+' : '';
  return `${sign}${intStr}.${fracStr} AZN`;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortId(id: string, head = 4, tail = 4): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

export function parseAmountToMinor(input: string): bigint {
  const s = input.replace(/\s+/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) {
    throw new Error('INVALID_AMOUNT');
  }
  const negative = s.startsWith('-');
  const abs = negative ? s.slice(1) : s;
  const [intPart = '0', fracPart = ''] = abs.split('.');
  const padded = (fracPart + '00').slice(0, 2);
  const minor = BigInt(intPart) * 100n + BigInt(padded);
  return negative ? -minor : minor;
}
