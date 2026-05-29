'use client'
// app/(dashboard)/prestamos/nuevo/page.jsx - Formulario de nuevo préstamo

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams }              from 'next/navigation'
import { useAuth }                                 from '@/hooks/useAuth'
import { Button }                                  from '@/components/ui/Button'
import { Input }                                   from '@/components/ui/Input'
import MoneyInput                                  from '@/components/ui/MoneyInput'
import { calcularPrestamo } from '@/lib/calculos'
import { formatMoney } from '@/lib/i18n'
import ResumenCalculo                              from '@/components/prestamos/ResumenCalculo'
import Stepper                                     from '@/components/ui/Stepper'
import { guardarPrestamoPendiente, obtenerClientesOffline } from '@/lib/offline'

const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoyISO = () => getColombiaDate().toISOString().slice(0, 10)

const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

// Card de seccion premium (definida fuera para evitar perdida de focus)
const SectionCard = ({ icon, title, color = 'var(--color-accent)', children, accent }) => (
  <div
    className="rounded-[16px] p-4"
    style={{
      background: `linear-gradient(135deg, color-mix(in srgb, ${color} 6%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)`,
      border: '1px solid var(--color-border)',
    }}
  >
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-[6px] flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
        >
          <span className="w-3.5 h-3.5">{icon}</span>
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>
          {title}
        </p>
      </div>
      {accent}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
)

// Wrapper con Suspense requerido por useSearchParams en Next.js build
export default function NuevoPrestamoPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-40">
        <svg className="animate-spin w-6 h-6 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    }>
      <NuevoPrestamo />
    </Suspense>
  )
}

