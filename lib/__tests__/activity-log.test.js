import { describe, it, expect, vi } from 'vitest'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    actividadLog: {
      create: vi.fn().mockResolvedValue({ id: 'test-id' }),
    },
  },
}))

import { logActividad, ACCIONES } from '../activity-log'
import { prisma } from '@/lib/prisma'

describe('logActividad', () => {
  it('calls prisma.actividadLog.create with correct data', () => {
    const session = { user: { id: 'user-1', organizationId: 'org-1' } }

    logActividad({
      session,
      accion: 'crear_prestamo',
      entidadTipo: 'prestamo',
      entidadId: 'prest-1',
      detalle: 'Test detail',
      ip: '1.2.3.4',
    })

    expect(prisma.actividadLog.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        userId: 'user-1',
        accion: 'crear_prestamo',
        entidadTipo: 'prestamo',
        entidadId: 'prest-1',
        detalle: 'Test detail',
        ip: '1.2.3.4',
      },
    })
  })

  it('does nothing if session is missing', () => {
    vi.clearAllMocks()
    logActividad({ session: null, accion: 'test', entidadTipo: 'test' })
    expect(prisma.actividadLog.create).not.toHaveBeenCalled()
  })

  it('does nothing if organizationId is missing', () => {
    vi.clearAllMocks()
    logActividad({ session: { user: { id: 'x' } }, accion: 'test', entidadTipo: 'test' })
    expect(prisma.actividadLog.create).not.toHaveBeenCalled()
  })
})

describe('ACCIONES', () => {
  it('has all expected actions defined', () => {
    const expected = [
      'crear_prestamo', 'editar_prestamo', 'eliminar_prestamo',
      'registrar_pago', 'crear_cliente', 'editar_cliente',
      'eliminar_cliente', 'crear_ruta', 'crear_cobrador',
      'cierre_caja', 'movimiento_capital', 'registrar_gasto',
    ]
    for (const accion of expected) {
      expect(ACCIONES[accion]).toBeDefined()
      expect(ACCIONES[accion].label).toBeTruthy()
      expect(ACCIONES[accion].color).toBeTruthy()
    }
  })
})
