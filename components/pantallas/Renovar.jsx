'use client'

// components/pantallas/Renovar.jsx — T05-02 renovar · T05-03 días sin cobro.
//
// ══ LO QUE SALE DEL BOLSILLO SE CALCULA, NO SE PIENSA ═══════════════════════
//
// Hoy el modal de renovar pide «total del nuevo préstamo» y lo explica con un
// ejemplo escrito: «debe $1.000.000, le prestas $1.000.000 más = total
// $2.000.000». Que haga falta el ejemplo es la señal: LA RESTA SE ESTÁ HACIENDO
// DE CABEZA, con el cliente delante y la plata en la mano.
//
// El campo sigue siendo el total —así es como lo piensa quien presta—, pero debajo
// aparece calculado LO QUE DE VERDAD SALE DEL BOLSILLO, y el botón lo repite:
// «Renovar y entregar $369.500». Si el botón dijera solo «Renovar», habría que
// mirar arriba otra vez antes de pulsar.
//
// ══ LA HERENCIA SE VUELVE VISIBLE ═══════════════════════════════════════════
//
// En días sin cobro, dejarlo vacío hereda del cliente, luego de la ruta, luego del
// negocio. Hoy eso es una frase. Aquí SE VE de dónde sale el domingo que ya
// estaba puesto — que es la única forma de entender por qué un préstamo no genera
// mora los domingos sin que nadie lo haya tocado.

import { AntesDespues } from '@/components/cf/primitivos'

const DIAS = [
  { id: 0, corto: 'Dom' },
  { id: 1, corto: 'Lun' },
  { id: 2, corto: 'Mar' },
  { id: 3, corto: 'Mié' },
  { id: 4, corto: 'Jue' },
  { id: 5, corto: 'Vie' },
  { id: 6, corto: 'Sáb' },
]

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
      textTransform: 'uppercase', color: 'var(--cf-ink-3)',
    }}>{children}</span>
  )
}

/* ══ T05-02 · Renovar ══════════════════════════════════════════════════════ */

