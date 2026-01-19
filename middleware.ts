import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname
  
  // Skip Next.js internal paths
  if (pathname.startsWith('/_next')) {
    return NextResponse.next()
  }
  
  // Shared resources that should never be rewritten
  const sharedPaths = ['/shared/', '/api/', '/lib/', '/assets/', '/env.js', '/favicon']
  if (sharedPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Driver subdomain: driver.relialimo.com
  if (host.startsWith('driver.')) {
    if (pathname === '/' || pathname === '') {
      return NextResponse.rewrite(new URL('/drivers/driver-portal.html', request.url))
    }
    // Rewrite all paths to /drivers folder (except /drivers paths)
    if (!pathname.startsWith('/drivers')) {
      return NextResponse.rewrite(new URL(`/drivers${pathname}`, request.url))
    }
  }

  // Customer/Account subdomain: account.relialimo.com
  if (host.startsWith('account.')) {
    if (pathname === '/' || pathname === '') {
      return NextResponse.rewrite(new URL('/customers/customer-portal.html', request.url))
    }
    // Rewrite all paths to /customers folder (except /customers paths)
    if (!pathname.startsWith('/customers')) {
      return NextResponse.rewrite(new URL(`/customers${pathname}`, request.url))
    }
  }

  // Admin subdomain: admin.relialimo.com - serve from root public folder
  if (host.startsWith('admin.')) {
    if (pathname === '/' || pathname === '') {
      return NextResponse.rewrite(new URL('/admin.html', request.url))
    }
    // Admin files are at the root of public, no rewrite needed
  }

  // Main domain without subdomain - show landing page
  // relialimo.com or www.relialimo.com
  if (host === 'relialimo.com' || host === 'www.relialimo.com') {
    if (pathname === '/' || pathname === '') {
      // Show the Next.js landing page
      return NextResponse.next()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths for subdomain routing
     * Except _next internal paths
     */
    '/((?!_next/static|_next/image).*)',
  ],
}
