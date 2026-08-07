'use client'

// components/cf/ParadaDeCobro.jsx — la tarjeta de una parada de ruta.
//
// LA MISMA TARJETA EN DOS PANTALLAS, y por eso vive aqui y no dentro de una de
// ellas. La adenda 5 la describe como «la tarjeta de cliente dentro de una
// ruta», y esa tarjeta sale en dos sitios:
//
//   /cobros-hoy       las paradas de hoy de TODAS las rutas del cobrador
//   /rutas/[id]       las paradas de UNA ruta
//
// Estaba escrita entera dentro de `CobrarHoy.jsx`, asi que la de `/rutas/[id]`
// era otra tarjeta distinta —con el numero de orden como marca de agua al 8%,
// nueve cifras y colores fijos de tema oscuro— y arreglar una no arreglaba la
// otra. Es el mismo fallo del comprobante: lo mismo visto por dos caminos, y
// solo uno corregido.
//
// Lo de aqui son E07 (la tarjeta), E08 (el carril numerado) y E09 (los que
// estan en la ruta pero no son visita de hoy).

import { useState } from 'react'
import { TiraCifras } from '@/components/cf/primitivos'

export const COLOR_ESTADO = {
  mora:   'var(--cf-red)',
  atraso: 'var(--cf-gold)',
  aldia:  'var(--cf-green)',
}

export const PASTILLA = {
  mora:   { bg: 'var(--cf-red-pill-bg)',   bd: 'var(--cf-red-pill-border)',   fg: 'var(--cf-red-dark)' },
  atraso: { bg: 'var(--cf-gold-bg)',       bd: 'var(--cf-gold-border)',       fg: 'var(--cf-gold-text-2)' },
  aldia:  { bg: 'var(--cf-green-pill-bg)', bd: 'var(--cf-green-pill-border)', fg: 'var(--cf-green-dark)' },
}

/* ══ EL CARRIL DE RECORRIDO (Adenda 5 · E08) ══════════════════════════════
   «El orden no es un dato del cliente: es dónde está en la fila. Por eso vive
   fuera de la tarjeta.» Dentro competía con el nombre y el monto; fuera, en
   columna, se lee sin mirar nada más — que es lo que hace un cobrador cuando
   levanta la vista de la moto.

   Se paga solo porque el carril TAMBIÉN da el progreso: sin contar nada se ve
   cuántas paradas van con check y cuántas quedan huecas.

   ⚠ SOLO EN EL TELÉFONO, y esto no lo dice la lámina: en escritorio la lista
   va a DOS COLUMNAS (`lg:grid-cols-2`), y un carril con línea conectora
   necesita una sola secuencia — con dos columnas la línea uniría paradas que
   no van seguidas y el número diría una posición falsa. La propia adenda pone
   la condición: «B en la ruta de cobro, donde el orden manda y HAY UNA SOLA
   SECUENCIA». En escritorio no la hay, así que allí no se pinta. Y no se
   pierde nada: la ruta se cobra caminando, con el teléfono.

   Los tres estados y sus medidas salen de la adenda. El número pendiente va en
   `--cf-ink-2` y no en gris claro a propósito: son los que el cobrador mira
   POR DELANTE para saber cuánto le falta, y en gris claro quedan a 3,12:1 y no
   se leen bajo sol. */
