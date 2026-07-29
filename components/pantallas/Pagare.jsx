'use client'

// components/pantallas/Pagare.jsx — turno 18.
//
// EL ÚNICO MOMENTO DEL FLUJO CON CONSECUENCIA LEGAL, y hoy es una casilla en la
// ficha del préstamo. Estas tres pantallas son la entrega del dinero: el cliente
// lee lo que debe, firma en el teléfono del cobrador, y ambos se quedan con el
// papel — él por WhatsApp, el prestamista en la ficha.
//
// Lo que queda cuando el cliente dice que nunca firmó.

import { Tarjeta, BotonPrimario, BotonSecundario, BotonTexto } from '@/components/cf/primitivos'

/* ── 01 · Lo que va a firmar ───────────────────────────────────────────────
   ESCRITO PARA LEÉRSELO EN VOZ ALTA, no para que lo firme sin mirar.
   Y EL RECARGO POR MORA APARECE ANTES DE FIRMAR: es la única forma de poder
   cobrarlo después sin discusión. */
function FilaCondicion({ etiqueta, valor, primera }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 12, flex: 'none',
      minHeight: 46, padding: '11px 16px',
      borderTop: primera ? 0 : '1px solid var(--cf-hairline)',
    }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--cf-ink-2)' }}>{etiqueta}</span>
      <span className="cf-num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)', flex: 'none', textAlign: 'right' }}>
        {valor}
      </span>
    </div>
  )
}

export function AntesDeFirmar({
  nombre, recibe, medio, devuelve, cadaCuanto, cuota,
  condiciones = [], confirmado = false,
  onConfirmar, onFirmar, onSinFirma,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: '8px var(--cf-pad-screen) 16px' }}>

        {/* Las dos cifras que importan, enfrentadas: lo que recibe hoy y lo que
            devuelve. En ese orden, que es el orden en que las va a oír. */}
        <div style={{
          background: '#15161A', borderRadius: 'var(--cf-r-hero)', padding: '19px 21px',
          display: 'flex', flexDirection: 'column', gap: 15, flex: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#A3A8B2' }}>
                Recibe hoy
              </span>
              <span className="cf-fig" style={{ display: 'block', fontSize: 32, letterSpacing: '-.035em', color: '#F3F3F6', marginTop: 5 }}>
                {recibe}
              </span>
            </span>
            {medio && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 999,
                background: 'rgba(255,255,255,.08)', flex: 'none', marginBottom: 5,
                fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#A3A8B2',
              }}>{medio}</span>
            )}
          </div>

          <span style={{ height: 1, background: 'rgba(255,255,255,.09)' }} />

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#A3A8B2' }}>Devuelve en total</span>
            <span className="cf-fig" style={{ fontSize: 19, color: '#F3F3F6', flex: 'none' }}>{devuelve}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: -7 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#A3A8B2' }}>{cadaCuanto}</span>
            <span className="cf-fig" style={{ fontSize: 19, color: '#F3F3F6', flex: 'none' }}>{cuota}</span>
          </div>
        </div>

        <Tarjeta plana>
          {condiciones.map((c, i) => (
            <FilaCondicion key={c.etiqueta} {...c} primera={i === 0} />
          ))}
        </Tarjeta>

        {/* La casilla no es burocracia: es lo que convierte "se lo leí" en algo
            que el cobrador tuvo que tocar a propósito. */}
        <button type="button" onClick={onConfirmar} style={{
          display: 'flex', alignItems: 'flex-start', gap: 12, flex: 'none',
          padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
          background: 'var(--cf-card)',
          border: `1px solid ${confirmado ? 'var(--cf-gold-border)' : 'var(--cf-border)'}`,
          borderRadius: 'var(--cf-r-card)',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, minWidth: 22, height: 22, borderRadius: 7, flex: 'none', marginTop: 1,
            background: confirmado ? 'var(--cf-gold)' : 'var(--cf-card)',
            border: confirmado ? 0 : '1.5px solid var(--cf-border-strong)',
          }}>
            {confirmado && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--cf-gold-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l5 5L19 7" />
              </svg>
            )}
          </span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--cf-ink)', lineHeight: 1.45 }}>
            {nombre} entendió las condiciones y está de acuerdo con firmar el pagaré.
          </span>
        </button>
      </div>

      {/* "Guardar sin firma" existe porque a veces el cliente no tiene tiempo —
          pero queda de segunda, en texto: si compite con el dorado, se convierte
          en el camino por defecto y el pagaré deja de existir. */}
      <div style={{
        flex: 'none', padding: '14px 20px 20px',
        background: 'var(--cf-card)', borderTop: '1px solid var(--cf-border)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <BotonPrimario onClick={onFirmar}>Pasar a la firma</BotonPrimario>
        <BotonTexto onClick={onSinFirma} style={{ alignSelf: 'center' }}>Guardar sin firma</BotonTexto>
      </div>
    </div>
  )
}

