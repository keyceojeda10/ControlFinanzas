// middleware.js - Protección de rutas por rol (Next.js Edge Middleware)

import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

const PORTAL_COOKIE = 'portal-token'


// Toda pantalla de app/(dashboard) va aqui. Si falta una, se abre sin sesion.
// Cubierto por lib/__tests__/middleware-rutas.test.js
const RUTAS_PRIVADAS = [
  '/actividad',
  '/asistente',
  '/caja',
  '/capital',
  '/carga-masiva',
  '/clavos',
  '/clientes',
  '/cobradores',
  '/cobros-hoy',
  '/configuracion',
  '/dashboard',
  '/gastos',
  '/lineas-credito',
  '/mas',
  '/migrador',
  '/mis-estadisticas',
  '/prestamos',
  '/reportes',
  '/rutas',
  '/socios',
  '/soporte',
  '/tutoriales',
]

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // ─── /portal/* → cookie-presence check (full verify in API routes) ──
  if (pathname.startsWith('/portal')) {
    const hasToken = !!request.cookies.get(PORTAL_COOKIE)?.value
    if (pathname === '/portal/login') {
      if (hasToken) return NextResponse.redirect(new URL('/portal', request.url))
      return NextResponse.next()
    }
    if (!hasToken) return NextResponse.redirect(new URL('/portal/login', request.url))
    return NextResponse.next()
  }

  const token = await getToken({
    req:    request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  // ─── Bloqueo por suscripcion vencida a nivel API ──────────────────
  // La validacion del layout solo cubre PAGINAS; las API routes no pasan por
  // el layout, asi que un trial vencido podia seguir registrando datos via API
  // (sobre todo por el sync offline de la PWA). Aqui cortamos eso para TODAS
  // las /api/* de un solo punto, usando el suscripcionVencimiento del JWT
  // (se refresca cada 15 min). Exentas: lo necesario para pagar/desbloquear,
  // auth, crons (corren con secret, sin sesion) y superadmin.
  if (pathname.startsWith('/api/')) {
    const EXENTAS = ['/api/auth/', '/api/pagos/', '/api/plan/', '/api/webhook/',
      '/api/cron/', '/api/admin/', '/api/health', '/api/ping', '/api/analytics/',
      '/api/unsubscribe', '/api/logo', '/api/telegram/', '/api/uploads/', '/api/portal/']
    const exenta = EXENTAS.some((p) => pathname.startsWith(p))
    if (!exenta && token && token.rol !== 'superadmin' && token.suscripcionVencimiento) {
      if (new Date(token.suscripcionVencimiento) < new Date()) {
        return NextResponse.json(
          { error: 'Tu suscripción está vencida. Renueva tu plan para continuar.', suscripcionVencida: true },
          { status: 403 }
        )
      }
    }
    return NextResponse.next()
  }

  // ─── /admin/* → solo superadmin ────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (token.rol !== 'superadmin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // ─── /suscripcion-vencida → solo si hay sesión ────────
  if (pathname === '/suscripcion-vencida') {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  // ─── Rutas privadas → owner y cobrador ─────────────────
  if (RUTAS_PRIVADAS.some((p) => pathname.startsWith(p))) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (token.rol === 'superadmin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }

    // ─── Verificar suscripción vencida (chequeo rapido del JWT) ────────────────
    // Excepciones: /configuracion/plan puede acceder aunque esté vencida
    if (pathname !== '/configuracion/plan' && token.suscripcionVencimiento) {
      const vencimiento = new Date(token.suscripcionVencimiento)
      if (vencimiento < new Date()) {
        return NextResponse.redirect(new URL('/suscripcion-vencida', request.url))
      }
    }

    // Inyectar pathname para que el layout pueda hacer chequeo adicional
    // contra DB (el JWT puede estar stale si el cookie es viejo).
    const reqHeaders = new Headers(request.headers)
    reqHeaders.set('x-pathname', pathname)
    return NextResponse.next({ request: { headers: reqHeaders } })
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

  // ─── /registro → redirigir si ya hay sesión ────────────
  if (pathname === '/registro') {
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
  // ⚠️ Este matcher tiene que llevar TODAS las de RUTAS_PRIVADAS. Next exige que
  // sea un literal estatico, asi que no se puede derivar de la constante — por
  // eso hay un test que compara las dos listas y ademas comprueba que no falte
  // ninguna pantalla de app/(dashboard). Asi se descubrio que 11 rutas se
  // abrian sin sesion: se fueron añadiendo pantallas y nadie toco estas listas.
  matcher: [
    '/api/:path*',
    '/admin/:path*',
    '/actividad/:path*',
    '/asistente/:path*',
    '/caja/:path*',
    '/capital/:path*',
    '/carga-masiva/:path*',
    '/clavos/:path*',
    '/clientes/:path*',
    '/cobradores/:path*',
    '/cobros-hoy/:path*',
    '/configuracion/:path*',
    '/dashboard/:path*',
    '/gastos/:path*',
    '/lineas-credito/:path*',
    '/mas/:path*',
    '/migrador/:path*',
    '/mis-estadisticas/:path*',
    '/prestamos/:path*',
    '/reportes/:path*',
    '/rutas/:path*',
    '/socios/:path*',
    '/soporte/:path*',
    '/tutoriales/:path*',
    '/suscripcion-vencida',
    '/login',
    '/registro',
  ],
}
