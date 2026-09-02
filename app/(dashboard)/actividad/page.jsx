'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useCabecera } from '@/components/armazon/Armazon'
import { ACCIONES } from '@/lib/activity-log-types'
import { agruparRepetidos, textoDeFila, paraRevisar, resumenDelDia, quienTrabajo } from '@/lib/adaptadores/actividad'
import { formatMoney } from '@/lib/i18n'
import { leerDeCache, guardarEnCache } from '@/lib/offline'

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
  star: (color) => (
    <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.5a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
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

// ── CUANDO LA ACCION NO TIENE FRASE ────────────────────────────────────────
//
// Antes esto era `{ label: item.accion }`: el codigo crudo, tal cual, con sus
// guiones bajos. El dueño leyo «registrar_aporte» en su propio historial.
//
// Ya estan las 48 en `activity-log-types.js`, asi que esto no deberia entrar
// nunca. Pero entra el dia que alguien añada una accion en un endpoint y se
// olvide del mapa — y ese dia debe salir «Registrar aporte», no el codigo.
// Guiones bajos fuera y primera en mayuscula: se lee, aunque no sea perfecto.
function FRASE_DE_RESERVA(accion) {
  const texto = String(accion || '').replace(/_/g, ' ').trim()
  return {
    label: texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : 'Actividad',
    color: 'var(--cf-ink-3)',
  }
}

function getIcon(accion) {
  const config = ACCIONES[accion]
  // SIN ICONO QUEDABA UN CIRCULO GRIS VACIO — el dueño lo reporto junto con los
  // nombres crudos. Toda fila lleva algo dentro: si la accion no esta mapeada, o
  // su icono no existe, va el generico.
  const renderIcon = ICONOS[config?.icon] || ICONOS.pencil
  return renderIcon(config?.color || 'var(--cf-ink-3)')
}

function formatHora(fecha) {
  return new Date(fecha).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function labelFechaGrupo(dateStr) {
  const hoy = new Date()
  const fecha = new Date(dateStr + 'T12:00:00')
  const hoyStr = hoy.toISOString().slice(0, 10)
  const ayerDate = new Date(hoy)
  ayerDate.setDate(ayerDate.getDate() - 1)
  const ayerStr = ayerDate.toISOString().slice(0, 10)

  if (dateStr === hoyStr) return 'Hoy'
  if (dateStr === ayerStr) return 'Ayer'
  return fecha.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
}

function agruparPorDia(items) {
  const grupos = []
  let currentKey = null
  for (const item of items) {
    const key = new Date(item.createdAt).toISOString().slice(0, 10)
    if (key !== currentKey) {
      currentKey = key
      grupos.push({ key, label: labelFechaGrupo(key), items: [] })
    }
    grupos[grupos.length - 1].items.push(item)
  }
  return grupos
}

const FILTROS_RAPIDOS = [
  { value: '', label: 'Todo' },
  { value: 'registrar_pago', label: 'Pagos' },
  { value: 'crear_prestamo', label: 'Préstamos' },
  { value: 'cierre_caja', label: 'Cierres' },
  { value: 'crear_cliente', label: 'Clientes' },
]

const FILTROS_COMPLETOS = [
  { value: '', label: 'Todas las acciones' },
  { value: 'crear_prestamo', label: 'Préstamos creados' },
  { value: 'registrar_pago', label: 'Pagos registrados' },
  { value: 'editar_pago', label: 'Pagos editados' },
  { value: 'anular_pago', label: 'Pagos anulados' },
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
  // «Historial», como en el menú y en el buscador. Decía «Actividad» mientras
  // el menú decía «Quién hizo qué»: tres nombres para una pantalla (2 sep 2026).
  useCabecera({ titulo: 'Historial', subtitulo: 'Todo lo que pasa en tu negocio, en orden' })

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState(null)
  const [hasMore, setHasMore] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const [mostrarFiltrosAvanzados, setMostrarFiltrosAvanzados] = useState(false)
  const loaderRef = useRef(null)

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
    params.set('limit', '30')

    try {
      const res = await fetch(`/api/actividad?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      setItems(prev => reset ? data.items : [...prev, ...data.items])
      setCursor(data.nextCursor)
      setHasMore(!!data.nextCursor)
      setLoading(false)

      // Cache the initial load for offline fallback
      if (reset && !filtroTipo && !filtroUsuario && !desde && !hasta) {
        guardarEnCache('actividad', data).catch(() => {})
      }
    } catch {
      // Network error — try reading from IndexedDB cache
      if (reset) {
        try {
          const cached = await leerDeCache('actividad')
          if (cached?.items) {
            setItems(cached.items)
            setCursor(cached.nextCursor || null)
            setHasMore(!!cached.nextCursor)
          }
        } catch {}
      }
      setLoading(false)
    }
  }, [filtroTipo, filtroUsuario, desde, hasta])

  useEffect(() => {
    setLoading(true)
    setItems([])
    setCursor(null)
    setHasMore(true)
    fetchActividad(null, true)
  }, [fetchActividad])

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

  const hayFiltrosAvanzados = filtroUsuario || desde || hasta
  const filtroActivoEnChips = FILTROS_RAPIDOS.some(f => f.value === filtroTipo)
  const grupos = agruparPorDia(items)

  return (
    <div className="max-w-2xl lg:max-w-5xl mx-auto px-4 py-6">
      {/* El titulo y el subtitulo los pone el armazon (`useCabecera` arriba):
          aqui salian OTRA VEZ, justo debajo de la cabecera que ya los dice. */}

      {/* Filtros rapidos — chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 mb-3" style={{ scrollbarWidth: 'none' }}>
        {FILTROS_RAPIDOS.map(f => (
          <button
            key={f.value}
            onClick={() => setFiltroTipo(filtroTipo === f.value ? '' : f.value)}
            className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-full transition-all"
            style={filtroTipo === f.value
              ? { background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }
              : { background: 'var(--cf-fill)', color: 'var(--cf-ink-3)', border: '1px solid var(--cf-border)' }}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setMostrarFiltrosAvanzados(!mostrarFiltrosAvanzados)}
          className="shrink-0 px-2.5 py-1.5 text-[11px] font-semibold rounded-full transition-all flex items-center gap-1"
          style={{
            background: hayFiltrosAvanzados ? 'color-mix(in srgb, var(--cf-gold) 15%, transparent)' : 'var(--cf-fill)',
            color: hayFiltrosAvanzados ? 'var(--cf-gold)' : 'var(--cf-ink-3)',
            border: `1px solid ${hayFiltrosAvanzados ? 'var(--cf-gold)' : 'var(--cf-border)'}`,
          }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
          </svg>
          Filtros
          {hayFiltrosAvanzados && (
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--cf-gold)' }} />
          )}
        </button>
      </div>

      {/* Filtros avanzados — expandibles */}
      {mostrarFiltrosAvanzados && (
        <div className="mb-4 p-3 rounded-[12px] space-y-2.5" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
          {!filtroActivoEnChips && (
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-[.07em] block mb-1" style={{ color: 'var(--cf-ink-3)' }}>Tipo de accion</label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full text-[12px] rounded-[8px] px-2.5 py-2 focus:outline-none"
                style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }}
              >
                {FILTROS_COMPLETOS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          )}
          {usuarios.length > 0 && (
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-[.07em] block mb-1" style={{ color: 'var(--cf-ink-3)' }}>Usuario</label>
              <select
                value={filtroUsuario}
                onChange={(e) => setFiltroUsuario(e.target.value)}
                className="w-full text-[12px] rounded-[8px] px-2.5 py-2 focus:outline-none"
                style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }}
              >
                <option value="">Todos</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-[.07em] block mb-1" style={{ color: 'var(--cf-ink-3)' }}>Desde</label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="w-full text-[12px] rounded-[8px] px-2.5 py-2 focus:outline-none [color-scheme:dark]"
                style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }}
              />
            </div>
            <div>
              <label className="text-[10px] font-extrabold uppercase tracking-[.07em] block mb-1" style={{ color: 'var(--cf-ink-3)' }}>Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="w-full text-[12px] rounded-[8px] px-2.5 py-2 focus:outline-none [color-scheme:dark]"
                style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }}
              />
            </div>
          </div>
          {hayFiltrosAvanzados && (
            <button
              onClick={() => { setFiltroUsuario(''); setDesde(''); setHasta('') }}
              className="text-[11px] font-semibold pt-1"
              style={{ color: 'var(--cf-gold)' }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && items.length === 0 ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-[12px] shrink-0" style={{ background: 'var(--cf-fill)' }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 rounded" style={{ width: '60%', background: 'var(--cf-fill)' }} />
                <div className="h-2 rounded" style={{ width: '35%', background: 'var(--cf-fill)' }} />
              </div>
              <div className="h-2.5 w-10 rounded" style={{ background: 'var(--cf-fill)' }} />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'var(--cf-fill)' }}>
            <svg className="w-7 h-7" fill="none" stroke="var(--cf-ink-3)" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--cf-ink)' }}>No hay actividad</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--cf-ink-3)' }}>
            {filtroTipo || hayFiltrosAvanzados ? 'No hay resultados con estos filtros' : 'Las acciones apareceran aqui automaticamente'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map(grupo => (
            <div key={grupo.key}>
              {/* Separador de dia */}
              <div className="flex items-center gap-2.5 mb-2.5">
                <span className="text-[10px] font-extrabold uppercase tracking-[.07em] shrink-0" style={{ color: 'var(--cf-ink-3)' }}>
                  {grupo.label}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--cf-border)' }} />
              </div>

              {/* Timeline de items del dia */}
              <div className="relative pl-5">
                {/* Linea vertical */}
                <div className="absolute left-[11px] top-2 bottom-2 w-px" style={{ background: 'var(--cf-border)' }} />

                <div className="space-y-0.5">
                  {/* ── T32-03 · LAS REPETICIONES, EN UNA FILA ──
                      Trece renglones seguidos diciendo «Carlos Andres registro
                      pago» no informan de nada: lo que hay que saber es que se
                      registraron trece, y en cuanto tiempo. La lamina lo pone en
                      una linea: «Registro 4 pagos en un minuto». */}
                  {agruparRepetidos(grupo.items).map((fila) => {
                    const item = fila.items[0]
                    const config = ACCIONES[item.accion] || FRASE_DE_RESERVA(item.accion)
                    const icon = getIcon(item.accion)
                    // Lo destructivo lo dice el COLOR del mapa, no el nombre del
                    // codigo. `startsWith('eliminar')` dejaba fuera «rechazo de
                    // reapertura» y «no pudo anular el pago», que son justo las
                    // que hay que ver en rojo.
                    const esDestructiva = config.color === '#ef4444'

                    return (
                      <div key={fila.id} className="relative flex items-start gap-2.5 py-2">
                        {/* Dot en la linea */}
                        <div
                          className="absolute -left-5 top-3 w-[9px] h-[9px] rounded-full border-2 shrink-0"
                          style={{
                            borderColor: config.color,
                            background: 'var(--cf-surface)',
                          }}
                        />

                        {/* Icono */}
                        <div
                          className="w-8 h-8 rounded-[12px] flex items-center justify-center shrink-0"
                          style={{ background: `color-mix(in srgb, ${config.color} 12%, transparent)` }}
                        >
                          {icon}
                        </div>

                        {/* Contenido */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-[12px] leading-snug" style={{ color: 'var(--cf-ink)' }}>
                            <span className="font-semibold">{fila.usuario || 'Sistema'}</span>
                            {' '}
                            <span style={{ color: fila.cuantos > 1 ? 'var(--cf-ink)' : 'var(--cf-ink-3)', fontWeight: fila.cuantos > 1 ? 600 : 400 }}>
                              {textoDeFila(fila, config.label)}
                            </span>
                          </p>
                          {fila.cuantos > 1 ? (
                            <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
                              {fila.monto > 0
                                ? `Suman ${formatMoney(fila.monto)}`
                                : `${fila.cuantos} sucesos seguidos`}
                            </p>
                          ) : item.detalle && (
                            <p
                              className="text-[11px] mt-0.5 leading-snug"
                              style={{ color: esDestructiva ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}
                            >
                              {item.detalle}
                            </p>
                          )}
                        </div>

                        {/* Hora */}
                        {/* EL MONTO, que no estaba. La lamina le da su columna:
                            «+$71.000» de una tanda de cuatro pagos dice mas que
                            los cuatro renglones sueltos. */}
                        {fila.monto !== 0 && (
                          <span className="cf-fig text-[12px] shrink-0 pt-0.5" style={{
                            color: fila.monto > 0 ? 'var(--cf-green-dark)' : 'var(--cf-ink-2)',
                          }}>
                            {fila.monto > 0 ? '+' : '−'}{formatMoney(Math.abs(fila.monto))}
                          </span>
                        )}
                        <span className="text-[10px] shrink-0 pt-1 tabular-nums" style={{ color: 'var(--cf-ink-3)' }}>
                          {fila.horaTexto}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}

          {/* Loader infinite scroll */}
          {hasMore && (
            <div ref={loaderRef} className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--cf-border)', borderTopColor: 'var(--cf-gold)' }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
