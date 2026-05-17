import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Auto-refresh access token when it has expired but refresh token is still valid.
 * The access token cookie (chc_at) shares the same expiry as the JWT, so if the
 * cookie is absent the token has expired. We call /auth/refresh and forward the
 * new Set-Cookie headers back to the browser.
 */
export async function middleware(request: NextRequest) {
  const at = request.cookies.get('chc_at')?.value;
  const rt = request.cookies.get('chc_rt')?.value;

  // Nothing to do if access token is still present, or if there's no refresh token
  if (at || !rt) {
    return NextResponse.next();
  }

  try {
    const apiUrl =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://api:4000';

    const refreshRes = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `chc_rt=${rt}` },
    });

    if (refreshRes.ok) {
      const response = NextResponse.next();
      // Forward all Set-Cookie headers from the refresh response
      const setCookieHeader = refreshRes.headers.get('set-cookie');
      if (setCookieHeader) {
        // Some environments return a single combined header; split and forward
        response.headers.append('Set-Cookie', setCookieHeader);
      }
      return response;
    }
  } catch {
    // Ignore errors — proceed normally, page/layout will redirect to login if needed
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all panel routes, skip Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico|login).*)',
  ],
};
