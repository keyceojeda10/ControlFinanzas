'use client'
// app/(dashboard)/prestamos/nuevo/page.jsx - Formulario de nuevo préstamo

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams }              from 'next/navigation'
import { useAuth }                                 from '@/hooks/useAuth'
import { Button }                                  from '@/components/ui/Button'
import { Input }                                   from '@/components/ui/Input'
import MoneyInput                                  from '@/components/ui/MoneyInput'
import { calcularPrestamo, formatCOP }             from '@/lib/calculos'
import ResumenCalculo                              from '@/components/prestamos/ResumenCalculo'

const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoyISO = () => getColombiaDate().toISOString().slice(0, 10)

const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

// Wrapper con Suspense requerido por useSearchParams en Next.js build
export default function NuevoPrestamoPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-40">
        <svg className="animate-spin w-6 h-6 text-[#f5c518]" fill="none" viewBox="0 0 24 24">
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
  const { esOwner, loading: authLoading } = useAuth()

  const clienteIdParam = searchParams.get('clienteId') ?? ''

  const [clienteId,    setClienteId]    = useState(clienteIdParam)
  const [clientes,     setClientes]     = useState([])
  const [clienteNombre, setClienteNombre] = useState('')
  const [monto,        setMonto]        = useState('')
  const [tasa,         setTasa]         = useState('20')
  // plazo se ingresa en la unidad de la frecuencia (dias, semanas, quincenas o meses)
  const [plazoUnidades, setPlazoUnidades] = useState('30')
  const [frecuencia,   setFrecuencia]   = useState('diario')
  // Dias totales derivados de plazoUnidades × diasPorPeriodo
  const plazo = String((Number(plazoUnidades) || 0) * (DIAS_POR_PERIODO[frecuencia] || 1))
  const [fechaInicio,  setFechaInicio]  = useState(hoyISO())
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [buscadorCliente, setBuscadorCliente] = useState('')

  // Modo: 'prestamo' (con interés) o 'mercancia' (cuota fija)
  const [modo, setModo] = useState('prestamo')
  const [numCuotas, setNumCuotas] = useState('10')
  // Préstamo en curso (migración)
  const [esEnCurso, setEsEnCurso] = useState(false)
  const [yaAbonado, setYaAbonado] = useState('')
  // Cuota personalizada (sobrescribe la cuota calculada por el sistema)
  const [cuotaManualActiva, setCuotaManualActiva] = useState(false)
  const [cuotaManual, setCuotaManual] = useState('')

  // Guard de rol
  useEffect(() => {
    if (!authLoading && !esOwner) router.replace('/prestamos')
  }, [authLoading, esOwner, router])

  // Cargar clientes para el selector
  useEffect(() => {
    fetch('/api/clientes')
      .then((r) => r.json())
      .then((d) => {
        setClientes(Array.isArray(d) ? d : [])
        if (clienteIdParam) {
          const c = d.find((x) => x.id === clienteIdParam)
          if (c) setClienteNombre(c.nombre)
        }
      })
      .catch(() => {})
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
      ...(cm > 0 && { cuotaManual: cm }),
    })
  }, [monto, tasa, plazo, fechaInicio, frecuencia, cuotaManualActiva, cuotaManual])

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(buscadorCliente.toLowerCase()) ||
    c.cedula.includes(buscadorCliente)
  )

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
    try {
      const res  = await fetch('/api/prestamos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          clienteId,
          montoPrestado: Number(monto),
          tasaInteres:   Number(tasa),
          diasPlazo:     Number(plazo),
          fechaInicio,
          frecuencia,
          ...(esEnCurso && Number(yaAbonado) > 0 && { yaAbonado: Number(yaAbonado) }),
          ...(cuotaManualActiva && Number(cuotaManual) > 0 && { cuotaManual: Number(cuotaManual) }),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al crear el préstamo'); return }
      router.push(`/prestamos/${data.id}`)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return null
  if (!esOwner)    return null

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-[#888888] hover:text-[white] transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <h1 className="text-xl font-bold text-[white]">Nuevo préstamo</h1>
        <p className="text-sm text-[#888888] mt-0.5">Completa los datos para registrar el préstamo</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
            {error}
          </div>
        )}

        {/* Selector de modo */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleModoChange('prestamo')}
            className={[
              'flex items-center justify-center gap-2 py-3 rounded-[12px] border text-sm font-medium transition-all',
              modo === 'prestamo'
                ? 'bg-[rgba(245,197,24,0.12)] border-[#f5c518] text-[#f5c518]'
                : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#888888] hover:text-[white] hover:border-[#3a3a3a]',
            ].join(' ')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Préstamo
          </button>
          <button
            type="button"
            onClick={() => handleModoChange('mercancia')}
            className={[
              'flex items-center justify-center gap-2 py-3 rounded-[12px] border text-sm font-medium transition-all',
              modo === 'mercancia'
                ? 'bg-[rgba(59,130,246,0.12)] border-[#3b82f6] text-[#3b82f6]'
                : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#888888] hover:text-[white] hover:border-[#3a3a3a]',
            ].join(' ')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            Mercancía
          </button>
        </div>

        {/* Card formulario */}
        <div
          className="border border-[#2a2a2a] rounded-[16px] p-5 space-y-4"
          style={{
            background: 'linear-gradient(135deg, #f5c5180A 0%, #1a1a1a 40%, #1a1a1a 70%, #f5c51805 100%)',
            boxShadow: '0 0 30px #f5c51808, 0 1px 2px rgba(0,0,0,0.3)',
          }}
        >

          {/* Selector de cliente */}
          {clienteIdParam ? (
            <div>
              <p className="text-xs font-medium text-[#888888] mb-1.5">Cliente</p>
              <div className="flex items-center gap-2 h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111]">
                <div className="w-5 h-5 rounded-full bg-[rgba(245,197,24,0.2)] flex items-center justify-center shrink-0">
                  <span className="text-[#f5c518] text-[9px] font-bold">{clienteNombre?.[0]?.toUpperCase()}</span>
                </div>
                <span className="text-sm text-[white]">{clienteNombre || clienteIdParam}</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-[#888888]">Cliente *</p>
              <input
                placeholder="Buscar cliente por nombre o cédula…"
                value={buscadorCliente}
                onChange={(e) => { setBuscadorCliente(e.target.value); setClienteId('') }}
                className="w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] placeholder-[#777777] focus:outline-none focus:border-[#f5c518] focus:ring-1 focus:ring-[rgba(245,197,24,0.3)] transition-all"
              />
              {buscadorCliente && (
                <div className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] overflow-hidden max-h-40 overflow-y-auto">
                  {clientesFiltrados.length === 0 ? (
                    <p className="px-3 py-2.5 text-sm text-[#888888]">Sin resultados</p>
                  ) : clientesFiltrados.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setClienteId(c.id)
                        setBuscadorCliente(c.nombre)
                      }}
                      className={[
                        'w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#222222] transition-colors',
                        clienteId === c.id ? 'bg-[rgba(245,197,24,0.1)] text-[#f5c518]' : 'text-[white]',
                      ].join(' ')}
                    >
                      <span className="font-medium">{c.nombre}</span>
                      <span className="text-[#888888] text-xs">CC {c.cedula}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Monto */}
          <MoneyInput
            label={modo === 'mercancia' ? 'Valor del artículo (COP) *' : 'Monto prestado (COP) *'}
            placeholder={modo === 'mercancia' ? 'Ej: 100.000' : 'Ej: 500.000'}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          {/* Quick monto chips */}
          <div className="flex gap-1.5 flex-wrap -mt-1">
            {[50000, 100000, 200000, 500000, 1000000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setMonto(String(v))}
                className={[
                  'px-2.5 h-7 rounded-[8px] text-[11px] font-medium transition-all cursor-pointer',
                  String(monto) === String(v)
                    ? 'bg-[rgba(245,197,24,0.15)] border border-[#f5c518] text-[#f5c518]'
                    : 'bg-[rgba(255,255,255,0.03)] border border-[#2a2a2a] text-[#888888] hover:text-white hover:bg-[#1a1a1a]',
                ].join(' ')}
              >
                {v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}k`}
              </button>
            ))}
          </div>

          {/* Modo mercancía: # cuotas + frecuencia primero */}
          {modo === 'mercancia' && (
            <div className="flex flex-col gap-1">
              <Input
                label="Número de cuotas *"
                type="number"
                inputMode="numeric"
                placeholder="Ej: 10"
                value={numCuotas}
                onChange={(e) => setNumCuotas(e.target.value)}
                suffix="cuotas"
              />
              {calculo && Number(monto) > 0 && (
                <p className="text-[10px] text-[#3b82f6] font-medium px-0.5">
                  → {numCuotas} cuotas de <span className="font-mono-display">{formatCOP(calculo.cuotaDiaria)}</span>
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Tasa */}
            <div className="flex flex-col gap-1">
              <Input
                label="Tasa de interés (%) *"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                placeholder={modo === 'mercancia' ? '0' : 'Ej: 20'}
                value={tasa}
                onChange={(e) => setTasa(e.target.value)}
                suffix="%"
              />
              <p className="text-[10px] text-[#888888] leading-snug px-0.5">
                {modo === 'mercancia'
                  ? 'Déjalo en 0% para mercancía sin interés'
                  : '% mensual sobre el monto. Ej: 20% sobre $100.000 a 60 días = $40.000 (2 meses)'}
              </p>
            </div>
            {/* Plazo — unidad depende de la frecuencia */}
            <div className="flex flex-col gap-1">
              <Input
                label={
                  modo === 'mercancia' ? 'Plazo *' :
                  frecuencia === 'diario'    ? 'Plazo (días) *' :
                  frecuencia === 'semanal'   ? 'Plazo (semanas) *' :
                  frecuencia === 'quincenal' ? 'Plazo (quincenas) *' :
                  'Plazo (meses) *'
                }
                type="number"
                inputMode="numeric"
                placeholder={
                  frecuencia === 'diario'    ? 'Ej: 30' :
                  frecuencia === 'semanal'   ? 'Ej: 8'  :
                  frecuencia === 'quincenal' ? 'Ej: 4'  :
                  'Ej: 2'
                }
                value={plazoUnidades}
                onChange={(e) => setPlazoUnidades(e.target.value)}
                suffix={
                  frecuencia === 'diario'    ? 'días' :
                  frecuencia === 'semanal'   ? 'sem.' :
                  frecuencia === 'quincenal' ? 'quinc.' :
                  'meses'
                }
                disabled={modo === 'mercancia'}
              />
              {modo === 'prestamo' && plazoUnidades && (
                <p className="text-[10px] text-[#888888] leading-snug px-0.5">
                  = {plazo} días totales
                </p>
              )}
              {modo === 'mercancia' && (
                <p className="text-[10px] text-[#888888] leading-snug px-0.5">
                  Calculado automáticamente según cuotas
                </p>
              )}
            </div>
          </div>

          {/* Frecuencia – segmented control */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-medium text-[#888888] uppercase tracking-[0.05em]">Frecuencia de cobro</p>
            <div className="relative flex h-10 rounded-[12px] bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] p-[3px]">
              {/* Sliding pill */}
              <div
                className="absolute top-[3px] bottom-[3px] rounded-[10px] bg-[#f5c518] transition-all duration-200 ease-out"
                style={{
                  width: `calc(25% - 1.5px)`,
                  left: `calc(${['diario','semanal','quincenal','mensual'].indexOf(frecuencia) * 25}% + 1.5px)`,
                }}
              />
              {[
                { value: 'diario', label: 'Diario' },
                { value: 'semanal', label: 'Semanal' },
                { value: 'quincenal', label: 'Quinc.' },
                { value: 'mensual', label: 'Mensual' },
              ].map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => handleFrecuenciaChange(f.value)}
                  className={[
                    'relative z-[1] flex-1 text-xs font-semibold transition-colors duration-200 cursor-pointer rounded-[10px]',
                    frecuencia === f.value ? 'text-[#0a0a0a]' : 'text-[#888888]',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha inicio */}
          <div className="flex flex-col gap-1">
            <Input
              label="Fecha de inicio *"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
            <p className="text-[10px] text-[#888888] leading-snug px-0.5">
              Por defecto es hoy. Puedes elegir una fecha anterior si el préstamo ya lleva tiempo.
            </p>
          </div>

          {/* Toggle préstamo en curso */}
          <div className="border-t border-[#2a2a2a] pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[white]">Préstamo en curso</p>
                <p className="text-[10px] text-[#666666] leading-snug">
                  Actívalo si este préstamo ya tiene pagos (migración de cuaderno u otro sistema)
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setEsEnCurso(v => !v); if (esEnCurso) setYaAbonado('') }}
                className={[
                  'relative w-10 h-[22px] rounded-full transition-colors shrink-0 mt-0.5',
                  esEnCurso ? 'bg-[#f5c518]' : 'bg-[#333333]',
                ].join(' ')}
              >
                <span className={[
                  'absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform shadow-sm',
                  esEnCurso ? 'left-[20px]' : 'left-[2px]',
                ].join(' ')} />
              </button>
            </div>

            {esEnCurso && (
              <div className="mt-3 space-y-2">
                <MoneyInput
                  label="Total ya abonado (COP)"
                  placeholder="Ej: 150.000"
                  value={yaAbonado}
                  onChange={(e) => setYaAbonado(e.target.value)}
                />
                {calculo && Number(yaAbonado) > 0 && (
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-[10px] px-3 py-2.5 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#888888]">Total a pagar</span>
                      <span className="text-white font-medium font-mono-display">{formatCOP(calculo.totalAPagar)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#888888]">Ya abonado</span>
                      <span className="text-[#22c55e] font-medium font-mono-display">-{formatCOP(Number(yaAbonado))}</span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-[#2a2a2a] pt-1">
                      <span className="text-[#888888] font-semibold">Saldo pendiente</span>
                      <span className="text-[#f5c518] font-bold font-mono-display">
                        {formatCOP(Math.max(0, calculo.totalAPagar - Number(yaAbonado)))}
                      </span>
                    </div>
                  </div>
                )}
                <p className="text-[10px] text-[#888888] leading-snug">
                  Se registrará como pago inicial. El saldo pendiente se calculará automáticamente.
                </p>
              </div>
            )}
          </div>

          {/* Toggle personalizar cuota */}
          {modo === 'prestamo' && (
            <div className="border-t border-[#2a2a2a] pt-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[white]">Personalizar cuota</p>
                  <p className="text-[10px] text-[#666666] leading-snug">
                    Define tú mismo el valor de cada cuota (ej. $60.000 redondo en vez de la cuota sugerida)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCuotaManualActiva(v => {
                      const next = !v
                      if (!next) setCuotaManual('')
                      else if (calculo?.cuotaDiaria) setCuotaManual(String(calculo.cuotaDiaria))
                      return next
                    })
                  }}
                  className={[
                    'relative w-10 h-[22px] rounded-full transition-colors shrink-0 mt-0.5',
                    cuotaManualActiva ? 'bg-[#f5c518]' : 'bg-[#333333]',
                  ].join(' ')}
                >
                  <span className={[
                    'absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white transition-transform shadow-sm',
                    cuotaManualActiva ? 'left-[20px]' : 'left-[2px]',
                  ].join(' ')} />
                </button>
              </div>

              {cuotaManualActiva && (
                <div className="mt-3 space-y-2">
                  <MoneyInput
                    label="Valor de cada cuota (COP)"
                    placeholder="Ej: 60.000"
                    value={cuotaManual}
                    onChange={(e) => setCuotaManual(e.target.value)}
                  />
                  <p className="text-[10px] text-[#888888] leading-snug">
                    El total a pagar se ajusta automáticamente. La tasa ingresada se ignora.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Resumen en tiempo real (pegado al formulario) */}
          {calculo && (
            <div className="border-t border-[#2a2a2a] pt-4">
              <ResumenCalculo calculo={calculo} visible={!!calculo} />
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            Crear préstamo
          </Button>
        </div>
      </form>
    </div>
  )
}
