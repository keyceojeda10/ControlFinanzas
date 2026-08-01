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
import CardWaves from '@/components/ui/CardWaves'
import { useTheme } from '@/lib/theme/ThemeProvider'

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

  // Los hooks van SIEMPRE antes de cualquier return temprano (regla de React).
  // Estaba abajo y la pagina crasheaba con "Rendered more hooks than during the
  // previous render" apenas terminaba de cargar.
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  if (authLoading || loading) {
    return <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
  }

  if (!linea) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-sm text-[var(--cf-ink-3)]">Línea no encontrada</p>
        <Button onClick={() => router.push('/lineas-credito')} size="sm" className="mt-4">Volver</Button>
      </div>
    )
  }

  const porcentajeUsado = linea.cupoMaximo > 0
    ? Math.round((linea.capitalUsado || 0) / linea.cupoMaximo * 100)
    : 0

  const METAL = isDark
    ? {
        grad: 'linear-gradient(135deg, #0a1628 0%, #112244 25%, #1e3a6e 50%, #153060 75%, #0d1f3d 100%)',
        ink: '#e0ecff',
        sub: 'rgba(180, 210, 255, 0.65)',
        accent: '#60a5fa',
        track: 'rgba(96, 165, 250, 0.16)',
        border: 'rgba(96, 165, 250, 0.35)',
        shadow: '0 10px 28px rgba(0, 0, 0, 0.50)',
        waves: 'rgba(100, 180, 255, 0.09)',
        frost: 'rgba(140, 200, 255, 0.08)',
        sheen: 'linear-gradient(105deg, transparent 30%, rgba(120,180,255,0.10) 45%, rgba(200,225,255,0.14) 50%, rgba(120,180,255,0.10) 55%, transparent 70%)',
      }
    : {
        grad: 'linear-gradient(135deg, #1e40af 0%, #2563eb 25%, #3b82f6 50%, #2563eb 75%, #1e40af 100%)',
        ink: '#ffffff',
        sub: 'rgba(255, 255, 255, 0.72)',
        accent: '#bfdbfe',
        track: 'rgba(255, 255, 255, 0.18)',
        border: 'rgba(255, 255, 255, 0.25)',
        shadow: '0 8px 28px rgba(30, 64, 175, 0.30)',
        waves: 'rgba(255, 255, 255, 0.08)',
        frost: 'rgba(255, 255, 255, 0.06)',
        sheen: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.12) 55%, transparent 70%)',
      }

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

  return (
    <div className="max-w-2xl lg:max-w-5xl mx-auto px-4 py-6 pb-28">
      {/* Hero card azul metalizado */}
      <div
        className="relative rounded-[20px] overflow-hidden mb-4"
        style={{
          background: METAL.grad,
          border: `1px solid ${METAL.border}`,
          boxShadow: METAL.shadow,
        }}
      >
        <CardWaves tint={METAL.waves} />
        {/* Brillo metalizado diagonal */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: METAL.sheen }}
        />
        {/* Escarcha: puntos brillantes dispersos */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: isDark
              ? 'radial-gradient(1px 1px at 15% 25%, rgba(180,220,255,0.5), transparent), radial-gradient(1px 1px at 45% 65%, rgba(180,220,255,0.35), transparent), radial-gradient(1.5px 1.5px at 75% 15%, rgba(200,230,255,0.55), transparent), radial-gradient(1px 1px at 85% 75%, rgba(180,220,255,0.3), transparent), radial-gradient(1px 1px at 55% 40%, rgba(180,220,255,0.4), transparent), radial-gradient(1.5px 1.5px at 25% 80%, rgba(200,230,255,0.45), transparent)'
              : 'radial-gradient(1px 1px at 15% 25%, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 45% 65%, rgba(255,255,255,0.5), transparent), radial-gradient(1.5px 1.5px at 75% 15%, rgba(255,255,255,0.8), transparent), radial-gradient(1px 1px at 85% 75%, rgba(255,255,255,0.45), transparent), radial-gradient(1px 1px at 55% 40%, rgba(255,255,255,0.6), transparent), radial-gradient(1.5px 1.5px at 25% 80%, rgba(255,255,255,0.65), transparent)',
          }}
        />
        {/* Orbe luminoso */}
        <div
          className="absolute -top-16 -right-16 w-52 h-52 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${METAL.accent}30, transparent 65%)`, filter: 'blur(20px)' }}
        />

        <div className="relative px-5 py-5">
          <div className="flex items-start gap-3 mb-4">
            <Avatar
              nombre={linea.cliente?.nombre}
              fotoUrl={linea.cliente?.fotoUrl}
              size={44}
              fontSize={15}
              style={{ border: `2px solid color-mix(in srgb, ${METAL.ink} 25%, transparent)` }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold leading-tight" style={{ color: METAL.ink }}>{linea.cliente?.nombre}</p>
              <p className="text-[11px] mt-0.5" style={{ color: METAL.sub }}>CC {linea.cliente?.cedula} · Corte día {linea.diaCorte}</p>
            </div>
            <span
              className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{
                background: `color-mix(in srgb, ${METAL.accent} 14%, transparent)`,
                color: METAL.accent,
                border: `1px solid color-mix(in srgb, ${METAL.accent} 26%, transparent)`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: METAL.accent }} />
              {linea.estado.charAt(0).toUpperCase() + linea.estado.slice(1)}
            </span>
          </div>

          {/* Cupo visual */}
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: METAL.sub }}>Cupo</p>
              <p className="text-sm font-mono-display font-bold mt-0.5" style={{ color: METAL.ink }}>{formatMoney(linea.cupoMaximo)}</p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: METAL.sub }}>Usado</p>
              <p className="text-sm font-mono-display font-bold mt-0.5" style={{ color: METAL.ink }}>{formatMoney(linea.capitalUsado || 0)}</p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: METAL.sub }}>Disponible</p>
              <p className="text-sm font-mono-display font-bold mt-0.5" style={{ color: METAL.accent }}>{formatMoney(linea.cupoDisponible || 0)}</p>
            </div>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span style={{ color: METAL.sub }}>Uso del cupo</span>
              <span className="font-mono-display font-bold" style={{ color: porcentajeUsado > 80 ? 'var(--cf-red-dark)' : METAL.accent }}>{porcentajeUsado}%</span>
            </div>
            <div className="h-[5px] rounded-full overflow-hidden" style={{ background: METAL.track }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.max(porcentajeUsado, 2)}%`,
                  background: porcentajeUsado > 80
                    ? 'var(--cf-red-dark)'
                    : METAL.accent,
                }}
              />
            </div>
          </div>

          {(linea.interesesPendientes || 0) > 0 && (
            <div
              className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-[12px] mb-2"
              style={{ background: `color-mix(in srgb, var(--cf-gold-dark) 12%, transparent)`, border: `1px solid color-mix(in srgb, var(--cf-gold-dark) 20%, transparent)` }}
            >
              <span style={{ color: METAL.sub }}>Intereses pendientes</span>
              <span className="font-mono-display font-bold text-[var(--cf-gold-dark)]">{formatMoney(linea.interesesPendientes)}</span>
            </div>
          )}

          <div
            className="pt-2.5 mt-1"
            style={{ borderTop: `1px solid ${METAL.track}` }}
          >
            <div className="flex items-center justify-between text-[11px] px-1">
              <span style={{ color: METAL.sub }}>Tasa: {linea.tasaInteres}% mensual</span>
              <span style={{ color: METAL.sub }}>
                {linea.modoInteres === 'fijo_mensual' ? 'Interés fijo mensual' : linea.modoInteres === 'diario_saldo' ? 'Interés diario sobre saldo' : 'Interés al corte'}
              </span>
            </div>
            <p className="text-[10px] px-1 mt-1.5 leading-relaxed" style={{ color: METAL.sub }}>
              El cupo es el máximo que puede tener en uso. Cada vez que pide plata baja el disponible, y cada vez que paga sube de nuevo.
            </p>
          </div>
        </div>
      </div>

      {/* Acciones principales */}
      {linea.estado !== 'cerrada' && (
        <div className="flex gap-2 mb-3">
          {linea.estado === 'activa' && (
            <>
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
            </>
          )}
          {linea.estado === 'congelada' && (
            <Button onClick={() => setModalPago(true)} className="flex-1" size="sm">
              Registrar pago
            </Button>
          )}
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
              <Card key={corte.id} className="p-3" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${METAL.accent} 5%, var(--cf-card)) 0%, var(--cf-card) 100%)`, border: `1px solid color-mix(in srgb, ${METAL.accent} 14%, var(--cf-border))` }}>
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
                  background: `linear-gradient(135deg, color-mix(in srgb, ${mov.tipo === 'desembolso' ? 'var(--cf-gold-dark)' : METAL.accent} 6%, var(--cf-card)) 0%, var(--cf-card) 100%)`,
                  border: `1px solid color-mix(in srgb, ${mov.tipo === 'desembolso' ? 'var(--cf-gold-dark)' : METAL.accent} 16%, var(--cf-border))`,
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: mov.tipo === 'desembolso' ? 'color-mix(in srgb, var(--cf-gold-dark) 18%, transparent)' : `color-mix(in srgb, ${METAL.accent} 18%, transparent)`,
                  }}
                >
                  {mov.tipo === 'desembolso' ? (
                    <svg className="w-4 h-4" style={{ color: 'var(--cf-gold-dark)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 14l-4-4m4 4l4-4" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" style={{ color: METAL.accent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
