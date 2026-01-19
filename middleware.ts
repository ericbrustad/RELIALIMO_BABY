import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  const pathname = request.nextUrl.pathname
  
  // Skip Next.js internal paths and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')  // Static files with extensions
  ) {
    return NextResponse.next()
  }

  // Driver subdomain: driver.relialimo.com
  if (host.startsWith('driver.')) {
    if (pathname === '/' || pathname === '') {
      return NextResponse.rewrite(new URL('/drivers/driver-portal.html', request.url))
    }
    // Rewrite paths to /drivers folder
    if (!pathname.startsWith('/drivers') && !pathname.startsWith('/shared')) {
      return NextResponse.rewrite(new URL(`/drivers${pathname}`, request.url))
    }
  }

  // Customer/Account subdomain: account.relialimo.com
  if (host.startsWith('account.')) {
    if (pathname === '/' || pathname === '') {
      return NextResponse.rewrite(new URL('/customers/customer-portal.html', request.url))
    }
    // Rewrite paths to /customers folder
    if (!pathname.startsWith('/customers') && !pathname.startsWith('/shared')) {
      return NextResponse.rewrite(new URL(`/customers${pathname}`, request.url))
    }
  }

  // Admin subdomain: admin.relialimo.com - serve from root
  if (host.startsWith('admin.')) {
    if (pathname === '/' || pathname === '') {
      return NextResponse.rewrite(new URL('/admin.html', request.url))
    }
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
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files with extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
