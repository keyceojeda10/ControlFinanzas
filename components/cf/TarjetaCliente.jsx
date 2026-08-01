'use client'

// components/cf/TarjetaCliente.jsx
//
// LA PIEZA MÁS REPETIDA DEL SISTEMA. Receta en 03-COMPONENTES.md §3.
//
// ⚠ LA MANDA EL TURNO 03, NO EL 02. La dibujan T02-05/06/02 y, DESPUÉS,
// T03-03 (clientes), T03-04 (préstamos) y T03-01 (cobrar hoy) — que la
// corrigen. La construí contra el turno 02 porque en el inventario anoté que
// las del 03 eran «las mismas con datos de ejemplo»; no lo eran, y el usuario
// lo vio de inmediato. El pie de T03-04 lo dice sin rodeos:
//
//   «Faltaba lo más básico: la cuota. Y la ganancia acumulada, que es la razón
//    de ser del préstamo y no aparecía en ninguna lista.»
//
// Tres cambios del 03 sobre el 02, y son de estructura:
//   1. El monto sube a la fila del nombre, a la derecha, con su subtítulo
//      debajo («de $1.200.000»). Ya no tiene fila propia.
//   2. La pastilla de estado baja a la segunda línea, junto al contexto.
//   3. Aparece la TIRA DE CIFRAS: cuatro columnas con filete, sobre un borde.
//      Es lo que el usuario echaba en falta, y es la mitad de la tarjeta.
//
// LAS DOS VARIANTES CONVERGEN. Con el turno 02 se separaban en seis numeros
// (relleno 15 vs 14, riel 14 vs 13, monto 23 vs 21, y la de cliente llevaba un
// rotulo «DEUDA TOTAL» encima del monto). T03-03 y T03-04 las dibujan con el
// mismo relleno y el mismo riel, y ninguna lleva rotulo. Lo unico que las
// separa hoy es el avatar —solo la de cliente— y el hueco que necesita al lado.
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
//  · El «% pagado» va al lado de la BARRA, con la cuota exacta: «cuota 13/24 ·
//    54%». Las dos dicen cosas distintas y las dos hacen falta — por donde va el
//    calendario y por donde va la plata.
//  · La tarjeta es `flex:none`. Con `flex:1` dentro de una columna saturada
//    absorbe todo el déficit, se aplasta y su texto se sale del overflow.
//  · La barra de progreso es `flex:none`. Si es encogible colapsa a 0px y con
//    ella desaparece el estado de la fila.
//  · El fondo es SIEMPRE blanco. El estado va en el riel de 4px, nunca tiñendo
//    la tarjeta: eso era el muro chillón que este rediseño corrige.

import { BarraProgreso, Pastilla, TiraCifras } from './primitivos'

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
  // Con la tira del turno 03 las dos convergen: T03-03 y T03-04 dibujan el
  // mismo relleno y el mismo riel. Lo único que las separa es el avatar, que
  // solo lleva la de cliente, y el hueco que necesita a su lado.
  cliente:  { relleno: '15px 16px 15px 19px', hueco: 12, riel: 14, huecoFila: 12, monto: 20, huecoSub: 4 },
  prestamo: { relleno: '15px 16px 15px 19px', hueco: 12, riel: 14, huecoFila: 10, monto: 20, huecoSub: 4 },
}

