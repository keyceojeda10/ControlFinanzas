'use client'
/* Las cuentas guardadas en este teléfono: una tarjeta por cuenta, un toque para
   entrar. El nombre NO se recorta: baja de renglón (es lo que identifica).
   Sin dorado: aquí no hay monto ni acción primaria (DESIGN.md, «La plata es lo
   único que brilla»). */
const ROL = { owner: 'Dueño', cobrador: 'Cobrador', superadmin: 'Administrador' }

export default function CuentasGuardadas({ cuentas, onEntrar, onQuitar, onOtra, cargandoId = null }) {
  return (
    <div className="flex flex-col gap-3">
      {cuentas.map((c) => (
        <div key={c.id} className="flex items-center gap-3 rounded-[16px] px-4 py-3"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
          <button type="button" onClick={() => onEntrar(c)} disabled={!!cargandoId}
            className="flex items-center gap-3 flex-1 min-w-0 text-left"
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }}>
            <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[15px] font-bold"
              style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-2)' }}>
              {(c.nombre || '?').charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold break-words" style={{ color: 'var(--cf-ink)' }}>
                {cargandoId === c.id ? 'Entrando…' : c.nombre}
              </span>
              <span className="block text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>
                {[ROL[c.rol] ?? c.rol, c.orgNombre].filter(Boolean).join(' · ')}
              </span>
            </span>
          </button>
          <button type="button" onClick={() => onQuitar(c)} aria-label={`Quitar la cuenta de ${c.nombre} de este teléfono`}
            className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
            style={{ background: 'none', border: 0, color: 'var(--cf-ink-3)', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ))}
      <button type="button" onClick={onOtra} className="text-[14px] font-semibold mt-1 underline underline-offset-4"
        style={{ background: 'none', border: 0, color: 'var(--cf-ink)', cursor: 'pointer' }}>
        Entrar con otra cuenta
      </button>
    </div>
  )
}
