import { describe, it, expect, vi, beforeEach } from 'vitest'

// Env vars must be set before ANY imports so the module-level const captures them
vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BFHFrSSvNj0Jr_test_key')
vi.stubEnv('VAPID_PRIVATE_KEY', 'RVWL-NJpSel37A7_test_key')
vi.stubEnv('VAPID_EMAIL', 'mailto:test@test.com')

const mockSendNotification = vi.fn().mockResolvedValue({})

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: mockSendNotification,
  },
}))

const mockFindManySubs = vi.fn().mockResolvedValue([])
const mockDeleteSub = vi.fn().mockResolvedValue({})
const mockFindManyUsers = vi.fn().mockResolvedValue([])

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pushSubscription: {
      findMany: mockFindManySubs,
      delete: mockDeleteSub,
    },
    user: {
      findMany: mockFindManyUsers,
    },
  },
}))

const { enviarPush, enviarPushOrg } = await import('../push')

describe('enviarPush', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends notification to all user subscriptions', async () => {
    mockFindManySubs.mockResolvedValue([
      { id: 'sub-1', endpoint: 'https://push.example.com/1', p256dh: 'key1', auth: 'auth1' },
      { id: 'sub-2', endpoint: 'https://push.example.com/2', p256dh: 'key2', auth: 'auth2' },
    ])

    await enviarPush('user-1', { body: 'Test notification' })

    expect(mockFindManySubs).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(mockSendNotification).toHaveBeenCalledTimes(2)
  })

  it('does nothing when no subscriptions found', async () => {
    mockFindManySubs.mockResolvedValue([])

    await enviarPush('user-1', { body: 'Test' })

    expect(mockSendNotification).not.toHaveBeenCalled()
  })

  it('deletes expired subscriptions (410)', async () => {
    mockFindManySubs.mockResolvedValue([
      { id: 'sub-1', endpoint: 'https://push.example.com/1', p256dh: 'key1', auth: 'auth1' },
    ])
    mockSendNotification.mockRejectedValue({ statusCode: 410 })

    await enviarPush('user-1', { body: 'Test' })

    expect(mockDeleteSub).toHaveBeenCalledWith({ where: { id: 'sub-1' } })
  })

  it('deletes expired subscriptions (404)', async () => {
    mockFindManySubs.mockResolvedValue([
      { id: 'sub-1', endpoint: 'https://push.example.com/1', p256dh: 'key1', auth: 'auth1' },
    ])
    mockSendNotification.mockRejectedValue({ statusCode: 404 })

    await enviarPush('user-1', { body: 'Test' })

    expect(mockDeleteSub).toHaveBeenCalledWith({ where: { id: 'sub-1' } })
  })
})

describe('enviarPushOrg', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends push to all owners in organization', async () => {
    mockFindManyUsers.mockResolvedValue([
      { id: 'owner-1' },
      { id: 'owner-2' },
    ])
    mockFindManySubs.mockResolvedValue([])

    await enviarPushOrg('org-1', { body: 'Org notification' })

    expect(mockFindManyUsers).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', rol: 'owner' },
      select: { id: true },
    })
  })

  it('does nothing when no owners found', async () => {
    mockFindManyUsers.mockResolvedValue([])

    await enviarPushOrg('org-1', { body: 'Test' })

    expect(mockFindManySubs).not.toHaveBeenCalled()
  })
})
