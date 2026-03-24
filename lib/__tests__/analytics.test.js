import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    evento: {
      create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
    },
  },
}))

import { trackEvent } from '../analytics'
import { prisma } from '@/lib/prisma'

describe('trackEvent', () => {
  it('creates an event record with all fields', () => {
    trackEvent({
      organizationId: 'org-1',
      userId: 'user-1',
      evento: 'page_view',
      pagina: '/dashboard',
      metadata: { source: 'test' },
    })

    expect(prisma.evento.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org-1',
        userId: 'user-1',
        evento: 'page_view',
        pagina: '/dashboard',
        metadata: '{"source":"test"}',
      },
    })
  })

  it('handles missing optional fields', () => {
    vi.clearAllMocks()
    trackEvent({ evento: 'test_event' })

    expect(prisma.evento.create).toHaveBeenCalledWith({
      data: {
        organizationId: undefined,
        userId: undefined,
        evento: 'test_event',
        pagina: undefined,
        metadata: undefined,
      },
    })
  })
})
