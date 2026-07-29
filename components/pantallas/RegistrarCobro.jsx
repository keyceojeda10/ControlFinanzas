'use client'

// components/pantallas/RegistrarCobro.jsx — turno 2 · 04. La pantalla más usada
// del sistema, y la única que se opera de pie, con una mano y sol de frente.
//
// SIN ARMAZÓN. Ni logo, ni buscar, ni campana, ni pastilla: la cabecera se
// reduce a CERRAR + DÓNDE VAS DEL RECORRIDO. Con el teclado abierto quedan
// 320px útiles, así que cada elemento del armazón le quita una decisión al
// cobrador.
//
// Y hay un motivo más fuerte que el espacio: SALIRSE A MEDIAS PIERDE EL COBRO.
// Una barra con cinco destinos, en la puerta de un cliente y con una mano
// ocupada, es una trampa. La única salida es cerrar, arriba a la izquierda,
// LEJOS DEL PULGAR.

import { AntesDespues, BotonPrimario, Chip } from '@/components/cf/primitivos'

function Grupo({ etiqueta, opciones = [], activo, onElegir }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 'none' }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
        {etiqueta}
      </span>
      <div style={{ display: 'flex', gap: 'var(--cf-gap-chips)', flexWrap: 'wrap' }}>
        {opciones.map((o) => (
          <Chip key={o} activo={o === activo} onClick={() => onElegir?.(o)}>{o}</Chip>
        ))}
      </div>
    </div>
  )
}

export default function RegistrarCobro({
  nombre, iniciales, contexto,
  monto = '27.500', tipo = 'Cuota completa', medio = 'Efectivo',
  debeAntes, debeDespues,
  onTipo, onMedio, onCobrar,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '12px var(--cf-pad-screen) 16px' }}>

        {/* A quién le estás cobrando. Va arriba y sin adornos: el cobrador tiene
            al cliente delante y solo necesita confirmar que es el correcto. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 44, minWidth: 44, height: 44, aspectRatio: '1', borderRadius: 999, flex: 'none',
            background: 'var(--cf-fill)', fontSize: 15, fontWeight: 700, color: 'var(--cf-ink-2)',
          }}>{iniciales}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              display: 'block', fontSize: 17, fontWeight: 700, letterSpacing: '-.015em', color: 'var(--cf-ink)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{nombre}</span>
            <span className="cf-num" style={{
              display: 'block', fontSize: 12, color: 'var(--cf-ink-3)', marginTop: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{contexto}</span>
          </span>
        </div>

        {/* El campo del monto es el objeto de la pantalla, así que es lo más
            grande que hay. El "$" va dentro y fijo: escribirlo es un toque más
            en una mano ocupada. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 'none' }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
            Cuánto te dio
          </span>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8, flex: 'none',
            height: 68, padding: '0 18px', borderRadius: 'var(--cf-r-control)',
            background: 'var(--cf-card)', border: '2px solid var(--cf-gold)',
            boxShadow: 'var(--cf-sh-card)',
          }}>
            <span className="cf-fig" style={{ fontSize: 26, color: 'var(--cf-ink-3)', flex: 'none' }}>$</span>
            <input
              defaultValue={monto}
              // type="text" + inputMode: type="number" rechaza el separador que
              // no coincide con el locale del teléfono.
              type="text" inputMode="decimal"
              style={{
                flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'none',
                fontFamily: 'var(--font-space-grotesk), system-ui',
                fontVariantNumeric: 'tabular-nums lining-nums',
                fontSize: 30, fontWeight: 600, letterSpacing: '-.03em', color: 'var(--cf-ink)',
              }}
            />
          </label>
        </div>

        {/* "No pagó" es una respuesta legítima y va aquí, no escondida: si no
            cabe en esta pantalla, el cobrador se salta al cliente y el dato se
            pierde para siempre. */}
        <Grupo etiqueta="Qué pasó" activo={tipo} onElegir={onTipo}
          opciones={['Cuota completa', 'Solo un abono', 'No pagó']} />

        <Grupo etiqueta="Cómo te pagó" activo={medio} onElegir={onMedio}
          opciones={['Efectivo', 'Nequi', 'Transfer']} />

        <AntesDespues concepto="Debe" antes={debeAntes} despues={debeDespues} />
      </div>

      {/* Un solo botón, y dice las DOS cosas que hace. "Guardar" dejaría al
          cobrador preguntándose si tiene que volver a la lista él mismo. */}
      <div style={{
        flex: 'none', padding: '14px 20px 22px',
        background: 'var(--cf-card)', borderTop: '1px solid var(--cf-border)',
      }}>
        <BotonPrimario onClick={onCobrar}>Cobrar y pasar al siguiente</BotonPrimario>
      </div>
    </div>
  )
}
