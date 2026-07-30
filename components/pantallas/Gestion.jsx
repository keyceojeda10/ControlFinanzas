'use client'

// components/pantallas/Gestion.jsx — turnos 13 y 19. Las hojas que cambian plata.
//
// Todas siguen el MISMO patrón, y en este orden:
//
//     qué cambia arriba · el control en medio · antes → después abajo
//
// Y todas terminan en un botón que dice la acción CON SU CIFRA. «Aplicar» no es
// una decisión; «Aplicar $15.000» sí.
//
// Cada una existe porque tiene una consecuencia que hoy NO SE VE antes de
// confirmar. Están marcadas una por una más abajo.
//
// ── LA REGLA DEL COLOR EN «ANTES → DESPUÉS» ─────────────────────────────────
//
// El color del «después» dice QUÉ LE PASA A TU PLATA. No a la del cliente, y no
// si la decisión es buena idea.
//
//   perdidos    → ROJO.    Tu cartera baja de verdad.
//   descuento   → VERDE en «le queda debiendo», porque lo que baja es LA DEUDA
//                 DEL CLIENTE, que es lo que esa fila mide. Lo que te pasa a ti
//                 lo dicen las dos líneas de abajo: tu ganancia baja, tu capital
//                 lo sigues recuperando. Así lo pinta T19-03 y tiene razón: el
//                 color describe la fila, no el juicio.
//   plazo       → VERDE en la cuota, porque baja y eso es el hecho. Y la línea
//                 que evita la pelea: «lo que vas a recibir es igual».
//   recargo     → NEUTRO. Tu plata sube, así que rojo no; y verde tampoco,
//                 porque si la jugada es mala idea eso se DICE con una frase,
//                 que es algo que un color no sabe hacer.
//
// ── LA CABECERA LLEVA FLECHA ATRÁS, NO X ────────────────────────────────────
//
// Las cinco láminas dibujan «‹» y no «✕». No es un detalle: a estas hojas se
// entra DESDE el menú de gestión, así que volver atrás es volver al menú, no
// cerrar y quedarse en la ficha. Con una X, el dueño que quería el descuento y
// se equivocó de opción tiene que empezar de cero.
//
// ── LO QUE NO SE CONSTRUYE, Y POR QUÉ ───────────────────────────────────────
//
// Tres láminas piden decisiones que el backend HOY NO MODELA. Están anotadas en
// su sitio con `PENDIENTE-BACKEND`. No se dibuja el selector: un control que se
// mueve y no cambia nada es el patrón que ya lleva ocho apariciones en este
// rediseño. En su lugar, el bloque negro dice la verdad de lo que sí pasa.

import { AntesDespues, Aviso, BotonSecundario } from '@/components/cf/primitivos'

const ORO = '#E7A400'

/* ══ Piezas compartidas ════════════════════════════════════════════════════ */

/* Etiqueta de sección: 10px, 700, .1em, mayúsculas. */
function Rotulo({ children, style }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--cf-ink-3)', flex: 'none', ...style,
    }}>{children}</span>
  )
}

/* Opciones que se reparten el ancho a partes iguales, el activo en NEGRO. Es la
   misma pieza de «¿a qué se aplica?» de la hoja de pago: cuando la elección
   cambia lo que pasa con la plata, el activo va en negro y no en dorado suave. */
