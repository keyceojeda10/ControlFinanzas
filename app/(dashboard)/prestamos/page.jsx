'use client'
// app/(dashboard)/prestamos/page.jsx - Lista de préstamos

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link                                   from 'next/link'
import { useAuth }                            from '@/hooks/useAuth'
import { useOffline }                         from '@/components/providers/OfflineProvider'
import { guardarEnCache, leerDeCache, obtenerPrestamosOffline } from '@/lib/offline'
import { Button }                             from '@/components/ui/Button'
import { SkeletonCard }                       from '@/components/ui/Skeleton'
import PrestamoCard                           from '@/components/prestamos/PrestamoCard'
import TarjetaCliente                         from '@/components/cf/TarjetaCliente'
import { adaptarPrestamos }                   from '@/lib/adaptadores/prestamos'
import { BarraFiltros }                       from '@/components/pantallas/ListaClientes'
import HojaFiltros, { BotonFiltros, contarFiltros } from '@/components/pantallas/HojaFiltros'
import { useMontado }                         from '@/hooks/useMontado'
import { StaggeredList }                      from '@/components/ui/StaggeredList'
import ModalWhatsAppTemplates                 from '@/components/ui/ModalWhatsAppTemplates'
import Avatar                                 from '@/components/ui/Avatar'
import { Card }                               from '@/components/ui/Card'
import MonedaCF                               from '@/components/ui/MonedaCF'
import BadgeNuevo, { NuevoChip }               from '@/components/ui/BadgeNuevo'
import { useCountry }                         from '@/hooks/useCountry'
import { formatMoney, isHoy }                 from '@/lib/i18n'

const IconWA = (
  <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)
const IconPagar = (
  <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>
)

const ESTADOS = [
  { value: '',           label: 'Todos'     },
  { value: 'pendiente_aprobacion', label: 'Pendientes', color: 'var(--color-warning)', ownerOnly: true },
  { value: 'activo',     label: 'Activos'   },
  { value: 'mora',       label: 'En mora',  color: 'var(--color-danger)' },
  { value: 'completado', label: 'Completados' },
  { value: 'cancelado',  label: 'Cancelados' },
]

// Filtro por frecuencia de cobro (se aplica del lado cliente sobre lo cargado).
const FRECUENCIAS = [
  { value: '',          label: 'Toda frecuencia' },
  { value: 'diario',    label: 'Diarios'    },
  { value: 'semanal',   label: 'Semanales'  },
  { value: 'quincenal', label: 'Quincenales' },
  { value: 'mensual',   label: 'Mensuales'  },
]

const MODOS_INTERES = [
  { value: '',                label: 'Todo modo' },
  { value: 'fijo',            label: 'Cuota fija' },
  { value: 'unico',           label: 'De una vez' },
  { value: 'solo_interes',    label: 'Globo' },
  { value: 'saldo',           label: 'Sobre saldo' },
  { value: 'manual',          label: 'Manual' },
  { value: 'lineal',          label: 'Decreciente' },
  { value: 'lineal_dinamico', label: 'Dinamico' },
]

const LIMIT = 50

const VISTA_KEY_P = 'cf-prestamos-vista'

const P_COLOR_OK   = 'var(--color-accent)'
const P_COLOR_HOT  = '#f97316'
const P_COLOR_CRIT = 'var(--color-danger)'
const P_COLOR_DONE = 'var(--color-success)'
const P_COLOR_OFF  = 'var(--color-text-muted)'

const MODO_TAG = {
  fijo: 'Cuota fija', unico: 'De una vez', solo_interes: 'Globo',
  saldo: 'Sobre saldo', manual: 'Manual', lineal: 'Decreciente',
  lineal_dinamico: 'Dinamico', proporcional: 'Proporcional',
}

function pMoodColor(p) {
  if (p.estado === 'completado') return P_COLOR_DONE
  if (p.estado === 'cancelado')  return P_COLOR_OFF
  if (p.diasMora > 7)            return P_COLOR_CRIT
  if (p.diasMora > 0)            return P_COLOR_HOT
  return P_COLOR_OK
}

function pMoodLabel(p) {
  if (p.estado === 'completado') return 'OK'
  if (p.estado === 'cancelado')  return 'Can'
  if (p.diasMora > 7)            return `${p.diasMora}d`
  if (p.diasMora > 0)            return `${p.diasMora}d`
  if (p.pagoHoy)                 return 'Pagó'
  return 'OK'
}

