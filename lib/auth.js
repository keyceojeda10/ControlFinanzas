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

        // Buscar usuario por email incluyendo organización para obtener el plan
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            organization: { select: { plan: true, activo: true } },
          },
        })

        if (!user) return null

        // Rechazar usuarios inactivos
        if (!user.activo) return null

        // Rechazar si la organización está suspendida (no aplica a superadmin)
        if (user.organization && !user.organization.activo) {
          throw new Error('Tu cuenta está suspendida. Contacta a soporte.')
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

        return {
          id:             user.id,
          nombre:         user.nombre,
          email:          user.email,
          rol:            user.rol,
          organizationId: user.organizationId,   // null para superadmin
          plan:           user.organization?.plan ?? null,
          rutaId,
        }
      },
    }),
  ],

  callbacks: {
    // Persiste campos extra en el JWT
    async jwt({ token, user }) {
      if (user) {
        token.id             = user.id
        token.nombre         = user.nombre
        token.rol            = user.rol
        token.organizationId = user.organizationId
        token.plan           = user.plan
        token.rutaId         = user.rutaId
      }
      return token
    },

    // Expone los campos del JWT en la sesión del cliente
    async session({ session, token }) {
      if (token) {
        session.user.id             = token.id
        session.user.nombre         = token.nombre
        session.user.rol            = token.rol
        session.user.organizationId = token.organizationId
        session.user.plan           = token.plan
        session.user.rutaId         = token.rutaId
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
