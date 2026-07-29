'use client'

// components/pantallas/FichaCliente.jsx — turno 39 (móvil) y 15 (1440).
//
// Un nivel por debajo de una lista: cabecera de detalle y SIN pastilla. Quien
// llega aquí vino de una lista, su salida natural es volver, y ofrecerle cinco
// destinos mientras decide si cobrarle es invitarlo a irse. Los 76px liberados
// se los queda el gráfico de comportamiento, que es lo que venía a buscar.
//
// LA PIEZA QUE JUSTIFICA LA PANTALLA: "Cómo paga". Doce barras que contestan
// una sola pregunta —¿este cómo paga?— y, debajo, LA FRASE QUE LAS LEE.
//
// Sin la frase, doce barras son doce barras: cada quien saca su conclusión y
// casi siempre la equivocada, porque el ojo se queda con el último mes. La
// frase dice el patrón: "Pagaba tarde pero cerraba el mes. Desde mayo viene
// fallando." Eso es lo que el dueño quiere saber antes de prestarle otra vez.

import { Tarjeta, BloqueOscuro, BarraAccion, BotonPrimario, BotonSecundario, Pastilla } from '@/components/cf/primitivos'

const COLOR = {
  bien:  'var(--cf-green)',
  tarde: 'var(--cf-gold)',
  mal:   'var(--cf-red)',
  nada:  'var(--cf-fill-2)',
}

/* Doce meses, uno por barra. La altura es cuánto pagó; el color, cómo lo pagó.
   Altura EXPLÍCITA en px: una barra con `height:%` dentro de un contenedor
   flex:1 desaparece si el contenedor colapsa (04-CRITERIOS §G). */
function ComoPaga({ meses = [], lectura }) {
  return (
    <Tarjeta>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
        Cómo paga
      </span>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 84, flex: 'none' }}>
        {meses.map((m, i) => (
          <span key={i} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: '100%',
              height: Math.max(4, Math.round((m.cumplio ?? 0) * 0.62)),
              borderRadius: 3,
              background: COLOR[m.estado] ?? COLOR.nada,
              flex: 'none',
            }} />
            <span className="cf-num" style={{ fontSize: 9, color: 'var(--cf-ink-4)', flex: 'none' }}>
              {m.etiqueta}
            </span>
          </span>
        ))}
      </div>

      {/* La frase NO es un adorno: es la conclusión. Doce barras sin lectura
          dejan que cada quien saque la suya, y el ojo se queda con el último
          mes. */}
      {lectura && (
        <>
          <span style={{ height: 1, background: 'var(--cf-hairline)' }} />
          <span style={{ fontSize: 13, color: 'var(--cf-ink)', lineHeight: 1.5 }}>{lectura}</span>
        </>
      )}
    </Tarjeta>
  )
}

function FilaPrestamo({ titulo, diasAtraso, estado = 'aldia', monto, cuota, primera, onAbrir }) {
  const color = estado === 'mora' ? 'var(--cf-red)' : estado === 'atraso' ? 'var(--cf-gold)' : 'var(--cf-green)'
  return (
    <button type="button" onClick={onAbrir} style={{
      position: 'relative', display: 'flex', alignItems: 'center', gap: 12, width: '100%', flex: 'none',
      minHeight: 68, padding: '12px 16px 12px 19px', cursor: 'pointer', textAlign: 'left',
      background: 'none', border: 0, borderTop: primera ? 0 : '1px solid var(--cf-hairline)',
    }}>
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: 12, bottom: 12, width: 4, borderRadius: 999, background: color,
      }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{
            flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: 'var(--cf-ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{titulo}</span>
          {diasAtraso > 0 && (
            <Pastilla tono={estado === 'mora' ? 'mora' : 'atraso'} numerica style={{ height: 19, fontSize: 9.5, flex: 'none' }}>
              {diasAtraso}d
            </Pastilla>
          )}
        </span>
        <span className="cf-num" style={{ display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)', marginTop: 3 }}>
          {cuota}
        </span>
      </span>
      <span className="cf-fig" style={{ fontSize: 17, color: 'var(--cf-ink)', flex: 'none' }}>{monto}</span>
    </button>
  )
}

export default function FichaCliente({
  debeTotal, pagado, totalAPagar, porcentaje,
  prestamos = [], meses = [], lectura,
  onAbrirPrestamo, onPrestar, onCobrar,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: '8px var(--cf-pad-screen) 16px' }}>

        <BloqueOscuro etiqueta="Debe en total" cifra={debeTotal}>
          {/* El denominador del porcentaje es el TOTAL A PAGAR. Llamarlo
              "prestados" lo convierte en una cifra que no cuadra con ninguna
              otra de la app. Se dice la resta entera y queda comprobable. */}
          <span className="cf-num" style={{ fontSize: 13, color: '#A3A8B2', marginTop: -4 }}>
            pagó {pagado} de {totalAPagar} · {porcentaje}%
          </span>
        </BloqueOscuro>

        {/* Los préstamos son filas, no tarjetas: el cliente es el objeto de esta
            pantalla y sus préstamos son partes de él. */}
        <Tarjeta plana>
          {prestamos.map((p, i) => (
            <FilaPrestamo key={i} {...p} primera={i === 0} onAbrir={() => onAbrirPrestamo?.(p)} />
          ))}
        </Tarjeta>

        <ComoPaga meses={meses} lectura={lectura} />
      </div>

      {/* "Prestarle otra vez" es la decisión que trajo al dueño hasta el
          gráfico; "Cobrarle" es la de hoy. La de hoy se lleva el dorado. */}
      <BarraAccion>
        <BotonSecundario style={{ flex: 1.2 }} onClick={onPrestar}>Prestarle otra vez</BotonSecundario>
        <BotonPrimario style={{ flex: 1 }} onClick={onCobrar}>Cobrarle</BotonPrimario>
      </BarraAccion>
    </div>
  )
}
