// lib/auth.js - Configuración de NextAuth.js

import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { loginLimiter } from '@/lib/rate-limit'

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

        // Rate limiting por email (5 intentos / 15 min)
        const emailKey = credentials.email.trim().toLowerCase()
        const rl = loginLimiter(emailKey)
        if (!rl.ok) {
          throw new Error('Demasiados intentos de inicio de sesión. Intenta en 15 minutos.')
        }

        const emailNorm = emailKey

        // Buscar usuario por email incluyendo organización para obtener el plan
        const user = await prisma.user.findUnique({
          where: { email: emailNorm },
          include: {
            organization: { select: { plan: true, activo: true } },
          },
        })

        if (!user) return null

        // Rechazar usuarios inactivos
        if (!user.activo) {
          throw new Error('Tu cuenta está desactivada. Contacta al administrador.')
        }

        // Verificación de email: periodo de gracia de 24h después de registro
        // Después de 24h sin verificar → bloqueo
        if (user.rol !== 'superadmin' && !user.emailVerificado) {
          const horasDesdeRegistro = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60)
          if (horasDesdeRegistro > 24) {
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
            verSaldoCaja:   user.puedeVerSaldoCaja ?? false,
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
        token.lastRefresh           = Date.now()
        return token
      }

      // Refresh periodico: campos criticos (plan, rutaId, emailVerificado, permisos,
      // suscripcionVencimiento) pueden cambiar en DB durante la sesion de 8h.
      // Sin refresh, el usuario veria datos stale hasta cerrar sesion.
      const REFRESH_MS = 5 * 60 * 1000 // 5 minutos
      const needsRefresh = !token.lastRefresh || (Date.now() - token.lastRefresh) > REFRESH_MS
      if (trigger === 'update' || needsRefresh) {
        try {
          if (token.id && token.rol !== 'superadmin') {
            const fresh = await prisma.user.findUnique({
              where: { id: token.id },
              select: {
                nombre: true,
                rol: true,
                activo: true,
                emailVerificado: true,
                organizationId: true,
                puedeCrearPrestamos: true,
                puedeGestionarPrestamos: true,
                puedeCrearClientes: true,
                puedeEditarClientes: true,
                puedeReportarGastos: true,
                puedeVerCapital: true,
                puedeVerSaldoCaja: true,
                organization: { select: { plan: true, activo: true } },
              },
            })
            if (fresh && fresh.activo && (!fresh.organization || fresh.organization.activo)) {
              token.nombre          = fresh.nombre
              token.rol             = fresh.rol
              token.plan            = fresh.organization?.plan ?? null
              token.emailVerificado = fresh.emailVerificado
              token.organizationId  = fresh.organizationId

              // Cobradores: refrescar rutas asignadas y permisos
              if (fresh.rol === 'cobrador') {
                const rutas = await prisma.ruta.findMany({
                  where: { cobradorId: token.id, activo: true },
                  select: { id: true },
                  orderBy: { createdAt: 'asc' },
                })
                token.rutaIds = rutas.map(r => r.id)
                token.rutaId = token.rutaIds[0] ?? null
                token.permisos = {
                  crearPrestamos: fresh.puedeCrearPrestamos,
                  gestionarPrestamos: fresh.puedeGestionarPrestamos ?? fresh.puedeCrearPrestamos,
                  crearClientes:  fresh.puedeCrearClientes,
                  editarClientes: fresh.puedeEditarClientes,
                  reportarGastos: fresh.puedeReportarGastos ?? true,
                  verCapital:     fresh.puedeVerCapital ?? false,
                  verSaldoCaja:   fresh.puedeVerSaldoCaja ?? false,
                }
              }

              // Refrescar fecha de vencimiento de suscripcion
              // Ignorar suscripciones pending (pago iniciado pero no completado en MP)
              if (fresh.organizationId) {
                const sub = await prisma.suscripcion.findFirst({
                  where: {
                    organizationId: fresh.organizationId,
                    // Excluir solo pending. NULL (trials) debe contar.
                    OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
                  },
                  orderBy: { fechaVencimiento: 'desc' },
                  select: { fechaVencimiento: true },
                })
                token.suscripcionVencimiento = sub?.fechaVencimiento?.toISOString() ?? null
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