export function Renovar({
  titulo = 'Renovar el préstamo',
  ayuda = 'Cierra el actual y abre uno nuevo',
  saldoEtiqueta = 'Saldo pendiente', saldo, saldoNota,
  totalEtiqueta = 'Total del nuevo préstamo',
  total, onTotal, simbolo = '$',
  atajos = [], onAtajo,
  incluye,
  antesDespues,
  entregaEtiqueta = 'Le entregas en efectivo', entrega,
  gananciaEtiqueta = 'Ganancia del nuevo', ganancia,
  onRenovar, renovando, nota,
  // ── LA RANURA DE LAS CONDICIONES ──
  // La lamina dibuja el DINERO: cuanto debe, cuanto sera el total y cuanto sale
  // del bolsillo. Pero renovar tambien fija tasa, plazo, frecuencia, fecha y
  // seguro, y eso ya existe y funciona. Va aqui, entre el bloque negro y el
  // boton, para que la cifra de la entrega siga siendo lo ultimo que se lee
  // antes de pulsar.
  children,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
      {/* El encabezado se pinta SOLO si alguien lo pide. Dentro del modal ahora
          lo lleva la cabecera de `Modal`, que es donde va la X: mientras el
          titulo estuvo aqui, el modal se quedaba sin cabecera y le tocaba una X
          flotante. La lamina sigue pudiendo pedirlo para verlo suelto. */}
      {(titulo || ayuda) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {titulo && <span style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
          }}>{titulo}</span>}
          {ayuda && <span style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{ayuda}</span>}
        </div>
      )}

      {/* LO QUE QUEDA DEL ACTUAL, primero. Es la cifra que el cliente ya debe y
          la que hace que el total del nuevo no sea lo que se entrega. */}
      <div style={{
        flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        borderRadius: 'var(--cf-r-card)', padding: '16px 18px',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <Rotulo>{saldoEtiqueta}</Rotulo>
        <span className="cf-fig" style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 26, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1,
          color: 'var(--cf-ink)',
        }}>{saldo}</span>
        {saldoNota && (
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{saldoNota}</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Rotulo>{totalEtiqueta}</Rotulo>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8,
          background: 'var(--cf-card)', borderRadius: 'var(--cf-r-card)',
          border: '1.5px solid var(--cf-gold)', boxShadow: '0 0 0 3px var(--cf-gold-focus)',
          padding: '16px 18px',
        }}>
          <span style={{
            fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 24, fontWeight: 600, color: 'var(--cf-ink-3)', flex: 'none',
          }}>{simbolo}</span>
          {/* `type=text` con `inputMode=decimal`: son 12 países con dos convenios
              de miles, y `type=number` rechaza el separador que no coincide. */}
          <input
            value={total ?? ''}
            onChange={(e) => onTotal?.(e.target.value)}
            type="text" inputMode="decimal"
            aria-label={totalEtiqueta}
            className="cf-fig"
            style={{
              flex: 1, minWidth: 0, border: 0, background: 'none', padding: 0,
              outline: 'none', font: 'inherit',
              fontFamily: 'var(--font-space-grotesk), system-ui',
              fontSize: 34, fontWeight: 600, letterSpacing: '-.03em', color: 'var(--cf-ink)',
            }}
          />
        </div>

        {atajos.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            {atajos.map((a) => (
              <button
                key={a.etiqueta ?? a}
                type="button"
                onClick={() => onAtajo?.(a.valor ?? a)}
                className="cf-num"
                style={{
                  flex: 1, minWidth: 0, height: 44, borderRadius: 14, cursor: 'pointer',
                  background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
                  fontFamily: 'var(--font-space-grotesk), system-ui',
                  fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)',
                }}
              >{a.etiqueta ?? a}</button>
            ))}
          </div>
        )}

        {/* Que el total INCLUYE lo que ya debe. Es la frase que evita que alguien
            escriba solo lo nuevo y le entregue de más. */}
        {incluye && (
          <span className="cf-num" style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)' }}>
            {incluye}
          </span>
        )}
      </div>

      {antesDespues && <AntesDespues {...antesDespues} />}

      {/* LO QUE SALE DEL BOLSILLO, calculado. Es lo que hoy se hace de cabeza. */}
      {entrega && (
        <div style={{
          flex: 'none', background: '#15161A', borderRadius: 'var(--cf-r-card)',
          padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 13,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                textTransform: 'uppercase', color: '#A3A8B2',
              }}>{entregaEtiqueta}</span>
              <span className="cf-fig" style={{
                fontFamily: 'var(--font-space-grotesk), system-ui',
                fontSize: 28, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1,
                color: '#F5B824',
              }}>{entrega}</span>
            </span>
          </div>
          {ganancia && (
            <div style={{
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12,
              paddingTop: 13, borderTop: '1px solid rgba(255,255,255,.09)',
            }}>
              <span style={{ fontSize: 12, color: '#8A8E98' }}>{gananciaEtiqueta}</span>
              <span className="cf-fig" style={{
                fontFamily: 'var(--font-space-grotesk), system-ui',
                fontSize: 16, fontWeight: 600, color: '#F3F3F6', flex: 'none',
              }}>{ganancia}</span>
            </div>
          )}
        </div>
      )}

      {children}

      {/* EL BOTÓN REPITE LA CIFRA. Con un «Renovar» a secas habría que mirar
          arriba otra vez antes de pulsar, con el cliente delante. */}
      <button type="button" onClick={onRenovar} disabled={renovando} style={{
        height: 54, border: 'none', borderRadius: 14,
        background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', font: 'inherit',
        fontSize: 16, fontWeight: 700,
        cursor: renovando ? 'progress' : 'pointer', opacity: renovando ? 0.6 : 1,
      }}>
        {renovando ? 'Renovando…' : (entrega ? `Renovar y entregar ${entrega}` : 'Renovar')}
      </button>

      {nota && (
        <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)', textAlign: 'center' }}>
          {nota}
        </span>
      )}
    </div>
  )
}

