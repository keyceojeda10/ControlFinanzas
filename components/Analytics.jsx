'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function Analytics() {
  const pathname = usePathname()
  const lastPath = useRef(null)

  useEffect(() => {
    // Avoid duplicate tracking for same path
    if (pathname === lastPath.current) return
    lastPath.current = pathname

    // Fire-and-forget page view tracking
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evento: 'page_view', pagina: pathname }),
    }).catch(() => {})
  }, [pathname])

  return null
}