export function Carril({ orden, cobrada, actual, ultima, ancla, resaltada, children }) {
  const circulo = cobrada
    ? { w: 30, bg: 'var(--cf-green)', bd: 'none', fg: '#FFF' }
    : actual
      ? { w: 34, bg: 'var(--cf-ink)', bd: 'none', fg: 'var(--cf-card)' }
      : { w: 30, bg: 'var(--cf-card)', bd: '2px solid var(--cf-border-strong)', fg: 'var(--cf-ink-2)' }

  return (
    <div id={ancla} className="flex lg:contents" style={{
      gap: 10, alignItems: 'stretch',
      // El aterrizaje al volver de cobrar. `scroll-margin` para que no quede
      // pegada al borde de arriba cuando el navegador la trae a la vista.
      scrollMarginTop: 90, scrollMarginBottom: 90,
    }}>
      {/* ⚠ `flex flex-col items-center` EN LA CLASE, NO EN EL `style`.
          Un `display` en línea SIEMPRE gana a una clase, así que con
          `display: 'flex'` en el `style` el `lg:hidden` no hacía nada y el
          carril se pintaba también en escritorio —729 círculos donde no hay una
          sola secuencia—.

          Es la TERCERA vez hoy: antes fue `display:'grid'` comiéndose un
          `hidden sm:grid`, y luego `display:'flex'` en la caja del panel
          duplicando la gráfica en el teléfono. Hay una prueba que lo barre
          entero para que no haya una cuarta. */}
      <div className="lg:hidden flex flex-col items-center" style={{ width: 34, flex: 'none' }}>
        <span className="cf-num" style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: circulo.w, height: circulo.w, minWidth: circulo.w, minHeight: circulo.w,
          aspectRatio: '1', borderRadius: 999, flex: 'none',
          background: circulo.bg, border: circulo.bd, color: circulo.fg,
          fontSize: actual ? 16 : 14, fontWeight: 700,
        }}>
          {cobrada ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
          ) : orden}
        </span>
        {/* El conector no va en la última: una línea que sale de la última
            parada y no llega a nada dice que falta algo. */}
        {!ultima && (
          <span aria-hidden style={{
            flex: 1, width: 2, minHeight: 8, marginTop: 4,
            borderRadius: 999, background: 'var(--cf-border-strong)',
          }} />
        )}
      </div>
      <div style={{
        flex: 1, minWidth: 0, borderRadius: 'var(--cf-r-card)',
        // Dos segundos de halo al volver: dice CUÁL era sin tener que releer
        // nombres en una lista de doscientas iguales.
        boxShadow: resaltada ? '0 0 0 3px var(--cf-gold-focus)' : undefined,
        transition: 'box-shadow .25s',
      }}>{children}</div>
    </div>
  )
}


