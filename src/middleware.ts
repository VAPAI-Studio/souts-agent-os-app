import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const AGENTOS_PREFIX = '/agentos';
const LOGIN_PATH = '/login';
const NO_ACCESS_PATH = '/agentos/no-access';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session for every request (per @supabase/ssr docs).
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  const path = request.nextUrl.pathname;

  // Only gate /agentos/*
  if (!path.startsWith(AGENTOS_PREFIX)) {
    return response;
  }

  // Allow the no-access page itself for signed-in users (avoids redirect loop)
  if (path === NO_ACCESS_PATH) {
    return response;
  }

  // 1. No session -> redirect to /login with ?redirect=
  if (!claims) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    url.searchParams.set('redirect', path);
    return NextResponse.redirect(url);
  }

  // 2. Session but no agentos role -> rewrite to no-access (preserves URL bar but renders 403 page)
  const appRole = claims['app_role'] as string | undefined;
  if (!appRole) {
    const url = request.nextUrl.clone();
    url.pathname = NO_ACCESS_PATH;
    return NextResponse.rewrite(url);
  }

  // 3. /agentos/team requires admin
  if (path.startsWith('/agentos/team') && appRole !== 'admin') {
    const url = request.nextUrl.clone();
    url.pathname = NO_ACCESS_PATH;
    return NextResponse.rewrite(url);
  }

  // 4. Has role -> allow through
  return response;
}

export const config = {
  matcher: [
    // Match everything except static assets — middleware needs to run on /login and /signup
    // too so the Supabase session cookie is refreshed there.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
