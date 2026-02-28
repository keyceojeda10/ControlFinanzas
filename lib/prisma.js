// lib/prisma.js - Singleton de PrismaClient para Next.js
// Evita múltiples instancias en desarrollo por hot-reload

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
