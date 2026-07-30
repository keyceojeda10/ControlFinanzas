'use client'

/* ══ T33-02 · Bajar información ═════════════════════════════════════════════
   POR QUÉ ES UNA PANTALLA Y NO EL FONDO DE REPORTES.

   Las descargas estaban al final de Reportes, después de 3.700 píxeles de
   scroll, y los filtros de «quién me debe» iban sueltos y sin resultado a la
   vista: se elegía ruta, orden y mora sin saber cuántos clientes iban a salir.
   Se bajaba el PDF para ver qué traía, y si no era eso, otra vez.

   Aquí los filtros van DENTRO de su tarjeta y ENCIMA del botón, con la cuenta
   hecha —«van a salir 18 clientes · $16,2M»— para que se sepa qué va a caer
   antes de pulsar.

   Y «mandar» va al lado de «bajar»: el destinatario casi siempre es el contador
   por WhatsApp, así que bajar el archivo al teléfono para volver a subirlo es
   un paso que sobra.

   EL DORADO ES DE «QUIÉN ME DEBE», Y DE NADIE MÁS. Es la descarga que se hace
   todas las semanas; las otras dos son de fin de mes o del contador. Por eso
   esa tarjeta lleva borde y halo dorados y su botón es el único de color: las
   demás son filas normales. Tres botones dorados no destacan ninguno. */

import { Interruptor } from '@/components/cf/primitivos2'

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '.09em',
      textTransform: 'uppercase', color: 'var(--cf-ink-3)',
    }}>{children}</span>
  )
}

/** Un desplegable con la pinta del sistema, no el del teléfono. */
function Selector({ valor, onCambio, opciones = [], etiqueta }) {
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <select
        value={valor}
        onChange={(e) => onCambio?.(e.target.value)}
        aria-label={etiqueta}
        style={{
          appearance: 'none', WebkitAppearance: 'none',
          width: '100%', height: 40, padding: '0 26px 0 11px',
          borderRadius: 'var(--cf-r-control)',
          background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
          font: 'inherit',
          // 12,5 y no 13: «Todas las rutas» en 153px no cabe a 13 y sale
          // «Todas las ru…», que no dice cuál está puesta.
          fontSize: 12.5, fontWeight: 600, color: 'var(--cf-ink)',
          cursor: 'pointer',
        }}
      >
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
      </select>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        style={{ position: 'absolute', right: 9, top: 13, pointerEvents: 'none' }}>
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  )
}

const IconoBajar = ({ color = 'var(--cf-on-gold)', tam = 16 }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <path d="M12 4v11M8 12l4 4 4-4M5 20h14" />
  </svg>
)

/* Verde de WhatsApp. Es marca ajena y va literal a propósito: es la única
   forma de que se lea «WhatsApp» sin escribirlo. */
const IconoMandar = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#25D366"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <path d="M20 12a8 8 0 01-11.6 7.1L4 20l.9-4.3A8 8 0 1120 12z" />
  </svg>
)

function Boton({ onClick, ocupado, tono = 'oro', children }) {
  const deOro = tono === 'oro'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupado}
      style={{
        flex: 1, minWidth: 0, height: 44, borderRadius: 'var(--cf-r-control)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        cursor: ocupado ? 'default' : 'pointer', font: 'inherit',
        fontSize: 14, fontWeight: deOro ? 700 : 600,
        opacity: ocupado ? 0.6 : 1,
        background: deOro ? 'var(--cf-gold)' : 'var(--cf-card)',
        color: deOro ? 'var(--cf-on-gold)' : 'var(--cf-ink)',
        border: deOro ? 'none' : '1px solid var(--cf-border-strong)',
      }}
    >
      {ocupado ? 'Un momento…' : children}
    </button>
  )
}

