'use client'

// components/armazon/FranjaAviso.jsx — el aviso que vive en el armazón.
//
// UNA LÍNEA DE 40px, NUNCA UNA TARJETA. Los avisos anteriores eran bloques de
// 90-120px con círculo de icono, dos líneas de texto y un botón dorado. Cuando
// coinciden dos —y coinciden— se comen un tercio del teléfono antes de que la
// pantalla empiece.
//
// Y ninguno puede llevar el dorado del botón primario: la acción principal de
// la pantalla es la de la pantalla, no la del aviso. Aquí la acción es texto.
//
// El aviso dice el HECHO. Si hay algo que hacer, se hace en su sitio.

export default function FranjaAviso({ icono, children, accion, onAccion, tono = 'ambar' }) {
  const c = tono === 'rojo'
    ? { fondo: 'var(--cf-red-bg)', borde: 'var(--cf-red-border)', texto: 'var(--cf-red-darker)', fuerte: 'var(--cf-red-dark)' }
    : { fondo: 'var(--cf-gold-tint)', borde: 'var(--cf-gold-border)', texto: 'var(--cf-gold-text)', fuerte: 'var(--cf-gold-dark)' }

  const contenido = (
    <>
      {icono && (
        <span style={{ flex: 'none', display: 'inline-flex', color: c.fuerte }} aria-hidden>
          {icono}
        </span>
      )}
      <span style={{
        flex: 1, minWidth: 0, fontSize: 12.5, color: c.texto, lineHeight: 1.35,
        // Una sola línea: si el aviso necesita dos, no es un aviso, es una
        // pantalla.
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{children}</span>
      {accion && (
        <span style={{ flex: 'none', fontSize: 12.5, fontWeight: 700, color: c.fuerte }}>
          {accion}
        </span>
      )}
    </>
  )

  const estilo = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%', flex: 'none',
    minHeight: 40, padding: '0 var(--cf-pad-screen)', textAlign: 'left',
    background: c.fondo, borderBottom: `1px solid ${c.borde}`, border: 0,
  }

  if (!onAccion) return <div style={estilo}>{contenido}</div>

  return (
    <button type="button" onClick={onAccion} style={{ ...estilo, cursor: 'pointer' }}>
      {contenido}
    </button>
  )
}