function PrestamoCardCompacto({ prestamo: p, esNuevo }) {
  const color = pMoodColor(p)
  const label = pMoodLabel(p)
  const porcentaje = Math.max(0, Math.min(100, p.porcentajePagado ?? 0))

  return (
    <Card
      as={Link}
      href={`/prestamos/${p.id}`}
      glowColor={color}
      padding={false}
      hoverable
      className="block px-2.5 py-2.5 group"
    >
      {/* Row 1: Avatar + nombre */}
      <div className="flex items-center gap-2 mb-1.5">
        <Avatar
          nombre={p.cliente?.nombre}
          fotoUrl={p.cliente?.fotoUrl}
          size={28}
          fontSize={10}
          style={p.cliente?.fotoUrl ? { border: `1.5px solid ${color}` } : undefined}
        />
        <p className="text-[12px] font-semibold text-[var(--color-text-primary)] leading-tight flex-1 min-w-0 truncate">
          {p.cliente?.nombre}
        </p>
      </div>

      {/* Row 2: estado + modo + monto */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1 min-w-0">
          <span
            className="inline-flex items-center gap-0.5 text-[8px] font-semibold px-1.5 py-px rounded-full shrink-0"
            style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 21%, transparent)` }}
          >
            <span className="w-1 h-1 rounded-full" style={{ background: color }} />
            {label}
          </span>
          {p.modoInteres && MODO_TAG[p.modoInteres] && (
            <span
              className="text-[7px] font-semibold px-1.5 py-px rounded-full shrink-0"
              style={{ background: 'color-mix(in srgb, var(--color-purple) 10%, transparent)', color: 'var(--color-purple)', border: '1px solid color-mix(in srgb, var(--color-purple) 20%, transparent)' }}
            >
              {MODO_TAG[p.modoInteres]}
            </span>
          )}
        </div>
        <span className="text-[13px] font-mono-display font-bold truncate" style={{ color: p.diasMora > 0 ? color : 'var(--color-text-primary)' }}>
          {formatMoney(p.saldoPendiente)}
        </span>
      </div>

      {/* Row 3: progress */}
      <div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(porcentaje, 2)}%`,
              background: porcentaje === 100
                ? P_COLOR_DONE
                : `linear-gradient(90deg, color-mix(in srgb, ${color} 60%, transparent), ${color})`,
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[9px] text-[var(--color-text-muted)]">
            <span className="font-mono-display font-semibold" style={{ color }}>{porcentaje}%</span> pagado
          </p>
          {esNuevo && <NuevoChip />}
        </div>
      </div>
    </Card>
  )
}

const IconListaP = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
)

const IconGridP = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5h4.5v-4.5h-4.5zm0 12v4.5h4.5v-4.5h-4.5zm12-12v4.5h4.5v-4.5h-4.5zm0 12v4.5h4.5v-4.5h-4.5z" />
  </svg>
)