/* ══ La fila de cobro ══ */
export function FilaCobro({
  nombre, iniciales, estado = 'aldia', etiquetaEstado, donde, distancia,
  avisoMora, avisos = [], prestamos = [],
  cuota, debe, cobrada = false, abonoHoy, cerradaPorHoy, abonadoAntesDeCerrar, onReabrir,
  cobradoA, montoCobrado, cifras, pagadoPct, onClick,
  // ── LA PARADA ACTUAL (T03-01) ──
  // Marca dónde está el cobrador AHORA: borde dorado y aviso de mora. Ya NO
  // decide quién tiene botones —eso era así y el dueño lo rebatió con el caso
  // real; ver la nota larga junto a la fila de acciones—.
  activa = false, onLlamar, onWhatsApp, onMapa, onMas,
}) {
  const color = COLOR_ESTADO[estado] || COLOR_ESTADO.aldia
  const p = PASTILLA[estado] || PASTILLA.aldia
  // El plegador de préstamos. Arranca cerrado: se abre «solo si el cliente
  // discute», que es lo que dice la adenda y lo que pasa en la calle.
  const [abierto, setAbierto] = useState(false)

  return (
    <div
      onClick={cobrada ? undefined : onClick}
      role={cobrada ? undefined : 'button'}
      tabIndex={cobrada ? undefined : 0}
      style={{
        position: 'relative',
        background: 'var(--cf-card)',
        // El anillo dorado marca dónde está parado. Sin él, veinte tarjetas
        // iguales y hay que acordarse de por cuál se iba.
        border: activa && !cobrada ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)',
        boxShadow: activa && !cobrada ? '0 0 0 3px var(--cf-gold-focus)' : undefined,
        borderRadius: 'var(--cf-r-card)',
        // Sin hueco abajo: la barra a sangre del pie va pegada al borde.
        padding: '14px 16px 0 16px',
        // COLUMNA, no fila. Antes era una sola fila —avatar, nombre, cuota— y
        // T03-01 le pone debajo la tira de cifras. La fila de siempre baja un
        // nivel y se queda igual; lo que cambia es que ahora tiene hermana.
        display: 'flex', flexDirection: 'column', gap: 11,
        overflow: 'hidden', flex: 'none',
        // El cobrado se atenúa, no se borra. .6 es de la lámina.
        opacity: cobrada ? 0.6 : 1,
        cursor: cobrada ? 'default' : 'pointer',
      }}
    >
      {/* ── ADENDA 5 · E10 · FUERA EL RIEL LATERAL ──
          Aquí había un filete de color pegado al borde izquierdo. La adenda lo
          quita en todas las listas, y la razón es que era el CUARTO sitio donde
          se decía lo mismo —ya está la pastilla, la cifra de atraso en rojo y
          el progreso— y el único sin dato. Además iba a sangre con las esquinas
          rectas, peleando con el radio de la tarjeta.

          Lo sustituyen dos acentos que SÍ dicen cosas distintas: el anillo del
          avatar dice cómo está, y la barra del pie cuánto lleva pagado. La
          regla de la adenda es que «el estado lo llevan los elementos que ya
          identifican a la fila, nunca uno añadido para pintarlo». */}

      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>

      {/* El avatar del cobrado es un CHECK, no sus iniciales: la fila ya está
          tachada, y un avatar normal invita a volver a tocarla. */}
      {cobrada ? (
        <span aria-hidden style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, minWidth: 40, borderRadius: 999, flex: 'none',
          background: 'var(--cf-green-pill-bg)',
        }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--cf-green)"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : (
        /* EL ANILLO LLEVA EL ESTADO. `aspectRatio: 1` con `minWidth` y
           `minHeight` no es de adorno: sin ellos el avatar se aplasta en cuanto
           el nombre de al lado es largo, y con el anillo puesto un óvalo se ve
           roto. Lo dice la lista de comprobación de la adenda. */
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, minWidth: 40, minHeight: 40, aspectRatio: '1',
          borderRadius: 999, flex: 'none',
          background: 'var(--cf-fill)', fontSize: 15, fontWeight: 700, color: 'var(--cf-ink-2)',
          border: `2px solid ${color}`,
        }}>{iniciales}</span>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 17, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--cf-ink)',
          minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textDecoration: cobrada ? 'line-through' : 'none',
        }}>{nombre}</span>

        {cobrada ? (
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
            {cerradaPorHoy
              /* CERRADA A MANO, y se dice con esas palabras. «Cobrado» a
                 secas sobre alguien que todavía debe es mentira: lo que pasó
                 es que el cobrador siguió camino. */
              ? (abonadoAntesDeCerrar
                  ? `Abonó ${abonadoAntesDeCerrar} · cerrado por hoy`
                  : 'Cerrado por hoy')
              : cobradoA ? `Cobrado ${cobradoA}` : 'Cobrado'}
          </span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            {etiquetaEstado && (
              <span className="cf-num" style={{
                display: 'inline-flex', alignItems: 'center', flex: 'none',
                height: 20, padding: '0 8px', borderRadius: 'var(--cf-r-pill)',
                background: p.bg, border: `1px solid ${p.bd}`, color: p.fg,
                fontSize: 11, fontWeight: 700,
              }}>{etiquetaEstado}</span>
            )}
            {donde && (
              <span style={{
                fontSize: 12, color: 'var(--cf-ink-3)',
                minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{donde}</span>
            )}
            {/* ── LA DISTANCIA (E07) ──
                «El cobrador decide el orden real con ella»: con dos clientes
                igual de atrasados, va primero el que tiene al lado.

                `flex: none` para que NO se recorte: es la dirección la que se
                acorta con puntos suspensivos si no cabe, porque de ella basta
                con el principio. La distancia son cinco caracteres y o se ve
                entera o no dice nada.

                Sin GPS el adaptador manda `null` y la línea queda como estaba:
                inventar una distancia manda a caminar mal, que es justo lo que
                esto viene a evitar. */}
            {distancia && (
              <span className="cf-num" style={{
                fontSize: 12, color: 'var(--cf-ink-3)', flex: 'none', opacity: .85,
              }}>· {distancia}</span>
            )}
          </div>
        )}
      </div>

      {cobrada ? (
        <span className="cf-fig" style={{
          fontSize: 20, letterSpacing: '-.025em', color: 'var(--cf-green-dark)', flex: 'none',
        }}>{montoCobrado}</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flex: 'none' }}>
          {/* EN NEGRO. Era un botón rojo en cada fila, y con veinte filas eso
              era el muro: rojo es mora, no «cobrar». */}
          <span className="cf-fig" style={{ fontSize: 20, letterSpacing: '-.025em', color: 'var(--cf-ink)' }}>
            {cuota}
          </span>
          {debe && (
            <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>{debe}</span>
          )}
        </div>
      )}
      </div>

      {/* «Atraso $48.000 · Cumple 62% · Cuota 13/24 · Últ. pago 21 jun».
          El adaptador no la manda en el cobrado: ya está tachado y con su hora,
          y enseñarle el atraso a alguien que acaba de pagar es ruido. */}
      {/* ── EL AVISO DE MORA, EN UNA FRASE (E07) ──
          «Lleva 28 días sin pagar. Debe $960.000 en total.» Dice de una vez
          cuánto lleva sin pagar y cuánto debe EN TOTAL, que es lo que se dice
          en voz alta en la puerta. Y con la palabra «en total» pegada a la
          cifra: el fallo que la adenda denuncia es justo un saldo leído como si
          fuera la mora, y ahí el cobrador le pide al cliente diez veces de más.

          ⚠ SOLO EN LA PARADA ACTUAL, y esto lo aprendí MIRANDO la pantalla, no
          contando. Puesto en todas salían 472 franjas rojas seguidas: la lista
          entera en rojo es el muro que esta pantalla vino a quitar, y en cada
          tarjeta la frase repetía con más palabras lo que ya dicen la pastilla
          («19d») y el saldo («debe $240.000») dos renglones más arriba.

          Es el mismo defecto que E10 le reprocha al riel —«el cuarto sitio
          donde se dice lo mismo»—, así que ponerlo en todas era cambiar un
          duplicado por otro. En la parada actual sí aporta: es donde el
          cobrador está parado y va a hablar. */}
      {avisoMora && activa && !cobrada && (
        <div style={{
          flex: 'none', display: 'flex', alignItems: 'flex-start', gap: 9,
          padding: '10px 13px', borderRadius: 12,
          background: 'var(--cf-red-pill-bg)',
          border: '1px solid color-mix(in srgb, var(--cf-red-dark) 22%, transparent)',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-red-dark)"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ flex: 'none', marginTop: 1 }}>
            <path d="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
          <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--cf-red-dark)', minWidth: 0 }}>
            Lleva <b>{avisoMora.dias} días sin pagar</b>. Debe {avisoMora.total} en total.
          </span>
        </div>
      )}

      {/* ── DESHACER EL CIERRE ────────────────────────────────────────────
          Se cierra «con la opción de si él quiere realizar otro abono,
          poderle abonar». Sin esta salida, decir «ya no paga más» sería
          irreversible por una decisión que se toma de pie en una puerta, y
          el cliente que saca otro billete a los dos minutos dejaría al
          cobrador teniendo que buscar la ficha por otro camino.

          Discreto y en su propia línea: la fila cerrada tiene que seguir
          leyéndose como hecha. */}
      {cerradaPorHoy && onReabrir && (
        <div style={{ flex: 'none' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onReabrir}
            style={{
              width: '100%', height: 38, borderRadius: 11, cursor: 'pointer',
              background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
              font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--cf-ink-2)',
            }}
          >Volver a abrir · cobrarle más</button>
        </div>
      )}

      {/* Los renglones de arriba. Van en TODAS las fichas, no solo en la
          actual, porque cambian la cifra que se pide: enterarse de la cuota
          extra al llegar a la puerta es tarde. */}
      {!cobrada && avisos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 'none' }}>
          {avisos.map((a, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '7px 11px', borderRadius: 10,
              background: a.tono === 'contra' ? 'var(--cf-red-pill-bg)' : 'var(--cf-gold-bg)',
              border: `1px solid ${a.tono === 'contra' ? 'var(--cf-red-pill-border)' : 'var(--cf-gold-border)'}`,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={a.tono === 'contra' ? 'var(--cf-red-dark)' : 'var(--cf-gold-text-2)'}
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
              </svg>
              <span style={{
                fontSize: 11.5, lineHeight: 1.3, minWidth: 0,
                color: a.tono === 'contra' ? 'var(--cf-red-dark)' : 'var(--cf-gold-text-2)',
              }}>{a.texto}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── ABONÓ HOY, PERO SIGUE PENDIENTE ──
          El caso que se había perdido. Un cliente con tres préstamos abona
          $8.000 de uno: entró plata suya hoy, pero todavía le toca cobro. La
          fila queda VIVA —con su cuota y su botón— y lo dice, para que el
          cobrador no le vuelva a cobrar lo mismo sin darse cuenta.

          Verde y no rojo: es dinero que YA entró. Lo que avisa no es un
          problema del cliente, es un dato de la visita. */}
      {abonoHoy && !cobrada && (
        <div style={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 11,
          background: 'var(--cf-green-pill-bg)',
          border: '1px solid var(--cf-green-pill-border)',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--cf-green-dark)"
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
            <path d="M5 13l4 4L19 7" />
          </svg>
          <span style={{ flex: 1, fontSize: 12, lineHeight: 1.35, color: 'var(--cf-green-dark)', minWidth: 0 }}>
            Ya abonó <b>{abonoHoy}</b> hoy · sigue pendiente
          </span>
          {/* ── «HASTA AQUÍ POR HOY» ──────────────────────────────────────
              Reportado con el caso exacto: debe $100.000, la cuota es de
              $10.000 y ya abonó $20.000 —dos cuotas—. Está bien que siga
              apareciendo, pero si el cliente ya dijo que no da más, el
              cobrador necesita seguir su ruta sin tenerlo eternamente de
              primero como pendiente.

              Va AQUÍ y no entre las acciones a propósito: solo tiene sentido
              cuando ya entró plata, y pegado a la frase que dice cuánta. Como
              botón suelto invitaría a saltarse clientes sin cobrarles. */}
          {onCerrarVisita && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCerrarVisita() }}
              style={{
                flex: 'none', height: 30, padding: '0 11px', cursor: 'pointer',
                borderRadius: 9, font: 'inherit', fontSize: 12, fontWeight: 700,
                background: 'var(--cf-card)',
                border: '1px solid var(--cf-green-pill-border)',
                color: 'var(--cf-green-dark)', whiteSpace: 'nowrap',
              }}
            >Hasta aquí hoy</button>
          )}
        </div>
      )}

      <TiraCifras columnas={cifras} enTarjeta />

      {/* ── LOS PRÉSTAMOS, PLEGADOS (E07) ──
          «Se pliegan y se abren solo si el cliente discute.» El titular de la
          tarjeta es lo que se le pide HOY; los saldos son para cuando hay que
          defender la cifra.

          Solo con MÁS DE UNO: con un solo préstamo no hay nada que plegar —el
          saldo ya está arriba, en «debe $92.000»— y un desplegable que abre una
          sola fila es un toque de más para nada. */}
      {!cobrada && prestamos.length > 1 && (
        <div style={{ flex: 'none' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: 0,
              background: 'none', border: 0, cursor: 'pointer', font: 'inherit',
              fontSize: 12, color: 'var(--cf-ink-3)',
            }}
          >
            {prestamos.length} préstamos
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {abierto && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
              {prestamos.map((p) => (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)' }}>
                      {p.desde ? `Del ${p.desde}` : 'Préstamo'}
                    </span>
                    <span className="cf-fig" style={{ fontSize: 15, color: 'var(--cf-ink)', flex: 'none' }}>
                      {p.saldo}
                    </span>
                  </div>
                  <span style={{
                    display: 'block', height: 4, borderRadius: 999,
                    background: 'var(--cf-fill)', overflow: 'hidden', flex: 'none',
                  }}>
                    <span style={{
                      display: 'block', height: 4, borderRadius: 999,
                      width: `${p.pagadoPct}%`, background: color,
                    }} />
                  </span>
                  <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>
                    {p.pagadoPct}% pagado{p.pagadoDe ? ` de ${p.pagadoDe}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Las acciones de la parada actual. Solo aquí: en las demás filas serían
          sesenta botones en una pantalla que se opera caminando.

          ── E07 · Y LA PRINCIPAL, EN DORADO ──
          Cobrar era lo ÚNICO que no tenía botón: se hacía tocando la tarjeta
          entera, que es un gesto que hay que saberse. Los tres iconos de al
          lado —WhatsApp, mapa, más— son las secundarias y llevaban todo el peso
          visual de la fila.

          ⚠ DORADO, NUNCA VERDE. En el sistema el verde significa «al día,
          pagado»; usarlo como color de acción rompe esa lectura justo donde más
          importa, que es la pantalla donde se decide si alguien pagó. */}
      {/* ── EN TODAS LAS FICHAS, NO SOLO EN LA ACTUAL ──
          Estaban solo en la parada actual, con este argumento: «una lista de
          veinte tarjetas con tres botones cada una es un muro». El dueño lo
          rebate con el caso real, y tiene razón: «alguien se quiere saltar un
          cliente y entonces a aquel no lo puede gestionar; no le va a dar la
          opción de tocarle el WhatsApp, la ubicación o el cobro rápido».

          El orden de la ruta es una SUGERENCIA, no un carril: el cobrador se
          salta al que no está, vuelve luego, cobra al que le sale al paso. Una
          pantalla que solo deja operar la fila número uno le obliga a cobrar en
          un orden que la calle no respeta.

          El muro sigue evitado por otro lado: la parada actual conserva su
          borde dorado y su aviso de mora, así que se distingue igual. Lo que
          cambia es que las demás dejan de estar mudas. */}
      {!cobrada && (onLlamar || onWhatsApp || onMapa || onMas) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}
          onClick={(e) => e.stopPropagation()}>
          {/* ── DOS FILAS, Y NO UNA ────────────────────────────────────────
              Estaban los cinco controles en una sola fila con «Cobrar» a
              `flex: 1`, quedándose con lo que sobrara. Con tres iconos aún
              respiraba; al entrar el de llamar —que la tarjeta vieja tenía y
              se había perdido— se quedó en unos 90px y el botón principal
              pasó a ser el más pequeño de la fila. Reportado: «el botón de
              cobrar quedó justificadamente pequeño».

              Las secundarias se reparten el ancho arriba y COBRAR SE LLEVA UN
              RENGLÓN ENTERO. Cuesta unos 50px de alto por ficha, y los vale:
              es la acción por la que se abre esta pantalla, y con las
              acciones ya en todas las fichas es la que más se pulsa. */}
          <div style={{ display: 'flex', gap: 8 }}>
          {/* ── SOLO EL ICONO, y no es cosmético ──
              Con el carril, la tarjeta pierde 46px de ancho —la propia adenda
              lo avisa: «quedan 304px de los 350»— y los cuatro controles dejan
              de caber: medido, «WhatsApp» se salía de su botón y pisaba
              «Mapa».

              La lámina de E07 los dibuja así: tres iconos cuadrados de 44 y el
              botón de cobrar llevándose el resto. El texto sobra porque el
              logo de WhatsApp y el pin de mapa se reconocen solos, y lo que sí
              tiene que leerse —«Cobrar»— gana el sitio que sueltan. */}
          {/* LLAMAR. Estaba en la tarjeta vieja de la ruta y se perdió en la
              sustitución: se llama antes de llegar, para no subir la loma y
              encontrarse la casa cerrada. */}
          {onLlamar && (
            <AccionParada onClick={onLlamar} soloIcono aria-label="Llamar">
              <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </AccionParada>
          )}
          {onWhatsApp && (
            <AccionParada onClick={onWhatsApp} tono="verde" relleno soloIcono aria-label="WhatsApp">
              {/* EL LOGO DE VERDAD. Lo que había era una burbuja de trazo
                  dibujada a mano: no es el logo de WhatsApp, y encima el trazo
                  tocaba el borde del viewBox y salía cortado. */}
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </AccionParada>
          )}
          {onMapa && (
            <AccionParada onClick={onMapa} soloIcono aria-label="Ver en el mapa">
              <path d="M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11z" />
              <circle cx="12" cy="10" r="2.6" />
            </AccionParada>
          )}
          {onMas && (
            <AccionParada onClick={onMas} soloIcono aria-label="Más opciones">
              <circle cx="12" cy="5" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="12" cy="19" r="1.4" />
            </AccionParada>
          )}

          </div>

          {/* Sigue funcionando tocar la tarjeta entera —el gesto de siempre no
              se quita—; esto solo lo hace visible, y ahora con el tamaño que
              le corresponde. */}
          <button
            type="button"
            onClick={onClick}
            style={{
              width: '100%', height: 46, border: 'none', borderRadius: 12,
              background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
              font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              letterSpacing: '-.01em',
            }}
          >Cobrar</button>
        </div>
      )}

      {/* ── LA BARRA A SANGRE (Adenda 5 · E10) ──
          Último hijo de la tarjeta, pegada al borde de lado a lado. El
          `margin` negativo anula el padding lateral: sin él quedaría un
          renglón de color flotando con 16px de aire a cada lado, que se lee
          como un elemento más y no como el borde de la tarjeta.

          ⚠ `flex: none` es obligatorio. La tarjeta es una columna flex y sin
          él la barra se encoge hasta desaparecer en cuanto el contenido de
          arriba pide sitio — y el fallo es invisible: no se rompe nada, solo
          deja de estar.

          Dice CUÁNTO LLEVA PAGADO, que es lo que la distingue del anillo del
          avatar. Si algún día las dos dijeran lo mismo, sobraría una. */}
      <span aria-hidden style={{
        flex: 'none', display: 'block', height: 5,
        margin: '0 -16px', background: 'var(--cf-fill)',
      }}>
        <span style={{
          display: 'block', height: 5,
          width: `${Math.max(0, Math.min(100, pagadoPct ?? 0))}%`,
          background: cobrada ? 'var(--cf-green)' : color,
        }} />
      </span>
    </div>
  )
}

/* Un botón de la parada actual. Alto 42 —el dedo necesita 44 y va dentro de una
   tarjeta que ya se puede pulsar entera—, y el de tres puntos cuadrado. */
/* `relleno` para los glifos de marca —el de WhatsApp es una SILUETA, no un
   trazo—. Pintado con `stroke` salía como un contorno raro, y además RECORTADO:
   ese dibujo llega justo al borde de su viewBox, así que el grosor de línea se
   sale del lienzo y la parte de fuera se corta. Reportado en la captura.
   El mapa y los tres puntos siguen siendo trazo, que es como se dibujan. */
export function AccionParada({ children, texto, tono, soloIcono, relleno, onClick, ...resto }) {
  const pincel = relleno
    ? { fill: 'currentColor', stroke: 'none' }
    : { fill: 'none', stroke: 'currentColor', strokeWidth: '1.9', strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <button
      type="button"
      onClick={onClick}
      {...resto}
      style={{
        // `flex: 1` también con solo icono: ahora comparten su propia fila y
        // se reparten el ancho, en vez de quedarse en 46px fijos dejando un
        // hueco muerto a la derecha.
        height: 42, flex: 1, minWidth: soloIcono ? 44 : undefined,
        minWidth: 0, cursor: 'pointer', borderRadius: 'var(--cf-r-control)',
        background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        font: 'inherit', fontSize: 13, fontWeight: 700,
        /* `--cf-green-dark`, el verde del sistema, NO `--cf-whatsapp` (#25D366):
           ese es el verde de marca de ellos y sobre blanco no da contraste de
           lectura para un texto de 13px. El icono ya identifica la app. */
        color: tono === 'verde' ? 'var(--cf-green-dark)' : 'var(--cf-ink-2)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" {...pincel} style={{ flex: 'none' }}>
        {children}
      </svg>
      {texto}
    </button>
  )
}

/* ══ LA SEGUNDA ZONA (Adenda 5 · E09) ═══════════════════════════════════════
   «El carril numera VISITAS, no clientes.» Es la regla de la lámina y la razón
   de que esto exista: quien hoy no tiene nada que recoger sale del carril y
   baja aquí, sin número.

   Y no es una cuestión de orden. Un contador que incluye paradas que no se
   hacen es PEOR que no tener contador: el cobrador lee «16 cobros», hace los
   diez que había de verdad y se cree atrasado yendo al día. */
export function SeparadorZona({ children = 'También en esta ruta' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 2px' }}>
      <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--cf-border)' }} />
      <span style={{
        flex: 'none', fontSize: 11, fontWeight: 800, letterSpacing: '.07em',
        textTransform: 'uppercase', color: 'var(--cf-ink-3)',
      }}>{children}</span>
      <span aria-hidden style={{ flex: 1, height: 1, background: 'var(--cf-border)' }} />
    </div>
  )
}

/* Los tres estados de abajo, con la caja que le toca a cada uno:

     aldia     tarjeta blanca      la fecha del próximo cobro   «Cobrar antes»
     sindeuda  borde dorado        cuánto se le puede prestar   «Prestarle»
     inactivo  sin tarjeta, gris   desde cuándo no tiene nada   «Sacar»

   ── EL COPY, QUE ES LA MITAD DE LA LÁMINA ──
   «Se puede retirar» —lo que decía la pantalla vieja— suena a que el cliente se
   va. Es SACARLO DE LA RUTA, y solo aplica al inactivo: al que acaba de pagar
   no hay que sacarlo, hay que PRESTARLE. Eran dos estados con el mismo botón y
   son opuestos: uno es una oportunidad y el otro una ruta desactualizada.

   Y la fecha manda sobre los días. «Cobra en 13d» deja al cobrador contando con
   los dedos; «el 19 de agosto» es lo que se le dice al cliente en la puerta.
   Los días van AL LADO, nunca en lugar de ella. */
const CAJA_ZONA = {
  aldia:    { fondo: 'var(--cf-card)', borde: '1px solid var(--cf-border)', anillo: 'var(--cf-green)' },
  sindeuda: { fondo: 'color-mix(in srgb, var(--cf-gold) 6%, var(--cf-card))',
              borde: '1px solid var(--cf-gold-border)', anillo: 'var(--cf-gold)' },
  // Sin tarjeta: no es una parada ni una oportunidad, es una fila pendiente de
  // limpiar. Darle caja la pondría al mismo nivel que las otras dos.
  inactivo: { fondo: 'transparent', borde: '1px solid transparent', anillo: null },
}

const PASTILLA_ZONA = {
  aldia:    { texto: 'Al día', ...PASTILLA.aldia },
  sindeuda: { texto: 'Listo',  ...PASTILLA.atraso },
  inactivo: null,
}

export function FilaFueraDeParada({
  nombre, iniciales, estado = 'aldia', subtitulo, detalle, apunte,
  accion, onAccion, onClick,
}) {
  const caja = CAJA_ZONA[estado] ?? CAJA_ZONA.aldia
  const pastilla = PASTILLA_ZONA[estado]
  const esInactivo = estado === 'inactivo'

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        background: caja.fondo, border: caja.borde,
        borderRadius: 'var(--cf-r-card)', flex: 'none',
        padding: esInactivo ? '9px 14px' : '13px 15px',
        display: 'flex', flexDirection: 'column', gap: 11,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* El inactivo lleva el avatar más chico y SIN anillo: el anillo dice
            cómo va un cobro, y aquí no hay cobro del que hablar. */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: esInactivo ? 32 : 38, height: esInactivo ? 32 : 38,
          minWidth: esInactivo ? 32 : 38, minHeight: esInactivo ? 32 : 38,
          aspectRatio: '1', borderRadius: 999, flex: 'none',
          background: 'var(--cf-fill)',
          border: caja.anillo ? `2px solid ${caja.anillo}` : 'none',
          fontSize: esInactivo ? 12 : 14, fontWeight: 700,
          color: esInactivo ? 'var(--cf-ink-3)' : 'var(--cf-ink-2)',
        }}>{iniciales}</span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: esInactivo ? 14 : 15, fontWeight: 700, letterSpacing: '-.01em',
            color: esInactivo ? 'var(--cf-ink-2)' : 'var(--cf-ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{nombre}</span>
          {subtitulo && (
            <span style={{ fontSize: 12, lineHeight: 1.35, color: 'var(--cf-ink-3)' }}>{subtitulo}</span>
          )}
        </div>

        {/* El inactivo se lleva el botón a la primera línea: no tiene segunda.
            No hay nada que contar de alguien que no tiene préstamo. */}
        {esInactivo && accion && (
          <BotonZona onClick={onAccion} tono="apagado">{accion}</BotonZona>
        )}

        {pastilla && (
          <span className="cf-num" style={{
            display: 'inline-flex', alignItems: 'center', flex: 'none',
            height: 21, padding: '0 9px', borderRadius: 'var(--cf-r-pill)',
            background: pastilla.bg, border: `1px solid ${pastilla.bd}`, color: pastilla.fg,
            fontSize: 11, fontWeight: 700,
          }}>{pastilla.texto}</span>
        )}
      </div>

      {!esInactivo && (detalle || accion) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {detalle && (
              <span style={{ fontSize: 12.5, lineHeight: 1.35, color: 'var(--cf-ink-2)' }}>{detalle}</span>
            )}
            {apunte && (
              <span style={{ fontSize: 12, lineHeight: 1.35, color: 'var(--cf-ink-3)' }}>{apunte}</span>
            )}
          </div>
          {accion && (
            /* DORADO SÓLIDO solo en «Prestarle». Es la única de las tres que
               gana dinero, y la lámina denuncia justo lo contrario: el botón de
               antes era dorado PÁLIDO sobre gris y «no se lee como acción, se
               lee como algo deshabilitado». «Cobrar antes» va secundario a
               propósito: cobrarle hoy es un adelanto, no la cuota. */
            <BotonZona onClick={onAccion} tono={estado === 'sindeuda' ? 'oro' : 'apagado'}>
              {accion}
            </BotonZona>
          )}
        </div>
      )}
    </div>
  )
}

function BotonZona({ children, onClick, tono = 'apagado' }) {
  const oro = tono === 'oro'
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.() }}
      style={{
        flex: 'none', height: 38, padding: '0 15px', cursor: 'pointer',
        borderRadius: 'var(--cf-r-control)', font: 'inherit',
        fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
        background: oro ? 'var(--cf-gold)' : 'var(--cf-card)',
        border: oro ? 'none' : '1px solid var(--cf-border-strong)',
        color: oro ? 'var(--cf-gold-ink)' : 'var(--cf-ink-2)',
      }}
    >{children}</button>
  )
}
