'use client'
// components/pagos/AdicionalesPlan.jsx — «Cobradores y rutas adicionales» en
// Mi plan: cuántos tiene, cuánto cuestan y cómo agregar o quitar.
//
// Nació de la pregunta del dueño el 24 sep 2026: «¿cómo haría una persona que
// quiere comprar el plan de crecimiento pero añadirle un cobrador extra?». No
// había forma. Las reglas viven en lib/adicionales.js; aquí solo se enseñan:
//   · con el plan pagado, agregar cobra YA los días que faltan para renovar
//     (Wompi) y el cupo se abre cuando el pago se aprueba
//   · sin plan pagado se eligen libres: el botón de pagar el plan ya los suma
//   · quitar es al instante y lo pagado no se devuelve
//   · fuera de Wompi se piden por WhatsApp

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { PLANES_CONFIG } from '@/lib/planes'
import { formatMoney } from '@/lib/i18n'
import { prorrateoAdicionales, precioAdicionales } from '@/lib/precio-plan'

const WHATSAPP_SOPORTE = '573011993001'

const cuantos = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
const fechaLarga = (f) => new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' })

const TIPOS = [
  {
    clave: 'cobradores',
    titulo: 'Cobradores',
    uno: 'cobrador', varios: 'cobradores', cada: 'cada uno',
    precio: (d) => d.precios.cobrador,
    uso: (d) => `${d.usados.usuarios} de ${d.cupo.usuarios} usuarios en uso`,
    icono: 'M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z',
  },
  {
    clave: 'rutas',
    titulo: 'Rutas',
    uno: 'ruta', varios: 'rutas', cada: 'cada una',
    precio: (d) => d.precios.ruta,
    uso: (d) => `${d.usados.rutas} de ${d.cupo.rutas} rutas en uso`,
    icono: 'M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z',
  },
]

