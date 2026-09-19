'use client'

/**
 * CLIENTE CREADO — lo que sale al cargar un cliente.
 *
 * Aprobado por el dueño el 19 sep 2026 con el prototipo «Cargar clientes».
 * Cargar clientes es lo que más predice que un negocio se quede (el 75 % se
 * queda en cinco o menos), así que este momento tiene que empujar al siguiente:
 *
 *   · El cliente sale como SU CARTULINA —lo que el cobrador conoce—, con los
 *     renglones de libreta y el sello «Cliente nuevo». Cada renglón mide lo mismo
 *     que el espacio entre rayas y la letra se apoya en la raya («los datos no
 *     quedan bien alineados con las líneas», corregido en el prototipo).
 *   · Su cara vuela a «Tus clientes» y entra AL FRENTE de la fila, empujando a
 *     los demás; el número gira. «Tus clientes», no «fichero»: es la palabra del
 *     sistema. Las caras son el `Avatar` de siempre.
 *   · Sin deslizador: aquí no se mueve plata, y el gesto tiene que seguir
 *     diciendo «cuidado, esto es dinero».
 *   · Dura menos de segundo y medio y los botones sirven desde el primer
 *     instante: se cargan veinte seguidos sin esperar.
 *
 * El conteo y las caras salen de `/api/clientes?orden=recientes&limit=4`, la
 * misma cuenta de la pantalla de clientes. Si no llegan, ese bloque no se pinta.
 */

