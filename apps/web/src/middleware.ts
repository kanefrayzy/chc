import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { locales, defaultLocale } from './i18n/request';

const ACCESS_COOKIE = 'chc_at';

/** Пути (без префикса локали), требующие авторизации. */
const PROTECTED_PATHS = ['/profile', '/wallet', '/deposit', '/withdraw', '/chat'];

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

export default function middleware(req: NextRequest): NextResponse {
  const path = stripLocale(req.nextUrl.pathname);
  const isAuthed = Boolean(req.cookies.get(ACCESS_COOKIE)?.value);

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
