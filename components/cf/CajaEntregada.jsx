'use client'

/**
 * DÍA CERRADO — lo que sale al entregar la caja.
 *
 * Aprobado por el dueño el 19 sep 2026 con el prototipo «Cierre de caja». Cierra
 * la historia de la billetera que se llenó cobrando: al entregar, los billetes
 * salen de ella hasta dejarla vacía.
 *
 *   · Si lo entregado es IGUAL AL PESO a «Te queda en la mano», cae el sello de
 *     «Caja cuadrada». Solo entonces.
 *   · Si falta plata, no hay fiesta: se dice cuánto falta, queda anotado y se
 *     puede corregir. Si sobra, también se dice, sin sello.
 *   · Si hoy prestó más de lo que cobró en efectivo, no hay nada de hoy que
 *     entregar: no vuelan billetes. NO se dice «el negocio te debe»: la caja no
 *     cuenta la base con la que salió, y esa base también es del negocio.
 *
 * «Te queda en la mano» es `enLaMano` de la caja del cobrador —la referencia de
 * las dos cajas—, la misma cifra del botón «Usar». Aquí no se calcula nada.
 *
 * Los «días seguidos cuadrando» del prototipo NO están: hace falta definir con
 * datos reales qué cuenta como «cuadró» antes de enseñarlo.
 */

import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import { CAPA_RECIBO } from '@/components/pantallas/Recibo'
import { construirRodillos, CSS_RODILLOS, menosMovimiento, sonidoBillete, sonidoCobrado, vibrar } from '@/lib/celebrar'
import { BW, BH, pintarBilletera, soltarBilletes } from '@/lib/billetes'

function Fila({ etiqueta, valor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 14 }}>
      <span style={{ color: 'var(--cf-ink-3)' }}>{etiqueta}</span>
      <span className="cf-num" style={{ fontWeight: 700 }}>{valor}</span>
    </div>
  )
}

