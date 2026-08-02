'use client'

// components/pantallas/Socios.jsx — turno 45, adenda 08.
//
// ── LA DECISIÓN DE PRODUCTO ──
//
// El sistema tenía DOS MODELOS DE REPARTO conviviendo: por préstamo asignado
// (`socioId`) y por porcentaje de participación. La app mostraba los dos a la
// vez y admitía en letra chica que el % era "una referencia".
//
// Eso es una bomba: un socio que ve 66,7% en pantalla CREE QUE LE TOCA ESO.
//
// Se elige uno: REPARTO POR PORCENTAJE DEL CAPITAL APORTADO.
// Si el reparto va por préstamo, el socio al que le tocaron los clientes malos
// come una pérdida que no eligió — y eso es lo que rompe sociedades. El
// porcentaje reparte el riesgo en proporción a la plata, que es lo que una
// sociedad ES.
//
// EL `socioId` DEL PRÉSTAMO NO SE BORRA: CAMBIA DE TRABAJO.
//   antes → decidía quién gana el interés de ese préstamo
//   ahora → dice dónde está la plata de cada socio (trazabilidad)
// Los préstamos ya asignados siguen sirviendo. No hay migración destructiva.
// ⚠️ Y se dice EN PANTALLA, o el malentendido vuelve.
//
// ── LAS CUATRO CIFRAS ──
//   puso · ha ganado · le has dado · LE DEBES
//   leDebes = haGanado − leHasDado, en dorado. La relación con un socio es una
//   DEUDA, no un balance.
//
// ── EL SOCIO NO ES UN USUARIO ──
// No entra, no cobra, no tiene sesión. Consecuencia: el dueño tiene que poder
// MANDARLE SU CUENTA. Sin eso, el socio llama al dueño cada vez que quiere
// saber cómo va.

import { Tarjeta, BloqueOscuro, BarraAccion, BotonPrimario, BotonSecundario, BotonTexto, Aviso, EstadoVacio } from '@/components/cf/primitivos'

const ORO   = 'var(--cf-gold-dark)'
const COLORES = ['#F5B824', '#2FBE6A', '#5AA9F0', '#E06C9F', '#8A8E98']

function Avatar({ iniciales, tam = 36 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: tam, minWidth: tam, height: tam, aspectRatio: '1', borderRadius: 999, flex: 'none',
      background: 'var(--cf-fill)', fontSize: tam < 36 ? 11 : 12.5, fontWeight: 700,
      color: 'var(--cf-ink-2)',
    }}>{iniciales}</span>
  )
}

/* La barra partida reemplaza a la tarjeta plegable "Participación de socios":
   el modelo SE VE, no hace falta un acordeón que lo explique. */
function BarraSociedad({ socios = [] }) {
  const total = socios.reduce((s, x) => s + (x.pusoNum ?? 0), 0)
  return (
    <>
      <span style={{ display: 'flex', height: 11, borderRadius: 999, overflow: 'hidden', flex: 'none', gap: 2 }}>
        {socios.map((s, i) => (
          <span key={s.nombre} style={{
            width: `${total > 0 ? (s.pusoNum / total) * 100 : 0}%`,
            background: COLORES[i % COLORES.length], flex: 'none',
          }} />
        ))}
      </span>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {socios.map((s, i) => (
          <span key={s.nombre} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: COLORES[i % COLORES.length], flex: 'none' }} />
            <span style={{ fontSize: 12, color: '#A3A8B2' }}>{s.nombre.split(' ')[0]}</span>
            <span className="cf-num" style={{ fontSize: 12, fontWeight: 700, color: '#F3F3F6' }}>{s.porcentaje}</span>
          </span>
        ))}
      </div>
    </>
  )
}

