'use client'

// components/cf/primitivos.jsx — Las piezas base del rediseño 2026.
// Recetas de docs/design_handoff/03-COMPONENTES.md.
//
// REGLAS QUE ATRAVIESAN TODO ESTE ARCHIVO:
//
//  · La tarjeta estándar NO lleva sombra. La separación la da el borde de 1px
//    sobre el fondo hueso. Solo lleva sombra lo que de verdad flota.
//  · El estado va en un riel, una pastilla o una barra — NUNCA tiñendo el fondo
//    de la tarjeta. Ese era el defecto principal del diseño anterior.
//  · Toda barra de progreso lleva `flex:none`. Una barra como único hijo
//    encogible de un contenedor fijo absorbe el déficit y colapsa a 0px, y con
//    ella desaparece el estado de la fila.
//  · Todo número lleva cifras tabulares (clase .cf-num o .cf-fig).

/* ══ 1 · Tarjeta estándar ══ */
export function Tarjeta({ children, style, plana = false, ...props }) {
  return (
    <div {...props} style={{
      background: 'var(--cf-card)',
      border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)',
      padding: plana ? 0 : '16px 19px',
      // Una tarjeta plana ES una lista de filas, y esas filas ya se separan con
      // su propia linea de 1px. El hueco de 12px encima de la linea hace que la
      // fila mida 68px cuando la receta pide 56.
      display: 'flex', flexDirection: 'column', gap: plana ? 0 : 12,
      flex: 'none',
      ...style,
    }}>{children}</div>
  )
}

/** Sub-fila dentro de una tarjeta. La primera no lleva borde superior. */
export function FilaTarjeta({ children, primera = false, style, ...props }) {
  return (
    <div {...props} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      minHeight: 46, padding: '12px 19px',
      borderTop: primera ? 'none' : '1px solid var(--cf-hairline)',
      flex: 'none',
      ...style,
    }}>{children}</div>
  )
}

/* ══ 2 · Bloque oscuro — "la respuesta" ══
   Máximo UNO por pantalla: es la cifra que responde por qué el usuario la abrió. */
export function BloqueOscuro({ etiqueta, cifra, unidad, tono = 'neutro', children, style }) {
  const color = tono === 'ganancia' ? 'var(--cf-gold-light, #F5B824)'
              : tono === 'favor'    ? '#2FBE6A'
              : '#F3F3F6'
  return (
    <div style={{
      background: '#15161A',
      borderRadius: 'var(--cf-r-hero)',
      padding: '19px 21px',
      display: 'flex', flexDirection: 'column', gap: 14,
      flex: 'none',
      ...style,
    }}>
      {etiqueta && (
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#A3A8B2' }}>
          {etiqueta}
        </span>
      )}
      {cifra != null && (
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: -4 }}>
          <span className="cf-fig" style={{ fontSize: 34, letterSpacing: '-.035em', color }}>
            {cifra}
          </span>
          {/* "7,8%" a secas no dice nada: 7,8% de que periodo. Toda cifra
              derivada tiene que decir de que se deriva. */}
          {unidad && (
            <span style={{ fontSize: 14, fontWeight: 600, color: '#A3A8B2', flex: 'none' }}>
              {unidad}
            </span>
          )}
        </span>
      )}
      {children}
    </div>
  )
}

