import { auth } from './src/auth/server';
import { isPathProtected } from '@/app/path';
import { NextRequest, NextResponse } from 'next/server';
import type { NextApiRequest, NextApiResponse } from 'next';
import {
  PATH_ADMIN,
  PATH_ADMIN_PHOTOS,
  PATH_OG,
  PATH_OG_SAMPLE,
  PATH_SIGN_IN,
  PREFIX_PHOTO,
  PREFIX_TAG,
} from './src/app/path';

// Paths that require NextAuth's session check in middleware.
// Public paths must NOT call auth() here, because every call to
// auth() can refresh the JWT and emit a Set-Cookie header, which
// prevents EdgeOne from caching the response. Admin UI on public
// pages is fetched lazily by AppStateProvider via /api/auth/session.
const isAuthGatedPath = (pathname: string) =>
  isPathProtected(pathname) ||
  pathname === PATH_SIGN_IN;

export function proxy(req: NextRequest, res:NextResponse) {
  const pathname = req.nextUrl.pathname;

  if (pathname === PATH_ADMIN) {
    return NextResponse.redirect(new URL(PATH_ADMIN_PHOTOS, req.url));
  } else if (pathname === PATH_OG) {
    return NextResponse.redirect(new URL(PATH_OG_SAMPLE, req.url));
  } else if (/^\/photos\/(.)+$/.test(pathname)) {
    // Accept /photos/* paths, but serve /p/*
    const matches = pathname.match(/^\/photos\/(.+)$/);
    return NextResponse.rewrite(new URL(
      `${PREFIX_PHOTO}/${matches?.[1]}`,
      req.url,
    ));
  } else if (/^\/t\/(.)+$/.test(pathname)) {
    // Accept /t/* paths, but serve /tag/*
    const matches = pathname.match(/^\/t\/(.+)$/);
    return NextResponse.rewrite(new URL(
      `${PREFIX_TAG}/${matches?.[1]}`,
      req.url,
    ));
  }

  if (isAuthGatedPath(pathname)) {
    return auth(
      req as unknown as NextApiRequest,
      res as unknown as NextApiResponse,
    );
  }

  return NextResponse.next();
}

export const config = {
  // Excludes:
  // - /api + /api/auth*
  // - /_next/static*
  // - /_next/image*
  // - /favicon.ico + /favicons/*
  // - /home-image
  // - /template-image
  // - /template-image-tight
  // - /template-url
  //
  // Public paths (/grid, /full, /about, /tag/*, /p/*, /, ...) are
  // intentionally NOT excluded: middleware still needs to see them
  // for URL rewrites (/photos/* -> /p/*, /t/* -> /tag/*). They simply
  // do not call auth() — see isAuthGatedPath above. Auth is only run
  // on /admin/*, /sign-in, /og, and the private-tag prefix so that
  // NextAuth's sliding-session refresh never emits Set-Cookie on
  // cacheable responses.
  // eslint-disable-next-line max-len
  matcher: ['/((?!api$|api/auth|_next/static|_next/image|favicon.ico$|favicons/|home-image$|template-image$|template-image-tight$|template-url$).*)'],
};
