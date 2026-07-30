'use client'

// components/pantallas/config/movil.jsx — turno 10. Configuración en el teléfono.
//
// ── POR QUÉ ESTE ARCHIVO EXISTE APARTE DEL DE ESCRITORIO ────────────────────
//
// `components/pantallas/Configuracion.jsx` es T09-01: DOS COLUMNAS, el menú a la
// izquierda y todas las secciones montadas a la derecha. Ahí el menú lleva pero no
// cambia el contenido, así que los ajustes se guardan al cambiar: la sección sigue
// a la vista y se ve el resultado.
//
// T10 es otra cosa. En el teléfono se ENTRA a una sección y se SALE de ella, así
// que las láminas dibujan «Guardar»: sin él, el dueño cambia la tasa, vuelve atrás
// y no sabe si quedó. Es la misma decisión resuelta al contrario porque el contexto
// es al contrario.
//
// ⚠️ ESTO ES UNA DIFERENCIA DE COMPORTAMIENTO entre móvil y escritorio para el
// mismo ajuste, y la señalo en vez de unificarla por mi cuenta: las dos láminas la
// piden así y cada una tiene razón en su sitio, pero decidir que la app se comporte
// distinto según el ancho es una decisión de producto.
//
// ── LO QUE MI PRIMER INTENTO HIZO MAL ───────────────────────────────────────
//
// Construí configuración leyendo el handoff como texto plano y salió con PESTAÑAS
// ARRIBA cuando son dos columnas; me inventé una sección («Rutas») que no existe;
// me faltó una que sí («Portal del cliente»); y escribí cifras de venta falsas —«30
// días» cuando son 14, «hasta 20 clientes» cuando el plan Inicial son 100—.
//
// Por eso aquí NO SE ESCRIBE NI UN NÚMERO DE PLAN a mano: la fila del índice y la
// sección de plan reciben los topes ya resueltos desde `lib/adaptadores/planes`,
// que los saca de `PLANES_CONFIG`. La lámina de T10 dice «31 de 150 clientes» y el
// plan Inicial son 100: la lámina también trae datos viejos, así que la fuente es
// el código.

const ORO = '#E7A400'

/* ── Piezas compartidas ─────────────────────────────────────────────────── */

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--cf-ink-3)', flex: 'none',
    }}>{children}</span>
  )
}

/* Párrafo de contexto de una sección. Va arriba y una sola vez: repetir la
   explicación en cada campo es lo que convierte un ajuste en un formulario. */
function Intro({ children }) {
  return (
    <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--cf-ink-3)', margin: 0, flex: 'none' }}>
      {children}
    </p>
  )
}

/* Tarjeta con filas separadas por filete. Es la forma de todas las secciones. */
function Bloque({ children, style }) {
  return (
    <div style={{
      flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)', overflow: 'hidden', ...style,
    }}>{children}</div>
  )
}

/* Una fila del índice: nombre a la izquierda, SU VALOR ACTUAL a la derecha.
   «¿En qué tasa quedé?» se responde sin entrar, que es todo el diseño de T10-01.

   Y dos filas llevan ALERTA en vez de valor —«5 sin ruta», «Sin PIN»—: son
   problemas reales de la cuenta que hoy no se ven en ningún lado. La alerta va en
   ámbar y no en rojo: no está roto, está sin terminar. */
export function FilaIndice({ nombre, valor, alerta, onIr, ultima = false }) {
  return (
    <button type="button" onClick={onIr} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
      padding: '15px 18px', font: 'inherit', textAlign: 'left',
      background: 'none', border: 0, cursor: 'pointer',
      borderTop: ultima ? 'none' : undefined,
    }}>
      <span style={{
        flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{nombre}</span>

      {alerta ? (
        <span className="cf-num" style={{
          display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
          borderRadius: 11, flex: 'none',
          background: 'var(--cf-gold-bg)', border: '1px solid var(--cf-gold-border)',
          fontSize: 11.5, fontWeight: 700, color: 'var(--cf-gold-text-2)',
        }}>{alerta}</span>
      ) : valor ? (
        <span className="cf-num" style={{
          fontSize: 13, color: 'var(--cf-ink-3)', flex: 'none',
          maxWidth: '52%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{valor}</span>
      ) : null}

      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)"
           strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  )
}

/* Fila de ajuste: etiqueta arriba, valor debajo, y a la derecha el control. */
function FilaAjuste({ etiqueta, valor, nota, derecha, primera = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
      borderTop: primera ? 'none' : '1px solid var(--cf-hairline)',
    }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Rotulo>{etiqueta}</Rotulo>
        {valor != null && (
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)' }}>{valor}</span>
        )}
        {nota && (
          <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--cf-ink-3)' }}>{nota}</span>
        )}
      </span>
      {derecha}
    </div>
  )
}

