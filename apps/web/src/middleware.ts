import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register'];

// In itch / cross-origin mode, skip middleware auth checks entirely.
// The client-side auth-context handles guest token auth.
const ITCH_MODE = !!process.env.NEXT_PUBLIC_API_URL;

export function middleware(request: NextRequest) {
  if (ITCH_MODE) return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const sessionId = request.cookies.get('session_id');
  if (!sessionId?.value) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