function TarjetaSocio({ nombre, iniciales, puso, porcentaje, leHasDado, leDebes, onAbrir }) {
  return (
    <div onClick={onAbrir} role="button" tabIndex={0} style={{
      display: 'flex', flexDirection: 'column', flex: 'none', cursor: 'pointer',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
        <Avatar iniciales={iniciales} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 15, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--cf-ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{nombre}</span>
          <span className="cf-num" style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 2 }}>
            puso {puso} · {porcentaje}
          </span>
        </span>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
          <path d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* DOS cifras, no seis. Las capturas actuales tienen seis compitiendo y
          ninguna contesta directo la pregunta del socio. */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--cf-hairline)', flex: 'none' }}>
        <span style={{ flex: 1, minWidth: 0, padding: '11px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
            Le has dado
          </span>
          <span className="cf-fig" style={{ fontSize: 16, color: 'var(--cf-ink)' }}>{leHasDado}</span>
        </span>
        <span style={{ width: 1, background: 'var(--cf-divider)', flex: 'none', margin: '11px 0' }} />
        <span style={{ flex: 1, minWidth: 0, padding: '11px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
            Le debes
          </span>
          <span className="cf-fig" style={{ fontSize: 16, color: ORO }}>{leDebes}</span>
        </span>
      </div>
    </div>
  )
}

export function ListaSocios({ pusieron, socios = [], sinRepartir, desdeCuando, onRepartir, onAbrir, onNuevo }) {
  if (socios.length === 0) {
    return (
      <div style={{ padding: '8px var(--cf-pad-screen) 0' }}>
        {/* Declara el modelo desde el primer segundo. "Reciben intereses" no
            dice cómo, y es justo lo que hay que dejar claro antes de empezar. */}
        <EstadoVacio
          titulo="Todavía no tienes socios"
          explicacion="Un socio pone plata en tu negocio y se lleva una parte de la ganancia según lo que puso."
          accion={<BotonPrimario onClick={onNuevo}>Agregar un socio</BotonPrimario>}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: '8px var(--cf-pad-screen) 0' }}>
      <BloqueOscuro etiqueta="Tus socios pusieron" cifra={pusieron}>
        <BarraSociedad socios={socios} />
      </BloqueOscuro>

      {/* Esto convierte Socios de pantalla de consulta en PANTALLA CON TRABAJO,
          que es lo que un dueño con socios tiene todos los meses. */}
      {sinRepartir && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 12, flex: 'none',
          padding: '16px 18px 18px', background: 'var(--cf-card)',
          border: '1.5px solid var(--cf-gold)', borderRadius: 'var(--cf-r-card)',
          boxShadow: '0 0 0 3px rgba(231,164,0,.13)',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
              Ganancia sin repartir
            </span>
            <span className="cf-num" style={{ fontSize: 11.5, color: 'var(--cf-ink-3)', flex: 'none' }}>
              desde el {desdeCuando}
            </span>
          </div>
          <span className="cf-fig" style={{ fontSize: 30, letterSpacing: '-.03em', color: 'var(--cf-ink)' }}>
            {sinRepartir}
          </span>
          <BotonPrimario onClick={onRepartir}>Repartir la ganancia</BotonPrimario>
        </div>
      )}

      {socios.map((s) => (
        <TarjetaSocio key={s.nombre} {...s} onAbrir={() => onAbrir?.(s)} />
      ))}
    </div>
  )
}

/* ══ Repartir la ganancia — EL CORAZÓN DEL MÓDULO ═══════════════════════════
   En las capturas actuales es un botón SIN PANTALLA, y es el acto que da
   sentido a todo lo demás.

   El reparto es UN HECHO CON FECHA, no un cálculo en vivo: se declara por
   período, queda registrado, y a partir de ahí es una deuda concreta. */
export function RepartirGanancia({
  desde, hasta, aRepartir, deDondeSale,
  detalle = [], suman,
  lesDebesAntes, lesDebesDespues,
  onCambiarPeriodo, onRepartir,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <BloqueOscuro etiqueta="Vas a repartir" cifra={aRepartir} tono="ganancia">
        {/* NO ES DECORATIVA. Sin esta línea, la cifra es un número que el dueño
            no puede defender cuando un socio pregunte de dónde salió. */}
        <span style={{ fontSize: 12.5, color: '#A3A8B2', lineHeight: 1.45, marginTop: -4 }}>
          {deDondeSale}
        </span>
      </BloqueOscuro>

      <Tarjeta plana>
        {detalle.map((d, i) => (
          <div key={d.nombre} style={{
            display: 'flex', alignItems: 'center', gap: 11, flex: 'none',
            padding: '11px 15px', borderTop: i === 0 ? 0 : '1px solid var(--cf-hairline)',
          }}>
            <Avatar iniciales={d.iniciales} tam={32} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--cf-ink)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{d.nombre}</span>
              <span className="cf-num" style={{ display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)', marginTop: 2 }}>
                {d.porcentaje} · puso {d.puso}
              </span>
            </span>
            <span className="cf-fig" style={{ fontSize: 15, color: 'var(--cf-ink)', flex: 'none' }}>{d.monto}</span>
          </div>
        ))}

        {/* OBLIGATORIA. Un reparto que no cuadra al peso es una discusión
            familiar; el último socio absorbe el residuo del redondeo. */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 12, flex: 'none',
          padding: '12px 15px', borderTop: '1px solid var(--cf-border)',
          background: 'var(--cf-card-alt)',
        }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)' }}>Suman</span>
          <span className="cf-fig" style={{ fontSize: 15, color: 'var(--cf-ink)', flex: 'none' }}>{suman}</span>
        </div>
      </Tarjeta>

      <BloqueOscuro etiqueta="Antes → después" cifra={null}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: -6 }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 11, color: '#8A8E98' }}>Les debes</span>
            <span className="cf-fig" style={{ fontSize: 17, color: '#8A8E98', textDecoration: 'line-through' }}>
              {lesDebesAntes}
            </span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5B824" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
            <path d="M5 12h14M14 7l5 5-5 5" />
          </svg>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
            <span style={{ fontSize: 11, color: '#8A8E98' }}>ahora</span>
            <span className="cf-fig" style={{ fontSize: 21, color: '#F3F3F6' }}>{lesDebesDespues}</span>
          </span>
        </div>
      </BloqueOscuro>

      {/* EL AVISO QUE EVITA EL ERROR MÁS CARO. Sin esto, un dueño paga dos
          veces: reparte creyendo que ya pagó, y después vuelve a pagar. */}
      <Aviso tono="neutro">
        Repartir <strong>no saca plata de tu caja</strong>: queda anotado que se lo debes. Cuando
        le pagues, registras el retiro.
      </Aviso>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 'none' }}>
        <BotonPrimario onClick={onRepartir}>Repartir {aRepartir}</BotonPrimario>
        <BotonTexto onClick={onCambiarPeriodo} style={{ alignSelf: 'center' }}>
          Cambiar el período · {desde} al {hasta}
        </BotonTexto>
      </div>
    </div>
  )
}

