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
//
// ⚠ CON UN COBRO RECHAZADO SÍ ES UN AVISO, Y CON BOTONES. Desde el 12 sep 2026
// el rechazo cierra el acceso al vencer (ver `lib/cobro-automatico.js`). Quien
// lo ve aquí todavía está a tiempo: recarga y reintenta, o cambia el medio.

import { useEffect, useState } from 'react'
import { useReintentarCobro } from '@/components/pagos/useReintentarCobro'

/** @param {{ onCambiar?: () => void }} props  abre la hoja para guardar otro medio */
export default function MedioDePagoGuardado({ onCambiar } = {}) {
  const [estado, setEstado] = useState(null)
  const [quitando, setQuitando] = useState(false)
  /* Pagado: se recarga entera para que la fecha nueva y el token salgan juntos.
     Sin la query: con `?suscribir=1` la hoja se volvería a abrir sola. */
  const { fase, mensaje, reintentar } = useReintentarCobro({ onPagado: () => window.location.replace(window.location.pathname) })

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

  const cobrando = fase === 'cobrando' || fase === 'pagado'

  return (
    <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--cf-hairline)' }}>
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[12px]" style={{ color: 'var(--cf-ink-2)' }}>
        Se cobra solo con <strong>{f.rotulo}</strong>
      </span>
      {/* Los rechazos se enseñan porque el cliente es el único que puede
          arreglarlos: sin fondos, tarjeta vencida, Nequi sin saldo. */}
      {f.fallos > 0 && !f.rechazo && (
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

    {f.rechazo && (
      <div className="mt-2 rounded-[12px] px-3 py-2.5" style={{
        background: 'var(--cf-red-pill-bg)', border: '1px solid var(--cf-red-pill-border)',
      }}>
        <p className="text-[13px] font-semibold" style={{ color: 'var(--cf-red-dark)' }}>
          No pudimos cobrar tu plan
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: 'var(--cf-ink-2)' }}>
          {f.rechazo.motivo} Si no se paga antes de que venza, se cierra el acceso.
        </p>
        {estado.esDueno && (
          <>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <button
                type="button"
                onClick={reintentar}
                disabled={cobrando}
                className="h-9 px-3 rounded-[10px] text-[13px] font-semibold flex items-center gap-1.5 disabled:opacity-60"
                style={{ background: 'var(--cf-red-dark)', color: '#fff' }}
              >
                <svg className={`w-3.5 h-3.5 ${cobrando ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                {fase === 'pagado' ? 'Pagado' : cobrando ? 'Cobrando…' : 'Reintentar el cobro'}
              </button>
              {onCambiar && (
                <button
                  type="button"
                  onClick={onCambiar}
                  disabled={cobrando}
                  className="h-9 px-3 rounded-[10px] text-[13px] font-medium disabled:opacity-60"
                  style={{ border: '1px solid var(--cf-hairline)', color: 'var(--cf-ink)' }}
                >
                  Cambiar medio
                </button>
              )}
            </div>
            <p aria-live="polite" className="text-[12px] mt-1.5 empty:hidden" style={{ color: 'var(--cf-ink-3)' }}>
              {fase === 'cobrando' ? 'Estamos cobrando. Tarda unos segundos.' : mensaje}
            </p>
          </>
        )}
      </div>
    )}
    </div>
  )
}
