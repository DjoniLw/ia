import { type NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const response = NextResponse.next()

  // Strip port from hostname for local dev (e.g. "clinica.localhost:3000")
  const hostnameWithoutPort = hostname.split(':')[0]
  const parts = hostnameWithoutPort.split('.')

  // Detect subdomain: "clinica.localhost" or "clinica.aesthera.com"
  if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'app') {
    const slug = parts[0]
    response.headers.set('x-clinic-slug', slug)
    // Also expose as a custom header the Next middleware can read in RSC
    response.headers.set('x-forwarded-host', hostname)
  }

  return response
}

export const config = {
  // Run on all paths except Next internals and static files
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
