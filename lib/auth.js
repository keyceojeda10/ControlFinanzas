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

        // Para cobradores: obtener la ruta asignada y permisos
        let rutaId = null
        let permisos = null
        if (user.rol === 'cobrador') {
          const ruta = await prisma.ruta.findFirst({
            where:  { cobradorId: user.id, activo: true },
            select: { id: true },
          })
          rutaId = ruta?.id ?? null
          permisos = {
            crearPrestamos: user.puedeCrearPrestamos,
            crearClientes:  user.puedeCrearClientes,
            editarClientes: user.puedeEditarClientes,
          }
        }

        // Obtener fecha de vencimiento de suscripción
        let suscripcionVencimiento = null
        if (user.organizationId) {
          const sub = await prisma.suscripcion.findFirst({
            where: { organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
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
          permisos,
          suscripcionVencimiento,
          onboardingCompletado:  user.onboardingCompletado ?? false,
          emailVerificado:       user.emailVerificado,
        }
      },
    }),
  ],

  callbacks: {
    // Persiste campos extra en el JWT
    async jwt({ token, user }) {
      if (user) {
        token.id                    = user.id
        token.nombre                = user.nombre
        token.rol                   = user.rol
        token.organizationId        = user.organizationId
        token.plan                  = user.plan
        token.rutaId                = user.rutaId
        token.permisos              = user.permisos
        token.suscripcionVencimiento = user.suscripcionVencimiento
        token.onboardingCompletado  = user.onboardingCompletado
        token.emailVerificado       = user.emailVerificado
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