/* ══ T05-03 · Días sin cobro ═══════════════════════════════════════════════
   LO QUE LA FUNCIÓN HACE Y LO QUE NO: no genera mora en los días marcados, y LA
   CUOTA, EL PLAZO Y EL VENCIMIENTO NO CAMBIAN. Eso último es lo que la gente
   supone al revés — cree que marcar el domingo alarga el préstamo.

   Y LA HERENCIA SE VE. Vacío hereda del cliente, luego de la ruta, luego del
   negocio; hoy eso es una frase y aquí es una lista con lo que cada nivel aporta.
   Es la única forma de entender por qué un préstamo ya no cobra los domingos sin
   que nadie lo haya tocado. */
export function DiasSinCobro({
  titulo = 'Días sin cobro',
  ayuda = 'No genera mora en los días que marques',
  elegidos = [], onDia,
  herenciaTitulo = 'Si lo dejas vacío',
  herenciaAyuda = 'Hereda lo que ya esté configurado, en este orden:',
  herencia = [],
  antesDespues,
  nota,
  onCancelar, onGuardar, guardando,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 20, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--cf-ink)',
        }}>{titulo}</span>
        <span style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>{ayuda}</span>
      </div>

      {/* Los siete, siempre los siete. Enseñar solo los marcados obligaría a saber
          de antemano cuáles se pueden marcar. */}
      <div style={{ display: 'flex', gap: 6 }}>
        {DIAS.map((d) => {
          const on = elegidos.includes(d.id)
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onDia?.(d.id)}
              aria-pressed={on}
              style={{
                flex: 1, minWidth: 0, height: 52, borderRadius: 13, cursor: 'pointer',
                font: 'inherit', fontSize: 13, fontWeight: on ? 700 : 600,
                background: on ? 'var(--cf-gold-tint)' : 'var(--cf-card)',
                border: on ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)',
                color: on ? 'var(--cf-gold-text)' : 'var(--cf-ink-2)',
              }}
            >{d.corto}</button>
          )
        })}
      </div>

      {/* LA HERENCIA, VISIBLE. De dónde sale el domingo que ya estaba puesto. */}
      {herencia.length > 0 && (
        <div style={{
          flex: 'none', background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-card)', padding: '15px 17px',
          display: 'flex', flexDirection: 'column', gap: 11,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Rotulo>{herenciaTitulo}</Rotulo>
            <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)' }}>
              {herenciaAyuda}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {herencia.map((h, i) => (
              <div key={h.nivel} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                {/* El número dice el ORDEN en que se busca, que es la mitad de la
                    explicación: primero el cliente, luego la ruta, luego el negocio. */}
                <span className="cf-num" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 18, height: 18, borderRadius: 999, flex: 'none',
                  background: 'var(--cf-fill)', fontSize: 10, fontWeight: 700,
                  color: 'var(--cf-ink-3)',
                }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--cf-ink)' }}>
                  {h.nivel}
                </span>
                <span className="cf-num" style={{
                  fontSize: 12, flex: 'none',
                  // El que manda hoy va en dorado: es el que explica lo que se ve.
                  color: h.manda ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)',
                  fontWeight: h.manda ? 700 : 400,
                }}>{h.valor ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {antesDespues && <AntesDespues {...antesDespues} />}

      {/* LO QUE NO CAMBIA. La gente supone lo contrario: cree que marcar el
          domingo alarga el préstamo. */}
      {nota && (
        <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>{nota}</span>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {onCancelar && (
          <button type="button" onClick={onCancelar} style={{
            flex: 1, height: 50, borderRadius: 14, cursor: 'pointer',
            background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
            font: 'inherit', fontSize: 15, fontWeight: 600, color: 'var(--cf-ink-2)',
          }}>Cancelar</button>
        )}
        <button type="button" onClick={onGuardar} disabled={guardando} style={{
          flex: 1.7, height: 50, border: 'none', borderRadius: 14,
          background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', font: 'inherit',
          fontSize: 16, fontWeight: 700,
          cursor: guardando ? 'progress' : 'pointer', opacity: guardando ? 0.6 : 1,
        }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </div>
  )
}
