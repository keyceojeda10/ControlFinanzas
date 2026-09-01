'use client'
// components/pagos/HojaSuscripcion.jsx — el paso donde el cliente autoriza que
// se le cobre solo cada mes.
//
// ══ POR QUÉ ES UNA HOJA Y NO UN BOTÓN MÁS ══════════════════════════════════
//
// Autorizar un cobro recurrente no es lo mismo que pagar una vez, y tiene que
// verse distinto ANTES de pulsar. Aquí se dice, con todas las letras y antes de
// tocar nada: cuánto, cada cuánto, y cómo se quita. Un cobro que el cliente no
// esperaba es una devolución, una queja y un cliente menos.
//
// ⚠ EL BOTÓN LO PINTA WOMPI, NO NOSOTROS. El widget se declara metiendo un
// <script> DENTRO de un <form>; React no ejecuta un <script> escrito en JSX, así
// que hay que crearlo con `document.createElement` y colgarlo del form a mano.
// Si algún día «no sale el botón», esto es lo primero que hay que mirar —
// junto con la CSP de `next.config.mjs`, que tiene que permitir
// `checkout.wompi.co` en `script-src`, `frame-src` y `connect-src`. Sin eso el
// navegador lo bloquea EN SILENCIO: no hay error en pantalla, simplemente no
// aparece nada.
//
// Al terminar, el widget hace un POST de formulario a `action`, o sea a
// `/api/pagos/wompi/token`, que crea la fuente de pago y devuelve aquí.

import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '@/lib/i18n'

const WIDGET = 'https://checkout.wompi.co/widget.js'

export default function HojaSuscripcion({ plan, nombre, precioMensual, onCerrar, onPagoUnico }) {
  const formRef = useRef(null)
  const [publicKey, setPublicKey] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let vivo = true
    fetch('/api/pagos/wompi/fuente')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo) return
        if (!d?.configurado || !d?.publicKey) { setError('Los pagos con tarjeta no están disponibles ahora mismo.'); return }
        if (!d.esDueno) { setError('Solo el dueño de la cuenta puede guardar el medio de pago.'); return }
        setPublicKey(d.publicKey)
      })
      .catch(() => vivo && setError('No se pudo conectar con la pasarela de pagos.'))
    return () => { vivo = false }
  }, [])

  useEffect(() => {
    if (!publicKey || !formRef.current) return
    const form = formRef.current
    const s = document.createElement('script')
    s.src = WIDGET
    s.setAttribute('data-render', 'button')
    s.setAttribute('data-public-key', publicKey)
    /* El modo tokenización: el widget no cobra, solo guarda el medio de pago y
       devuelve un token de un solo uso. Los datos de la tarjeta se quedan
       dentro de su iframe y nunca tocan nuestro servidor. */
    s.setAttribute('data-widget-operation', 'tokenize')
    s.setAttribute('data-currency', 'COP')
    form.appendChild(s)
    return () => { s.remove() }
  }, [publicKey])

  /* Cerrar al tocar fuera. El clic afuera no cerraba NINGUNO de los 47 modales
     de este sistema hasta que se arregló; no volver a dejar uno sin salida. */
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onCerrar}
    >
      <div
        className="w-full sm:max-w-[380px] rounded-t-[20px] sm:rounded-[20px] p-5 space-y-4"
        style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold" style={{ color: 'var(--cf-ink)' }}>
              Suscribirte a {nombre}
            </h2>
            <p className="text-[13px] font-mono-display font-bold mt-0.5" style={{ color: 'var(--cf-ink)' }}>
              {formatMoney(precioMensual)}
              <span className="text-[11px] font-normal" style={{ color: 'var(--cf-ink-3)' }}> cada mes</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-2)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <ul className="space-y-2">
          {[
            'Se cobra solo cada mes. No tienes que volver a entrar a pagar.',
            'Lo quitas cuando quieras, desde esta misma pantalla.',
            'Los datos de tu tarjeta los guarda Wompi, no nosotros.',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2 text-[12px]" style={{ color: 'var(--cf-ink-2)' }}>
              <svg className="w-4 h-4 shrink-0 mt-[1px]" fill="none" stroke="var(--cf-green-dark)" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>{t}</span>
            </li>
          ))}
        </ul>

        {error ? (
          <p className="text-[12px] rounded-[12px] px-3 py-2" style={{
            background: 'color-mix(in srgb, var(--cf-red-dark) 10%, transparent)',
            color: 'var(--cf-red-dark)',
          }}>
            {error}
          </p>
        ) : (
          <>
            {/* ⚠ El `plan` viaja en un campo oculto DENTRO del form del widget:
                es lo único que le dice al receptor a qué plan pertenece el medio
                que se acaba de guardar. */}
            <form ref={formRef} action="/api/pagos/wompi/token" method="POST" className="flex justify-center">
              <input type="hidden" name="plan" value={plan} />
            </form>
            {!publicKey && (
              <p className="text-[12px] text-center" style={{ color: 'var(--cf-ink-3)' }}>Cargando…</p>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onPagoUnico}
          className="w-full h-10 rounded-[12px] text-[12px] font-medium"
          style={{ color: 'var(--cf-ink-3)' }}
        >
          Prefiero pagar una sola vez
        </button>
      </div>
    </div>
  )
}
