'use client'

// app/(dashboard)/error.jsx — T23-01 «no podemos conectarnos».
//
// ══ LO QUE DECÍA Y LO QUE CALLABA ══════════════════════════════════════════
//
// «Error en la página · No pudimos cargar esta sección. Intenta de nuevo.»
//
// Dos frases que no contestan lo único que el cobrador se pregunta cuando esto
// aparece a media ruta: **¿perdí los cobros de hoy?**
//
// Y la respuesta es que NO —la app los guarda en el teléfono y los sube cuando
// vuelve la red, y eso lleva funcionando desde antes de este rediseño— pero la
// pantalla no lo decía en ningún sitio. El resultado en la calle es el peor
// posible: se deja de cobrar creyendo que la app está rota, o se vuelve a
// registrar lo mismo por si acaso.
//
// La lámina lo pone en la primera línea: «El problema es nuestro, no tuyo. Tus
// datos están seguros — nada de lo que registraste se perdió».
//
// ══ Y REINTENTA SOLO ═══════════════════════════════════════════════════════
//
// Un botón «Reintentar» pone el trabajo del lado de quien está en la calle. La
// lámina reintenta cada minuto y DICE cuándo fue el último intento; el botón se
// queda para quien no quiere esperar.

import { useEffect, useState, useCallback } from 'react'
import { useOffline } from '@/components/providers/OfflineProvider'

const CADA = 60_000

