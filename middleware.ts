import { type NextRequest } from 'next/server'
import { updateSession } from '@/backend/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - /login (public — allow unauthenticated)
     * - /signup (public — allow unauthenticated)
     * - /auth/callback (Supabase email confirmation)
     */
    '/((?!_next/static|_next/image|favicon.ico|login|signup|auth/callback).*)',
  ],
}
