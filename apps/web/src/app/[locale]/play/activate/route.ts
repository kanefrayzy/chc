import { NextRequest, NextResponse } from 'next/server';

const FASTLOTO_BASE = 'https://fastloto.com';
const COMMON_HEADERS: HeadersInit = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
};

/** Извлекает значения cookie из заголовка Set-Cookie (берём имя=значение до `;`). */
function parseSetCookie(headers: Headers): string {
  const raw = headers.get('set-cookie');
  if (!raw) return '';
  // Node fetch объединяет несколько Set-Cookie через ", " — простая эвристика:
  // разделим по запятым, не следующим за цифрой даты (дата вида ", DD-")
  const parts = raw.split(/,(?=\s*[A-Za-z0-9_\-]+=)/);
  return parts
    .map((p) => p.split(';')[0]?.trim())
    .filter((p): p is string => Boolean(p))
    .join('; ');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { code } = (await request.json()) as { code: string };
    const digits = code.replace(/\D/g, '');

    if (digits.length !== 14) {
      return NextResponse.json(
        { result: 'NOTOK', text: 'Код должен содержать 14 цифр' },
        { status: 400 },
      );
    }

    // 1) Прогреваем сессию fastloto: запрашиваем главную, получаем PHPSESSID и dj_lang.
    let cookieHeader = '';
    try {
      const warmup = await fetch(`${FASTLOTO_BASE}/`, {
        method: 'GET',
        headers: COMMON_HEADERS,
        redirect: 'follow',
      });
      cookieHeader = parseSetCookie(warmup.headers);
    } catch {
      // Игнорируем — попробуем без cookie.
    }

    // 2) Отправляем код. Передаём cookie сессии и Referer/Origin как у их же фрейма.
    const res = await fetch(`${FASTLOTO_BASE}/login/`, {
      method: 'POST',
      headers: {
        ...COMMON_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: `${FASTLOTO_BASE}/`,
        Origin: FASTLOTO_BASE,
        'X-Requested-With': 'XMLHttpRequest',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: `game_code=${digits}`,
    });

    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { result: 'NOTOK', text: 'Неожиданный ответ от провайдера' },
        { status: 502 },
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { result: 'NOTOK', text: 'Ошибка соединения с сервером казино' },
      { status: 502 },
    );
  }
}
