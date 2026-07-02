'use client'
// app/(dashboard)/prestamos/nuevo/page.jsx - Formulario de nuevo préstamo

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react'
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

function EditableRow({ label, value, pencil, editor, valueColor }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="py-2 border-b" style={{ borderColor: 'color-mix(in srgb, var(--color-border) 50%, transparent)' }}>
      {editing ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
            <button type="button" onClick={() => setEditing(false)} className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ color: 'var(--color-success)', background: 'color-mix(in srgb, var(--color-success) 12%, transparent)' }}>OK</button>
          </div>
          {editor}
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="flex justify-between items-center w-full text-left group">
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
          <span className="flex items-center gap-1.5">
            <span className="font-semibold text-sm" style={{ color: valueColor || 'var(--color-text-primary)' }}>{value}</span>
            <span className="opacity-40 group-hover:opacity-100 transition-opacity">{pencil}</span>
          </span>
        </button>
      )}
    </div>
  )
}

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
  const [modoDiaCobro, setModoDiaCobro]     = useState('semana') // 'semana' | 'mes'
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

  // Firma digital del cliente (capturada en paso 2)
  const [firmaBase64, setFirmaBase64] = useState(null)
  const [firmaStrokes, setFirmaStrokes] = useState(false)
  const firmaCanvasRef = useRef(null)
  const firmaDrawing = useRef(false)
  const firmaLastPt = useRef(null)

  const setupFirmaCanvas = useCallback(() => {
    const canvas = firmaCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#111111'
  }, [])

  const firmaGetPoint = (e) => {
    const canvas = firmaCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0]
    return {
      x: (touch?.clientX ?? e.clientX) - rect.left,
      y: (touch?.clientY ?? e.clientY) - rect.top,
    }
  }
  const firmaStart = (e) => { e.preventDefault(); firmaDrawing.current = true; firmaLastPt.current = firmaGetPoint(e) }
  const firmaDraw = (e) => {
    if (!firmaDrawing.current) return
    e.preventDefault()
    const ctx = firmaCanvasRef.current?.getContext('2d')
    if (!ctx) return
    const pt = firmaGetPoint(e)
    ctx.beginPath()
    ctx.moveTo(firmaLastPt.current.x, firmaLastPt.current.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    firmaLastPt.current = pt
    if (!firmaStrokes) setFirmaStrokes(true)
  }
  const firmaEnd = () => { firmaDrawing.current = false; firmaLastPt.current = null }
  const firmaLimpiar = () => {
    const canvas = firmaCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setFirmaStrokes(false)
    setFirmaBase64(null)
  }

  // Wizard: 3 pasos. 0 = Cliente, 1 = Plan (sub-pasos internos), 2 = Confirmar y firma.
  const [paso, setPaso] = useState(0)
  const [subPaso, setSubPaso] = useState(0) // sub-paso dentro del paso 1

  // Sub-pasos del wizard de datos (paso 1)
  const SUB_PASOS_LABELS = ['Monto', 'Cobro', 'Plazo', 'Tipo', 'Extras']
  const TOTAL_SUB_PASOS = modo === 'mercancia' ? 3 : 5

  const PASOS = [
    { label: 'Cliente' },
    { label: SUB_PASOS_LABELS[subPaso] || 'Datos' },
    { label: 'Confirmar' },
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
      if (datos.esEnCurso)      setEsEnCurso(true)
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
      if (clienteIdParam) {
        const c = lista.find((x) => x.id === clienteIdParam)
        if (c) {
          setClienteNombre(c.nombre)
        } else if (navigator.onLine) {
          try {
            const r2 = await fetch(`/api/clientes/${clienteIdParam}`)
            if (r2.ok) {
              const cl = await r2.json()
              if (cl?.id) {
                const mini = { id: cl.id, nombre: cl.nombre, cedula: cl.cedula, telefono: cl.telefono, rutaId: cl.rutaId, montoMaximoPrestamo: cl.montoMaximoPrestamo ?? 0 }
                lista = [mini, ...lista]
                setClienteNombre(cl.nombre)
              }
            }
          } catch {}
        }
      }
      setClientes(lista)
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
    setDiaCobroSemana('')
    setDiaCobroMes('')
    setModoDiaCobro(nuevaFreq === 'mensual' ? 'mes' : 'semana')
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
        ...((frecuencia === 'semanal' || ((frecuencia === 'quincenal' || frecuencia === 'mensual') && modoDiaCobro === 'semana')) && diaCobroSemana !== '' && { diaCobroSemana: Number(diaCobroSemana) }),
        ...((frecuencia !== 'diario' && frecuencia !== 'semanal' && modoDiaCobro === 'mes') && diaCobroMes !== '' && { diaCobroMes: Number(diaCobroMes) }),
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

  const clienteSeleccionado = clientes.find(c => c.id === clienteId) ?? null

  const puedeAvanzarSubPaso = () => {
    if (subPaso === 0) {
      if (modo === 'mercancia') return Number(monto) > 0 && Number(precioVenta) > Number(monto) && Number(numCuotas) > 0
      return Number(monto) > 0
    }
    if (subPaso === 1) return true
    if (subPaso === 2) {
      if (modo === 'mercancia') return true
      return Number(tasa) >= 0 && Number(plazoUnidades) > 0
    }
    return true
  }

  const puedeAvanzarPaso = () => {
    if (paso === 0) return !!clienteId
    if (paso === 1) {
      if (clienteSeleccionado?.montoMaximoPrestamo > 0 && Number(monto) > clienteSeleccionado.montoMaximoPrestamo) return false
      return Number(monto) > 0 && Number(plazoUnidades) > 0 && !!fechaInicio && !!calculo
    }
    if (paso === 2) return !!calculo
    return true
  }
  const irAlSiguientePaso = () => {
    if (paso === 1 && subPaso < TOTAL_SUB_PASOS - 1) {
      if (!puedeAvanzarSubPaso()) return
      setSubPaso(s => s + 1)
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    if (!puedeAvanzarPaso()) return
    setPaso(p => Math.min(PASOS.length - 1, p + 1))
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const irAlPasoAnterior = () => {
    if (paso === 1 && subPaso > 0) {
      setSubPaso(s => s - 1)
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    setPaso(p => Math.max(0, p - 1))
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  useEffect(() => {
    if (paso === 2) setTimeout(setupFirmaCanvas, 80)
  }, [paso, setupFirmaCanvas])

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
      // Subir firma si el cliente firmo en el canvas
      const firmaData = firmaStrokes ? firmaCanvasRef.current?.toDataURL('image/png') : null
      if (firmaData && data.id) {
        try {
          await fetch(`/api/prestamos/${data.id}/firma`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firma: firmaData }),
          })
        } catch {}
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

      {/* PASO 2 — Wizard guiado con sub-pasos */}
      {paso === 1 && (
        <section className="mt-8 space-y-6">
          {/* Barra de progreso del sub-paso */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {clienteNombre || 'Cliente'}
              </p>
              {ultimoPrestamo && subPaso === 0 && (
                <button
                  type="button"
                  onClick={() => { repetirCondicionesUltimo(); setSubPaso(TOTAL_SUB_PASOS - 1) }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent)' }}
                >
                  Repetir anterior
                </button>
              )}
            </div>
            <div className="flex gap-1">
              {Array.from({ length: TOTAL_SUB_PASOS }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { if (i < subPaso) setSubPaso(i) }}
                  className="h-1 rounded-full flex-1 transition-all"
                  style={{
                    background: i <= subPaso ? 'var(--color-accent)' : 'var(--color-border)',
                    cursor: i < subPaso ? 'pointer' : 'default',
                  }}
                />
              ))}
            </div>
            <p className="text-[10px] mt-1 text-right" style={{ color: 'var(--color-text-muted)' }}>
              Paso {subPaso + 1} de {TOTAL_SUB_PASOS}
            </p>
          </div>

          {/* SUB-PASO 0: Tipo + Monto */}
          {subPaso === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  {modo === 'mercancia' ? 'Cuanto vale el articulo?' : 'Cuanto le prestas?'}
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  {modo === 'mercancia' ? 'El valor real de la mercancia.' : 'El dinero que le entregas al cliente.'}
                </p>
              </div>

              {/* Tipo toggle */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => handleModoChange('prestamo')}
                  className="h-11 rounded-xl border text-sm font-semibold transition-all"
                  style={modo === 'prestamo'
                    ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }
                    : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                >Prestamo</button>
                <button type="button" onClick={() => handleModoChange('mercancia')}
                  className="h-11 rounded-xl border text-sm font-semibold transition-all"
                  style={modo === 'mercancia'
                    ? { background: 'color-mix(in srgb, var(--color-info) 12%, transparent)', borderColor: 'var(--color-info)', color: 'var(--color-info)' }
                    : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                >Mercancia</button>
              </div>

              {modo === 'mercancia' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                    Nombre del producto <span style={{ opacity: 0.6 }}>(opcional)</span>
                  </label>
                  <div className="mt-1.5">
                    <Input type="text" value={nombreProducto} onChange={(e) => setNombreProducto(e.target.value)} placeholder="Ej: Gorra, Reloj Casio..." maxLength={100} />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  {modo === 'mercancia' ? 'Valor del articulo' : 'Monto del prestamo'}
                </label>
                <div className="mt-1.5">
                  <MoneyInput value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" />
                </div>
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {[50000, 100000, 200000, 500000, 1000000].map((v) => (
                    <button key={v} type="button" onClick={() => setMonto(String(v))}
                      className="px-2.5 h-7 rounded-lg text-[11px] font-medium transition-all"
                      style={String(monto) === String(v)
                        ? { background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', border: '1px solid var(--color-accent)', color: 'var(--color-accent)' }
                        : { background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
                    >{v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}k`}</button>
                  ))}
                </div>
                {clienteSeleccionado?.montoMaximoPrestamo > 0 && Number(monto) > clienteSeleccionado.montoMaximoPrestamo && (
                  <p className="text-xs mt-2 font-semibold" style={{ color: 'var(--color-danger)' }}>
                    Supera el tope de {formatMoney(clienteSeleccionado.montoMaximoPrestamo)}
                  </p>
                )}
              </div>

              {modo === 'mercancia' && (
                <>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Numero de cuotas</label>
                    <Input type="number" inputMode="numeric" value={numCuotas} onChange={(e) => setNumCuotas(e.target.value)} placeholder="10" suffix="cuotas" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Precio de venta</label>
                    <div className="mt-1.5"><MoneyInput value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} placeholder="Ej: 120.000" /></div>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Tu ganancia = precio de venta - valor del articulo.</p>
                    {Number(precioVenta) > 0 && Number(numCuotas) > 0 && Number(monto) > 0 && (
                      <div className="mt-2 rounded-xl border px-3 py-2 flex items-center justify-between gap-3"
                        style={{ background: 'color-mix(in srgb, var(--color-success) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--color-success) 30%, transparent)' }}>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Cuota</p>
                          <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{formatMoney(Math.round(Number(precioVenta) / Number(numCuotas)))}</p>
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
                      <p className="text-[10px] mt-1.5 font-semibold" style={{ color: 'var(--color-danger)' }}>El precio de venta debe ser mayor al valor del articulo.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* SUB-PASO 1: Frecuencia de cobro */}
          {subPaso === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Cada cuanto cobra?</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Elige la frecuencia con que el cliente paga las cuotas.</p>
              </div>

              <div className="space-y-2">
                {FRECUENCIAS.map(f => {
                  const activo = frecuencia === f.key
                  const descs = { diario: 'Cobra todos los dias habiles', semanal: 'Cobra una vez por semana', quincenal: 'Cobra cada dos semanas', mensual: 'Cobra una vez al mes' }
                  return (
                    <button key={f.key} type="button" onClick={() => handleFrecuenciaChange(f.key)}
                      className="w-full text-left rounded-xl p-4 transition-all"
                      style={{
                        background: activo ? 'color-mix(in srgb, var(--color-accent) 8%, transparent)' : 'var(--color-bg-surface)',
                        border: activo ? '1.5px solid var(--color-accent)' : '1px solid var(--color-border)',
                      }}>
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
                          style={{ borderColor: activo ? 'var(--color-accent)' : 'var(--color-border)' }}>
                          {activo && <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent)' }} />}
                        </div>
                        <div>
                          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{f.label}</span>
                          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{descs[f.key]}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Dia ancla para semanal */}
              {frecuencia === 'semanal' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Que dia cobras?</label>
                  <p className="text-[10px] mt-0.5 mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Fija el dia de la semana. "Auto" usa el dia de inicio.</p>
                  <div className="grid grid-cols-7 gap-1">
                    <button type="button" onClick={() => setDiaCobroSemana('')}
                      className="h-9 rounded-lg border text-[10px] font-semibold transition-all"
                      style={diaCobroSemana === '' ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' } : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>Auto</button>
                    {DIAS_SEMANA.slice(0, 6).map(d => (
                      <button key={d.v} type="button" onClick={() => setDiaCobroSemana(d.v)}
                        className="h-9 rounded-lg border text-[10px] font-semibold transition-all"
                        style={diaCobroSemana === d.v ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' } : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{d.l}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dia ancla para quincenal */}
              {frecuencia === 'quincenal' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Que dia cobras?</label>
                  <div className="flex gap-1 p-1 rounded-[10px] mb-2 mt-1.5" style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>
                    <button type="button" onClick={() => { setModoDiaCobro('semana'); setDiaCobroMes('') }}
                      className="flex-1 py-1.5 text-[10px] font-semibold rounded-[8px] transition-all"
                      style={modoDiaCobro === 'semana' ? { background: 'var(--color-bg-card)', color: 'var(--color-accent)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } : { color: 'var(--color-text-muted)' }}>Dia de la semana</button>
                    <button type="button" onClick={() => { setModoDiaCobro('mes'); setDiaCobroSemana('') }}
                      className="flex-1 py-1.5 text-[10px] font-semibold rounded-[8px] transition-all"
                      style={modoDiaCobro === 'mes' ? { background: 'var(--color-bg-card)', color: 'var(--color-accent)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } : { color: 'var(--color-text-muted)' }}>Dia del mes</button>
                  </div>
                  {modoDiaCobro === 'semana' ? (
                    <div className="grid grid-cols-7 gap-1">
                      <button type="button" onClick={() => setDiaCobroSemana('')}
                        className="h-9 rounded-lg border text-[10px] font-semibold transition-all"
                        style={diaCobroSemana === '' ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' } : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>Auto</button>
                      {DIAS_SEMANA.slice(0, 6).map(d => (
                        <button key={d.v} type="button" onClick={() => setDiaCobroSemana(d.v)}
                          className="h-9 rounded-lg border text-[10px] font-semibold transition-all"
                          style={diaCobroSemana === d.v ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' } : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{d.l}</button>
                      ))}
                    </div>
                  ) : (
                    <Input type="number" inputMode="numeric" value={diaCobroMes}
                      onChange={(e) => { const v = e.target.value; if (v === '' || (Number(v) >= 1 && Number(v) <= 31)) setDiaCobroMes(v) }}
                      placeholder="Auto (segun fecha de inicio)" min={1} max={31} />
                  )}
                </div>
              )}

              {/* Dia ancla para mensual */}
              {frecuencia === 'mensual' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Que dia cobras?</label>
                  <div className="flex gap-1 p-1 rounded-[10px] mb-2 mt-1.5" style={{ background: 'var(--color-bg-hover)', border: '1px solid var(--color-border)' }}>
                    <button type="button" onClick={() => { setModoDiaCobro('semana'); setDiaCobroMes('') }}
                      className="flex-1 py-1.5 text-[10px] font-semibold rounded-[8px] transition-all"
                      style={modoDiaCobro === 'semana' ? { background: 'var(--color-bg-card)', color: 'var(--color-accent)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } : { color: 'var(--color-text-muted)' }}>Dia de la semana</button>
                    <button type="button" onClick={() => { setModoDiaCobro('mes'); setDiaCobroSemana('') }}
                      className="flex-1 py-1.5 text-[10px] font-semibold rounded-[8px] transition-all"
                      style={modoDiaCobro === 'mes' ? { background: 'var(--color-bg-card)', color: 'var(--color-accent)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } : { color: 'var(--color-text-muted)' }}>Dia del mes</button>
                  </div>
                  {modoDiaCobro === 'semana' ? (
                    <div className="grid grid-cols-7 gap-1">
                      <button type="button" onClick={() => setDiaCobroSemana('')}
                        className="h-9 rounded-lg border text-[10px] font-semibold transition-all"
                        style={diaCobroSemana === '' ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' } : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>Auto</button>
                      {DIAS_SEMANA.slice(0, 6).map(d => (
                        <button key={d.v} type="button" onClick={() => setDiaCobroSemana(d.v)}
                          className="h-9 rounded-lg border text-[10px] font-semibold transition-all"
                          style={diaCobroSemana === d.v ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' } : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>{d.l}</button>
                      ))}
                    </div>
                  ) : (
                    <Input type="number" inputMode="numeric" value={diaCobroMes}
                      onChange={(e) => { const v = e.target.value; if (v === '' || (Number(v) >= 1 && Number(v) <= 31)) setDiaCobroMes(v) }}
                      placeholder="Auto (segun fecha de inicio)" min={1} max={31} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* SUB-PASO 2: Interes + Plazo */}
          {subPaso === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Cuanto de interes?</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Define la tasa y en cuanto tiempo paga.</p>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Interes mensual</label>
                <Input type="number" inputMode="decimal" step="0.5" min="0" value={tasa} onChange={(e) => setTasa(e.target.value)} placeholder="20" suffix="%" />
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {[5, 10, 15, 20, 25, 30].map(v => (
                    <button key={v} type="button" onClick={() => setTasa(String(v))}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                      style={String(v) === tasa
                        ? { background: 'var(--color-accent)', color: '#000' }
                        : { background: 'var(--color-bg-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }
                      }
                    >{v}%</button>
                  ))}
                </div>
                {Number(monto) > 0 && Number(tasa) > 0 && (
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                    Al {tasa}% sobre {formatMoney(Number(monto))} = {formatMoney(Math.round(Number(monto) * Number(tasa) / 100))} de interes por mes
                  </p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                  En cuanto tiempo paga? ({frecuencia === 'diario' ? 'dias' : frecuencia === 'semanal' ? 'semanas' : frecuencia === 'quincenal' ? 'quincenas' : 'meses'})
                </label>
                <Input type="number" inputMode="numeric" value={plazoUnidades} onChange={(e) => setPlazoUnidades(e.target.value)} />
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {(frecuencia === 'diario' ? [15, 20, 25, 30, 45, 60]
                    : frecuencia === 'semanal' ? [4, 6, 8, 10, 12, 16]
                    : frecuencia === 'quincenal' ? [2, 3, 4, 6, 8, 12]
                    : [1, 2, 3, 4, 6, 12]
                  ).map(v => (
                    <button key={v} type="button" onClick={() => setPlazoUnidades(String(v))}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                      style={String(v) === plazoUnidades
                        ? { background: 'var(--color-accent)', color: '#000' }
                        : { background: 'var(--color-bg-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }
                      }
                    >{v}</button>
                  ))}
                </div>
                {frecuencia !== 'diario' && plazoUnidades && (
                  <p className="text-[10px] mt-1 px-0.5" style={{ color: 'var(--color-text-muted)' }}>= {plazo} dias</p>
                )}
              </div>

              {/* Preview del interes mensual (sin cuota/total — eso depende del modo de interes que se elige en el paso siguiente) */}
              {Number(monto) > 0 && Number(tasa) > 0 && Number(plazoUnidades) > 0 && (
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'color-mix(in srgb, var(--color-accent) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--color-accent) 15%, transparent)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {formatMoney(Number(monto))} al {tasa}% por {plazoUnidades} {frecuencia === 'diario' ? 'dias' : frecuencia === 'semanal' ? 'semanas' : frecuencia === 'quincenal' ? 'quincenas' : 'meses'}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    La cuota exacta depende del modo de interes que elijas en el siguiente paso.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* SUB-PASO 3: Tipo de interes */}
          {subPaso === 3 && modo === 'prestamo' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Como cobra el interes?</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>La mayoria usa el clasico. Si no estas seguro, dejalo asi.</p>
              </div>

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

              {cuotaManualActiva && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Cuota exacta</label>
                  <div className="mt-1.5">
                    <MoneyInput value={cuotaManual} onChange={(e) => setCuotaManual(e.target.value)} placeholder="Ej: 60.000" />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Tu defines la cuota. Total = cuota x numero de cobros.</p>
                </div>
              )}
            </div>
          )}

          {/* SUB-PASO 4: Opciones adicionales */}
          {subPaso === (modo === 'mercancia' ? 2 : 4) && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Opciones adicionales</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Todo es opcional. Si no necesitas nada, avanza.</p>
              </div>

              {clienteId && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Dias sin cobro</label>
                  <p className="text-[10px] mt-0.5 mb-2" style={{ color: 'var(--color-text-muted)' }}>Dias en que NO se cobra. Se guarda en la ficha del cliente.</p>
                  <DiasSinCobroSelector value={diasSinCobroCliente} onChange={(arr) => { setDiasSinCobroCliente(arr); setDiasSinCobroEditado(true) }} compact />
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Fecha de inicio</label>
                <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} max={hoyISO()} />
              </div>

              <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border cursor-pointer"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Cobrar seguro</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Suma un cargo fijo al prestamo</p>
                </div>
                <input type="checkbox" checked={seguro} onChange={(e) => setSeguro(e.target.checked)} className="w-5 h-5 accent-[var(--color-accent)]" />
              </label>
              {seguro && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Monto del seguro</label>
                  <div className="mt-1.5"><MoneyInput value={montoSeguro} onChange={(e) => setMontoSeguro(e.target.value)} placeholder="0" /></div>
                </div>
              )}

              <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border cursor-pointer"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Ya habia pagado algo antes</p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Migrar un prestamo con abonos previos</p>
                </div>
                <input type="checkbox" checked={esEnCurso} onChange={(e) => setEsEnCurso(e.target.checked)} className="w-5 h-5 accent-[var(--color-accent)]" />
              </label>
              {esEnCurso && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Monto ya abonado</label>
                  <div className="mt-1.5"><MoneyInput value={yaAbonado} onChange={(e) => setYaAbonado(e.target.value)} placeholder="0" /></div>
                </div>
              )}

              {/* Resumen completo antes de confirmar — editable */}
              {calculo && (() => {
                const DIAS_FULL_SINGULAR = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
                const diasPlazoNum = Number(plazo)
                const diasPorPeriodo = DIAS_POR_PERIODO[frecuencia] || 1
                const periodos = Math.max(1, Math.round(diasPlazoNum / diasPorPeriodo))
                let cobrosTotales = periodos
                if (frecuencia === 'diario' && diasSinCobroCliente.length > 0) {
                  const cobrosPorSemana = 7 - diasSinCobroCliente.length
                  cobrosTotales = Math.max(1, Math.round((cobrosPorSemana * diasPlazoNum) / 7))
                }
                const totalConSeguro = calculo.totalAPagar + (seguro && Number(montoSeguro) > 0 ? Number(montoSeguro) : 0)
                const ganancia = calculo.totalAPagar - Number(monto || 0)
                const pctGanancia = Number(monto) > 0 ? Math.round((ganancia / Number(monto)) * 100) : 0
                const labelFreq = { diario: 'diaria', semanal: 'semanal', quincenal: 'quincenal', mensual: 'mensual' }[frecuencia]
                const unidadPlazoL = { diario: 'dias', semanal: 'semanas', quincenal: 'quincenas', mensual: 'meses' }[frecuencia]
                const modoLabel = { fijo: 'Clasico', unico: 'De una vez', solo_interes: 'Globo', saldo: 'Sobre saldo', manual: 'Manual', lineal: 'Decreciente' }[modoInteres] || 'Clasico'
                const pencil = <svg className="w-3 h-3 shrink-0" style={{ color: 'var(--color-text-muted)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" /></svg>

                return (
                  <div className="rounded-2xl overflow-hidden"
                    style={{ border: '1px solid color-mix(in srgb, var(--color-success) 25%, var(--color-border))' }}>
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-success) 8%, var(--color-bg-card)), var(--color-bg-card))' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-success)' }}>Resumen del prestamo</p>
                      <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>Toca para editar</span>
                    </div>
                    <div className="px-4 py-2" style={{ background: 'var(--color-bg-card)' }}>
                      {/* Cuota + Total — calculados, no editables */}
                      <div className="grid grid-cols-2 gap-3 pb-2 mb-1" style={{ borderBottom: '2px solid color-mix(in srgb, var(--color-success) 20%, var(--color-border))' }}>
                        <div>
                          <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Cuota {labelFreq}</p>
                          <p className="text-lg font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>{formatMoney(calculo.cuotaDiaria)}</p>
                        </div>
                        <div>
                          <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Total a pagar</p>
                          <p className="text-lg font-bold font-mono-display" style={{ color: 'var(--color-text-primary)' }}>{formatMoney(totalConSeguro)}</p>
                        </div>
                      </div>

                      {/* Editables */}
                      <div className="space-y-0 text-sm">
                        <EditableRow label="Monto prestado" value={formatMoney(Number(monto || 0))} pencil={pencil}
                          editor={<MoneyInput value={monto} onChange={e => setMonto(e.target.value)} autoFocus />} />

                        {modo === 'prestamo' && (
                          <EditableRow label="Interes" value={`${tasa || 0}% mensual`} valueColor="var(--color-accent)" pencil={pencil}
                            editor={
                              <div className="flex items-center gap-1.5">
                                <input type="number" inputMode="decimal" value={tasa} onChange={e => setTasa(e.target.value)}
                                  className="w-20 h-8 rounded-lg border px-2 text-sm text-right"
                                  style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} autoFocus />
                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>% mensual</span>
                              </div>
                            } />
                        )}

                        <EditableRow label="Frecuencia" value={{ diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' }[frecuencia]} pencil={pencil}
                          editor={
                            <select value={frecuencia} onChange={e => { setFrecuencia(e.target.value); const nd = { diario: '30', semanal: '8', quincenal: '4', mensual: '2' }[e.target.value]; if (nd) setPlazoUnidades(nd) }}
                              className="h-8 rounded-lg border px-2 text-sm"
                              style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} autoFocus>
                              <option value="diario">Diario</option><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option>
                            </select>
                          } />

                        <EditableRow label="Plazo" value={`${plazoUnidades} ${unidadPlazoL}`} pencil={pencil}
                          editor={
                            <div className="flex items-center gap-1.5">
                              <input type="number" inputMode="numeric" value={plazoUnidades} onChange={e => setPlazoUnidades(e.target.value)}
                                className="w-20 h-8 rounded-lg border px-2 text-sm text-right"
                                style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} autoFocus />
                              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{unidadPlazoL}</span>
                            </div>
                          } />

                        {modo === 'prestamo' && (
                          <EditableRow label="Modo" value={modoLabel} pencil={pencil}
                            editor={
                              <select value={modoInteres} onChange={e => setModoInteres(e.target.value)}
                                className="h-8 rounded-lg border px-2 text-sm"
                                style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} autoFocus>
                                <option value="fijo">Clasico</option><option value="unico">De una vez</option><option value="solo_interes">Globo</option><option value="saldo">Sobre saldo</option><option value="manual">Manual</option><option value="lineal">Decreciente</option>
                              </select>
                            } />
                        )}

                        {cuotaManualActiva && (
                          <EditableRow label="Cuota exacta" value={formatMoney(Number(cuotaManual || 0))} pencil={pencil}
                            editor={<MoneyInput value={cuotaManual} onChange={e => setCuotaManual(e.target.value)} autoFocus />} />
                        )}
                      </div>

                      {/* Info calculada — read only */}
                      <div className="space-y-0 mt-1 pt-1" style={{ borderTop: '1px dashed color-mix(in srgb, var(--color-border) 70%, transparent)' }}>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Cobros totales</span>
                          <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{cobrosTotales}</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5">
                          <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Ganancia</span>
                          <span className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>{formatMoney(ganancia)} ({pctGanancia}%)</span>
                        </div>
                        {diasSinCobroCliente.length > 0 && (
                          <div className="flex items-center justify-between py-1.5">
                            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Sin cobro</span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{diasSinCobroCliente.sort((a, b) => a - b).map(n => DIAS_FULL_SINGULAR[n].charAt(0).toUpperCase() + DIAS_FULL_SINGULAR[n].slice(1)).join(', ')}</span>
                          </div>
                        )}
                        {seguro && Number(montoSeguro) > 0 && (
                          <div className="flex items-center justify-between py-1.5">
                            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Seguro</span>
                            <span className="text-xs font-semibold" style={{ color: '#6366f1' }}>{formatMoney(Number(montoSeguro))}</span>
                          </div>
                        )}
                        {esEnCurso && Number(yaAbonado) > 0 && (
                          <div className="flex items-center justify-between py-1.5">
                            <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Abono previo</span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>{formatMoney(Number(yaAbonado))}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {['lineal', 'solo_interes'].includes(modoInteres) && calculo?.tablaAmortizacion?.length > 0 && (
                      <div className="px-4 py-3 border-t" style={{ borderColor: 'color-mix(in srgb, var(--color-border) 50%, transparent)', background: 'var(--color-bg-card)' }}>
                        <TablaAmortizacion tabla={calculo.tablaAmortizacion} frecuencia={frecuencia} />
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </section>
      )}

      {/* ═══ PASO 2: CONFIRMAR + FIRMA ═══ */}
      {paso === 2 && calculo && (() => {
        const labelFrecuencia = { diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' }[frecuencia]
        const unidadPlazoLabel = { diario: 'dias', semanal: 'semanas', quincenal: 'quincenas', mensual: 'meses' }[frecuencia]
        const modoLabel = { fijo: 'Clasico', unico: 'De una vez', solo_interes: 'Globo', saldo: 'Sobre saldo', manual: 'Manual', lineal: 'Decreciente' }[modoInteres] || 'Clasico'
        const pencilIcon = <svg className="w-3 h-3 shrink-0" style={{ color: 'var(--color-text-muted)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" /></svg>
        return (
          <section className="space-y-4 pb-28">
            <SectionCard
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              title="Resumen del prestamo"
              color="var(--color-success)"
              accent={<span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>Toca un campo para editar</span>}
            >
              <div className="space-y-0 text-sm">
                {/* Cliente — no editable */}
                <div className="flex justify-between py-2 border-b" style={{ borderColor: 'color-mix(in srgb, var(--color-border) 50%, transparent)' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Cliente</span>
                  <span className="font-semibold">{clienteSeleccionado?.nombre}</span>
                </div>

                {/* Monto — editable */}
                <EditableRow label="Monto" value={formatMoney(Number(monto))}
                  pencil={pencilIcon}
                  editor={<MoneyInput value={monto} onChange={e => setMonto(e.target.value)} autoFocus />}
                />

                {/* Tasa — editable (solo prestamo, no mercancia) */}
                {modo === 'prestamo' && (
                  <EditableRow label="Interes" value={`${tasa}% mensual`}
                    pencil={pencilIcon}
                    editor={
                      <div className="flex items-center gap-1.5">
                        <input type="number" inputMode="decimal" value={tasa} onChange={e => setTasa(e.target.value)}
                          className="w-20 h-8 rounded-lg border px-2 text-sm text-right"
                          style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} autoFocus />
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>% mensual</span>
                      </div>
                    }
                  />
                )}

                {/* Frecuencia — editable */}
                <EditableRow label="Frecuencia" value={labelFrecuencia}
                  pencil={pencilIcon}
                  editor={
                    <select value={frecuencia} onChange={e => { setFrecuencia(e.target.value); const newDefault = { diario: '30', semanal: '8', quincenal: '4', mensual: '2' }[e.target.value]; if (newDefault) setPlazoUnidades(newDefault) }}
                      className="h-8 rounded-lg border px-2 text-sm"
                      style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} autoFocus>
                      <option value="diario">Diario</option>
                      <option value="semanal">Semanal</option>
                      <option value="quincenal">Quincenal</option>
                      <option value="mensual">Mensual</option>
                    </select>
                  }
                />

                {/* Plazo — editable */}
                <EditableRow label="Plazo" value={`${plazoUnidades} ${unidadPlazoLabel}`}
                  pencil={pencilIcon}
                  editor={
                    <div className="flex items-center gap-1.5">
                      <input type="number" inputMode="numeric" value={plazoUnidades} onChange={e => setPlazoUnidades(e.target.value)}
                        className="w-20 h-8 rounded-lg border px-2 text-sm text-right"
                        style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} autoFocus />
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{unidadPlazoLabel}</span>
                    </div>
                  }
                />

                {/* Modo interés — editable (solo prestamo) */}
                {modo === 'prestamo' && (
                  <EditableRow label="Modo" value={modoLabel}
                    pencil={pencilIcon}
                    editor={
                      <select value={modoInteres} onChange={e => setModoInteres(e.target.value)}
                        className="h-8 rounded-lg border px-2 text-sm"
                        style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} autoFocus>
                        <option value="fijo">Clasico</option>
                        <option value="unico">De una vez</option>
                        <option value="solo_interes">Globo</option>
                        <option value="saldo">Sobre saldo</option>
                        <option value="manual">Manual</option>
                        <option value="lineal">Decreciente</option>
                      </select>
                    }
                  />
                )}

                {/* Cuota manual — editable si modo manual */}
                {cuotaManualActiva && (
                  <EditableRow label="Cuota exacta" value={formatMoney(Number(cuotaManual || 0))}
                    pencil={pencilIcon}
                    editor={<MoneyInput value={cuotaManual} onChange={e => setCuotaManual(e.target.value)} autoFocus />}
                  />
                )}

                {/* Calculados — read only */}
                <div className="pt-2 mt-1 space-y-2" style={{ borderTop: '2px solid color-mix(in srgb, var(--color-success) 25%, var(--color-border))' }}>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-muted)' }}>Cuota {frecuencia === 'diario' ? 'diaria' : labelFrecuencia.toLowerCase()}</span>
                    <span className="font-bold font-mono-display" style={{ color: 'var(--color-success)' }}>{formatMoney(calculo.cuotaDiaria)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-muted)' }}>Total a pagar</span>
                    <span className="font-bold font-mono-display" style={{ color: 'var(--color-accent)' }}>{formatMoney(calculo.totalAPagar)}</span>
                  </div>
                  {calculo.totalInteres > 0 && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--color-text-muted)' }}>Ganancia</span>
                      <span className="font-semibold font-mono-display" style={{ color: 'var(--color-success)' }}>{formatMoney(calculo.totalInteres)}</span>
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" /></svg>}
              title="Firma del cliente"
              color="#6366f1"
            >
              <p className="text-[11px] mb-2" style={{ color: 'var(--color-text-muted)' }}>
                El cliente firma con el dedo sobre el recuadro. Opcional.
              </p>
              <div className="relative rounded-[12px] overflow-hidden border" style={{ borderColor: 'var(--color-border)', background: '#ffffff' }}>
                <canvas
                  ref={firmaCanvasRef}
                  className="w-full touch-none"
                  style={{ height: 180, cursor: 'crosshair' }}
                  onMouseDown={firmaStart}
                  onMouseMove={firmaDraw}
                  onMouseUp={firmaEnd}
                  onMouseLeave={firmaEnd}
                  onTouchStart={firmaStart}
                  onTouchMove={firmaDraw}
                  onTouchEnd={firmaEnd}
                />
                {!firmaStrokes && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-sm text-[#aaa]">Firmar aqui</p>
                  </div>
                )}
              </div>
              {firmaStrokes && (
                <button
                  type="button"
                  onClick={firmaLimpiar}
                  className="mt-2 text-[11px] font-medium px-3 py-1 rounded-[8px] transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}
                >
                  Limpiar firma
                </button>
              )}
            </SectionCard>
          </section>
        )
      })()}

      {/* Barra sticky de resumen en vivo — visible en sub-pasos 2+ del wizard */}
      {paso === 1 && calculo && subPaso >= (modo === 'mercancia' ? 2 : 4) && (
        <div
          className="fixed left-0 right-0 lg:left-60 z-[44] px-4 lg:px-6"
          style={{ bottom: 'calc(68px + env(safe-area-inset-bottom))' }}
        >
          <div
            className="max-w-2xl mx-auto rounded-t-[12px] px-4 py-3 flex items-center justify-between gap-4"
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
              disabled={paso === 0 ? !puedeAvanzarPaso() : paso === 1 ? !puedeAvanzarSubPaso() : false}
              className="flex-[2]"
            >
              {paso === 1 && subPaso === TOTAL_SUB_PASOS - 1 ? 'Revisar prestamo' : 'Continuar'}
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

