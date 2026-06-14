'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { obtenerComandos, filtrarComandos } from '@/lib/searchCommands'

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const router = useRouter()
  const debounceRef = useRef(null)
  const { esCobrador, ...auth } = useAuth()

  // Catalogo de comandos locales (navegacion/acciones/config) segun rol.
  const comandos = useMemo(() => obtenerComandos({
    esCobrador,
    permisos: {
      puedeCrearPrestamos: auth.puedeCrearPrestamos,
      puedeCrearClientes: auth.puedeCrearClientes,
    },
  }), [esCobrador, auth.puedeCrearPrestamos, auth.puedeCrearClientes])

  // Comandos locales que matchean la query — instantaneo, sin API.
  const comandosFiltrados = useMemo(
    () => (query.trim().length >= 1 ? filtrarComandos(comandos, query, 8) : []),
    [comandos, query]
  )

  // Ctrl+K / Cmd+K to open
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Debounced search (solo clientes/prestamos/rutas via API)
  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/buscar?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data)
        fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ evento: 'busqueda_global' }),
        }).catch(() => {})
      }
    } catch {}
    setLoading(false)
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setSelected(0)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  // Orden de comandos para render: navegacion primero, luego acciones.
  const comandosNav = comandosFiltrados.filter((c) => !c.accion)
  const comandosAccion = comandosFiltrados.filter((c) => c.accion)

  // Build flat list of navigable items en el MISMO orden que el render, para
  // que los indices de navegacion con teclado coincidan exactamente.
  const allItems = []
  comandosNav.forEach((c) => allItems.push({ href: c.href }))
  comandosAccion.forEach((c) => allItems.push({ href: c.href }))
  if (results) {
    results.clientes?.forEach((c) => allItems.push({ href: `/clientes/${c.id}` }))
    results.prestamos?.forEach((p) => allItems.push({ href: `/prestamos/${p.id}` }))
    results.rutas?.forEach((r) => allItems.push({ href: `/rutas/${r.id}` }))
  }

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((prev) => Math.min(prev + 1, allItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && allItems[selected]) {
      e.preventDefault()
      navigate(allItems[selected].href)
    }
  }

  const navigate = (href) => {
    setOpen(false)
    router.push(href)
  }

  if (!open) return null

  const ICON_COLORS = {
    comando: 'var(--color-info)',
    accion: 'var(--color-accent)',
    cliente: 'var(--color-accent)',
    prestamo: 'var(--color-success)',
    ruta: 'var(--color-purple)',
  }

  // Offsets de cada seccion (sin mutar durante el render): cada seccion empieza
  // donde termina la anterior, siguiendo el mismo orden que allItems.
  const cli = results?.clientes || []
  const pre = results?.prestamos || []
  const rut = results?.rutas || []
  const OFF_NAV = 0
  const OFF_ACCION = OFF_NAV + comandosNav.length
  const OFF_CLI = OFF_ACCION + comandosAccion.length
  const OFF_PRE = OFF_CLI + cli.length
  const OFF_RUT = OFF_PRE + pre.length

  const hayAlgo = allItems.length > 0
  const colorDe = (k) => ICON_COLORS[k] || 'var(--color-text-muted)'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] sm:pt-[15vh]">
      <div className="absolute inset-0 bg-black/72 backdrop-blur-sm" onClick={() => setOpen(false)} />

      <div className="relative w-full max-w-lg mx-3 sm:mx-4 rounded-[16px] shadow-2xl overflow-hidden"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <svg className="w-5 h-5 shrink-0" style={{ color: 'var(--color-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Buscar clientes, rutas, caja, configuración..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--color-text-primary)' }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults(null); setSelected(0) }} className="p-1 rounded-md" style={{ color: 'var(--color-text-muted)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-md font-mono" style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto py-1.5">
          {/* Comandos: navegacion */}
          {comandosNav.length > 0 && (
            <div>
              <SectionLabel color="var(--color-info)">Ir a</SectionLabel>
              {comandosNav.map((c, i) => (
                <ResultRow key={c.id} item={c} idx={OFF_NAV + i} color={colorDe('comando')} selected={selected} onSelect={setSelected} onNavigate={navigate} />
              ))}
            </div>
          )}

          {/* Comandos: acciones */}
          {comandosAccion.length > 0 && (
            <div>
              <SectionLabel color="var(--color-accent)">Acciones</SectionLabel>
              {comandosAccion.map((c, i) => (
                <ResultRow key={c.id} item={c} idx={OFF_ACCION + i} color={colorDe('accion')} selected={selected} onSelect={setSelected} onNavigate={navigate} />
              ))}
            </div>
          )}

          {/* API: loading */}
          {loading && (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }} />
            </div>
          )}

          {/* API: clientes */}
          {results?.clientes?.length > 0 && (
            <div>
              <SectionLabel color="var(--color-accent)">Clientes</SectionLabel>
              {results.clientes.map((c, i) => {
                const item = { id: `cli-${c.id}`, label: c.nombre, sub: `${c.cedula || ''}${c.telefono ? ` · ${c.telefono}` : ''}`, href: `/clientes/${c.id}`, icon: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0' }
                return <ResultRow key={item.id} item={item} idx={OFF_CLI + i} color={colorDe('cliente')} selected={selected} onSelect={setSelected} onNavigate={navigate} />
              })}
            </div>
          )}

          {/* API: prestamos */}
          {results?.prestamos?.length > 0 && (
            <div>
              <SectionLabel color="var(--color-success)">Préstamos</SectionLabel>
              {results.prestamos.map((p, i) => {
                const item = { id: `pre-${p.id}`, label: p.clienteNombre, sub: `$${Math.round(p.saldoPendiente).toLocaleString('es-CO')} pendiente`, href: `/prestamos/${p.id}`, estado: p.estado, icon: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z' }
                return <ResultRow key={item.id} item={item} idx={OFF_PRE + i} color={colorDe('prestamo')} selected={selected} onSelect={setSelected} onNavigate={navigate} />
              })}
            </div>
          )}

          {/* API: rutas */}
          {results?.rutas?.length > 0 && (
            <div>
              <SectionLabel color="var(--color-purple)">Rutas</SectionLabel>
              {results.rutas.map((r, i) => {
                const item = { id: `rut-${r.id}`, label: r.nombre, sub: `${r._count?.clientes || 0} clientes`, href: `/rutas/${r.id}`, icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' }
                return <ResultRow key={item.id} item={item} idx={OFF_RUT + i} color={colorDe('ruta')} selected={selected} onSelect={setSelected} onNavigate={navigate} />
              })}
            </div>
          )}

          {/* Sin resultados */}
          {!loading && query.trim().length >= 1 && !hayAlgo && (
            <div className="py-8 text-center">
              <svg className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sin resultados para "{query}"</p>
            </div>
          )}

          {/* Estado inicial (sin query) */}
          {query.trim().length === 0 && (
            <div className="py-10 text-center">
              <svg className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-border-hover)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Busca clientes, préstamos, rutas, caja, gastos, configuración…</p>
            </div>
          )}
        </div>

        {/* Footer — solo desktop */}
        <div className="hidden sm:flex items-center justify-between px-4 py-2 text-[10px]" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 rounded-md font-mono" style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>&uarr;</kbd> <kbd className="px-1 py-0.5 rounded-md font-mono" style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>&darr;</kbd> navegar</span>
            <span><kbd className="px-1 py-0.5 rounded-md font-mono" style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>Enter</kbd> abrir</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componentes de modulo (no definir dentro del render) ──

function SectionLabel({ color, children }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 mt-1">
      <div className="w-1 h-3 rounded-full" style={{ background: color }} />
      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{children}</p>
    </div>
  )
}

function ResultRow({ item, idx, color, selected, onSelect, onNavigate }) {
  return (
    <button
      className={[
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all rounded-lg min-h-[46px] focus-visible:outline-none',
        idx === selected ? 'bg-[var(--color-accent-soft)]' : 'hover:bg-[var(--color-bg-hover)]',
      ].join(' ')}
      onClick={() => onNavigate(item.href)}
      onMouseEnter={() => onSelect(idx)}
    >
      <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
        <svg className="w-4 h-4" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d={item.icon || 'M9 12.75L11.25 15 15 9.75'} />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{item.label}</p>
        {item.sub && <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{item.sub}</p>}
      </div>
      {item.estado && (
        <span className={[
          'text-[10px] px-2 py-0.5 rounded-full font-medium',
          item.estado === 'activo' ? 'bg-[rgba(34,197,94,0.14)] text-[#59e3a4]' : 'bg-[rgba(148,163,184,0.14)] text-[#c7c7d2]',
        ].join(' ')}>{item.estado}</span>
      )}
    </button>
  )
}
