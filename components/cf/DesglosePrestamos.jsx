'use client'

// components/cf/DesglosePrestamos.jsx — el desplegable de las dos tarjetas.
//
// ══ POR QUÉ UNA SOLA PIEZA PARA DOS PANTALLAS ═══════════════════════════════
//
// El dueño reportó dos cosas que parecían distintas:
//
//   · en la tarjeta de CLIENTE — «hay clientes que su tarjeta dice tres
//     préstamos, pero no hay ningún dropdown que les saque estadísticas
//     específicas de cuál es el estado de esos tres sin necesidad de meterse
//     dentro del cliente»
//   · en la de PRÉSTAMO — «un dropdown que tenga un desglose mucho más bonito
//     sin necesidad de entrar al préstamo directamente»
//
// Son la misma: la tira de cuatro columnas es un TITULAR, y debajo del titular
// no había nada. Para saber POR QUÉ un cliente está en mora había que abrir su
// ficha; para ver cómo se reparte la plata de un préstamo, la suya.
//
// Y hay un motivo fuerte para que sea UNA pieza y no dos: ya pasó con el
// comprobante. Lo mismo visto por dos caminos, corregido en uno solo, y el
// mismo fallo reportado dos días seguidos. Si el desplegable del cliente y el
// del préstamo fueran dos componentes, el «saldo» de uno y el del otro se
// separarían sin que nadie lo notara.
//
// ── LO QUE SE PLIEGA Y LO QUE NO ──
// Arranca CERRADO, como el de la ruta: el titular es lo que se lee recorriendo
// la lista, y el desglose es para cuando hay que decidir algo sobre ese
// cliente. Abierto por defecto convertiría una lista de treinta tarjetas en
// una pantalla de scroll infinito.
//
// ── LOS CLICS NO PUEDEN SUBIR ──
// Las dos tarjetas son `onClick` enteras —tocarlas entra a la ficha— así que
// TODO lo de aquí dentro corta la propagación. Sin eso, abrir el desplegable
// navegaría a otra pantalla, que es exactamente lo contrario de «sin necesidad
// de meterse dentro».

import { useId, useState } from 'react'
import { EtiquetaClavo, Pastilla, TiraCifras } from './primitivos'

const COLOR_ESTADO = {
  mora:    'var(--cf-red)',
  atraso:  'var(--cf-gold)',
  aldia:   'var(--cf-green)',
  renovar: 'var(--cf-green)',
  pagado:  'var(--cf-ink-4)',
}

const TONO_PASTILLA = {
  mora: 'mora', atraso: 'atraso', aldia: 'aldia', renovar: 'aldia', pagado: 'neutro',
}

/* ══ El plegador ══
   Un renglón con su flecha, sobre un filete. No es un botón con caja: dentro de
   una tarjeta que ya tiene pastilla, tira de cifras y barra, un quinto bloque
   con fondo propio la convierte en un acordeón. */
export function Desplegable({ rotulo, children, abiertoInicial = false }) {
  const [abierto, setAbierto] = useState(abiertoInicial)
  const id = useId()

  return (
    <div
      style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: abierto ? 10 : 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={(e) => { e.stopPropagation(); setAbierto((v) => !v) }}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          alignSelf: 'flex-start', padding: '7px 0 0 0',
          background: 'none', border: 0, borderTop: 0, cursor: 'pointer',
          font: 'inherit', fontSize: 12, fontWeight: 700,
          color: 'var(--cf-gold-dark)',
        }}
      >
        {rotulo}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {abierto && (
        <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {children}
        </div>
      )}
    </div>
  )
}

