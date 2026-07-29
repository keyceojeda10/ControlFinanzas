'use client'

// components/cf/TarjetaCliente.jsx
//
// LA PIEZA MÁS REPETIDA DEL SISTEMA. Receta en 03-COMPONENTES.md §3, y dibujada
// en T02-05 (clientes), T02-06 (préstamos) y T02-02 (cobrar hoy).
//
// ES UNA SOLA TARJETA CON DOS JUEGOS DE MEDIDAS. Las dos láminas la dibujan
// igual salvo en seis números, y esos seis van juntos:
//
//                        cliente (T02-05)      préstamo (T02-06)
//   relleno              15px …15px 19px       14px …14px 19px
//   hueco de la columna  11                    10
//   riel arriba/abajo    14                    13
//   fila 1: alineado     center                flex-start
//   fila 1: hueco        12                    10
//   monto                23px                  21px
//   avatar               sí, 40px              NO hay
//   rótulo del monto     «DEUDA TOTAL»         no hay: el monto va solo
//
// La diferencia de fondo: la tarjeta de préstamo no tiene a quién retratar —el
// dueño ya sabe de quién es— así que suelta el avatar y gana ancho para la línea
// de condiciones («Semanal 20% · cuota 13 de 24 · Ruta #1»), que es más larga.
//
// DOS NIVELES DE INFORMACIÓN, NUNCA TRES:
//   nivel 1 — quién:  nombre + UNA pastilla
//   nivel 2 — qué:    una línea de contexto
//   y debajo, el monto con su barra.
//
// DECISIONES QUE NO SON OPCIONALES (salieron de defectos reales):
//
//  · UNA sola pastilla, en la primera línea, con los días DENTRO del texto:
//    «10d mora», «6d vencido», «36d de atraso». Yo tenía dos —el estado arriba y
//    los días abajo— y eso mete un segundo portador de color en una tarjeta que
//    ya tiene tres (riel, pastilla, barra).
//  · EL AVATAR NO LLEVA BORDE DE COLOR. La receta lo permite («cuando el estado
//    importa»), pero ninguna de las tres láminas lo usa: los nueve avatares son
//    #F3F3EF pelado. Con riel, pastilla y barra ya hay tres sitios diciendo lo
//    mismo; el cuarto es ruido.
//  · «% pagado» va ABAJO, a la altura del monto, no arriba junto al rótulo. La
//    fila es `align-items: flex-end; justify-content: space-between`. Importa:
//    el porcentaje se lee CONTRA la cifra, no contra la palabra «deuda total».
//  · La tarjeta es `flex:none`. Con `flex:1` dentro de una columna saturada
//    absorbe todo el déficit, se aplasta y su texto se sale del overflow.
//  · La barra de progreso es `flex:none`. Si es encogible colapsa a 0px y con
//    ella desaparece el estado de la fila.
//  · El fondo es SIEMPRE blanco. El estado va en el riel de 4px, nunca tiñendo
//    la tarjeta: eso era el muro chillón que este rediseño corrige.

import { BarraProgreso, Pastilla } from './primitivos'

const COLOR_ESTADO = {
  mora:   'var(--cf-red)',
  atraso: 'var(--cf-gold)',
  aldia:  'var(--cf-green)',
  // `renovar` es al día Y por encima del 80% pagado: mismo verde, otra pastilla.
  // No es un estado de riesgo, es una oportunidad — de renovar sale el
  // crecimiento del negocio.
  renovar: 'var(--cf-green)',
  // EL PAGADO SE APAGA EN GRIS, no se tiñe de verde. El pie de T02-06 lo dice
  // literal: «los pagados se apagan al 60% en gris en vez de teñirse de verde».
  // Y es la diferencia entre «va bien» y «esto ya terminó»: en verde, un
  // préstamo cerrado compite por la atención con uno al día que sí hay que
  // seguir cobrando.
  pagado: 'var(--cf-ink-4)',
}

/* `Pastilla` solo conoce mora/atraso/aldia/neutro/destacado, así que los dos
   estados propios de T02-06 hay que traducirlos: `renovar` toma el verde de «al
   día», y `pagado` la neutra — no hay «color de terminado», hay ausencia de
   alarma. */
const TONO_PASTILLA = { mora: 'mora', atraso: 'atraso', aldia: 'aldia', renovar: 'aldia', pagado: 'neutro' }

const TONO_BARRA = { mora: 'mal', atraso: 'oro', aldia: 'ok', renovar: 'ok', pagado: 'neutro' }

/** Los seis números que cambian entre las dos láminas, juntos y con nombre. */
const MEDIDAS = {
  cliente:  { relleno: '15px 16px 15px 19px', hueco: 11, riel: 14, alineado: 'center',     huecoFila: 12, monto: 23, huecoSub: 2 },
  prestamo: { relleno: '14px 16px 14px 19px', hueco: 10, riel: 13, alineado: 'flex-start', huecoFila: 10, monto: 21, huecoSub: 3 },
}

