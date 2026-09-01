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

  /* ── NEQUI: el camino que de verdad usan ────────────────────────────────
     De las últimas doce suscripciones cobradas por Wompi, ocho fueron con
     Nequi y una sola con tarjeta. Y el widget no cierra el círculo en
     Colombia: el push llega y el token nunca vuelve. Así que Nequi va por su
     propio camino, con API documentada, y el widget queda para la tarjeta. */
  const [tel, setTel] = useState('')
  const [paso, setPaso] = useState('form')   // form · esperando · listo
  const [rotulo, setRotulo] = useState('')
  const sondeo = useRef(null)

  useEffect(() => () => clearInterval(sondeo.current), [])

  const pedirNequi = async () => {
    setError(null)
    const digitos = tel.replace(/\D/g, '').slice(-10)
    if (digitos.length !== 10) { setError('El número de Nequi son diez dígitos.'); return }
    setPaso('esperando')
    try {
      const r = await fetch('/api/pagos/wompi/nequi', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: digitos }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'No se pudo pedir la autorización')

      /* Se pregunta cada cuatro segundos hasta que apruebe en su app. Wompi
         caduca el token si no lo toca, así que a los tres minutos se para de
         preguntar en vez de dejar el móvil girando para siempre. */
      const hasta = Date.now() + 3 * 60000
      sondeo.current = setInterval(async () => {
        try {
          const q = await fetch(`/api/pagos/wompi/nequi?token=${encodeURIComponent(d.tokenId)}`)
          const e = await q.json()
          if (e.guardado) {
            clearInterval(sondeo.current)
            setRotulo(e.rotulo || 'Nequi')
            setPaso('listo')
          } else if (e.estado === 'DECLINED' || e.estado === 'VOIDED') {
            clearInterval(sondeo.current)
            setPaso('form')
            setError('No se autorizó desde Nequi. Puedes intentarlo otra vez.')
          } else if (Date.now() > hasta) {
            clearInterval(sondeo.current)
            setPaso('form')
            setError('Se pasó el tiempo de espera. Vuelve a intentarlo y acepta la notificación de Nequi.')
          }
        } catch { /* un fallo de red suelto no rompe la espera */ }
      }, 4000)
    } catch (e) {
      setPaso('form')
      setError(e.message)
    }
  }

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

  /* ⚠ MIENTRAS LA HOJA ESTÁ ABIERTA, LA PÁGINA DE DETRÁS NO SE MUEVE.
   *
   * Reportado por el dueño tras guardar su medio de pago: «el pop up se
   * desplaza demasiado hacia abajo, se puede correr demasiado hacia abajo». No
   * era la hoja: era la pantalla del plan, que es larga y seguía haciendo
   * scroll bajo el dedo, arrastrando la hoja con ella.
   *
   * ⚠ `overflow: hidden` SOLO NO BASTA, y está medido en este repo: con él
   * puesto en `html` y `body`, la página seguía desplazándose. Lo comprobé otra
   * vez aquí — con el body en `hidden`, un gesto de scroll movía la página
   * 1.188 píxeles. Lo que la fija es la ALTURA: sin `height: 100%` el `<html>`
   * sigue midiendo más que la ventana. Ver la nota larga en
   * `app/(dashboard)/asistente/page.jsx`, que ya se topó con esto.
   *
   * Se guarda lo que había y se repone al cerrar: dejar el documento bloqueado
   * deja la app muerta. */
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const antes = {
      hOverflow: html.style.overflow, hAlto: html.style.height,
      bOverflow: body.style.overflow, bAlto: body.style.height,
    }
    html.style.overflow = 'hidden'
    html.style.height = '100%'
    body.style.overflow = 'hidden'
    body.style.height = '100%'
    return () => {
      html.style.overflow = antes.hOverflow
      html.style.height = antes.hAlto
      body.style.overflow = antes.bOverflow
      body.style.height = antes.bAlto
    }
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
      {/* ⚠ Y LA HOJA TIENE TECHO, CON SU PROPIO SCROLL. Sin `max-height` crecía
          con el contenido —el botón de Wompi tarda en aparecer y lo estira— y
          se salía por abajo.

          `dvh` va en el `style` y `vh` en la clase, no las dos en la clase: ya
          nos pasó que `max-h-[90vh]` le ganaba a `[90dvh]` por el orden de la
          hoja generada. Así el inline manda donde `dvh` existe, y donde no,
          queda el `vh` de respaldo. */}
      <div
        className="w-full sm:max-w-[380px] rounded-t-[20px] sm:rounded-[20px] p-5 space-y-4 max-h-[88vh] overflow-y-auto"
        style={{
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          maxHeight: '88dvh', WebkitOverflowScrolling: 'touch',
        }}
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
            'Tus datos los guarda Wompi, la pasarela. Nosotros no los vemos.',
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
            {paso === 'listo' ? (
              <div className="rounded-[12px] px-3 py-3 text-center" style={{
                background: 'color-mix(in srgb, var(--cf-green-dark) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--cf-green-dark) 25%, transparent)',
              }}>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--cf-ink)' }}>
                  Listo, quedó guardado {rotulo}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                  Cada mes se cobra solo. Lo puedes quitar cuando quieras desde esta pantalla.
                </p>
                <button type="button" onClick={onCerrar}
                  className="mt-2 h-9 px-4 rounded-[12px] text-[12px] font-bold"
                  style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}>
                  Cerrar
                </button>
              </div>
            ) : paso === 'esperando' ? (
              <div className="rounded-[12px] px-3 py-3 text-center" style={{ background: 'var(--cf-fill)' }}>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--cf-ink)' }}>
                  Te llegó una notificación a Nequi
                </p>
                <p className="text-[12px] mt-1 leading-relaxed" style={{ color: 'var(--cf-ink-2)' }}>
                  Ábrela y acepta para que quede guardado. Aquí me entero solo, no cierres esta ventana.
                </p>
                <p className="text-[11px] mt-2" style={{ color: 'var(--cf-ink-3)' }}>Esperando tu confirmación…</p>
              </div>
            ) : (
              <>
                {/* ⚠ NEQUI PRIMERO, Y NO POR GUSTO: ocho de las últimas doce
                    suscripciones se cobraron por ahí. La tarjeta va debajo. */}
                <label className="block text-[12px] font-semibold" style={{ color: 'var(--cf-ink-2)' }}>
                  Tu número de Nequi
                  <div className="flex gap-2 mt-1">
                    <input
                      value={tel}
                      onChange={(e) => setTel(e.target.value)}
                      inputMode="numeric"
                      placeholder="3001234567"
                      className="flex-1 h-11 rounded-[12px] px-3 text-[15px]"
                      style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }}
                    />
                    <button type="button" onClick={pedirNequi}
                      className="h-11 px-4 rounded-[12px] text-[13px] font-bold whitespace-nowrap"
                      style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}>
                      Guardar
                    </button>
                  </div>
                </label>
                <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
                  Te llega una notificación a tu app de Nequi para que la autorices. No se cobra nada ahora.
                </p>

                {/* ⚠ EL WIDGET DE TARJETA SE QUEDA, PERO NO SE DEPENDE DE ÉL: en
                    modo tokenización no devuelve el token en Colombia. Si algún
                    día deja de pintar el botón, no se pierde nada. */}
                <div className="pt-1" style={{ borderTop: '1px solid var(--cf-hairline)' }}>
                  <p className="text-[11px] mt-2 mb-1" style={{ color: 'var(--cf-ink-3)' }}>O con tarjeta:</p>
                  <form ref={formRef} action="/api/pagos/wompi/token" method="POST" className="flex justify-center">
                    <input type="hidden" name="plan" value={plan} />
                  </form>
                  {!publicKey && (
                    <p className="text-[12px] text-center" style={{ color: 'var(--cf-ink-3)' }}>Cargando…</p>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {paso === 'form' && (
          <button
            type="button"
            onClick={onPagoUnico}
            className="w-full h-10 rounded-[12px] text-[12px] font-medium"
            style={{ color: 'var(--cf-ink-3)' }}
          >
            Prefiero pagar una sola vez
          </button>
        )}
      </div>
    </div>
  )
}
