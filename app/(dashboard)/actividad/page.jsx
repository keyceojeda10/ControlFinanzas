'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ACCIONES } from '@/lib/activity-log'

const ICONOS = {
  banknotes: (color) => (
    <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
  check: (color) => (
    <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  ),
  'user-plus': (color) => (
    <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM4 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 10.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
    </svg>
  ),
  pencil: (color) => (
    <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
    </svg>
  ),
  trash: (color) => (
    <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  ),
  map: (color) => (
    <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m0-8.25a1.5 1.5 0 0 1 3 0V15m-3 0a1.5 1.5 0 0 0 3 0m-9.75 0h18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18h3v-4.636m0 0 6 2.182m0 0 6-2.182m0 0V3m0 0-3 1.09" />
    </svg>
  ),
  calculator: (color) => (
    <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V13.5Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V18Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V13.5Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V18Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm2.498-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0 0 12 2.25Z" />
    </svg>
  ),
  arrows: (color) => (
    <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
  receipt: (color) => (
    <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0c1.1.128 1.907 1.077 1.907 2.185ZM9.75 9h.008v.008H9.75V9Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm4.125 4.5h.008v.008h-.008V13.5Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  ),
}

function getIcon(accion) {
  const config = ACCIONES[accion]
  if (!config) return null
  const renderIcon = ICONOS[config.icon]
  return renderIcon ? renderIcon(config.color) : null
}

function tiempoRelativo(fecha) {
  const diff = Date.now() - new Date(fecha).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs}h`
  const dias = Math.floor(hrs / 24)
  if (dias < 7) return `Hace ${dias}d`
  return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

const FILTROS_TIPO = [
  { value: '', label: 'Todas' },
  { value: 'crear_prestamo', label: 'Préstamos creados' },
  { value: 'registrar_pago', label: 'Pagos registrados' },
  { value: 'crear_cliente', label: 'Clientes creados' },
  { value: 'editar_cliente', label: 'Clientes editados' },
  { value: 'eliminar_cliente', label: 'Clientes eliminados' },
  { value: 'editar_prestamo', label: 'Préstamos editados' },
  { value: 'eliminar_prestamo', label: 'Préstamos eliminados' },
  { value: 'crear_ruta', label: 'Rutas creadas' },
  { value: 'crear_cobrador', label: 'Cobradores creados' },
  { value: 'cierre_caja', label: 'Cierres de caja' },
  { value: 'movimiento_capital', label: 'Movimientos de capital' },
  { value: 'registrar_gasto', label: 'Gastos registrados' },
]

export default function ActividadPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const loaderRef = useRef(null)

  // Fetch org users for filter dropdown
  useEffect(() => {
    fetch('/api/cobradores')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const lista = Array.isArray(data) ? data : data.cobradores || []
        setUsuarios(lista)
      })
      .catch(() => {})
  }, [])

  const fetchActividad = useCallback(async (cursorId, reset) => {
    const params = new URLSearchParams()
    if (cursorId && !reset) params.set('cursor', cursorId)
    if (filtroTipo) params.set('tipo', filtroTipo)
    if (filtroUsuario) params.set('userId', filtroUsuario)
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    params.set('limit', '20')

    const res = await fetch(`/api/actividad?${params}`)
    if (!res.ok) return
    const data = await res.json()

    setItems(prev => reset ? data.items : [...prev, ...data.items])
    setCursor(data.nextCursor)
    setHasMore(!!data.nextCursor)
    setLoading(false)
  }, [filtroTipo, filtroUsuario, desde, hasta])

  // Reset on filter change
  useEffect(() => {
    setLoading(true)
    setItems([])
    setCursor(null)
    setHasMore(true)
    fetchActividad(null, true)
  }, [fetchActividad])

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current || !hasMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && cursor && hasMore) {
          fetchActividad(cursor)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [cursor, hasMore, fetchActividad])

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold text-white">Actividad</h1>
          <p className="text-xs text-[#777]">Historial de acciones en tu negocio</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap gap-2">
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#f5c518]"
        >
          {FILTROS_TIPO.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <select
          value={filtroUsuario}
          onChange={(e) => setFiltroUsuario(e.target.value)}
          className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#f5c518]"
        >
          <option value="">Todos los usuarios</option>
          {usuarios.map(u => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </select>

        <label className="relative cursor-pointer">
          <span className={`absolute inset-0 flex items-center px-3 text-xs pointer-events-none ${desde ? 'text-white' : 'text-[#777]'}`}>
            {desde ? new Date(desde + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Desde'}
          </span>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#f5c518] [color-scheme:dark] w-[100px]"
            style={{ color: 'transparent', WebkitTextFillColor: 'transparent' }}
          />
        </label>
        <label className="relative cursor-pointer">
          <span className={`absolute inset-0 flex items-center px-3 text-xs pointer-events-none ${hasta ? 'text-white' : 'text-[#777]'}`}>
            {hasta ? new Date(hasta + 'T12:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Hasta'}
          </span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#f5c518] [color-scheme:dark] w-[100px]"
            style={{ color: 'transparent', WebkitTextFillColor: 'transparent' }}
          />
        </label>
        {(filtroTipo || filtroUsuario || desde || hasta) && (
          <button
            onClick={() => { setFiltroTipo(''); setFiltroUsuario(''); setDesde(''); setHasta('') }}
            className="text-xs text-[#f5c518] hover:text-[#f5c518]/80 px-2 py-2"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Lista de actividad */}
      {loading && items.length === 0 ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse rounded-xl bg-[rgba(255,255,255,0.02)]">
              <div className="w-7 h-7 rounded-lg bg-[#222]" />
              <div className="flex-1">
                <div className="h-3 w-40 bg-[#222] rounded" />
              </div>
              <div className="h-2.5 w-12 bg-[#222] rounded" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 mx-auto text-[#333] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p className="text-sm text-[#777]">No hay actividad registrada</p>
          <p className="text-xs text-[#555] mt-1">Las acciones aparecerán aquí automáticamente</p>
        </div>
      ) : (
        <div className="rounded-[16px] overflow-hidden border border-[rgba(255,255,255,0.06)]" style={{ background: 'rgba(255,255,255,0.02)' }}>
          {items.map((item, idx) => {
            const config = ACCIONES[item.accion] || { label: item.accion, color: '#888' }
            const icon = getIcon(item.accion)

            return (
              <div
                key={item.id}
                className={[
                  'flex items-center gap-3 px-4 py-3',
                  idx !== items.length - 1 ? 'border-b border-[rgba(255,255,255,0.04)]' : '',
                ].join(' ')}
              >
                {/* Icono con color distintivo */}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${config.color}18` }}
                >
                  {icon}
                </div>

                {/* Contenido en una linea */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white leading-tight">
                    <span className="font-semibold">{item.user?.nombre}</span>
                    {' '}
                    <span className="text-[#999]">{config.label?.toLowerCase()}</span>
                  </p>
                  {item.detalle && (
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: config.color }}>{item.detalle}</p>
                  )}
                </div>

                {/* Tiempo a la derecha */}
                <span className="text-[10px] text-[#555] shrink-0 whitespace-nowrap">{tiempoRelativo(item.createdAt)}</span>
              </div>
            )
          })}

          {/* Loader for infinite scroll */}
          {hasMore && (
            <div ref={loaderRef} className="flex justify-center py-3 border-t border-[rgba(255,255,255,0.04)]">
              <div className="w-5 h-5 border-2 border-[#333] border-t-[#f5c518] rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
