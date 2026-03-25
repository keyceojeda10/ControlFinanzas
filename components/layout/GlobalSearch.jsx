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
        // Track search event
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
      allItems.push({ type: 'cliente', label: c.nombre, sub: c.cedula, href: `/clientes`, id: c.id })
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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a2a]">
          <svg className="w-5 h-5 text-[#666] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Buscar clientes, préstamos, rutas..."
            className="flex-1 bg-transparent text-sm text-white placeholder-[#666] outline-none"
          />
          <kbd className="hidden sm:inline text-[10px] text-[#555] bg-[#111] border border-[#333] px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-[#333] border-t-[#f5c518] rounded-full animate-spin" />
            </div>
          )}

          {!loading && results && allItems.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-[#666]">No se encontraron resultados</p>
            </div>
          )}

          {!loading && allItems.length > 0 && (
            <div className="py-2">
              {/* Clientes */}
              {results.clientes?.length > 0 && (
                <>
                  <p className="px-4 py-1.5 text-[10px] font-semibold text-[#555] uppercase tracking-wider">Clientes</p>
                  {results.clientes.map((c, i) => {
                    const idx = allItems.findIndex((x) => x.type === 'cliente' && x.id === c.id)
                    return (
                      <button
                        key={c.id}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${idx === selected ? 'bg-[#f5c518]/10' : 'hover:bg-[#222]'}`}
                        onClick={() => navigate(`/clientes`)}
                        onMouseEnter={() => setSelected(idx)}
                      >
                        <div className="w-7 h-7 rounded-full bg-[#3b82f6]/15 flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{c.nombre}</p>
                          <p className="text-[10px] text-[#666]">{c.cedula} {c.telefono ? `\u2022 ${c.telefono}` : ''}</p>
                        </div>
                      </button>
                    )
                  })}
                </>
              )}

              {/* Préstamos */}
              {results.prestamos?.length > 0 && (
                <>
                  <p className="px-4 py-1.5 text-[10px] font-semibold text-[#555] uppercase tracking-wider mt-1">Pr\u00e9stamos</p>
                  {results.prestamos.map((p) => {
                    const idx = allItems.findIndex((x) => x.type === 'prestamo' && x.id === p.id)
                    return (
                      <button
                        key={p.id}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${idx === selected ? 'bg-[#f5c518]/10' : 'hover:bg-[#222]'}`}
                        onClick={() => navigate(`/prestamos/${p.id}`)}
                        onMouseEnter={() => setSelected(idx)}
                      >
                        <div className="w-7 h-7 rounded-full bg-[#22c55e]/15 flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-[#22c55e]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{p.clienteNombre}</p>
                          <p className="text-[10px] text-[#666] font-mono">${Math.round(p.saldoPendiente).toLocaleString('es-CO')} pendiente</p>
                        </div>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.estado === 'activo' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#666]/10 text-[#666]'}`}>
                          {p.estado}
                        </span>
                      </button>
                    )
                  })}
                </>
              )}

              {/* Rutas */}
              {results.rutas?.length > 0 && (
                <>
                  <p className="px-4 py-1.5 text-[10px] font-semibold text-[#555] uppercase tracking-wider mt-1">Rutas</p>
                  {results.rutas.map((r) => {
                    const idx = allItems.findIndex((x) => x.type === 'ruta' && x.id === r.id)
                    return (
                      <button
                        key={r.id}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${idx === selected ? 'bg-[#f5c518]/10' : 'hover:bg-[#222]'}`}
                        onClick={() => navigate(`/rutas/${r.id}`)}
                        onMouseEnter={() => setSelected(idx)}
                      >
                        <div className="w-7 h-7 rounded-full bg-[#8b5cf6]/15 flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-[#8b5cf6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0-8.25a1.5 1.5 0 0 1 3 0V15m-3 0a1.5 1.5 0 0 0 3 0m3-8.25V15m0-8.25a1.5 1.5 0 0 1 3 0V15m-3 0a1.5 1.5 0 0 0 3 0" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{r.nombre}</p>
                          <p className="text-[10px] text-[#666]">{r._count?.clientes || 0} clientes</p>
                        </div>
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          )}

          {/* Empty state */}
          {!loading && !results && (
            <div className="py-8 text-center">
              <p className="text-xs text-[#555]">Escribe para buscar clientes, préstamos o rutas</p>
              <p className="text-[10px] text-[#444] mt-1 hidden sm:block">Ctrl+K para abrir en cualquier momento</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="hidden sm:flex items-center justify-between px-4 py-2 border-t border-[#2a2a2a] text-[10px] text-[#444]">
          <div className="flex items-center gap-3">
            <span><kbd className="bg-[#111] border border-[#333] px-1 py-0.5 rounded">&uarr;</kbd> <kbd className="bg-[#111] border border-[#333] px-1 py-0.5 rounded">&darr;</kbd> navegar</span>
            <span><kbd className="bg-[#111] border border-[#333] px-1 py-0.5 rounded">Enter</kbd> seleccionar</span>
          </div>
        </div>
      </div>
    </div>
  )
}
