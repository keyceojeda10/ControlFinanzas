'use client'
/* El selector % / $ y el campo de la cuota en pesos, iguales en todos los
 * formularios. La lógica vive en `hooks/useCuotaEnPesos.js` y la frase en
 * `notaCuotaEnPesos` (lib/dinero/interes-en-pesos.js). */
import MoneyInput from '@/components/ui/MoneyInput'
import { formatMoney } from '@/lib/i18n'
import { formatearTasa } from '@/lib/adaptadores/prestamos'
import { notaCuotaEnPesos } from '@/lib/dinero/interes-en-pesos'

/* `compacto`: al lado de un campo de dos columnas, el selector no puede hacer
   más alto su rótulo que el del vecino, o los dos campos quedan desalineados. */
export function SelectorPorcentajePesos({ enPesos, onElegir, compacto = false }) {
  return (
    <div role="radiogroup" aria-label="Escribir el interés en" className={`flex gap-1${compacto ? ' -my-1.5' : ''}`}>
      {[{ id: false, nombre: '%' }, { id: true, nombre: '$' }].map((o) => (
        <button key={o.nombre} type="button" role="radio" aria-checked={enPesos === o.id}
          onClick={() => onElegir(o.id)}
          className="h-7 min-w-[36px] px-2 rounded-[8px] text-[12px] font-bold"
          style={enPesos === o.id
            ? { background: 'var(--cf-ink)', color: 'var(--cf-surface)' }
            : { background: 'var(--cf-card)', color: 'var(--cf-ink-3)', border: '1px solid var(--cf-border)' }}>
          {o.nombre}
        </button>
      ))}
    </div>
  )
}

/** «Cuota diaria», o «Interés al mes» en el abierto. */
export function rotuloCuotaEnPesos(frecuencia, abierto) {
  return abierto
    ? `Interés ${{ diario: 'al día', semanal: 'por semana', quincenal: 'por quincena', mensual: 'al mes' }[frecuencia] || 'al mes'}`
    : `Cuota ${{ diario: 'diaria', semanal: 'semanal', quincenal: 'quincenal', mensual: 'mensual' }[frecuencia] || ''}`
}

export function NotaCuotaEnPesos(props) {
  const { alerta, texto } = notaCuotaEnPesos({ ...props, formatMoney, formatearTasa })
  return (
    <p className="text-[11px] mt-2" style={{ color: alerta ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>{texto}</p>
  )
}

/* `conNota={false}` en los formularios de dos columnas: la frase va debajo de
   la fila entera (con `NotaCuotaEnPesos`), no apretada bajo media columna. */
export function CampoCuotaEnPesos({ pesos, abierto = false, monto, tasa, modo, total, cuotas, tamano = 'normal', conNota = true }) {
  return (
    <>
      <MoneyInput value={pesos.cuota} onChange={(e) => pesos.setCuota(e.target.value)} tamano={tamano}
        placeholder={abierto ? '170.000' : '10.000'} />
      {conNota && <NotaCuotaEnPesos abierto={abierto} monto={monto} cuota={pesos.cuota} tasa={tasa}
        buscada={pesos.buscada} modo={modo} total={total} cuotas={cuotas} />}
    </>
  )
}