export default function CajaEntregada({ entregado, enLaMano, cobrado, cobros, inflado = 0.5, formatear, onListo, onCorregir }) {
  const refOdo = useRef(null), refBilletera = useRef(null), refVuelo = useRef(null), refSello = useRef(null)
  const nadaQueEntregar = enLaMano <= 0
  const cuadra = !nadaQueEntregar && Math.round(entregado) === Math.round(enLaMano)
  const falta = !nadaQueEntregar && Math.round(enLaMano - entregado) > 0 ? Math.round(enLaMano - entregado) : 0
  const sobra = !nadaQueEntregar && Math.round(entregado - enLaMano) > 0 ? Math.round(entregado - enLaMano) : 0

  useEffect(() => {
    const billetera = refBilletera.current
    if (refOdo.current) construirRodillos(refOdo.current, formatear(nadaQueEntregar ? enLaMano : entregado))
    if (!billetera) return
    let lleno = nadaQueEntregar ? 0 : Math.max(0.15, Math.min(1, inflado))
    pintarBilletera(billetera, lleno)
    const caer = () => {
      if (!cuadra || !refSello.current) { if (falta || sobra) vibrar([20, 60, 20]); return }
      refSello.current.animate?.([
        { opacity: 0, transform: 'rotate(-6deg) scale(1.8)' }, { opacity: 1, transform: 'rotate(-6deg) scale(1)' },
      ], { duration: 200, easing: 'cubic-bezier(.3,0,.2,1)', fill: 'forwards' })
      setTimeout(() => { vibrar(30); sonidoCobrado() }, 190)
    }
    if (menosMovimiento() || nadaQueEntregar) {
      pintarBilletera(billetera, 0)
      if (refSello.current && cuadra) refSello.current.style.opacity = '1'
      if (nadaQueEntregar) sonidoCobrado()
      return
    }
    // Los billetes salen de la billetera hasta vaciarla: el día se entregó.
    const t = setTimeout(() => {
      const b = billetera.getBoundingClientRect()
      if (!refVuelo.current || !b.width) { pintarBilletera(billetera, 0); return caer() }
      const n = 6, paso = lleno / n
      soltarBilletes(refVuelo.current, n,
        { x: b.left + BW / 2, y: b.top + 20, ancho: 30 },
        { x: b.left + BW / 2, y: -40, dispersion: 260 },
        () => { lleno = Math.max(0, lleno - paso); pintarBilletera(billetera, lleno); sonidoBillete(); vibrar(6) },
        () => { pintarBilletera(billetera, 0); caer() })
    }, 380)
    return () => clearTimeout(t)
    // Una vez por cierre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div data-caja-entregada="1" className={CAPA_RECIBO.className} style={CAPA_RECIBO.style}>
      <div className="w-full max-w-[520px] mx-auto lg:w-[520px] lg:flex-none lg:my-8 lg:bg-[var(--cf-card)] lg:rounded-[20px] lg:shadow-2xl"
        style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 12, padding: 24, color: 'var(--cf-ink)' }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em', color: 'var(--cf-ink-3)' }}>CAJA · DÍA CERRADO</span>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12,
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 'var(--cf-r-card)', padding: 16,
        }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
              {nadaQueEntregar ? 'Te queda en la mano' : 'Entregaste'}
            </span>
            <div><span ref={refOdo} className="cf-rodillos" style={{ fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 30, fontWeight: 700 }} /></div>
          </div>
          <canvas ref={refBilletera} aria-hidden style={{ display: 'block', width: BW, height: BH }} />
        </div>

        {cuadra && (
          <div ref={refSello} style={{
            alignSelf: 'center', margin: '8px 0 2px', opacity: 0, transform: 'rotate(-6deg)',
            fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 22, fontWeight: 700, letterSpacing: '.04em',
            textTransform: 'uppercase', color: 'var(--cf-green-dark)', border: '3px solid currentColor', borderRadius: 12, padding: '8px 16px',
            textAlign: 'center',
          }}>
            Caja cuadrada
            <small style={{ display: 'block', fontFamily: 'inherit', fontSize: 11, letterSpacing: '.08em' }}>al peso</small>
          </div>
        )}

        {(falta > 0 || sobra > 0) && (
          <div style={{ background: falta ? 'var(--cf-red-bg)' : 'var(--cf-gold-tint)', borderRadius: 12, padding: 12 }}>
            <b className="cf-num" style={{ display: 'block', fontSize: 20, color: falta ? 'var(--cf-red-dark)' : 'var(--cf-gold-text)' }}>
              {falta ? `Faltan ${formatear(falta)}` : `Sobran ${formatear(sobra)}`}
            </b>
            <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>
              Queda anotado para el cuadre con el dueño. Si fue un error al contar, lo puedes corregir hoy.
            </p>
          </div>
        )}

        {nadaQueEntregar && (
          <div style={{ background: 'var(--cf-gold-tint)', color: 'var(--cf-gold-text)', borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.5 }}>
            Hoy prestaste más de lo que cobraste en efectivo: no te queda plata de hoy para entregar.
          </div>
        )}

        <div style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 'var(--cf-r-card)', padding: '10px 16px' }}>
          <Fila etiqueta="Cobros del día" valor={cobros} />
          <Fila etiqueta="Cobraste en efectivo" valor={formatear(cobrado)} />
          <Fila etiqueta="Te quedaba en la mano" valor={formatear(enLaMano)} />
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(falta > 0 || sobra > 0) && onCorregir && (
            <button type="button" onClick={onCorregir} style={{
              height: 48, borderRadius: 14, cursor: 'pointer', background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
              color: 'var(--cf-ink)', font: 'inherit', fontSize: 15, fontWeight: 700,
            }}>Corregir lo que entregué</button>
          )}
          <button type="button" onClick={onListo} style={{
            height: 56, border: 0, borderRadius: 14, background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', cursor: 'pointer',
            font: 'inherit', fontSize: 16, fontWeight: 700,
          }}>Listo, hasta mañana</button>
        </div>
      </div>
      <canvas ref={refVuelo} width={0} height={0} aria-hidden style={{
        position: 'fixed', inset: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 10003,
      }} />
      <style>{CSS_RODILLOS}</style>
    </div>,
    document.body,
  )
}
