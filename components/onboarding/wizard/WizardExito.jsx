'use client'

import { formatCOP } from '@/lib/calculos'
import Confetti from '../Confetti'
import Mascota from '@/components/ui/Mascota'

const LABEL_FREQ = {
  diario: 'Cuota diaria',
  semanal: 'Cuota semanal',
  quincenal: 'Cuota quincenal',
  mensual: 'Cuota mensual',
}

export default function WizardExito({ cliente, prestamo, onFinish, onAddAnother }) {
  const labelCuota = LABEL_FREQ[prestamo?.frecuencia] ?? 'Cuota'

  return (
    <>
    <Confetti active={true} />
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      {/* Mascota celebrando */}
      <div className="mb-6 wizard-success-bounce">
        <Mascota variant="celebrate" size={130} />
      </div>

      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">¡Tu cartera está lista!</h1>
      <p className="text-sm text-[var(--color-text-muted)] mb-8">Ya puedes empezar a gestionar tus cobros</p>

      {/* KPI preview */}
      <div className="w-full max-w-xs grid grid-cols-2 gap-3 mb-8">
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-3 py-3">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Cliente</p>
          <p className="text-sm font-bold text-[var(--color-accent)] truncate">{cliente?.nombre ?? '1 cliente'}</p>
        </div>
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-3 py-3">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Préstamo</p>
          <p className="text-sm font-bold text-[var(--color-success)]">{formatCOP(prestamo?.montoPrestado ?? 0)}</p>
        </div>
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-3 py-3">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">Total a cobrar</p>
          <p className="text-sm font-bold text-[var(--color-warning)]">{formatCOP(prestamo?.totalAPagar ?? 0)}</p>
        </div>
        <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-[12px] px-3 py-3">
          <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5">{labelCuota}</p>
          <p className="text-sm font-bold text-[var(--color-purple)]">{formatCOP(prestamo?.cuotaDiaria ?? 0)}</p>
        </div>
      </div>

      {/* CTAs */}
      <button
        onClick={onFinish}
        className="w-full max-w-xs h-12 rounded-[12px] bg-[var(--color-accent)] text-[#111111] text-base font-bold transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] cursor-pointer"
      >
        Ir al dashboard
      </button>
      <button
        onClick={onAddAnother}
        className="mt-3 w-full max-w-xs h-10 rounded-[12px] bg-transparent border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[#444] transition-all cursor-pointer"
      >
        Agregar otro cliente
      </button>
      <p className="text-[10px] text-[var(--color-text-muted)] mt-4">
        Puedes agregar más clientes desde el dashboard
      </p>
    </div>
    </>
  )
}