function Opciones({ opciones = [], activo, onElegir, alto = 46 }) {
  return (
    <div style={{ display: 'flex', gap: 7, flex: 'none' }}>
      {opciones.map((o) => {
        const on = o.id === activo
        return (
          <button key={o.id} type="button" onClick={() => onElegir?.(o)} aria-pressed={on} style={{
            flex: 1, minWidth: 0, height: alto, borderRadius: 14, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 8px', font: 'inherit', fontSize: 13, fontWeight: on ? 700 : 600,
            textAlign: 'center', lineHeight: 1.2,
            ...(on
              ? { background: 'var(--cf-ink)', color: 'var(--cf-surface)', border: 'none' }
              : { background: 'var(--cf-card)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }),
          }}>{o.etiqueta}</button>
        )
      })}
    </div>
  )
}

/* Atajos de monto: el activo en DORADO SUAVE, porque son una ayuda para escribir
   y no una decisión. Mismo criterio que en la hoja de pago. */
function Atajos({ opciones = [], activo, onElegir }) {
  return (
    <div style={{ display: 'flex', gap: 7, flex: 'none' }}>
      {opciones.map((o) => {
        const on = o.id === activo
        return (
          <button key={o.id} type="button" onClick={() => onElegir?.(o)} aria-pressed={on} style={{
            flex: 1, minWidth: 0, height: 42, borderRadius: 14, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 6px', font: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 600,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            ...(on
              ? {
                  background: 'var(--cf-gold-tint)', color: 'var(--cf-gold-ink)',
                  border: `1px solid color-mix(in srgb, ${ORO} 35%, transparent)`,
                }
              : { background: 'var(--cf-fill)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }),
          }}>{o.etiqueta}</button>
        )
      })}
    </div>
  )
}

/* Etiquetas que envuelven, con el activo en anillo dorado. Son los motivos: «se
   mudó / no contesta / otro» en T13-03 y «le pagan el viernes / no estaba / está
   enfermo / otro» en T19-01. Envuelven y NO se recortan, porque una opción a
   medias no se puede elegir — y estos textos son frases, no palabras.

   Estaba escrita a mano dentro de `MoverAPerdidos`, y en cuanto la segunda
   pantalla la necesitó habría habido dos copias de lo mismo divergiendo. */
function Etiquetas({ opciones = [], activo, onElegir }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {opciones.map((o) => {
        const on = o.id === activo
        return (
          <button key={o.id} type="button" onClick={() => onElegir?.(o)} aria-pressed={on} style={{
            display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 14px',
            borderRadius: 14, cursor: 'pointer', font: 'inherit', flex: 'none',
            fontSize: 13, fontWeight: on ? 700 : 600,
            background: 'var(--cf-card)',
            color: on ? 'var(--cf-gold-ink)' : 'var(--cf-ink-2)',
            border: on ? `1.5px solid ${ORO}` : '1px solid var(--cf-border)',
          }}>{o.etiqueta}</button>
        )
      })}
    </div>
  )
}

/* El campo de monto con anillo dorado. Es la misma tarjeta de la hoja de pago:
   rótulo, `$` a 23 y la cifra a 38, y debajo los atajos. Va con anillo porque en
   estas hojas también es lo único que hay que teclear. */
function CampoMonto({ rotulo, monto, moneda = '$', onMonto, atajos, atajoActivo, onAtajo }) {
  return (
    <div style={{
      flex: 'none', background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
      border: `1.5px solid ${ORO}`, boxShadow: '0 0 0 3px rgba(231,164,0,.13)',
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 11,
    }}>
      <Rotulo>{rotulo}</Rotulo>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        <span style={{ fontSize: 23, fontWeight: 600, color: 'var(--cf-ink-3)', flex: 'none' }}>{moneda}</span>
        {/* `type=text` con `inputMode=decimal`: `type=number` rechaza el separador
            que no coincide con el locale del teléfono, y son 12 países. */}
        <input
          value={monto ?? ''}
          onChange={(e) => onMonto?.(e.target.value)}
          type="text" inputMode="decimal" autoComplete="off"
          aria-label={rotulo}
          className="cf-fig"
          style={{
            flex: 1, minWidth: 0, border: 0, background: 'none', padding: 0,
            outline: 'none', font: 'inherit',
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 38, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1,
            color: 'var(--cf-ink)',
          }}
        />
      </div>
      {atajos?.length > 0 && <Atajos opciones={atajos} activo={atajoActivo} onElegir={onAtajo} />}
    </div>
  )
}

/* Contador con ±, en su tarjeta con anillo dorado. Sustituye al campo «días
   extra» más el selector de fecha, que se contradecían entre sí: dos controles
   para una misma cifra siempre acaban discrepando.

   El «+» va en dorado suave y el «−» en gris: en «extender plazo» sumar es lo que
   se viene a hacer, y el botón que se va a pulsar se encuentra sin buscarlo. */
function Contador({ rotulo, antes, valor, unidad, onMenos, onMas, minimo }) {
  const caja = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 48, height: 48, borderRadius: 14, flex: 'none', cursor: 'pointer',
    font: 'inherit',
  }
  return (
    <div style={{
      flex: 'none', background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
      border: `1.5px solid ${ORO}`, boxShadow: '0 0 0 3px rgba(231,164,0,.13)',
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <Rotulo>{rotulo}</Rotulo>
        {antes != null && (
          <span className="cf-num" style={{ fontSize: 15, fontWeight: 600, color: 'var(--cf-ink-3)', flex: 'none' }}>
            antes {antes}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          type="button" aria-label="Menos" onClick={onMenos}
          disabled={minimo != null && valor <= minimo}
          style={{
            ...caja, background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
            opacity: minimo != null && valor <= minimo ? 0.4 : 1,
            cursor: minimo != null && valor <= minimo ? 'not-allowed' : 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)" strokeWidth="2.6" strokeLinecap="round">
            <path d="M6 12h12" />
          </svg>
        </button>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span className="cf-fig" style={{ fontSize: 38, fontWeight: 600, letterSpacing: '-.035em', lineHeight: 1, color: 'var(--cf-ink)' }}>
            {valor}
          </span>
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{unidad}</span>
        </span>
        <button type="button" aria-label="Más" onClick={onMas} style={{
          ...caja,
          background: 'var(--cf-gold-tint)',
          border: `1px solid color-mix(in srgb, ${ORO} 35%, transparent)`,
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-dark)" strokeWidth="2.6" strokeLinecap="round">
            <path d="M12 6v12M6 12h12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

/* Campo de texto de una línea, para el motivo. Va aparte del `Campo` del sistema
   porque la lámina lo quiere a 52px con radio 14 y el texto a 16 — el tamaño al
   que se escribe con el pulgar sin que el teléfono haga zoom. */
function CampoTexto({ rotulo, valor, onCambio, sugerencia, alto = 52, fuente = 16 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
      <Rotulo>{rotulo}</Rotulo>
      <input
        value={valor ?? ''}
        onChange={(e) => onCambio?.(e.target.value)}
        placeholder={sugerencia}
        aria-label={rotulo}
        style={{
          height: alto, padding: '0 16px', borderRadius: 14, width: '100%',
          background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
          font: 'inherit', fontSize: fuente, color: 'var(--cf-ink)', outline: 'none',
        }}
      />
    </div>
  )
}

/* Una opción en fila con radio, sub-línea y cifra a la derecha (T19-04). Se usa
   cuando las opciones NO son comparables de un vistazo: ahí un botón cuadrado
   esconde justo la cifra que hay que comparar. */
function FilaOpcion({ titulo, nota, valor, valorTono, activo, onClick }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={activo} style={{
      display: 'flex', alignItems: 'center', gap: 12, flex: 'none', width: '100%',
      padding: '10px 16px', borderRadius: 16, cursor: 'pointer', textAlign: 'left',
      font: 'inherit', background: 'var(--cf-card)',
      border: activo ? `1.5px solid ${ORO}` : '1px solid var(--cf-border)',
      boxShadow: activo ? '0 0 0 3px rgba(231,164,0,.13)' : 'none',
    }}>
      <span aria-hidden style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 22, height: 22, borderRadius: 999, flex: 'none',
        background: activo ? ORO : 'transparent',
        border: activo ? 'none' : '1.5px solid color-mix(in srgb, var(--cf-ink) 18%, transparent)',
      }}>
        {activo && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-ink)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>{titulo}</span>
        {nota && <span style={{ fontSize: 12, color: 'var(--cf-ink-3)', lineHeight: 1.35 }}>{nota}</span>}
      </span>
      {valor && (
        <span
          className={valorTono === 'enlace' ? undefined : 'cf-fig'}
          style={{
            flex: 'none', fontSize: valorTono === 'enlace' ? 13 : 17,
            fontWeight: valorTono === 'enlace' ? 700 : 600,
            letterSpacing: valorTono === 'enlace' ? undefined : '-.02em',
            color: valorTono === 'enlace' ? 'var(--cf-gold-dark)' : 'var(--cf-ink)',
          }}
        >{valor}</span>
      )}
    </button>
  )
}

/* Dos casillas altas con título y consecuencia debajo (T19-03). El activo va en
   NEGRO: aquí la elección cambia de dónde sale la plata, no cómo se ve. */
function DosCaminos({ opciones = [], activo, onElegir }) {
  return (
    <div style={{ display: 'flex', gap: 7, flex: 'none' }}>
      {opciones.map((o) => {
        const on = o.id === activo
        return (
          <button key={o.id} type="button" onClick={() => onElegir?.(o)} aria-pressed={on} style={{
            flex: 1, minWidth: 0, height: 60, borderRadius: 14, cursor: 'pointer',
            display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 2, padding: '0 8px', font: 'inherit',
            ...(on
              ? { background: 'var(--cf-ink)', border: 'none' }
              : { background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }),
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: on ? 'var(--cf-surface)' : 'var(--cf-ink-2)' }}>
              {o.etiqueta}
            </span>
            {/* Sobre negro, `#A3A8B2` a mano: el token de tinta clara no existe en
                esa palette y `--cf-ink-3` sobre negro no se lee. */}
            <span style={{ fontSize: 11, color: on ? '#A3A8B2' : 'var(--cf-ink-3)' }}>{o.nota}</span>
          </button>
        )
      })}
    </div>
  )
}

/* El pie: Cancelar más la acción. La acción va a `flex: 1.7` y Cancelar a 1, para
   que el pulgar caiga en la acción sin que Cancelar desaparezca. */
export function PieGestion({
  onCancelar, textoCancelar = 'Cancelar',
  onAceptar, textoAceptar, aceptando = false, deshabilitado = false, error,
  // `peligro` invierte los pesos: la acción destructiva se queda en rojo de
  // contorno y la que gana peso es la de NO hacerlo. Es lo que pide T13-03.
  peligro = false,
}) {
  const muerto = aceptando || deshabilitado
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%' }}>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--cf-red-dark)', textAlign: 'center' }}>
          {error}
        </span>
      )}
      <div style={{ display: 'flex', gap: 10, width: '100%' }}>
        <button type="button" onClick={onCancelar} style={{
          flex: peligro ? 1.2 : 1, height: 52, borderRadius: 14, cursor: 'pointer',
          background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
          font: 'inherit', fontSize: 15, fontWeight: peligro ? 700 : 600,
          color: peligro ? 'var(--cf-ink)' : 'var(--cf-ink-2)',
        }}>{textoCancelar}</button>

        <button type="button" onClick={onAceptar} disabled={muerto} style={{
          flex: peligro ? 1 : 1.7, height: 52, borderRadius: 14,
          font: 'inherit', fontSize: peligro ? 15 : 16, fontWeight: 700,
          cursor: muerto ? 'not-allowed' : 'pointer',
          opacity: muerto ? 0.55 : 1,
          ...(peligro
            ? {
                background: 'var(--cf-card)',
                border: '1px solid color-mix(in srgb, var(--cf-red) 35%, transparent)',
                color: 'var(--cf-red-dark)',
              }
            : { background: ORO, border: 'none', color: 'var(--cf-gold-ink)' }),
        }}>{aceptando ? 'Guardando…' : textoAceptar}</button>
      </div>
    </div>
  )
}

/* ══ T13-01 · Recargo ══════════════════════════════════════════════════════
   LO QUE FALTA HOY: el recargo no es una pantalla, es un `tipo` dentro del modal
   de cobro, entre completo, parcial, a capital, intereses y descuento. El motivo
   ya es obligatorio, y eso está bien.

   PENDIENTE-BACKEND · «¿Cuándo lo cobra?». La lámina ofrece «en la próxima cuota»
   o «repartido en las que faltan». Hoy un recargo hace UNA cosa:
   `totalAPagar += monto`. La cuota no se toca, así que el cliente paga lo mismo
   durante más tiempo — o sea, siempre «repartido». Para honrar «en la próxima
   cuota» haría falta subir la fila de la cuota siguiente y, sobre todo, deshacerlo
   al anular el pago; sin eso la tabla y el total quedarían discrepando en silencio,
   que es el fallo que ya costó el abono a capital en globo.
   El selector NO se dibuja. Lo que sí se dice, en el bloque negro, es la verdad:
   la cuota no cambia y quedan N cobros más. */
export function Recargo({
  monto, onMonto, atajos, atajoActivo, onAtajo,
  motivo, onMotivo,
  saldoAntes, saldoDespues, cuotaIgual, cobrosDeMas,
}) {
  return (
    <>
      <CampoMonto
        rotulo="Cuánto le cobras de más"
        monto={monto} onMonto={onMonto}
        atajos={atajos} atajoActivo={atajoActivo} onAtajo={onAtajo}
      />

      <CampoTexto
        rotulo="Motivo (queda en el historial)"
        valor={motivo} onCambio={onMotivo}
        sugerencia="Mora de más de un mes"
      />

      {/* EL TITULAR ES EL SALDO, NO LA CUOTA. La lámina pone la cuota arriba
          porque asume que el recargo cae en la próxima, y eso el backend no lo hace.
          Con la cuota ahí salía «$14.500 tachado → ahora $14.500»: el mismo número a
          los dos lados, uno de ellos tachado, que se lee como una avería. Lo vi al
          capturar. Lo que de verdad cambia es el saldo, y va arriba.

          NEUTRO a propósito: tu plata sube, así que rojo no; y verde tampoco, porque
          si la jugada es mala idea eso se dice con una frase, no con un color.

          Las dos líneas de abajo son la respuesta a la pregunta del cobrador —qué le
          pido mañana—: la cuota sigue igual, le quedan N cobros más. */}
      {/* Solo con las dos cifras: el adaptador devuelve `null` cuando no hay monto,
          y entonces aquí no llegan. Ver la nota de `adaptarRecargo`. */}
      {saldoAntes && saldoDespues && (
      <AntesDespues
        concepto="Saldo total"
        antes={saldoAntes}
        despues={saldoDespues}
        tono="neutro"
        resumen={[
          cuotaIgual ? { etiqueta: 'La cuota', valor: cuotaIgual } : null,
          cobrosDeMas ? { etiqueta: 'Le quedan', valor: cobrosDeMas } : null,
        ].filter(Boolean)}
      />
      )}
    </>
  )
}

/* ══ T13-02 · Modificar el plazo ═══════════════════════════════════════════
   El modal actual YA empieza por la intención —extender, corregir fin, corregir
   inicio— y ya enseña el nuevo plazo, la nueva cuota y el total. Está bien
   pensado. Lo que cambia es LA FORMA: un contador de cuotas con ± en vez de un
   campo «días extra» y un selector de fecha que se contradicen.

   Y la línea que evita la pelea con el cliente: LO QUE VAS A RECIBIR ES IGUAL. */
export function ModificarPlazo({
  intenciones, intencion, onIntencion,
  cuotas, cuotasAntes, unidad, onMenos, onMas, minimoCuotas,
  cuotaAntes, cuotaDespues, terminaAntes, terminaDespues, totalIgual,
}) {
  return (
    <>
      {intenciones?.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 'none' }}>
          <Rotulo>¿Qué quieres cambiar?</Rotulo>
          <Opciones opciones={intenciones} activo={intencion} onElegir={onIntencion} />
        </div>
      )}

      <Contador
        rotulo="Cuotas que faltan"
        antes={cuotasAntes}
        valor={cuotas}
        unidad={unidad}
        onMenos={onMenos}
        onMas={onMas}
        minimo={minimoCuotas}
      />

      {/* VERDE en la cuota porque BAJA, y eso es el hecho que mide esa fila. Lo
          que le pasa a tu plata lo dice la línea de abajo: nada. */}
      <AntesDespues
        concepto="Cuota"
        antes={cuotaAntes}
        despues={cuotaDespues}
        tono="mejora"
        resumen={[
          // SOLO SI LA FECHA SE MUEVE. Recién abierta la hoja, el contador está en las
          // cuotas que ya faltan y la fila salía «jue 25 → jue 25»: la misma fecha a
          // los dos lados. La guardia de `AntesDespues` no puede verlo porque esto es
          // un nodo, no dos valores, así que se decide aquí.
          (terminaAntes && terminaDespues && terminaAntes !== terminaDespues)
            ? {
                etiqueta: 'Termina el',
                // Dos colores en una línea: la fecha nueva en dorado. Por eso `valor`
                // acepta un nodo y no solo una cadena.
                valor: <>{terminaAntes} → <span style={{ color: '#F5B824' }}>{terminaDespues}</span></>,
                texto: true,
              }
            : null,
          totalIgual ? { etiqueta: 'Lo que vas a recibir', valor: totalIgual } : null,
        ].filter(Boolean)}
      />

      <Aviso>
        Estirar el plazo no cobra más intereses: reparte el mismo saldo en más
        cuotas. Sirve para que un cliente apretado no caiga en mora.
      </Aviso>
    </>
  )
}

