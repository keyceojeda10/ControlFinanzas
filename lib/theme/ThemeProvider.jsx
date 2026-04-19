'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const ThemeContext = createContext({ theme: 'dark', resolvedTheme: 'dark', setTheme: () => {} })

const STORAGE_KEY = 'cf-theme'

function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(resolved) {
  if (typeof document === 'undefined') return
  const h = document.documentElement
  h.setAttribute('data-theme', resolved)
  h.style.colorScheme = resolved
  // Inline background para evitar flash cuando la hoja de estilos no esta lista
  // (offline / SW fallback). Se limpia cuando hay CSS cargado.
  const bg = resolved === 'light' ? '#f5f7fb' : '#060609'
  const fg = resolved === 'light' ? '#1a1a2e' : '#f0f0f5'
  h.style.backgroundColor = bg
  h.style.color = fg
  if (document.body) {
    document.body.style.backgroundColor = bg
    document.body.style.color = fg
  }
}

function readStoredTheme() {
  try {
    const saved = localStorage.getItem('cf-theme') || 'system'
    return saved === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : saved
  } catch {
    return 'dark'
  }
}

export function ThemeProvider({ children, initialTheme }) {
  const [theme, setThemeState] = useState(initialTheme || 'system')
  const [resolvedTheme, setResolvedTheme] = useState('dark')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || 'system'
    setThemeState(saved)
  }, [])

  useEffect(() => {
    const resolved = theme === 'system' ? getSystemTheme() : theme
    setResolvedTheme(resolved)
    applyTheme(resolved)
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const handler = () => {
      const resolved = getSystemTheme()
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [theme])

  // Re-aplicar tema cuando la pagina vuelve del bfcache (back/forward) o
  // cuando se sirve desde cache del SW (HTML cacheado con data-theme viejo).
  // Cubre el caso offline: usuario navega a pagina cacheada con dark y
  // necesitamos re-forzar light instantaneamente.
  useEffect(() => {
    const reapply = () => {
      const resolved = readStoredTheme()
      setResolvedTheme(resolved)
      applyTheme(resolved)
    }
    const onPageShow = (e) => {
      // persisted=true => bfcache restore; tambien re-aplica en todo caso
      reapply()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') reapply()
    }
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const setTheme = useCallback((next) => {
    setThemeState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
    fetch('/api/user/theme', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {})
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
