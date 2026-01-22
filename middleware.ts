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
  // Serve main driver-portal files from root public folder
  if (host.startsWith('driver.')) {
    if (pathname === '/' || pathname === '') {
      return NextResponse.rewrite(new URL('/driver-portal.html', request.url))
    }
    
    // Static assets - let them resolve normally
    if (pathname.match(/\.(js|css|html|png|jpg|jpeg|gif|svg|ico|json|woff|woff2|ttf|eot)$/)) {
      return NextResponse.next()
    }
    
    // Driver profile slugs (e.g., /eric_brustad) - serve driver portal
    // The driver portal JS will read the slug from the URL
    if (pathname.match(/^\/[a-zA-Z0-9_-]+$/)) {
      return NextResponse.rewrite(new URL('/driver-portal.html', request.url))
    }
    
    // Let other paths resolve from root
    return NextResponse.next()
  }

  // Customer/Account subdomain: account.relialimo.com
  if (host.startsWith('account.')) {
    if (pathname === '/' || pathname === '') {
      // Root of account subdomain shows login page
      return NextResponse.rewrite(new URL('/customers/auth.html', request.url))
    }
    
    // Handle email verification route: /verify?token=xxx&email=xxx
    if (pathname === '/verify') {
      return NextResponse.rewrite(new URL(`/customers/customer-onboarding.html${request.nextUrl.search}`, request.url))
    }
    
    // Handle onboarding route: /onboarding
    if (pathname === '/onboarding') {
      return NextResponse.rewrite(new URL(`/customers/customer-onboarding.html${request.nextUrl.search}`, request.url))
    }
    
    // Handle auth route: /auth or /auth.html
    if (pathname === '/auth' || pathname === '/auth.html') {
      return NextResponse.rewrite(new URL('/customers/auth.html', request.url))
    }
    
    // Handle password reset route: /reset-password
    if (pathname === '/reset-password') {
      return NextResponse.rewrite(new URL(`/customers/reset-password.html${request.nextUrl.search}`, request.url))
    }
    
    // Handle verified route: /verified - show success/login page
    if (pathname === '/verified') {
      return NextResponse.rewrite(new URL('/customers/auth.html?verified=true', request.url))
    }
    
    // Handle profile completion route: /complete-profile
    if (pathname === '/complete-profile') {
      return NextResponse.rewrite(new URL('/customers/complete-profile.html', request.url))
    }
    
    // Handle onboarding route: /onboarding
    if (pathname === '/onboarding' || pathname === '/onboarding.html') {
      return NextResponse.rewrite(new URL(`/customers/customer-onboarding.html${request.nextUrl.search}`, request.url))
    }
    
    // Handle customer portal slug routes like /First_Name_Last_Name or /john_smith
    // Pattern allows uppercase and lowercase letters, numbers, dashes/underscores
    const customerSlugPattern = /^\/[a-zA-Z0-9][a-zA-Z0-9_-]*$/
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

  // Admin subdomain: admin.relialimo.com - serve admin.html (login gate)
  if (host.startsWith('admin.')) {
    if (pathname === '/' || pathname === '') {
      // Serve admin.html which handles auth check and shows login or app
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
    
    // /book route - serve customer portal for booking
    if (pathname === '/book' || pathname === '/book/') {
      return NextResponse.rewrite(new URL('/customers/customer-portal.html', request.url))
    }
    
    // /login or /auth route - redirect to account subdomain for auth
    if (pathname === '/login' || pathname === '/auth') {
      return NextResponse.redirect(new URL('https://account.relialimo.com/auth', request.url))
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
