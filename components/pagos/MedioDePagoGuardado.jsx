'use client'
// components/pagos/MedioDePagoGuardado.jsx — «que se cobre solo».
//
// ══ POR QUÉ ════════════════════════════════════════════════════════════════
//
// Medido el 1 sep 2026: de los que pagaron en julio volvió a pagar en agosto el
// 64 %, y 25 de los 59 negocios que han pagado alguna vez pagaron UNA sola vez.
// Cada mes había que volver a venderle a cada cliente, y un prestamista ocupado
// no vuelve a entrar a pagar: simplemente deja de pagar.
//
// ⚠ EL WIDGET SE MONTA COMO FORMULARIO, NO COMO BOTÓN NUESTRO. El modo
// tokenización de Wompi no tiene callback de JavaScript: pinta su propio botón
// dentro de un `<form>` y al terminar hace un POST a su `action`. Por eso aquí
// hay un formulario con un `<script>` dentro y no un `onClick`.
//
// ⚠ Y EL SCRIPT SE INYECTA A MANO. React no ejecuta un `<script>` puesto en el
// JSX: lo pinta como etiqueta muerta y el botón no aparece nunca. Hay que
// crearlo con `document.createElement` y colgarlo del formulario.

import { useEffect, useRef, useState } from 'react'
import { Tarjeta, Pastilla, BotonSecundario } from '@/components/cf/primitivos'

export default function MedioDePagoGuardado() {
  const [estado, setEstado] = useState(null)
  const [quitando, setQuitando] = useState(false)
  const formRef = useRef(null)

  const cargar = () =>
    fetch('/api/pagos/wompi/fuente')
      .then((r) => (r.ok ? r.json() : null))
      .then(setEstado)
      .catch(() => setEstado(null))

  useEffect(() => { cargar() }, [])

  /* El script del widget solo se cuelga cuando NO hay medio guardado y el que
     mira es el dueño. Montarlo siempre pintaría un segundo botón encima de la
     tarjeta que ya dice cuál está puesto. */
  useEffect(() => {
    const form = formRef.current
    if (!form || !estado?.publicKey || !estado?.esDueno || estado?.fuente) return
    if (form.querySelector('script')) return
    const s = document.createElement('script')
    s.src = 'https://checkout.wompi.co/widget.js'
    s.setAttribute('data-render', 'button')
    s.setAttribute('data-widget-operation', 'tokenize')
    s.setAttribute('data-public-key', estado.publicKey)
    form.appendChild(s)
  }, [estado])

  if (!estado?.configurado) return null

  const quitar = async () => {
    if (!confirm('¿Quitar el medio de pago? Volverás a pagar a mano cada mes.')) return
    setQuitando(true)
    await fetch('/api/pagos/wompi/fuente', { method: 'DELETE' }).catch(() => {})
    await cargar()
    setQuitando(false)
  }

  const f = estado.fuente

  return (
    <Tarjeta style={{ gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>
          Que se cobre solo
        </span>
        {f && <Pastilla tono={f.activo ? 'aldia' : 'neutro'}>{f.activo ? 'Activo' : 'Pausado'}</Pastilla>}
        {/* Los rechazos se enseñan porque el cliente es el único que puede
            arreglarlos: sin fondos, tarjeta vencida, Nequi sin saldo. */}
        {f?.fallos > 0 && <Pastilla tono="mora">{f.fallos} intento{f.fallos === 1 ? '' : 's'} rechazado{f.fallos === 1 ? '' : 's'}</Pastilla>}
      </div>

      {f ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--cf-ink-2)' }}>
            Se cobra con <strong>{f.rotulo}</strong> el día que vence tu plan. No tienes que hacer nada.
          </p>
          {estado.esDueno && (
            <BotonSecundario onClick={quitar} disabled={quitando} style={{ alignSelf: 'flex-start' }}>
              {quitando ? 'Quitando…' : 'Quitar el medio de pago'}
            </BotonSecundario>
          )}
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.45 }}>
            Guarda tu tarjeta o tu Nequi una sola vez y el plan se renueva solo.
            Lo puedes quitar cuando quieras.
          </p>
          {estado.esDueno ? (
            /* El `action` es el receptor: el widget hace un POST de formulario
               al terminar, no una llamada de JavaScript. */
            <form ref={formRef} method="POST" action="/api/pagos/wompi/token" />
          ) : (
            <p style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>
              Solo el dueño de la cuenta puede guardarlo.
            </p>
          )}
        </>
      )}
    </Tarjeta>
  )
}