/* ══ T19-03 · Perdonarle una parte (descuento) ═════════════════════════════
   PENDIENTE-BACKEND · «¿De dónde sale?». La lámina ofrece «de tu ganancia
   (recuperas el capital)» o «del capital (pierdes plata)». Hoy un descuento hace
   UNA cosa: `totalAPagar -= monto`, con una guardia que lo rechaza si pasa del
   espacio disponible. De dónde sale lo decide después la cascada de reparto, no
   una elección del dueño. El selector NO se dibuja.

   Lo que SÍ se dice, y es lo que la lámina quería que se viera: tu ganancia baja
   a X de Y, y tu capital lo sigues recuperando. Esas dos líneas son el contenido
   de la pantalla; el selector era la forma. */
export function Descuento({
  monto, onMonto, atajos, atajoActivo, onAtajo,
  motivo, onMotivo,
  debeAntes, debeDespues, gananciaLinea, capitalLinea,
}) {
  return (
    <>
      <CampoMonto
        rotulo="Cuánto le perdonas"
        monto={monto} onMonto={onMonto}
        atajos={atajos} atajoActivo={atajoActivo} onAtajo={onAtajo}
      />

      <CampoTexto
        rotulo="Por qué (queda en el historial)"
        valor={motivo} onCambio={onMotivo}
        sugerencia="Acuerdo para que se ponga al día"
        alto={46} fuente={15}
      />

      {/* VERDE, y no es una contradicción con «acabas de regalar plata»: esa fila
          mide LO QUE DEBE EL CLIENTE, y eso baja. Lo que te pasa a ti lo dicen las
          dos líneas siguientes. El color describe la fila, no el juicio. */}
      {debeAntes && debeDespues && (
        <AntesDespues
          concepto="Le queda debiendo"
          antes={debeAntes}
          despues={debeDespues}
          tono="mejora"
          resumen={[
            gananciaLinea ? { etiqueta: 'Tu ganancia baja a', valor: gananciaLinea } : null,
            capitalLinea ? { etiqueta: 'Sigues recuperando', valor: capitalLinea } : null,
          ].filter(Boolean)}
        />
      )}
    </>
  )
}

