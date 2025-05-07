import { NextResponse } from 'next/server'

import { auth } from './auth'

// This middleware protects all routes
export default auth(async (req) => {
  // If the user is authenticated, continue
  if (req.auth) {
    return NextResponse.next()
  }

  // Redirect unauthenticated users to the sign-in page
  return NextResponse.redirect(new URL('/api/auth/signin', req.nextUrl))
})

// Match all routes except auth API routes and static assets
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (Next Auth)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