export default function TarjetaCliente({
  nombre,
  iniciales,
  // 'cliente' → con avatar y con rótulo sobre el monto (T02-05, T02-02).
  // 'prestamo' → sin avatar y el monto solo (T02-06).
  variante = 'cliente',
  estado = 'aldia',        // 'mora' | 'atraso' | 'aldia' — solo el COLOR
  // El TEXTO de la pastilla lo compone la pantalla, porque cambia en cada una:
  // «10d mora» en clientes, «36d mora» en préstamos, «36d de atraso» en cobrar
  // hoy. Meterlo acá obligaría a la tarjeta a saber en qué pantalla está.
  etiquetaEstado,
  contexto,                // «CC 81283812 · 3 préstamos»
  etiquetaMonto,           // «Deuda total» · sin él, el monto va solo
  monto,
  // Lo de la derecha, a la altura del monto: «2% pagado» en clientes,
  // «de $1.200.000 · 54% pagado» en préstamos.
  detalle,
  porcentaje = 0,
  // `unico` no tiene cuotas: estaría en 0% durante todo el plazo. Mostrar una
  // barra vacía acá reintroduce en la lista la misma alarma falsa que la ficha
  // elimina — y son 882 préstamos. La reemplaza el vencimiento.
  sinProgreso = false,
  nota,                    // «vence en 18 días»

  onClick,
  style,
}) {
  const color = COLOR_ESTADO[estado] || COLOR_ESTADO.aldia
  const m = MEDIDAS[variante] || MEDIDAS.cliente
  // .6 de la lámina. Atenuar la fila entera dice «terminado» sin quitarla de la
  // lista: sigue siendo historia consultable, pero deja de pedir atención.
  const apagada = estado === 'pagado'
  const conAvatar = variante === 'cliente' && !!iniciales
  const derecha = detalle ?? (sinProgreso ? nota : `${porcentaje}% pagado`)

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        position: 'relative',
        background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card)',
        padding: m.relleno,               /* el 19 izquierdo deja sitio al riel */
        display: 'flex', flexDirection: 'column', gap: m.hueco,
        overflow: 'hidden',
        flex: 'none',
        opacity: apagada ? 0.6 : 1,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {/* El riel: el portador del color de estado. */}
      <span aria-hidden style={{
        position: 'absolute', left: 0, top: m.riel, bottom: m.riel,
        width: 4, borderRadius: 999, background: color,
      }} />

      {/* ── Nivel 1 · quién ── */}
      <div style={{ display: 'flex', alignItems: m.alineado, gap: m.huecoFila }}>
        {conAvatar && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 40, minWidth: 40, height: 40, aspectRatio: '1',
            borderRadius: 999, flex: 'none',
            /* Gris pelado. Ver la nota de arriba: el borde de color sobra. */
            background: 'var(--cf-fill)',
            fontSize: 15, fontWeight: 700, color: 'var(--cf-ink-2)',
          }}>{iniciales}</span>
        )}

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: m.huecoSub }}>
          {/* El nombre SOLO en su línea: nada le puede robar ancho. */}
          <span style={{
            fontSize: 16, fontWeight: 700, letterSpacing: '-.015em',
            color: 'var(--cf-ink)',
            minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{nombre}</span>

          {/* Nivel 2 · UNA línea, que no se parte en dos. Antes iba con
              `WebkitLineClamp: 2` y las tarjetas cambiaban de alto según lo
              larga que fuera la dirección: una lista de alturas distintas se
              recorre peor, y la lámina las dibuja todas iguales. */}
          {contexto && (
            <span className="cf-num" style={{
              fontSize: 12, color: 'var(--cf-ink-3)',
              minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{contexto}</span>
          )}
        </div>

        {etiquetaEstado && (
          // El pagado lleva pastilla NEUTRA (gris), no una de su color: no hay
          // «color de terminado», hay ausencia de alarma.
          <Pastilla tono={TONO_PASTILLA[estado] ?? 'neutro'} numerica style={{ flex: 'none' }}>
            {etiquetaEstado}
          </Pastilla>
        )}
      </div>

      {/* ── El monto y su barra ──
          `flex-end` + `space-between`: el rótulo y el monto en columna a la
          izquierda, y el detalle a la derecha alineado con la BASE del monto. */}
      {monto != null && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              {etiquetaMonto && (
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
                  color: 'var(--cf-ink-3)',
                }}>{etiquetaMonto}</span>
              )}
              <span className="cf-fig" style={{
                fontSize: m.monto, letterSpacing: '-.03em', color: 'var(--cf-ink)',
              }}>{monto}</span>
            </div>
            {derecha && (
              <span className="cf-num" style={{
                fontSize: 12, color: 'var(--cf-ink-3)', flex: 'none', whiteSpace: 'nowrap',
              }}>{derecha}</span>
            )}
          </div>
          {!sinProgreso && <BarraProgreso porcentaje={porcentaje} tono={TONO_BARRA[estado]} alto={5} />}
        </>
      )}
    </div>
  )
}