export default function PrestamosPage() {
  const { esOwner, puedeCrearPrestamos, orgNombre, ocultarSaldoWA, organizationId, loading: authLoading } = useAuth()
  const { lastSyncedAt } = useOffline()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [prestamos, setPrestamos] = useState([])
  const [buscar,    setBuscar]    = useState('')
  const [estado,    setEstado]    = useState(() => searchParams?.get('estado') || 'activo')
  const [frecuencia, setFrecuencia] = useState(() => searchParams?.get('frecuencia') || '')

  const [modoInteres, setModoInteres] = useState(() => searchParams?.get('modoInteres') || '')
  const [rutaId,    setRutaId]    = useState(() => searchParams?.get('rutaId') || '')
  const [renovacion, setRenovacion] = useState(() => searchParams?.get('renovacion') || '')
  const [sinPagosDias, setSinPagosDias] = useState(() => searchParams?.get('sinPagosDias') || '')

  // TODOS los filtros viven en la URL, no solo estado y frecuencia.
  //
  // Antes rutaId, renovacion y modoInteres eran estado local puro: no se podia
  // enlazar a una vista filtrada, el boton "atras" perdia el filtro, y ninguna
  // otra pantalla podia mandar aqui con algo ya aplicado. Un grep de "?rutaId="
  // en todo el repo daba cero resultados: la funcion existia y nadie podia
  // llegar a ella.
  //
  // useState solo lee la URL al montar, asi que hace falta el efecto para
  // cuando el query cambia estando ya en esta pantalla (ej. una alerta del
  // dashboard).
  const paramsPrevios = useRef(null)
  useEffect(() => {
    const g = (k) => searchParams?.get(k) || ''
    const clave = ['estado', 'frecuencia', 'rutaId', 'renovacion', 'modoInteres', 'sinPagosDias']
      .map(g).join('|')
    if (clave !== paramsPrevios.current) {
      paramsPrevios.current = clave
      setEstado(g('estado') || 'activo')
      setFrecuencia(g('frecuencia'))
      setRutaId(g('rutaId'))
      setRenovacion(g('renovacion'))
      setModoInteres(g('modoInteres'))
      setSinPagosDias(g('sinPagosDias'))
    }
  }, [searchParams])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [page,      setPage]      = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total,     setTotal]     = useState(0)
  const [rutas,     setRutas]     = useState([])
  const [showFiltros, setShowFiltros] = useState(false)
  // Leer localStorage EN EL INICIALIZADOR desajusta la hidratación: el servidor
  // pone 'lista' y el primer render del cliente puede poner 'compacta', así que
  // React tira el árbol y lo repinta. Tiene que ser un efecto.
  const [vistaP, setVistaP] = useState('lista')
  useEffect(() => {
    try {
      const v = localStorage.getItem(VISTA_KEY_P)
      if (v) setVistaP(v)
    } catch {}
  }, [])

  const cambiarVistaP = (v) => {
    setVistaP(v)
    localStorage.setItem(VISTA_KEY_P, v)
  }

  const [isOffline, setIsOffline] = useState(false)
  useEffect(() => {
    const goOnline = () => { setIsOffline(false) }
    window.addEventListener('online', goOnline)
    return () => window.removeEventListener('online', goOnline)
  }, [])
  // Modal selector de plantillas WA (se abre desde swipe action)
  const [waContext, setWaContext] = useState(null)  // { cliente, prestamo }
  const hasLoadedOnceRef = useRef(false)

  // Pais del usuario para badge "Nuevo" y formatos
  const { country } = useCountry()

  // Cargar rutas para filtros avanzados (solo owner)
  useEffect(() => {
    if (!esOwner) return
    fetch('/api/rutas').then(r => r.ok ? r.json() : []).then(data => {
      const list = Array.isArray(data) ? data : (data.rutas || [])
      setRutas(list.map(r => ({ id: r.id, nombre: r.nombre, cobrador: r.cobrador?.nombre || null, cobradorId: r.cobrador?.id || null })))
    }).catch(() => {})
  }, [esOwner])

  // Toggle "Agrupar por cliente". Persiste en localStorage para no resetear
  // la preferencia al cambiar de pagina.
  const [agrupar, setAgrupar] = useState(false)

  const montado = useMontado()
  const [hojaFiltros, setHojaFiltros] = useState(false)

  // Los filtros que salieron de la cabecera. "Agrupar" y la vista van aquí
  // también: no son filtros, pero son decisiones de cómo mirar la lista, y
  // ocupaban otros 85px arriba para algo que se cambia una vez al mes.
  const gruposFiltro = [
    { id: 'frecuencia', titulo: 'Cada cuánto cobra', valor: frecuencia,
      onCambiar: (v) => { setFrecuencia(v); setPage(1) },
      // Con el título encima, «Toda frecuencia» sobra: ahí va «Cualquiera».
      opciones: FRECUENCIAS.map(({ value, label }) => ({ valor: value, nombre: value === '' ? 'Cualquiera' : label })) },
    { id: 'modo', titulo: 'Cómo se cobra el interés', valor: modoInteres,
      onCambiar: (v) => { setModoInteres(v); setPage(1) },
      opciones: MODOS_INTERES.map(({ value, label }) => ({ valor: value, nombre: label })) },
    { id: 'ruta', titulo: 'Ruta', valor: rutaId,
      onCambiar: (v) => { setRutaId(v); setPage(1) },
      opciones: [{ valor: '', nombre: 'Todas las rutas' },
        ...rutas.map((r) => ({ valor: String(r.id), nombre: r.nombre }))] },
    { id: 'sinPagos', titulo: 'No me han pagado', valor: sinPagosDias,
      onCambiar: (v) => { setSinPagosDias(v); setPage(1) },
      opciones: [{ valor: '', nombre: 'Todos' }, { valor: '7', nombre: 'Hace +7 días' },
        { valor: '15', nombre: 'Hace +15 días' }, { valor: '30', nombre: 'Hace +30 días' }] },
    { id: 'renovacion', titulo: 'Nuevos o renovados', valor: renovacion,
      onCambiar: (v) => { setRenovacion(v); setPage(1) },
      opciones: [{ valor: '', nombre: 'Todos' }, { valor: 'si', nombre: 'Le presté de nuevo' },
        { valor: 'no', nombre: 'Primera vez' }] },
    { id: 'agrupar', titulo: 'Cómo verlo', valor: agrupar ? 'cliente' : '',
      onCambiar: (v) => {
        const next = v === 'cliente'
        setAgrupar(next)
        try { localStorage.setItem('cf:prestamos:agrupar', next ? '1' : '0') } catch {}
      },
      opciones: [{ valor: '', nombre: 'Uno por uno' }, { valor: 'cliente', nombre: 'Agrupado por cliente' }] },
    { id: 'vista', titulo: 'Tamaño de las tarjetas', valor: vistaP === 'compacta' ? 'compacta' : '',
      onCambiar: (v) => cambiarVistaP(v === 'compacta' ? 'compacta' : 'lista'),
      opciones: [{ valor: '', nombre: 'Completas' }, { valor: 'compacta', nombre: 'Compactas' }] },
  ]

  const nFiltros = contarFiltros(gruposFiltro)

  const limpiarFiltros = () => {
    setFrecuencia(''); setModoInteres(''); setRutaId('')
    setSinPagosDias(''); setRenovacion(''); setAgrupar(false); setPage(1)
  }
  useEffect(() => {
    try {
      const v = localStorage.getItem('cf:prestamos:agrupar')
      if (v === '1') setAgrupar(true)
    } catch {}
  }, [])
  const toggleAgrupar = useCallback(() => {
    setAgrupar((prev) => {
      const next = !prev
      try { localStorage.setItem('cf:prestamos:agrupar', next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  const fetchPrestamos = useCallback(async (q, est, p, { soft = false, frec = '', ruta = '', creador = '', renov = '', modo = '', sinPagos = '' } = {}) => {
    const shouldUseSoftRefresh = soft && hasLoadedOnceRef.current
    setError('')
    setIsOffline(false)
    const cacheKey = `prestamos:${q || ''}:${est || ''}:${frec || ''}:${ruta || ''}:${creador || ''}:${renov || ''}:${modo || ''}:${sinPagos || ''}:${p}`

    // Cache-first: pintar al instante desde IndexedDB si hay datos de este
    // filtro, y revalidar en segundo plano. Sin cache → skeleton.
    if (!shouldUseSoftRefresh) {
      try {
        const cached = await leerDeCache(cacheKey)
        if (cached && cached.prestamos) {
          setPrestamos(cached.prestamos)
          setTotal(cached.total)
          setTotalPages(cached.totalPages)
          setLoading(false)
        } else {
          setLoading(true)
        }
      } catch { setLoading(true) }
    }

    // Offline: go straight to IndexedDB (skip SW cache which may be stale)
    if (!navigator.onLine) {
      try {
        let cached = await leerDeCache(cacheKey)
        if (!cached) {
          const allPrestamos = await obtenerPrestamosOffline()
          if (allPrestamos.length > 0) {
            let filtered = allPrestamos
            const apiEstado = est === 'mora' ? 'activo' : est
            if (apiEstado) filtered = filtered.filter(pr => pr.estado === apiEstado)
            if (est === 'mora') filtered = filtered.filter(pr => pr.diasMora > 0)
            if (frec) filtered = filtered.filter(pr => (pr.frecuencia || 'diario') === frec)
            if (q) {
              const ql = q.toLowerCase()
              filtered = filtered.filter(pr => pr.cliente?.nombre?.toLowerCase().includes(ql) || pr.cliente?.cedula?.includes(ql))
            }
            const start = (p - 1) * LIMIT
            cached = { prestamos: filtered.slice(start, start + LIMIT), total: filtered.length, totalPages: Math.ceil(filtered.length / LIMIT) }
          }
        }
        if (cached) {
          setPrestamos(cached.prestamos); setTotal(cached.total); setTotalPages(cached.totalPages)
          if (!navigator.onLine) setIsOffline(true)
          setLoading(false); hasLoadedOnceRef.current = true; return
        }
      } catch {}
    }

    try {
      const params = new URLSearchParams()
      if (q) params.set('buscar', q)
      // "mora" no es un estado en BD: pedimos activos y que el server filtre por
      // mora con soloMora=1. Antes se filtraba aca, sobre la pagina ya recortada,
      // asi que los morosos de la pagina 2 en adelante no se veian nunca.
      const apiEstado = est === 'mora' ? 'activo' : est
      if (apiEstado) params.set('estado', apiEstado)
      if (est === 'mora') params.set('soloMora', '1')
      if (frec) params.set('frecuencia', frec)
      if (ruta) params.set('rutaId', ruta)
      if (creador) params.set('creadoPorId', creador)
      if (renov) params.set('renovacion', renov)
      if (modo) params.set('modoInteres', modo)
      // Antes se leia de window.location porque el filtro no era estado. Ahora
      // llega por filtrosExtra como los demas.
      if (sinPagos) params.set('sinPagosDias', sinPagos)
      params.set('page', String(p))
      params.set('limit', String(LIMIT))
      const res = await fetch(`/api/prestamos?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.offline) throw new Error('offline')
      // El server ya filtro por mora (soloMora=1) y paginó sobre el resultado:
      // filtrar de nuevo aca recortaria la pagina que acaba de llegar.
      const items = data.prestamos
      setPrestamos(items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      guardarEnCache(cacheKey, { prestamos: items, total: data.total, totalPages: data.totalPages }).catch(() => {})
    } catch {
      try {
        let cached = await leerDeCache(cacheKey)
        if (!cached) {
          const allPrestamos = await obtenerPrestamosOffline()
          if (allPrestamos.length > 0) {
            let filtered = allPrestamos
            const apiEstado = est === 'mora' ? 'activo' : est
            if (apiEstado) filtered = filtered.filter(pr => pr.estado === apiEstado)
            if (est === 'mora') filtered = filtered.filter(pr => pr.diasMora > 0)
            if (frec) filtered = filtered.filter(pr => (pr.frecuencia || 'diario') === frec)
            if (q) {
              const ql = q.toLowerCase()
              filtered = filtered.filter(pr => pr.cliente?.nombre?.toLowerCase().includes(ql) || pr.cliente?.cedula?.includes(ql))
            }
            const start = (p - 1) * LIMIT
            cached = { prestamos: filtered.slice(start, start + LIMIT), total: filtered.length, totalPages: Math.ceil(filtered.length / LIMIT) }
          }
        }
        if (cached) {
          setPrestamos(cached.prestamos)
          setTotal(cached.total)
          setTotalPages(cached.totalPages)
          if (!navigator.onLine) setIsOffline(true)
          setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
      setError('No se pudieron cargar los préstamos.')
    } finally {
      setLoading(false)
      hasLoadedOnceRef.current = true
    }
  }, [])

  // Al filtrar por ruta se mandaba ADEMAS creadoPorId con el cobrador de esa
  // ruta. Pero creadoPorId es "quien creo el prestamo (auditoria)", no "de
  // quien es la ruta": el API los cruza con AND, asi que filtrar por ruta
  // escondia todos los prestamos que habia cargado el dueño. En una cartera
  // chica, donde carga el dueño, el filtro devolvia la lista VACIA — por eso
  // parecia que filtrar por ruta "no se podia".
  const filtrosExtra = { frec: frecuencia, ruta: rutaId, renov: renovacion, modo: modoInteres, sinPagos: sinPagosDias }

  useEffect(() => { setPage(1); fetchPrestamos('', estado, 1, filtrosExtra) }, [fetchPrestamos, estado, frecuencia, rutaId, renovacion, modoInteres, sinPagosDias]) // eslint-disable-line react-hooks/exhaustive-deps

  // Estado -> URL. Sin esto el filtro no se puede compartir ni conservar al
  // volver atras. La comparacion contra la URL actual evita el bucle
  // URL -> estado -> URL (el efecto de arriba ya no ve un valor nuevo).
  useEffect(() => {
    const q = new URLSearchParams()
    if (estado && estado !== 'activo') q.set('estado', estado)
    if (frecuencia)   q.set('frecuencia', frecuencia)
    if (rutaId)       q.set('rutaId', rutaId)
    if (renovacion)   q.set('renovacion', renovacion)
    if (modoInteres)  q.set('modoInteres', modoInteres)
    if (sinPagosDias) q.set('sinPagosDias', sinPagosDias)
    const nueva = q.toString()
    if (nueva !== (searchParams?.toString() || '')) {
      router.replace(nueva ? `/prestamos?${nueva}` : '/prestamos', { scroll: false })
    }
  }, [estado, frecuencia, rutaId, renovacion, modoInteres, sinPagosDias]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(1)
    const t = setTimeout(() => fetchPrestamos(buscar, estado, 1, filtrosExtra), 300)
    return () => clearTimeout(t)
  }, [buscar, estado, frecuencia, rutaId, renovacion, modoInteres, fetchPrestamos]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cambio de página
  useEffect(() => {
    if (page > 1) fetchPrestamos(buscar, estado, page, filtrosExtra)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh silencioso cuando llega nueva sincronización global.
  useEffect(() => {
    if (!lastSyncedAt) return
    fetchPrestamos(buscar, estado, page, { soft: true, ...filtrosExtra })
  }, [lastSyncedAt, fetchPrestamos, buscar, estado, frecuencia, rutaId, renovacion, modoInteres, page]) // eslint-disable-line react-hooks/exhaustive-deps

  // Contar la mora sobre `prestamos` solo es exacto si tenemos toda la cartera
  // en memoria: con paginacion eso es UNA pagina y el numero sale corto (con 97
  // prestamos en 2 paginas decia "3 en mora" habiendo mas en la pagina 2). En el
  // filtro "En mora" el total que manda el server ya es el conteo real.
  const enMoraCount = estado === 'mora'
    ? total
    : prestamos.filter((p) => p.diasMora > 0).length
  const conteoMoraExacto = estado === 'mora' || totalPages <= 1

  // El servidor ya filtra por frecuencia (ver fetchPrestamos). En offline el
  // cache tambien la aplica. Se mantiene un filtro client-side defensivo por si
  // llega data sin filtrar (no hace daño: es idempotente).
  const prestamosVisibles = frecuencia
    ? prestamos.filter((p) => (p.frecuencia || 'diario') === frecuencia)
    : prestamos

  return (
    <div className="max-w-3xl lg:max-w-6xl mx-auto">
      {/* ── Cabecera de trabajo ──
          Antes de aquí había: título, subtítulo, botón dorado con texto, chip
          de Simulador, CUATRO filas de chips (estado, frecuencia, modo, ruta),
          un desplegable de rutas, "No me han pagado", "Filtros avanzados",
          buscador, "Agrupar" y un conmutador de vista. Más de mil píxeles antes
          del primer préstamo, en un teléfono de 844: se scrollea una pantalla
          entera para ver un solo préstamo.

          Y tres colores de chip compitiendo —dorado el estado, azul la
          frecuencia, morado el modo— cuando la regla es que lo único que brilla
          es la plata.

          Queda lo de todos los días: buscar y el estado. Lo demás vive en la
          hoja de "Más filtros", con su número puesto encima para que un filtro
          escondido no se convierta en un filtro olvidado. */}
      <div className="flex flex-col gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10 w-4 h-4 pointer-events-none"
              style={{ color: 'var(--cf-ink-3)' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              value={buscar}
              onChange={(e) => { setBuscar(e.target.value); setPage(1) }}
              placeholder="Buscar…"
              style={{
                width: '100%', height: 'var(--cf-h-field)', paddingLeft: 42, paddingRight: 14,
                borderRadius: 999, background: 'var(--cf-card)',
                border: '1px solid var(--cf-border)', outline: 'none',
                fontSize: 16, color: 'var(--cf-ink)',
              }}
            />
          </div>
          <BotonFiltros n={nFiltros} onClick={() => setHojaFiltros(true)} />
          {montado && puedeCrearPrestamos && (
            <Link href="/prestamos/nuevo" className="shrink-0" aria-label="Nuevo préstamo">
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 'var(--cf-h-field)', height: 'var(--cf-h-field)', borderRadius: 999,
                background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </Link>
          )}
        </div>

        {/* El estado se queda arriba porque es el que se toca todos los días.
            Con su conteo: sin el número hay que aplicar el filtro para saber si
            había algo detrás. */}
        <BarraFiltros
          activo={estado}
          onCambiar={(v) => { setEstado(v); setPage(1) }}
          // `montado &&`: esOwner sale de la sesión, que en el servidor no
          // existe. Sin esperar al montaje, el servidor pinta menos chips que
          // el cliente y React repinta el árbol entero.
          filtros={ESTADOS.filter((e) => !e.ownerOnly || (montado && esOwner)).map(({ value, label }) => ({
            id: value,
            nombre: label,
            conteo: loading ? undefined
              : value === estado ? total
              : value === 'mora' && conteoMoraExacto ? enMoraCount
              : undefined,
          }))}
        />
      </div>

      <HojaFiltros
        abierta={hojaFiltros}
        onCerrar={() => setHojaFiltros(false)}
        onLimpiar={limpiarFiltros}
        grupos={gruposFiltro}
      />

      {/* Offline indicator */}
      {isOffline && (
        <div className="bg-[var(--color-warning-dim)] border border-[color-mix(in_srgb,var(--color-warning)_30%,transparent)] text-[var(--color-warning)] text-xs rounded-[12px] px-4 py-2.5 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse shrink-0" />
          Datos guardados — sin conexión
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[var(--color-danger-dim)] border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)] text-[var(--color-danger)] text-sm rounded-[12px] px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Lista plana: orden cronologico puro (default) */}
      {!loading && prestamosVisibles.length > 0 && !agrupar && (
        <StaggeredList className={vistaP === 'compacta' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2' : 'flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3'}>
          {/* La MISMA tarjeta que un cliente: un prestamo en lista no estrena
              tarjeta. Inventar una segunda obligaria a aprender dos objetos que
              se leen igual y significan lo mismo — alguien que te debe.
              Lo unico propio es la linea de contexto: la cuota y cada cuanto,
              en vez de la direccion. */}
          {(() => {
            const adaptados = adaptarPrestamos(prestamosVisibles, country)
            return prestamosVisibles.map((p, i) => (
              vistaP === 'compacta' ? (
                <BadgeNuevo key={p.id} fecha={p.createdAt}>
                  <PrestamoCardCompacto prestamo={p} esNuevo={isHoy(p.createdAt, country)} />
                </BadgeNuevo>
              ) : (
                <TarjetaCliente
                  key={p.id}
                  {...adaptados[i]}
                  onClick={() => { window.location.href = `/prestamos/${p.id}` }}
                />
              )
            ))
          })()}
        </StaggeredList>
      )}

      {/* Lista agrupada por cliente: solo cuando el toggle esta activo */}
      {!loading && prestamosVisibles.length > 0 && agrupar && (() => {
        // Agrupa y reordena: cliente con prestamo mas nuevo arriba.
        const grupos = []
        const indice = new Map()
        for (const p of prestamosVisibles) {
          const key = p.clienteId
          if (!indice.has(key)) {
            indice.set(key, grupos.length)
            grupos.push({ cliente: p.cliente, prestamos: [], tieneNuevo: false, saldoTotal: 0, maxCreatedAt: 0 })
          }
          const g = grupos[indice.get(key)]
          g.prestamos.push(p)
          if (isHoy(p.createdAt, country)) g.tieneNuevo = true
          g.saldoTotal += p.saldoPendiente ?? 0
          const ts = new Date(p.createdAt).getTime()
          if (ts > g.maxCreatedAt) g.maxCreatedAt = ts
        }
        // Cliente cuyo prestamo mas nuevo es mas reciente, va primero.
        grupos.sort((a, b) => b.maxCreatedAt - a.maxCreatedAt)
        return (
          <div className="space-y-4">
            {grupos.map(({ cliente, prestamos: prestCliente, tieneNuevo, saldoTotal }) => {
              const tieneVarios = prestCliente.length > 1
              return (
                <div key={cliente.id}>
                  {tieneVarios && (
                    <div
                      className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg"
                      style={{ background: 'color-mix(in srgb, var(--color-text-primary) 4%, transparent)' }}
                    >
                      <span
                        className="text-[11px] font-extrabold uppercase tracking-[.07em] truncate"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {cliente.nombre}
                      </span>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap font-mono-display"
                        style={{
                          background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                          color: 'var(--color-accent)',
                        }}
                      >
                        {prestCliente.length}
                      </span>
                      {tieneNuevo && (
                        <span
                          className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-[.07em] px-1.5 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            background: 'color-mix(in srgb, var(--color-success) 14%, transparent)',
                            color: 'var(--color-success)',
                            border: '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)',
                          }}
                        >
                          <span className="w-1 h-1 rounded-full" style={{ background: 'var(--color-success)' }} />
                          Nuevo
                        </span>
                      )}
                      <span
                        className="ml-auto text-[10px] font-mono-display whitespace-nowrap"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {formatMoney(Math.round(saldoTotal), country)}
                      </span>
                    </div>
                  )}
                  <div
                    className={tieneVarios ? 'space-y-2.5 pl-2 ml-1 border-l' : 'space-y-2.5'}
                    style={tieneVarios ? { borderColor: 'color-mix(in srgb, var(--color-border) 60%, transparent)' } : undefined}
                  >
                    {prestCliente.map((p) => {
                      if (vistaP === 'compacta') {
                        return (
                          <BadgeNuevo key={p.id} fecha={p.createdAt}>
                            <PrestamoCardCompacto prestamo={p} esNuevo={isHoy(p.createdAt, country)} />
                          </BadgeNuevo>
                        )
                      }
                      const cardActions = []
                      if (p.cliente?.telefono) {
                        cardActions.push({
                          icon: IconWA,
                          label: 'WhatsApp',
                          color: '#25D366',
                          onClick: () => setWaContext({ cliente: p.cliente, prestamo: p }),
                        })
                      }
                      if (p.estado === 'activo') {
                        cardActions.push({
                          icon: IconPagar,
                          label: 'Registrar pago',
                          color: 'var(--color-success)',
                          onClick: () => { window.location.href = `/prestamos/${p.id}?openPago=1` },
                        })
                      }
                      return (
                        <BadgeNuevo key={p.id} fecha={p.createdAt}>
                          <PrestamoCard prestamo={p} actions={cardActions} esNuevo={isHoy(p.createdAt, country)} />
                        </BadgeNuevo>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Vacío con filtro de frecuencia activo (server o cliente no devolvió de esa frecuencia) */}
      {!loading && !error && frecuencia && prestamosVisibles.length === 0 && !buscar && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4">
            <MonedaCF pose="vacia" size={100} />
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            No hay préstamos {FRECUENCIAS.find((f) => f.value === frecuencia)?.label.toLowerCase()}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            <button onClick={() => setFrecuencia('')} className="text-[var(--color-info)] hover:underline">
              Ver toda frecuencia
            </button>
          </p>
        </div>
      )}

      {/* Estado vacío */}
      {!loading && !error && prestamosVisibles.length === 0 && !(frecuencia && !buscar) && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4">
            <MonedaCF pose={buscar ? 'busca' : 'vacia'} size={100} />
          </div>
          {buscar ? (
            <>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">Sin resultados</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">No hay préstamos para "{buscar}"</p>
              <button onClick={() => setBuscar('')} className="mt-3 text-xs text-[var(--color-accent)] hover:underline">
                Limpiar búsqueda
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {estado === 'activo' ? 'No hay préstamos activos' : estado === 'mora' ? 'No hay préstamos en mora' : 'Sin préstamos'}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {estado !== '' && (
                  <button onClick={() => setEstado('')} className="text-[var(--color-accent)] hover:underline">
                    Ver todos los estados
                  </button>
                )}
              </p>
              {!authLoading && puedeCrearPrestamos && (
                <Link href="/prestamos/nuevo" className="mt-4">
                  <Button size="sm">Crear préstamo</Button>
                </Link>
              )}
            </>
          )}
        </div>
      )}

      {/* Paginación */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <span className="text-xs text-[var(--color-text-muted)]">
            Página <span className="font-mono-display">{page}</span> de <span className="font-mono-display">{totalPages}</span>
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* Modal selector de plantillas WhatsApp (se abre desde swipe) */}
      <ModalWhatsAppTemplates
        open={!!waContext}
        onClose={() => setWaContext(null)}
        cliente={waContext?.cliente}
        prestamo={waContext?.prestamo}
        orgNombre={orgNombre}
        ocultarSaldo={ocultarSaldoWA}
        organizationId={organizationId}
      />
    </div>
  )
}