function NuevoPrestamo() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { puedeCrearPrestamos, loading: authLoading } = useAuth()

  const clienteIdParam = searchParams.get('clienteId') ?? ''

  const [clienteId,    setClienteId]    = useState(clienteIdParam)
  const [clientes,     setClientes]     = useState([])
  const [clienteNombre, setClienteNombre] = useState('')
  const [monto,        setMonto]        = useState('')
  const [tasa,         setTasa]         = useState('20')
  // plazo se ingresa en la unidad de la frecuencia (dias, semanas, quincenas o meses)
  const [plazoUnidades, setPlazoUnidades] = useState('30')
  const [frecuencia,   setFrecuencia]   = useState('diario')
  // Dia ancla opcional: fija el dia de cobro sin importar cuando empieza el prestamo
  // - semanal/quincenal: 0=dom..6=sab (string '' = sin ancla)
  // - mensual: 1..31 (string '' = sin ancla)
  const [diaCobroSemana, setDiaCobroSemana] = useState('')
  const [diaCobroMes, setDiaCobroMes]       = useState('')
  // Dias totales derivados de plazoUnidades × diasPorPeriodo
  const plazo = String((Number(plazoUnidades) || 0) * (DIAS_POR_PERIODO[frecuencia] || 1))
  const [fechaInicio,  setFechaInicio]  = useState(hoyISO())
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [buscadorCliente, setBuscadorCliente] = useState('')
  const [modalInyeccion, setModalInyeccion] = useState(null) // { faltante, saldoActual, montoInyeccion, descripcion }
  const [inyectando, setInyectando] = useState(false)

  // Modo: 'prestamo' (con interés) o 'mercancia' (cuota fija)
  const [modo, setModo] = useState('prestamo')
  const [numCuotas, setNumCuotas] = useState('10')
  // Préstamo en curso (migración)
  const [esEnCurso, setEsEnCurso] = useState(false)
  const [yaAbonado, setYaAbonado] = useState('')
  // Cobro de seguro (opcional)
  const [seguro, setSeguro] = useState(false)
  const [montoSeguro, setMontoSeguro] = useState('')
  // Cuota personalizada (sobrescribe la cuota calculada por el sistema)
  const [cuotaManualActiva, setCuotaManualActiva] = useState(false)
  const [cuotaManual, setCuotaManual] = useState('')
  // Redondeo: 'exacto' ($100), 'redondeado' ($500) o 'cerrado' ($1.000)
  const [redondeo, setRedondeo] = useState('exacto')

  // Wizard: 2 pasos. 0 = Cliente, 1 = Plan (con revision en vivo).
  const [paso, setPaso] = useState(0)
  const PASOS = [
    { label: 'Cliente' },
    { label: 'Plan del prestamo' },
  ]

  // Ultimo prestamo del cliente para "Repetir condiciones".
  const [ultimoPrestamo, setUltimoPrestamo] = useState(null)
  useEffect(() => {
    if (!clienteId) { setUltimoPrestamo(null); return }
    let cancelado = false
    fetch(`/api/prestamos/ultimo-cliente?clienteId=${encodeURIComponent(clienteId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelado) setUltimoPrestamo(d?.ultimo || null) })
      .catch(() => {})
    return () => { cancelado = true }
  }, [clienteId])

  const repetirCondicionesUltimo = () => {
    if (!ultimoPrestamo) return
    const u = ultimoPrestamo
    setMonto(String(Math.round(u.montoPrestado)))
    setTasa(String(u.tasaInteres))
    setFrecuencia(u.frecuencia || 'diario')
    const diasPorPer = DIAS_POR_PERIODO[u.frecuencia] || 1
    setPlazoUnidades(String(Math.max(1, Math.round((u.diasPlazo || 0) / diasPorPer))))
    if (u.diaCobroSemana != null) setDiaCobroSemana(String(u.diaCobroSemana))
    if (u.diaCobroMes != null) setDiaCobroMes(String(u.diaCobroMes))
  }

  // Guard de permiso
  useEffect(() => {
    if (!authLoading && !puedeCrearPrestamos) router.replace('/prestamos')
  }, [authLoading, puedeCrearPrestamos, router])

  // Cargar clientes para el selector — online + offline (cache/pendientes)
  useEffect(() => {
    const cargar = async () => {
      let lista = []
      if (navigator.onLine) {
        try {
          const r = await fetch('/api/clientes')
          const d = await r.json()
          lista = Array.isArray(d) ? d : []
        } catch {}
      }
      if (lista.length === 0) {
        // Fallback: leer cache offline (incluye pendientes inyectados optimistamente)
        try { lista = await obtenerClientesOffline() } catch {}
      }
      setClientes(lista)
      if (clienteIdParam) {
        const c = lista.find((x) => x.id === clienteIdParam)
        if (c) setClienteNombre(c.nombre)
      }
    }
    cargar()
  }, [clienteIdParam])

  // Default plazo por frecuencia (en unidades de esa frecuencia)
  const defaultPlazoPorFrecuencia = (freq) => {
    if (freq === 'diario')    return '30'  // 30 dias
    if (freq === 'semanal')   return '8'   // 8 semanas
    if (freq === 'quincenal') return '4'   // 4 quincenas
    if (freq === 'mensual')   return '2'   // 2 meses
    return '30'
  }

  // Cuando cambia el modo, ajustar defaults
  const handleModoChange = (nuevoModo) => {
    setModo(nuevoModo)
    if (nuevoModo === 'mercancia') {
      setTasa('0')
      setNumCuotas('10')
      setPlazoUnidades('10')
    } else {
      setTasa('20')
      setPlazoUnidades(defaultPlazoPorFrecuencia(frecuencia))
    }
  }

  // Cuando cambia frecuencia en modo prestamo, resetear plazo al default de esa frecuencia
  const handleFrecuenciaChange = (nuevaFreq) => {
    setFrecuencia(nuevaFreq)
    if (modo === 'prestamo') {
      setPlazoUnidades(defaultPlazoPorFrecuencia(nuevaFreq))
    }
  }

  // En modo mercancia, numCuotas y plazoUnidades son lo mismo
  useEffect(() => {
    if (modo === 'mercancia') {
      setPlazoUnidades(numCuotas)
    }
  }, [numCuotas, modo])

  // Cálculo en tiempo real
  const calculo = useMemo(() => {
    const m = Number(monto)
    const t = Number(tasa)
    const p = Number(plazo)
    if (!m || (tasa === '' || tasa == null) || !p || !fechaInicio) return null
    const cm = cuotaManualActiva ? Number(cuotaManual) : 0
    return calcularPrestamo({
      montoPrestado: m,
      tasaInteres: t,
      diasPlazo: p,
      fechaInicio,
      frecuencia,
      redondeo,
      ...(cm > 0 && { cuotaManual: cm }),
    })
  }, [monto, tasa, plazo, fechaInicio, frecuencia, cuotaManualActiva, cuotaManual, redondeo])

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(buscadorCliente.toLowerCase()) ||
    c.cedula.includes(buscadorCliente)
  )

  const crearPrestamoRequest = async (inyeccionPrevia = null) => {
    const res = await fetch('/api/prestamos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId,
        montoPrestado: Number(monto),
        tasaInteres: Number(tasa),
        diasPlazo: Number(plazo),
        fechaInicio,
        frecuencia,
        ...((frecuencia === 'semanal' || frecuencia === 'quincenal') && diaCobroSemana !== '' && { diaCobroSemana: Number(diaCobroSemana) }),
        ...(frecuencia === 'mensual' && diaCobroMes !== '' && { diaCobroMes: Number(diaCobroMes) }),
        ...(esEnCurso && Number(yaAbonado) > 0 && { yaAbonado: Number(yaAbonado) }),
        ...(cuotaManualActiva && Number(cuotaManual) > 0 && { cuotaManual: Number(cuotaManual) }),
        redondeo,
        ...(inyeccionPrevia && { inyeccionPrevia }),
        ...(seguro && Number(montoSeguro) > 0 && { seguro: true, montoSeguro: Number(montoSeguro) }),
      }),
    })
    const data = await res.json()
    return { ok: res.ok, data }
  }

  // Validacion del paso actual antes de avanzar.
  const puedeAvanzarPaso = () => {
    if (paso === 0) return !!clienteId
    if (paso === 1) return Number(monto) > 0 && Number(plazoUnidades) > 0 && !!fechaInicio && !!calculo
    return true
  }
  const irAlSiguientePaso = () => {
    if (!puedeAvanzarPaso()) return
    setPaso(p => Math.min(PASOS.length - 1, p + 1))
  }
  const irAlPasoAnterior = () => setPaso(p => Math.max(0, p - 1))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clienteId)  { setError('Selecciona un cliente'); return }
    if (!monto)      { setError('Ingresa el monto'); return }
    if (!calculo)    { setError('Verifica los datos del préstamo'); return }
    if (esEnCurso && Number(yaAbonado) > calculo.totalAPagar) {
      setError('El abono no puede ser mayor al total a pagar'); return
    }

    setLoading(true)
    setError('')

    const payloadOffline = {
      clienteId,
      montoPrestado: Number(monto),
      tasaInteres: Number(tasa),
      diasPlazo: Number(plazo),
      fechaInicio,
      frecuencia,
      ...((frecuencia === 'semanal' || frecuencia === 'quincenal') && diaCobroSemana !== '' && { diaCobroSemana: Number(diaCobroSemana) }),
      ...(frecuencia === 'mensual' && diaCobroMes !== '' && { diaCobroMes: Number(diaCobroMes) }),
      ...(esEnCurso && Number(yaAbonado) > 0 && { yaAbonado: Number(yaAbonado) }),
      ...(cuotaManualActiva && Number(cuotaManual) > 0 && { cuotaManual: Number(cuotaManual) }),
      ...(seguro && Number(montoSeguro) > 0 && { seguro: true, montoSeguro: Number(montoSeguro) }),
    }

    // Offline: encolar sin intentar fetch (evita esperar timeout)
    // Volvemos a /prestamos (que ya está cacheado) en vez de al detalle por
    // tempId — esa URL no está en cache del SW y mostraría "Sin conexion".
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await guardarPrestamoPendiente(payloadOffline)
        try { sessionStorage.setItem('cf-toast', 'Prestamo guardado. Se sincronizara al volver online.') } catch {}
        router.push('/prestamos')
        return
      } catch {
        setError('No se pudo guardar offline.')
        setLoading(false)
        return
      }
    }

    try {
      const { ok, data } = await crearPrestamoRequest()
      if (!ok) {
        if (data?.capitalInsuficiente) {
          setModalInyeccion({
            faltante: Number(data.faltante) || 0,
            saldoActual: Number(data.saldoActual) || 0,
            montoInyeccion: String(Number(data.faltante) || 0),
            descripcion: '',
          })
          return
        }
        setError(data?.error ?? 'Error al crear el préstamo')
        return
      }
      router.push(`/prestamos/${data.id}`)
    } catch {
      if (!navigator.onLine) {
        try {
          await guardarPrestamoPendiente(payloadOffline)
          try { sessionStorage.setItem('cf-toast', 'Prestamo guardado. Se sincronizara al volver online.') } catch {}
          router.push('/prestamos')
          return
        } catch {}
      }
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const confirmarInyeccionYCrear = async () => {
    if (!modalInyeccion) return
    const monto = Number(modalInyeccion.montoInyeccion)
    if (!Number.isFinite(monto) || monto <= 0) {
      setError('El monto de la inyección debe ser mayor a 0')
      return
    }
    setInyectando(true)
    setError('')
    try {
      const { ok, data } = await crearPrestamoRequest({
        monto,
        descripcion: modalInyeccion.descripcion?.trim() || null,
      })
      if (!ok) {
        setError(data?.error ?? 'Error al crear el préstamo con inyección')
        return
      }
      setModalInyeccion(null)
      router.push(`/prestamos/${data.id}`)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setInyectando(false)
    }
  }

  if (authLoading) return null
  if (!puedeCrearPrestamos) return null

  // ── Helpers de UI ─────────────────────────────────────────────
  const FRECUENCIAS = [
    { key: 'diario',    label: 'Diario' },
    { key: 'semanal',   label: 'Semanal' },
    { key: 'quincenal', label: 'Quincenal' },
    { key: 'mensual',   label: 'Mensual' },
  ]

  const DIAS_SEMANA = [
    { v: '1', l: 'Lun' }, { v: '2', l: 'Mar' }, { v: '3', l: 'Mie' },
    { v: '4', l: 'Jue' }, { v: '5', l: 'Vie' }, { v: '6', l: 'Sab' }, { v: '0', l: 'Dom' },
  ]

  const completedIndices = paso > 0 ? [0] : []

  return (
    <div className="max-w-2xl mx-auto pb-44 lg:pb-36">
      {/* Stepper */}
      <Stepper
        steps={PASOS}
        activeIndex={paso}
        completedIndices={completedIndices}
        onChange={(idx) => { if (idx <= paso) setPaso(idx) }}
      />

      {error && (
        <div className="mt-6 rounded-[12px] px-4 py-3 text-sm"
          style={{ background: 'var(--color-danger-dim)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}
        >
          {error}
        </div>
      )}

      {/* PASO 1 — Cliente */}
      {paso === 0 && (
        <section className="mt-8">
          <h2 className="text-[22px] font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
            {clienteId ? '¿Para quien es este prestamo?' : 'Elige el cliente'}
          </h2>
          <p className="text-sm mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
            Busca por nombre o cedula. Si ya seleccionaste uno, puedes cambiarlo abajo.
          </p>

          <div className="mt-7">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: 'var(--color-text-muted)' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={buscadorCliente}
                onChange={(e) => setBuscadorCliente(e.target.value)}
                placeholder="Buscar por nombre o cedula"
                className="w-full h-12 pl-10 pr-4 rounded-[12px] border text-sm focus:outline-none transition-colors"
                style={{
                  background: 'var(--color-bg-surface)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
                autoFocus
              />
            </div>

            {/* Lista de resultados — UNA sola lista, sin duplicar el seleccionado */}
            <div className="mt-3 space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {clientesFiltrados.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                  {buscadorCliente ? 'Sin resultados. Prueba con otro nombre.' : 'No tienes clientes aun.'}
                </p>
              )}
              {clientesFiltrados.slice(0, 50).map((c) => {
                const seleccionado = c.id === clienteId
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setClienteId(c.id)
                      setClienteNombre(c.nombre)
                    }}
                    className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-[12px] border transition-all"
                    style={{
                      background: seleccionado
                        ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
                        : 'var(--color-bg-surface)',
                      borderColor: seleccionado
                        ? 'var(--color-accent)'
                        : 'var(--color-border)',
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                      style={{
                        background: 'color-mix(in srgb, var(--color-accent) 18%, transparent)',
                        color: 'var(--color-accent)',
                      }}
                    >
                      {c.nombre?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>{c.nombre}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>CC {c.cedula}</p>
                    </div>
                    {seleccionado && (
                      <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" style={{ color: 'var(--color-accent)' }}>
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-7.997 8a1 1 0 01-1.414 0L3.296 10.71a1 1 0 011.415-1.415l3.29 3.29 7.288-7.295a1 1 0 011.415 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* PASO 2 — Plan del prestamo (todo en una sola pantalla, con revision en vivo abajo) */}
      {paso === 1 && (
        <section className="mt-8 space-y-7">
          <div>
            <h2 className="text-[22px] font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              Plan del prestamo
            </h2>
            <p className="text-sm mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
              Cliente: <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{clienteNombre || 'sin nombre'}</span>
              {ultimoPrestamo && (
                <button
                  type="button"
                  onClick={repetirCondicionesUltimo}
                  className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
                    color: 'var(--color-accent)',
                  }}
                >
                  ↻ Repetir condiciones del anterior
                </button>
              )}
            </p>
          </div>

          {/* Tipo: prestamo vs mercancia */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--color-text-muted)' }}>Tipo</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleModoChange('prestamo')}
                className="h-11 rounded-[12px] border text-sm font-semibold transition-all"
                style={modo === 'prestamo'
                  ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }
                  : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }
                }
              >
                Prestamo
              </button>
              <button
                type="button"
                onClick={() => handleModoChange('mercancia')}
                className="h-11 rounded-[12px] border text-sm font-semibold transition-all"
                style={modo === 'mercancia'
                  ? { background: 'color-mix(in srgb, var(--color-info) 12%, transparent)', borderColor: 'var(--color-info)', color: 'var(--color-info)' }
                  : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }
                }
              >
                Mercancia
              </button>
            </div>
          </div>

          {/* Monto + tasa */}
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                Monto del prestamo
              </label>
              <div className="mt-1.5">
                <MoneyInput value={monto} onChange={(v) => setMonto(v)} placeholder="0" />
              </div>
            </div>

            {modo === 'prestamo' ? (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Tasa de interes (% mensual)
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={tasa}
                  onChange={(e) => setTasa(e.target.value)}
                  placeholder="20"
                />
              </div>
            ) : (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Numero de cuotas
                </label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={numCuotas}
                  onChange={(e) => setNumCuotas(e.target.value)}
                  placeholder="10"
                />
              </div>
            )}
          </div>

          {/* Frecuencia + plazo */}
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                Frecuencia de cobro
              </label>
              <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                {FRECUENCIAS.map(f => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => handleFrecuenciaChange(f.key)}
                    className="h-10 rounded-[10px] border text-xs font-semibold transition-all"
                    style={frecuencia === f.key
                      ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }
                      : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }
                    }
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                Plazo ({frecuencia === 'diario' ? 'dias' : frecuencia === 'semanal' ? 'semanas' : frecuencia === 'quincenal' ? 'quincenas' : 'meses'})
              </label>
              <Input
                type="number"
                inputMode="numeric"
                value={plazoUnidades}
                onChange={(e) => setPlazoUnidades(e.target.value)}
              />
            </div>

            {/* Dia ancla solo para semanal/quincenal */}
            {(frecuencia === 'semanal' || frecuencia === 'quincenal') && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Dia de cobro (opcional)
                </label>
                <div className="grid grid-cols-7 gap-1 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setDiaCobroSemana('')}
                    className="h-9 rounded-[8px] border text-[10px] font-semibold transition-all"
                    style={diaCobroSemana === ''
                      ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }
                      : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }
                    }
                  >
                    Auto
                  </button>
                  {DIAS_SEMANA.slice(0, 6).map(d => (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => setDiaCobroSemana(d.v)}
                      className="h-9 rounded-[8px] border text-[10px] font-semibold transition-all"
                      style={diaCobroSemana === d.v
                        ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }
                        : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }
                      }
                    >
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dia ancla solo para mensual */}
            {frecuencia === 'mensual' && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Dia del mes para cobro (opcional)
                </label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={diaCobroMes}
                  onChange={(e) => setDiaCobroMes(e.target.value)}
                  placeholder="Auto (segun fecha de inicio)"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                Fecha de inicio
              </label>
              <Input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                max={hoyISO()}
              />
            </div>
          </div>

          {/* Opciones adicionales: seguro, prestamo en curso, cuota manual */}
          <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide pt-3" style={{ color: 'var(--color-text-muted)' }}>
              Opciones adicionales
            </p>

            {/* Seguro */}
            <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[10px] border cursor-pointer"
              style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Cobrar seguro</p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Suma un cargo fijo al prestamo</p>
              </div>
              <input
                type="checkbox"
                checked={seguro}
                onChange={(e) => setSeguro(e.target.checked)}
                className="w-5 h-5 accent-[var(--color-accent)]"
              />
            </label>
            {seguro && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Monto del seguro
                </label>
                <div className="mt-1.5">
                  <MoneyInput value={montoSeguro} onChange={(v) => setMontoSeguro(v)} placeholder="0" />
                </div>
              </div>
            )}

            {/* Prestamo en curso */}
            <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[10px] border cursor-pointer"
              style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Prestamo en curso</p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Migrar un prestamo con abonos previos</p>
              </div>
              <input
                type="checkbox"
                checked={esEnCurso}
                onChange={(e) => setEsEnCurso(e.target.checked)}
                className="w-5 h-5 accent-[var(--color-accent)]"
              />
            </label>
            {esEnCurso && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Monto ya abonado
                </label>
                <div className="mt-1.5">
                  <MoneyInput value={yaAbonado} onChange={(v) => setYaAbonado(v)} placeholder="0" />
                </div>
              </div>
            )}

            {/* Cuota manual */}
            <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[10px] border cursor-pointer"
              style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Cuota personalizada</p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Sobrescribe la cuota calculada</p>
              </div>
              <input
                type="checkbox"
                checked={cuotaManualActiva}
                onChange={(e) => setCuotaManualActiva(e.target.checked)}
                className="w-5 h-5 accent-[var(--color-accent)]"
              />
            </label>
            {cuotaManualActiva && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Cuota exacta
                </label>
                <div className="mt-1.5">
                  <MoneyInput value={cuotaManual} onChange={(v) => setCuotaManual(v)} placeholder="0" />
                </div>
              </div>
            )}
          </div>

          {/* Revision EN VIVO — siempre visible mientras edita */}
          {calculo && (
            <div
              className="rounded-[16px] p-4 space-y-2"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-success) 8%, var(--color-bg-card)), var(--color-bg-card))',
                border: '1px solid color-mix(in srgb, var(--color-success) 25%, var(--color-border))',
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-success)' }}>
                Revision en vivo
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <div>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Cuota</p>
                  <p className="text-base font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>{formatMoney(calculo.cuotaDiaria)}</p>
                </div>
                <div>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Total a pagar</p>
                  <p className="text-base font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>{formatMoney(calculo.totalAPagar)}</p>
                </div>
                <div>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Ganancia</p>
                  <p className="text-base font-bold font-mono-display" style={{ color: 'var(--color-success)' }}>
                    {formatMoney(calculo.totalAPagar - Number(monto || 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Fecha fin</p>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    {calculo.fechaFin ? new Date(calculo.fechaFin).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </p>
                </div>
              </div>
              {seguro && Number(montoSeguro) > 0 && (
                <p className="text-[11px] pt-2 border-t mt-2" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>
                  Incluye seguro de <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatMoney(Number(montoSeguro))}</span>
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* Footer fijo abajo */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 px-4 py-3 lg:px-6 lg:pb-6 pb-[calc(env(safe-area-inset-bottom)+12px)]"
        style={{
          background: 'linear-gradient(to top, var(--color-bg-base) 60%, transparent)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {paso === 0 ? (
            <Button type="button" variant="secondary" onClick={() => router.back()} disabled={loading} className="flex-1">
              Cancelar
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={irAlPasoAnterior} disabled={loading} className="flex-1">
              Atras
            </Button>
          )}
          {paso < PASOS.length - 1 ? (
            <Button
              type="button"
              onClick={irAlSiguientePaso}
              disabled={!puedeAvanzarPaso()}
              className="flex-[2]"
            >
              Continuar
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              loading={loading}
              disabled={!puedeAvanzarPaso()}
              className="flex-[2]"
            >
              Crear prestamo
            </Button>
          )}
        </div>
      </div>

      {/* Modal de inyeccion de capital (sin cambios) */}
      {modalInyeccion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[16px] w-full max-w-md p-5">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">Capital insuficiente</h3>
            <p className="text-sm text-[var(--color-text-primary)] mb-3">
              Tu saldo actual de capital es <span className="font-mono-display text-[var(--color-accent)]">{formatMoney(modalInyeccion.saldoActual)}</span>. Te faltan <span className="font-mono-display text-[var(--color-danger)]">{formatMoney(modalInyeccion.faltante)}</span> para este prestamo.
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">
              Puedes inyectar ese dinero ahora (por ejemplo, de tus ahorros o de un socio) y el sistema crea el prestamo. La inyeccion queda registrada en tus movimientos de capital.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Monto a inyectar</label>
                <MoneyInput
                  value={modalInyeccion.montoInyeccion}
                  onChange={(v) => setModalInyeccion(m => ({ ...m, montoInyeccion: v }))}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Descripcion (opcional)</label>
                <Input
                  type="text"
                  value={modalInyeccion.descripcion}
                  onChange={(e) => setModalInyeccion(m => ({ ...m, descripcion: e.target.value }))}
                  placeholder="Ej: ahorros personales, aporte socio..."
                />
              </div>
            </div>

            {error && (
              <div className="mt-3 text-sm text-[var(--color-danger)]">{error}</div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => { setModalInyeccion(null); setError('') }}
                disabled={inyectando}
                className="flex-1 px-4 py-2 bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] text-sm font-semibold rounded-[10px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarInyeccionYCrear}
                disabled={inyectando}
                className="flex-1 px-4 py-2 bg-[var(--color-success)] text-[#0a1f14] text-sm font-semibold rounded-[10px] disabled:opacity-50"
              >
                {inyectando ? 'Procesando...' : 'Inyectar y crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

