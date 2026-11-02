'use client'

// components/clientes/ReporteCliente.jsx — «¿LE PRESTO?», EN UNA TARJETA.
//
// Sale en tres sitios y es la MISMA pieza en los tres, para que no digan cosas
// distintas del mismo cliente:
//   · la ficha del cliente,
//   · «nuevo cliente», al escribir la cédula,
//   · «nuevo préstamo», al elegir el cliente.
//
// Lo pidió el mejor cliente del dueño (2 nov 2026): que sus cobradores no le
// presten a gente que paga mal, y además saber si quedó mal en otros negocios
// de Control Finanzas. La regla: lib/reporte-cliente.js.
//
// ⚠ SIEMPRE SE VE. El «score» de antes no pintaba nada si no había reportes,
// y como casi nunca los había, la función parecía borrada. Ahora el caso
// tranquilo sale en una tarjeta corta («Sin historial» / «Buen historial») y
// el malo sale grande, con cada motivo en su renglón.
//
// ⚠ El estado va en el RIEL y en la PASTILLA, nunca tiñendo la tarjeta
// (DESIGN.md · decisión 4).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Pastilla } from '@/components/cf/primitivos'
import { PLANES_CONFIG } from '@/lib/planes'

const RIEL = { rojo: 'var(--cf-red)', ambar: 'var(--cf-gold)', verde: 'var(--cf-green)', nuevo: 'var(--cf-border-strong)' }
const PASTILLA = { rojo: 'mora', ambar: 'atraso', verde: 'aldia', nuevo: 'neutro' }
const TINTA = { rojo: 'var(--cf-red-dark)', ambar: 'var(--cf-gold-text-2)', verde: 'var(--cf-green-dark)' }

function Escudo({ nivel }) {
  const color = TINTA[nivel] ?? 'var(--cf-ink-3)'
  const malo = nivel === 'rojo' || nivel === 'ambar'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      <path d="M12 2.714A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      {malo ? <path d="M12 8.25v4.5M12 15.75h.008" /> : <path d="M9 12.75L11.25 15 15 9.75" />}
    </svg>
  )
}

function Etiqueta({ children }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
      {children}
    </span>
  )
}

function Renglon({ tono, children }) {
  return (
    <li style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink)' }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, marginTop: 6, flex: 'none', background: TINTA[tono] ?? 'var(--cf-ink-4)' }} />
      <span>{children}</span>
    </li>
  )
}

/**
 * @param {object} p
 * @param {string} [p.cedula]     se consulta al escribirla (con espera)
 * @param {string} [p.clienteId]  se consulta al elegirlo
 * @param {'ficha'|'nuevo-cliente'|'prestamo'} p.contexto
 * @param {boolean} [p.esOwner]   el dueño ve el enlace para subir de plan
 */
