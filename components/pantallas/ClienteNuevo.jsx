'use client'

// components/pantallas/ClienteNuevo.jsx — T07-03 crear cliente a mano.
//
// ══ UN SOLO CAMPO OBLIGATORIO: EL NOMBRE ═══════════════════════════════════
//
// Es la decisión de la pantalla y no es de estilo. El 75% de los negocios se
// quedan atascados en ≤5 clientes, y los clientes cargados son lo que predice el
// pago: 0 clientes → 0% de conversión, 51-150 → 74%. Todo lo que frene la carga
// en la calle —con el cliente delante, de pie, con el celular en una mano— sale
// caro.
//
// Por eso la cédula dice «opcional» EN EL PROPIO CAMPO, no en una ayuda debajo.
// La ayuda de abajo la lee quien ya dudó; el placeholder lo lee todo el mundo.
//
// ══ DOS SALIDAS, Y NINGUNA VUELVE A LA LISTA ═══════════════════════════════
//
// «Guardar y prestarle» es lo que se hace el 90% de las veces: nadie registra un
// cliente por gusto, lo registra porque le va a prestar. «Guardar y crear otro»
// encadena, que es como se carga una libreta entera de una sentada. Volver a la
// lista para volver a pulsar «+» es el camino que hace que se cargue uno y se
// deje el resto para nunca.

import { useState } from 'react'

