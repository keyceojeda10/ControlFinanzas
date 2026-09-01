'use client'
// components/pagos/MedioDePagoGuardado.jsx — con qué se cobra el plan solo.
//
// ⚠ ESTO NO ES UN AVISO, ES UN DATO DEL PLAN.
//
// La primera versión era una tarjeta suelta arriba de la pantalla explicando la
// suscripción. El dueño: «ese aviso feo que pusiste arriba», «solamente veo un
// aviso que dice lo de la suscripción, pero no hay ningún botón». Tenía razón
// dos veces: un cartel que no se puede pulsar no es una opción, es ruido; y
// suscribirse tiene que ser un BOTÓN en el plan, no un texto aparte.
//
// Ahora esto vive DENTRO de la tarjeta del vencimiento y solo aparece cuando ya
// hay un medio guardado — porque entonces sí es información: con qué se va a
// cobrar y cómo quitarlo.

import { useEffect, useState } from 'react'

export default function MedioDePagoGuardado() {
  const [estado, setEstado] = useState(null)
  const [quitando, setQuitando] = useState(false)

  const cargar = () =>
    fetch('/api/pagos/wompi/fuente')
      .then((r) => (r.ok ? r.json() : null))
      .then(setEstado)
      .catch(() => setEstado(null))

  useEffect(() => { cargar() }, [])

  const f = estado?.fuente
  if (!f) return null   // sin medio guardado no hay nada que contar

  const quitar = async () => {
    if (!confirm('¿Quitar el medio de pago? Volverás a pagar a mano cada mes.')) return
    setQuitando(true)
    await fetch('/api/pagos/wompi/fuente', { method: 'DELETE' }).catch(() => {})
    await cargar()
    setQuitando(false)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap mt-2 pt-2" style={{ borderTop: '1px solid var(--cf-hairline)' }}>
      <span className="text-[12px]" style={{ color: 'var(--cf-ink-2)' }}>
        Se cobra solo con <strong>{f.rotulo}</strong>
      </span>
      {/* Los rechazos se enseñan porque el cliente es el único que puede
          arreglarlos: sin fondos, tarjeta vencida, Nequi sin saldo. */}
      {f.fallos > 0 && (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{
          background: 'var(--cf-red-pill-bg)', border: '1px solid var(--cf-red-pill-border)', color: 'var(--cf-red-dark)',
        }}>
          {f.fallos} rechazado{f.fallos === 1 ? '' : 's'}
        </span>
      )}
      {estado.esDueno && (
        <button
          type="button"
          onClick={quitar}
          disabled={quitando}
          className="text-[12px] underline disabled:opacity-50"
          style={{ color: 'var(--cf-ink-3)' }}
        >
          {quitando ? 'Quitando…' : 'Quitar'}
        </button>
      )}
    </div>
  )
}
