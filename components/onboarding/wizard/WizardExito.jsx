'use client'

import { formatCOP } from '@/lib/calculos'
import Confetti from '../Confetti'

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
      {/* Success check */}
      <div className="w-20 h-20 rounded-full bg-[#22c55e] flex items-center justify-center mb-6 wizard-success-bounce">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">Tu cartera esta lista!</h1>
      <p className="text-sm text-[#888888] mb-8">Ya puedes empezar a gestionar tus cobros</p>

      {/* KPI preview */}
      <div className="w-full max-w-xs grid grid-cols-2 gap-3 mb-8">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-3 py-3">
          <p className="text-[10px] text-[#888888] mb-0.5">Cliente</p>
          <p className="text-sm font-bold text-[#f5c518] truncate">{cliente?.nombre ?? '1 cliente'}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-3 py-3">
          <p className="text-[10px] text-[#888888] mb-0.5">Prestamo</p>
          <p className="text-sm font-bold text-[#22c55e]">{formatCOP(prestamo?.montoPrestado ?? 0)}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-3 py-3">
          <p className="text-[10px] text-[#888888] mb-0.5">Total a cobrar</p>
          <p className="text-sm font-bold text-[#f59e0b]">{formatCOP(prestamo?.totalAPagar ?? 0)}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-[12px] px-3 py-3">
          <p className="text-[10px] text-[#888888] mb-0.5">{labelCuota}</p>
          <p className="text-sm font-bold text-[#a855f7]">{formatCOP(prestamo?.cuotaDiaria ?? 0)}</p>
        </div>
      </div>

      {/* CTAs */}
      <button
        onClick={onFinish}
        className="w-full max-w-xs h-12 rounded-[12px] bg-[#f5c518] text-[#111111] text-base font-bold transition-all hover:bg-[#f0b800] active:scale-[0.98] cursor-pointer"
      >
        Ir al dashboard
      </button>
      <button
        onClick={onAddAnother}
        className="mt-3 w-full max-w-xs h-10 rounded-[12px] bg-transparent border border-[#2a2a2a] text-sm font-medium text-[#888888] hover:text-white hover:border-[#444] transition-all cursor-pointer"
      >
        Agregar otro cliente
      </button>
      <p className="text-[10px] text-[#555555] mt-4">
        Puedes agregar mas clientes desde el dashboard
      </p>
    </div>
    </>
  )
}