export function ClienteNuevo({
  nombre = '', cedula = '', telefono = '', direccion = '',
  /* El documento NO se llama igual en todos lados: es DNI en Argentina, RUT en
     Chile, Carnet en Bolivia. `lib/countries.js` lo tiene definido para los
     dieciocho países desde siempre; lo que faltaba era que alguien lo usara.
     Viene por prop y no de `useCountry` porque este componente es puro: recibe
     todo lo que pinta. El valor por defecto mantiene lo de antes. */
  rotuloDocumento = 'Cédula',
  rutas = [], ruta, onRuta,
  onCampo, onGuardarYPrestar, onGuardarYOtro, onDesdeFoto, onVolver,
  guardando = false,
  // ── LO QUE LA LAMINA NO DIBUJA Y EL FORMULARIO REAL SI TIENE ──
  //
  // T07-03 pone cinco campos. El formulario de verdad tiene ademas referencia,
  // grupo de cobro, dias sin cobro, tope de prestamo, notas y el acceso al
  // portal. Por eso este componente llevaba meses sin montar: montarlo tal cual
  // le QUITABA campos al usuario.
  //
  // La salida no es elegir entre la lamina y las funciones: es respetar lo que
  // la lamina defiende —un solo campo obligatorio, todo en una pantalla, sin
  // pasos— y meter el resto detras de «Mas datos», cerrado. Quien carga en la
  // calle no lo abre nunca; quien lo necesita lo tiene a un toque.
  extras,
  extrasTitulo = 'Más datos',
  extrasNota = 'Referencia, grupo, tope y notas',
  cabecera = true, alto = '100%', sinMargen = false,
}) {
  const [verExtras, setVerExtras] = useState(false)
  const listo = String(nombre).trim().length > 0

  return (
    <div style={{
      height: alto, minHeight: 0, display: 'flex', flexDirection: 'column',
      color: 'var(--cf-ink)',
    }}>
      {cabecera && (
      <div style={{ flex: 'none', padding: '6px 20px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {onVolver && (
          <button type="button" onClick={onVolver} aria-label="Volver" style={{
            background: 'none', border: 0, padding: 0, cursor: 'pointer', flex: 'none', display: 'inline-flex',
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-2)"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <span style={{
          flex: 1, minWidth: 0, fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 20, fontWeight: 600, letterSpacing: '-.02em',
        }}>Nuevo cliente</span>
        {/* La salida al migrador de cartulinas. Va arriba y en texto: quien tiene
            la libreta en la mano no quiere teclear nada. */}
        {onDesdeFoto && (
          <button type="button" onClick={onDesdeFoto} style={{
            background: 'none', border: 0, padding: 0, cursor: 'pointer', flex: 'none',
            font: 'inherit', fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)',
          }}>Desde foto</button>
        )}
      </div>
      )}

      <div style={{
        flex: sinMargen ? 'none' : 1, minHeight: 0,
        overflowY: sinMargen ? 'visible' : 'auto',
        padding: sinMargen ? '0 0 20px' : '0 20px 20px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <Campo rotulo="Nombre" valor={nombre} foco
          onCambiar={(v) => onCampo?.('nombre', v)} placeholder="Marta Restrepo" />

        <div style={{ flex: 'none', display: 'flex', gap: 10 }}>
          {/* La cédula más ancha que la ruta: los números son largos y no se
              pueden abreviar; el nombre de una ruta sí. */}
          <div style={{ flex: 1.3, minWidth: 0 }}>
            <Campo rotulo={rotuloDocumento} valor={cedula} numerica
              onCambiar={(v) => onCampo?.('cedula', v)}
              placeholder="opcional" />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Rotulo>Ruta</Rotulo>
            <Selector valor={ruta} opciones={rutas} onElegir={onRuta} />
          </div>
        </div>

        <Campo rotulo="Teléfono" valor={telefono} numerica
          onCambiar={(v) => onCampo?.('telefono', v)} placeholder="300 000 0000"
          icono={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366"
              strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
              <path d="M20 12a8 8 0 01-11.6 7.1L4 20l.9-4.3A8 8 0 1120 12z" />
            </svg>
          } />

        <Campo rotulo="Dirección" valor={direccion}
          onCambiar={(v) => onCampo?.('direccion', v)} placeholder="Dónde lo visitas"
          icono={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
              strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
              <circle cx="12" cy="10.5" r="3" />
              <path d="M12 21s6-5.4 6-10.2A6 6 0 006 10.8C6 15.6 12 21 12 21z" />
            </svg>
          } />

        {extras && (
          <div style={{ flex: 'none' }}>
            <button
              type="button"
              onClick={() => setVerExtras((v) => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
                font: 'inherit', textAlign: 'left', color: 'var(--cf-ink)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{extrasTitulo}</span>
                <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{extrasNota}</span>
              </span>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                style={{ flex: 'none', transform: verExtras ? 'rotate(180deg)' : 'none' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {verExtras && (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {extras}
              </div>
            )}
          </div>
        )}

        <div style={{
          flex: 'none', display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '14px 16px', borderRadius: 14,
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
            strokeWidth="2" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }}>
            <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
          </svg>
          <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
            Solo el nombre es obligatorio. Lo demás lo puedes completar cuando lo visites.
          </span>
        </div>
      </div>

      <div style={{
        flex: 'none', padding: '14px 20px 22px',
        background: 'var(--cf-card)', borderTop: '1px solid var(--cf-border-strong)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <button type="button" disabled={!listo || guardando} onClick={onGuardarYPrestar} style={{
          height: 52, border: 'none', borderRadius: 14,
          background: listo ? 'var(--cf-gold)' : 'var(--cf-fill-2)',
          color: listo ? 'var(--cf-gold-ink)' : 'var(--cf-ink-3)',
          cursor: listo && !guardando ? 'pointer' : 'default',
          font: 'inherit', fontSize: 16, fontWeight: 700,
        }}>{guardando ? 'Guardando…' : 'Guardar y prestarle'}</button>

        {/* Encadenar. Es como se carga una libreta entera de una sentada. */}
        {onGuardarYOtro && (
          <button type="button" disabled={!listo || guardando} onClick={onGuardarYOtro} style={{
            height: 34, border: 'none', background: 'none',
            color: 'var(--cf-ink-3)', cursor: listo && !guardando ? 'pointer' : 'default',
            font: 'inherit', fontSize: 13, fontWeight: 600,
          }}>Guardar y crear otro</button>
        )}
      </div>
    </div>
  )
}

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--cf-ink-3)',
    }}>{children}</span>
  )
}

function Campo({ rotulo, valor, onCambiar, placeholder, foco, numerica, icono }) {
  const [tocado, setTocado] = useState(false)
  const encendido = foco && !tocado
  return (
    <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Rotulo>{rotulo}</Rotulo>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, height: 56, padding: '0 16px',
        borderRadius: 14, background: 'var(--cf-card)',
        border: encendido ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border-strong)',
        boxShadow: encendido ? '0 0 0 3px var(--cf-gold-focus)' : 'none',
      }}>
        {/* type=text + inputMode: `type=number` rechaza el separador que no
            coincide con el locale del teléfono, y son doce países. */}
        <input
          type="text"
          inputMode={numerica ? 'numeric' : undefined}
          value={valor}
          placeholder={placeholder}
          onFocus={() => setTocado(true)}
          onChange={(e) => onCambiar?.(e.target.value)}
          className={numerica ? 'cf-num' : undefined}
          style={{
            flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent',
            // 17px, no 15: por debajo de 16px iOS hace zoom al enfocar el campo y
            // la pantalla se descoloca sola.
            font: 'inherit', fontSize: 17, fontWeight: numerica ? 500 : 600,
            color: 'var(--cf-ink)',
            fontFamily: numerica ? 'var(--font-space-grotesk), system-ui' : 'inherit',
          }}
        />
        {icono}
      </div>
    </div>
  )
}

function Selector({ valor, opciones = [], onElegir }) {
  const actual = opciones.find((o) => o.id === valor)
  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: 56, padding: '0 14px',
      borderRadius: 14, background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
    }}>
      <span style={{
        fontSize: 16, fontWeight: 600, flex: 1, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: actual ? 'var(--cf-ink)' : 'var(--cf-ink-3)',
      }}>{actual?.nombre ?? 'Sin ruta'}</span>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--cf-chevron)"
        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
        <path d="M6 9l6 6 6-6" />
      </svg>
      <select
        value={valor ?? ''}
        onChange={(e) => onElegir?.(e.target.value || null)}
        aria-label="Ruta"
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          opacity: 0, cursor: 'pointer', font: 'inherit',
        }}
      >
        <option value="">Sin ruta</option>
        {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
    </div>
  )
}