function BotonPaso({ etiqueta, onClick, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      onClick={onClick}
      disabled={disabled}
      className="w-9 h-9 rounded-[10px] flex items-center justify-center transition-[background-color,opacity] duration-150 active:opacity-80 disabled:opacity-35"
      style={{ background: 'var(--cf-surface)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }}
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        {children}
      </svg>
    </button>
  )
}

/**
 * @param {object}   props
 * @param {number}   [props.cobroMensual] lo que se cobra hoy al mes (plan + adicionales), de /api/pagos/estado
 * @param {string}   [props.orgNombre]
 * @param {Function} [props.onCambio]     para que la pantalla vuelva a pedir precios y uso
 */
export default function AdicionalesPlan({ cobroMensual = null, orgNombre = '', onCambio }) {
  const searchParams = useSearchParams()
  /* De vuelta de Wompi: `antes` es cuántos tenía al pagar (lo pone el servidor
     en la URL de vuelta). Sin él no se puede decir «listo» con verdad. */
  const antesParam = searchParams.get('antes')
  const vieneDePagar = searchParams.get('wompi') === 'adicionales' && antesParam != null && antesParam !== ''
  const antes = Number(antesParam) || 0

  const [datos, setDatos] = useState(null)
  const [agregar, setAgregar] = useState({ cobradores: 0, rutas: 0 })
  const [quitar, setQuitar] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const [confirmacion, setConfirmacion] = useState(vieneDePagar ? 'esperando' : null)
  const tarjeta = useRef(null)

  const cargar = useCallback(async () => {
    const r = await fetch('/api/plan/adicionales').catch(() => null)
    if (!r?.ok) return null
    const d = await r.json()
    setDatos(d)
    return d
  }, [])

  useEffect(() => { cargar() }, [cargar])

  /* De vuelta de Wompi: el cupo lo abre el webhook segundos después. Se
     pregunta un rato para decir «listo» sin obligar a recargar. */
  useEffect(() => {
    if (!vieneDePagar) return
    let vueltas = 0
    let vivo = true
    const id = setInterval(async () => {
      vueltas++
      const d = await cargar()
      if (!vivo) return
      const ahora = d ? d.adicionales.cobradores + d.adicionales.rutas : 0
      if (d && ahora > antes) {
        clearInterval(id)
        setConfirmacion('listo')
        onCambio?.()
      } else if (vueltas >= 20) {
        clearInterval(id)
        setConfirmacion('tarda')
      }
    }, 3000)
    return () => { vivo = false; clearInterval(id) }
  }, [vieneDePagar, antes, cargar, onCambio])

  /* «Agregar un cobrador» desde Cobradores o Rutas llega con #adicionales:
     la tarjeta aparece después de cargar, así que el salto se hace a mano.
     ⚠ Con `scrollIntoView` quedaba en top 0, DEBAJO de la cabecera fija del
     armazón, que le tapaba el título (medido en el espejo a 412 px): se baja
     a mano dejando el alto de la cabecera libre. */
  useEffect(() => {
    if (!datos?.admite || typeof window === 'undefined') return
    if (window.location.hash !== '#adicionales' || !tarjeta.current) return
    const y = tarjeta.current.getBoundingClientRect().top + window.scrollY - 96
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
  }, [datos?.admite])

  if (!datos?.admite) return null

  const nombrePlan = PLANES_CONFIG[datos.plan]?.nombre ?? datos.plan
  const enWompi = datos.gateway === 'wompi'
  const puedeCambiar = datos.esDueno && enWompi
  const pendiente = agregar.cobradores + agregar.rutas > 0
  const cotizacion = pendiente && datos.pagado
    ? prorrateoAdicionales(agregar, datos.plan, datos.country, datos.vence)
    : null
  const mensualTrasAgregar = cobroMensual != null && cotizacion
    ? cobroMensual + precioAdicionales(agregar, datos.plan, datos.country)
    : null

  /* Uno más o uno menos, sobre lo que hay en la base (no la cifra que se ve:
     puede venir de antes de que el webhook sumara uno pagado). */
  const cambiar = async (tipo, delta) => {
    setOcupado(true)
    setError('')
    try {
      const r = await fetch('/api/plan/adicionales', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, delta }),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error ?? 'No se pudo cambiar'); return false }
      setDatos(d)
      onCambio?.()
      return true
    } catch {
      setError('Error de conexión.')
      return false
    } finally {
      setOcupado(false)
    }
  }

  const sumar = (tipo) => {
    setError('')
    if (datos.pagado) {
      setAgregar(a => ({ ...a, [tipo]: a[tipo] + 1 }))
    } else {
      cambiar(tipo, 1)
    }
  }

  const restar = (tipo) => {
    setError('')
    if (agregar[tipo] > 0) { setAgregar(a => ({ ...a, [tipo]: a[tipo] - 1 })); return }
    if (datos.pagado) setQuitar(tipo)
    else cambiar(tipo, -1)
  }

  /* Si no se pudo (queda por debajo de lo que está en uso), el motivo sale
     debajo de la tarjeta: el diálogo se cierra igual. */
  const confirmarQuitar = async () => {
    await cambiar(quitar, -1)
    setQuitar(null)
  }

  const pagar = async () => {
    setOcupado(true)
    setError('')
    try {
      const r = await fetch('/api/pagos/wompi/adicionales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agregar),
      })
      const d = await r.json()
      if (!r.ok) { setError(d.error ?? 'No se pudo crear el pago'); setOcupado(false); return }
      const form = document.createElement('form')
      form.method = 'GET'
      form.action = d.checkoutUrl
      const campos = {
        'public-key': d.publicKey,
        currency: d.moneda,
        'amount-in-cents': String(d.montoCentavos),
        reference: d.referencia,
        'signature:integrity': d.firma,
        'redirect-url': d.redirectUrl,
      }
      for (const [name, value] of Object.entries(campos)) {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = name
        input.value = value
        form.appendChild(input)
      }
      document.body.appendChild(form)
      form.submit()
    } catch {
      setError('Error de conexión.')
      setOcupado(false)
    }
  }

  const pedirPorWhatsApp = () => {
    const cuenta = orgNombre ? ` de mi cuenta "${orgNombre}"` : ''
    const msg = `Hola, quiero agregar cobradores o rutas adicionales a mi plan ${nombrePlan}${cuenta}.`
    window.open(`https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
  }

  const tipoQuitar = TIPOS.find(t => t.clave === quitar)
  const regalos = [
    datos.regalados.cobradores > 0 && cuantos(datos.regalados.cobradores, 'cobrador', 'cobradores'),
    datos.regalados.rutas > 0 && cuantos(datos.regalados.rutas, 'ruta', 'rutas'),
  ].filter(Boolean)

  return (
    <div
      id="adicionales"
      ref={tarjeta}
      className="rounded-[20px] cf-card-shadow p-4 space-y-3"
      style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] font-mono-display" style={{ color: 'var(--cf-ink-3)' }}>
        Cobradores y rutas adicionales
      </p>

      {confirmacion && (
        <div className="rounded-[12px] px-3 py-2.5 text-[12px] leading-relaxed" style={{
          background: `color-mix(in srgb, ${confirmacion === 'listo' ? 'var(--cf-green-dark)' : 'var(--cf-ink-3)'} 10%, transparent)`,
          color: 'var(--cf-ink)',
        }}>
          {confirmacion === 'listo'
            ? 'Listo: tu pago se confirmó y el cupo ya está disponible.'
            : confirmacion === 'tarda'
            ? 'Wompi todavía no confirma el pago. Si ya pagaste, recarga en un minuto; si no aparece, escríbenos.'
            : 'Estamos confirmando tu pago con Wompi. Tarda unos segundos.'}
        </div>
      )}

      <p className="text-[13px] leading-relaxed" style={{ color: 'var(--cf-ink-2)' }}>
        Tu plan {nombrePlan} trae {cuantos(datos.incluidos.usuarios, 'usuario', 'usuarios')} y {cuantos(datos.incluidos.rutas, 'ruta', 'rutas')}.
        {regalos.length > 0 && ` Además tienes de regalo ${regalos.join(' y ')}.`}
        {' '}Si necesitas más, agrégalos aquí: van con cada pago del plan.
      </p>

      <div className="space-y-2">
        {TIPOS.map((t) => {
          const tiene = datos.adicionales[t.clave]
          const extra = agregar[t.clave]
          return (
            <div key={t.clave} className="flex items-center gap-3 rounded-[12px] px-3 py-2.5" style={{ background: 'var(--cf-surface)' }}>
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" style={{ color: 'var(--cf-ink-3)' }} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={t.icono} />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold" style={{ color: 'var(--cf-ink)' }}>{t.titulo}</p>
                <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
                  {formatMoney(t.precio(datos))}/mes {t.cada} · {t.uso(datos)}
                </p>
              </div>
              {puedeCambiar ? (
                <div className="flex items-center gap-2 shrink-0">
                  <BotonPaso etiqueta={`Quitar ${t.clave === 'rutas' ? 'una' : 'un'} ${t.uno}`} onClick={() => restar(t.clave)} disabled={ocupado || (tiene === 0 && extra === 0)}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                  </BotonPaso>
                  <span className="w-8 text-center text-[19px] font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
                    {tiene + extra}
                  </span>
                  <BotonPaso etiqueta={`Agregar ${t.clave === 'rutas' ? 'una' : 'un'} ${t.uno}`} onClick={() => sumar(t.clave)} disabled={ocupado}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                  </BotonPaso>
                </div>
              ) : (
                <span className="text-[19px] font-bold font-mono-display shrink-0" style={{ color: 'var(--cf-ink)' }}>{tiene}</span>
              )}
            </div>
          )
        })}
      </div>

      {datos.mensual > 0 && !pendiente && (
        <p className="text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>
          Tus adicionales suman {formatMoney(datos.mensual)}/mes al plan.
        </p>
      )}

      {puedeCambiar && !datos.pagado && (
        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--cf-ink-3)' }}>
          Se pagan junto con tu plan: el botón de pagar de arriba ya los suma.
        </p>
      )}

      {cotizacion && (
        <div className="rounded-[12px] p-3 space-y-3" style={{ border: '1px solid var(--cf-border)' }}>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--cf-ink-2)' }}>
            Pagas hoy <strong style={{ color: 'var(--cf-ink)' }}>{formatMoney(cotizacion.monto)}</strong> por
            {' '}{cuantos(cotizacion.dias, 'día', 'días')} hasta el {fechaLarga(datos.vence)}, cuando renueva tu plan.
            {mensualTrasAgregar != null && <> Desde ahí pagas <strong style={{ color: 'var(--cf-ink)' }}>{formatMoney(mensualTrasAgregar)}/mes</strong>.</>}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAgregar({ cobradores: 0, rutas: 0 })}
              disabled={ocupado}
              className="h-11 px-4 rounded-[12px] text-[13px] font-semibold transition-opacity duration-150 active:opacity-80"
              style={{ background: 'var(--cf-surface)', color: 'var(--cf-ink-2)', border: '1px solid var(--cf-border)' }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={pagar}
              disabled={ocupado}
              className="flex-1 h-11 rounded-[12px] text-[14px] font-bold transition-opacity duration-150 active:opacity-90 disabled:opacity-60"
              style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}
            >
              {ocupado ? 'Abriendo Wompi…' : `Pagar ${formatMoney(cotizacion.monto)}`}
            </button>
          </div>
        </div>
      )}

      {!enWompi && (
        <button
          type="button"
          onClick={pedirPorWhatsApp}
          className="w-full h-11 rounded-[12px] text-[13px] font-semibold flex items-center justify-center gap-2 transition-opacity duration-150 active:opacity-90"
          style={{ background: '#25D366', color: '#fff' }}
        >
          Pedir por WhatsApp
        </button>
      )}

      {enWompi && !datos.esDueno && (
        <p className="text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>
          Solo el dueño de la cuenta puede cambiarlos.
        </p>
      )}

      {error && (
        <p className="text-[12px] font-medium" style={{ color: 'var(--cf-red-dark)' }} role="alert">{error}</p>
      )}

      <ConfirmModal
        open={!!tipoQuitar}
        title={tipoQuitar ? `¿Quitar ${tipoQuitar.clave === 'rutas' ? 'una' : 'un'} ${tipoQuitar.uno} adicional?` : ''}
        message={tipoQuitar && cobroMensual != null
          ? `Desde tu próximo cobro pagas ${formatMoney(Math.max(0, cobroMensual - tipoQuitar.precio(datos)))}/mes. Lo que ya pagaste no se devuelve.`
          : 'Deja de cobrarse desde tu próximo cobro. Lo que ya pagaste no se devuelve.'}
        confirmLabel="Quitar"
        loading={ocupado}
        onConfirm={confirmarQuitar}
        onCancel={() => setQuitar(null)}
      />
    </div>
  )
}
