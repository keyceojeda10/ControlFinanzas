// lib/auth.js - Configuración de NextAuth.js

import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { loginLimiter } from '@/lib/rate-limit'
import { normalizarEmail } from '@/lib/normalizar-email'

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
            include: {
              organization: { select: { plan: true, activo: true, country: true, timezone: true, nombre: true, modoAbreviado: true } },
            },
            orderBy: { createdAt: 'desc' },
          })
        } else {
          const emailNorm = normalizarEmail(rawInput)
          user = await prisma.user.findUnique({
            where: { email: emailNorm },
            include: {
              organization: { select: { plan: true, activo: true, country: true, timezone: true, nombre: true, modoAbreviado: true } },
            },
          })
        }

        if (!user) return null

        // Rechazar usuarios inactivos
        if (!user.activo) {
          throw new Error('Tu cuenta está desactivada. Contacta al administrador.')
        }

        // Verificación de email: periodo de gracia de 7 dias después de registro
        // Después de 7 dias sin verificar → bloqueo
        if (user.rol !== 'superadmin' && !user.emailVerificado) {
          const horasDesdeRegistro = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60)
          if (horasDesdeRegistro > 168) {
            throw new Error('VERIFY_EMAIL')
          }
        }

        // Rechazar si la organización está suspendida (no aplica a superadmin)
        if (user.organization && !user.organization.activo) {
          throw new Error('Tu cuenta está suspendida. Escríbenos a soporte@control-finanzas.com')
        }

        // Verificar contraseña
        const passwordOk = await bcrypt.compare(credentials.password, user.password)
        if (!passwordOk) return null

        // Registrar login (no bloquea si falla)
        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), lastActivityAt: new Date() },
        }).catch((err) => console.error('[auth] lastLoginAt update fail:', err.message))

        // Para cobradores: obtener las rutas asignadas y permisos
        let rutaId = null
        let rutaIds = []
        let permisos = null
        if (user.rol === 'cobrador') {
          const rutas = await prisma.ruta.findMany({
            where:  { cobradorId: user.id, activo: true },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          })
          rutaIds = rutas.map(r => r.id)
          rutaId = rutaIds[0] ?? null
          permisos = {
            crearPrestamos: user.puedeCrearPrestamos,
            gestionarPrestamos: user.puedeGestionarPrestamos ?? user.puedeCrearPrestamos,
            crearClientes:  user.puedeCrearClientes,
            editarClientes: user.puedeEditarClientes,
            reportarGastos: user.puedeReportarGastos ?? true,
            verCapital:     user.puedeVerCapital ?? false,
            verCapitalRuta: user.puedeVerCapitalRuta ?? false,
            verSaldoCaja:   user.puedeVerSaldoCaja ?? false,
            gestionarRutas: user.puedeGestionarRutas ?? false,
            aplicarDescuentos: user.puedeAplicarDescuentos ?? false,
            desembolsarLinea: user.puedeDesembolsarLinea ?? false,
            reabrirCajaSinAprobacion: user.puedeReabrirCajaSinAprobacion ?? false,
          }
        }

        // Obtener fecha de vencimiento de suscripción
        // Ignorar suscripciones pending (creadas al iniciar pago en MP pero nunca completadas)
        let suscripcionVencimiento = null
        if (user.organizationId) {
          const sub = await prisma.suscripcion.findFirst({
            where: {
              organizationId: user.organizationId,
              // Excluir solo pending. NULL (trials) debe contar.
              // Prisma `not: 'pending'` excluye NULL en MySQL — usar OR explicito.
              OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
            },
            orderBy: { fechaVencimiento: 'desc' },
            select: { fechaVencimiento: true },
          })
          suscripcionVencimiento = sub?.fechaVencimiento?.toISOString() ?? null
        }

        return {
          id:                    user.id,
          nombre:                user.nombre,
          email:                 user.email,
          rol:                   user.rol,
          organizationId:        user.organizationId,
          plan:                  user.organization?.plan ?? null,
          rutaId,
          rutaIds,
          permisos,
          suscripcionVencimiento,
          onboardingCompletado:  user.onboardingCompletado ?? false,
          emailVerificado:       user.emailVerificado,
          avatarId:              user.avatarId ?? null,
          country:               user.organization?.country ?? 'co',
          timezone:              user.organization?.timezone ?? null,
          orgNombre:             user.organization?.nombre ?? null,
          modoAbreviado:         user.organization?.modoAbreviado ?? false,
        }
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
      if (trigger === 'update' || needsRefresh) {
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
                puedeReabrirCajaSinAprobacion: true,
                organization: {
                  select: {
                    plan: true,
                    activo: true,
                    country: true,
                    timezone: true,
                    nombre: true,
                    modoAbreviado: true,
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

              // Suscripcion ya incluida en la query de user
              if (fresh.organizationId) {
                const sub = fresh.organization?.suscripciones?.[0] ?? null
                token.suscripcionVencimiento = sub?.fechaVencimiento?.toISOString() ?? null
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
