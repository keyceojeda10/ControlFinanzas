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
import ModoInteresSelector                         from '@/components/prestamos/ModoInteresSelector'
import TablaAmortizacion                           from '@/components/prestamos/TablaAmortizacion'
import Stepper                                     from '@/components/ui/Stepper'
import DiasSinCobroSelector                        from '@/components/ui/DiasSinCobroSelector'
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
  // Mercancia: precio de venta total (lo que le deja la mercancia al cliente).
  // La ganancia = precioVenta - valor del articulo (monto). La cuota = precioVenta / numCuotas.
  const [precioVenta, setPrecioVenta] = useState('')
  // Mercancia: nombre del producto (gorra, reloj...) para dar referencia. Opcional.
  const [nombreProducto, setNombreProducto] = useState('')
  // Préstamo en curso (migración)
  const [esEnCurso, setEsEnCurso] = useState(false)
  const [yaAbonado, setYaAbonado] = useState('')
  // Cobro de seguro (opcional)
  const [seguro, setSeguro] = useState(false)
  const [avanzadasOpen, setAvanzadasOpen] = useState(false)
  const [montoSeguro, setMontoSeguro] = useState('')
  // Modo de interes: 'fijo' (clasico, default) | 'unico' | 'saldo' | 'manual'.
  const [modoInteres, setModoInteres] = useState('fijo')
  const cuotaManualActiva = modoInteres === 'manual'
  const [cuotaManual, setCuotaManual] = useState('')
  // Dias sin cobro especificos para este cliente (se actualizan en su ficha
  // al crear el prestamo). Permite que en frecuencia diaria se elijan dias
  // de la semana en que NO se cobra (ej. domingo).
  const [diasSinCobroCliente, setDiasSinCobroCliente] = useState([])
  const [diasSinCobroEditado, setDiasSinCobroEditado] = useState(false)

  // Wizard: 2 pasos. 0 = Cliente, 1 = Plan (con revision en vivo).
  const [paso, setPaso] = useState(0)
  const PASOS = [
    { label: 'Cliente' },
    { label: 'Plan del préstamo' },
  ]

  // Pre-llenar desde cartulina si venimos de importar
  useEffect(() => {
    if (!searchParams.get('fromCartulina')) return
    try {
      const raw = sessionStorage.getItem('cf-cartulina-prestamo')
      if (!raw) return
      const datos = JSON.parse(raw)
      if (datos.montoPrestado)  setMonto(String(datos.montoPrestado))
      if (datos.tasaInteres)    setTasa(String(datos.tasaInteres))
      if (datos.frecuencia && ['diario','semanal','quincenal','mensual'].includes(datos.frecuencia)) {
        setFrecuencia(datos.frecuencia)
        const dias = datos.diasPlazo || 0
        const porPeriodo = DIAS_POR_PERIODO[datos.frecuencia] || 1
        if (dias > 0) setPlazoUnidades(String(Math.round(dias / porPeriodo)))
      } else if (datos.diasPlazo) {
        setPlazoUnidades(String(datos.diasPlazo))
      }
      if (datos.fechaInicio)    setFechaInicio(datos.fechaInicio)
      if (datos.esEnCurso)      { setEsEnCurso(true); setAvanzadasOpen(true) }
      if (datos.yaAbonado)      setYaAbonado(String(datos.yaAbonado))
      // Limpiar después de consumir
      sessionStorage.removeItem('cf-cartulina-prestamo')
      // Avanzar directo al paso 2 si ya tenemos cliente
      if (datos.clienteId && clienteIdParam) setPaso(1)
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Cargar dias sin cobro actuales del cliente al seleccionarlo.
  useEffect(() => {
    if (!clienteId) { setDiasSinCobroCliente([]); setDiasSinCobroEditado(false); return }
    const c = clientes.find(x => x.id === clienteId)
    if (!c) return
    try {
      const arr = c.diasSinCobro ? JSON.parse(c.diasSinCobro) : []
      setDiasSinCobroCliente(Array.isArray(arr) ? arr : [])
      setDiasSinCobroEditado(false)
    } catch {
      setDiasSinCobroCliente([])
    }
  }, [clienteId, clientes])

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
    // En mercancia el cobrador pone el PRECIO DE VENTA total; la cuota sale de
    // repartirlo en numCuotas y la ganancia = precioVenta - valor del articulo.
    // Internamente se trata como manual (cuota fija) para no tocar el resto del
    // sistema. En modo prestamo manual la cuota la fija el cobrador directo.
    let cm = 0
    if (modo === 'mercancia') {
      const pv = Number(precioVenta)
      const nc = Number(numCuotas)
      cm = pv > 0 && nc > 0 ? Math.round(pv / nc) : 0
    } else if (cuotaManualActiva) {
      cm = Number(cuotaManual)
    }
    return calcularPrestamo({
      montoPrestado: m,
      tasaInteres: t,
      diasPlazo: p,
      fechaInicio,
      frecuencia,
      modoInteres: modo === 'mercancia' ? 'manual' : modoInteres,
      ...(cm > 0 && { cuotaManual: cm }),
    })
  }, [monto, tasa, plazo, fechaInicio, frecuencia, modo, modoInteres, cuotaManualActiva, cuotaManual, precioVenta, numCuotas])

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
        ...(calculo?.cuotaDiaria > 0 && (cuotaManualActiva || modo === 'mercancia') && { cuotaManual: calculo.cuotaDiaria }),
        modoInteres: modo === 'mercancia' ? 'manual' : modoInteres,
        ...(modo === 'mercancia' && nombreProducto.trim() && { nombreProducto: nombreProducto.trim() }),
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
    if (paso === 1) {
      if (modo === 'mercancia' && !(Number(precioVenta) > Number(monto))) return false
      if (clienteSeleccionado?.montoMaximoPrestamo > 0 && Number(monto) > clienteSeleccionado.montoMaximoPrestamo) return false
      return Number(monto) > 0 && Number(plazoUnidades) > 0 && !!fechaInicio && !!calculo
    }
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
      ...(calculo?.cuotaDiaria > 0 && (cuotaManualActiva || modo === 'mercancia') && { cuotaManual: calculo.cuotaDiaria }),
      modoInteres: modo === 'mercancia' ? 'manual' : modoInteres,
      ...(modo === 'mercancia' && nombreProducto.trim() && { nombreProducto: nombreProducto.trim() }),
      ...(seguro && Number(montoSeguro) > 0 && { seguro: true, montoSeguro: Number(montoSeguro) }),
    }

    // Offline: encolar sin intentar fetch (evita esperar timeout)
    // Volvemos a /prestamos (que ya está cacheado) en vez de al detalle por
    // tempId — esa URL no está en cache del SW y mostraría "Sin conexion".
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await guardarPrestamoPendiente(payloadOffline)
        try { sessionStorage.setItem('cf-toast', 'Préstamo guardado. Se sincronizará al volver online.') } catch {}
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
      // Si el usuario edito los dias sin cobro del cliente desde aqui,
      // sincronizar la ficha del cliente.
      if (diasSinCobroEditado) {
        try {
          await fetch(`/api/clientes/${clienteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ diasSinCobro: diasSinCobroCliente }),
          })
        } catch {}
      }
      router.push(`/prestamos/${data.id}`)
    } catch {
      if (!navigator.onLine) {
        try {
          await guardarPrestamoPendiente(payloadOffline)
          try { sessionStorage.setItem('cf-toast', 'Préstamo guardado. Se sincronizará al volver online.') } catch {}
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
      {paso === 0 && (() => {
        const buscando = buscadorCliente.trim().length > 0
        const clienteSeleccionado = clientes.find(c => c.id === clienteId)
        // Recientes: los 3 ultimos creados (asumimos que `clientes` viene en
        // orden segun el API; tomamos los primeros 3 como aproximacion de "recientes").
        const recientes = clientes.slice(0, 3)

        const renderClienteRow = (c, mostrarCheck = true) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setClienteId(c.id)
              setClienteNombre(c.nombre)
              setBuscadorCliente('')
            }}
            className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-[12px] border transition-all"
            style={{
              background: c.id === clienteId
                ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
                : 'var(--color-bg-surface)',
              borderColor: c.id === clienteId
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
            {mostrarCheck && c.id === clienteId && (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" style={{ color: 'var(--color-accent)' }}>
                <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-7.997 8a1 1 0 01-1.414 0L3.296 10.71a1 1 0 011.415-1.415l3.29 3.29 7.288-7.295a1 1 0 011.415 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        )

        return (
          <section className="mt-8">
            <h2 className="text-[22px] font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              {clienteSeleccionado ? '¿Continuamos con este cliente?' : 'Elige el cliente'}
            </h2>
            <p className="text-sm mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
              {clienteSeleccionado
                ? 'Si necesitas cambiarlo, usa el buscador.'
                : 'Busca por nombre o cédula, o elige uno de los recientes.'}
            </p>

            {/* Cliente ya seleccionado: card grande en lugar de fila pequena */}
            {clienteSeleccionado && !buscando && (
              <div
                className="mt-7 rounded-[16px] p-4 flex items-center gap-3"
                style={{
                  background: 'color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-card))',
                  border: '1.5px solid var(--color-accent)',
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-base font-bold"
                  style={{
                    background: 'color-mix(in srgb, var(--color-accent) 22%, transparent)',
                    color: 'var(--color-accent)',
                  }}
                >
                  {clienteSeleccionado.nombre?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {clienteSeleccionado.nombre}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    CC {clienteSeleccionado.cedula}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setClienteId(''); setClienteNombre('') }}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-[8px] transition-colors"
                  style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-surface)' }}
                >
                  Cambiar
                </button>
              </div>
            )}

            {clienteSeleccionado?.montoMaximoPrestamo > 0 && (
              <div
                className="mt-3 rounded-[12px] px-3.5 py-2.5 flex items-center gap-2.5"
                style={{ background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)' }}
              >
                <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--color-warning)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Tope de prestamo</p>
                  <p className="text-sm font-bold font-mono-display" style={{ color: 'var(--color-warning)' }}>
                    {formatMoney(clienteSeleccionado.montoMaximoPrestamo)}
                  </p>
                </div>
              </div>
            )}

            {/* Buscador */}
            <div className="mt-7">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-4 h-4 pointer-events-none"
                  style={{ color: 'var(--color-text-muted)' }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  value={buscadorCliente}
                  onChange={(e) => setBuscadorCliente(e.target.value)}
                  placeholder="Buscar por nombre o cédula"
                  className="w-full h-12 pl-10 pr-4 rounded-[12px] border text-sm focus:outline-none transition-colors"
                  style={{
                    background: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>
            </div>

            {/* RESULTADOS: solo si esta buscando */}
            {buscando && (
              <div className="mt-3 space-y-1.5">
                {clientesFiltrados.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                    Sin resultados. Prueba con otro nombre.
                  </p>
                ) : (
                  clientesFiltrados.slice(0, 8).map((c) => renderClienteRow(c))
                )}
              </div>
            )}

            {/* RECIENTES: solo si NO esta buscando y no hay cliente seleccionado (o hay uno pero queremos mostrar opciones rapidas) */}
            {!buscando && !clienteSeleccionado && recientes.length > 0 && (
              <div className="mt-5">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Recientes
                </p>
                <div className="space-y-1.5">
                  {recientes.map((c) => renderClienteRow(c, false))}
                </div>
              </div>
            )}

            {!buscando && !clienteSeleccionado && recientes.length === 0 && (
              <p className="text-sm text-center py-8 mt-3" style={{ color: 'var(--color-text-muted)' }}>
                No tienes clientes aún. Crea uno antes de continuar.
              </p>
            )}
          </section>
        )
      })()}

      {/* PASO 2 — Plan del prestamo (todo en una sola pantalla, con revision en vivo abajo) */}
      {paso === 1 && (
        <section className="mt-8 space-y-7">
          <div>
            <h2 className="text-[22px] font-bold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              Plan del préstamo
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
                Préstamo
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
                Mercancía
              </button>
            </div>
          </div>

          {/* Monto + chips rapidos */}
          <div className="space-y-4">
            {/* Mercancia: nombre del producto (referencia). Opcional. */}
            {modo === 'mercancia' && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Nombre del producto <span style={{ opacity: 0.6 }}>(opcional)</span>
                </label>
                <div className="mt-1.5">
                  <Input
                    type="text"
                    value={nombreProducto}
                    onChange={(e) => setNombreProducto(e.target.value)}
                    placeholder="Ej: Gorra, Reloj Casio, Camisa..."
                    maxLength={100}
                  />
                </div>
                <p className="text-[10px] mt-1 leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                  Para saber a que mercancía hace referencia.
                </p>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                {modo === 'mercancia' ? 'Valor del artículo' : 'Monto del préstamo'}
              </label>
              <div className="mt-1.5">
                <MoneyInput value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
              </div>
              {/* Chips rapidos */}
              <div className="flex gap-1.5 flex-wrap mt-2">
                {[50000, 100000, 200000, 500000, 1000000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMonto(String(v))}
                    className="px-2.5 h-7 rounded-[8px] text-[11px] font-medium transition-all"
                    style={String(monto) === String(v)
                      ? { background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid var(--color-accent)', color: 'var(--color-accent)' }
                      : { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }
                    }
                  >
                    {v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}k`}
                  </button>
                ))}
              </div>
              {clienteSeleccionado?.montoMaximoPrestamo > 0 && Number(monto) > clienteSeleccionado.montoMaximoPrestamo && (
                <p className="text-xs mt-2 font-semibold" style={{ color: 'var(--color-danger)' }}>
                  Supera el tope de {formatMoney(clienteSeleccionado.montoMaximoPrestamo)} para este cliente
                </p>
              )}
            </div>

            {modo === 'prestamo' ? (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Interés que cobras (% mensual)
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  value={tasa}
                  onChange={(e) => setTasa(e.target.value)}
                  placeholder="20"
                  suffix="%"
                />
              </div>
            ) : (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Número de cuotas
                </label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={numCuotas}
                  onChange={(e) => setNumCuotas(e.target.value)}
                  placeholder="10"
                  suffix="cuotas"
                />
              </div>
            )}

            {/* Mercancia: precio de venta total. La cuota = precioVenta / numCuotas
                y la ganancia = precioVenta - valor del articulo. */}
            {modo === 'mercancia' && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Precio de venta
                </label>
                <div className="mt-1.5">
                  <MoneyInput value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} placeholder="Ej: 120.000" />
                </div>
                <p className="text-[10px] mt-1 leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                  A cuanto le dejas la mercancía al cliente. Tu ganancia = precio de venta − valor del artículo.
                </p>
                {/* Vista previa en vivo: cuota + ganancia calculadas */}
                {Number(precioVenta) > 0 && Number(numCuotas) > 0 && Number(monto) > 0 && (
                  <div
                    className="mt-2 rounded-[10px] border px-3 py-2 flex items-center justify-between gap-3"
                    style={{ background: 'color-mix(in srgb, var(--color-success) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--color-success) 30%, transparent)' }}
                  >
                    <div>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Cuota</p>
                      <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        {formatMoney(Math.round(Number(precioVenta) / Number(numCuotas)))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Ganancia</p>
                      <p className="text-sm font-bold" style={{ color: 'var(--color-success)' }}>
                        {formatMoney(Number(precioVenta) - Number(monto))}
                        {Number(monto) > 0 ? ` (${Math.round(((Number(precioVenta) - Number(monto)) / Number(monto)) * 100)}%)` : ''}
                      </p>
                    </div>
                  </div>
                )}
                {Number(precioVenta) > 0 && Number(precioVenta) <= Number(monto) && (
                  <p className="text-[10px] mt-1.5 font-semibold" style={{ color: 'var(--color-danger)' }}>
                    El precio de venta debe ser mayor al valor del artículo para que haya ganancia.
                  </p>
                )}
              </div>
            )}

            {/* Frecuencia de cobro — visible SIEMPRE cuando no es diario,
                o dentro de "Opciones avanzadas" */}

            {/* Personalizar préstamo: modo interés, frecuencia, día ancla, días sin cobro, seguro, en curso.
                Antes era un link gris "Opciones avanzadas" que los usuarios evitaban por miedo.
                Ahora es una tarjeta visible que invita a abrirla y explica qué hay dentro. */}
            <button
              type="button"
              onClick={() => setAvanzadasOpen(v => !v)}
              className="w-full flex items-center gap-3 rounded-[14px] px-4 py-3 transition-all active:scale-[0.99] focus-visible:outline-none"
              style={{
                background: avanzadasOpen ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)' : 'color-mix(in srgb, var(--color-accent) 6%, transparent)',
                border: `1.5px solid color-mix(in srgb, var(--color-accent) ${avanzadasOpen ? 55 : 35}%, transparent)`,
              }}
            >
              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ background: 'color-mix(in srgb, var(--color-accent) 18%, transparent)', color: 'var(--color-accent)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                </svg>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    Personalizar préstamo
                  </span>
                  {(!avanzadasOpen && (frecuencia !== 'diario' || modoInteres !== 'fijo' || seguro || esEnCurso)) && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: 'var(--color-accent)', color: '#0a0a0a' }}>
                      activas
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                  Frecuencia de cobro, tipo de interés, seguro y más
                </p>
              </div>
              <svg
                className="w-5 h-5 shrink-0 transition-transform duration-200"
                style={{ transform: avanzadasOpen ? 'rotate(90deg)' : 'rotate(0deg)', color: 'var(--color-accent)' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {avanzadasOpen && (
            <div className="space-y-4">

            {/* Modo de interes: Fijo / Unico / Sobre saldo / Manual */}
            {modo === 'prestamo' && (
              <ModoInteresSelector
                modoInteres={modoInteres}
                onChange={(m) => {
                  setModoInteres(m)
                  if (m !== 'manual') setCuotaManual('')
                  else if (calculo?.cuotaDiaria) setCuotaManual(String(calculo.cuotaDiaria))
                }}
                calculo={calculo}
                monto={monto}
                tasa={tasa}
                frecuencia={frecuencia}
                diasPlazo={plazo}
              />
            )}

            {/* Cuota manual — solo en modo manual */}
            {modo === 'prestamo' && cuotaManualActiva && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Cuota exacta
                </label>
                <div className="mt-1.5">
                  <MoneyInput value={cuotaManual} onChange={(e) => setCuotaManual(e.target.value)} placeholder="Ej: 60.000" />
                </div>
                <p className="text-[10px] mt-1 leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                  Tu defines la cuota. El total = cuota x número de cobros.
                </p>
              </div>
            )}

            {/* Frecuencia de cobro */}
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
                  ¿Qué día cobras?
                </label>
                <p className="text-[10px] mt-0.5 mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  Fija el día de la semana en que siempre cobras. "Auto" usa el día de la fecha de inicio.
                </p>
                <div className="grid grid-cols-7 gap-1">
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
                  Día del mes para cobro (opcional)
                </label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={diaCobroMes}
                  onChange={(e) => setDiaCobroMes(e.target.value)}
                  placeholder="Auto (según fecha de inicio)"
                />
              </div>
            )}

            {/* Dias sin cobro — disponible para todas las frecuencias.
                Para diario es util porque permite excluir, p.ej., domingos.
                Los cambios se guardan en la ficha del cliente al crear el prestamo. */}
            {clienteId && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  Días sin cobro (opcional)
                </label>
                <p className="text-[10px] mt-0.5 mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Marca los días en que NO se cobra. Se guarda en la ficha del cliente.
                </p>
                <DiasSinCobroSelector
                  value={diasSinCobroCliente}
                  onChange={(arr) => { setDiasSinCobroCliente(arr); setDiasSinCobroEditado(true) }}
                  compact
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
          )}

          {/* Opciones adicionales: seguro, prestamo en curso, cuota manual */}
          {avanzadasOpen && <div className="space-y-3 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide pt-3" style={{ color: 'var(--color-text-muted)' }}>
              Opciones adicionales
            </p>

            {/* Seguro */}
            <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[10px] border cursor-pointer"
              style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Cobrar seguro</p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Suma un cargo fijo al préstamo</p>
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
                  <MoneyInput value={montoSeguro} onChange={(e) => setMontoSeguro(e.target.value)} placeholder="0" />
                </div>
              </div>
            )}

            {/* Prestamo en curso */}
            <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[10px] border cursor-pointer"
              style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>El cliente ya había pagado algo antes</p>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Migrar un préstamo con abonos previos</p>
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
                  <MoneyInput value={yaAbonado} onChange={(e) => setYaAbonado(e.target.value)} placeholder="0" />
                </div>
              </div>
            )}

            </div>}

          </div>

          {/* Revision EN VIVO — resumen completo del prestamo mientras edita */}
          {calculo && (() => {
            // Nombres completos de dias para que NO se confunda con "MAR" o "JUE".
            const DIAS_FULL_PLURAL = ['domingos', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabados']
            const DIAS_FULL_SINGULAR = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

            // Calcular cuantos cobros totales tendra el prestamo segun frecuencia + dias sin cobro.
            const diasPlazo = Number(plazo)
            const diasPorPeriodo = DIAS_POR_PERIODO[frecuencia] || 1
            const periodos = Math.max(1, Math.round(diasPlazo / diasPorPeriodo))
            // En frecuencia diaria, descontar los dias sin cobro de la semana.
            let cobrosTotales = periodos
            if (frecuencia === 'diario' && diasSinCobroCliente.length > 0) {
              const cobrosPorSemana = 7 - diasSinCobroCliente.length
              const semanas = diasPlazo / 7
              cobrosTotales = Math.max(1, Math.round(cobrosPorSemana * semanas))
            }

            // Etiqueta de frecuencia descriptiva con nombres COMPLETOS de dias.
            const diaSemanaFullPlural = diaCobroSemana !== '' ? DIAS_FULL_PLURAL[Number(diaCobroSemana)] : null
            const labelFrecuencia = frecuencia === 'diario'
              ? `Diaria · ${cobrosTotales} cobros en ${diasPlazo} dias`
              : frecuencia === 'semanal'
                ? `Semanal · ${periodos} cobros${diaSemanaFullPlural ? ' los ' + diaSemanaFullPlural : ''}`
                : frecuencia === 'quincenal'
                  ? `Quincenal · ${periodos} cobros${diaSemanaFullPlural ? ' los ' + diaSemanaFullPlural : ''}`
                  : `Mensual · ${periodos} cobros${diaCobroMes ? ' el día ' + diaCobroMes + ' de cada mes' : ''}`

            const totalConSeguro = calculo.totalAPagar + (seguro && Number(montoSeguro) > 0 ? Number(montoSeguro) : 0)
            const ganancia = calculo.totalAPagar - Number(monto || 0)
            const pctGanancia = Number(monto) > 0 ? Math.round((ganancia / Number(monto)) * 100) : 0
            const saldoInicial = esEnCurso && Number(yaAbonado) > 0
              ? Math.max(0, calculo.totalAPagar - Number(yaAbonado))
              : null

            // Formula breve para modo Automatica — ayuda al usuario a entender de
            // donde sale la cuota cuando no le cuadra y se cambia a Manual.
            const mesesPlazo = (diasPlazo / 30).toFixed(diasPlazo % 30 === 0 ? 0 : 1)
            const formulaAuto = !cuotaManualActiva && modo === 'prestamo'
              ? `Total = monto + (monto × ${tasa || 0}% × ${mesesPlazo} meses). Cuota = total ÷ ${cobrosTotales} cobros.`
              : null

            const Row = ({ label, value, valueColor }) => (
              <div className="flex items-center justify-between gap-3 py-1.5 border-b last:border-b-0"
                style={{ borderColor: 'color-mix(in srgb, var(--color-border) 50%, transparent)' }}
              >
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                <span className="text-xs font-semibold text-right" style={{ color: valueColor || 'var(--color-text-primary)' }}>
                  {value}
                </span>
              </div>
            )

            return (
              <div
                className="rounded-[16px] p-4"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-success) 8%, var(--color-bg-card)), var(--color-bg-card))',
                  border: '1px solid color-mix(in srgb, var(--color-success) 25%, var(--color-border))',
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--color-success)' }}>
                  Resumen del préstamo
                </p>

                {/* Highlights grandes: cuota y total */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Cuota {frecuencia === 'diario' ? 'diaria' : frecuencia === 'semanal' ? 'semanal' : frecuencia === 'quincenal' ? 'quincenal' : 'mensual'}</p>
                    <p className="text-lg font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>{formatMoney(calculo.cuotaDiaria)}</p>
                  </div>
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Total a pagar</p>
                    <p className="text-lg font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>{formatMoney(totalConSeguro)}</p>
                  </div>
                </div>

                {/* Detalles tipo lista — mas legible que grid de 2 columnas */}
                <div className="space-y-0">
                  {modo === 'mercancia' && nombreProducto.trim() && (
                    <Row label="Producto" value={nombreProducto.trim()} />
                  )}
                  <Row label={modo === 'mercancia' ? 'Valor del artículo' : 'Monto prestado'} value={formatMoney(Number(monto || 0))} />
                  {modo === 'mercancia' && Number(precioVenta) > 0 && (
                    <Row label="Precio de venta" value={formatMoney(Number(precioVenta))} valueColor="var(--color-accent)" />
                  )}
                  {modo === 'prestamo' && (
                    <Row
                      label="Interés"
                      value={`${tasa || 0}% mensual`}
                      valueColor="var(--color-accent)"
                    />
                  )}
                  <Row label="Frecuencia" value={labelFrecuencia} />
                  <Row label="Cobros totales" value={`${cobrosTotales}`} />
                  <Row label="Fecha fin" value={calculo.fechaFin ? new Date(calculo.fechaFin).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
                  <Row
                    label="Ganancia"
                    value={`${formatMoney(ganancia)} (${pctGanancia}%)`}
                    valueColor="var(--color-success)"
                  />
                  <Row label={modo === 'mercancia' ? 'Tipo' : 'Modo de interés'} value={modo === 'mercancia' ? 'Mercancia' : ({ fijo: 'Fijo (clasico)', unico: 'Interés unico', saldo: 'Sobre saldo', manual: 'Manual', lineal: 'Cuota decreciente' }[modoInteres] || 'Fijo (clasico)')} />
                  {diasSinCobroCliente.length > 0 && (
                    <Row
                      label="Días sin cobro"
                      value={diasSinCobroCliente
                        .sort((a, b) => a - b)
                        .map(n => DIAS_FULL_SINGULAR[n].charAt(0).toUpperCase() + DIAS_FULL_SINGULAR[n].slice(1))
                        .join(', ')}
                    />
                  )}
                  {seguro && Number(montoSeguro) > 0 && (
                    <Row
                      label="Seguro incluido"
                      value={formatMoney(Number(montoSeguro))}
                      valueColor="#6366f1"
                    />
                  )}
                  {esEnCurso && Number(yaAbonado) > 0 && (
                    <>
                      <Row
                        label="Abono previo"
                        value={formatMoney(Number(yaAbonado))}
                        valueColor="var(--color-success)"
                      />
                      <Row
                        label="Saldo pendiente"
                        value={formatMoney(saldoInicial)}
                        valueColor="var(--color-accent)"
                      />
                    </>
                  )}
                </div>

                {modoInteres === 'lineal' && calculo?.tablaAmortizacion?.length > 0 && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'color-mix(in srgb, var(--color-border) 50%, transparent)' }}>
                    <TablaAmortizacion tabla={calculo.tablaAmortizacion} frecuencia={frecuencia} />
                  </div>
                )}

                {/* Formula breve: ayuda al usuario a entender de donde sale el
                    calculo automatico. Si no le cuadra, sabe que debe cambiar a Manual. */}
                {formulaAuto && (
                  <div
                    className="mt-3 pt-3 border-t flex gap-2 items-start"
                    style={{ borderColor: 'color-mix(in srgb, var(--color-border) 50%, transparent)' }}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--color-text-muted)' }}>
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        Como se calcula
                      </p>
                      <p className="text-[10px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                        {formulaAuto} Si no te cuadra, cambia a <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>Manual</span> y define la cuota exacta.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </section>
      )}

      {/* Barra sticky de resumen en vivo — solo en el paso Plan, sobre el footer.
          El prestamista ajusta arriba y ve cuota/total aca sin tener que scrollear. */}
      {paso === 1 && calculo && (
        <div
          className="fixed left-0 right-0 lg:left-60 z-[44] px-4 lg:px-6"
          style={{ bottom: 'calc(68px + env(safe-area-inset-bottom))' }}
        >
          <div
            className="max-w-2xl mx-auto rounded-t-[14px] px-4 py-3 flex items-center justify-between gap-4"
            style={{
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-success) 12%, var(--color-bg-card)), var(--color-bg-card))',
              border: '1px solid color-mix(in srgb, var(--color-success) 30%, var(--color-border))',
              borderBottom: 'none',
              boxShadow: '0 -2px 10px rgba(0,0,0,0.2)',
            }}
          >
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                {frecuencia === 'diario' ? 'Cuota diaria' : frecuencia === 'semanal' ? 'Cuota semanal' : frecuencia === 'quincenal' ? 'Cuota quincenal' : 'Cuota mensual'}
              </p>
              <p className="text-lg font-bold font-mono-display leading-tight truncate" style={{ color: 'var(--color-success)' }}>
                {formatMoney(calculo.cuotaDiaria)}
              </p>
            </div>
            <div className="text-right min-w-0">
              <p className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Total a pagar</p>
              <p className="text-base font-bold font-mono-display leading-tight truncate" style={{ color: 'var(--color-text-primary)' }}>
                {formatMoney(calculo.totalAPagar)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer fijo abajo */}
      <div
        className="fixed left-0 right-0 lg:left-60 bottom-0 z-[45] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] lg:px-6 lg:pb-6"
        style={{
          background: 'var(--color-bg-base)',
          borderTop: '1px solid var(--color-border)',
          boxShadow: '0 -4px 12px rgba(0,0,0,0.25)',
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {paso === 0 ? (
            <Button type="button" variant="secondary" onClick={() => router.back()} disabled={loading} className="flex-1">
              Cancelar
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={irAlPasoAnterior} disabled={loading} className="flex-1">
              Atrás
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
              Crear préstamo
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
              Tu saldo actual de capital es <span className="font-mono-display text-[var(--color-accent)]">{formatMoney(modalInyeccion.saldoActual)}</span>. Te faltan <span className="font-mono-display text-[var(--color-danger)]">{formatMoney(modalInyeccion.faltante)}</span> para este préstamo.
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mb-4">
              Puedes inyectar ese dinero ahora (por ejemplo, de tus ahorros o de un socio) y el sistema crea el préstamo. La inyección queda registrada en tus movimientos de capital.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Monto a inyectar</label>
                <MoneyInput
                  value={modalInyeccion.montoInyeccion}
                  onChange={(e) => setModalInyeccion(m => ({ ...m, montoInyeccion: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Descripción (opcional)</label>
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