/* ══ T13-03 · Mover a perdidos ═════════════════════════════════════════════
   LA ÚNICA PANTALLA DEL SISTEMA DONDE EL DORADO NO VA EN LA ACCIÓN PRINCIPAL.
   Aquí la acción destacada es «seguir cobrando» y «dar por perdido» queda en rojo
   de contorno. Lo dice el pie de la lámina, y es la decisión de diseño de la
   pantalla entera: se entra a darlo por perdido y se sale sabiendo qué se pierde.

   Antes de decidir enseña cuánto hace que no se le escribe ni se le visita —a
   veces la respuesta es que nadie fue— y ofrece el acuerdo de pago. El motivo
   alimenta la estadística de por qué se pierde plata. */
export function MoverAPerdidos({
  montoEnJuego, contactoLinea, onAcuerdo,
  motivos, motivo, onMotivo,
  carteraAntes, carteraDespues, perdidaEtiqueta, perdidaValor,
}) {
  return (
    <>
      {/* Lo que pasa, en rojo y con la cifra dentro. «Se registra como pérdida» sin
          el número no asusta a nadie, y esta decisión hay que tomarla asustado. */}
      <div style={{
        flex: 'none', display: 'flex', gap: 11, alignItems: 'flex-start',
        padding: '16px 18px', borderRadius: 'var(--cf-r-card)',
        background: 'var(--cf-red-bg)', border: '1px solid var(--cf-red-border)',
      }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-red)" strokeWidth="2.2" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }}>
          <path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" />
        </svg>
        <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--cf-red-darker)' }}>
          Darlo por perdido saca <strong>{montoEnJuego}</strong> de tu cartera y lo
          registra como pérdida del mes. El cliente queda marcado y no podrás
          prestarle otra vez sin quitarle la marca.
        </span>
      </div>

      {/* «A veces la respuesta es que nadie fue». Esta tarjeta es la que convierte
          una decisión de cabreo en una decisión informada. */}
      <div style={{
        flex: 'none', background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
        border: '1px solid var(--cf-border)', padding: '18px 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <Rotulo>Antes de darlo por perdido</Rotulo>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span aria-hidden style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, borderRadius: 999, background: 'var(--cf-fill)', flex: 'none',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 12a8 8 0 01-11.6 7.1L4 20l.9-4.3A8 8 0 1120 12z" />
            </svg>
          </span>
          <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--cf-ink-2)', flex: 1, minWidth: 0 }}>
            {contactoLinea}
          </span>
        </div>
        {onAcuerdo && (
          <button type="button" onClick={onAcuerdo} style={{
            alignSelf: 'flex-start', padding: '10px 0 0', marginTop: 0, width: '100%',
            border: 0, borderTop: '1px solid var(--cf-hairline)', background: 'none',
            cursor: 'pointer', font: 'inherit', textAlign: 'left',
            fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-dark)',
          }}>Probar primero con un acuerdo de pago</button>
        )}
      </div>

      {motivos?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
          <Rotulo>Por qué lo das por perdido</Rotulo>
          <Etiquetas opciones={motivos} activo={motivo} onElegir={onMotivo} />
        </div>
      )}

      {/* ROJO: tu cartera baja de verdad. Es el único de los cinco donde el rojo es
          el color correcto.

          Y SOLO SI HAY ALGO QUE ENSEÑAR. La ficha no siempre conoce la cartera total,
          y sin ella el bloque salía con «Cartera en la calle → ahora» y ni un número
          debajo: una caja negra vacía, que es peor que ninguna. Lo vi al abrirla.
          Cuando falta la cartera pero sí se sabe la pérdida, se enseña solo esa fila;
          cuando no se sabe nada, no hay bloque. */}
      {(carteraAntes && carteraDespues) ? (
        <AntesDespues
          concepto="Cartera en la calle"
          antes={carteraAntes}
          despues={carteraDespues}
          tono="neutro"
          resumen={perdidaValor ? [{ etiqueta: perdidaEtiqueta, valor: perdidaValor, tono: 'contra' }] : null}
        />
      ) : perdidaValor ? (
        <div style={{
          flex: 'none', background: '#15161A', borderRadius: 'var(--cf-r-card)',
          padding: '16px 18px', display: 'flex', alignItems: 'baseline',
          justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 13, color: '#A3A8B2' }}>{perdidaEtiqueta}</span>
          <span className="cf-fig" style={{ fontSize: 20, fontWeight: 600, color: '#F0575C', flex: 'none' }}>
            {perdidaValor}
          </span>
        </div>
      ) : null}
    </>
  )
}