/* Interruptor. El mismo de las otras pantallas: 44×26 con el pulgar de 20. */
export function Interruptor({ activo, onCambiar, etiqueta }) {
  return (
    <button
      type="button"
      onClick={() => onCambiar?.(!activo)}
      aria-pressed={activo}
      aria-label={etiqueta}
      style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', flex: 'none' }}
    >
      <span aria-hidden style={{
        display: 'block', width: 44, height: 26, borderRadius: 999, position: 'relative',
        background: activo ? ORO : 'var(--cf-fill-2)',
        border: activo ? 'none' : '1px solid var(--cf-border-strong)',
        transition: 'background .15s',
      }}>
        <span style={{
          position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 999,
          background: '#FFF', boxShadow: '0 1px 3px rgba(20,20,28,.24)',
          left: activo ? 21 : 3, transition: 'left .15s',
        }} />
      </span>
    </button>
  )
}

/* Fila con interruptor: es la forma de «avisos» y de «qué puede ver el cliente». */
export function FilaInterruptor({ titulo, nota, activo, onCambiar, primera = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
      borderTop: primera ? 'none' : '1px solid var(--cf-hairline)',
    }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--cf-ink)' }}>{titulo}</span>
        {nota && <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{nota}</span>}
      </span>
      <Interruptor activo={activo} onCambiar={onCambiar} etiqueta={titulo} />
    </div>
  )
}

/* Opciones que se reparten el ancho, el activo en negro. Para frecuencia, tema y
   el formato de los montos. */