export default function DashboardError({ error, reset }) {
  const { isOnline, pendingCount } = useOffline()
  const [reloading, setReloading] = useState(false)
  const [ultimoIntento, setUltimoIntento] = useState(() => Date.now())
  const [ahora, setAhora] = useState(() => Date.now())

  const sinRed = !isOnline

  const intentar = useCallback(() => {
    setUltimoIntento(Date.now())
    if (sinRed) window.location.reload()
    else reset?.()
  }, [sinRed, reset])

  // Sin red: una sola recarga automática para que el service worker sirva el
  // HTML cacheado y la pantalla pueda leer de IndexedDB. La guarda de sesión
  // evita el bucle.
  useEffect(() => {
    if (!sinRed) return
    const clave = 'cf-offline-reload-' + window.location.pathname
    if (sessionStorage.getItem(clave)) return
    sessionStorage.setItem(clave, '1')
    setReloading(true)
    const t = setTimeout(() => window.location.reload(), 300)
    return () => clearTimeout(t)
  }, [sinRed])

  useEffect(() => {
    const alVolver = () => {
      for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
        const k = sessionStorage.key(i)
        if (k?.startsWith('cf-offline-reload-')) sessionStorage.removeItem(k)
      }
    }
    window.addEventListener('online', alVolver)
    return () => window.removeEventListener('online', alVolver)
  }, [])

  // El reintento solo, y el reloj que cuenta desde el último. El reloj corre
  // aparte para que «hace 18 segundos» no se quede congelado.
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000)
    const ciclo = setInterval(intentar, CADA)
    return () => { clearInterval(reloj); clearInterval(ciclo) }
  }, [intentar])

  if (reloading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-10 h-10 mx-auto mb-4 border-2 border-[var(--cf-gold)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--cf-ink-3)]">Cargando lo que tienes guardado…</p>
        </div>
      </div>
    )
  }

  const seg = Math.max(0, Math.round((ahora - ultimoIntento) / 1000))
  const desde = seg < 60
    ? `hace ${seg} ${seg === 1 ? 'segundo' : 'segundos'}`
    : `hace ${Math.round(seg / 60)} min`

  return (
    <div className="max-w-2xl lg:max-w-4xl mx-auto py-8 lg:py-14">
      <div className="flex items-start gap-4 lg:gap-5">
        <span aria-hidden className="shrink-0 w-11 h-11 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: 'color-mix(in srgb, var(--cf-red-dark) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--cf-red-dark) 20%, transparent)',
          }}>
          <svg className="w-6 h-6 lg:w-7 lg:h-7" fill="none" stroke="var(--cf-red-dark)" strokeWidth={1.6} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] lg:text-[32px] font-semibold tracking-[-.02em] leading-tight"
            style={{ fontFamily: 'var(--font-space-grotesk), system-ui', color: 'var(--cf-ink)', margin: 0 }}>
            No podemos conectarnos ahora mismo
          </h1>
          {/* LA FRASE QUE FALTABA. Va antes que cualquier boton: el que esta en
              la calle no necesita una accion, necesita saber si perdio el dia. */}
          <p className="text-[14px] lg:text-[15px] mt-2 leading-relaxed" style={{ color: 'var(--cf-ink-2)' }}>
            El problema es nuestro, no tuyo, y ya lo estamos mirando.{' '}
            <strong style={{ color: 'var(--cf-ink)' }}>Tus datos están seguros</strong>
            {' '}— nada de lo que registraste se perdió.
          </p>
        </div>
      </div>

      <div className="grid gap-3 mt-6 lg:mt-7 lg:grid-cols-2">
        {/* SEGUIR COBRANDO. Es la primera tarjeta y la unica dorada porque es lo
            que hay que hacer: la ruta no se para porque el servidor no conteste. */}
        <div className="rounded-[16px] p-4 lg:p-5" style={{
          background: 'var(--cf-card)',
          border: '1.5px solid var(--cf-gold)',
        }}>
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="var(--cf-gold-dark)" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <span className="text-[16px] font-bold" style={{ color: 'var(--cf-ink)' }}>Puedes seguir cobrando</span>
          </div>
          <p className="text-[13px] mt-2.5 leading-relaxed" style={{ color: 'var(--cf-ink-2)' }}>
            {pendingCount > 0
              ? <>Tienes <strong style={{ color: 'var(--cf-ink)' }}>{pendingCount} {pendingCount === 1 ? 'cobro guardado' : 'cobros guardados'}</strong> en este teléfono. Se suben solos cuando volvamos.</>
              : 'Lo que registres ahora se guarda en este teléfono y se sube solo cuando volvamos.'}
          </p>
          <a href="/cobros-hoy"
            className="inline-flex items-center mt-4 h-11 px-5 rounded-[12px] text-[15px] font-bold"
            style={{ background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}>
            Seguir sin conexión
          </a>
        </div>

        <div className="rounded-[16px] p-4 lg:p-5" style={{
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
        }}>
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="var(--cf-ink-2)" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-3.2-6.9M21 3v5h-5" />
            </svg>
            <span className="text-[16px] font-bold" style={{ color: 'var(--cf-ink)' }}>Volver a intentar</span>
          </div>
          {/* LO INTENTAMOS SOLOS. Un boton a secas le pasa el trabajo a quien
              esta en la calle; decir cuando fue el ultimo intento es lo que
              deja esperar tranquilo. */}
          <p className="text-[13px] mt-2.5 leading-relaxed" style={{ color: 'var(--cf-ink-2)' }}>
            Lo intentamos solos cada minuto. El último intento fue{' '}
            <strong style={{ color: 'var(--cf-ink)' }}>{desde}</strong>.
          </p>
          <button type="button" onClick={intentar}
            className="inline-flex items-center mt-4 h-11 px-5 rounded-[12px] text-[15px] font-semibold"
            style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)', color: 'var(--cf-ink)' }}>
            Intentar ahora
          </button>
        </div>
      </div>

      {/* LO QUE HAY GUARDADO, en negro. Solo cuando de verdad hay algo: un
          bloque que dice «0 esperando» es ruido. */}
      {pendingCount > 0 && (
        <div className="rounded-[16px] mt-3 px-5 py-4 flex items-center justify-between gap-4"
          style={{ background: '#15161A' }}>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: '#A3A8B2', margin: 0 }}>
              Guardado en este teléfono
            </p>
            <p className="text-[13px] mt-1.5" style={{ color: '#F3F3F6', margin: 0 }}>
              {pendingCount} {pendingCount === 1 ? 'cobro esperando' : 'cobros esperando'} subir.
              Se suben en orden apenas volvamos.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-[16px] mt-3 px-5 py-4 flex items-center justify-between gap-4"
        style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
        <span className="text-[13px]" style={{ color: 'var(--cf-ink-2)' }}>
          Si esto sigue en 10 minutos, escríbenos y te contamos qué pasa.
        </span>
        <a href="/soporte/nuevo" className="text-[13px] font-bold shrink-0" style={{ color: 'var(--cf-gold-dark)' }}>
          Escribirnos
        </a>
      </div>

      {/* Los detalles técnicos siguen, plegados: no son para el cobrador, son
          para cuando escribe a soporte y hay que preguntarle qué decía. */}
      {error?.message && (
        <details className="mt-5 rounded-[12px] p-3"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
          <summary className="text-xs cursor-pointer" style={{ color: 'var(--cf-ink-3)' }}>Detalles técnicos</summary>
          <pre className="mt-2 text-xs whitespace-pre-wrap break-words" style={{ color: 'var(--cf-red-dark)' }}>
            {error.message}{error.digest ? `\n\ndigest: ${error.digest}` : ''}
          </pre>
        </details>
      )}
    </div>
  )
}