/* ══ T19-04 · Quiere pagar todo hoy (cerrar anticipado) ════════════════════
   Éste SÍ está modelado: `calcularLiquidacionAnticipada` existe y el endpoint
   acepta el tipo `liquidacion`. Así que las tres opciones son de verdad.

   Las tres van en FILAS con radio y cifra a la derecha, no en botones cuadrados:
   lo que hay que comparar son los montos, y en un botón cuadrado la cifra no cabe
   al lado del título.

   El bloque negro no dice «antes → después» sino «SI CIERRA HOY», y enseña las
   dos caras: lo que recibes y lo que dejas de ganar. Más la línea que justifica la
   jugada: esa plata vuelve a tu caja HOY, no en tres meses. */
export function CerrarAnticipado({
  opciones = [], opcion, onOpcion,
  recibes, dejasDeGanar, gananciaTotal, cuandoVuelve,
}) {
  // Con una sola opción esto NO es una elección. Pasa cuando el préstamo ya rebasó su
  // plazo: el interés está todo devengado, no hay nada que perdonar y las tres
  // modalidades dan la misma cifra. Preguntar «¿le cobras el interés que falta?» ahí
  // es preguntar por algo que no existe.
  const eligiendo = opciones.length > 1
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
        <Rotulo>{eligiendo ? '¿Le cobras el interés que falta?' : 'Lo que tiene que pagar hoy'}</Rotulo>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {opciones.map((o) => (
            <FilaOpcion
              key={o.id}
              titulo={o.etiqueta}
              nota={o.nota}
              valor={o.valor}
              valorTono={o.tono}
              activo={o.id === opcion}
              onClick={() => onOpcion?.(o)}
            />
          ))}
        </div>
      </div>

      <div style={{
        flex: 'none', background: '#15161A', borderRadius: 'var(--cf-r-card)',
        padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#A3A8B2' }}>
          Si cierra hoy
        </span>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#8A8E98' }}>Recibes</span>
            <span className="cf-fig" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1, color: '#F3F3F6' }}>
              {recibes}
            </span>
          </span>
          {/* «Dejas de ganar» solo cuando de verdad se deja de ganar algo. Sin la
              guardia salía la etiqueta con un hueco debajo, que es peor que nada:
              parece que la cifra no cargó. */}
          {dejasDeGanar && (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
              <span style={{ fontSize: 11, color: '#8A8E98' }}>Dejas de ganar</span>
              {/* `#F5B824` a mano: bloque siempre oscuro. */}
              <span className="cf-fig" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.025em', lineHeight: 1, color: '#F5B824' }}>
                {dejasDeGanar}
              </span>
            </span>
          )}
        </div>
        <span style={{ height: 1, background: 'rgba(255,255,255,.09)' }} />
        {gananciaTotal && (
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#A3A8B2' }}>Ganancia total del préstamo</span>
            <span className="cf-fig" style={{ fontSize: 15, fontWeight: 600, color: '#F3F3F6', flex: 'none' }}>
              {gananciaTotal}
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#A3A8B2' }}>Esa plata vuelve a tu caja</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#F3F3F6', flex: 'none' }}>{cuandoVuelve}</span>
        </div>
      </div>
    </>
  )
}

/* ══ T19-01 · Aplazar el cobro ═════════════════════════════════════════════
   La hoja que hoy no existe y que el cobrador necesita a diario: el cliente dice
   «vuelva el viernes» y hay que sacarlo de la lista de hoy sin perder el rastro.

   DOS COSAS QUE LA HACEN HONESTA:

   · «Aplazar NO PERDONA EL ATRASO». Sigue contando desde el día que debió pagar.
     Solo lo saca de tu lista de hoy. Sin esa frase, aplazar parece un indulto y se
     usaría para tapar mora — y la mora tapada es la que se convierte en pérdida.
   · «Las demás cuotas NO SE MUEVEN». Solo se mueve este cobro. Aplazar no es
     estirar el plazo: para eso está T13-02, y confundirlos cambia lo que el
     cliente acaba pagando.

   Y «¿qué te dijo?» no es burocracia: es el dato que explica por qué una ruta se
   cae. «No estaba» tres veces seguidas no es lo mismo que «le pagan el viernes».

   NOTA · `proximoCobroManual`. Mover este cobro escribe ese campo, y ese campo
   PISA el cálculo del día ancla: mientras esté puesto, cambiar la frecuencia o el
   día de cobro no mueve la fecha. Quien monte esta hoja tiene que limpiarlo en
   todo cambio de calendario, que es el bug que ya costó una sesión. */
export function AplazarCobro({
  cuandos = [], cuando, onCuando,
  motivos = [], motivo, onMotivo,
  cobrasAntes, cobrasDespues, cobrasHoyLinea, avisoCuotas = 'no se mueven',
}) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 'none' }}>
        <Rotulo>¿Para cuándo?</Rotulo>
        <div style={{ display: 'flex', gap: 7 }}>
          {cuandos.map((c) => {
            const on = c.id === cuando
            return (
              <button key={c.id} type="button" onClick={() => onCuando?.(c)} aria-pressed={on} style={{
                flex: 1, minWidth: 0, height: 64, borderRadius: 14, cursor: 'pointer',
                display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 2, padding: '0 6px', font: 'inherit',
                background: 'var(--cf-card)',
                border: on ? `1.5px solid ${ORO}` : '1px solid var(--cf-border)',
                boxShadow: on ? '0 0 0 3px rgba(231,164,0,.13)' : 'none',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: on ? 'var(--cf-gold-ink)' : 'var(--cf-ink-2)' }}>
                  {c.etiqueta}
                </span>
                <span className="cf-num" style={{ fontSize: 11, color: on ? 'var(--cf-gold-ink)' : 'var(--cf-ink-3)' }}>
                  {c.nota}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {motivos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 'none' }}>
          <Rotulo>¿Qué te dijo?</Rotulo>
          <Etiquetas opciones={motivos} activo={motivo} onElegir={onMotivo} />
        </div>
      )}

      {/* Valores de TEXTO, no de plata: lo que cambia es un día. */}
      <AntesDespues
        concepto="Lo cobras"
        antes={cobrasAntes}
        despues={cobrasDespues}
        tono="neutro"
        texto
        resumen={[
          cobrasHoyLinea ? { etiqueta: 'Cobras hoy', valor: cobrasHoyLinea } : null,
          { etiqueta: 'Las demás cuotas', valor: avisoCuotas, texto: true },
        ].filter(Boolean)}
      />

      <Aviso>
        Aplazar no perdona el atraso: sigue contando desde el día que debió pagar.
        Solo lo saca de tu lista de hoy.
      </Aviso>
    </>
  )
}