export function Opciones({ opciones = [], activo, onElegir, alto = 44, columna = false }) {
  return (
    <div style={{
      display: 'flex', gap: 7, flex: 'none',
      flexDirection: columna ? 'column' : 'row', flexWrap: columna ? 'nowrap' : 'wrap',
    }}>
      {opciones.map((o) => {
        const on = o.id === activo
        return (
          <button key={o.id} type="button" onClick={() => onElegir?.(o)} aria-pressed={on} style={{
            flex: columna ? 'none' : 1, minWidth: columna ? 0 : 68,
            height: columna ? 'auto' : alto, borderRadius: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: columna ? 'space-between' : 'center',
            gap: 10, padding: columna ? '13px 15px' : '0 10px',
            font: 'inherit', fontSize: 13.5, fontWeight: on ? 700 : 600, textAlign: 'left',
            ...(on
              ? { background: 'var(--cf-ink)', color: 'var(--cf-surface)', border: 'none' }
              : { background: 'var(--cf-card)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }),
          }}>
            <span className={o.cifra ? 'cf-fig' : undefined} style={{ flex: columna ? 1 : 'none', minWidth: 0 }}>
              {o.etiqueta}
            </span>
            {/* La nota de la derecha es lo que hace elegible el formato de montos:
                «$1.200.000 · punto de miles» se decide viendo la cifra escrita, no
                leyendo el nombre técnico en un desplegable. */}
            {o.nota && (
              <span style={{
                fontSize: 11.5, flex: 'none',
                color: on ? 'rgba(244,244,241,.65)' : 'var(--cf-ink-3)',
              }}>{o.nota}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* Aviso al pie de una sección. Es donde estas pantallas conectan el ajuste con la
   realidad de la cartera: «12 de tus 31 clientes no tienen número», «se borra todo:
   31 clientes y 68 préstamos». Un ajuste sin esa consecuencia es fe ciega. */
export function AvisoPie({ children, tono = 'neutro' }) {
  const estilos = tono === 'mal'
    ? { fondo: 'var(--cf-red-bg)', borde: 'var(--cf-red-border)', tinta: 'var(--cf-red-darker)' }
    : tono === 'aviso'
      ? { fondo: 'var(--cf-gold-bg)', borde: 'var(--cf-gold-border)', tinta: 'var(--cf-gold-text-2)' }
      : { fondo: 'var(--cf-card)', borde: 'var(--cf-border)', tinta: 'var(--cf-ink-2)' }
  return (
    <div style={{
      flex: 'none', padding: '14px 16px', borderRadius: 'var(--cf-r-card-sm)',
      background: estilos.fondo, border: `1px solid ${estilos.borde}`,
    }}>
      <span style={{ fontSize: 12, lineHeight: 1.5, color: estilos.tinta }}>{children}</span>
    </div>
  )
}

/* Bloque oscuro de vista previa. Lo usan T10-03 —«así quedaría un préstamo»— y
   T10-05 —la burbuja de WhatsApp—: un ajuste es abstracto hasta que se ve el
   resultado, y es el mismo patrón «antes → después» de las hojas de gestión
   aplicado a una configuración. */
export function VistaPrevia({ titulo, children }) {
  return (
    <div style={{
      flex: 'none', background: '#15161A', borderRadius: 'var(--cf-r-card)',
      padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 13,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
        textTransform: 'uppercase', color: '#A3A8B2',
      }}>{titulo}</span>
      {children}
    </div>
  )
}

/* Fila de cifras dentro de la vista previa. */
function CifrasPrevia({ celdas = [] }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {celdas.map((c, i) => (
        <span key={c.etiqueta} style={{ display: 'contents' }}>
          {i > 0 && <span aria-hidden style={{ width: 1, background: 'rgba(255,255,255,.09)', flex: 'none' }} />}
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 11, color: '#8A8E98' }}>{c.etiqueta}</span>
            <span className="cf-fig" style={{ fontSize: 16, fontWeight: 600, color: '#F3F3F6' }}>{c.valor}</span>
          </span>
        </span>
      ))}
    </div>
  )
}

/* El pie de guardar. Solo en las secciones que cambian algo que hay que confirmar:
   el tema y los interruptores se guardan al tocarlos, porque el resultado se ve
   inmediatamente y pedir «Guardar» para encender un aviso es un paso de más. */
export function PieGuardar({ onGuardar, texto = 'Guardar', guardando = false, deshabilitado = false, error }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, width: '100%' }}>
      {error && (
        <span role="alert" style={{ fontSize: 13, color: 'var(--cf-red-dark)', textAlign: 'center' }}>
          {error}
        </span>
      )}
      <button type="button" onClick={onGuardar} disabled={guardando || deshabilitado} style={{
        width: '100%', height: 52, border: 'none', borderRadius: 14,
        background: ORO, color: 'var(--cf-gold-ink)', font: 'inherit',
        fontSize: 16, fontWeight: 700,
        cursor: (guardando || deshabilitado) ? 'not-allowed' : 'pointer',
        opacity: (guardando || deshabilitado) ? 0.55 : 1,
      }}>{guardando ? 'Guardando…' : texto}</button>
    </div>
  )
}

/* ══ T10-01 · Índice ═══════════════════════════════════════════════════════
   CADA FILA LLEVA SU VALOR ACTUAL A LA DERECHA. Es todo el diseño: «¿en qué tasa
   quedé?» se responde sin entrar, y de ocho secciones el dueño solo abre la que
   de verdad tiene que cambiar.

   Las OCHO son estas, y las nombro porque en el intento anterior me inventé una
   («Rutas») y me faltó otra («Portal del cliente»):

     tu negocio · cómo prestas · plan y pagos · equipo · portal del cliente ·
     avisos por WhatsApp · seguridad · tus datos

   El TEMA se cambia desde aquí, sin abrir sección: es lo único de esta pantalla
   que no es un ajuste del negocio sino del aparato, y meterlo dentro de una
   sección obligaría a buscarlo. */
export function IndiceConfiguracion({
  negocio, negocioNota, iniciales = '$',
  filas = [],
  tema, onTema, temas = [],
}) {
  return (
    <>
      {/* DE QUÉ NEGOCIO son estos ajustes. «Configuración» a secas podría ser de
          cualquier cuenta, y quien administra dos las confunde. */}
      <div style={{
        flex: 'none', display: 'flex', alignItems: 'center', gap: 13,
        background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card)', padding: '16px 18px',
      }}>
        <span aria-hidden style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 42, height: 42, borderRadius: 12, flex: 'none',
          background: 'var(--cf-gold-tint)', color: 'var(--cf-gold-dark)',
          fontSize: 17, fontWeight: 700,
        }}>{iniciales}</span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{
            fontSize: 16, fontWeight: 700, color: 'var(--cf-ink)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{negocio}</span>
          {/* El tope de clientes viene RESUELTO de fuera, de `PLANES_CONFIG`. En el
              intento anterior escribí «hasta 20 clientes» a mano cuando el plan
              Inicial son 100: vendía el producto cinco veces peor de lo que es. */}
          {negocioNota && (
            <span className="cf-num" style={{
              fontSize: 12.5, color: 'var(--cf-ink-3)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{negocioNota}</span>
          )}
        </span>
      </div>

      <Bloque>
        {filas.map((f, i) => (
          <div key={f.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)' }}>
            <FilaIndice {...f} />
          </div>
        ))}
      </Bloque>

      {temas.length > 0 && (
        <>
          <Rotulo>Tema</Rotulo>
          <Opciones opciones={temas} activo={tema} onElegir={(t) => onTema?.(t.id)} alto={42} />
        </>
      )}
    </>
  )
}

/* ══ T10-02 · Tu negocio ═══════════════════════════════════════════════════
   EL FORMATO DE LOS MONTOS SE ELIGE VIENDO LAS TRES OPCIONES ESCRITAS, no en un
   desplegable con nombres técnicos: «$1.200.000 · punto de miles» se decide
   mirando la cifra, y «separador decimal» no se decide de ninguna manera.

   Y la advertencia que importa: cambiar de país NO CONVIERTE lo ya registrado.
   Solo cambia el símbolo y el formato de ahí en adelante. Sin esa frase, un dueño
   que se muda de país cree que la app le va a recalcular la cartera. */
export function TuNegocioMovil({
  nombre, onNombre, nombreNota,
  whatsapp, whatsappEstado,
  pais, moneda,
  formatos = [], formato, onFormato,
  avisoPais,
}) {
  return (
    <>
      <Bloque>
        <FilaAjuste primera etiqueta="Nombre del negocio" valor={nombre} nota={nombreNota} />
        <FilaAjuste
          etiqueta="Tu WhatsApp"
          valor={whatsapp}
          derecha={whatsappEstado && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
              borderRadius: 11, flex: 'none',
              background: 'var(--cf-green-pill-bg)', border: '1px solid var(--cf-green-pill-border)',
              fontSize: 11, fontWeight: 700, color: 'var(--cf-green-dark)',
            }}>{whatsappEstado}</span>
          )}
        />
        <FilaAjuste etiqueta="País" valor={pais} />
        <FilaAjuste etiqueta="Moneda" valor={moneda} />
      </Bloque>

      {formatos.length > 0 && (
        <>
          <Rotulo>Cómo se ven los montos</Rotulo>
          <Opciones columna opciones={formatos} activo={formato} onElegir={onFormato} />
        </>
      )}

      {avisoPais && <AvisoPie>{avisoPais}</AvisoPie>}
    </>
  )
}

/* ══ T10-03 · Cómo prestas ═════════════════════════════════════════════════
   UN AJUSTE DE TASA ES ABSTRACTO HASTA QUE VES LA CUOTA. El bloque negro traduce
   la configuración a un préstamo de ejemplo EN VIVO: se cambia el 20% y ahí mismo
   se ve que la cuota diaria pasa de $20.000 a otra cosa.

   Es el mismo patrón «antes → después» de las hojas de gestión, aplicado a un
   ajuste — y por el mismo motivo: nadie decide sobre un porcentaje, se decide
   sobre lo que el cliente va a pagar.

   Y la primera línea aclara lo que no se toca: «cambiarlos no toca los préstamos
   que ya existen». Sin eso, cambiar la tasa por defecto da miedo. */
export function ComoPrestasMovil({
  intro,
  frecuencias = [], frecuencia, onFrecuencia,
  tasa, onTasa, plazo, onPlazo,
  modo, diasSinCobro, recargo,
  ejemploTitulo, ejemplo = [],
}) {
  return (
    <>
      {intro && <Intro>{intro}</Intro>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 'none' }}>
        <Rotulo>Frecuencia</Rotulo>
        <Opciones opciones={frecuencias} activo={frecuencia} onElegir={onFrecuencia} />
      </div>

      <Bloque>
        <FilaAjuste
          primera
          etiqueta="Tasa"
          derecha={
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, flex: 'none' }}>
              <input
                value={tasa ?? ''}
                onChange={(e) => onTasa?.(e.target.value)}
                type="text" inputMode="decimal" aria-label="Tasa"
                className="cf-fig"
                style={{
                  width: 62, textAlign: 'right', border: 0, background: 'none', padding: 0,
                  outline: 'none', font: 'inherit',
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 20, fontWeight: 600, color: 'var(--cf-ink)',
                }}
              />
              <span style={{ fontSize: 14, color: 'var(--cf-ink-3)' }}>%</span>
            </span>
          }
        />
        <FilaAjuste
          etiqueta="Plazo"
          derecha={
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, flex: 'none' }}>
              <input
                value={plazo ?? ''}
                onChange={(e) => onPlazo?.(e.target.value)}
                type="text" inputMode="numeric" aria-label="Plazo"
                className="cf-fig"
                style={{
                  width: 62, textAlign: 'right', border: 0, background: 'none', padding: 0,
                  outline: 'none', font: 'inherit',
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 20, fontWeight: 600, color: 'var(--cf-ink)',
                }}
              />
              <span style={{ fontSize: 14, color: 'var(--cf-ink-3)' }}>cuotas</span>
            </span>
          }
        />
        {modo && <FilaAjuste etiqueta="Modo de interés" valor={modo.valor} derecha={modo.derecha} />}
        {diasSinCobro && <FilaAjuste etiqueta="Días sin cobro" valor={diasSinCobro.valor} derecha={diasSinCobro.derecha} />}
        {recargo && <FilaAjuste etiqueta="Recargo por mora" valor={recargo.valor} derecha={recargo.derecha} />}
      </Bloque>

      {/* LA TRADUCCIÓN. Sin esto, la pantalla pide decidir sobre un porcentaje. */}
      {ejemplo.length > 0 && (
        <VistaPrevia titulo={ejemploTitulo}>
          <CifrasPrevia celdas={ejemplo} />
        </VistaPrevia>
      )}
    </>
  )
}

