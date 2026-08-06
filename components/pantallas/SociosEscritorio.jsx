'use client'

// components/pantallas/SociosEscritorio.jsx — turno 45 · 04.
//
// LA ACCIÓN PRIMARIA DEL ENCABEZADO NO ES "NUEVO SOCIO": es REPARTIR, con la
// cifra dentro. Crear socios se hace dos veces en la vida; repartir, todos los
// meses.
//
// La tabla es la que se imprime cuando hay discusión, así que sus cinco
// columnas TIENEN que cuadrar en el total.
//
// Y la tercera tarjeta de la derecha —"tu parte"— es la que faltaba del todo:
// sin ese dato el dueño no sabe si lo que va a repartir es toda su ganancia o
// una parte, y esa duda es la que hace que nadie use el módulo.

import { BotonPrimario, BotonSecundario, Aviso } from '@/components/cf/primitivos'

const COL = {
  puso: 112, leToca: 84, haGanado: 124, leHasDado: 124, leDebes: 124,
}

function Celda({ children, ancho, fuerte, oro }) {
  return (
    <span className="cf-num" style={{
      width: ancho, minWidth: ancho, flex: 'none', textAlign: 'right',
      fontSize: 13.5, fontWeight: fuerte ? 700 : 600,
      color: oro ? 'var(--cf-gold-dark)' : 'var(--cf-ink)',
    }}>{children}</span>
  )
}

function Encabezado({ children, ancho }) {
  return (
    <span style={{
      width: ancho, minWidth: ancho, flex: 'none', textAlign: 'right',
      fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase',
      color: 'var(--cf-ink-3)',
    }}>{children}</span>
  )
}

function TarjetaLateral({ titulo, nota, dorada, children }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 11, flex: 'none',
      padding: '16px 18px 18px', background: 'var(--cf-card)',
      border: dorada ? '1.5px solid var(--cf-gold)' : '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)',
      boxShadow: dorada ? '0 0 0 3px rgba(231,164,0,.13)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
          {titulo}
        </span>
        {nota && (
          <span className="cf-num" style={{ fontSize: 11.5, color: 'var(--cf-ink-3)', flex: 'none' }}>{nota}</span>
        )}
      </div>
      {children}
    </div>
  )
}