/* ══ La ficha de UN préstamo ══ */
export function FichaPrestamo({ ficha, onAbrir, onWhatsApp, onCobrar }) {
  if (!ficha) return null
  const color = COLOR_ESTADO[ficha.estado] || COLOR_ESTADO.aldia
  // Un préstamo cerrado no se cobra. El botón se va —no se deshabilita— porque
  // un botón gris que no hace nada obliga a probarlo para saberlo.
  const cobrable = ficha.estado !== 'pagado' && !!onCobrar

  return (
    <div
      onClick={onAbrir ? (e) => { e.stopPropagation(); onAbrir() } : undefined}
      role={onAbrir ? 'button' : undefined}
      tabIndex={onAbrir ? 0 : undefined}
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        padding: '12px 13px 13px',
        borderRadius: 'var(--cf-r-control)',
        background: 'var(--cf-card-alt)',
        border: '1px solid var(--cf-border-soft)',
        cursor: onAbrir ? 'pointer' : 'default',
        // El pagado se apaga, igual que la tarjeta entera cuando lo está: sigue
        // siendo historia consultable y deja de pedir atención.
        opacity: ficha.estado === 'pagado' ? 0.65 : 1,
      }}
    >
      {/* ── Qué se pactó, y cuánto falta ──
          `sinCabecera` la apaga: en la tarjeta de PRÉSTAMO todo esto ya está dos
          centímetros más arriba —el título, la pastilla y la tira— y repetirlo
          es la tercera copia del mismo dato en la misma pantalla. Ahí el
          desplegable existe para lo que NO está arriba, que es cómo se reparte
          la plata. En la de cliente no hay nada de ese préstamo arriba, así que
          la cabecera es la información. */}
      {!ficha.sinCabecera && (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
            fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)', letterSpacing: '-.01em',
          }}>
            {/* El punto de estado. Es el mismo papel que el anillo del avatar en
                la tarjeta: el color va pegado a lo que identifica la fila, nunca
                en un filete añadido para pintarlo. */}
            <span aria-hidden style={{
              width: 7, height: 7, minWidth: 7, borderRadius: 999, flex: 'none', background: color,
            }} />
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{ficha.titulo}</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', rowGap: 4, minWidth: 0 }}>
            {ficha.etiqueta && (
              <Pastilla tono={TONO_PASTILLA[ficha.estado] ?? 'neutro'} numerica>{ficha.etiqueta}</Pastilla>
            )}
            {/* CUÁL de los dos es el perdido. Con dos préstamos del mismo
                cliente, sin esto las dos fichas se leen igual. */}
            {ficha.clavo && <EtiquetaClavo />}
            {ficha.desde && (
              <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>
                desde {ficha.desde}
              </span>
            )}
          </div>
        </div>

        {/* ⚠ AQUÍ VA LO QUE FALTA, y arriba en la tarjeta va lo pagado.
            No es una incoherencia: arriba la pregunta es «¿ya pagó algo?» —un
            préstamo recién creado que dijera «$1.800.000 de $1.800.000» se lee
            como saldado, y el dueño lo reportó con esas palabras— y abierto el
            desplegable la pregunta es la contraria: cuánto queda por cobrarle.
            Por eso la etiqueta lo dice con todas las letras. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flex: 'none' }}>
          <span className="cf-fig" style={{ fontSize: 17, letterSpacing: '-.02em', color: 'var(--cf-ink)' }}>
            {ficha.falta}
          </span>
          <span className="cf-num" style={{ fontSize: 10.5, color: 'var(--cf-ink-3)', whiteSpace: 'nowrap' }}>
            falta{ficha.total ? ` ${ficha.total}` : ''}
          </span>
        </div>
      </div>
      )}

      {/* ── El avance ── */}
      {!ficha.sinCabecera && !ficha.sinProgreso && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span aria-hidden style={{
            display: 'block', height: 4, borderRadius: 999, flex: 'none',
            background: 'var(--cf-fill-2)', overflow: 'hidden',
          }}>
            <span style={{
              display: 'block', height: 4, borderRadius: 999,
              width: `${Math.max(0, Math.min(100, ficha.porcentaje ?? 0))}%`, background: color,
            }} />
          </span>
          {ficha.avance && (
            <span className="cf-num" style={{
              fontSize: 10.5, fontWeight: 700, color: 'var(--cf-ink-3)', alignSelf: 'flex-end',
            }}>{ficha.avance}</span>
          )}
        </div>
      )}
      {!ficha.sinCabecera && ficha.sinProgreso && ficha.avance && (
        <span className="cf-num" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--cf-ink-3)' }}>
          {ficha.avance}
        </span>
      )}

      {/* CUOTA · ATRASO · COBRA EL — las de este préstamo, no las del cliente.
          Es literalmente lo que faltaba: «si un cliente tiene tres préstamos, no
          se cobran todos el mismo día, porque es dependiendo al préstamo». */}
      {!ficha.sinCabecera && <TiraCifras columnas={ficha.cifras} enTarjeta />}

      {/* ── El desglose largo, solo en la tarjeta de préstamo ── */}
      {ficha.lineas?.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 0,
          ...(ficha.sinCabecera ? null : { paddingTop: 10, borderTop: '1px solid var(--cf-border-soft)' }),
        }}>
          {ficha.lineas.map((l, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
              padding: '5px 0',
              borderTop: i > 0 ? '1px solid var(--cf-hairline)' : 0,
            }}>
              <span style={{ fontSize: 11.5, color: 'var(--cf-ink-3)', flex: 'none' }}>{l.rotulo}</span>
              <span className="cf-num" style={{
                fontSize: l.fuerte ? 13 : 12, fontWeight: 700,
                minWidth: 0, overflowWrap: 'anywhere', textAlign: 'right',
                color: l.apagado ? 'var(--cf-ink-4)'
                     : l.tono === 'favor'  ? 'var(--cf-green-dark)'
                     : l.tono === 'contra' ? 'var(--cf-red-dark)'
                     : 'var(--cf-ink)',
              }}>{l.valor}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── LAS DOS ACCIONES ──
          «Ponerle el botón de las plantillas de WhatsApp y también un cobro
          rápido, para no tenerse que meter dentro del cliente.»

          COBRAR EN DORADO, NUNCA EN VERDE: en este sistema el verde significa
          «al día, pagado». Usarlo como color de acción rompe esa lectura justo
          donde más importa. El verde de aquí es el de WhatsApp, que es una
          marca y no un estado. */}
      {(onWhatsApp || cobrable) && (
        <div style={{ display: 'flex', gap: 8, paddingTop: 1 }} onClick={(e) => e.stopPropagation()}>
          {onWhatsApp && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onWhatsApp() }}
              style={{
                ...BOTON, flex: cobrable ? 1 : 'none',
                paddingInline: cobrable ? 0 : 16,
                background: 'var(--cf-card)',
                border: '1px solid var(--cf-border-strong)',
                color: 'var(--cf-ink-2)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--cf-whatsapp)" aria-hidden style={{ flex: 'none' }}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Plantillas
            </button>
          )}
          {cobrable && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCobrar() }}
              style={{
                ...BOTON, flex: 1.4,
                background: 'var(--cf-gold)', border: '1px solid transparent',
                color: 'var(--cf-gold-ink)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
                <rect x="2.5" y="6" width="19" height="12.5" rx="2.5" />
                <circle cx="12" cy="12.25" r="2.6" />
              </svg>
              Cobrar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const BOTON = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  height: 38, borderRadius: 'var(--cf-r-pill)', cursor: 'pointer',
  font: 'inherit', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
  minWidth: 0,
}

/**
 * El desplegable entero, tal y como lo montan las dos tarjetas.
 *
 * `desglose` viene de `desgloseDe()` (varios préstamos, tarjeta de cliente) o de
 * `{ rotulo, prestamos: [fichaDe(p, pais, { largo: true })] }` (uno solo, tarjeta
 * de préstamo). La pieza no distingue: pinta las fichas que le den.
 */
export default function DesglosePrestamos({ desglose, onAbrir, onWhatsApp, onCobrar }) {
  if (!desglose?.prestamos?.length) return null
  return (
    <Desplegable rotulo={desglose.rotulo}>
      {desglose.prestamos.map((f) => (
        <FichaPrestamo
          key={f.id}
          ficha={f}
          onAbrir={onAbrir ? () => onAbrir(f) : undefined}
          onWhatsApp={onWhatsApp ? () => onWhatsApp(f) : undefined}
          onCobrar={onCobrar ? () => onCobrar(f) : undefined}
        />
      ))}
    </Desplegable>
  )
}