/* ══ T10-04 · Plan y pagos ═════════════════════════════════════════════════
   EL PLAN SE MIDE EN LO ÚNICO QUE LE IMPORTA AL DUEÑO: cuántos clientes le caben
   todavía. Nada de comparativas de características.

   Y la subida aparece como RESPUESTA A UNA NECESIDAD —«¿necesitas más
   clientes?»— con el prorrateo aclarado, que es la duda que frena el cambio: el
   dueño no sube de plan por no saber si le van a cobrar el mes entero.

   Ni una cifra de este bloque se escribe aquí: el tope, el precio y el siguiente
   plan llegan resueltos desde `lib/adaptadores/planes`, que los saca de
   `PLANES_CONFIG` y de los precios por país. La lámina dice «31 de 150» y el plan
   Inicial son 100 — también trae datos viejos. */
export function PlanYPagosMovil({
  plan, precio, renueva, estado,
  clientes, limite, caben,
  metodoPago, onCambiarMetodo,
  pagos = [], onDescargarPagos,
  subidaTitulo, subidaTexto, onVerPlanes,
}) {
  return (
    <>
      <Bloque>
        <div style={{ padding: '17px 19px', display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Rotulo>Tu plan</Rotulo>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--cf-ink)' }}>{plan}</span>
              <span className="cf-num" style={{ fontSize: 12.5, color: 'var(--cf-ink-3)' }}>
                {[precio, renueva].filter(Boolean).join(' · ')}
              </span>
            </span>
            {estado && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
                borderRadius: 11, flex: 'none',
                background: 'var(--cf-green-pill-bg)', border: '1px solid var(--cf-green-pill-border)',
                fontSize: 11, fontWeight: 700, color: 'var(--cf-green-dark)',
              }}>{estado}</span>
            )}
          </div>

          {/* CUÁNTOS LE CABEN TODAVÍA. Es la única medida del plan que el dueño usa. */}
          {limite != null && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 7,
              paddingTop: 11, borderTop: '1px solid var(--cf-hairline)',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <Rotulo>Clientes</Rotulo>
                <span className="cf-fig" style={{ fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)', flex: 'none' }}>
                  {clientes} de {limite}
                </span>
              </div>
              <span aria-hidden style={{
                height: 8, borderRadius: 999, overflow: 'hidden', flex: 'none',
                background: 'var(--cf-fill-2)', display: 'flex',
              }}>
                <span style={{
                  width: `${Math.min(100, Math.round((Number(clientes) / Math.max(1, Number(limite))) * 100))}%`,
                  background: ORO, flex: 'none',
                }} />
              </span>
              {caben && (
                <span style={{ fontSize: 12.5, color: 'var(--cf-ink-2)' }}>{caben}</span>
              )}
            </div>
          )}
        </div>
      </Bloque>

      {metodoPago && (
        <Bloque>
          <FilaAjuste
            primera
            etiqueta="Método de pago"
            valor={metodoPago}
            derecha={onCambiarMetodo && (
              <button type="button" onClick={onCambiarMetodo} style={{
                border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
                fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)', flex: 'none',
              }}>Cambiar</button>
            )}
          />
        </Bloque>
      )}

      {pagos.length > 0 && (
        <Bloque>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 10, padding: '15px 18px 11px',
          }}>
            <Rotulo>Pagos</Rotulo>
            {onDescargarPagos && (
              <button type="button" onClick={onDescargarPagos} style={{
                border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
                fontSize: 12.5, fontWeight: 700, color: 'var(--cf-gold-dark)', flex: 'none',
              }}>Descargar</button>
            )}
          </div>
          {pagos.map((p) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 18px', borderTop: '1px solid var(--cf-hairline)',
            }}>
              <span className="cf-num" style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--cf-ink-2)' }}>
                {p.fecha}
              </span>
              <span className="cf-fig" style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)', flex: 'none' }}>
                {p.monto}
              </span>
            </div>
          ))}
        </Bloque>
      )}

      {/* LA SUBIDA, COMO RESPUESTA A UNA NECESIDAD. Y con el prorrateo dicho:
          es la duda que frena el cambio. */}
      {subidaTitulo && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
          border: `1.5px solid ${ORO}`, boxShadow: '0 0 0 3px rgba(231,164,0,.13)',
          padding: '17px 19px', display: 'flex', flexDirection: 'column', gap: 11,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>{subidaTitulo}</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>{subidaTexto}</span>
          {onVerPlanes && (
            <button type="button" onClick={onVerPlanes} style={{
              height: 46, borderRadius: 13, border: 'none', cursor: 'pointer',
              background: ORO, color: 'var(--cf-gold-ink)', font: 'inherit',
              fontSize: 14.5, fontWeight: 700,
            }}>Ver planes</button>
          )}
        </div>
      )}
    </>
  )
}

