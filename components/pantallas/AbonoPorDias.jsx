'use client'

/* ── ABONO POR DÍAS ─────────────────────────────────────────────────────────
 *
 * La ÚLTIMA pantalla que quedaba con el estilo viejo. El enlace «Abonar por
 * días» de la hoja de cobro abría el formulario completo de antes —el modal
 * con sus seis tipos de pago—, porque el deslizador de días solo vivía ahí.
 * Dos usuarios lo reportaron como fallo; no lo era, era un pendiente.
 *
 * Esta hoja hace UNA cosa: convertir días en plata. `cuota × días`, tope el
 * saldo. Lo que el cobrador pregunta en la calle es «¿cuánto por una semana?»,
 * y eso es lo único que se responde aquí. Los otros tipos de pago (recargo,
 * descuento, intereses) YA tienen su sitio en «Gestión»: traerlos otra vez
 * sería el error que tenía el modal viejo.
 *
 * Lo que NO se pierde del modal viejo, que es lo que importa:
 *   · el deslizador de 1 a 30 con sus tres marcas (1 sem · quincena · 1 mes);
 *   · los atajos «Pagar mora» y «Ponerse al día», con su monto ya calculado;
 *   · las próximas cuotas pendientes, pulsables, para los modos con tabla.
 */

import { formatMoney } from '@/lib/i18n'

const ORO = 'var(--cf-gold)'
const SNAPS = [
  { dias: 7,  texto: '1 sem' },
  { dias: 15, texto: 'Quinc.' },
  { dias: 30, texto: '1 mes' },
]

function Rotulo({ children }) {
  return (
    <p style={{
      margin: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em',
      textTransform: 'uppercase', color: 'var(--cf-ink-3)',
    }}>{children}</p>
  )
}

/**
 * @param {number}   dias        1..30, el que está elegido
 * @param {number}   visual      el mismo, pero interpolado durante la animación
 * @param {number}   monto       lo que suman esos días (ya con el tope del saldo)
 * @param {string}   moneda
 * @param {function} onDias      (n) => void
 * @param {array}    atajos      [{ id, texto, monto, tono }] — mora / al día
 * @param {function} onAtajo
 * @param {array}    cuotas      [{ id, rotulo, monto, vencida, globo }]
 * @param {function} onCuota
 * @param {string}   pais
 */
