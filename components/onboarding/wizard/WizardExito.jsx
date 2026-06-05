'use client'

import Link from 'next/link'
import { useCountry } from '@/hooks/useCountry'
import Confetti from '../Confetti'
import Mascota from '@/components/ui/Mascota'

const LABEL_FREQ = {
  diario: 'Cuota diaria',
  semanal: 'Cuota semanal',
  quincenal: 'Cuota quincenal',
  mensual: 'Cuota mensual',
}

export default function WizardExito({ cliente, prestamo, onFinish, onAddAnother }) {
  const { formatMoney } = useCountry()
  const labelCuota = LABEL_FREQ[prestamo?.frecuencia] ?? 'Cuota'

  return (
    <>
    <Confetti active={true} />
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      {/* Mascota celebrando */}
      <div className="mb-6 wizard-success-bounce">
        <Mascota variant="celebrate" size={130} />
      </div>

      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">¡Listo, ya tienes tu primer préstamo!</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-8">Tu cartera está activa. Estos son tus próximos pasos</p>

      {/* KPI preview */}
      <div className="w-full max-w-xs grid grid-cols-2 gap-3 mb-8">
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-3 py-3">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Cliente</p>
          <p className="text-sm font-bold text-[var(--color-accent)] truncate">{cliente?.nombre ?? '1 cliente'}</p>
        </div>
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-3 py-3">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Préstamo</p>
          <p className="text-sm font-bold text-[var(--color-success)]">{formatMoney(prestamo?.montoPrestado ?? 0)}</p>
        </div>
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-3 py-3">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Total a cobrar</p>
          <p className="text-sm font-bold text-[var(--color-warning)]">{formatMoney(prestamo?.totalAPagar ?? 0)}</p>
        </div>
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-3 py-3">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">{labelCuota}</p>
          <p className="text-sm font-bold text-[var(--color-purple)]">{formatMoney(prestamo?.cuotaDiaria ?? 0)}</p>
        </div>
      </div>

      {/* Próximos pasos */}
      <div className="w-full max-w-xs space-y-2 mb-7">
        <button
          onClick={onAddAnother}
          className="w-full flex items-center gap-3 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-4 py-3 hover:border-[var(--color-border-hover)] transition-all cursor-pointer text-left"
        >
          <div className="w-8 h-8 rounded-full bg-[rgba(245,197,24,0.12)] flex items-center justify-center shrink-0 text-[var(--color-accent)]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Agrega otro cliente</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Registra más clientes y sus préstamos</p>
          </div>
        </button>
        <Link
          href="/rutas"
          className="w-full flex items-center gap-3 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-4 py-3 hover:border-[var(--color-border-hover)] transition-all text-left"
        >
          <div className="w-8 h-8 rounded-full bg-[rgba(59,130,246,0.1)] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-[var(--color-info)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Crea una ruta de cobro</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Organiza clientes por zona y cobra con GPS</p>
          </div>
        </Link>
        <Link
          href="/cobradores/nuevo"
          className="w-full flex items-center gap-3 bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-4 py-3 hover:border-[var(--color-border-hover)] transition-all text-left"
        >
          <div className="w-8 h-8 rounded-full bg-[rgba(168,85,247,0.1)] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-[var(--color-purple)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Agrega un cobrador</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Dale acceso a tu equipo desde su celular</p>
          </div>
        </Link>
      </div>

      {/* CTA principal */}
      <button
        onClick={onFinish}
        className="w-full max-w-xs h-12 rounded-[12px] bg-[var(--color-accent)] text-[#111111] text-base font-bold transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] cursor-pointer"
      >
        Ir al dashboard
      </button>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-3">
        Puedes volver a estas opciones desde el menú en cualquier momento
      </p>
    </div>
    </>
  )
}
