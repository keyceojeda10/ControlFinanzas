'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCountry } from '@/hooks/useCountry'
import Confetti from '../Confetti'

const LABEL_FREQ = {
  diario:    'Cuota diaria',
  semanal:   'Cuota semanal',
  quincenal: 'Cuota quincenal',
  mensual:   'Cuota mensual',
}

const NEXT_STEPS_DEMO = [
  {
    href: '/clientes/nuevo',
    color: '#f5c518',
    bg: 'rgba(245,197,24,0.1)',
    titulo: 'Registra tu primer cliente real',
    desc: 'Ya viste cómo funciona. Ahora hazlo con tu cartera real.',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    href: '/rutas',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.1)',
    titulo: 'Crea tu primera ruta de cobro',
    desc: 'Agrupa clientes por zona. Tu cobrador ve el recorrido del día.',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    href: '/cobradores/nuevo',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.1)',
    titulo: 'Agrega un cobrador',
    desc: 'Crea su cuenta. Cobra desde el celular. Tú ves el reporte al instante.',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

const NEXT_STEPS_REAL = [
  {
    href: '/prestamos',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.1)',
    titulo: 'Registra el primer cobro',
    desc: 'Abre el préstamo y toca "Registrar pago". Funciona sin internet.',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: '/rutas',
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.1)',
    titulo: 'Crea tu primera ruta de cobro',
    desc: 'Agrupa clientes por zona. Tu cobrador ve el recorrido del día.',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    href: '/cobradores/nuevo',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.1)',
    titulo: 'Agrega un cobrador',
    desc: 'Dale acceso a tu equipo desde su propio celular.',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export default function WizardExito({ cliente, prestamo, modoDemo, onFinish }) {
  const { formatMoney } = useCountry()
  const [limpiando, setLimpiando] = useState(false)
  const [limpiezaLista, setLimpiezaLista] = useState(false)
  const labelCuota = LABEL_FREQ[prestamo?.frecuencia] ?? 'Cuota'
  const nextSteps = modoDemo ? NEXT_STEPS_DEMO : NEXT_STEPS_REAL

  // Cleanup automático demo en background al montar
  useEffect(() => {
    if (!modoDemo || !cliente?.id) return
    setLimpiando(true)
    fetch('/api/onboarding/demo-cleanup', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clienteId: cliente.id, prestamoId: prestamo?.id }),
    })
      .then(() => setLimpiezaLista(true))
      .catch(() => setLimpiezaLista(true))
      .finally(() => setLimpiando(false))
  }, [modoDemo, cliente?.id])

  return (
    <>
      <Confetti active />
      <div className="flex flex-col items-center text-center px-2" style={{ minHeight: '78vh' }}>

        {/* Icon check */}
        <div className="mb-5 mt-2">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
            style={{ background: modoDemo ? 'rgba(167,139,250,0.15)' : 'rgba(245,197,24,0.15)' }}>
            <svg className="w-10 h-10" fill="none" stroke={modoDemo ? '#a78bfa' : '#f5c518'} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-[22px] font-bold mb-2 leading-tight" style={{ color: 'var(--color-text-primary)' }}>
          {modoDemo ? '¡Ya viste cómo funciona!' : '¡Tu primer préstamo está listo!'}
        </h1>
        <p className="text-[13px] mb-6 max-w-[260px] mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {modoDemo
            ? 'Ahora sabes cómo crear clientes y préstamos. Los datos demo ya fueron borrados — tu cuenta está limpia.'
            : 'Tu cartera está activa. Estos son los próximos pasos para sacarle el máximo provecho.'}
        </p>

        {/* KPI preview — modo real */}
        {!modoDemo && prestamo && (
          <div className="w-full max-w-xs grid grid-cols-2 gap-2.5 mb-7">
            {[
              { label: 'Cliente',       value: cliente?.nombre ?? '—',               color: '#f5c518' },
              { label: 'Prestado',      value: formatMoney(prestamo.montoPrestado),   color: '#22c55e' },
              { label: 'Total a cobrar',value: formatMoney(prestamo.totalAPagar),     color: '#f97316' },
              { label: labelCuota,      value: formatMoney(prestamo.cuotaDiaria),     color: '#a78bfa' },
            ].map((k) => (
              <div key={k.label} className="rounded-[12px] px-3 py-3 text-left"
                style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
                <p className="text-[10px] mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{k.label}</p>
                <p className="text-[13px] font-bold truncate" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Demo cleanup status */}
        {modoDemo && (
          <div className="w-full max-w-xs mb-6 flex items-center gap-2 px-4 py-3 rounded-[12px]"
            style={{
              background: limpiezaLista ? 'rgba(34,197,94,0.08)' : 'rgba(167,139,250,0.08)',
              border: `1px solid ${limpiezaLista ? 'rgba(34,197,94,0.2)' : 'rgba(167,139,250,0.2)'}`,
            }}>
            {limpiando ? (
              <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#a78bfa" strokeWidth="4" />
                <path className="opacity-75" fill="#a78bfa" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke={limpiezaLista ? '#22c55e' : '#a78bfa'} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={limpiezaLista ? 'M5 13l4 4L19 7' : 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} />
              </svg>
            )}
            <p className="text-[11px]" style={{ color: limpiezaLista ? '#22c55e' : '#a78bfa' }}>
              {limpiando
                ? 'Borrando datos demo...'
                : limpiezaLista
                  ? 'Datos demo eliminados. Cuenta limpia.'
                  : 'Limpiando datos demo...'}
            </p>
          </div>
        )}

        {/* Próximos pasos */}
        <div className="w-full max-w-xs space-y-2 mb-7">
          {nextSteps.map((s) => (
            <Link key={s.href} href={s.href}
              className="w-full flex items-center gap-3 rounded-[12px] px-4 py-3 text-left transition-all"
              style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: s.bg, color: s.color }}>
                {s.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>{s.titulo}</p>
                <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{s.desc}</p>
              </div>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="#33334a" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onFinish}
          className="w-full max-w-xs h-12 rounded-[12px] text-base font-bold transition-all active:scale-[0.98] cursor-pointer mb-1"
          style={{ background: '#f5c518', color: '#111' }}>
          Ir al dashboard
        </button>
        <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          Estas opciones también están en el menú lateral
        </p>
      </div>
    </>
  )
}
