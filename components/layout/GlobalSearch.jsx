'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const router = useRouter()
  const debounceRef = useRef(null)

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

  // Debounced search
  const search = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/buscar?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data)
        setSelected(0)
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
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  // Build flat list of navigable items
  const allItems = []
  if (results) {
    results.clientes?.forEach((c) =>
      allItems.push({ type: 'cliente', label: c.nombre, sub: c.cedula, href: `/clientes/${c.id}`, id: c.id })
    )
    results.prestamos?.forEach((p) =>
      allItems.push({
        type: 'prestamo',
        label: p.clienteNombre,
        sub: `$${Math.round(p.saldoPendiente).toLocaleString('es-CO')} pendiente`,
        href: `/prestamos/${p.id}`,
        id: p.id,
      })
    )
    results.rutas?.forEach((r) =>
      allItems.push({ type: 'ruta', label: r.nombre, sub: `${r._count?.clientes || 0} clientes`, href: `/rutas/${r.id}`, id: r.id })
    )
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

  const SECTIONS = [
    { key: 'clientes', label: 'Clientes', color: '#f5c518', icon: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0' },
    { key: 'prestamos', label: 'Préstamos', color: '#22c55e', icon: 'M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33' },
    { key: 'rutas', label: 'Rutas', color: '#a855f7', icon: 'M9 6.75V15m0-8.25a1.5 1.5 0 0 1 3 0V15m-3 0a1.5 1.5 0 0 0 3 0m3-8.25V15m0-8.25a1.5 1.5 0 0 1 3 0V15m-3 0a1.5 1.5 0 0 0 3 0' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] sm:pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-3 sm:mx-4 bg-[#111111] border border-[#2a2a2a] rounded-[16px] shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 0 40px rgba(245,197,24,0.06), 0 8px 32px rgba(0,0,0,0.5)' }}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#2a2a2a]">
          <svg className="w-5 h-5 text-[#f5c518] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Buscar clientes, préstamos, rutas..."
            className="flex-1 bg-transparent text-sm text-white placeholder-[#777] outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults(null) }} className="text-[#888] hover:text-white p-0.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <kbd className="hidden sm:inline text-[10px] text-[#888] bg-[#0a0a0a] border border-[#2a2a2a] px-1.5 py-0.5 rounded-md font-mono">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#2a2a2a] border-t-[#f5c518] rounded-full animate-spin" />
            </div>
          )}

          {!loading && results && allItems.length === 0 && (
            <div className="py-8 text-center">
              <svg className="w-8 h-8 mx-auto text-[#666] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <p className="text-sm text-[#888]">Sin resultados para "{query}"</p>
            </div>
          )}

          {!loading && allItems.length > 0 && (
            <div className="py-1.5">
              {SECTIONS.map(({ key, label, color, icon }) => {
                const items = key === 'clientes' ? results.clientes
                  : key === 'prestamos' ? results.prestamos
                  : results.rutas
                if (!items?.length) return null
                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 px-4 py-2 mt-1">
                      <div className="w-1 h-3 rounded-full" style={{ background: color }} />
                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#666' }}>{label}</p>
                    </div>
                    {items.map((item) => {
                      const itemId = item.id
                      const idx = allItems.findIndex((x) => x.type === key.replace('s', '').replace('prestamo', 'prestamo') && x.id === itemId)
                        || allItems.findIndex((x) => x.id === itemId)
                      const isCliente = key === 'clientes'
                      const isPrestamo = key === 'prestamos'
                      const href = isCliente ? `/clientes/${item.id}` : isPrestamo ? `/prestamos/${item.id}` : `/rutas/${item.id}`
                      return (
                        <button
                          key={item.id}
                          className={[
                            'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all rounded-lg mx-0',
                            idx === selected ? 'bg-[rgba(245,197,24,0.08)]' : 'hover:bg-[#1a1a1a]',
                          ].join(' ')}
                          onClick={() => navigate(href)}
                          onMouseEnter={() => setSelected(idx)}
                        >
                          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
                            <svg className="w-4 h-4" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{isCliente ? item.nombre : isPrestamo ? item.clienteNombre : item.nombre}</p>
                            <p className="text-[10px] text-[#888]">
                              {isCliente && <>{item.cedula}{item.telefono ? ` \u00B7 ${item.telefono}` : ''}</>}
                              {isPrestamo && <span className="font-mono-display">${Math.round(item.saldoPendiente).toLocaleString('es-CO')} pendiente</span>}
                              {key === 'rutas' && <>{item._count?.clientes || 0} clientes</>}
                            </p>
                          </div>
                          {isPrestamo && (
                            <span className={[
                              'text-[10px] px-2 py-0.5 rounded-full font-medium',
                              item.estado === 'activo' ? 'bg-[rgba(34,197,94,0.1)] text-[#22c55e]' : 'bg-[rgba(85,85,85,0.1)] text-[#666]',
                            ].join(' ')}>
                              {item.estado}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {/* Empty state */}
          {!loading && !results && (
            <div className="py-10 text-center">
              <svg className="w-10 h-10 mx-auto text-[#2a2a2a] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <p className="text-xs text-[#888]">Busca clientes, préstamos o rutas</p>
            </div>
          )}
        </div>

        {/* Footer — solo desktop */}
        <div className="hidden sm:flex items-center justify-between px-4 py-2 border-t border-[#1a1a1a] text-[10px] text-[#777]">
          <div className="flex items-center gap-3">
            <span><kbd className="bg-[#0a0a0a] border border-[#2a2a2a] px-1 py-0.5 rounded-md font-mono">&uarr;</kbd> <kbd className="bg-[#0a0a0a] border border-[#2a2a2a] px-1 py-0.5 rounded-md font-mono">&darr;</kbd> navegar</span>
            <span><kbd className="bg-[#0a0a0a] border border-[#2a2a2a] px-1 py-0.5 rounded-md font-mono">Enter</kbd> seleccionar</span>
          </div>
        </div>
      </div>
    </div>
  )
}
