import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { locales, defaultLocale } from './i18n/request';

const ACCESS_COOKIE = 'chc_at';
const REFRESH_COOKIE = 'chc_rt';

/** Пути (без префикса локали), требующие авторизации. */
const PROTECTED_PATHS = ['/profile', '/wallet', '/deposit', '/withdraw', '/referrals', '/play'];

/** Пути (без префикса локали), недоступные авторизованным. */
const GUEST_ONLY_PATHS = ['/login', '/register'];

const intlMiddleware = createIntlMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: 'as-needed',
});

function detectLocalePrefix(pathname: string): { locale: string; rest: string } | null {
  for (const loc of locales) {
    if (pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)) {
      return { locale: loc, rest: pathname.slice(`/${loc}`.length) || '/' };
    }
  }
  return null;
}

function stripLocale(pathname: string): string {
  return detectLocalePrefix(pathname)?.rest ?? pathname;
}

function redirectTo(req: NextRequest, target: string): NextResponse {
  const prefix = detectLocalePrefix(req.nextUrl.pathname);
  const url = req.nextUrl.clone();
  url.pathname = prefix && prefix.locale !== defaultLocale
    ? `/${prefix.locale}${target === '/' ? '' : target}`
    : target;
  url.search = '';
  return NextResponse.redirect(url);
}

/** Попытка обновить access-токен через refresh-токен. Возвращает NextResponse с новыми cookies или null. */
async function tryRefresh(
  req: NextRequest,
  refreshToken: string,
): Promise<NextResponse | null> {
  try {
    const apiUrl =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://api:4000';
    const res = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `${REFRESH_COOKIE}=${refreshToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return null;
    const response = intlMiddleware(req);
    // Проксируем Set-Cookie из ответа API в браузер
    const rawSetCookie = res.headers.get('set-cookie');
    if (rawSetCookie) {
      // Может быть несколько cookies через запятую — Express склеивает их
      rawSetCookie.split(/,(?=[^;]+=[^;]+;)/g).forEach((c) => {
        response.headers.append('Set-Cookie', c.trim());
      });
    }
    return response;
  } catch {
    return null;
  }
}

export default async function middleware(req: NextRequest): Promise<NextResponse> {
  const path = stripLocale(req.nextUrl.pathname);
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  let isAuthed = Boolean(accessToken);

  // Если access-токен отсутствует, но refresh-токен есть — пробуем обновить.
  if (!isAuthed && refreshToken) {
    const refreshed = await tryRefresh(req, refreshToken);
    if (refreshed) return refreshed;
  }

  if (!isAuthed && PROTECTED_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) {
    return redirectTo(req, '/login');
  }

  if (isAuthed && GUEST_ONLY_PATHS.includes(path)) {
    return redirectTo(req, '/profile');
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
