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
import { calcularProximoCorte, textoProximoCorte } from '@/lib/lineas-credito'
import { use } from 'react'

export default function DetalleLineaPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const { esOwner, esCobrador, loading: authLoading } = useAuth()
  const [linea, setLinea] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalDesembolso, setModalDesembolso] = useState(false)
  const [modalPago, setModalPago] = useState(false)
  const [modalCorte, setModalCorte] = useState(false)
  const [modalEstado, setModalEstado] = useState(null)
  const [modalEliminarLinea, setModalEliminarLinea] = useState(false)
  const [eliminarMov, setEliminarMov] = useState(null)
  const [eliminarCorte, setEliminarCorte] = useState(null)

  useEffect(() => {
    if (!authLoading && esCobrador) router.replace('/dashboard')
  }, [authLoading, esCobrador, router])

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
    return <div className="max-w-2xl mx-auto py-6 space-y-3">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
  }

  if (!linea) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <p className="text-sm text-[var(--cf-ink-3)]">Línea no encontrada</p>
        <Button onClick={() => router.push('/lineas-credito')} size="sm" className="mt-4">Volver</Button>
      </div>
    )
  }

  const porcentajeUsado = linea.cupoMaximo > 0
    ? Math.round((linea.capitalUsado || 0) / linea.cupoMaximo * 100)
    : 0

  /* ── T30-04 · DE AZUL METALIZADO A CARBÓN ──
     Era el ÚNICO elemento de toda la app fuera de la marca: un degradado azul
     con brillo, escarcha y orbe. Y el azul en este sistema significa PERSONA
     —avatar, punto de ubicación—, nunca dinero, así que la tarjeta que enseña
     el cupo estaba pintada del color equivocado.
     En carbón con el dorado se distingue igual de los préstamos, que son
     tarjetas blancas —es otro producto—, pero dentro del canon. */
  const CARBON = {
    fondo: '#15161A',
    ink: '#F3F3F6',
    sub: '#A3A8B2',
    tenue: '#8A8E98',
    oro: 'var(--cf-gold-light)',
    verde: '#2FBE6A',
    track: 'rgba(255,255,255,.12)',
    linea: 'rgba(255,255,255,.09)',
  }

  const proximoCorte = calcularProximoCorte(linea.diaCorte)

  /* El número grande es LO QUE PUEDE PEDIR, no lo que debe: es la pregunta que
     trae al cliente al mostrador. Antes el cupo disponible era una de tres
     cifras de 14px en fila, con el mismo peso que las otras dos. */
  const disponible = linea.cupoDisponible || 0
  const usado = linea.capitalUsado || 0

  const movimientos = [
    ...(linea.desembolsos || []).map(d => ({ ...d, tipo: 'desembolso' })),
    ...(linea.pagosLinea || []).map(p => ({ ...p, tipo: 'pago' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const estadoColor = {
    activa: 'var(--cf-gold)',
    congelada: 'var(--cf-gold-dark)',
    cerrada: 'var(--cf-ink-3)',
  }[linea.estado] || 'var(--cf-gold)'

  const esHoy = (fecha) => new Date(fecha).toDateString() === new Date().toDateString()

  const tieneMovimientos = (linea.desembolsos?.length || 0) + (linea.pagosLinea?.length || 0) + (linea.cortesLinea?.length || 0) > 0

  // Sin `px-4`: el relleno lateral lo pone el armazon. Eran 36 por lado.
  return (
    <div className="max-w-2xl lg:max-w-5xl mx-auto py-6">
      {/* === T30-04 · PUEDE PEDIR HASTA === */}
      <div
        className="rounded-[var(--cf-r-hero)] overflow-hidden mb-3"
        style={{ background: CARBON.fondo, color: CARBON.ink }}
      >
        <div className="px-5 py-5">
          <div className="flex items-start gap-3 mb-4">
            <Avatar
              nombre={linea.cliente?.nombre}
              fotoUrl={linea.cliente?.fotoUrl}
              size={44}
              fontSize={15}
              style={{ border: `2px solid rgba(255,255,255,.25)` }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold leading-tight" style={{ color: CARBON.ink }}>{linea.cliente?.nombre}</p>
              <p className="text-[11px] mt-0.5" style={{ color: CARBON.sub }}>Línea de crédito · CC {linea.cliente?.cedula}</p>
            </div>
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full shrink-0"
              style={{
                background: linea.estado === 'activa' ? 'rgba(47,190,106,.16)' : 'rgba(255,255,255,.1)',
                color: linea.estado === 'activa' ? CARBON.verde : CARBON.sub,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: linea.estado === 'activa' ? CARBON.verde : CARBON.sub }} />
              {linea.estado.charAt(0).toUpperCase() + linea.estado.slice(1)}
            </span>
          </div>

          {/* La cifra que trae al cliente al mostrador. Antes era una de tres de
              14px en fila, con el mismo peso que «cupo» y «usado». */}
          <p className="text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: CARBON.sub }}>
            Puede pedir hasta
          </p>
          <div className="flex items-end gap-3 mt-1.5">
            <span className="cf-fig text-[34px]" style={{ color: CARBON.oro, letterSpacing: '-.035em', lineHeight: 1 }}>
              {formatMoney(disponible)}
            </span>
            <span className="text-[13px] pb-1" style={{ color: CARBON.tenue }}>
              de {formatMoney(linea.cupoMaximo)}
            </span>
          </div>

          <div className="h-[13px] rounded-full overflow-hidden mt-3.5" style={{ background: CARBON.track }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.max(porcentajeUsado, 2)}%`,
                background: porcentajeUsado > 80 ? 'var(--cf-red)' : CARBON.oro,
              }}
            />
          </div>

          <div className="flex items-baseline justify-between mt-3 text-[12px]" style={{ color: CARBON.sub }}>
            <span>
              Ya usó <strong className="cf-fig" style={{ color: CARBON.ink }}>{formatMoney(usado)}</strong> · {porcentajeUsado}%
            </span>
            <span>{linea.tasaInteres}% mensual</span>
          </div>

          {(linea.interesesPendientes || 0) > 0 && (
            <div
              className="flex items-center justify-between text-[12px] px-3 py-2 rounded-[12px] mt-3"
              style={{ background: 'rgba(231,164,0,.14)' }}
            >
              <span style={{ color: CARBON.sub }}>Intereses pendientes</span>
              <span className="cf-fig" style={{ color: CARBON.oro }}>{formatMoney(linea.interesesPendientes)}</span>
            </div>
          )}

          <p className="text-[11px] mt-3 pt-3 leading-relaxed" style={{ color: CARBON.tenue, borderTop: `1px solid ${CARBON.linea}` }}>
            {linea.modoInteres === 'fijo_mensual' ? 'Interés fijo mensual' : linea.modoInteres === 'diario_saldo' ? 'Interés diario sobre saldo' : 'Interés al corte'}.
            {' '}El cupo es el máximo que puede tener en uso: cada vez que pide plata baja el disponible, y cada vez que paga sube de nuevo.
          </p>
        </div>
      </div>

      {/* === T30-04 · EL CORTE, EN SEGUNDO LUGAR ===
          En un cupo rotativo el corte es LA fecha que manda: es cuando se
          liquida el interés del ciclo. Vivía en un gris de 12px al lado de la
          cédula, escrito como «Corte día 30» —un número del mes, no una fecha—,
          así que había que calcular de cabeza cuánto falta. */}
      {linea.estado !== 'cerrada' && (
        <div
          className="flex items-center gap-3.5 rounded-[var(--cf-r-card)] px-4 py-4 mb-3"
          style={{
            background: 'var(--cf-card)',
            border: `1.5px solid ${proximoCorte.dias <= 2 ? 'var(--cf-gold)' : 'var(--cf-border)'}`,
            boxShadow: proximoCorte.dias <= 2 ? '0 0 0 3px var(--cf-gold-focus)' : 'none',
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--cf-ink-3)]">El corte es</p>
            <p className="cf-fig text-[22px] mt-0.5" style={{ letterSpacing: '-.025em', lineHeight: 1.1 }}>
              {textoProximoCorte(proximoCorte.dias)}
            </p>
            <p className="text-[12px] text-[var(--cf-ink-2)] mt-0.5">
              {proximoCorte.fecha.toLocaleDateString('es', { day: 'numeric', month: 'long', timeZone: 'UTC' })}
              {usado > 0 && ` · le va a quedar ${formatMoney(usado)}`}
            </p>
          </div>
          {esOwner && (
            <Button onClick={() => setModalCorte(true)} size="sm" className="shrink-0">
              Ver corte
            </Button>
          )}
        </div>
      )}

      {/* === T30-04 · DOS BOTONES, EN EL IDIOMA DEL PRESTAMISTA ===
          Eran cinco, tres de ellos dorados compitiendo entre sí, y decían
          «Desembolsar» y «Registrar pago» —el idioma del sistema, no el del
          mostrador—. «Corte» sale de aquí: ya tiene su sitio arriba, en la
          tarjeta que dice cuándo es. */}
      {linea.estado !== 'cerrada' && (
        <div className="flex gap-2.5 mb-3">
          {linea.estado === 'activa' && (
            <Button onClick={() => setModalDesembolso(true)} className="flex-1">
              Le doy plata
            </Button>
          )}
          <Button
            onClick={() => setModalPago(true)}
            className="flex-1"
            variant={linea.estado === 'activa' ? 'outline' : 'primary'}
          >
            Me paga
          </Button>
        </div>
      )}

      {/* Acciones de estado (solo admin) */}
      {esOwner && (
        <div className="flex gap-2 mb-5">
          {linea.estado === 'activa' && (
            <>
              <button
                onClick={() => setModalEstado('congelada')}
                className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11px] font-medium transition-colors"
                style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 15%, transparent)', color: 'var(--cf-gold-dark)', border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 30%, transparent)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Congelar
              </button>
              <button
                onClick={() => setModalEstado('cerrada')}
                className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11px] font-medium transition-colors"
                style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--cf-ink-3)', border: '1px solid rgba(100,116,139,0.2)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                Cerrar
              </button>
            </>
          )}
          {linea.estado === 'congelada' && (
            <>
              <button
                onClick={() => setModalEstado('activa')}
                className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11px] font-medium transition-colors"
                style={{ background: 'color-mix(in srgb, var(--cf-gold) 15%, transparent)', color: 'var(--cf-gold)', border: '1px solid color-mix(in srgb, var(--cf-gold) 30%, transparent)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Reactivar
              </button>
              <button
                onClick={() => setModalEstado('cerrada')}
                className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl text-[11px] font-medium transition-colors"
                style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--cf-ink-3)', border: '1px solid rgba(100,116,139,0.2)' }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                Cerrar
              </button>
            </>
          )}
          {!tieneMovimientos && (
            <button
              onClick={() => setModalEliminarLinea(true)}
              className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-medium transition-colors"
              style={{ background: 'color-mix(in srgb, var(--cf-red-dark) 15%, transparent)', color: 'var(--cf-red-dark)', border: '1px solid color-mix(in srgb, var(--cf-red-dark) 30%, transparent)' }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Eliminar
            </button>
          )}
        </div>
      )}

      {/* Mensaje de estado congelada/cerrada */}
      {linea.estado === 'congelada' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-[11px]" style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 25%, transparent)', color: 'var(--cf-gold-dark)' }}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
          Línea congelada: no se permiten nuevos desembolsos, pero sí pagos.
        </div>
      )}
      {linea.estado === 'cerrada' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-[11px]" style={{ background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.15)', color: 'var(--cf-ink-3)' }}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          Línea cerrada: no se permiten más operaciones.
        </div>
      )}

      {/* Cortes (estados de cuenta) */}
      {linea.cortesLinea?.length > 0 && (
        <div className="mb-5">
          <h2 className="text-[11px] font-extrabold uppercase tracking-[.07em] mb-1" style={{ color: 'var(--cf-ink-2)' }}>Estados de cuenta</h2>
          <p className="text-[10px] text-[var(--cf-ink-3)] mb-2 leading-relaxed">Resumen de cada mes: lo que debia + lo que pidio + intereses - lo que pago = saldo nuevo.</p>
          <div className="space-y-2">
            {linea.cortesLinea.map((corte, idx) => (
              <Card key={corte.id} className="p-3" style={{ background: `linear-gradient(135deg, color-mix(in srgb, var(--cf-green-dark) 5%, var(--cf-card)) 0%, var(--cf-card) 100%)`, border: `1px solid color-mix(in srgb, var(--cf-green-dark) 14%, var(--cf-border))` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[var(--cf-ink)]">
                    {corte.periodo}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--cf-ink-3)]">
                      {new Date(corte.fechaCorte).toLocaleDateString('es')}
                    </span>
                    {esOwner && idx === 0 && (
                      <button
                        onClick={() => setEliminarCorte(corte)}
                        className="w-5 h-5 rounded-md flex items-center justify-center transition-colors hover:bg-[color-mix(in_srgb,var(--cf-red-dark)_20%,transparent)]"
                        title="Eliminar este corte"
                      >
                        <svg className="w-3 h-3" style={{ color: 'var(--cf-red-dark)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <span className="text-[var(--cf-ink-3)]">Saldo anterior</span>
                  <span className="text-right font-mono-display text-[var(--cf-ink)]">{formatMoney(corte.saldoAnterior)}</span>
                  <span className="text-[var(--cf-ink-3)]">Desembolsos</span>
                  <span className="text-right font-mono-display text-[var(--cf-ink)]">+{formatMoney(corte.totalDesembolsos)}</span>
                  <span className="text-[var(--cf-ink-3)]">Intereses</span>
                  <span className="text-right font-mono-display text-[var(--cf-gold-dark)]">+{formatMoney(corte.interesesGenerados)}</span>
                  <span className="text-[var(--cf-ink-3)]">Pagado</span>
                  <span className="text-right font-mono-display text-[var(--cf-gold)]">-{formatMoney(corte.totalPagado)}</span>
                  <span className="text-[var(--cf-ink-3)] font-semibold">Saldo nuevo</span>
                  <span className="text-right font-mono-display font-bold text-[var(--cf-ink)]">{formatMoney(corte.saldoNuevo)}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Movimientos */}
      <div>
        <h2 className="text-[11px] font-extrabold uppercase tracking-[.07em] mb-2" style={{ color: 'var(--cf-ink-2)' }}>
          Movimientos ({movimientos.length})
        </h2>
        {movimientos.length === 0 ? (
          <p className="text-center py-8 text-sm text-[var(--cf-ink-3)]">Sin movimientos</p>
        ) : (
          <div className="space-y-1.5">
            {movimientos.map(mov => (
              <div
                key={mov.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, ${mov.tipo === 'desembolso' ? 'var(--cf-gold-dark)' : 'var(--cf-green-dark)'} 6%, var(--cf-card)) 0%, var(--cf-card) 100%)`,
                  border: `1px solid color-mix(in srgb, ${mov.tipo === 'desembolso' ? 'var(--cf-gold-dark)' : 'var(--cf-green-dark)'} 16%, var(--cf-border))`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: mov.tipo === 'desembolso' ? 'color-mix(in srgb, var(--cf-gold-dark) 18%, transparent)' : `color-mix(in srgb, var(--cf-green-dark) 18%, transparent)`,
                  }}
                >
                  {mov.tipo === 'desembolso' ? (
                    <svg className="w-4 h-4" style={{ color: 'var(--cf-gold-dark)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 14l-4-4m4 4l4-4" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" style={{ color: 'var(--cf-green-dark)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m0-14l-4 4m4-4l4 4" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[var(--cf-ink)]">
                    {mov.tipo === 'desembolso' ? 'Desembolso' : 'Pago'}
                  </p>
                  <p className="text-[10px] text-[var(--cf-ink-3)]">
                    {new Date(mov.createdAt).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {mov.nota && ` · ${mov.nota}`}
                  </p>
                  {mov.tipo === 'pago' && mov.montoAInteres > 0 && (
                    <p className="text-[10px] text-[var(--cf-ink-3)]">
                      {formatMoney(mov.montoAInteres)} a interes · {formatMoney(mov.montoACapital)} a capital
                    </p>
                  )}
                </div>
                <p className={`text-sm font-mono-display font-bold shrink-0 ${mov.tipo === 'desembolso' ? 'text-[var(--cf-gold-dark)]' : 'text-[var(--cf-gold)]'}`}>
                  {mov.tipo === 'desembolso' ? '-' : '+'}{formatMoney(mov.tipo === 'desembolso' ? mov.monto : mov.montoTotal)}
                </p>
                {esOwner && esHoy(mov.createdAt) && (
                  <button
                    onClick={() => setEliminarMov(mov)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-[color-mix(in_srgb,var(--cf-red-dark)_15%,transparent)]"
                    title="Eliminar"
                  >
                    <svg className="w-3.5 h-3.5" style={{ color: 'var(--cf-red-dark)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
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
      {modalEstado && (
        <ModalCambiarEstado
          lineaId={linea.id}
          nuevoEstado={modalEstado}
          estadoActual={linea.estado}
          onClose={() => setModalEstado(null)}
          onSuccess={() => { setModalEstado(null); cargar() }}
        />
      )}
      {modalEliminarLinea && (
        <ModalEliminarLinea
          lineaId={linea.id}
          nombre={linea.cliente?.nombre}
          onClose={() => setModalEliminarLinea(false)}
          onSuccess={() => { setModalEliminarLinea(false); router.push('/lineas-credito') }}
        />
      )}
      {eliminarMov && (
        <ModalEliminarMovimiento
          lineaId={linea.id}
          mov={eliminarMov}
          onClose={() => setEliminarMov(null)}
          onSuccess={() => { setEliminarMov(null); cargar() }}
        />
      )}
      {eliminarCorte && (
        <ModalEliminarCorte
          lineaId={linea.id}
          corte={eliminarCorte}
          onClose={() => setEliminarCorte(null)}
          onSuccess={() => { setEliminarCorte(null); cargar() }}
        />
      )}
    </div>
  )
}

// ─── Modal: Desembolso ──────────────────────────────────────────
function ModalDesembolso({ lineaId, cupoDisponible, onClose, onSuccess }) {
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setError('')
    const val = Number(monto)
    if (!val || val <= 0) { setError('Ingresa un monto válido'); return }
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
      <div className="relative w-full sm:max-w-md bg-[var(--cf-surface)] rounded-t-[20px] sm:rounded-[20px] p-5 shadow-2xl">
        <h3 className="text-sm font-bold text-[var(--cf-ink)] mb-1">Registrar desembolso</h3>
        <p className="text-[11px] text-[var(--cf-ink-3)] mb-3">Registra el dinero que el cliente esta pidiendo de su cupo. Disponible: {formatMoney(cupoDisponible)}</p>

        <MoneyInput value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto" />
        <input
          type="text"
          value={nota}
          onChange={e => setNota(e.target.value)}
          placeholder="Nota (opcional)"
          className="w-full h-10 px-3 mt-3 rounded-xl bg-[var(--cf-card)] border border-[var(--cf-border)] text-sm text-[var(--cf-ink)] placeholder-[var(--cf-ink-3)]"
        />

        {error && <p className="text-xs text-[var(--cf-red-dark)] mt-2">{error}</p>}

        <div className="flex gap-2 mt-4">
          <Button onClick={onClose} variant="outline" className="flex-1" size="sm">Cancelar</Button>
          <Button onClick={guardar} loading={guardando} className="flex-1" size="sm">Desembolsar</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Pago ────────────────────────────────────────────────
function ModalPago({ lineaId, saldoTotal, onClose, onSuccess }) {
  const [monto, setMonto] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setError('')
    const val = Number(monto)
    if (!val || val <= 0) { setError('Ingresa un monto válido'); return }

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
      <div className="relative w-full sm:max-w-md bg-[var(--cf-surface)] rounded-t-[20px] sm:rounded-[20px] p-5 shadow-2xl">
        <h3 className="text-sm font-bold text-[var(--cf-ink)] mb-1">Registrar pago</h3>
        <p className="text-[11px] text-[var(--cf-ink-3)] mb-3">El pago primero cubre intereses pendientes y el resto va a capital, liberando cupo. Saldo actual: {formatMoney(saldoTotal)}</p>

        <MoneyInput value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto del pago" />

        <div className="flex gap-2 mt-3">
          {['efectivo', 'transferencia'].map(m => (
            <button
              key={m}
              onClick={() => setMetodoPago(m)}
              className="flex-1 h-9 rounded-xl text-xs font-medium transition-colors"
              style={{
                background: metodoPago === m ? 'var(--cf-gold)' : 'var(--cf-card)',
                color: metodoPago === m ? 'black' : 'var(--cf-ink-2)',
                border: `1px solid ${metodoPago === m ? 'var(--cf-gold)' : 'var(--cf-border)'}`,
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
          className="w-full h-10 px-3 mt-3 rounded-xl bg-[var(--cf-card)] border border-[var(--cf-border)] text-sm text-[var(--cf-ink)] placeholder-[var(--cf-ink-3)]"
        />

        {error && <p className="text-xs text-[var(--cf-red-dark)] mt-2">{error}</p>}

        <div className="flex gap-2 mt-4">
          <Button onClick={onClose} variant="outline" className="flex-1" size="sm">Cancelar</Button>
          <Button onClick={guardar} loading={guardando} className="flex-1" size="sm">Registrar pago</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Corte ───────────────────────────────────────────────
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
      <div className="relative w-full sm:max-w-md bg-[var(--cf-surface)] rounded-t-[20px] sm:rounded-[20px] p-5 shadow-2xl">
        <h3 className="text-sm font-bold text-[var(--cf-ink)] mb-2">Generar corte mensual</h3>
        <p className="text-xs text-[var(--cf-ink-3)] mb-4">
          Genera el estado de cuenta de este mes. Calcula cuanto debe el cliente sumando lo que ya debia, mas lo que pidio este mes, mas los intereses, menos lo que ha pagado. El resultado es el saldo que rota al siguiente mes.
        </p>

        {error && <p className="text-xs text-[var(--cf-red-dark)] mb-3">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={onClose} variant="outline" className="flex-1" size="sm">Cancelar</Button>
          <Button onClick={generar} loading={guardando} className="flex-1" size="sm">Generar corte</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Cambiar estado ──────────────────────────────────────
function ModalCambiarEstado({ lineaId, nuevoEstado, estadoActual, onClose, onSuccess }) {
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const mensajes = {
    congelada: {
      titulo: 'Congelar linea',
      texto: 'Al congelar la linea, no se podran hacer nuevos desembolsos. El cliente aun podra hacer pagos. Puedes reactivarla despues.',
      boton: 'Congelar',
    },
    activa: {
      titulo: 'Reactivar linea',
      texto: 'Al reactivar la linea, se permitiran nuevos desembolsos y pagos.',
      boton: 'Reactivar',
    },
    cerrada: {
      titulo: 'Cerrar linea',
      texto: 'Al cerrar la linea, no se podran hacer desembolsos ni pagos. Esta accion no se puede deshacer.',
      boton: 'Cerrar linea',
    },
  }

  const msg = mensajes[nuevoEstado]

  async function cambiar() {
    setError('')
    setGuardando(true)
    try {
      const res = await fetch(`/api/lineas-credito/${lineaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
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
      <div className="relative w-full sm:max-w-md bg-[var(--cf-surface)] rounded-t-[20px] sm:rounded-[20px] p-5 shadow-2xl">
        <h3 className="text-sm font-bold text-[var(--cf-ink)] mb-2">{msg.titulo}</h3>
        <p className="text-xs text-[var(--cf-ink-3)] mb-4">{msg.texto}</p>

        {error && <p className="text-xs text-[var(--cf-red-dark)] mb-3">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={onClose} variant="outline" className="flex-1" size="sm">Cancelar</Button>
          <Button
            onClick={cambiar}
            loading={guardando}
            className="flex-1"
            size="sm"
            variant={nuevoEstado === 'cerrada' ? 'danger' : undefined}
          >
            {msg.boton}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Eliminar linea ──────────────────────────────────────
function ModalEliminarLinea({ lineaId, nombre, onClose, onSuccess }) {
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function eliminar() {
    setError('')
    setGuardando(true)
    try {
      const res = await fetch(`/api/lineas-credito/${lineaId}`, { method: 'DELETE' })
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
      <div className="relative w-full sm:max-w-md bg-[var(--cf-surface)] rounded-t-[20px] sm:rounded-[20px] p-5 shadow-2xl">
        <h3 className="text-sm font-bold text-[var(--cf-ink)] mb-2">Eliminar línea de crédito</h3>
        <p className="text-xs text-[var(--cf-ink-3)] mb-4">
          Se eliminará la línea de crédito de <strong className="text-[var(--cf-ink)]">{nombre}</strong>. Esta acción no se puede deshacer.
        </p>

        {error && <p className="text-xs text-[var(--cf-red-dark)] mb-3">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={onClose} variant="outline" className="flex-1" size="sm">Cancelar</Button>
          <Button onClick={eliminar} loading={guardando} className="flex-1" size="sm" variant="danger">Eliminar</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Eliminar movimiento ─────────────────────────────────
function ModalEliminarMovimiento({ lineaId, mov, onClose, onSuccess }) {
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const esTipo = mov.tipo === 'desembolso'

  async function eliminar() {
    setError('')
    setGuardando(true)
    try {
      const endpoint = esTipo
        ? `/api/lineas-credito/${lineaId}/desembolso?desembolsoId=${mov.id}`
        : `/api/lineas-credito/${lineaId}/pago?pagoId=${mov.id}`
      const res = await fetch(endpoint, { method: 'DELETE' })
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
      <div className="relative w-full sm:max-w-md bg-[var(--cf-surface)] rounded-t-[20px] sm:rounded-[20px] p-5 shadow-2xl">
        <h3 className="text-sm font-bold text-[var(--cf-ink)] mb-2">
          Eliminar {esTipo ? 'desembolso' : 'pago'}
        </h3>
        <p className="text-xs text-[var(--cf-ink-3)] mb-1">
          Se eliminara el {esTipo ? 'desembolso' : 'pago'} de <strong className="text-[var(--cf-ink)]">{formatMoney(esTipo ? mov.monto : mov.montoTotal)}</strong>.
        </p>
        <p className="text-xs text-[var(--cf-ink-3)] mb-4">
          El saldo de la linea se recalculara automaticamente.
        </p>

        {error && <p className="text-xs text-[var(--cf-red-dark)] mb-3">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={onClose} variant="outline" className="flex-1" size="sm">Cancelar</Button>
          <Button onClick={eliminar} loading={guardando} className="flex-1" size="sm" variant="danger">Eliminar</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Modal: Eliminar corte ──────────────────────────────────────
function ModalEliminarCorte({ lineaId, corte, onClose, onSuccess }) {
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function eliminar() {
    setError('')
    setGuardando(true)
    try {
      const res = await fetch(`/api/lineas-credito/${lineaId}/corte?corteId=${corte.id}`, { method: 'DELETE' })
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
      <div className="relative w-full sm:max-w-md bg-[var(--cf-surface)] rounded-t-[20px] sm:rounded-[20px] p-5 shadow-2xl">
        <h3 className="text-sm font-bold text-[var(--cf-ink)] mb-2">Eliminar corte</h3>
        <p className="text-xs text-[var(--cf-ink-3)] mb-1">
          Se eliminara el corte del periodo <strong className="text-[var(--cf-ink)]">{corte.periodo}</strong>.
        </p>
        <p className="text-xs text-[var(--cf-ink-3)] mb-4">
          Los intereses y saldos se recalcularan. Solo se puede eliminar el ultimo corte.
        </p>

        {error && <p className="text-xs text-[var(--cf-red-dark)] mb-3">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={onClose} variant="outline" className="flex-1" size="sm">Cancelar</Button>
          <Button onClick={eliminar} loading={guardando} className="flex-1" size="sm" variant="danger">Eliminar corte</Button>
        </div>
      </div>
    </div>
  )
}
