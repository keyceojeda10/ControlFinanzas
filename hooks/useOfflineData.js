'use client'
// hooks/useOfflineData.js — Fetch with automatic IndexedDB cache for offline support
// When online: fetches from API, caches response in IndexedDB
// When offline: serves last cached data from IndexedDB

import { useState, useEffect, useCallback, useRef } from 'react'
import { guardarEnCache, leerDeCache } from '@/lib/offline'

/**
 * @param {string} cacheKey  — unique key for IndexedDB (e.g. 'clientes:p1', 'dashboard')
 * @param {string} url       — API endpoint to fetch
 * @param {object} opts
 * @param {function} opts.transform — optional transform fn(json) => data to store
 * @param {boolean} opts.skip       — skip fetching (e.g. waiting for auth)
 */
export function useOfflineData(cacheKey, url, opts = {}) {
  const { transform, skip = false } = opts
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [isOffline, setIsOffline] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchData = useCallback(async () => {
    if (skip) return
    setLoading(true)
    setError('')
    setIsOffline(false)

    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const result = transform ? transform(json) : json

      if (mountedRef.current) {
        setData(result)
        setLoading(false)
      }

      // Cache in background (don't await)
      guardarEnCache(cacheKey, result).catch(() => {})
    } catch {
      // Network failed — try IndexedDB cache
      try {
        const cached = await leerDeCache(cacheKey)
        if (cached && mountedRef.current) {
          setData(cached)
          setIsOffline(true)
          setLoading(false)
          return
        }
      } catch {
        // IndexedDB also failed
      }

      if (mountedRef.current) {
        setError('Sin conexión y sin datos guardados.')
        setLoading(false)
      }
    }
  }, [url, cacheKey, skip, transform])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, isOffline, refetch: fetchData }
}
