import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Paths that do not require the gate check
  const publicPaths = ['/', '/api/gate/verify'];
  
  // Allow all static assets, images, and next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.') // like .png, .js
  ) {
    return NextResponse.next();
  }

  // Check if gate is passed
  const gateCookie = request.cookies.get('nchat_gate');

  // If trying to access protected paths without gate pass
  if (!gateCookie && !publicPaths.includes(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