export default function AbonoPorDias({
  dias = 1, visual = 1, monto = 0, moneda = '$', onDias,
  atajos = [], onAtajo,
  cuotas = [], onCuota,
  pais = 'CO',
}) {
  // 1..30 sobre el ancho: 29 tramos, no 30. Con 30 el tope nunca llega al final.
  const pct = ((visual - 1) / 29) * 100
  const enMarca = SNAPS.some((s) => s.dias === dias)
  const marca = SNAPS.find((s) => s.dias === dias)

  return (
    <>
      {/* ── LA CIFRA, ARRIBA Y GRANDE ──
          El deslizador es el mando, pero la respuesta es el dinero: es lo que
          se le dice al cliente en voz alta. Va donde el ojo cae primero. */}
      <div style={{
        flex: 'none', background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
        border: `1.5px solid ${ORO}`, boxShadow: '0 0 0 3px rgba(231,164,0,.13)',
        padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        <Rotulo>{dias} {dias === 1 ? 'día' : 'días'} de cuota</Rotulo>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 23, fontWeight: 600, color: 'var(--cf-ink-3)', flex: 'none' }}>
            {moneda}
          </span>
          <span className="cf-num" style={{
            fontSize: 34, fontWeight: 700, color: 'var(--cf-ink)', lineHeight: 1.05,
            letterSpacing: '-.02em', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {formatMoney(Math.round(monto), pais).replace(/^[^\d-]+/, '')}
          </span>
          {marca && (
            <span style={{
              flex: 'none', fontSize: 11.5, fontWeight: 700, color: 'var(--cf-gold-dark)',
            }}>{marca.texto}</span>
          )}
        </div>
      </div>

      {/* ── EL DESLIZADOR ──
          El `input` nativo va encima, invisible: se queda con el arrastre y con
          el teclado (flechas), que es accesibilidad que un div no da. Debajo se
          pinta el riel de verdad, que es lo que se ve. */}
      <div style={{ flex: 'none' }}>
        <div style={{ position: 'relative', height: 26, display: 'flex', alignItems: 'center', userSelect: 'none' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 999, background: 'var(--cf-fill)' }} />
          <div style={{
            position: 'absolute', left: 0, height: 8, width: `${pct}%`, borderRadius: 999,
            background: 'linear-gradient(to right, color-mix(in srgb, var(--cf-green-dark) 85%, black), var(--cf-green-dark))',
          }} />
          <div style={{
            position: 'absolute', left: `calc(${pct}% - 11px)`, width: 22, height: 22,
            borderRadius: 999, pointerEvents: 'none', background: 'var(--cf-green-dark)',
            border: '3px solid var(--cf-card)', boxShadow: '0 1px 4px rgba(20,20,28,.30)',
          }} />
          <input
            type="range"
            min={1}
            max={30}
            value={dias}
            onChange={(e) => onDias?.(Number(e.target.value))}
            aria-label="Días de cuota a abonar"
            style={{ position: 'absolute', inset: 0, width: '100%', height: 26, opacity: 0, cursor: 'pointer', margin: 0 }}
          />
        </div>

        {/* Las marcas. Son botones, no adornos: llegar a «1 mes» arrastrando en
            un móvil con una mano cuesta, y de un toque no. */}
        <div style={{ position: 'relative', height: 24, marginTop: 2 }}>
          <span style={{ position: 'absolute', left: 0, fontSize: 10.5, color: 'var(--cf-ink-3)' }}>1</span>
          {SNAPS.map((s) => (
            <button
              key={s.dias}
              type="button"
              onClick={() => onDias?.(s.dias)}
              style={{
                position: 'absolute', left: `${((s.dias - 1) / 29) * 100}%`,
                transform: s.dias === 30 ? 'translateX(-100%)' : 'translateX(-50%)',
                background: 'none', border: 0, padding: '2px 4px', cursor: 'pointer', font: 'inherit',
                fontSize: 10.5, fontWeight: dias === s.dias ? 700 : 500,
                color: dias === s.dias ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)',
              }}
            >{s.dias}</button>
          ))}
        </div>
        {!enMarca && (
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--cf-ink-3)' }}>
            Arrastra, o toca 7, 15 o 30.
          </p>
        )}
      </div>

      {/* ── ATAJOS: MORA Y PONERSE AL DÍA ──
          Son las dos cifras que el cobrador NO tiene que calcular de cabeza. */}
      {atajos.length > 0 && (
        <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
          {atajos.map((a) => {
            const rojo = a.tono === 'mora'
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onAtajo?.(a)}
                style={{
                  height: 46, borderRadius: 14, cursor: 'pointer', font: 'inherit',
                  fontSize: 13.5, fontWeight: 700, display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between', padding: '0 15px',
                  background: rojo
                    ? 'color-mix(in srgb, var(--cf-red-dark) 8%, var(--cf-card))'
                    : 'var(--cf-gold-tint)',
                  border: `1px solid color-mix(in srgb, ${rojo ? 'var(--cf-red-dark)' : ORO} 30%, transparent)`,
                  color: rojo ? 'var(--cf-red-dark)' : 'var(--cf-gold-dark)',
                }}
              >
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.texto}</span>
                <span className="cf-num" style={{ flex: 'none', marginLeft: 10 }}>{formatMoney(Math.round(a.monto), pais)}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── PRÓXIMAS CUOTAS PENDIENTES ──
          Solo en los modos con tabla de amortización. Pulsando una se pone su
          faltante exacto, que no siempre es un número redondo de días. */}
      {cuotas.length > 0 && (
        <div style={{
          flex: 'none', borderRadius: 'var(--cf-r-card)', border: '1px solid var(--cf-border)',
          background: 'var(--cf-surface)', padding: '11px 13px',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          <Rotulo>Próximas cuotas pendientes</Rotulo>
          {cuotas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onCuota?.(c)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                background: 'none', border: 0, padding: '6px 2px', cursor: 'pointer',
                font: 'inherit', textAlign: 'left', width: '100%',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{
                  fontSize: 11.5, fontWeight: 600,
                  color: c.vencida ? 'var(--cf-red-dark)' : 'var(--cf-ink-2)',
                }}>{c.rotulo}</span>
                {c.globo && <Pastilla>Globo</Pastilla>}
                {c.vencida && <Pastilla>Vencida</Pastilla>}
              </span>
              <span className="cf-num" style={{ flex: 'none', fontSize: 12.5, fontWeight: 700, color: 'var(--cf-gold-dark)' }}>
                {formatMoney(Math.round(c.monto), pais)}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

function Pastilla({ children }) {
  return (
    <span style={{
      flex: 'none', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 999,
      background: 'color-mix(in srgb, var(--cf-red-dark) 12%, transparent)',
      color: 'var(--cf-red-dark)',
    }}>{children}</span>
  )
}
