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

import { useState } from 'react'
import { Tarjeta, BloqueOscuro, BarraAccion, BotonPrimario, BotonSecundario, Pastilla } from '@/components/cf/primitivos'

const COLOR = {
  bien:  'var(--cf-green)',
  tarde: 'var(--cf-gold)',
  mal:   'var(--cf-red)',
  nada:  'var(--cf-fill-2)',
}

/* ── «CÓMO PAGA», REHECHO EL 20 SEP 2026 ──────────────────────────────────────
   El dueño: «ese "cómo paga" no se entiende una mierda… sería súper útil si se
   entendiera el gráfico y hubiese algo más textual».

   Lo que no se entendía, mirándolo con sus ojos:
     · los meses iban con UNA letra —«O N D E F M A M J J A S»—: hay dos M, dos J
       y dos A, y nada decía que fueran meses;
     · los meses SIN préstamo se pintaban como rayitas grises, iguales a un dato;
     · ninguna escala, ninguna leyenda: una barra verde y dos rojas, ¿de qué?;
     · y la conclusión era una frase suelta —«Viene fallando.»— sin una cifra.

   Ahora va al revés: PRIMERO las palabras y la plata, después la gráfica que las
   respalda.
     1. El veredicto, grande, con su tono.
     2. La cuenta que lo sostiene: «de $375.000 que le tocaban, pagó $75.000».
     3. Solo los meses en que tuvo préstamo, con su nombre, su porcentaje encima
        y el riel de «lo que le tocaba» detrás. Tocar una barra dice ese mes en
        plata.
     4. La leyenda de los tres colores.

   Altura EXPLÍCITA en px: una barra con `height:%` dentro de un contenedor
   flex:1 desaparece si el contenedor colapsa (04-CRITERIOS §G). */
// Se EXPORTA para poder montarla sola. La ficha entera no se monta en
// `clientes/[id]`: esa pantalla tiene cartulina, tip, score, contacto, portal,
// tope y lineas de credito, y cambiarla por estas 156 lineas quitaria todo eso.
// Lo que aqui hace falta es la pieza que la ficha AÑADE.
const TONO = {
  bien:    { color: 'var(--cf-green-dark)', fondo: 'color-mix(in srgb, var(--cf-green) 13%, transparent)' },
  regular: { color: 'var(--cf-gold-text, var(--cf-gold-dark))', fondo: 'var(--cf-gold-tint)' },
  mal:     { color: 'var(--cf-red-dark)', fondo: 'color-mix(in srgb, var(--cf-red) 12%, transparent)' },
  sin:     { color: 'var(--cf-ink-3)', fondo: 'var(--cf-fill)' },
}
const LEYENDA = [
  { estado: 'bien', texto: 'Pagó completo' },
  { estado: 'tarde', texto: 'Pagó una parte' },
  { estado: 'mal', texto: 'Casi nada' },
]
const ALTO_BARRA = 96