/* ══ T10-05 · Avisos por WhatsApp ══════════════════════════════════════════
   UN AJUSTE DE MENSAJERÍA SIN VER EL MENSAJE ES FE CIEGA, así que la burbuja
   muestra exactamente lo que le va a llegar al cliente — con su nombre, su cifra y
   la firma del negocio.

   Y el aviso de abajo conecta con la realidad de la cartera: «12 de tus 31
   clientes no tienen número», o sea que un tercio de los avisos no saldría. Ese
   dato no está en ninguna otra pantalla, y sin él el dueño enciende los cuatro
   avisos creyendo que llegan a todos. */
export function AvisosWhatsAppMovil({
  intro, avisos = [], onAviso,
  previaTitulo, mensaje, hora, onEditar,
  avisoSinTelefono,
}) {
  return (
    <>
      {intro && <Intro>{intro}</Intro>}

      <Bloque>
        {avisos.map((a, i) => (
          <FilaInterruptor
            key={a.id}
            primera={i === 0}
            titulo={a.titulo}
            nota={a.nota}
            activo={a.activo}
            onCambiar={(v) => onAviso?.(a, v)}
          />
        ))}
      </Bloque>

      {/* LA BURBUJA. Es lo que convierte cuatro interruptores en una decisión. */}
      {mensaje && (
        <VistaPrevia titulo={previaTitulo}>
          <div style={{
            background: 'rgba(255,255,255,.07)', borderRadius: '14px 14px 14px 4px',
            padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <span style={{ fontSize: 13.5, lineHeight: 1.5, color: '#F3F3F6' }}>{mensaje}</span>
            {hora && (
              <span className="cf-num" style={{ fontSize: 11, color: '#8A8E98', alignSelf: 'flex-end' }}>
                {hora}
              </span>
            )}
          </div>
          {onEditar && (
            <button type="button" onClick={onEditar} style={{
              alignSelf: 'flex-start', border: 0, background: 'none', padding: 0,
              cursor: 'pointer', font: 'inherit',
              fontSize: 13, fontWeight: 700, color: '#F5B824',
            }}>Editar el mensaje</button>
          )}
        </VistaPrevia>
      )}

      {avisoSinTelefono && <AvisoPie tono="aviso">{avisoSinTelefono}</AvisoPie>}
    </>
  )
}

/* ══ T10-06 · Portal del cliente ═══════════════════════════════════════════
   Hoy el PIN se define CLIENTE POR CLIENTE desde su ficha, y por eso solo 7 de 31
   lo tienen — fue justo lo que impidió capturar el portal para el rediseño. Aquí
   se administra desde un solo sitio, con «activar para todos».

   Y LOS DÍAS DE ATRASO VIENEN APAGADOS. Enseñarle la mora al deudor es decisión
   del prestamista, no del programa: hay quien usa el portal para presionar y hay
   quien no quiere que el cliente vea cuánto lleva debiendo. */
export function PortalClienteMovil({
  activo, onActivo, activoNota,
  puedeVer = [], onPuedeVer,
  conAcceso = [], conAccesoTotal, onReenviar,
  onActivarTodos, avisoPin,
}) {
  return (
    <>
      <Bloque>
        <FilaInterruptor
          primera
          titulo="Portal activo"
          nota={activoNota}
          activo={activo}
          onCambiar={onActivo}
        />
      </Bloque>

      {puedeVer.length > 0 && (
        <>
          <Rotulo>Qué puede ver el cliente</Rotulo>
          <Bloque>
            {puedeVer.map((p, i) => (
              <FilaInterruptor
                key={p.id}
                primera={i === 0}
                titulo={p.titulo}
                activo={p.activo}
                onCambiar={(v) => onPuedeVer?.(p, v)}
              />
            ))}
          </Bloque>
        </>
      )}

      {conAcceso.length > 0 && (
        <>
          <Rotulo>Clientes con acceso</Rotulo>
          <Bloque>
            <div style={{ padding: '13px 18px 10px' }}>
              <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>
                {conAccesoTotal}
              </span>
            </div>
            {conAcceso.map((c) => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 18px', borderTop: '1px solid var(--cf-hairline)',
              }}>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{c.nombre}</span>
                <span className="cf-num" style={{ fontSize: 12.5, color: 'var(--cf-ink-3)', flex: 'none' }}>
                  PIN {c.pin}
                </span>
                {onReenviar && (
                  <button type="button" onClick={() => onReenviar(c)} style={{
                    border: 0, background: 'none', padding: 0, cursor: 'pointer', font: 'inherit',
                    fontSize: 12.5, fontWeight: 700, color: 'var(--cf-gold-dark)', flex: 'none',
                  }}>Reenviar</button>
                )}
              </div>
            ))}
          </Bloque>
        </>
      )}

      {onActivarTodos && (
        <button type="button" onClick={onActivarTodos} style={{
          flex: 'none', height: 48, borderRadius: 13, cursor: 'pointer',
          background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
          color: 'var(--cf-ink)', font: 'inherit', fontSize: 14, fontWeight: 700,
        }}>Activar para todos los clientes</button>
      )}

      {avisoPin && <AvisoPie>{avisoPin}</AvisoPie>}
    </>
  )
}

