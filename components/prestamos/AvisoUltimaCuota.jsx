// components/prestamos/AvisoUltimaCuota.jsx
//
// ══ POR QUE EXISTE ══════════════════════════════════════════════════════════
//
// Prestamos Rincon, dos veces, la ultima el 17 ago 2026:
//
//   «cuando se va a crear un prestamo, cuando se escoge el interes a saldo
//    (sistema frances) siempre el calculo es incorrecto: la ultima cuota queda
//    en $0, o un valor inferior, o incluso un valor exageradamente grande, y el
//    valor de las cuotas por ende no son los que corresponden»
//
// ── LO QUE DIJO LA MEDIDA ───────────────────────────────────────────────────
//
// 115 prestamos a saldo con tabla en produccion. 22 tienen la ultima cuota
// fuera de +-10% de las demas, y LOS 22 llevan cuota escrita a mano. Ninguno de
// los que deja calcular la cuota. Los de Rincon salen perfectos: 11 cuotas de
// $120.700 y la ultima de $120.530.
//
// O sea que la cuenta NO esta mal. Monto, tasa, plazo y cuota son cuatro cifras
// y solo tres pueden ir libres: al fijar la cuota a mano, la ultima recoge lo
// que sobra o lo que falta. Con $430.000 en 6 cobros, las cinco primeras saldan
// la deuda y la sexta queda en $0. Con $500.000 en 13, faltan $1.527.611.
//
// ── LO QUE SI ESTABA MAL ────────────────────────────────────────────────────
//
// La pantalla. En crear y en editar la ultima cuota NO SE DECIA EN NINGUN LADO
// —solo en el resumen del wizard de estreno, y ahi en gris de 10px—, asi que el
// prestamista veia «Cuota $430.000 x 6 cobros» y la realidad eran 5 cobros y un
// $0. Sin ese dato, la unica lectura posible es que el sistema calcula mal.
//
// Este aviso dice la consecuencia con las dos cifras y ofrece las dos salidas
// que existen. Los botones son opcionales: quien no los pase se lleva la
// explicacion igual.
//
// ⚠ LAS DOS SALIDAS NO SON LA MISMA, Y SE COMPROBO RECALCULANDO:
//
//   · Cambiar la CUOTA a `cuotaQueCuadra` deja las N iguales. Esa si iguala.
//   · Cambiar el PLAZO a `periodosParaSaldar` NO iguala: sigue habiendo una
//     cola, solo que pequena en vez de una fila fantasma o un cierre disparado
//     (Teresa: con 13 cobros cerraba con $1.071.754; con 15, con $105.359).
//
// Por eso el segundo se ofrece con su cifra en la mano. Vender el plazo como
// «asi cuadra» seria repetir el problema que traia: prometer una cosa en
// pantalla y entregar otra en la tabla.

import { useState, useEffect } from 'react'
import { formatMoney } from '@/lib/i18n'

export default function AvisoUltimaCuota({ calculo, onCuota, onPlazo }) {
  const { cuotaDiaria, ultimaCuota, numPeriodos, cuotaQueCuadra, periodosParaSaldar, ultimaAlSaldar } = calculo ?? {}
  /* Cambiar el plazo solo sirve si son otros: proponer «cobrar 6 veces»
     cuando ya son 6 es un botón que no hace nada. */
  const otroPlazo = periodosParaSaldar > 0 && periodosParaSaldar !== numPeriodos
  const desencajada = !!calculo?.ultimaDesencajada

  /* Se espera a que pare de escribir. Tecleando «430000» el calculo pasa por 4,
     43, 430… y con cada tecla la ultima cuota se dispara: el aviso entraria y
     saldria seis veces. Igual que el aviso rojo de cuota insuficiente, solo se
     retrasa lo que se PINTA. */
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!desencajada) { setVisible(false); return }
    const t = setTimeout(() => setVisible(true), 900)
    return () => clearTimeout(t)
  }, [desencajada, cuotaDiaria, numPeriodos])

  if (!visible) return null

  return (
    <div
      className="mt-2 rounded-[12px] p-3"
      style={{
        background: 'color-mix(in srgb, var(--cf-gold-dark) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 30%, transparent)',
      }}
    >
      <p className="text-[12px] font-semibold" style={{ color: 'var(--cf-gold-dark)' }}>
        La última cuota no queda igual que las demás
      </p>
      <p className="text-[11px] mt-1" style={{ color: 'var(--cf-ink-2)' }}>
        Con {formatMoney(cuotaDiaria)} en {numPeriodos} cobros, la última queda en{' '}
        <span className="font-mono-display font-semibold">{formatMoney(ultimaCuota)}</span>. No es un
        error de la cuenta: al poner tú la cuota, es la última la que recoge la diferencia.
      </p>
      {(cuotaQueCuadra > 0 || otroPlazo) && (
        <ul className="text-[11px] mt-1.5 space-y-0.5 list-disc pl-4" style={{ color: 'var(--cf-ink-2)' }}>
          {cuotaQueCuadra > 0 && (
            <li>Con {formatMoney(cuotaQueCuadra)} las {numPeriodos} quedan iguales.</li>
          )}
          {/* ⚠ Cambiar el plazo NO las iguala: deja una cola más pequeña. Se
              dice con su cifra, porque prometer que «cuadra» sería mentira. */}
          {otroPlazo && (
            <li>
              Con {formatMoney(cuotaDiaria)} la deuda se salda en {periodosParaSaldar} cobros
              {ultimaAlSaldar > 0 ? `, y el último sería de ${formatMoney(ultimaAlSaldar)}` : ''}.
            </li>
          )}
        </ul>
      )}
      {(onCuota || onPlazo) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {onCuota && cuotaQueCuadra > 0 && (
            <button
              type="button"
              onClick={() => onCuota(cuotaQueCuadra)}
              className="h-8 px-3 rounded-[10px] text-[11px] font-semibold"
              style={{ background: 'var(--cf-gold)', color: 'var(--cf-ink)' }}
            >
              Todas de {formatMoney(cuotaQueCuadra)}
            </button>
          )}
          {onPlazo && otroPlazo && (
            <button
              type="button"
              onClick={() => onPlazo(periodosParaSaldar)}
              className="h-8 px-3 rounded-[10px] text-[11px] font-semibold border"
              style={{ borderColor: 'var(--cf-border)', color: 'var(--cf-ink-2)' }}
            >
              Cobrar {periodosParaSaldar} veces
            </button>
          )}
        </div>
      )}
    </div>
  )
}
