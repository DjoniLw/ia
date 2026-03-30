import { type NextRequest, NextResponse } from 'next/server'

// Paths that do NOT require a tenant slug (auth flow + error pages)
const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/verify-email',
  '/accept-invite',
  '/transfer',
  '/pay',
  '/sign',
  '/sem-acesso',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  )
}

// NOTE(#73): screenPermissions route enforcement is done client-side in layout.tsx,
// because the auth tokens are stored in localStorage and are not accessible in
// Next.js Edge middleware. O useEffect do layout.tsx roda após o mount no cliente
// e é responsável por aplicar tanto as verificações adminOnly quanto as
// granular screenPermissions nas páginas protegidas.

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const response = NextResponse.next()

  // Strip port from hostname for local dev (e.g. "clinica.localhost:3000")
  const hostnameWithoutPort = hostname.split(':')[0]
  const parts = hostnameWithoutPort.split('.')

  // Detect subdomain: "clinica.localhost" or "clinica.aesthera.com.br"
  // Excludes: "localhost" (bare), "www", "app"
  const hasSubdomain =
    parts.length >= 2 &&
    !['www', 'app'].includes(parts[0]) &&
    parts[0] !== 'localhost'

  if (hasSubdomain) {
    const slug = parts[0]
    response.headers.set('x-clinic-slug', slug)
    // Also expose to Server Components via forwarded-host
    response.headers.set('x-forwarded-host', hostname)
    return response
  }

  // No subdomain detected.
  // On bare localhost/127.0.0.1 + a protected path → redirect to the
  // "sem-acesso" page so the developer gets a clear message instead of
  // silent API failures.
  const isLocalhost =
    hostnameWithoutPort === 'localhost' || hostnameWithoutPort === '127.0.0.1'

  if (isLocalhost && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/sem-acesso'
    return NextResponse.redirect(url)
  }

  // Non-localhost without subdomain (e.g. flat Railway/Vercel URL):
  // let through — getClinicSlug() in api.ts will fall back to localStorage.
  return response
}

export const config = {
  // Run on all paths except Next internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
