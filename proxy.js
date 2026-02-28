// proxy.js - Protección de rutas por rol (Next.js 16)
// Ejecuta en el Edge antes de cada request

import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

export async function proxy(request) {
  const token = await getToken({
    req:    request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  const { pathname } = request.nextUrl

  // ─── /admin/* → solo superadmin ────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (token.rol !== 'superadmin') {
      // owner o cobrador intentando entrar a /admin → dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // ─── /dashboard/* → owner y cobrador ───────────────────
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/clientes') ||
      pathname.startsWith('/prestamos') || pathname.startsWith('/rutas') ||
      pathname.startsWith('/cobradores') || pathname.startsWith('/caja') ||
      pathname.startsWith('/reportes') || pathname.startsWith('/configuracion')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (token.rol === 'superadmin') {
      // superadmin no accede al dashboard de organizaciones
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // ─── /login → redirigir si ya hay sesión activa ─────────
  if (pathname === '/login') {
    if (token) {
      if (token.rol === 'superadmin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url))
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/clientes/:path*',
    '/prestamos/:path*',
    '/rutas/:path*',
    '/cobradores/:path*',
    '/caja/:path*',
    '/reportes/:path*',
    '/configuracion/:path*',
    '/login',
  ],
}