/* ══ T10-07 · Seguridad y datos ════════════════════════════════════════════
   LAS DOS SECCIONES CABEN JUNTAS. El PIN va como tarjeta destacada porque el
   riesgo es concreto y no hipotético: un cobrador con el teléfono ajeno abierto ve
   la cartera entera.

   Y abajo, la acción destructiva CON LA CIFRA EXACTA de lo que se pierde —«31
   clientes, 68 préstamos y su historial»— en vez de un «esta acción es
   irreversible», que no dice nada porque todo el mundo lo ha leído mil veces. */
export function SeguridadYDatosMovil({
  pinTitulo, pinTexto, onCrearPin, tienePin,
  ajustes = [], datos = [],
  cerrarTexto, onCerrarCuenta,
}) {
  return (
    <>
      {/* El PIN destacado SOLO si no lo tiene: con PIN puesto, esta tarjeta sería
          una alarma sobre un problema resuelto, y una alarma que suena siempre deja
          de sonar. */}
      {!tienePin && pinTitulo && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
          border: `1.5px solid ${ORO}`, boxShadow: '0 0 0 3px rgba(231,164,0,.13)',
          padding: '17px 19px', display: 'flex', flexDirection: 'column', gap: 11,
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)' }}>{pinTitulo}</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>{pinTexto}</span>
          <button type="button" onClick={onCrearPin} style={{
            height: 46, borderRadius: 13, border: 'none', cursor: 'pointer',
            background: ORO, color: 'var(--cf-gold-ink)', font: 'inherit',
            fontSize: 14.5, fontWeight: 700,
          }}>Crear PIN</button>
        </div>
      )}

      {ajustes.length > 0 && (
        <Bloque>
          {ajustes.map((a, i) => (
            <div key={a.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)' }}>
              <FilaIndice nombre={a.nombre} valor={a.valor} onIr={a.onIr} />
            </div>
          ))}
        </Bloque>
      )}

      {datos.length > 0 && (
        <>
          <Rotulo>Tus datos</Rotulo>
          <Bloque>
            {datos.map((d, i) => (
              <div key={d.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
              }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--cf-ink)' }}>{d.nombre}</span>
                  {d.nota && <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{d.nota}</span>}
                </span>
                {d.estado && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 9px',
                    borderRadius: 11, flex: 'none',
                    background: 'var(--cf-green-pill-bg)', border: '1px solid var(--cf-green-pill-border)',
                    fontSize: 11, fontWeight: 700, color: 'var(--cf-green-dark)',
                  }}>{d.estado}</span>
                )}
                {d.onIr && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)"
                       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                )}
              </div>
            ))}
          </Bloque>
        </>
      )}

      {/* LA CIFRA EXACTA DE LO QUE SE PIERDE. «Esta acción es irreversible» no
          asusta a nadie; «se borra todo: 31 clientes, 68 préstamos» sí. */}
      {cerrarTexto && (
        <>
          <Rotulo>Cerrar el negocio</Rotulo>
          <AvisoPie tono="mal">{cerrarTexto}</AvisoPie>
          <button type="button" onClick={onCerrarCuenta} style={{
            flex: 'none', height: 48, borderRadius: 13, cursor: 'pointer',
            background: 'var(--cf-card)',
            border: '1px solid color-mix(in srgb, var(--cf-red) 35%, transparent)',
            color: 'var(--cf-red-dark)', font: 'inherit', fontSize: 14, fontWeight: 700,
          }}>Cerrar mi cuenta</button>
        </>
      )}
    </>
  )
}
