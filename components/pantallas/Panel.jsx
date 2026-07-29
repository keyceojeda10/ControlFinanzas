'use client'

// components/pantallas/Panel.jsx — El panel del dueño. Turno 2 del handoff.
//
// LA RESPUESTA DE ESTA PANTALLA ES EL PATRIMONIO. Una pantalla, una cifra: la
// razón por la que el usuario la abrió va en el bloque oscuro y todo lo demás
// baja al menos dos niveles de tamaño.
//
// "Toda tu plata" = caja + calle. NO es `cobrado − prestado − gastos`: esa resta
// da rojo en un negocio sano, porque prestar no es una pérdida. Si una fórmula
// puede dar rojo en un caso bueno, la fórmula está mal.
//
// Presentacional a propósito: recibe todo por props. Así se puede ver y ajustar
// contra el mockup sin depender de la base de datos.

import { Tarjeta, BloqueOscuro, TiraCifras, BarraProgreso, BotonTexto, Pastilla } from '@/components/cf/primitivos'

/* Fila de "necesita tu atención". El punto de color dice la gravedad sin
   teñir la fila entera. */
function FilaAtencion({ tono = 'atraso', texto, accion, onAccion, primera }) {
  const color = tono === 'mora' ? 'var(--cf-red)' : tono === 'ok' ? 'var(--cf-green)' : 'var(--cf-gold)'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11,
      padding: '12px 19px', minHeight: 46, flex: 'none',
      borderTop: primera ? 'none' : '1px solid var(--cf-hairline)',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: color, flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.35 }}>{texto}</span>
      {accion && <BotonTexto onClick={onAccion} style={{ flex: 'none' }}>{accion} →</BotonTexto>}
    </div>
  )
}

export default function Panel({
  saludo = 'Buenos días',
  nombre = '',
  fecha = '',
  patrimonio,
  enCaja,
  porCobrar,
  clientesEnMora = 0,
  hoy = { clientes: 0, esperado: null, recaudado: null, porcentaje: 0 },
  atencion = [],
  onVerCobros,
}) {
  const nadaCobrado = !hoy.recaudado || hoy.porcentaje === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: '8px var(--cf-pad-screen) 0' }}>

      {/* El saludo va en el CUERPO, no en la cabecera. */}
      <div style={{ flex: 'none' }}>
        <h1 style={{
          fontFamily: 'var(--font-space-grotesk), system-ui',
          fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.2,
          color: 'var(--cf-ink)', margin: 0,
        }}>{saludo}, {nombre}</h1>
        <span className="cf-num" style={{ display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 3 }}>
          {fecha}
        </span>
      </div>

      {/* La respuesta */}
      <BloqueOscuro etiqueta="Patrimonio" cifra={patrimonio}>
        <TiraCifras sobreOscuro columnas={[
          { etiqueta: 'En caja',    valor: enCaja },
          { etiqueta: 'Por cobrar', valor: porCobrar, tono: 'oro' },
          { etiqueta: 'En mora',    valor: String(clientesEnMora), tono: clientesEnMora > 0 ? 'contra' : 'neutro' },
        ]} />
      </BloqueOscuro>

      {/* Hoy toca cobrar — la gramática de cifras del día:
          primero lo que ya entró, después lo que falta. */}
      {hoy.clientes > 0 && (
        <Tarjeta>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <span>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
                Hoy toca cobrar
              </span>
              <span className="cf-num" style={{ display: 'block', fontSize: 13, color: 'var(--cf-ink-2)', marginTop: 5 }}>
                {hoy.clientes} cliente{hoy.clientes === 1 ? '' : 's'}
                {hoy.esperado && <> · <span className="cf-fig" style={{ fontSize: 14, color: 'var(--cf-ink)' }}>{hoy.esperado}</span></>}
              </span>
            </span>
            {nadaCobrado
              ? <Pastilla tono="neutro">nada cobrado aún</Pastilla>
              : <Pastilla tono="aldia" numerica>{hoy.porcentaje}%</Pastilla>}
          </div>

          <BarraProgreso porcentaje={hoy.porcentaje} tono={hoy.porcentaje >= 60 ? 'ok' : 'oro'} alto={8} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <span className="cf-num" style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
              {hoy.recaudado ? <>Llevas <span style={{ color: 'var(--cf-green-dark)', fontWeight: 700 }}>{hoy.recaudado}</span></> : 'Todavía no has cobrado nada'}
            </span>
            <BotonTexto onClick={onVerCobros}>Ver los {hoy.clientes} cobros →</BotonTexto>
          </div>
        </Tarjeta>
      )}

      {/* Necesita tu atención */}
      {atencion.length > 0 && (
        <Tarjeta plana>
          <div style={{ padding: '14px 19px 10px', flex: 'none' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
              Necesita tu atención
            </span>
          </div>
          {atencion.map((a, i) => (
            <FilaAtencion key={i} {...a} primera={i === 0} />
          ))}
        </Tarjeta>
      )}
    </div>
  )
}