/* ══ T19-02 · Cambiar el día de cobro ══════════════════════════════════════
   «PARA SIEMPRE, NO SOLO ESTA VEZ» va en el subtítulo, y es toda la pantalla:
   es lo que la separa de aplazar. Quien quiere mover un cobro entra aquí por
   error y le cambia el calendario al cliente para siempre.

   EL DOMINGO SALE APAGADO si está desactivado en la configuración de la
   organización. Apagado y no escondido: si falta un día en la fila, el dueño se
   pregunta si la app está rota; apagado, entiende que él lo apagó y dónde
   cambiarlo. Lo mismo con cualquier otro día sin cobro.

   NOTA · el mismo `proximoCobroManual` de T19-01: cambiar el día de cobro tiene
   que LIMPIARLO, o la fecha no se mueve y parece que el cambio no se guardó. */
export function DiaDeCobro({
  dias = [], dia, onDia, nota,
  desdes = [], desde, onDesde,
  cobraAntes, cobraDespues, proximoCobro,
}) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 'none' }}>
        <Rotulo>¿Qué día de la semana?</Rotulo>
        <div style={{ display: 'flex', gap: 5 }}>
          {dias.map((d) => {
            const on = d.id === dia
            return (
              <button
                key={d.id} type="button"
                onClick={() => !d.apagado && onDia?.(d)}
                disabled={d.apagado}
                aria-pressed={on}
                title={d.apagado ? 'Apagado en tu configuración' : undefined}
                style={{
                  flex: 1, minWidth: 0, height: 52, borderRadius: 12,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  font: 'inherit', fontSize: 13, fontWeight: on ? 700 : 600,
                  cursor: d.apagado ? 'not-allowed' : 'pointer',
                  ...(on
                    ? { background: 'var(--cf-ink)', color: 'var(--cf-surface)', border: 'none' }
                    : d.apagado
                      // Apagado: relleno gris y borde más suave. Se ve que está ahí y
                      // que no se puede tocar, que es distinto de no estar.
                      ? { background: 'var(--cf-fill)', color: 'var(--cf-ink-4)', border: '1px solid var(--cf-hairline)' }
                      : { background: 'var(--cf-card)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }),
                }}
              >{d.etiqueta}</button>
            )
          })}
        </div>
        {nota && <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{nota}</span>}
      </div>

      {desdes.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 'none' }}>
          <Rotulo>¿Desde cuándo?</Rotulo>
          <Opciones opciones={desdes} activo={desde} onElegir={onDesde} alto={48} />
        </div>
      )}

      <AntesDespues
        concepto="Le cobras los"
        antes={cobraAntes}
        despues={cobraDespues}
        tono="neutro"
        texto
        resumen={[{ etiqueta: 'Próximo cobro', valor: proximoCobro, texto: true }]}
      />
    </>
  )
}

