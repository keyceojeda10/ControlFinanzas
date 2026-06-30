'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import MoneyInput from '@/components/ui/MoneyInput'
import Avatar from '@/components/ui/Avatar'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatMoney } from '@/lib/i18n'
import { use } from 'react'

export default function DetalleLineaPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const { esOwner, loading: authLoading } = useAuth()
  const [linea, setLinea] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalDesembolso, setModalDesembolso] = useState(false)
  const [modalPago, setModalPago] = useState(false)
  const [modalCorte, setModalCorte] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/lineas-credito/${id}`)
      if (res.ok) setLinea(await res.json())
    } catch {
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  if (authLoading || loading) {
    return <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
  }

  if (!linea) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">Linea no encontrada</p>
        <Button onClick={() => router.push('/lineas-credito')} size="sm" className="mt-4">Volver</Button>
      </div>
    )
  }

  const porcentajeUsado = linea.cupoMaximo > 0
    ? Math.round((linea.capitalUsado || 0) / linea.cupoMaximo * 100)
    : 0

  const movimientos = [
    ...(linea.desembolsos || []).map(d => ({ ...d, tipo: 'desembolso' })),
    ...(linea.pagosLinea || []).map(p => ({ ...p, tipo: 'pago' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const estadoColor = {
    activa: 'var(--color-accent)',
    congelada: 'var(--color-warning)',
    cerrada: '#64748b',
  }[linea.estado] || 'var(--color-accent)'

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28">
      <button onClick={() => router.push('/lineas-credito')} className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Lineas de credito
      </button>

      {/* Header */}
      <Card className="p-4 mb-4">
        <div className="flex items-start gap-3 mb-4">
          <Avatar nombre={linea.cliente?.nombre} fotoUrl={linea.cliente?.fotoUrl} size={44} fontSize={15} />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-[var(--color-text-primary)] leading-tight">{linea.cliente?.nombre}</p>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">CC {linea.cliente?.cedula} · Corte dia {linea.diaCorte}</p>
          </div>
          <span
            className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
            style={{ background: `${estadoColor}20`, color: estadoColor, border: `1px solid ${estadoColor}35` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: estadoColor }} />
            {linea.estado.charAt(0).toUpperCase() + linea.estado.slice(1)}
          </span>
        </div>

        {/* Cupo visual */}
        <div className="grid grid-cols-3 gap-3 text-center mb-3">
          <div>
            <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Cupo</p>
            <p className="text-sm font-mono-display font-bold text-[var(--color-text-primary)] mt-0.5">{formatMoney(linea.cupoMaximo)}</p>
          </div>
          <div>
            <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Usado</p>
            <p className="text-sm font-mono-display font-bold text-[var(--color-text-primary)] mt-0.5">{formatMoney(linea.capitalUsado || 0)}</p>
          </div>
          <div>
            <p className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wider">Disponible</p>
            <p className="text-sm font-mono-display font-bold mt-0.5" style={{ color: estadoColor }}>{formatMoney(linea.cupoDisponible || 0)}</p>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-[var(--color-text-muted)]">Uso del cupo</span>
            <span className="font-mono-display font-semibold" style={{ color: porcentajeUsado > 80 ? 'var(--color-danger)' : estadoColor }}>{porcentajeUsado}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-hover)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(porcentajeUsado, 2)}%`,
                background: porcentajeUsado > 80
                  ? 'var(--color-danger)'
                  : `linear-gradient(90deg, color-mix(in srgb, ${estadoColor} 80%, transparent), ${estadoColor})`,
              }}
            />
          </div>
        </div>

        {/* Saldo total con intereses */}
        {(linea.interesesPendientes || 0) > 0 && (
          <div className="flex items-center justify-between text-[11px] px-2 py-1.5 rounded-lg" style={{ background: 'var(--color-bg-hover)' }}>
            <span className="text-[var(--color-text-muted)]">Intereses pendientes</span>
            <span className="font-mono-display font-semibold text-[var(--color-warning)]">{formatMoney(linea.interesesPendientes)}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] px-2 py-1.5 mt-1">
          <span className="text-[var(--color-text-muted)]">Tasa: {linea.tasaInteres}% mensual</span>
          <span className="text-[var(--color-text-muted)]">
            {linea.modoInteres === 'fijo_mensual' ? 'Interes fijo mensual' : linea.modoInteres === 'diario_saldo' ? 'Interes diario sobre saldo' : 'Interes al corte'}
          </span>
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] px-2 mt-1 leading-relaxed">
          El cupo es el maximo que puede tener en uso. Cada vez que pide plata baja el disponible, y cada vez que paga sube de nuevo.
        </p>
      </Card>

      {/* Acciones */}
      {linea.estado === 'activa' && (
        <div className="flex gap-2 mb-5">
          <Button onClick={() => setModalDesembolso(true)} className="flex-1" size="sm" variant="outline">
            Desembolsar
          </Button>
          <Button onClick={() => setModalPago(true)} className="flex-1" size="sm">
            Registrar pago
          </Button>
          {esOwner && (
            <Button onClick={() => setModalCorte(true)} size="sm" variant="outline" className="shrink-0">
              Corte
            </Button>
          )}
        </div>
      )}

      {/* Cortes (estados de cuenta) */}
      {linea.cortesLinea?.length > 0 && (
        <div className="mb-5">
          <h2 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Estados de cuenta</h2>
          <p className="text-[10px] text-[var(--color-text-muted)] mb-2 leading-relaxed">Resumen de cada mes: lo que debia + lo que pidio + intereses - lo que pago = saldo nuevo.</p>
          <div className="space-y-2">
            {linea.cortesLinea.map(corte => (
              <Card key={corte.id} className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                    {corte.periodo}
                  </span>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {new Date(corte.fechaCorte).toLocaleDateString('es')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-[var(--color-text-muted)]">Saldo anterior</span>
                  <span className="text-right font-mono-display text-[var(--color-text-primary)]">{formatMoney(corte.saldoAnterior)}</span>
                  <span className="text-[var(--color-text-muted)]">Desembolsos</span>
                  <span className="text-right font-mono-display text-[var(--color-text-primary)]">+{formatMoney(corte.totalDesembolsos)}</span>
                  <span className="text-[var(--color-text-muted)]">Intereses</span>
                  <span className="text-right font-mono-display text-[var(--color-warning)]">+{formatMoney(corte.interesesGenerados)}</span>
                  <span className="text-[var(--color-text-muted)]">Pagado</span>
                  <span className="text-right font-mono-display text-[var(--color-accent)]">-{formatMoney(corte.totalPagado)}</span>
                  <span className="text-[var(--color-text-muted)] font-semibold">Saldo nuevo</span>
                  <span className="text-right font-mono-display font-bold text-[var(--color-text-primary)]">{formatMoney(corte.saldoNuevo)}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Movimientos */}
      <div>
        <h2 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
          Movimientos ({movimientos.length})
        </h2>
        {movimientos.length === 0 ? (
          <p className="text-center py-8 text-sm text-[var(--color-text-muted)]">Sin movimientos</p>
        ) : (
          <div className="space-y-1.5">
            {movimientos.map(mov => (
              <div
                key={mov.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: mov.tipo === 'desembolso' ? 'var(--color-warning)20' : 'var(--color-accent)20',
                  }}
                >
                  {mov.tipo === 'desembolso' ? (
                    <svg className="w-4 h-4" style={{ color: 'var(--color-warning)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 14l-4-4m4 4l4-4" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" style={{ color: 'var(--color-accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m0-14l-4 4m4-4l4 4" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">
                    {mov.tipo === 'desembolso' ? 'Desembolso' : 'Pago'}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {new Date(mov.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {mov.nota && ` · ${mov.nota}`}
                  </p>
                  {mov.tipo === 'pago' && mov.montoAInteres > 0 && (
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      {formatMoney(mov.montoAInteres)} a interes · {formatMoney(mov.montoACapital)} a capital
                    </p>
                  )}
                </div>
                <p className={`text-sm font-mono-display font-bold shrink-0 ${mov.tipo === 'desembolso' ? 'text-[var(--color-warning)]' : 'text-[var(--color-accent)]'}`}>
                  {mov.tipo === 'desembolso' ? '-' : '+'}{formatMoney(mov.tipo === 'desembolso' ? mov.monto : mov.montoTotal)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modales */}
      {modalDesembolso && (
        <ModalDesembolso
          lineaId={linea.id}
          cupoDisponible={linea.cupoDisponible || 0}
          onClose={() => setModalDesembolso(false)}
          onSuccess={() => { setModalDesembolso(false); cargar() }}
        />
      )}
      {modalPago && (
        <ModalPago
          lineaId={linea.id}
          saldoTotal={linea.saldoTotal || 0}
          onClose={() => setModalPago(false)}
          onSuccess={() => { setModalPago(false); cargar() }}
        />
      )}
      {modalCorte && (
        <ModalCorte
          lineaId={linea.id}
          onClose={() => setModalCorte(false)}
          onSuccess={() => { setModalCorte(false); cargar() }}
        />
      )}
    </div>
  )
}

function ModalDesembolso({ lineaId, cupoDisponible, onClose, onSuccess }) {
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setError('')
    const val = Number(monto)
    if (!val || val <= 0) { setError('Ingresa un monto valido'); return }
    if (val > cupoDisponible) { setError(`El monto excede el cupo disponible (${formatMoney(cupoDisponible)})`); return }

    setGuardando(true)
    try {
      const res = await fetch(`/api/lineas-credito/${lineaId}/desembolso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: val, nota: nota || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error')
        return
      }
      onSuccess()
    } catch {
      setError('Error de red')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-[var(--color-bg-surface)] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">Registrar desembolso</h3>
        <p className="text-[11px] text-[var(--color-text-muted)] mb-3">Registra el dinero que el cliente esta pidiendo de su cupo. Disponible: {formatMoney(cupoDisponible)}</p>

        <MoneyInput value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto" />
        <input
          type="text"
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Nota (opcional)"
          className="w-full h-10 px-3 mt-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
        />

        {error && <p className="text-xs text-[var(--color-danger)] mt-2">{error}</p>}

        <div className="flex gap-2 mt-4">
          <Button onClick={onClose} variant="outline" className="flex-1" size="sm">Cancelar</Button>
          <Button onClick={guardar} loading={guardando} className="flex-1" size="sm">Desembolsar</Button>
        </div>
      </div>
    </div>
  )
}

function ModalPago({ lineaId, saldoTotal, onClose, onSuccess }) {
  const [monto, setMonto] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setError('')
    const val = Number(monto)
    if (!val || val <= 0) { setError('Ingresa un monto valido'); return }

    setGuardando(true)
    try {
      const res = await fetch(`/api/lineas-credito/${lineaId}/pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: val, metodoPago, nota: nota || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error')
        return
      }
      onSuccess()
    } catch {
      setError('Error de red')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-[var(--color-bg-surface)] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">Registrar pago</h3>
        <p className="text-[11px] text-[var(--color-text-muted)] mb-3">El pago primero cubre intereses pendientes y el resto va a capital, liberando cupo. Saldo actual: {formatMoney(saldoTotal)}</p>

        <MoneyInput value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto del pago" />

        <div className="flex gap-2 mt-3">
          {['efectivo', 'transferencia'].map(m => (
            <button
              key={m}
              onClick={() => setMetodoPago(m)}
              className="flex-1 h-9 rounded-xl text-xs font-medium transition-colors"
              style={{
                background: metodoPago === m ? 'var(--color-accent)' : 'var(--color-bg-card)',
                color: metodoPago === m ? 'black' : 'var(--color-text-secondary)',
                border: `1px solid ${metodoPago === m ? 'var(--color-accent)' : 'var(--color-border)'}`,
              }}
            >
              {m === 'efectivo' ? 'Efectivo' : 'Transferencia'}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Nota (opcional)"
          className="w-full h-10 px-3 mt-3 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]"
        />

        {error && <p className="text-xs text-[var(--color-danger)] mt-2">{error}</p>}

        <div className="flex gap-2 mt-4">
          <Button onClick={onClose} variant="outline" className="flex-1" size="sm">Cancelar</Button>
          <Button onClick={guardar} loading={guardando} className="flex-1" size="sm">Registrar pago</Button>
        </div>
      </div>
    </div>
  )
}

function ModalCorte({ lineaId, onClose, onSuccess }) {
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function generar() {
    setError('')
    setGuardando(true)
    try {
      const res = await fetch(`/api/lineas-credito/${lineaId}/corte`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error')
        return
      }
      onSuccess()
    } catch {
      setError('Error de red')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-[var(--color-bg-surface)] rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-2">Generar corte mensual</h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Genera el estado de cuenta de este mes. Calcula cuanto debe el cliente sumando lo que ya debia, mas lo que pidio este mes, mas los intereses, menos lo que ha pagado. El resultado es el saldo que rota al siguiente mes.
        </p>

        {error && <p className="text-xs text-[var(--color-danger)] mb-3">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={onClose} variant="outline" className="flex-1" size="sm">Cancelar</Button>
          <Button onClick={generar} loading={guardando} className="flex-1" size="sm">Generar corte</Button>
        </div>
      </div>
    </div>
  )
}
