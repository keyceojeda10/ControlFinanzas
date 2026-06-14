// lib/prisma.js - Singleton de PrismaClient para Next.js
// Evita múltiples instancias en desarrollo por hot-reload

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

// Errores de Prisma que son "ruido esperado": el codigo de la app ya los maneja
// con try/catch (constraint @unique que arbitra concurrencia en el sync de leads),
// pero Prisma los escribe a stderr igualmente. Los filtramos para no ensuciar los
// logs y poder ver los errores que SI importan. Cualquier otro error pasa.
const MENSAJES_RUIDO = [
  'Unique constraint failed', // P2002 — duplicado esperado (leadgenId, telefono)
]

function crearPrisma() {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'production'
        ? [{ emit: 'event', level: 'error' }]
        : [{ emit: 'event', level: 'error' }, { emit: 'stdout', level: 'warn' }],
  })

  client.$on('error', (e) => {
    const msg = e?.message || ''
    if (MENSAJES_RUIDO.some((r) => msg.includes(r))) return // ruido conocido — silenciar
    // Reemitimos a stderr los errores reales (con el mismo formato que tenia antes)
    console.error('prisma:error', msg)
  })

  return client
}

export const prisma = globalForPrisma.prisma ?? crearPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
