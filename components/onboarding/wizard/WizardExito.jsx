'use client'

import Link from 'next/link'
import { useCountry } from '@/hooks/useCountry'
import Confetti from '../Confetti'

const LABEL_FREQ = {
  diario:    'Cuota diaria',
  semanal:   'Cuota semanal',
  quincenal: 'Cuota quincenal',
  mensual:   'Cuota mensual',
}

function getNextSteps(flujo, cliente, prestamo) {
  const steps = []

  if (!cliente) {
    steps.push({
      href: '/clientes/nuevo',
      color: '#f5c518',
      bg: 'rgba(245,197,24,0.1)',
      titulo: 'Registra tu primer cliente',
      desc: 'Agrega un cliente para empezar a prestar.',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
        </svg>
      ),
    })
  } else if (prestamo) {
    steps.push({
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
    })
  } else {
    steps.push({
      href: '/prestamos/nuevo',
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.1)',
      titulo: 'Crea tu primer préstamo',
      desc: `Préstale a ${cliente.nombre} y empieza a cobrar.`,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    })
  }

  if (flujo === 'equipo') {
    steps.push({
      href: '/cobradores/nuevo',
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.1)',
      titulo: 'Agrega más cobradores',
      desc: 'Dale acceso a todo tu equipo desde su propio celular.',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    })
  } else {
    steps.push({
      href: '/rutas',
      color: '#3b82f6',
      bg: 'rgba(59,130,246,0.1)',
      titulo: 'Crea tu primera ruta de cobro',
      desc: 'Agrupa clientes por zona. Organiza mejor tus cobros diarios.',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
    })
  }

  steps.push({
    href: '/migrador',
    color: '#f5c518',
    bg: 'rgba(245,197,24,0.1)',
    titulo: 'Sube toda tu cartera',
    desc: 'Toma foto de tus cartulinas o sube un Excel con todos tus clientes.',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  })

  return steps
}

export default function WizardExito({ cliente, prestamo, flujo, onFinish }) {
  const { formatMoney } = useCountry()
  const labelCuota = LABEL_FREQ[prestamo?.frecuencia] ?? 'Cuota'
  const nextSteps = getNextSteps(flujo, cliente, prestamo)

  return (
    <>
      <Confetti active />
      <div className="flex flex-col items-center text-center px-2" style={{ minHeight: '78vh' }}>

        <div className="mb-5 mt-2">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
            style={{ background: 'rgba(245,197,24,0.15)' }}>
            <svg className="w-10 h-10" fill="none" stroke="#f5c518" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="text-[22px] font-bold mb-2 leading-tight" style={{ color: 'var(--color-text-primary)' }}>
          {prestamo ? '¡Tu primer préstamo está listo!' : '¡Ya conoces el sistema!'}
        </h1>
        <p className="text-[13px] mb-6 max-w-[260px] mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {prestamo
            ? 'Tu cartera está activa. Estos son los próximos pasos para sacarle el máximo provecho.'
            : 'Estos son los próximos pasos para arrancar con tu cartera.'}
        </p>

        {/* KPI preview */}
        {prestamo && (
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

        {/* Proximos pasos */}
        <div className="w-full max-w-xs space-y-2 mb-7">
          {nextSteps.map((s) => (
            <Link key={s.href} href={s.href}
              onClick={(e) => { e.preventDefault(); onFinish(); window.location.href = s.href }}
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
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="var(--color-text-muted)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>

        {/* CTA principal */}
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
