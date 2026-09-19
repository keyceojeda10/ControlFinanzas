'use client'

/**
 * LÍNEA DE CIFRA — cómo se lee una cifra de plata en una ficha.
 *
 * El dueño, 19 sep 2026, con la pantalla de «préstamo entregado» al lado de la
 * ficha del préstamo: «números claros, conciso, grandes, con sus sumas… a
 * diferencia de lo que tenemos dentro del sistema, que se supone que está
 * descrito para entenderse y la verdad es que no se entiende muy bien».
 *
 * Lo que aquella pantalla hace y las fichas no hacían:
 *
 *   RÓTULO EN MAYÚSCULAS     ← qué es, en las palabras del prestamista
 *   $240.000    [+$40.000 de ganancia]   ← la cifra GRANDE y, en un chip, lo
 *                                           que la separa de la de arriba
 *   Debía $80.000 + $120.000 en mano     ← de dónde sale, con la cuenta a la vista
 *
 * Una cifra por renglón, una debajo de otra: en dos columnas («rótulo a la
 * izquierda, cifra a la derecha») el ojo tiene que cruzar la tarjeta para
 * casar cada número con su nombre, y con tres filas seguidas se lee una tabla,
 * no una respuesta.
 *
 * ⚠ EL COLOR DEL CHIP DICE QUÉ LE PASA A LA PLATA DEL PRESTAMISTA (DESIGN.md,
 * reglas de números · 6). «Se ahorra $100.000 de interés» es plata que el
 * dueño deja de ganar: va en `neutro`, NUNCA en verde.
 *
 * Presentacional: no calcula nada. Las cifras llegan ya formateadas.
 *
 * @param rotulo      el nombre de la cifra
 * @param cifra       la cifra, formateada
 * @param tam         26 (la principal de una tarjeta) · 19 (las demás)
 * @param tono        color de la CIFRA: neutro | favor | contra
 * @param chip        texto del chip, o nada
 * @param tonoChip    favor | neutro | contra
 * @param pie         el renglón que dice de dónde sale
 * @param sobreOscuro dentro de `BloqueOscuro`: ahí no manda el tema
 * @param onTocar     si la línea abre algo: se vuelve botón y lleva flecha
 */
export default function LineaCifra({
  rotulo, cifra, tam = 19, tono = 'neutro', chip, tonoChip = 'favor', pie,
  sobreOscuro = false, onTocar, style,
}) {
  const c = sobreOscuro
    ? { rotulo: '#A3A8B2', pie: '#8A8E98', neutro: '#F3F3F6', favor: '#2FBE6A', contra: '#F0575C' }
    : { rotulo: 'var(--cf-ink-3)', pie: 'var(--cf-ink-3)', neutro: 'var(--cf-ink)', favor: 'var(--cf-green-dark)', contra: 'var(--cf-red-dark)' }
  const chips = sobreOscuro
    ? {
        favor:  { color: '#2FBE6A', background: 'rgba(47,190,106,.16)' },
        contra: { color: '#F0575C', background: 'rgba(240,87,92,.16)' },
        neutro: { color: '#C9CCD3', background: 'rgba(255,255,255,.09)' },
      }
    : {
        favor:  { color: 'var(--cf-green-dark)', background: 'var(--cf-green-pill-bg)' },
        contra: { color: 'var(--cf-red-dark)', background: 'var(--cf-red-pill-bg)' },
        neutro: { color: 'var(--cf-ink-2)', background: 'var(--cf-fill)' },
      }

  const cuerpo = (
    <>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: c.rotulo }}>
          {rotulo}
        </span>
        {/* La cifra y su chip comparten renglón y, si no caben, el chip BAJA
            entero: nunca se parte ni se recorta (son plata los dos). */}
        <span style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '6px 12px', flexWrap: 'wrap' }}>
          <span className="cf-fig" style={{
            fontSize: tam, letterSpacing: tam >= 26 ? '-.03em' : '-.02em', fontWeight: 700, color: c[tono] ?? c.neutro,
            // Una cifra no se parte: «−» en un renglón y «$475.580.000» en el otro
            // se lee como dos datos.
            whiteSpace: 'nowrap',
          }}>{cifra}</span>
          {chip && (
            <span className="cf-num" style={{
              fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '3px 9px', whiteSpace: 'nowrap',
              ...(chips[tonoChip] ?? chips.neutro),
            }}>{chip}</span>
          )}
        </span>
        {pie && (
          <span className="cf-num" style={{ fontSize: 12, fontWeight: 500, color: c.pie, lineHeight: 1.4 }}>{pie}</span>
        )}
      </span>
      {onTocar && (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={c.pie}
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
          <path d="M9 5l7 7-7 7" />
        </svg>
      )}
    </>
  )

  const caja = { display: 'flex', alignItems: 'center', gap: 12, width: '100%' }
  if (!onTocar) return <div style={{ ...caja, ...style }}>{cuerpo}</div>
  // `style` va AL FINAL: trae la raya de arriba (`borderTop`), y detrás del
  // `border: 0` del botón se la comía — la línea tocable salía sin divisor.
  return (
    <button type="button" onClick={onTocar} style={{
      ...caja, background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left', ...style,
    }}>{cuerpo}</button>
  )
}
