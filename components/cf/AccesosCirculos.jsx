'use client'

/* ══ LOS ACCESOS REDONDOS, UNA SOLA VEZ (19 nov 2026) ═════════════════════════
 *
 * Nacieron en la ruta (18 nov): eran una fila de botoncitos de 11 px que se
 * desplazaba en horizontal, y en un teléfono de 390 px «Optimizar» y los demás
 * nacían fuera de la pantalla. Círculos de 56 px con su nombre debajo, en una
 * cuadrícula de cuatro: todos se ven sin arrastrar.
 *
 * Ahora los usan también las fichas del préstamo y del cliente. Vivía copiado
 * dentro de la ruta; dos copias de lo mismo se quedan distintas el día que
 * cambia una, sin que nada falle.
 *
 * Cada acceso: `{ id, texto, onClick | href, icono | iconoCompleto, deshabilitado,
 * alerta, dorado }`. `icono` son los trazos (van dentro de un <svg> de 24 con
 * `currentColor`); `iconoCompleto` es un <svg> ya armado, que se pinta en una
 * caja de 22. Los `false` no se pintan (sin permiso, sin datos).
 */

import Link from 'next/link'

export default function AccesosCirculos({ accesos = [], style = null }) {
  const lista = accesos.filter(Boolean)
  if (lista.length === 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px 6px', ...style }}>
      {lista.map((a) => {
        const dentro = (
          <>
            <span aria-hidden style={{
              position: 'relative', width: 56, height: 56, borderRadius: 999, display: 'grid', placeItems: 'center',
              // «Prestarle» va en dorado: es la que gana plata (DESIGN.md, dorado reservado).
              background: a.dorado ? 'var(--cf-gold)' : 'var(--cf-card)',
              border: a.dorado ? 0 : '1px solid var(--cf-border)',
              color: a.dorado ? 'var(--cf-gold-ink)' : (a.color ?? 'var(--cf-ink)'),
              boxShadow: '0 2px 8px rgba(20,20,28,.06)',
            }}>
              {a.iconoCompleto
                ? <span style={{ width: 22, height: 22, display: 'inline-flex' }}>{a.iconoCompleto}</span>
                : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{a.icono}</svg>}
              {/* El aviso sin leer: un punto rojo (la mora en «Abonos»). */}
              {a.alerta && (
                <span style={{
                  position: 'absolute', top: 9, right: 10, width: 10, height: 10, borderRadius: 999,
                  background: 'var(--cf-red-dark)', border: '2px solid var(--cf-card)',
                }} />
              )}
            </span>
            <span style={{
              fontSize: 13, fontWeight: a.dorado ? 700 : 600, lineHeight: 1.2, textAlign: 'center',
              color: a.dorado ? 'var(--cf-ink)' : 'var(--cf-ink-2)',
            }}>{a.texto}</span>
          </>
        )
        const estilo = {
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0,
          background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer', textDecoration: 'none',
          opacity: a.deshabilitado ? 0.5 : 1,
        }
        return a.href
          ? <Link key={a.id} href={a.href} style={estilo} title={a.titulo ?? a.texto}>{dentro}</Link>
          : <button key={a.id} type="button" onClick={a.onClick} disabled={a.deshabilitado} style={estilo} title={a.titulo ?? a.texto}>{dentro}</button>
      })}
    </div>
  )
}