/* ── 02 · La firma ─────────────────────────────────────────────────────────
   LA ÚNICA PANTALLA DEL SISTEMA EN HORIZONTAL. Firmar con el dedo necesita
   ancho, y girar el teléfono es además el gesto que dice "ahora te toca a ti".
   Arriba se repite QUÉ SE ESTÁ FIRMANDO, porque el teléfono cambia de manos y
   quien firma no vio la pantalla anterior.
   La fecha y la hora se estampan solas: un pagaré sin fecha no sirve. */
export function Firma({ nombre, resumen, fecha, hora, hayTrazo = false, onBorrar, onListo }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--cf-surface)', padding: '14px 20px 16px', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 'none' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
          }}>Firma aquí, {nombre}</span>
          <span className="cf-num" style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 3 }}>
            {resumen}
          </span>
        </span>
        <BotonSecundario style={{ width: 'auto', padding: '0 15px', height: 38, flex: 'none' }} onClick={onBorrar}>
          Borrar y repetir
        </BotonSecundario>
        <BotonPrimario style={{ width: 'auto', padding: '0 22px', height: 38, flex: 'none' }} onClick={onListo}>
          Listo
        </BotonPrimario>
      </div>

      <div style={{
        flex: 1, minHeight: 0, position: 'relative',
        background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card)', overflow: 'hidden',
      }}>
        {/* La línea de firma, con su rótulo: sin ella el recuadro no dice qué se
            espera que pase ahí. */}
        <span aria-hidden style={{
          position: 'absolute', left: 32, right: 32, bottom: 46,
          height: 1, background: 'var(--cf-border-strong)',
        }} />
        <span style={{
          position: 'absolute', left: 32, right: 32, bottom: 20,
          display: 'flex', alignItems: 'baseline', gap: 12,
        }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: 'var(--cf-ink-3)' }}>
            Firma del cliente
          </span>
          <span className="cf-num" style={{ fontSize: 11.5, color: 'var(--cf-ink-3)', flex: 'none' }}>
            {fecha} · {hora}
          </span>
        </span>

        {/* El trazo se APOYA en la línea, no flota sobre ella: una firma que
            levita en mitad del recuadro no se lee como una firma. El viewBox va
            ajustado al alto real del trazo para que no sobre caja vacía. */}
        {hayTrazo && (
          <svg viewBox="0 0 520 96" preserveAspectRatio="none"
            style={{ position: 'absolute', left: 44, right: 44, bottom: 50, width: 'calc(100% - 88px)', height: 88 }}>
            <path d="M18 72 C58 18, 88 94, 128 46 S198 10, 238 60 C268 92, 298 26, 338 54 C368 76, 398 40, 442 68"
              fill="none" stroke="var(--cf-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              vectorEffect="non-scaling-stroke" />
          </svg>
        )}
      </div>
    </div>
  )
}

/* ── 03 · El pagaré firmado ────────────────────────────────────────────────
   UN DOCUMENTO DE VERDAD, no un recibo: las dos firmas, el número, la fecha y
   un código para verificarlo en línea — porque el valor del pagaré es que el
   cliente NO PUEDA decir que no lo firmó.
   Se manda por WhatsApp de una vez: el que se queda solo en el teléfono del
   cobrador no sirve de nada. */