export default function SociosEscritorio({
  socios = [], totales,
  sinRepartir, desdeCuando, desglose = [],
  tuParte,
  onRepartir, onNuevo, onAbrir,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 18, padding: 'var(--cf-pad-screen-d)' }}>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flex: 'none' }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontFamily: 'var(--font-space-grotesk), system-ui',
            fontSize: 26, fontWeight: 600, letterSpacing: '-.025em', color: 'var(--cf-ink)',
          }}>Socios</span>
          <span className="cf-num" style={{ display: 'block', fontSize: 13, color: 'var(--cf-ink-3)', marginTop: 4 }}>
            {socios.length} activos · reparten por lo que pusieron
          </span>
        </span>
        {/* Repartir es lo que se hace todos los meses. Crear un socio, dos veces
            en la vida. El dorado va donde está el trabajo. */}
        <BotonSecundario style={{ width: 'auto', padding: '0 18px', flex: 'none' }} onClick={onNuevo}>
          Nuevo socio
        </BotonSecundario>
        <BotonPrimario style={{ width: 'auto', padding: '0 22px', flex: 'none' }} onClick={onRepartir}>
          Repartir {sinRepartir}
        </BotonPrimario>
      </div>

      <div style={{ display: 'flex', gap: 18, flex: 1, minHeight: 0 }}>

        <div style={{
          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          borderRadius: 'var(--cf-r-desktop)', overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, flex: 'none',
            height: 42, padding: '0 20px', background: 'var(--cf-fill)',
          }}>
            <span style={{ flex: 1.4, minWidth: 168, fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
              Socio
            </span>
            <Encabezado ancho={COL.puso}>Puso</Encabezado>
            <Encabezado ancho={COL.leToca}>Le toca</Encabezado>
            <Encabezado ancho={COL.haGanado}>Ha ganado</Encabezado>
            <Encabezado ancho={COL.leHasDado}>Le has dado</Encabezado>
            <Encabezado ancho={COL.leDebes}>Le debes</Encabezado>
          </div>

          {socios.map((s) => (
            <div key={s.nombre} onClick={() => onAbrir?.(s)} role="button" tabIndex={0} style={{
              display: 'flex', alignItems: 'center', gap: 14, flex: 'none', cursor: 'pointer',
              minHeight: 56, padding: '0 20px', borderTop: '1px solid var(--cf-hairline)',
            }}>
              <span style={{ flex: 1.4, minWidth: 168, display: 'flex', alignItems: 'center', gap: 11 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, minWidth: 32, height: 32, aspectRatio: '1', borderRadius: 999, flex: 'none',
                  background: 'var(--cf-fill)', fontSize: 11.5, fontWeight: 700, color: 'var(--cf-ink-2)',
                }}>{s.iniciales}</span>
                <span style={{
                  flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{s.nombre}</span>
              </span>
              <Celda ancho={COL.puso}>{s.puso}</Celda>
              <Celda ancho={COL.leToca}>{s.porcentaje}</Celda>
              <Celda ancho={COL.haGanado}>{s.haGanado}</Celda>
              <Celda ancho={COL.leHasDado}>{s.leHasDado}</Celda>
              <Celda ancho={COL.leDebes} oro>{s.leDebes}</Celda>
            </div>
          ))}

          {/* Con socios reales, ESTA es la tabla que se imprime cuando hay
              discusión. Si el total no cuadra, la discusión la pierde el dueño. */}
          {totales && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14, flex: 'none',
              minHeight: 50, padding: '0 20px',
              borderTop: '1px solid var(--cf-border-strong)', background: 'var(--cf-card-alt)',
            }}>
              <span style={{ flex: 1.4, minWidth: 168, fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)' }}>Total</span>
              <Celda ancho={COL.puso} fuerte>{totales.puso}</Celda>
              <Celda ancho={COL.leToca} fuerte>{totales.porcentaje}</Celda>
              <Celda ancho={COL.haGanado} fuerte>{totales.haGanado}</Celda>
              <Celda ancho={COL.leHasDado} fuerte>{totales.leHasDado}</Celda>
              <Celda ancho={COL.leDebes} fuerte oro>{totales.leDebes}</Celda>
            </div>
          )}

          <span style={{ flex: 1, minHeight: 0 }} />
        </div>

        <div style={{ width: 320, flex: 'none', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          <TarjetaLateral titulo="Ganancia sin repartir" nota={`desde el ${desdeCuando}`} dorada>
            <span className="cf-fig" style={{ fontSize: 27, letterSpacing: '-.03em', color: 'var(--cf-ink)' }}>
              {sinRepartir}
            </span>
            <span style={{ height: 1, background: 'var(--cf-hairline)' }} />
            {desglose.map((d) => (
              <div key={d.nombre} style={{ display: 'flex', alignItems: 'baseline', gap: 12, flex: 'none' }}>
                <span className="cf-num" style={{
                  flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--cf-ink-2)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{d.nombre} · {d.porcentaje}</span>
                <span className="cf-fig" style={{ fontSize: 13.5, color: 'var(--cf-ink)', flex: 'none' }}>{d.monto}</span>
              </div>
            ))}
            {/* Sin boton: el de arriba ya es la accion primaria de la pantalla,
                y dos dorados identicos a la vez rompen la regla de uno solo.
                Esta tarjeta explica de DONDE sale la cifra, que es su trabajo. */}
          </TarjetaLateral>

          {/* Dicho explícitamente porque un dueño VA A INTENTAR darle acceso, y
              si la app no lo dice, va a terminar compartiéndole su contraseña. */}
          <Aviso tono="neutro">
            <strong>Un socio no entra a la app.</strong> No tiene usuario ni contraseña: para que
            vea cómo va, mándale su cuenta desde su ficha.
          </Aviso>

          {/* LA QUE FALTABA DEL TODO. Sin este dato el dueño no sabe si lo que
              va a repartir es toda su ganancia o una parte, y esa duda es la
              que hace que nadie use el módulo. */}
          <TarjetaLateral titulo="Tu parte">
            <span style={{ fontSize: 13, color: 'var(--cf-ink)', lineHeight: 1.55 }}>
              Los socios pusieron <strong>{tuParte?.socios}</strong> de los{' '}
              <strong>{tuParte?.total}</strong> que tienes en la calle. El resto es tuyo y su
              ganancia no se reparte.
            </span>
            <span style={{ display: 'flex', height: 9, borderRadius: 999, overflow: 'hidden', flex: 'none', gap: 2 }}>
              <span style={{ width: `${tuParte?.pctSocios ?? 0}%`, background: 'var(--cf-gold)', flex: 'none' }} />
              <span style={{ flex: 1, background: 'var(--cf-ink)' }} />
            </span>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--cf-gold)', flex: 'none' }} />
                <span style={{ fontSize: 11.5, color: 'var(--cf-ink-3)' }}>de los socios</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 'none' }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--cf-ink)', flex: 'none' }} />
                <span style={{ fontSize: 11.5, color: 'var(--cf-ink-3)' }}>tuyo</span>
              </span>
            </div>
          </TarjetaLateral>
        </div>
      </div>
    </div>
  )
}
