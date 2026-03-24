import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBuscarLimiter = vi.fn().mockReturnValue({ ok: true, remaining: 29 })

// Mock rate limiter
vi.mock('@/lib/rate-limit', () => ({
  buscarLimiter: (...args) => mockBuscarLimiter(...args),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

// Mock auth
const mockGetServerSession = vi.fn()
vi.mock('next-auth', () => ({
  getServerSession: (...args) => mockGetServerSession(...args),
}))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

// Mock prisma
const mockClienteFindMany = vi.fn().mockResolvedValue([])
const mockPrestamoFindMany = vi.fn().mockResolvedValue([])
const mockRutaFindMany = vi.fn().mockResolvedValue([])

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: { findMany: (...args) => mockClienteFindMany(...args) },
    prestamo: { findMany: (...args) => mockPrestamoFindMany(...args) },
    ruta: { findMany: (...args) => mockRutaFindMany(...args) },
  },
}))

import { GET } from '../route'

function makeRequest(q) {
  return {
    url: `http://localhost/api/buscar?q=${encodeURIComponent(q)}`,
    headers: { get: () => '127.0.0.1' },
  }
}

describe('GET /api/buscar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBuscarLimiter.mockReturnValue({ ok: true, remaining: 29 })
    mockGetServerSession.mockResolvedValue({
      user: { organizationId: 'org-1', rol: 'owner', id: 'user-1' },
    })
    mockClienteFindMany.mockResolvedValue([])
    mockPrestamoFindMany.mockResolvedValue([])
    mockRutaFindMany.mockResolvedValue([])
  })

  it('returns 401 when no session', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const res = await GET(makeRequest('test'))
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate limited', async () => {
    mockBuscarLimiter.mockReturnValue({ ok: false, remaining: 0, retryAfter: 30 })
    const res = await GET(makeRequest('test'))
    expect(res.status).toBe(429)
  })

  it('returns empty arrays for short queries', async () => {
    const res = await GET(makeRequest('a'))
    const data = await res.json()
    expect(data).toEqual({ clientes: [], prestamos: [], rutas: [] })
  })

  it('searches clientes, prestamos, rutas in parallel', async () => {
    mockClienteFindMany.mockResolvedValue([
      { id: 'c1', nombre: 'María García', cedula: '123456', telefono: '3001234567', estado: 'activo' },
    ])
    mockPrestamoFindMany.mockResolvedValue([
      {
        id: 'p1',
        montoPrestado: 100000,
        totalAPagar: 120000,
        estado: 'activo',
        cliente: { nombre: 'María García' },
        pagos: [{ montoPagado: 20000, tipo: 'completo' }],
      },
    ])
    mockRutaFindMany.mockResolvedValue([])

    const res = await GET(makeRequest('María'))
    const data = await res.json()

    expect(data.clientes).toHaveLength(1)
    expect(data.clientes[0].nombre).toBe('María García')
    expect(data.prestamos).toHaveLength(1)
    expect(data.prestamos[0].saldoPendiente).toBe(100000) // 120000 - 20000
  })

  it('does not search rutas for cobrador role', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { organizationId: 'org-1', rol: 'cobrador', rutaId: 'ruta-1', id: 'user-2' },
    })

    await GET(makeRequest('test'))

    expect(mockRutaFindMany).not.toHaveBeenCalled()
  })

  it('filters by rutaId for cobrador', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { organizationId: 'org-1', rol: 'cobrador', rutaId: 'ruta-1', id: 'user-2' },
    })

    await GET(makeRequest('test'))

    const clienteCall = mockClienteFindMany.mock.calls[0][0]
    expect(clienteCall.where.rutaId).toBe('ruta-1')
  })
})