export function ComoPaga({ meses = [], lectura, resumen, formatear = (n) => `$${Math.round(n).toLocaleString('es-CO')}` }) {
  const [abierto, setAbierto] = useState(null)
  // Solo desde el primer mes en que tuvo préstamo: lo de antes no es «no pagó»,
  // es que no había nada que pagar.
  const primero = meses.findIndex((m) => m.cumplio !== null && m.cumplio !== undefined)
  const visibles = primero === -1 ? [] : meses.slice(primero)
  const tono = TONO[resumen?.veredicto] ?? TONO.sin
  const elegido = abierto !== null ? visibles[abierto] : null

  return (
    <Tarjeta>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
        Cómo paga
      </span>

      {/* 1 y 2 · El veredicto y la cuenta que lo sostiene. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <span className="cf-fig" style={{ fontSize: 22, letterSpacing: '-.025em', lineHeight: 1.1, color: 'var(--cf-ink)' }}>
            {resumen?.titulo ?? 'Todavía no hay historial'}
          </span>
          {resumen?.pct != null && (
            <span className="cf-num" style={{
              height: 26, padding: '0 11px', borderRadius: 999, display: 'inline-flex', alignItems: 'center',
              fontSize: 13, fontWeight: 700, color: tono.color, background: tono.fondo, flex: 'none',
            }}>{resumen.pct}% de lo que le tocaba</span>
          )}
        </div>
        {resumen?.esperado > 0 && (
          <span style={{ fontSize: 14, color: 'var(--cf-ink-2)', lineHeight: 1.5 }}>
            {resumen.cuantos === 1
              ? `En ${resumen.hasta} le tocaba pagar `
              : `Entre ${resumen.desde} y ${resumen.hasta} le tocaba pagar `}
            <strong className="cf-num" style={{ color: 'var(--cf-ink)' }}>{formatear(resumen.esperado)}</strong>
            {' y pagó '}
            <strong className="cf-num" style={{ color: tono.color }}>{formatear(resumen.pagado)}</strong>.
            {resumen.tendencia ? ` ${resumen.tendencia}` : ''}
          </span>
        )}
        {!resumen && lectura && (
          <span style={{ fontSize: 14, color: 'var(--cf-ink-2)', lineHeight: 1.5 }}>{lectura}</span>
        )}
      </div>

      {/* 3 · Mes a mes. */}
      {visibles.length > 0 && (
        <>
          <span style={{ height: 1, background: 'var(--cf-hairline)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-ink-3)' }}>
            Mes a mes: cuánto pagó de lo que le tocaba
          </span>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flex: 'none' }}>
            {visibles.map((m, i) => {
              const sinPrestamo = m.cumplio === null || m.cumplio === undefined
              const pct = m.cumplio ?? 0
              const activo = abierto === i
              /* UN MES SIN PRÉSTAMO NO ES «0 %». Se pintaba igual que un mes en
                 que no pagó nada, y un cliente que terminó en junio parecía
                 llevar tres meses sin pagar. Va hueco, con raya, y no se toca. */
              if (sinPrestamo) {
                return (
                  <span key={`${m.anio}-${m.corta}-${i}`} style={{ flex: 1, minWidth: 0, maxWidth: 46, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <span className="cf-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--cf-ink-4)' }}>—</span>
                    <span style={{ width: '100%', height: ALTO_BARRA, borderRadius: 6, border: '1.5px dashed var(--cf-border-strong)', flex: 'none' }} />
                    <span className="cf-num" style={{ fontSize: 11, fontWeight: 500, color: 'var(--cf-ink-4)' }}>{m.corta ?? m.etiqueta}</span>
                  </span>
                )
              }
              return (
                <button
                  key={`${m.anio}-${m.corta}-${i}`} type="button"
                  onClick={() => setAbierto(activo ? null : i)}
                  aria-pressed={activo}
                  aria-label={`${m.nombre}: pagó el ${pct} por ciento`}
                  style={{
                    flex: 1, minWidth: 0, maxWidth: 46, padding: 0, border: 0, background: 'none', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, font: 'inherit',
                  }}
                >
                  <span className="cf-num" style={{ fontSize: 11, fontWeight: 700, color: activo ? 'var(--cf-ink)' : 'var(--cf-ink-3)' }}>
                    {pct}%
                  </span>
                  {/* El riel es «lo que le tocaba»; el relleno, lo que pagó. */}
                  <span style={{
                    position: 'relative', width: '100%', height: ALTO_BARRA, borderRadius: 6, overflow: 'hidden', flex: 'none',
                    background: 'var(--cf-fill)', outline: activo ? '2px solid var(--cf-ink)' : 'none', outlineOffset: 1,
                  }}>
                    <span style={{
                      position: 'absolute', left: 0, right: 0, bottom: 0,
                      height: Math.max(pct > 0 ? 3 : 0, Math.round((pct / 100) * ALTO_BARRA)),
                      background: COLOR[m.estado] ?? COLOR.nada,
                    }} />
                  </span>
                  <span className="cf-num" style={{ fontSize: 11, fontWeight: activo ? 700 : 500, color: activo ? 'var(--cf-ink)' : 'var(--cf-ink-3)' }}>
                    {m.corta ?? m.etiqueta}
                  </span>
                </button>
              )
            })}
          </div>

          {elegido ? (
            <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink)', lineHeight: 1.5 }}>
              <strong style={{ textTransform: 'capitalize' }}>{elegido.nombre} {elegido.anio}</strong>: pagó {formatear(elegido.pagado ?? 0)} de {formatear(elegido.esperado ?? 0)} que le tocaban.
            </span>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--cf-ink-4)' }}>Toca un mes para verlo en plata.</span>
          )}

          {/* 4 · Qué significa cada color. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
            {LEYENDA.map((l) => (
              <span key={l.estado} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--cf-ink-3)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: COLOR[l.estado], flex: 'none' }} />
                {l.texto}
              </span>
            ))}
            {visibles.some((m) => m.cumplio === null || m.cumplio === undefined) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--cf-ink-3)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, border: '1.5px dashed var(--cf-border-strong)', flex: 'none' }} />
                Sin préstamo ese mes
              </span>
            )}
          </div>
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
            <Pastilla tono={estado === 'mora' ? 'mora' : 'atraso'} numerica style={{ height: 19, fontSize: 11, flex: 'none' }}>
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
  // ── EL RELLENO LATERAL LO PONE EL ARMAZON, EL COMPONENTE NO ──
  //
  // Sin esta prop, al montarlo en `clientes/[id]` pondria sus 20px de
  // `--cf-pad-screen` ENCIMA de los 20px que ya da `layout.jsx` con `px-5`: 40
  // por lado, 80px menos de ancho que el resto de la pantalla.
  //
  // Es el mismo defecto que el usuario vio en la ficha del prestamo y que ya
  // llevaba cuatro apariciones. Se arregla ANTES de montar, no despues de que
  // se vea.
  sinMargen = false,
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      // Dentro de una pagina que crece no es una pantalla de telefono: fijarle
      // el 100% de alto y su propio scroll crea una ventana dentro de otra.
      height: sinMargen ? 'auto' : '100%',
    }}>
      <div style={{
        flex: sinMargen ? 'none' : 1, minHeight: 0,
        overflowY: sinMargen ? 'visible' : 'auto',
        display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)',
        padding: sinMargen ? '8px 0 16px' : '8px var(--cf-pad-screen) 16px',
      }}>

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