import { useEffect, useRef, useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import { documentoParaMostrar } from '@/lib/documento'
import { construirRodillos, CSS_RODILLOS, menosMovimiento, rodarContador, sonidoCartulina, vibrar } from '@/lib/celebrar'

const EXPO = 'cubic-bezier(.16,1,.3,1)'
const VISIBLES = 4

export default function ClienteCreado({ cliente, pais, onPrestar, onOtro, onVerFicha }) {
  const refOdo = useRef(null), refChip = useRef(null), refCaras = useRef(null)
  const refCara = useRef(null), refSello = useRef(null), refCartulina = useRef(null)
  const refVuelo = useRef(null)
  const [tus, setTus] = useState(null)          // { total, caras: [{id,nombre,fotoUrl}] }
  const [conNuevo, setConNuevo] = useState(false)
  const antesDeCorrer = useRef(null)

  // Las caras y el conteo, ya con el cliente nuevo adentro (se pide después de crear).
  useEffect(() => {
    let vivo = true
    fetch('/api/clientes?page=1&limit=5&orden=recientes', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo || !d || !Array.isArray(d.clientes) || !Number.isFinite(d.total)) return
        const otros = d.clientes.filter((c) => c.id !== cliente.id)
        const estaba = otros.length !== d.clientes.length
        setTus({ total: d.total, antes: estaba ? d.total - 1 : d.total, caras: otros.slice(0, VISIBLES) })
      })
      .catch(() => {})
    return () => { vivo = false }
  }, [cliente.id])

  /* Escape = cargar el siguiente: quien está aquí está cargando su cartera, y
     cerrar la ventana es seguir con el formulario limpio. Las otras dos salidas
     (prestarle, ver la ficha) son sus botones. */
  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape') onOtro?.() }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [onOtro])

  // El sello y el visto entran solos; la cara vuela cuando ya se sabe dónde aterriza.
  useEffect(() => {
    if (menosMovimiento()) { if (refSello.current) refSello.current.style.opacity = '1'; return }
    refSello.current?.animate?.([
      { opacity: 0, transform: 'rotate(-8deg) scale(1.6)' },
      { opacity: 1, transform: 'rotate(-8deg) scale(1)' },
    ], { duration: 220, delay: 260, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' })
    const t = setTimeout(() => vibrar(10), 480)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!tus || !refOdo.current) return
    let rodillos = construirRodillos(refOdo.current, String(tus.antes))
    let vivo = true
    const llegar = () => {
      if (!vivo) return
      // Dónde estaba cada cara ANTES de correrse, para animar el corrimiento.
      if (refCaras.current) antesDeCorrer.current = new Map([...refCaras.current.querySelectorAll('[data-cara]')].map((c) => [c.dataset.cara, c.getBoundingClientRect().left]))
      setConNuevo(true)
      rodillos = rodarContador(refOdo.current, rodillos, String(tus.total))
      sonidoCartulina(); vibrar([8, 30, 14])
      refChip.current?.animate?.([
        { opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none', offset: 0.15 },
        { opacity: 1, offset: 0.8 }, { opacity: 0 },
      ], { duration: 2200 })
    }
    if (menosMovimiento() || tus.total === tus.antes) { llegar(); return () => { vivo = false } }
    const t = setTimeout(() => {
      const a = refCara.current?.getBoundingClientRect(), fila = refCaras.current
      // El frente es el ÚLTIMO del DOM: la fila va en `row-reverse`.
      const todas = fila ? [...fila.querySelectorAll('[data-cara]')] : []
      const primera = todas[todas.length - 1]
      const b = primera ? primera.getBoundingClientRect() : fila?.getBoundingClientRect()
      if (!a?.width || !b || !refVuelo.current) return llegar()
      const copia = refVuelo.current
      Object.assign(copia.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, opacity: '1' })
      const dx = b.left - a.left, dy = b.top - a.top
      const vuelo = copia.animate([
        { transform: 'none' },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(1.15)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px)` },
      ], { duration: 560, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' })
      vuelo.onfinish = () => { copia.style.opacity = '0'; vuelo.cancel(); llegar() }
    }, 560)
    return () => { vivo = false; clearTimeout(t) }
  }, [tus])

  // Los que ya estaban se corren para hacerle sitio al nuevo (FLIP).
  useEffect(() => {
    if (!conNuevo || menosMovimiento() || !refCaras.current) return
    const antes = antesDeCorrer.current ?? new Map()
    for (const c of refCaras.current.querySelectorAll('[data-cara]')) {
      if (c.dataset.cara === cliente.id) {
        c.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 320, easing: EXPO })
      } else if (antes.has(c.dataset.cara)) {
        const dx = antes.get(c.dataset.cara) - c.getBoundingClientRect().left
        if (dx) c.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 320, easing: EXPO })
      }
    }
  }, [conNuevo, cliente.id])

  const caras = tus ? (conNuevo ? [cliente, ...tus.caras].slice(0, VISIBLES) : tus.caras.slice(0, VISIBLES)) : []
  const resto = tus ? (conNuevo ? tus.total : tus.antes) - caras.length : 0
  // `documentoParaMostrar`: la abreviatura del país y NADA si es el marcador
  // «SIN-…» que se guarda cuando el cliente no dio documento.
  const renglon2 = [documentoParaMostrar(cliente.cedula, pais), cliente.telefono].filter(Boolean).join(' · ')

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'var(--cf-scrim-modal)' }}>
      <div className="w-[92%] max-w-sm" style={{
        background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 20, padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {tus && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            background: 'var(--cf-surface)', borderRadius: 16, padding: 12,
          }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>Tus clientes</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span ref={refOdo} className="cf-rodillos" style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 26, fontWeight: 700 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cf-ink-2)' }}>clientes</span>
                <span ref={refChip} className="cf-num" style={{ opacity: 0, fontSize: 12, fontWeight: 700, color: 'var(--cf-green-dark)', background: 'var(--cf-green-pill-bg)', borderRadius: 999, padding: '2px 8px' }}>+1</span>
              </div>
            </div>
            {/* El último va al frente (a la izquierda) y encima de los demás. */}
            <div ref={refCaras} aria-hidden style={{ display: 'flex', flexDirection: 'row-reverse', justifyContent: 'flex-end', paddingLeft: 10, flex: 'none' }}>
              {resto > 0 && (
                <span className="cf-num" style={{
                  width: 36, height: 36, borderRadius: 999, marginLeft: -10, display: 'grid', placeItems: 'center',
                  background: 'var(--cf-fill-2)', color: 'var(--cf-ink-2)', fontSize: 12, fontWeight: 700, border: '2px solid var(--cf-surface)',
                }}>+{resto}</span>
              )}
              {[...caras].reverse().map((c) => (
                <span key={c.id} data-cara={c.id} style={{ marginLeft: -10, borderRadius: 999, border: '2px solid var(--cf-surface)', display: 'inline-flex' }}>
                  <Avatar nombre={c.nombre} fotoUrl={c.fotoUrl} size={32} round />
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden className="cf-recibo-sello" style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--cf-green)', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path className="cf-recibo-visto" d="M5 13l4 4L19 7" /></svg>
          </span>
          <span style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>Cliente creado</span>
        </div>

        <div ref={refCartulina} className="cf-cartulina">
          <span ref={refSello} className="cf-cartulina-sello">Cliente nuevo</span>
          <span ref={refCara} className="cf-cartulina-cara"><Avatar nombre={cliente.nombre} fotoUrl={cliente.fotoUrl} size={36} round /></span>
          <b>{cliente.nombre}</b>
          {renglon2 && <small>{renglon2}</small>}
          {cliente.direccion && <small>{cliente.direccion}</small>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button type="button" onClick={onPrestar} style={{
            height: 56, border: 0, borderRadius: 14, background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)',
            font: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}>Prestarle a {cliente.nombre.trim().split(/\s+/)[0]}</button>
          <button type="button" onClick={onOtro} style={{
            height: 48, borderRadius: 14, background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
            color: 'var(--cf-ink)', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>Cargar otro cliente</button>
          <button type="button" onClick={onVerFicha} style={{
            height: 40, border: 0, background: 'none', color: 'var(--cf-ink-3)', font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>Ver ficha del cliente</button>
        </div>
      </div>

      {/* La cara que vuela. Posición fija: la mide el efecto al despegar. */}
      <span ref={refVuelo} aria-hidden style={{ position: 'fixed', zIndex: 10000, opacity: 0, pointerEvents: 'none', display: 'inline-flex', borderRadius: 999 }}>
        <Avatar nombre={cliente.nombre} fotoUrl={cliente.fotoUrl} size={36} round />
      </span>

      <style>{`
        ${CSS_RODILLOS}
        .cf-recibo-sello { animation: cf-recibo-sello .28s ${EXPO} both; }
        .cf-recibo-visto { stroke-dasharray: 22; animation: cf-recibo-visto .32s ${EXPO} .12s both; }
        @keyframes cf-recibo-sello { from { opacity: 0; transform: scale(.8) } to { opacity: 1; transform: none } }
        @keyframes cf-recibo-visto { from { stroke-dashoffset: 22 } to { stroke-dashoffset: 0 } }
        /* La libreta: cada renglón mide lo que el espacio entre rayas y la letra
           se apoya en la raya. Las rayas se calculan desde el mismo relleno de
           arriba, así texto y rayas no pueden descuadrarse. */
        .cf-cartulina { --renglon: 26px; --arriba: 4px; --apoyo: 21px;
          position: relative; overflow: hidden; border-radius: 12px; padding: var(--arriba) 14px 5px;
          background: var(--cf-cartulina); border: 1px solid var(--cf-cartulina-canto); color: var(--cf-ink); animation: cf-cartulina-entra .3s ${EXPO} both; }
        .cf-cartulina::before { content: ''; position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(transparent 0 calc(var(--renglon) - 1px), var(--cf-cartulina-linea) calc(var(--renglon) - 1px) var(--renglon));
          background-position: 0 calc(var(--arriba) + var(--apoyo) - var(--renglon) + 1px); }
        .cf-cartulina b, .cf-cartulina small { position: relative; display: block; line-height: var(--renglon); margin: 0; padding-left: 50px; overflow-wrap: anywhere; }
        .cf-cartulina b { font-size: 17px; font-weight: 800; padding-right: 112px; }
        .cf-cartulina small { font-size: 13px; font-weight: 600; color: var(--cf-ink-2); }
        .cf-cartulina-cara { position: absolute; left: 12px; top: 10px; z-index: 1; display: inline-flex; border-radius: 999px; }
        .cf-cartulina-cara > * { box-shadow: 0 0 0 2px var(--cf-cartulina); }
        .cf-cartulina-sello { position: absolute; right: 10px; top: 8px; z-index: 1; font-size: 11px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
          color: var(--cf-green-dark); border: 2px solid currentColor; border-radius: 8px; padding: 3px 7px; transform: rotate(-8deg); opacity: 0; }
        @keyframes cf-cartulina-entra { from { opacity: 0; transform: translateY(10px) scale(.98) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) { .cf-recibo-sello, .cf-recibo-visto, .cf-cartulina { animation: none; } }
      `}</style>
    </div>
  )
}