/** Tira de cifras del bloque oscuro. Máximo 4 columnas en móvil. */
export function TiraCifras({ columnas = [], sobreOscuro = false }) {
  const sep = sobreOscuro ? 'rgba(255,255,255,.09)' : 'var(--cf-divider)'
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
      {columnas.map((c, i) => (
        <div key={i} style={{ display: 'contents' }}>
          {i > 0 && <span style={{ width: 1, background: sep, flex: 'none' }} />}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
              color: sobreOscuro ? '#8A8E98' : 'var(--cf-ink-3)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{c.etiqueta}</span>
            <span className="cf-fig" style={{
              fontSize: sobreOscuro ? 16 : 15,
              color: c.tono === 'favor'  ? (sobreOscuro ? '#2FBE6A' : 'var(--cf-green-dark)')
                   : c.tono === 'contra' ? (sobreOscuro ? '#F0575C' : 'var(--cf-red-dark)')
                   : c.tono === 'oro'    ? (sobreOscuro ? '#F5B824' : 'var(--cf-gold-dark)')
                   : (sobreOscuro ? '#F3F3F6' : 'var(--cf-ink)'),
            }}>{c.valor}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** "Antes → después" — obligatorio en TODO modal que cambie plata. */
export function AntesDespues({ etiqueta = 'Antes → después', concepto, antes, despues, tono = 'neutro', resumen }) {
  const colorDespues = tono === 'mejora' ? '#2FBE6A' : tono === 'empeora' ? '#F0575C' : '#F3F3F6'
  return (
    <div style={{ background: '#15161A', borderRadius: 'var(--cf-r-hero)', padding: '19px 21px', display: 'flex', flexDirection: 'column', gap: 14, flex: 'none' }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#A3A8B2' }}>{etiqueta}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 11, color: '#8A8E98' }}>{concepto}</span>
          <span className="cf-fig" style={{ fontSize: 17, color: '#8A8E98', textDecoration: 'line-through' }}>{antes}</span>
        </div>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5B824" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
          <path d="M5 12h14M14 7l5 5-5 5" />
        </svg>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
          <span style={{ fontSize: 11, color: '#8A8E98' }}>ahora</span>
          <span className="cf-fig" style={{ fontSize: 21, color: colorDespues }}>{despues}</span>
        </div>
      </div>
      {/* Un cambio de plata casi nunca mueve UNA sola cifra: subir la cuota
          mueve tambien el saldo, estirar el plazo mueve la fecha de fin. Las
          consecuencias que no caben en el "antes -> despues" van aqui, y van
          TODAS: la que se omite es justo la que sorprende al confirmar. */}
      {resumen && (
        <>
          <span style={{ height: 1, background: 'rgba(255,255,255,.09)' }} />
          {(Array.isArray(resumen) ? resumen : [resumen]).map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 12, color: '#A3A8B2', flex: 1, minWidth: 0 }}>{r.etiqueta}</span>
              <span className="cf-fig" style={{
                fontSize: 14, flex: 'none',
                color: r.tono === 'favor' ? '#2FBE6A' : r.tono === 'contra' ? '#F0575C' : '#F3F3F6',
              }}>{r.valor}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

/* ══ 4 · Pastilla de estado ══ */
const PASTILLAS = {
  mora:      { bg: 'var(--cf-red-pill-bg)',   bd: 'var(--cf-red-pill-border)',   fg: 'var(--cf-red-dark)' },
  atraso:    { bg: 'var(--cf-gold-bg)',       bd: 'var(--cf-gold-border)',       fg: 'var(--cf-gold-text-2)' },
  aldia:     { bg: 'var(--cf-green-pill-bg)', bd: 'var(--cf-green-pill-border)', fg: 'var(--cf-green-dark)' },
  neutro:    { bg: 'var(--cf-fill)',          bd: 'var(--cf-border)',            fg: 'var(--cf-ink-3)' },
  destacado: { bg: 'var(--cf-gold)',          bd: 'transparent',                 fg: 'var(--cf-gold-ink)' },
}

export function Pastilla({ children, tono = 'neutro', numerica = false, style }) {
  const c = PASTILLAS[tono] || PASTILLAS.neutro
  return (
    <span className={numerica ? 'cf-num' : undefined} style={{
      display: 'inline-flex', alignItems: 'center',
      height: 22, padding: '0 9px', borderRadius: 'var(--cf-r-pill)',
      background: c.bg, border: `1px solid ${c.bd}`, color: c.fg,
      fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap', flex: 'none',
      ...style,
    }}>{children}</span>
  )
}

/* ══ 5 · Botones ══ */
const BOTON_BASE = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  borderRadius: 'var(--cf-r-control)', cursor: 'pointer', width: '100%',
  fontFamily: 'var(--font-manrope), system-ui',
}

/** UNO SOLO por pantalla. Su texto dice la acción con su cifra: "Aplicar $15.000". */
export function BotonPrimario({ children, style, ...props }) {
  return (
    <button type="button" {...props} style={{
      ...BOTON_BASE,
      height: 'var(--cf-h-btn)', border: 0,
      background: 'var(--cf-gold)',
      color: 'var(--cf-gold-ink)',   /* NUNCA blanco sobre dorado */
      fontSize: 16.5, fontWeight: 700,
      ...style,
    }}>{children}</button>
  )
}

export function BotonSecundario({ children, cancelar = false, style, ...props }) {
  return (
    <button type="button" {...props} style={{
      ...BOTON_BASE,
      height: 'var(--cf-h-btn-2)',
      background: 'var(--cf-card)',
      border: '1px solid var(--cf-border-strong)',
      color: cancelar ? 'var(--cf-ink-2)' : 'var(--cf-ink)',
      fontSize: 14.5, fontWeight: 600,
      ...style,
    }}>{children}</button>
  )
}

/** Destructivo: NUNCA relleno. En una pantalla destructiva el dorado va en la
    acción NO destructiva ("seguir cobrando") y esto queda en contorno rojo. */
export function BotonDestructivo({ children, style, ...props }) {
  return (
    <button type="button" {...props} style={{
      ...BOTON_BASE,
      height: 'var(--cf-h-btn-2)',
      background: 'var(--cf-card)',
      border: '1px solid rgba(229,72,77,.32)',
      color: 'var(--cf-red-dark)',
      fontSize: 14.5, fontWeight: 700,
      ...style,
    }}>{children}</button>
  )
}

export function BotonTexto({ children, style, ...props }) {
  return (
    <button type="button" {...props} style={{
      background: 'none', border: 0, padding: 0, cursor: 'pointer',
      fontSize: 13, fontWeight: 700, color: 'var(--cf-gold-dark)',
      fontFamily: 'var(--font-manrope), system-ui',
      ...style,
    }}>{children}</button>
  )
}

/** Barra de acción inferior. Ocupa el sitio de la pastilla cuando no está.
    El 22 inferior es el área del indicador del teléfono. */
export function BarraAccion({ children, style }) {
  return (
    <div style={{
      background: 'var(--cf-card)',
      borderTop: '1px solid rgba(20,20,28,.09)',
      padding: '14px 20px 22px',
      display: 'flex', gap: 10, flex: 'none',
      ...style,
    }}>{children}</div>
  )
}

/* ══ 6 · Campos ══ */
export function Campo({ foco = false, style, ...props }) {
  return (
    <input {...props} style={{
      height: 'var(--cf-h-field)', padding: '0 17px', width: '100%',
      background: 'var(--cf-card)',
      border: foco ? '1.5px solid var(--cf-gold)' : '1px solid rgba(20,20,28,.10)',
      boxShadow: foco ? '0 0 0 3px var(--cf-gold-focus)' : 'none',
      borderRadius: 'var(--cf-r-control)',
      fontSize: 16.5, fontWeight: 600, color: 'var(--cf-ink)',
      fontFamily: 'var(--font-manrope), system-ui',
      outline: 'none',
      ...style,
    }} />
  )
}

/** Etiqueta de campo. Escrita como PREGUNTA en el idioma del usuario:
    "Cuánto le vas a prestar", no "Monto del préstamo". */
export function EtiquetaCampo({ children, style }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
      color: 'var(--cf-ink-3)', ...style,
    }}>{children}</span>
  )
}

/** Dice la CONSECUENCIA, no repite la etiqueta. */
export function AyudaCampo({ children }) {
  return <span style={{ fontSize: 12, color: 'var(--cf-ink-3)', lineHeight: 1.45 }}>{children}</span>
}

/* ══ 9 · Barras ══ */
export function BarraProgreso({ porcentaje = 0, tono = 'oro', alto = 5, style }) {
  const color = tono === 'ok' ? 'var(--cf-green)' : tono === 'mal' ? 'var(--cf-red)' : 'var(--cf-gold)'
  return (
    <span style={{
      display: 'block', height: alto, borderRadius: 999,
      background: 'var(--cf-fill)', overflow: 'hidden',
      flex: 'none',            /* OBLIGATORIO: si es encogible, colapsa a 0 */
      ...style,
    }}>
      <span style={{
        display: 'block', height: '100%', borderRadius: 999,
        width: `${Math.max(0, Math.min(100, porcentaje))}%`,
        background: color,
      }} />
    </span>
  )
}

/* ══ 7 · Chips ══ */
export function Chip({ children, activo = false, conteo, style, ...props }) {
  return (
    <button type="button" {...props} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 'var(--cf-h-chip)', padding: '0 12px', borderRadius: 'var(--cf-r-pill)',
      /* El chip activo es NEGRO, no dorado: el dorado es para la plata. */
      background: activo ? 'var(--cf-ink)' : 'var(--cf-card)',
      border: activo ? '1px solid var(--cf-ink)' : '1px solid var(--cf-border)',
      color: activo ? 'var(--cf-surface)' : 'var(--cf-ink-2)',
      fontSize: 12, fontWeight: activo ? 700 : 600,
      cursor: 'pointer', flex: 'none', whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
      {conteo != null && <span className="cf-num" style={{ opacity: .65 }}>· {conteo}</span>}
    </button>
  )
}

/* ══ 13 · Avisos ══ */
const AVISOS = {
  ambar:  { bg: 'rgba(231,164,0,.07)',  bd: 'rgba(231,164,0,.28)',  ico: 'var(--cf-gold-dark)', fg: 'var(--cf-gold-text)' },
  rojo:   { bg: 'var(--cf-red-bg)',     bd: 'var(--cf-red-border)', ico: 'var(--cf-red)',       fg: 'var(--cf-red-darker)' },
  neutro: { bg: 'var(--cf-card)',       bd: 'var(--cf-border)',     ico: 'var(--cf-ink-3)',     fg: 'var(--cf-ink-2)' },
}

export function Aviso({ children, tono = 'neutro', style }) {
  const c = AVISOS[tono] || AVISOS.neutro
  return (
    <div style={{
      display: 'flex', gap: 11, alignItems: 'flex-start',
      background: c.bg, border: `1px solid ${c.bd}`,
      borderRadius: 'var(--cf-r-control)', padding: '14px 16px',
      flex: 'none', ...style,
    }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c.ico} strokeWidth="1.9" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }}>
        <circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" />
      </svg>
      <span style={{ fontSize: 12.5, color: c.fg, lineHeight: 1.48 }}>{children}</span>
    </div>
  )
}

/* ══ 16 · Estado vacío ══
   La moneda ES el elemento de marca. Reemplaza a la mascota anterior.
   Nunca dice "no hay datos": dice qué hacer. */
export function Moneda({ tam = 88 }) {
  return (
    <span aria-hidden style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: tam, height: tam, minWidth: tam, aspectRatio: '1',
      borderRadius: 999,
      background: 'var(--cf-gold)',
      border: `${Math.max(2, Math.round(tam / 22))}px solid var(--cf-gold-light)`,
      boxShadow: '0 10px 28px rgba(231,164,0,.32)',
      fontFamily: 'var(--font-space-grotesk), system-ui',
      fontSize: Math.round(tam * 0.45), fontWeight: 700, lineHeight: 1,
      color: 'var(--cf-gold-ink)',
    }}>$</span>
  )
}

export function EstadoVacio({ titulo, explicacion, accion, secundaria }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '38px 24px', textAlign: 'center' }}>
      <Moneda />
      <span style={{
        fontFamily: 'var(--font-space-grotesk), system-ui',
        fontSize: 27, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.2,
        color: 'var(--cf-ink)', maxWidth: '30ch',
      }}>{titulo}</span>
      {explicacion && (
        <span style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--cf-ink-2)', maxWidth: '34ch' }}>{explicacion}</span>
      )}
      {accion && <div style={{ width: '100%', maxWidth: 300, marginTop: 4 }}>{accion}</div>}
      {secundaria}
    </div>
  )
}
