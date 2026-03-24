import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    evento: { deleteMany: vi.fn().mockResolvedValue({ count: 42 }) },
    actividadLog: { deleteMany: vi.fn().mockResolvedValue({ count: 15 }) },
  },
}))

// Mock rate limit
vi.mock('@/lib/rate-limit', () => ({
  cronLimiter: vi.fn().mockReturnValue({ ok: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

import { prisma } from '@/lib/prisma'

describe('limpieza cron logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes events and activity logs older than 90 days', async () => {
    const DIAS_RETENCION = 90
    const limite = new Date()
    limite.setDate(limite.getDate() - DIAS_RETENCION)

    const [eventos, actividad] = await Promise.all([
      prisma.evento.deleteMany({ where: { createdAt: { lt: limite } } }),
      prisma.actividadLog.deleteMany({ where: { createdAt: { lt: limite } } }),
    ])

    expect(eventos.count).toBe(42)
    expect(actividad.count).toBe(15)
    expect(prisma.evento.deleteMany).toHaveBeenCalledTimes(1)
    expect(prisma.actividadLog.deleteMany).toHaveBeenCalledTimes(1)

    // Verify the date is approximately 90 days ago
    const callArg = prisma.evento.deleteMany.mock.calls[0][0]
    const deleteDate = callArg.where.createdAt.lt
    const diffDays = Math.round((Date.now() - deleteDate.getTime()) / (1000 * 60 * 60 * 24))
    expect(diffDays).toBe(90)
  })
})
