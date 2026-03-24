import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimit } from '../rate-limit'

describe('rateLimit', () => {
  let limiter

  beforeEach(() => {
    // Create a fresh limiter for each test
    limiter = rateLimit(`test-${Date.now()}-${Math.random()}`, 3, 60000)
  })

  it('allows requests within limit', () => {
    const r1 = limiter('1.2.3.4')
    expect(r1.ok).toBe(true)
    expect(r1.remaining).toBe(2)

    const r2 = limiter('1.2.3.4')
    expect(r2.ok).toBe(true)
    expect(r2.remaining).toBe(1)

    const r3 = limiter('1.2.3.4')
    expect(r3.ok).toBe(true)
    expect(r3.remaining).toBe(0)
  })

  it('blocks after exceeding limit', () => {
    limiter('1.2.3.4')
    limiter('1.2.3.4')
    limiter('1.2.3.4')

    const r4 = limiter('1.2.3.4')
    expect(r4.ok).toBe(false)
    expect(r4.remaining).toBe(0)
    expect(r4.retryAfter).toBeGreaterThan(0)
  })

  it('tracks IPs independently', () => {
    limiter('1.2.3.4')
    limiter('1.2.3.4')
    limiter('1.2.3.4')

    // Different IP should still be allowed
    const r = limiter('5.6.7.8')
    expect(r.ok).toBe(true)
    expect(r.remaining).toBe(2)
  })

  it('resets after window expires', () => {
    // Use a very short window
    const fastLimiter = rateLimit(`fast-${Date.now()}`, 1, 50)

    const r1 = fastLimiter('1.2.3.4')
    expect(r1.ok).toBe(true)

    const r2 = fastLimiter('1.2.3.4')
    expect(r2.ok).toBe(false)

    // Wait for window to expire
    return new Promise((resolve) => {
      setTimeout(() => {
        const r3 = fastLimiter('1.2.3.4')
        expect(r3.ok).toBe(true)
        resolve()
      }, 60)
    })
  })
})