/* ══ T19-05 · Corregir el préstamo ═════════════════════════════════════════
   LA PANTALLA MÁS PELIGROSA DEL SISTEMA, y por eso se parte en dos:

     arriba  lo que RECALCULA los pagos hacia atrás, marcado en rojo CAMPO POR
             CAMPO con lo que cada uno rompe;
     abajo   lo que se puede tocar sin miedo.

   No es un formulario plano donde el monto prestado y la nota interna valen lo
   mismo. El aviso de arriba deja clara la intención: esto arregla ERRORES DE
   DIGITACIÓN. Para renegociar están las otras siete hojas de gestión.

   NO ES UNA HOJA INFERIOR. La lámina la dibuja a pantalla completa, con su propia
   cabecera y flecha atrás. Tiene sentido: una hoja se cierra con un gesto hacia
   abajo, y aquí un gesto de más deja a medias un cambio que reescribe el
   histórico. Se sale por la flecha, a propósito.

   Cada fila peligrosa lleva SU PROPIA consecuencia —«recalcula 22 pagos», «mueve
   las fechas»—, no un aviso genérico arriba. Un aviso genérico se lee una vez y se
   olvida; la pastilla está al lado del campo que se va a tocar. */
export function CorregirPrestamo({
  aviso, peligrosos = [], seguros = [], firma = 'Cada cambio queda firmado con tu nombre y la hora.',
}) {
  return (
    <>
      {aviso && (
        <div style={{
          flex: 'none', display: 'flex', gap: 11, alignItems: 'flex-start',
          padding: '13px 17px', borderRadius: 'var(--cf-r-card-sm)',
          background: 'var(--cf-red-bg)', border: '1px solid var(--cf-red-border)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-red)" strokeWidth="2.2" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }}>
            <path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17h.01" />
          </svg>
          <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--cf-red-darker)' }}>{aviso}</span>
        </div>
      )}

      {/* Los campos que reescriben el histórico. Van juntos en una tarjeta, con
          filete entre filas: la agrupación ES la advertencia. */}
      {peligrosos.length > 0 && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
        }}>
          {peligrosos.map((c, i) => (
            <button
              key={c.clave}
              type="button"
              onClick={c.onTocar}
              style={{
                display: 'flex', flexDirection: 'column', gap: 6, width: '100%',
                padding: '12px 18px', textAlign: 'left', font: 'inherit',
                background: 'none', border: 0,
                borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
                cursor: c.onTocar ? 'pointer' : 'default',
              }}
            >
              <Rotulo>{c.etiqueta}</Rotulo>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
                <span
                  className={c.texto ? undefined : 'cf-fig'}
                  style={{
                    flex: 1, minWidth: 0, fontSize: c.texto ? 17 : 20, fontWeight: 600,
                    color: 'var(--cf-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}
                >{c.valor}</span>
                {/* La consecuencia DE ESTE CAMPO, no un aviso genérico. */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', height: 26, padding: '0 10px',
                  borderRadius: 11, flex: 'none',
                  background: 'var(--cf-red-pill-bg)', border: '1px solid var(--cf-red-pill-border)',
                  fontSize: 11, fontWeight: 700, color: 'var(--cf-red-dark)',
                }}>{c.consecuencia}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {seguros.length > 0 && (
        <>
          <Rotulo style={{ padding: '4px 2px 0' }}>Se puede cambiar sin riesgo</Rotulo>
          <div style={{
            flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
            borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
          }}>
            {seguros.map((c, i) => (
              <div key={c.clave} style={{
                display: 'flex', flexDirection: 'column', gap: 7, padding: '12px 18px',
                borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
              }}>
                <Rotulo>{c.etiqueta}</Rotulo>
                {c.tipo === 'nota' ? (
                  <textarea
                    value={c.valor ?? ''}
                    onChange={(e) => c.onCambio?.(e.target.value)}
                    rows={2}
                    aria-label={c.etiqueta}
                    style={{
                      minHeight: 54, padding: '12px 15px', borderRadius: 12, width: '100%',
                      background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
                      font: 'inherit', fontSize: 14, lineHeight: 1.45, color: 'var(--cf-ink-2)',
                      resize: 'vertical', outline: 'none',
                    }}
                  />
                ) : (
                  <button type="button" onClick={c.onTocar} style={{
                    display: 'flex', alignItems: 'center', gap: 11, width: '100%',
                    height: 48, padding: '0 15px', borderRadius: 12, cursor: 'pointer',
                    background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
                    font: 'inherit', textAlign: 'left',
                  }}>
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{c.valor}</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* La firma no es un adorno legal: es lo que permite que dos personas se
          repartan el trabajo sin desconfiar. */}
      {firma && (
        <div style={{
          flex: 'none', display: 'flex', alignItems: 'center', gap: 11,
          padding: '12px 16px', borderRadius: 14,
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)" strokeWidth="2" strokeLinecap="round" style={{ flex: 'none' }}>
            <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
          </svg>
          <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-2)', flex: 1 }}>{firma}</span>
        </div>
      )}
    </>
  )
}
