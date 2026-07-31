'use client'

// components/pantallas/FichaPrestamo.jsx
//
// LA FICHA CANÓNICA DE PRÉSTAMO. Turno 41·01, adenda 06 §1.
//
// ⚠️ ESTA es la ficha por defecto, no la que tiene tabla de amortización.
// `fijo` + `manual` + `proporcional` son el 75,1% de la cartera; con `unico`,
// el 93,7%. La ficha con tabla cubre el 6,2% y es la VARIANTE.
// `05-PANTALLAS.md` los tiene invertidos.
//
// TRES REGLAS QUE NO SE PUEDEN ROMPER EN LOS MODOS SIN TABLA:
//
//  1. NUNCA repartir el interés por pago. Se sabe que el interés total son
//     $100.000; no se sabe cuánto de cada pago fue interés. Mostrarlo sería
//     fabricar un dato.
//  2. NO dibujar un calendario proyectado de 30 filas idénticas. En `fijo` el
//     calendario ES la frase "$20.000 diarios durante 30 días", y ya está en el
//     subtítulo y en "cómo se pactó". Treinta filas iguales es relleno.
//  3. Los números feos se dejan feos. "39 semanas" no se redondea a 40: el dueño
//     va a cobrar 39 veces. Un plazo redondeado es un plazo mentiroso.

import { Tarjeta, BloqueOscuro, BarraProgreso, BotonPrimario, BotonSecundario, BarraAccion, Moneda, Aviso } from '@/components/cf/primitivos'

/* Tira de tres cifras en tarjeta blanca (móvil). En escritorio son cinco. */
function TiraTres({ columnas }) {
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'stretch', flex: 'none',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', padding: '15px 18px',
    }}>
      {columnas.map((c, i) => (
        <div key={i} style={{ display: 'contents' }}>
          {i > 0 && <span style={{ width: 1, background: 'var(--cf-divider)', flex: 'none' }} />}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--cf-ink-3)', whiteSpace: 'nowrap' }}>
              {c.etiqueta}
            </span>
            <span className="cf-fig" style={{
              fontSize: 16,
              color: c.tono === 'contra'  ? 'var(--cf-red-dark)'
                   : c.tono === 'favor'   ? 'var(--cf-green-dark)'
                   : c.tono === 'apagado' ? 'var(--cf-ink-3)'
                   : 'var(--cf-ink)',
            }}>{c.valor}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* Historial de pagos. Cada fila dice el saldo QUE LE QUEDÓ: es la palabra que
   usa el prestamista cuando el cliente reclama, y para eso se abre esto. */
function Historial({ pagos = [], total, montoOculto, onVerTodos, notaPie, esUnico = false }) {
  // En `unico` son ABONOS, no pagos: no hay cuotas que pagar, asi que cualquier
  // entrega antes del vencimiento es voluntaria. La palabra lo dice.
  const rotulo = esUnico ? 'Abonos que ha hecho' : 'Cada pago que ha hecho'

  if (pagos.length === 0) {
    return (
      <Tarjeta>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
            {rotulo}
          </span>
          <span style={{ fontSize: 11, color: 'var(--cf-ink-3)', flex: 'none' }}>ninguno</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 8px 20px' }}>
          <Moneda tam={56} />
          {/* LA FRASE TRANQUILIZA EN VEZ DE ALARMAR, y no es cortesia: el pie de
              T41-02 lo dice —«sin esa frase, un dueño con 882 prestamos asi ve
              882 fichas que parecen impagas»—. Un historial vacio en un prestamo
              a un solo pago es lo NORMAL, no una senal de nada. */}
          <span style={{ fontSize: 13.5, color: 'var(--cf-ink-2)', textAlign: 'center', lineHeight: 1.5, maxWidth: '34ch' }}>
            {notaPie || (esUnico
              ? 'Todavía no te ha abonado nada. Es normal: en este tipo de préstamo se paga al final.'
              : 'Todavía no te ha abonado nada.')}
          </span>
        </div>
      </Tarjeta>
    )
  }

  return (
    <Tarjeta plana>
      {/* «CADA PAGO QUE HA HECHO», con su conteo a la derecha. Decia «Cómo viene
          pagando», que es una interpretacion —suena a valoracion del cliente— y
          esto no interpreta nada: es la lista de lo que pago. Y el conteo importa:
          sin el, dos filas visibles parecen ser todo el historial. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '14px 18px 11px', flex: 'none',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
          {rotulo}
        </span>
        {total > 0 && (
          <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)', flex: 'none' }}>
            {total} {esUnico ? (total === 1 ? 'abono' : 'abonos') : (total === 1 ? 'pago' : 'pagos')}
          </span>
        )}
      </div>
      {pagos.map((p, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 19px',
          borderTop: '1px solid var(--cf-hairline)', flex: 'none', minHeight: 52,
        }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="cf-num" style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--cf-ink)' }}>
              {p.fecha}
            </span>
            {/* UNA sola cadena, ya compuesta: «efectivo · quedó en $469.500».
                Leia `p.medio` y `p.saldo` por separado, y quien la monta pasa
                `detalle` — asi que la segunda linea salia VACIA. Se acepta
                `detalle` y se dejan los dos campos viejos como respaldo. */}
            <span className="cf-num" style={{ display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)', marginTop: 2 }}>
              {p.detalle ?? <>{p.medio}{p.saldo && <> · quedó en {p.saldo}</>}</>}
            </span>
          </span>
          <span className="cf-fig" style={{ fontSize: 15, color: 'var(--cf-green-dark)', flex: 'none' }}>
            {p.monto}
          </span>
        </div>
      ))}
      {total > pagos.length && (
        <button type="button" onClick={onVerTodos} style={{
          display: 'block', width: '100%', padding: '13px 19px', cursor: 'pointer',
          background: 'none', border: 0, borderTop: '1px solid var(--cf-hairline)',
          fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)', textAlign: 'center',
        }}>
          Ves {pagos.length} de los {total}
          {montoOculto && <> · faltan {total - pagos.length} por {montoOculto}</>}
        </button>
      )}
      {notaPie && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9, padding: '12px 18px', flex: 'none',
          borderTop: '1px solid var(--cf-hairline)', background: 'var(--cf-gold-tint-2)',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-dark)" strokeWidth="2" strokeLinecap="round" style={{ flex: 'none' }}>
            <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
          </svg>
          <span style={{ fontSize: 12, color: 'var(--cf-gold-text)', lineHeight: 1.4 }}>{notaPie}</span>
        </div>
      )}
    </Tarjeta>
  )
}