/* ══ La cuenta del socio ═══════════════════════════════════════════════════ */

const PUNTO = { reparto: '#2FBE6A', pago: 'var(--cf-gold)', aporte: 'var(--cf-blue)' }

export function CuentaSocio({
  // La ETIQUETA de la cifra héroe es prop, y no por gusto: mientras no exista el
  // tipo de movimiento «reparto», «le debes» NO SE PUEDE CALCULAR. Al montarla
  // puse ahí el capital del socio con el rótulo «Le debes» y quedó una pantalla
  // afirmando una deuda de dos millones que nadie ha declarado. Una etiqueta
  // equivocada sobre plata es una mentira, no un detalle de copia.
  leDebesEtiqueta = 'Le debes',
  leDebes, puso, haGanado, leHasDado,
  prestamos, montoEnCalle, montoEnMora,
  movimientos = [],
  onMandarCuenta, onPagar, onVerPrestamos,
  // `onBorrarMovimiento` y `children` son para MONTARLA sin perder nada.
  //
  // La ruta real trae cosas que la lámina no dibuja pero que ya funcionaban:
  // borrar un aporte mal metido, la liquidación del año, las notas, editar y dar
  // de baja al socio. Sin estos dos puntos, montar la pantalla nueva significaría
  // quitarle funciones al dueño, que es peor que dejarla vieja.
  onBorrarMovimiento, children,
}) {
  // Scrollea el DOCUMENTO. Ver la nota de `SociosReparto.jsx`: con el scroll
  // propio, el hueco que el armazón reserva para la pastilla quedaba fuera de
  // la caja y la pastilla tapaba el último renglón.
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: '8px var(--cf-pad-screen) 16px' }}>

        {/* La relación con un socio es una DEUDA, no un balance. Por eso la
            cifra héroe es "le debes" y va en dorado. */}
        <BloqueOscuro etiqueta={leDebesEtiqueta} cifra={leDebes} tono="ganancia">
          <span style={{ height: 1, background: 'rgba(255,255,255,.09)' }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            {[
              { etiqueta: 'Puso', valor: puso },
              { etiqueta: 'Ha ganado', valor: haGanado, color: '#2FBE6A' },
              { etiqueta: 'Le has dado', valor: leHasDado },
            ].map((c, i) => (
              <span key={c.etiqueta} style={{ display: 'contents' }}>
                {i > 0 && <span style={{ width: 1, background: 'rgba(255,255,255,.09)', flex: 'none' }} />}
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8A8E98', whiteSpace: 'nowrap' }}>
                    {c.etiqueta}
                  </span>
                  <span className="cf-fig" style={{ fontSize: 14.5, color: c.color ?? '#F3F3F6' }}>{c.valor}</span>
                </span>
              </span>
            ))}
          </div>
        </BloqueOscuro>

        {/* El socioId en su NUEVO trabajo. Y con la frase que impide que el
            malentendido vuelva. */}
        <Tarjeta>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
            Dónde está su plata
          </span>
          <button type="button" onClick={onVerPrestamos} style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', flex: 'none',
            background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: 'var(--cf-ink)' }}>
                {prestamos} préstamos suyos
              </span>
              <span className="cf-num" style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 3 }}>
                {montoEnCalle} en la calle · {montoEnMora} en mora
              </span>
            </span>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span style={{ height: 1, background: 'var(--cf-hairline)' }} />
          <span style={{ fontSize: 12, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>
            Sirve para saber dónde está su aporte. <strong>La ganancia se reparte por su
            porcentaje, no por estos préstamos.</strong>
          </span>
        </Tarjeta>

        {/* Con la FÓRMULA VISIBLE: el socio va a intentar reconstruir su cuenta
            él mismo, y si no puede, la discusión es con el dueño. */}
        <Tarjeta plana>
          <span style={{ display: 'block', padding: '14px 16px 11px', fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
            Su cuenta
          </span>
          {movimientos.map((m, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 11, flex: 'none',
              minHeight: 58, padding: '10px 16px', borderTop: '1px solid var(--cf-hairline)',
            }}>
              <span aria-hidden style={{
                width: 9, height: 9, borderRadius: 999, flex: 'none',
                background: PUNTO[m.tipo] ?? 'var(--cf-ink-4)',
              }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--cf-ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{m.concepto}</span>
                <span className="cf-num" style={{
                  display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)', marginTop: 2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{m.detalle}</span>
              </span>
              <span className="cf-fig" style={{
                fontSize: 14.5, flex: 'none',
                color: m.tipo === 'reparto' ? 'var(--cf-green-dark)'
                     : m.tipo === 'pago'    ? 'var(--cf-ink-2)'
                     : 'var(--cf-ink)',
              }}>{m.monto}</span>
              {/* Borrar un movimiento mal metido. Sin icono de papelera roja: es
                  una corrección, no una acción peligrosa que anunciar. */}
              {onBorrarMovimiento && m.id && (
                <button type="button" onClick={() => onBorrarMovimiento(m)}
                  aria-label={`Borrar ${m.concepto}`} style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 30, flex: 'none', borderRadius: 9,
                    background: 'none', border: 0, padding: 0, cursor: 'pointer',
                  }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </Tarjeta>

        {children}

        {/* ── LOS DOS BOTONES, COMO LOS DIBUJA T45-03 ──────────────────────
            «Mandarle su cuenta» ES LA PRINCIPAL porque el socio no entra a la
            app: sin esto tiene que llamar al dueño cada vez que quiere saber
            cómo va.

            ⚠ IBAN DENTRO DE UNA `<BarraAccion>`, FUERA DE ESTE DIV. Eso es lo
            que el dueño fotografió: una caja cuadrada más ancha que todo lo de
            arriba, porque al vivir fuera no compartía el relleno del contenido.
            Dos sistemas de márgenes en la misma pantalla.

            La lámina no dibuja ninguna caja: son dos botones sueltos en el
            flujo, `gap: 9`, el primario `flex: 1` y el secundario `flex: none`
            con relleno propio. Metidos aquí heredan el relleno del contenido y
            el ancho cuadra solo, sin tocar un píxel a mano. */}
        <div style={{ display: 'flex', gap: 9, flex: 'none' }}>
          <BotonPrimario style={{ flex: 1 }} onClick={onMandarCuenta}>Mandarle su cuenta</BotonPrimario>
          <BotonSecundario style={{ flex: 'none', padding: '0 15px' }} onClick={onPagar}>Pagarle</BotonSecundario>
        </div>
      </div>
    </div>
  )
}
