'use client'
// app/(dashboard)/prestamos/nuevo/page.jsx - Formulario de nuevo préstamo

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams }              from 'next/navigation'
import { useAuth }                                 from '@/hooks/useAuth'
import { Button }                                  from '@/components/ui/Button'
import { Input }                                   from '@/components/ui/Input'
import { calcularPrestamo, formatCOP }             from '@/lib/calculos'
import ResumenCalculo                              from '@/components/prestamos/ResumenCalculo'

const hoyISO = () => new Date().toISOString().slice(0, 10)

// Wrapper con Suspense requerido por useSearchParams en Next.js build
export default function NuevoPrestamoPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-40">
        <svg className="animate-spin w-6 h-6 text-[#3b82f6]" fill="none" viewBox="0 0 24 24">
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
  const [plazo,        setPlazo]        = useState('30')
  const [fechaInicio,  setFechaInicio]  = useState(hoyISO())
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [buscadorCliente, setBuscadorCliente] = useState('')

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

  // Cálculo en tiempo real
  const calculo = useMemo(() => {
    const m = Number(monto)
    const t = Number(tasa)
    const p = Number(plazo)
    if (!m || !t || !p || !fechaInicio) return null
    return calcularPrestamo({ montoPrestado: m, tasaInteres: t, diasPlazo: p, fechaInicio })
  }, [monto, tasa, plazo, fechaInicio])

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(buscadorCliente.toLowerCase()) ||
    c.cedula.includes(buscadorCliente)
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clienteId)  { setError('Selecciona un cliente'); return }
    if (!monto)      { setError('Ingresa el monto'); return }
    if (!calculo)    { setError('Verifica los datos del préstamo'); return }

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
          className="flex items-center gap-1.5 text-sm text-[#555555] hover:text-[white] transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>
        <h1 className="text-xl font-bold text-[white]">Nuevo préstamo</h1>
        <p className="text-sm text-[#555555] mt-0.5">Completa los datos para registrar el préstamo</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)] text-[#ef4444] text-sm rounded-[12px] px-4 py-3">
            {error}
          </div>
        )}

        {/* Card formulario */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[16px] p-5 space-y-4">

          {/* Selector de cliente */}
          {clienteIdParam ? (
            <div>
              <p className="text-xs font-medium text-[#888888] mb-1.5">Cliente</p>
              <div className="flex items-center gap-2 h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111]">
                <div className="w-5 h-5 rounded-full bg-[rgba(59,130,246,0.2)] flex items-center justify-center shrink-0">
                  <span className="text-[#3b82f6] text-[9px] font-bold">{clienteNombre?.[0]?.toUpperCase()}</span>
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
                className="w-full h-10 px-3 rounded-[12px] border border-[#2a2a2a] bg-[#111111] text-sm text-[white] placeholder-[#555555] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[rgba(59,130,246,0.3)] transition-all"
              />
              {buscadorCliente && (
                <div className="bg-[#111111] border border-[#2a2a2a] rounded-[12px] overflow-hidden max-h-40 overflow-y-auto">
                  {clientesFiltrados.length === 0 ? (
                    <p className="px-3 py-2.5 text-sm text-[#555555]">Sin resultados</p>
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
                        clienteId === c.id ? 'bg-[rgba(59,130,246,0.1)] text-[#3b82f6]' : 'text-[white]',
                      ].join(' ')}
                    >
                      <span className="font-medium">{c.nombre}</span>
                      <span className="text-[#555555] text-xs">CC {c.cedula}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Monto */}
          <Input
            label="Monto prestado (COP) *"
            type="number"
            inputMode="numeric"
            placeholder="Ej: 500000"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            prefix="$"
          />

          <div className="grid grid-cols-2 gap-3">
            {/* Tasa */}
            <div className="flex flex-col gap-1">
              <Input
                label="Tasa de interés del crédito (%) *"
                type="number"
                inputMode="decimal"
                step="0.5"
                placeholder="Ej: 20"
                value={tasa}
                onChange={(e) => setTasa(e.target.value)}
                suffix="%"
              />
              <p className="text-[10px] text-[#555555] leading-snug px-0.5">
                % total sobre el monto. Ej: 20% sobre $100.000 = $20.000 de interés
              </p>
            </div>
            {/* Plazo */}
            <Input
              label="Plazo (días) *"
              type="number"
              inputMode="numeric"
              placeholder="Ej: 30"
              value={plazo}
              onChange={(e) => setPlazo(e.target.value)}
              suffix="días"
            />
          </div>

          {/* Fecha inicio */}
          <Input
            label="Fecha de inicio *"
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>

        {/* Resumen en tiempo real */}
        <ResumenCalculo calculo={calculo} visible={!!calculo} />

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
