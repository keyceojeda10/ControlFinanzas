'use client'
/* El selector % / $ y el campo de la cuota en pesos, iguales en todos los
 * formularios. La lógica vive en `hooks/useCuotaEnPesos.js` y la frase en
 * `notaCuotaEnPesos` (lib/dinero/interes-en-pesos.js). */
import MoneyInput from '@/components/ui/MoneyInput'
import { formatMoney } from '@/lib/i18n'
import { formatearTasa } from '@/lib/adaptadores/prestamos'
import { notaCuotaEnPesos } from '@/lib/dinero/interes-en-pesos'

/* `compacto` se quedó por compatibilidad y ya no cambia nada. Era un margen
   negativo (`-my-1.5`) para no hacer más alto el rótulo que el del vecino, y
   dejaba el selector pegado al campo, a −2 px (el dueño, 17 oct 2026: «sale muy
   pegado al input»). La alineación de las dos columnas la da `FilaRotulo`. */
export function SelectorPorcentajePesos({ enPesos, onElegir, compacto = false }) {
  return (
    <div role="radiogroup" aria-label="Escribir el interés en" className="flex gap-1">
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

/** La fila del rótulo de un campo en los formularios de dos columnas: siempre
    28 px de alto (lo que mide el selector % / $) y 6 px hasta el campo. Las dos
    columnas la usan, lleven selector o no, y así los campos quedan a la misma
    altura sin márgenes negativos. */
export function FilaRotulo({ children, accion = null }) {
  return (
    <div className="h-7 mb-1.5 flex items-center justify-between gap-2">
      {children}
      {accion}
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
