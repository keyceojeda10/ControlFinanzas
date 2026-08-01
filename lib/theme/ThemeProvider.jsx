'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const ThemeContext = createContext({ theme: 'light', resolvedTheme: 'light', setTheme: () => {} })

const STORAGE_KEY = 'cf-theme'

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function applyTheme(resolved) {
  if (typeof document === 'undefined') return
  const h = document.documentElement
  h.setAttribute('data-theme', resolved)
  h.style.colorScheme = resolved
  // Inline background para evitar flash cuando la hoja de estilos no esta lista
  // (offline / SW fallback). Se limpia cuando hay CSS cargado.
  //
  // ⚠ ESTOS CUATRO VALORES SON LA PALETA, Y ESTABAN EN LA ANTERIOR.
  //
  // Decian `#f5f7fb` / `#1a1a2e`: un fondo gris AZULADO y una tinta azul-negra,
  // que son del diseño de antes. El sistema nuevo usa hueso CALIDO (#F4F4F1) y
  // carbon (#15161A) — `app/tokens-2026.css:18` y `:33`.
  //
  // Y no era un detalle de la primera decima de segundo: se escriben como
  // estilo EN LINEA sobre `<html>` y `<body>`, y un estilo en linea le gana a la
  // hoja de estilos. O sea que el fondo de toda la app y el color heredado eran
  // los viejos para siempre, dijeran lo que dijeran los tokens. De ahi que las
  // separaciones que heredan `currentColor` salieran como lineas NEGRAS opacas
  // en vez del `rgba(20,20,28,.06)` que manda la receta.
  //
  // Medido en pantalla antes de tocarlo: fondo `rgb(245,247,251)` en 2 bloques y
  // separador `rgb(26,26,46)` en 4 elementos.
  //
  // Si cambian los tokens, cambian aqui. Son los unicos cuatro colores del
  // sistema que no pueden leerse de la hoja de estilos, justamente porque esto
  // corre cuando puede que no haya hoja de estilos.
  const bg = resolved === 'light' ? '#F4F4F1' : '#15161A'
  const fg = resolved === 'light' ? '#15161A' : '#F3F3F6'
  h.style.backgroundColor = bg
  h.style.color = fg
  if (document.body) {
    document.body.style.backgroundColor = bg
    document.body.style.color = fg
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', bg)
}

function readStoredTheme() {
  try {
    // Default de marca: claro. 'system'/'dark' solo si el usuario lo eligio.
    const saved = localStorage.getItem('cf-theme') || 'light'
    return saved === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : saved
  } catch {
    return 'light'
  }
}

export function ThemeProvider({ children, initialTheme }) {
  const [theme, setThemeState] = useState(initialTheme || 'light')
  const [resolvedTheme, setResolvedTheme] = useState('light')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || 'light'
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