export function PagareFirmado({
  negocio, numero, fecha,
  cliente, cedula, recibio, devuelve, plazoTexto, empieza,
  firmaCliente, horaFirma, firmaPrestamista,
  verificableHasta,
  onMandar, onDescargar, onImprimir, onVerPrestamo,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: '10px var(--cf-pad-screen) 16px' }}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, flex: 'none', padding: '4px 0 6px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 46, height: 46, borderRadius: 999, flex: 'none',
            background: 'var(--cf-green-pill-bg)', border: '1.5px solid var(--cf-green-pill-border)',
          }}>
            <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="var(--cf-green-dark)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l5 5L19 7" />
            </svg>
          </span>
          <span style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 19, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)' }}>
            Préstamo entregado
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--cf-ink-3)' }}>
            {cliente.split(' ')[0]} ya puede recibir su plata
          </span>
        </div>

        {/* El documento. Borde troquelado: se lee como papel, no como tarjeta. */}
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 15, flex: 'none',
          padding: '17px 19px 19px', background: 'var(--cf-card)',
          border: '1px dashed var(--cf-border-strong)', borderRadius: 'var(--cf-r-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--cf-ink)' }}>{negocio}</span>
              <span className="cf-num" style={{ display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)', marginTop: 2 }}>
                Pagaré Nº {numero} · {fecha}
              </span>
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', height: 21, padding: '0 9px', borderRadius: 999, flex: 'none',
              background: 'var(--cf-green-pill-bg)', border: '1px solid var(--cf-green-pill-border)',
              fontSize: 9.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--cf-green-dark)',
            }}>firmado</span>
          </div>

          <span style={{ height: 1, background: 'var(--cf-hairline)' }} />

          {/* En primera persona y con las cifras dentro de la frase: así se lee
              en voz alta y así vale delante de alguien. */}
          <span style={{ fontSize: 13.5, color: 'var(--cf-ink)', lineHeight: 1.6 }}>
            Yo, <strong>{cliente}</strong>, con CC {cedula}, declaro que recibí{' '}
            <strong>{recibio}</strong> y me comprometo a devolver <strong>{devuelve}</strong> en{' '}
            {plazoTexto}, empezando el {empieza}.
          </span>

          <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
            {[[firmaCliente, `${cliente} · ${horaFirma}`], [firmaPrestamista, 'prestamista']].map(([trazo, pie], i) => (
              <span key={i} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <svg viewBox="0 0 200 52" style={{ width: '100%', height: 44 }}>
                  <path d={trazo} fill="none" stroke="var(--cf-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{ height: 1, background: 'var(--cf-border-strong)' }} />
                <span className="cf-num" style={{
                  fontSize: 10, color: 'var(--cf-ink-3)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{pie}</span>
              </span>
            ))}
          </div>

          <span style={{ height: 1, background: 'var(--cf-hairline)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* El QR real lo genera el servidor con el codigo de verificacion.
                Aca va un marcador que se LEE como QR —los tres cuadros de
                esquina son lo que lo identifica— para que el maquetado no
                mienta sobre el tamaño que va a ocupar. */}
            <svg aria-hidden width="48" height="48" viewBox="0 0 29 29" style={{ flex: 'none' }}>
              <rect width="29" height="29" fill="var(--cf-card)" />
              {[[0, 0], [22, 0], [0, 22]].map(([x, y]) => (
                <g key={`${x}-${y}`} fill="var(--cf-ink)">
                  <rect x={x} y={y} width="7" height="7" />
                  <rect x={x + 1} y={y + 1} width="5" height="5" fill="var(--cf-card)" />
                  <rect x={x + 2} y={y + 2} width="3" height="3" />
                </g>
              ))}
              <g fill="var(--cf-ink)">
                {[[9,1],[11,1],[13,2],[9,3],[12,4],[10,5],[14,5],[9,7],[13,7],[1,9],[3,9],[5,9],[7,9],[10,9],[12,9],[15,9],[17,9],[19,9],[21,9],[23,9],[26,9],[2,11],[6,11],[9,11],[11,11],[14,11],[16,11],[20,11],[24,11],[27,11],[1,13],[4,13],[8,13],[10,13],[13,13],[17,13],[19,13],[22,13],[25,13],[3,15],[5,15],[9,15],[12,15],[15,15],[18,15],[21,15],[26,15],[2,17],[7,17],[11,17],[14,17],[16,17],[20,17],[23,17],[27,17],[1,19],[4,19],[9,19],[13,19],[17,19],[19,19],[24,19],[26,19],[10,21],[12,21],[15,21],[18,21],[22,21],[25,21],[9,23],[14,23],[16,23],[20,23],[23,23],[27,23],[11,25],[13,25],[17,25],[21,25],[24,25],[26,25],[10,27],[15,27],[19,27],[22,27],[25,27]].map(([x, y]) => (
                  <rect key={`${x}-${y}`} x={x} y={y} width="1.6" height="1.6" />
                ))}
              </g>
            </svg>
            <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: 'var(--cf-ink-3)', lineHeight: 1.45 }}>
              Escanea para verificar este pagaré en línea. Nº {numero} · verificable hasta {verificableHasta}.
            </span>
          </div>
        </div>

        {/* "Mandárselo" primero y en verde WhatsApp: el pagaré que se queda solo
            en el teléfono del cobrador no sirve de nada. */}
        <div style={{ display: 'flex', gap: 9, flex: 'none' }}>
          <button type="button" onClick={onMandar} style={{
            flex: 1.4, minWidth: 0, height: 'var(--cf-h-btn-2)', borderRadius: 'var(--cf-r-control)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            background: 'var(--cf-whatsapp)', border: 0, cursor: 'pointer',
            fontSize: 14, fontWeight: 700, color: '#FFF',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.4 8.4 0 01-12.6 7.3L3 20.5l1.8-5.2A8.4 8.4 0 1121 11.5z" />
            </svg>
            Mandárselo
          </button>
          <BotonSecundario style={{ flex: 1 }} onClick={onDescargar}>Descargar</BotonSecundario>
          <BotonSecundario style={{ flex: 1 }} onClick={onImprimir}>Imprimir</BotonSecundario>
        </div>
      </div>

      <div style={{
        flex: 'none', padding: '14px 20px 20px',
        background: 'var(--cf-card)', borderTop: '1px solid var(--cf-border)',
      }}>
        <BotonPrimario onClick={onVerPrestamo}>Ver el préstamo de {cliente.split(' ')[0]}</BotonPrimario>
      </div>
    </div>
  )
}
