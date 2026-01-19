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
    
    // Handle customer portal slug routes like /john-smith or /john_smith
    // Check if pathname looks like a customer slug (lowercase letters, numbers, dashes/underscores)
    const customerSlugPattern = /^\/[a-z0-9][a-z0-9_-]*$/
    if (customerSlugPattern.test(pathname) && !pathname.includes('.')) {
      // Rewrite slug routes to customer portal with slug as query param
      const slug = pathname.slice(1) // Remove leading slash
      return NextResponse.rewrite(new URL(`/customers/customer-portal.html?slug=${slug}`, request.url))
    }
    
    // Rewrite all paths to /customers folder (except /customers paths)
    if (!pathname.startsWith('/customers')) {
      return NextResponse.rewrite(new URL(`/customers${pathname}`, request.url))
    }
  }

  // Admin subdomain: admin.relialimo.com - serve index.html directly
  if (host.startsWith('admin.')) {
    if (pathname === '/' || pathname === '') {
      return NextResponse.rewrite(new URL('/index.html', request.url))
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
