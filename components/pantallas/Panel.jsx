'use client'

// components/pantallas/Panel.jsx — El panel del dueño. Turno 2 del handoff.
//
// LA RESPUESTA DE ESTA PANTALLA ES EL DÍA. Va en el bloque oscuro; el
// patrimonio baja a la banda de debajo.
//
// Es lo contrario de lo que dibujé primero, y el motivo es que EL PATRIMONIO NO
// TRAE NOTICIAS: es el mismo número que ayer y que anteayer. Si lo primero que
// se ve cada mañana es una cifra que no se ha movido, la pantalla enseña que no
// tiene nada que contar, y en dos semanas se deja de mirar. Del día, en cambio,
// se puede hacer algo: si a las 3 de la tarde una ruta lleva el 20% de lo que
// debería, se llama al cobrador y se salva el día.
//
// Y el bloque SE VOLTEA CON LA HORA. A las 7 de la mañana un «recaudado hoy
// $0» es inútil y hasta angustioso, así que hasta que entra el primer pago el
// titular mira hacia adelante —lo que hay por cobrar— y en cuanto entra plata
// pasa a decir cuánto llevas de esa meta.
//
// "Toda tu plata" = caja + calle. NO es `cobrado − prestado − gastos`: esa resta
// da rojo en un negocio sano, porque prestar no es una pérdida. Si una fórmula
// puede dar rojo en un caso bueno, la fórmula está mal.
//
// Presentacional a propósito: recibe todo por props. Así se puede ver y ajustar
// contra el mockup sin depender de la base de datos.

import { Tarjeta, BloqueOscuro, TiraCifras, BarraProgreso, BotonTexto, Pastilla } from '@/components/cf/primitivos'

/* El histórico de siete días. Es lo que hacía útil el panel viejo: una cifra
   sola no dice si hoy es bueno o malo, y la semana al lado sí. Va pequeño y al
   pie del bloque — es contexto, no el titular. */
function Historico({ datos = [], sobreOscuro = true }) {
  const max = Math.max(...datos, 1)
  const ALTO = 30
  const tenue = sobreOscuro ? 'rgba(255,255,255,.22)' : 'var(--cf-border)'
  const vivo  = sobreOscuro ? 'rgba(255,255,255,.85)' : 'var(--cf-ink)'
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 5, height: ALTO, flex: 'none' }}
      aria-label="Lo recaudado en los últimos siete días">
      {datos.map((v, i) => (
        <span key={i} style={{
          flex: 1, minWidth: 0, maxWidth: 18, borderRadius: 3,
          // Mínimo 2px: una barra de altura cero desaparece y el día parece
          // que no existió, cuando lo cierto es que no entró nada.
          height: Math.max(2, Math.round((v / max) * ALTO)),
          background: i === datos.length - 1 ? vivo : tenue,
        }} />
      ))}
    </div>
  )
}

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

      {/* ── LA RESPUESTA: EL DÍA ──
          Aquí vive TODO lo que traía el panel viejo, que era bastante útil: lo
          cobrado, lo esperado, la ganancia, cuántos pagos, el histórico de la
          semana y la frase que interpreta el día. No se sustituye por menos —
          se muda al lenguaje nuevo. */}
      <BloqueOscuro
        etiqueta={nadaCobrado ? 'Hoy toca cobrar' : 'Recaudado hoy'}
        cifra={nadaCobrado ? (hoy.esperado ?? '—') : hoy.recaudado}
      >
        <TiraCifras sobreOscuro columnas={[
          nadaCobrado
            ? { etiqueta: 'Clientes', valor: String(hoy.clientes ?? 0) }
            : { etiqueta: 'De la meta', valor: hoy.esperado ?? '—' },
          {
            // La etiqueta dice QUÉ es la cifra. Poner «14 pagos» encima de
            // «$142.000» hacía leer que catorce pagos son ciento cuarenta y dos
            // mil, que es falso y además es la cifra más delicada del panel.
            etiqueta: 'Ganancia',
            // RECAUDADO NO ES GANANCIA. Cobrar $500.000 de capital propio
            // volviendo no es ganar $500.000, y mezclarlos ya infló la ganancia
            // 7,9 veces. Va al lado, con su nombre.
            valor: hoy.ganancia ?? '—',
            tono: hoy.ganancia ? 'oro' : 'neutro',
          },
          { etiqueta: 'En mora', valor: String(clientesEnMora), tono: clientesEnMora > 0 ? 'contra' : 'neutro' },
        ]} />

        {/* La frase que INTERPRETA: las cifras ya están arriba. Si no tiene
            nada que decir no se pinta — una frase de relleno todos los días
            enseña a saltársela. */}
        {hoy.narrativa && (
          <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,.78)', lineHeight: 1.4 }}>
            {hoy.narrativa}
          </span>
        )}

        {hoy.historico?.length > 0 && <Historico datos={hoy.historico} />}
      </BloqueOscuro>

      {/* El avance del día, con su salida al trabajo. */}
      {hoy.clientes > 0 && (
        <Tarjeta>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span className="cf-num" style={{ fontSize: 12.5, color: 'var(--cf-ink-2)' }}>
              {hoy.pagos > 0
                ? `${hoy.pagos} de ${hoy.clientes} cobrados`
                : `${hoy.clientes} cliente${hoy.clientes === 1 ? '' : 's'} por cobrar hoy`}
            </span>
            {nadaCobrado
              ? <Pastilla tono="neutro">sin cobrar aún</Pastilla>
              : <Pastilla tono="aldia" numerica>{hoy.porcentaje}%</Pastilla>}
          </div>

          <BarraProgreso porcentaje={hoy.porcentaje} tono={hoy.porcentaje >= 60 ? 'ok' : 'oro'} alto={8} />

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <BotonTexto onClick={onVerCobros}>Ver los {hoy.clientes} cobros →</BotonTexto>
          </div>
        </Tarjeta>
      )}

      {/* ── EL PATRIMONIO, DEBAJO ──
          No es el titular porque no cambia de un día para otro, pero sigue
          siendo lo que dice si el negocio crece. Aquí una referencia estable se
          consulta sin estorbar.

          Solo owner: al cobrador el servidor le manda `finanzas: null`, y un 0
          le enseñaría un negocio quebrado. */}
      {patrimonio && (
        <Tarjeta>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
              Toda tu plata
            </span>
            <span className="cf-fig" style={{ fontSize: 21, fontWeight: 700, color: 'var(--cf-ink)' }}>
              {patrimonio}
            </span>
          </div>
          <TiraCifras columnas={[
            { etiqueta: 'En caja',    valor: enCaja },
            { etiqueta: 'Por cobrar', valor: porCobrar, tono: 'oro' },
          ]} />
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
