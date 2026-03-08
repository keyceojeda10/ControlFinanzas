// lib/auth.js - Configuración de NextAuth.js

import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

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

        const emailNorm = credentials.email.trim().toLowerCase()

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

        // Rechazar si el email no ha sido verificado (excepto superadmin)
        if (user.rol !== 'superadmin' && !user.emailVerificado) {
          throw new Error('VERIFY_EMAIL')
        }

        // Rechazar si la organización está suspendida (no aplica a superadmin)
        if (user.organization && !user.organization.activo) {
          throw new Error('Tu cuenta está suspendida. Escríbenos a soporte@control-finanzas.com')
        }

        // Verificar contraseña
        const passwordOk = await bcrypt.compare(credentials.password, user.password)
        if (!passwordOk) return null

        // Para cobradores: obtener la ruta asignada
        let rutaId = null
        if (user.rol === 'cobrador') {
          const ruta = await prisma.ruta.findFirst({
            where:  { cobradorId: user.id, activo: true },
            select: { id: true },
          })
          rutaId = ruta?.id ?? null
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
          organizationId:        user.organizationId,   // null para superadmin
          plan:                  user.organization?.plan ?? null,
          rutaId,
          suscripcionVencimiento,
          onboardingCompletado:  user.onboardingCompletado ?? false,
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
        token.suscripcionVencimiento = user.suscripcionVencimiento
        token.onboardingCompletado  = user.onboardingCompletado
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
        session.user.suscripcionVencimiento = token.suscripcionVencimiento
        session.user.onboardingCompletado  = token.onboardingCompletado
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
  },

  session: {
    strategy: 'jwt',
  },

  secret: process.env.NEXTAUTH_SECRET,
}