export default function ReporteCliente({ cedula, clienteId, contexto, esOwner = false, style }) {
  const [r, setR] = useState(null)

  const clave = clienteId ? `c:${clienteId}` : cedula?.trim()?.length >= 6 ? `d:${cedula.trim()}` : null
  useEffect(() => {
    if (!clave) { setR(null); return }
    const ctrl = new AbortController()
    const url = clienteId
      ? `/api/clientes/reporte?clienteId=${encodeURIComponent(clienteId)}`
      : `/api/clientes/reporte?cedula=${encodeURIComponent(cedula.trim())}`
    // Al escribir la cédula se espera a que deje de teclear; al elegir, no.
    const t = setTimeout(() => {
      fetch(url, { signal: ctrl.signal, cache: 'no-store' })
        .then((x) => (x.ok ? x.json() : null))
        .then((d) => setR(d?.nivel ? d : null))
        .catch(() => {})
    }, clienteId ? 0 : 450)
    return () => { clearTimeout(t); ctrl.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  if (!r) return null

  const malo = r.nivel === 'rojo' || r.nivel === 'ambar'
  const existente = contexto === 'nuevo-cliente' ? r.existente : null
  const nombrePlan = PLANES_CONFIG.standard?.nombre ?? 'Profesional'
  const sinPropio = !r.propio.length
  const textoPropio = existente || contexto !== 'nuevo-cliente'
    ? 'Todavía no ha terminado ningún préstamo contigo.'
    : 'No está en tu negocio.'
  const textoOtros = r.negocios > 0
    ? null
    : 'No aparece en otros negocios de Control Finanzas.'

  /* LA TARJETA CORTA: nada que temer. Se ve igual, para que se sepa que se
     revisó, pero no ocupa media pantalla. */
  if (!malo && !existente) {
    const resumen = [
      ...(r.propio.length ? r.propio.map((l) => l.texto) : [textoPropio]),
      ...(r.conOtros ? (r.otros.length ? [`En ${r.negocios === 1 ? 'otro negocio' : `${r.negocios} negocios`} de Control Finanzas: ${r.otros.map((l) => l.texto.toLowerCase()).join(', ')}`] : [textoOtros]) : []),
    ]
    return (
      <section data-reporte-cliente={r.nivel} aria-label="Reporte del cliente" style={{
        position: 'relative', display: 'flex', gap: 12, alignItems: 'flex-start',
        background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 'var(--cf-r-card)',
        padding: '14px 16px 14px 19px', ...style,
      }}>
        <span aria-hidden style={{ position: 'absolute', left: 0, top: 14, bottom: 14, width: 4, borderRadius: 999, background: RIEL[r.nivel] }} />
        <Escudo nivel={r.nivel} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-ink)' }}>Reporte del cliente</span>
            <Pastilla tono={PASTILLA[r.nivel]}>{r.pastilla}</Pastilla>
          </div>
          <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)' }}>{resumen.join(' · ')}</span>
        </div>
      </section>
    )
  }

  return (
    <section data-reporte-cliente={r.nivel} role={malo ? 'alert' : 'status'} aria-label="Reporte del cliente" style={{
      position: 'relative', display: 'flex', flexDirection: 'column', gap: 14,
      background: 'var(--cf-card)', border: `1px solid ${malo ? 'var(--cf-border-strong)' : 'var(--cf-border)'}`,
      borderRadius: 'var(--cf-r-card)', padding: '16px 18px 16px 21px', ...style,
    }}>
      <span aria-hidden style={{ position: 'absolute', left: 0, top: 16, bottom: 16, width: 4, borderRadius: 999, background: RIEL[r.nivel] }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <Escudo nivel={r.nivel} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Etiqueta>Reporte del cliente</Etiqueta>
            <Pastilla tono={PASTILLA[r.nivel]}>{r.pastilla}</Pastilla>
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, color: TINTA[r.nivel] ?? 'var(--cf-ink)' }}>
            {existente ? 'Esta cédula ya está en tu negocio' : r.titulo}
          </span>
          {existente && (
            <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
              Es de <strong>{existente.nombre}</strong>{existente.ruta ? `, en ${/^\s*ruta\b/i.test(existente.ruta) ? '' : 'la ruta '}${existente.ruta}` : ''}.{' '}
              {existente.eliminado
                ? 'Lo habías borrado: si lo guardas, vuelve a quedar activo con su historial.'
                : <>No hace falta crearlo otra vez.{' '}
                    {/* Al cobrador de otra ruta la ficha le daría «no encontrado». */}
                    {esOwner && <Link href={`/clientes/${existente.id}`} style={{ color: 'var(--cf-gold-dark)', fontWeight: 700 }}>Ver su ficha</Link>}</>}
            </span>
          )}
          {malo && contexto === 'prestamo' && (
            <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
              Revísalo antes de prestarle.
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid var(--cf-hairline)' }}>
        <Etiqueta>En tu negocio</Etiqueta>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
          {sinPropio
            ? <Renglon tono={null}>{textoPropio}</Renglon>
            : r.propio.map((l, i) => <Renglon key={i} tono={l.tono}>{l.texto}</Renglon>)}
        </ul>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid var(--cf-hairline)' }}>
        <Etiqueta>
          En otros negocios de Control Finanzas{r.conOtros && r.negocios > 0 ? ` · ${r.negocios}` : ''}
        </Etiqueta>
        {r.conOtros ? (
          <>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
              {r.otros.length
                ? r.otros.map((l, i) => <Renglon key={i} tono={l.tono}>{l.texto}</Renglon>)
                : <Renglon tono={null}>{textoOtros ?? 'Aparece, pero sin préstamos que contar.'}</Renglon>}
            </ul>
            {r.negocios > 0 && (
              <span style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>No se dice quién le prestó ni cuánto.</span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--cf-ink-3)' }}>
            Saber si quedó mal con otros prestamistas viene desde el plan {nombrePlan}.{' '}
            {esOwner && <Link href="/configuracion/plan" style={{ color: 'var(--cf-gold-dark)', fontWeight: 700 }}>Ver planes</Link>}
          </span>
        )}
      </div>
    </section>
  )
}
