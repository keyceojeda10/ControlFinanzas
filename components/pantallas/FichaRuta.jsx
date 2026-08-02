'use client'

// components/pantallas/FichaRuta.jsx — turno 24 · 03.
//
// UNA RUTA NO ES SOLO UN RECORRIDO: ES PLATA PUESTA EN UN BARRIO.
//
// Esta pantalla la trata como una inversión — cuánto hay dentro, cuánto entró y
// salió este mes, y si la ruta creció o se encogió. La comparación entre rutas
// es la que informa la decisión real del dueño: dónde poner la plata que tiene
// quieta.
//
// OJO CON EL SIGNO. "Entró $2.840.000 · saliste a prestar $3.100.000 · la ruta
// creció +$260.000": salir a prestar NO es una pérdida, es plata que cambió de
// sitio. Si la resta se hiciera al revés, la ruta que más trabaja sería la que
// se ve peor.

import { Tarjeta, BloqueOscuro, TiraCifras, BarraProgreso, Aviso, BarraAccion, BotonPrimario } from '@/components/cf/primitivos'

function LineaMes({ concepto, valor, signo, primera }) {
  const color = signo === '+' ? 'var(--cf-green-dark)'
              : signo === '−' ? 'var(--cf-ink)'
              : 'var(--cf-ink)'
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 12, flex: 'none',
      minHeight: 38, padding: '8px 0',
      borderTop: primera ? 0 : '1px solid var(--cf-hairline)',
    }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--cf-ink-2)' }}>{concepto}</span>
      <span className="cf-num" style={{ fontSize: 15, fontWeight: 600, color, flex: 'none' }}>{valor}</span>
    </div>
  )
}

export default function FichaRuta({
  puesto, prestado, porGanar, rinde,
  entro, salioAPrestar, crecio, crecioFavor = true,
  comparacion = [], nombreRuta,
  lectura, totalPrestamos, onVerPrestamos,
  // «El relleno lateral lo pone el armazón, el componente NO». Dentro de una
  // HojaInferior, que ya trae el suyo, esto sumaba 40px por lado. Es el sexto
  // sitio donde aparece el mismo defecto, y por eso hay una prueba que lo caza
  // antes de que se vea.
  sinMargen = false,
}) {
  // SCROLLEA EL DOCUMENTO, NO ESTA PANTALLA. Llevaba `height: 100%` fuera y
  // `flex:1 + minHeight:0 + overflowY:auto` dentro, así que terminaba donde
  // termina la ventana: el hueco de 112px que el armazón reserva para la
  // pastilla se pinta DESPUÉS de `{children}` —fuera de esta caja— y no
  // llegaba nunca. La pastilla tapaba el último renglón.
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: sinMargen ? '8px 0 16px' : '8px var(--cf-pad-screen) 16px' }}>

        <BloqueOscuro etiqueta="Tienes puesto en esta ruta" cifra={puesto}>
          <span style={{ height: 1, background: 'rgba(255,255,255,.09)' }} />
          <TiraCifras sobreOscuro columnas={[
            { etiqueta: 'Prestado',  valor: prestado },
            { etiqueta: 'Por ganar', valor: porGanar },
            { etiqueta: 'Rinde',     valor: rinde, tono: 'favor' },
          ]} />
        </BloqueOscuro>

        <Tarjeta>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
            Este mes en la ruta
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <LineaMes concepto="Entró" valor={entro} primera />
            {/* Sin signo negativo: salir a prestar no resta patrimonio, cambia
                la plata de sitio. Pintarlo como gasto es la resta que miente. */}
            <LineaMes concepto="Saliste a prestar" valor={salioAPrestar} />
          </div>
          <span style={{ height: 1, background: 'var(--cf-hairline)' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--cf-ink)' }}>
              La ruta {crecioFavor ? 'creció' : 'se encogió'}
            </span>
            <span className="cf-fig" style={{
              fontSize: 17, flex: 'none',
              color: crecioFavor ? 'var(--cf-green-dark)' : 'var(--cf-ink)',
            }}>{crecio}</span>
          </div>
        </Tarjeta>

        {/* La comparación es lo que informa la decisión: dónde poner la plata
            quieta. Por eso van las otras rutas y no solo esta. */}
        <Tarjeta>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
            Cómo va comparada
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comparacion.map((r) => {
              const esta = r.nombre === nombreRuta
              return (
                <div key={r.nombre} style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 13, color: esta ? 'var(--cf-ink)' : 'var(--cf-ink-2)',
                      fontWeight: esta ? 700 : 400,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{r.nombre}</span>
                    <span className="cf-num" style={{
                      fontSize: 13, fontWeight: esta ? 700 : 600, flex: 'none',
                      color: esta ? 'var(--cf-ink)' : 'var(--cf-ink-3)',
                    }}>{r.porcentaje}%</span>
                  </div>
                  <BarraProgreso porcentaje={r.porcentaje} alto={6}
                    tono={r.porcentaje >= 70 ? 'ok' : r.porcentaje >= 50 ? 'oro' : 'mal'} />
                </div>
              )
            })}
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--cf-ink-3)' }}>
            Cumplimiento de las cuotas del mes.
          </span>
        </Tarjeta>

        {/* La conclusión escrita, como en "Cómo paga": los números solos no
            dicen qué hacer con ellos. */}
        {lectura && <Aviso tono="ambar">{lectura}</Aviso>}
      </div>

      <BarraAccion>
        <BotonPrimario onClick={onVerPrestamos}>Ver los {totalPrestamos} préstamos</BotonPrimario>
      </BarraAccion>
    </div>
  )
}
