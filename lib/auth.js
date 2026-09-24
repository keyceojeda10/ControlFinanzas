// lib/auth.js - Configuración de NextAuth.js

import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { loginLimiter } from '@/lib/rate-limit'
import { normalizarEmail } from '@/lib/normalizar-email'
import { selectCobro, vencimientoEfectivo } from '@/lib/cobro-automatico'
import { INCLUDE_USUARIO_SESION, revisarCuenta, armarSesion, usuarioParaSesion, sesionDeUsuario } from '@/lib/auth-sesion'
import { abrirCuentaGuardada } from '@/lib/cuentas-guardadas'
import { CUENTA_NO_VALE } from '@/lib/cuentas-guardadas-textos'

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',      type: 'email'    },
        password: { label: 'Contraseña', type: 'password' },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Rate limiting por email/teléfono (5 intentos / 15 min)
        const emailKey = credentials.email.trim().toLowerCase()
        const rl = loginLimiter(emailKey)
        if (!rl.ok) {
          throw new Error('Demasiados intentos de inicio de sesión. Intenta en 15 minutos.')
        }

        // Detectar si el input es un teléfono (solo dígitos, sin @)
        const rawInput = credentials.email.trim()
        const esTelefono = /^\+?\d{7,15}$/.test(rawInput.replace(/[\s\-]/g, ''))

        let user = null

        if (esTelefono) {
          // Buscar por teléfono — solo dígitos, sin prefijo internacional duplicado
          const telLimpio = rawInput.replace(/\D/g, '')
          // Intentar con y sin prefijo 57 para Colombia
          const variantes = [telLimpio]
          if (telLimpio.length === 10 && telLimpio.startsWith('3')) variantes.push('57' + telLimpio)
          if (telLimpio.startsWith('57') && telLimpio.length === 12) variantes.push(telLimpio.slice(2))

          user = await prisma.user.findFirst({
            where: { telefono: { in: variantes } },
            include: INCLUDE_USUARIO_SESION,
            orderBy: { createdAt: 'desc' },
          })
        } else {
          const emailNorm = normalizarEmail(rawInput)
          user = await prisma.user.findUnique({
            where: { email: emailNorm },
            include: INCLUDE_USUARIO_SESION,
          })
        }

        if (!user) return null

        revisarCuenta(user)

        const passwordOk = await bcrypt.compare(credentials.password, user.password)
        if (!passwordOk) return null

        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), lastActivityAt: new Date() },
        }).catch((err) => console.error('[auth] lastLoginAt update fail:', err.message))

        return armarSesion(user)
      },
    }),

    /* CUENTA GUARDADA EN ESTE TELÉFONO: la llave del aparato (y el PIN si es
       dueño) en vez de correo y contraseña. Las MISMAS revisiones que el login
       con clave: ver lib/auth-sesion.js. */
    CredentialsProvider({
      id: 'cuenta-guardada',
      name: 'cuenta-guardada',
      credentials: { id: {}, llave: {}, pin: {} },
      async authorize(credentials) {
        const rl = loginLimiter(`cg:${credentials?.id}`)
        if (!rl.ok) throw new Error('Demasiados intentos. Intenta en 15 minutos.')
        const userId = await abrirCuentaGuardada({ id: credentials?.id, llave: credentials?.llave, pin: credentials?.pin })
        const usuario = await usuarioParaSesion(userId)
        if (!usuario) throw new Error(CUENTA_NO_VALE)
        prisma.user.update({
          where: { id: usuario.id },
          data: { lastLoginAt: new Date(), lastActivityAt: new Date() },
        }).catch((err) => console.error('[auth] lastLoginAt (cuenta guardada):', err.message))
        return sesionDeUsuario(usuario)
      },
    }),
  ],

  callbacks: {
    // Persiste campos extra en el JWT y los refresca periodicamente desde DB
    async jwt({ token, user, trigger }) {
      // Login inicial - tomar datos del objeto user retornado por authorize()
      if (user) {
        token.id                    = user.id
        token.nombre                = user.nombre
        token.rol                   = user.rol
        token.organizationId        = user.organizationId
        token.plan                  = user.plan
        token.rutaId                = user.rutaId
        token.rutaIds               = user.rutaIds ?? []
        token.permisos              = user.permisos
        token.suscripcionVencimiento = user.suscripcionVencimiento
        token.onboardingCompletado  = user.onboardingCompletado
        token.emailVerificado       = user.emailVerificado
        token.avatarId              = user.avatarId ?? null
        token.country               = user.country ?? 'co'
        token.timezone              = user.timezone ?? null
        token.orgNombre             = user.orgNombre ?? null
        token.modoAbreviado         = user.modoAbreviado ?? false
        token.ocultarSaldoWA        = user.ocultarSaldoWA ?? false
        token.camposRecibo          = user.camposRecibo ?? null
        token.lastRefresh           = Date.now()
        return token
      }

      // Refresh periodico: campos criticos (plan, rutaId, emailVerificado, permisos,
      // suscripcionVencimiento) pueden cambiar en DB durante la sesion de 8h.
      // Sin refresh, el usuario veria datos stale hasta cerrar sesion.
      // 15 min = buen equilibrio entre frescura y carga DB (era 5 min).
      // A 2000 usuarios: 15 min reduce los refreshes de 24k/h a 8k/h.
      const REFRESH_MS = 15 * 60 * 1000 // 15 minutos
      const needsRefresh = !token.lastRefresh || (Date.now() - token.lastRefresh) > REFRESH_MS

      /* ⚠ SI EL TOKEN DICE «VENCIDO», SE REFRESCA SIEMPRE, SIN ESPERAR LOS 15
       * MINUTOS. Y esto no es una optimización: es plata.
       *
       * Reportado por el dueño el 1 sep 2026: «cuando pagan, al recargar no
       * entran a su sistema normalmente, sino que tienen que cerrar sesión y
       * volverla a abrir. Mucha gente paga y me escribe que el sistema sigue
       * igual».
       *
       * Pasaba porque el vencimiento vive en el JWT y el middleware corta TODAS
       * las `/api/*` con ese dato. El cliente pagaba, la base quedaba bien, y su
       * token seguía diciendo vencido: la app le respondía 403 a todo. Cerrar
       * sesión funcionaba porque regenera el token.
       *
       * Los 15 minutos tampoco lo salvaban: `refetchInterval={0}` y
       * `refetchOnWindowFocus={false}`, así que la sesión no se vuelve a pedir
       * sola y este callback no llega a correr.
       *
       * Refrescar siempre a los vencidos no pesa: son pocos y, mientras lo
       * están, la app les responde 403 a casi todo — o sea que hacen muy pocas
       * peticiones. Y es exactamente el momento en que el dato importa. */
      const tokenDiceVencido = token.suscripcionVencimiento
        && new Date(token.suscripcionVencimiento) < new Date()

      if (trigger === 'update' || needsRefresh || tokenDiceVencido) {
        try {
          if (token.id && token.rol !== 'superadmin') {
            // Una sola query que incluye org+suscripcion+rutas.
            // Antes eran 3 round-trips separados; ahora es 1.
            const esCobrador = token.rol === 'cobrador'
            const fresh = await prisma.user.findUnique({
              where: { id: token.id },
              select: {
                nombre: true,
                rol: true,
                activo: true,
                emailVerificado: true,
                avatarId: true,
                organizationId: true,
                puedeCrearPrestamos: true,
                puedeGestionarPrestamos: true,
                puedeCrearClientes: true,
                puedeEditarClientes: true,
                puedeReportarGastos: true,
                puedeVerCapital: true,
                puedeVerCapitalRuta: true,
                puedeVerSaldoCaja: true,
                puedeGestionarRutas: true,
                puedeAplicarDescuentos: true,
                // Sin pedirlo aquí, abajo llegaría `undefined` y el `?? false`
                // lo apagaría igual: el `select` y el objeto de permisos tienen
                // que ir a la par.
                puedeDesembolsarLinea: true,
                puedeReabrirCajaSinAprobacion: true,
                organization: {
                  select: {
                    plan: true,
                    activo: true,
                    country: true,
                    timezone: true,
                    nombre: true,
                    modoAbreviado: true,
                    ocultarSaldoWA: true,
                    camposRecibo: true,
                    ...selectCobro,
                    suscripciones: {
                      where: { OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }] },
                      orderBy: { fechaVencimiento: 'desc' },
                      take: 1,
                      select: { fechaVencimiento: true },
                    },
                  },
                },
                // Rutas solo para cobradores (owners no tienen rutas propias)
                ...(esCobrador ? {
                  rutas: {
                    where: { activo: true },
                    select: { id: true },
                    orderBy: { createdAt: 'asc' },
                  },
                } : {}),
              },
            })
            if (fresh && fresh.activo && (!fresh.organization || fresh.organization.activo)) {
              token.nombre          = fresh.nombre
              token.rol             = fresh.rol
              token.plan            = fresh.organization?.plan ?? null
              token.emailVerificado = fresh.emailVerificado
              token.avatarId        = fresh.avatarId ?? null
              token.organizationId  = fresh.organizationId
              token.country         = fresh.organization?.country ?? 'co'
              token.timezone        = fresh.organization?.timezone ?? null
              token.orgNombre       = fresh.organization?.nombre ?? null
              token.modoAbreviado   = fresh.organization?.modoAbreviado ?? false
              token.ocultarSaldoWA  = fresh.organization?.ocultarSaldoWA ?? false
              token.camposRecibo    = fresh.organization?.camposRecibo ?? null

              // Suscripcion ya incluida en la query de user
              if (fresh.organizationId) {
                const sub = fresh.organization?.suscripciones?.[0] ?? null
                token.suscripcionVencimiento = vencimientoEfectivo(sub?.fechaVencimiento?.toISOString() ?? null, fresh.organization)
              }

              // Cobradores: rutas y permisos (incluidos en la misma query)
              if (fresh.rol === 'cobrador') {
                const rutas = fresh.rutas ?? []
                token.rutaIds = rutas.map(r => r.id)
                token.rutaId = token.rutaIds[0] ?? null
                token.permisos = {
                  crearPrestamos: fresh.puedeCrearPrestamos,
                  gestionarPrestamos: fresh.puedeGestionarPrestamos ?? fresh.puedeCrearPrestamos,
                  crearClientes:  fresh.puedeCrearClientes,
                  editarClientes: fresh.puedeEditarClientes,
                  reportarGastos: fresh.puedeReportarGastos ?? true,
                  verCapital:     fresh.puedeVerCapital ?? false,
                  verCapitalRuta: fresh.puedeVerCapitalRuta ?? false,
                  verSaldoCaja:   fresh.puedeVerSaldoCaja ?? false,
                  gestionarRutas: fresh.puedeGestionarRutas ?? false,
                  aplicarDescuentos: fresh.puedeAplicarDescuentos ?? false,
                  // ⚠ FALTABA. El login sí lo ponía y este refresco no, así que
                  // el permiso funcionaba al entrar y SE APAGABA SOLO a los 15
                  // minutos, hasta el siguiente inicio de sesión. Cada permiso
                  // nuevo hay que ponerlo en LOS DOS SITIOS.
                  desembolsarLinea: fresh.puedeDesembolsarLinea ?? false,
                  reabrirCajaSinAprobacion: fresh.puedeReabrirCajaSinAprobacion ?? false,
                }
              }
            }
          }
        } catch (err) {
          console.error('[auth][jwt refresh]', err)
          // Si el refresh falla, mantenemos el token actual - no bloqueamos al usuario
        }
        token.lastRefresh = Date.now()
      }

      return token
    },

    // Expone los campos del JWT en la sesión del cliente
    async session({ session, token }) {
      if (token) {
        session.user.id                    = token.id
        session.user.nombre                = token.nombre
        session.user.rol                   = token.rol
        session.user.organizationId        = token.organizationId
        session.user.plan                  = token.plan
        session.user.rutaId                = token.rutaId
        session.user.rutaIds               = token.rutaIds ?? []
        session.user.permisos              = token.permisos ?? null
        session.user.suscripcionVencimiento = token.suscripcionVencimiento
        session.user.onboardingCompletado  = token.onboardingCompletado
        session.user.emailVerificado       = token.emailVerificado
        session.user.avatarId              = token.avatarId ?? null
        session.user.country               = token.country ?? 'co'
        session.user.timezone              = token.timezone ?? null
        session.user.orgNombre             = token.orgNombre ?? null
        session.user.modoAbreviado         = token.modoAbreviado ?? false
        session.user.ocultarSaldoWA        = token.ocultarSaldoWA ?? false
        session.user.camposRecibo          = token.camposRecibo ?? null
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 horas
  },

  secret: process.env.NEXTAUTH_SECRET,
}