export default function TarjetaCliente({
  nombre,
  iniciales,
  // 'cliente' → con avatar. 'prestamo' → sin él: el dueño ya sabe de quién es,
  // y ese ancho se lo lleva la línea de condiciones, que es más larga.
  variante = 'cliente',
  estado = 'aldia',        // 'mora' | 'atraso' | 'aldia' — solo el COLOR
  // El TEXTO de la pastilla lo compone la pantalla, porque cambia en cada una:
  // «10d mora» en clientes, «36d mora» en préstamos, «36d de atraso» en cobrar
  // hoy. Meterlo acá obligaría a la tarjeta a saber en qué pantalla está.
  etiquetaEstado,
  contexto,                // «Ana María · 3 préstamos»
  // ── DE HOY ──
  // Un punto verde al lado del nombre, no una pastilla: la pastilla de estado
  // ya está a la derecha y dos pastillas en la misma fila compiten. El punto
  // dice «mira aquí» sin quitarle sitio al nombre, que es lo que se lee.
  nuevo = false,
  monto,
  // Debajo del monto y alineado a su derecha: «de $1.200.000» en préstamos,
  // «3 préstamos» en clientes.
  detalle,
  // ── LA TIRA DEL TURNO 03 ──
  // Cuatro columnas: [{ etiqueta, valor, tono }], el mismo formato que ya usa
  // `TiraCifras` en el bloque oscuro. `tono` es 'contra' | 'favor' | 'oro'.
  // Las compone la pantalla porque cambian en cada una: cuota / atraso /
  // ganancia / vence en préstamos, y atraso / cumple / pagado / próximo cobro
  // en clientes.
  cifras,
  porcentaje = 0,
  // Lo que se lee al lado de la barra: «cuota 13/24 · 54%».
  avance,
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
  // Bajo el monto. Antes este hueco cargaba con todo —el detalle, la nota Y el
  // porcentaje— porque no había dónde más ponerlo. Ahora el porcentaje vive al
  // lado de la barra (`avance`) y la nota tiene su propia línea, así que aquí
  // queda solo lo que la lámina pone: el total del que sale ese saldo.
  const derecha = detalle

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

      {/* ── Nivel 1 · quién, y cuánto ──
          EL TURNO 03 MANDA SOBRE EL 02, Y ESTO ES LO QUE CAMBIA.
          T02-05/06 ponían el monto en su propia fila debajo, y la pastilla de
          estado a la derecha del nombre. T03-03 y T03-04 lo reordenan: el monto
          sube a esta fila, alineado a la derecha con su subtítulo debajo, y la
          pastilla baja a la segunda línea junto al contexto.
          Gana una fila entera de alto, que es la que ocupan las cifras. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: m.huecoFila }}>
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
          {/* El nombre SOLO en su línea: nada le puede robar ancho. El punto de
              «nuevo» va con `flex: none` y 6px, así que no se lo quita. */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            {nuevo && (
              <span aria-label="Nuevo hoy" title="Creado hoy" style={{
                width: 7, height: 7, borderRadius: 999, flex: 'none',
                background: 'var(--cf-green)',
              }} />
            )}
            <span style={{
              fontSize: 16, fontWeight: 700, letterSpacing: '-.015em',
              color: 'var(--cf-ink)',
              minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{nombre}</span>
          </span>

          {/* Nivel 2 · UNA línea, que no se parte en dos. Antes iba con
              `WebkitLineClamp: 2` y las tarjetas cambiaban de alto según lo
              larga que fuera la dirección: una lista de alturas distintas se
              recorre peor, y la lámina las dibuja todas iguales. */}
          {/* La pastilla y el contexto comparten esta línea. El contexto se
              encoge, la pastilla no: con un nombre de ruta largo se recorta la
              ruta, nunca los días de mora. */}
          {(etiquetaEstado || contexto) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              {etiquetaEstado && (
                // El pagado lleva pastilla NEUTRA (gris), no una de su color: no
                // hay «color de terminado», hay ausencia de alarma.
                <Pastilla tono={TONO_PASTILLA[estado] ?? 'neutro'} numerica style={{ flex: 'none' }}>
                  {etiquetaEstado}
                </Pastilla>
              )}
              {contexto && (
                <span className="cf-num" style={{
                  fontSize: 12, color: 'var(--cf-ink-3)',
                  minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{contexto}</span>
              )}
            </div>
          )}
        </div>

        {monto != null && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
            gap: 2, flex: 'none',
          }}>
            <span className="cf-fig" style={{
              fontSize: m.monto, letterSpacing: '-.025em', lineHeight: 1, color: 'var(--cf-ink)',
            }}>{monto}</span>
            {derecha && (
              <span className="cf-num" style={{
                fontSize: 11, color: 'var(--cf-ink-3)', whiteSpace: 'nowrap',
              }}>{derecha}</span>
            )}
          </div>
        )}
      </div>

      {/* ── La tira de cifras ──
          «Faltaba lo más básico: la cuota. Y la ganancia acumulada, que es la
          razón de ser del préstamo y no aparecía en ninguna lista» (T03-04).
          Cuatro columnas iguales separadas por filetes de 1px. Van sobre un
          borde superior, así que la tarjeta se lee en dos bloques: quién y
          cuánto arriba, los números del negocio abajo. */}
      {/* La pinta `TiraCifras`, en primitivos: la comparte con la FilaCobro de
          cobrar hoy, que no tiene esta estructura pero sí esta tira. */}
      <TiraCifras columnas={cifras} enTarjeta />

      {/* ── El avance ──
          La barra y su lectura en la MISMA fila. Antes la barra iba sola y el
          «54% pagado» vivía arriba, al lado del monto; la lámina los junta y
          añade la cuota exacta, que es lo que dice por dónde va el cliente. */}
      {!sinProgreso && monto != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <BarraProgreso porcentaje={porcentaje} tono={TONO_BARRA[estado]} alto={5} style={{ flex: 1 }} />
          {avance && (
            <span className="cf-num" style={{
              fontSize: 11, fontWeight: 700, color: 'var(--cf-ink-3)',
              flex: 'none', whiteSpace: 'nowrap',
            }}>{avance}</span>
          )}
        </div>
      )}

      {/* `unico` no tiene cuotas: sin barra, la nota ocupa su sitio. */}
      {sinProgreso && nota && (
        <span className="cf-num" style={{ fontSize: 11, fontWeight: 700, color: 'var(--cf-ink-3)' }}>{nota}</span>
      )}
    </div>
  )
}