export default function FichaPrestamo({
  modo = 'fijo',              // fijo | manual | proporcional | unico
  // bloque oscuro
  faltaPagar,
  pagado, totalAPagar, porcentaje = 0,
  // unico
  fechaVencimiento, diasParaVencer, empezoEl,
  // tira
  cuota, enMora, cuotasFaltantes,
  // cómo se pactó
  prestado, ganancia, plazoTexto,
  cuotaQuePusiste,            // manual
  tasaTexto,                  // proporcional: "20% al mes, repartido sobre 45 días"
  // historial
  pagos = [], totalPagos = 0, montoOculto, notaHistorial,
  onGestionar, onRegistrar, onVerTodos,
  // ── EL RELLENO LATERAL LO PONE EL ARMAZON, EL COMPONENTE NO ──
  //
  // Sin esta prop, este componente ponia sus 20px de `--cf-pad-screen` ENCIMA
  // de los 20px que ya da `layout.jsx` con `px-5`: 40px por lado, o sea 80px
  // menos de ancho que la tarjeta del cliente y el boton verde de arriba. Se
  // veia como si la mitad de abajo de la ficha fuera otra pantalla, y asi lo
  // reporto el usuario.
  //
  // Es la CUARTA vez que pasa: el panel (310px donde la lamina pide 350),
  // cobrar hoy (302), la tabla de amortizacion, y esta.
  sinMargen = false,
}) {
  const esUnico = modo === 'unico'
  const hayMora = enMora && enMora !== '$0'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      // Con `sinMargen` esto va DENTRO del flujo de una pagina que crece, no es
      // una pantalla de telefono: fijarle el 100% de alto y su propio scroll
      // creaba una ventana con scroll dentro de otra.
      height: sinMargen ? 'auto' : '100%',
    }}>
      <div style={{
        flex: sinMargen ? 'none' : 1, minHeight: 0,
        overflowY: sinMargen ? 'visible' : 'auto',
        display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)',
        padding: sinMargen ? '8px 0 16px' : '8px var(--cf-pad-screen) 16px',
      }}>

        {/* ── La respuesta ── */}
        {esUnico ? (
          // `unico` NO lleva barra de progreso: sin cuotas estaría en 0% todo el
          // plazo, y 882 préstamos que parecen impagos es una alarma falsa.
          // La reemplaza la fecha. Y el verbo es futuro: "te va a pagar".
          <BloqueOscuro etiqueta="Te va a pagar" cifra={faltaPagar}>
            <span style={{ height: 1, background: 'rgba(255,255,255,.09)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 38, borderRadius: 11, flex: 'none',
                background: 'rgba(245,184,36,.16)',
              }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#F5B824" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" />
                </svg>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="cf-num" style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#F3F3F6' }}>
                  {fechaVencimiento}
                </span>
                <span className="cf-num" style={{ display: 'block', fontSize: 12, color: '#8A8E98', marginTop: 2 }}>
                  {diasParaVencer} · todo de una vez
                </span>
              </span>
            </div>
          </BloqueOscuro>
        ) : (
          <BloqueOscuro etiqueta="Le falta pagar" cifra={faltaPagar}>
            {/* `sobreOscuro`: el verde de aca es #2FBE6A, no #12A150. El token
                `--cf-green` vale #12A150 en tema claro —correcto sobre blanco— y
                sobre este negro se hunde. Mismo fallo que tenia el dorado del
                bloque, y por la misma causa: un token de tema dentro de algo que
                no sigue el tema. */}
            <BarraProgreso porcentaje={porcentaje} tono="ok" alto={11} sobreOscuro />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: -4 }}>
              <span className="cf-num" style={{ fontSize: 13, color: '#A3A8B2' }}>
                pagó {pagado} de {totalAPagar}
              </span>
              <span className="cf-num" style={{ fontSize: 13, fontWeight: 700, color: '#F5B824', flex: 'none' }}>
                {porcentaje}%
              </span>
            </div>
          </BloqueOscuro>
        )}

        {/* ── Tira de cifras (no en `unico`: no hay cuota) ── */}
        {!esUnico && (
          <TiraTres columnas={[
            { etiqueta: 'Cuota', valor: cuota },
            // Un "$0" en la columna de mora ocupa el sitio de una cifra sin ser
            // una. La palabra dice lo mismo y no se lee como plata.
            { etiqueta: 'En mora', valor: hayMora ? enMora : 'Nada', tono: hayMora ? 'contra' : 'apagado' },
            { etiqueta: 'Le faltan', valor: cuotasFaltantes },
          ]} />
        )}

        {/* ── Cómo se pactó — el ÚNICO sitio donde aparece el interés ── */}
        {/* Relleno 15/18 y hueco 3, de la lamina: es una tarjeta de TRES LINEAS
            de texto, no una tarjeta de bloques, y con el relleno estandar (16/19,
            gap 12) las tres lineas quedan separadas como si no se leyeran juntas
            — y se leen juntas: son una frase. */}
        <Tarjeta style={{ padding: '15px 18px', gap: 3 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
            Cómo se pactó
          </span>

          {esUnico ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)' }}>Le entregaste</span>
                  <span className="cf-fig" style={{ fontSize: 19, color: 'var(--cf-ink)' }}>{prestado}</span>
                </span>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', marginBottom: 4 }}>
                  <path d="M5 12h14M14 7l5 5-5 5" />
                </svg>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)' }}>te devuelve</span>
                  <span className="cf-fig" style={{ fontSize: 19, color: 'var(--cf-ink)' }}>{totalAPagar}</span>
                </span>
              </div>
              <span style={{ height: 1, background: 'var(--cf-hairline)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>Tu ganancia</span>
                <span className="cf-fig" style={{ fontSize: 15, color: 'var(--cf-green-dark)' }}>{ganancia}</span>
              </div>
              {/* «Empezo el 7 de julio · hace 21 dias». En un prestamo a un solo
                  pago no hay cuotas que cuenten el tiempo, asi que sin esta linea
                  no hay forma de saber si el trato es de la semana pasada o de
                  hace tres meses — y eso cambia cuanto se puede insistir. */}
              {empezoEl && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>Empezó el</span>
                  <span className="cf-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-ink)' }}>{empezoEl}</span>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Escrito como lo diría el prestamista. Nunca "capital" ni "tasa efectiva". */}
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)', lineHeight: 1.45 }}>
                Le presté {prestado}, me paga {totalAPagar}
              </span>

              <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)', lineHeight: 1.45 }}>
                {plazoTexto} · tu ganancia {ganancia}
              </span>

              {/* `manual`: la cuota la puso el dueño, y el verbo lo reconoce. */}
              {cuotaQuePusiste && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 12px', borderRadius: 11,
                  background: 'var(--cf-gold-tint)', border: '1px solid rgba(231,164,0,.28)',
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-dark)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                    <path d="M15.2 5.2l3.6 3.6M16.7 3.7a2.5 2.5 0 013.6 3.6L6.5 21H3v-3.5L16.7 3.7z" />
                  </svg>
                  {/* CON LA CIFRA. Decia solo «esta cuota la pusiste tu, no
                      salio de una formula», que explica el porque y no dice el
                      que. La lamina escribe «cuota que le pusiste: $25.000»: el
                      verbo ya hace el trabajo de reconocer que esa cifra la
                      eligio el, y ademas se lee el numero sin subir a la tira. */}
                  <span className="cf-num" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cf-gold-text)', lineHeight: 1.4 }}>
                    Cuota que le pusiste: {cuotaQuePusiste}
                  </span>
                </span>
              )}

              {/* `proporcional`: la ÚNICA excepción a "no mostrar tasas". El total
                  no es redondo porque salió de una regla de tres; sin esto parece
                  arbitrario. */}
              {tasaTexto && (
                <>
                  <span style={{ height: 1, background: 'var(--cf-hairline)' }} />
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                    <span className="cf-fig" style={{ fontSize: 17, color: 'var(--cf-ink)', flex: 'none' }}>
                      {tasaTexto.tasa}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--cf-ink-2)', lineHeight: 1.4 }}>
                      {tasaTexto.explicacion}
                    </span>
                  </span>
                </>
              )}
            </>
          )}
        </Tarjeta>

        {/* ── `unico`: decir que NO TIENE CUOTAS ──
            Lo pide T41-02, y es la frase que evita el malentendido: un dueño con
            882 préstamos así ve 882 fichas sin pagos y concluye que nadie le
            paga. Acá no hay nada que cobrar todavía —se paga al final— y eso hay
            que escribirlo, no dejarlo deducir. */}
        {esUnico && (
          <Aviso tono="neutro">
            Este préstamo <strong style={{ fontWeight: 700 }}>no tiene cuotas</strong>: se paga
            completo el día del vencimiento. Si te abona antes, se registra igual y baja lo que falta.
          </Aviso>
        )}

        <Historial pagos={pagos} total={totalPagos} montoOculto={montoOculto}
          onVerTodos={onVerTodos} notaPie={notaHistorial} esUnico={esUnico} />
      </div>

      {/* Sin pastilla: en su sitio va la acción de la ficha.

          PERO SOLO SI HAY ACCION. Se pintaba SIEMPRE, asi que montada en una
          pagina que ya tiene su propia pila de botones de cobro salian cuatro
          botones de cobrar en una pantalla de cobrar — y los dos de aca sin
          `onClick` no hacian nada al tocarlos, que es el patron del control
          muerto una vez mas. */}
      {(onGestionar || onRegistrar) && (
        <BarraAccion>
          {onGestionar && <BotonSecundario style={{ flex: 1 }} onClick={onGestionar}>Gestionar</BotonSecundario>}
          {onRegistrar && (
            <BotonPrimario style={{ flex: 1.7 }} onClick={onRegistrar}>
              {esUnico ? 'Registrar abono' : 'Registrar pago'}
            </BotonPrimario>
          )}
        </BarraAccion>
      )}
    </div>
  )
}
