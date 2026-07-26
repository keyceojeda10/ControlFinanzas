'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import MoneyInput from '@/components/ui/MoneyInput'
import Avatar from '@/components/ui/Avatar'
import { formatMoney, soloDecimal } from '@/lib/i18n'
import { MODOS_INTERES } from '@/lib/linea-credito'

export default function NuevaLineaPage() {
  const router = useRouter()
  const { esOwner, esCobrador, loading: authLoading } = useAuth()
  const [clientes, setClientes] = useState([])
  const [buscar, setBuscar] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [cupoMaximo, setCupoMaximo] = useState('')
  const [tasaInteres, setTasaInteres] = useState('10')
  const [modoInteres, setModoInteres] = useState('fijo_mensual')
  const [diaCorte, setDiaCorte] = useState('30')
  const [pagoMinimoPct, setPagoMinimoPct] = useState('0')
  const [notas, setNotas] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [paso, setPaso] = useState(0)

  useEffect(() => {
    if (!authLoading && esCobrador) router.replace('/dashboard')
  }, [authLoading, esCobrador, router])

  useEffect(() => {
    fetch('/api/clientes?estado=activo')
      .then(r => r.json())
      .then(data => setClientes(Array.isArray(data) ? data : data.clientes || []))
      .catch(() => {})
  }, [])

  const clientesFiltrados = buscar
    ? clientes.filter(c =>
        c.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
        c.cedula.includes(buscar)
      )
    : clientes

  const clienteSeleccionado = clientes.find(c => c.id === clienteId)

  async function guardar() {
    setError('')
    if (!clienteId) { setError('Selecciona un cliente'); return }
    if (!cupoMaximo || Number(cupoMaximo) <= 0) { setError('El cupo debe ser mayor a 0'); return }
    if (!tasaInteres || Number(tasaInteres) <= 0) { setError('La tasa debe ser mayor a 0'); return }

    setGuardando(true)
    try {
      const res = await fetch('/api/lineas-credito', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clienteId,
          cupoMaximo: Number(cupoMaximo),
          tasaInteres: Number(tasaInteres),
          modoInteres,
          diaCorte: Number(diaCorte),
          pagoMinimoPct: Number(pagoMinimoPct),
          notas: notas || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error al crear')
        return
      }
      const linea = await res.json()
      router.push(`/lineas-credito/${linea.id}`)
    } catch {
      setError('Error de red')
    } finally {
      setGuardando(false)
    }
  }

  if (authLoading) return null
  if (!esOwner) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">Solo el administrador puede crear líneas de crédito</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-28">
      <button onClick={() => paso > 0 ? setPaso(paso - 1) : router.back()} className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        {paso > 0 ? 'Atras' : 'Volver'}
      </button>

      <h1 className="text-[25px] font-semibold text-[var(--color-text-primary)] mb-1">Nueva línea de crédito</h1>
      <p className="text-xs text-[var(--color-text-muted)] mb-2">Crea un cupo rotativo para tu cliente, similar a una tarjeta de crédito.</p>
      <div className="mb-5 p-3 rounded-xl text-[11px] text-[var(--color-text-muted)] leading-relaxed" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
        El cliente podrá pedir plata del cupo varias veces sin crear un préstamo nuevo. Cada mes se genera un corte (estado de cuenta) con lo que debe, y puede pagar todo o una parte. Lo que no pague, rota al siguiente mes con intereses.
      </div>

      {/* Paso 0: Seleccionar cliente */}
      {paso === 0 && (
        <>
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={buscar}
              onChange={e => setBuscar(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
            />
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {clientesFiltrados.slice(0, 30).map(c => (
              <button
                key={c.id}
                onClick={() => { setClienteId(c.id); setPaso(1) }}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors"
                style={{
                  background: c.id === clienteId ? 'var(--color-accent-soft)' : 'var(--color-bg-card)',
                  border: `1px solid ${c.id === clienteId ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}
              >
                <Avatar nombre={c.nombre} fotoUrl={c.fotoUrl} size={36} fontSize={12} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{c.nombre}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">CC {c.cedula}</p>
                </div>
              </button>
            ))}
            {clientesFiltrados.length === 0 && (
              <p className="text-center py-8 text-sm text-[var(--color-text-muted)]">No se encontraron clientes</p>
            )}
          </div>
        </>
      )}

      {/* Paso 1: Configurar linea */}
      {paso === 1 && (
        <>
          {clienteSeleccionado && (
            <Card className="mb-5 p-3">
              <div className="flex items-center gap-3">
                <Avatar nombre={clienteSeleccionado.nombre} fotoUrl={clienteSeleccionado.fotoUrl} size={40} fontSize={14} />
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{clienteSeleccionado.nombre}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">CC {clienteSeleccionado.cedula}</p>
                </div>
              </div>
            </Card>
          )}

          <div className="space-y-4">
            {/* Cupo */}
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">Cupo maximo</label>
              <MoneyInput value={cupoMaximo} onChange={(e) => setCupoMaximo(e.target.value)} placeholder="500000" />
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Es el tope que el cliente puede tener en uso al mismo tiempo. Puede pedir varias veces hasta llegar a este monto.</p>
            </div>

            {/* Tasa */}
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">Tasa de interés mensual (%)</label>
              <input
                type="text"
                inputMode="decimal"
                value={tasaInteres}
                onChange={e => setTasaInteres(soloDecimal(e.target.value))}
                className="w-full h-10 px-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]"
                placeholder="10"
              />
              {cupoMaximo && tasaInteres && (
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                  Si usa todo el cupo: {formatMoney(Math.round(Number(cupoMaximo) * Number(tasaInteres) / 100))}/mes en intereses
                </p>
              )}
            </div>

            {/* Modo interes */}
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">Cómo se calcula el interés</label>
              <div className="space-y-2">
                {MODOS_INTERES.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setModoInteres(m.value)}
                    className="w-full text-left p-3 rounded-xl transition-colors"
                    style={{
                      background: modoInteres === m.value ? 'var(--color-bg-hover)' : 'var(--color-bg-card)',
                      border: `1px solid ${modoInteres === m.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${modoInteres === m.value ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}>
                        {modoInteres === m.value && <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />}
                      </span>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{m.label}</span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1 ml-6">{m.descripcion}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Dia de corte */}
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">Dia de corte mensual</label>
              <select
                value={diaCorte}
                onChange={e => setDiaCorte(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d === 30 ? '30 (último del mes)' : d}</option>
                ))}
              </select>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Ese dia se genera el estado de cuenta del mes: cuanto debe en total (capital + intereses) y cuanto ha pagado.</p>
            </div>

            {/* Pago minimo */}
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">Pago minimo (% del saldo)</label>
              <input
                type="text"
                inputMode="decimal"
                value={pagoMinimoPct}
                onChange={e => setPagoMinimoPct(soloDecimal(e.target.value))}
                className="w-full h-10 px-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]"
                placeholder="0"
              />
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Porcentaje minimo que el cliente debe pagar cada mes. Dejalo en 0 si no quieres exigir un minimo obligatorio.</p>
            </div>

            {/* Notas */}
            <div>
              <label className="text-xs font-medium text-[var(--color-text-secondary)] mb-1.5 block">Notas (opcional)</label>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] resize-none"
                placeholder="Observaciones sobre esta linea..."
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-[var(--color-danger)] mt-3">{error}</p>
          )}

          <Button onClick={guardar} loading={guardando} className="w-full mt-6" size="lg">
            Crear línea de crédito
          </Button>
        </>
      )}
    </div>
  )
}