export function BajarInformacion({
  quienDebe,
  comoMeFue,
  datos = [],
  datosTitulo = 'Tus datos en crudo',
  datosNota = 'Excel para el contador o para hacer tus propias cuentas.',
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {quienDebe && (
        <div style={{
          background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
          padding: '17px 19px', display: 'flex', flexDirection: 'column', gap: 13,
          // La destacada: es la que se baja todas las semanas.
          border: '1.5px solid var(--cf-gold)',
          boxShadow: '0 0 0 3px var(--cf-gold-focus)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Rotulo>Quién me debe</Rotulo>
            <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
              Todos tus clientes con cuánto deben y cuántos días llevan atrasados.
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Selector
              etiqueta="Ruta"
              valor={quienDebe.ruta}
              onCambio={quienDebe.onRuta}
              opciones={[{ valor: '', texto: 'Todas las rutas' }, ...(quienDebe.rutas ?? [])
                .map((r) => ({ valor: String(r.id), texto: r.nombre }))]}
            />
            <Selector
              etiqueta="Orden"
              valor={quienDebe.orden}
              onCambio={quienDebe.onOrden}
              opciones={[
                { valor: 'mora', texto: 'Más atrasado' },
                { valor: 'saldo', texto: 'Debe más' },
                { valor: 'nombre', texto: 'Por nombre' },
              ]}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--cf-ink)' }}>
              Solo los que están en mora
            </span>
            <Interruptor
              encendido={!!quienDebe.soloMora}
              onCambiar={quienDebe.onSoloMora}
              etiqueta="Solo los que están en mora"
            />
          </div>

          {/* LA CUENTA HECHA, ANTES DE PULSAR. Sin esto se baja el PDF para ver
              qué trae, y si no era eso, otra vez. */}
          {quienDebe.cuenta && (
            <div style={{
              padding: '11px 14px', borderRadius: 'var(--cf-r-control)',
              background: 'var(--cf-fill)', border: '1px solid var(--cf-border)',
            }}>
              <span className="cf-num" style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>
                {quienDebe.cuenta}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <Boton onClick={quienDebe.onBajar} ocupado={quienDebe.bajando}>
              <IconoBajar /> Bajar
            </Boton>
            {quienDebe.onMandar && (
              <Boton onClick={quienDebe.onMandar} ocupado={quienDebe.mandando} tono="claro">
                <IconoMandar /> Mandar
              </Boton>
            )}
          </div>
        </div>
      )}

      {/* «Cómo me fue» es una FILA, no una tarjeta con su botón: se baja una vez
          al mes y no compite con la de arriba. */}
      {comoMeFue && (
        <div style={{
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
        }}>
          <button
            type="button"
            onClick={comoMeFue.onBajar}
            disabled={comoMeFue.bajando}
            style={{
              display: 'flex', alignItems: 'center', gap: 13, width: '100%',
              padding: '17px 19px', background: 'none', border: 0,
              cursor: comoMeFue.bajando ? 'default' : 'pointer',
              textAlign: 'left', font: 'inherit', color: 'var(--cf-ink)',
              opacity: comoMeFue.bajando ? 0.6 : 1,
            }}
          >
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Rotulo>Cómo me fue</Rotulo>
              <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
                Cuánto entró, cuánto ganaste y cómo le fue a cada cobrador.
              </span>
            </span>
            <IconoBajar color="var(--cf-ink-3)" tam={18} />
          </button>
          {comoMeFue.onMandar && (
            <button
              type="button"
              onClick={comoMeFue.onMandar}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', height: 44, background: 'none', border: 0,
                borderTop: '1px solid var(--cf-hairline)', cursor: 'pointer',
                font: 'inherit', fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
              }}
            >
              <IconoMandar /> Mandar por WhatsApp
            </button>
          )}
        </div>
      )}

      {datos.length > 0 && (
        <div style={{
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
        }}>
          <div style={{ padding: '17px 19px 13px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Rotulo>{datosTitulo}</Rotulo>
            <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
              {datosNota}
            </span>
          </div>
          {datos.map((d) => (
            <button
              key={d.tipo}
              type="button"
              onClick={d.onBajar}
              disabled={d.bajando}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '14px 19px', background: 'none', border: 0,
                borderTop: '1px solid var(--cf-hairline)',
                cursor: d.bajando ? 'default' : 'pointer', font: 'inherit',
                textAlign: 'left', color: 'var(--cf-ink)',
                opacity: d.bajando ? 0.6 : 1,
              }}
            >
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>
                {d.nombre}
              </span>
              {/* CUÁNTAS FILAS TRAE. Si dice 0, mejor saberlo antes de abrirlo
                  en el computador y descubrir que está vacío. */}
              <span className="cf-num" style={{
                fontSize: 12, flex: 'none',
                color: d.filas === 0 ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)',
              }}>
                {d.bajando ? 'bajando…'
                  : d.filas == null ? ''
                    : d.filas === 0 ? 'vacío'
                      : d.filas === 1 ? '1 fila' : `${d.filas} filas`}
              </span>
              <IconoBajar color="var(--cf-ink-3)" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
