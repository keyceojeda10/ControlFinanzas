'use client'
/* ── «PARA ATENDER HOY» (2 nov 2026) ─────────────────────────────────────────
 *
 * Lo que abren el dueño y su familiar desde el WhatsApp de las 9 a. m. Una
 * tarjeta por negocio serio (lib/seguimiento/serios.js): qué hizo de verdad,
 * cuántos así pagan, el mensaje ya escrito para su momento y un botón que abre
 * WhatsApp con ese mensaje. Después, un toque para dejar dicho qué pasó.
 *
 * Sin sesión: el enlace va firmado por persona y por día (enlace-atender.js).
 * Fuera del armazón a propósito: es una herramienta de trabajo, no la app.
 */

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { enlaceWhatsApp, enlaceWaMe, esAndroid } from '@/lib/seguimiento/enlace-whatsapp'

const fechaCorta = (d) => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })
const haceCuanto = (d) => {
  const dias = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  return dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : `hace ${dias} días`
}
/* Colombia: 10 dígitos que empiezan por 3 → 57 delante. */
const numeroWa = (tel) => {
  const d = String(tel ?? '').replace(/\D/g, '')
  if (d.length === 10 && d.startsWith('3')) return `57${d}`
  return d.length >= 11 ? d : null
}
const TITULO_MOMENTO = { cita: 'Le prometimos una llamada', quiere_pagar: 'Preguntó cómo pagar', espera: 'Nos está esperando', precio: 'Preguntó el precio', decidir: 'Le toca decidir', enfrio: 'Se enfrió', cobrando: 'Ya está cobrando', arranco: 'Arrancó' }

function Dato({ cifra, rotulo }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span className="cf-fig" style={{ fontSize: 20, color: 'var(--cf-ink)' }}>{cifra}</span>
      <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>{rotulo}</span>
    </div>
  )
}

const BOTON_WA = {
  height: 52, borderRadius: 12, textDecoration: 'none', fontSize: 16, fontWeight: 800,
  display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 10px',
}

function Tarjeta({ f, resultados, onMarcar, marcando, android }) {
  const [texto, setTexto] = useState(f.mensaje)
  const wa = numeroWa(f.telefono)
  const caliente = f.nivel === 'caliente'
  return (
    <article style={{
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 16,
      borderLeft: `4px solid ${caliente ? 'var(--cf-gold)' : 'var(--cf-border-strong)'}`,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          height: 24, padding: '0 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center',
          fontSize: 12, fontWeight: 800,
          background: caliente ? 'var(--cf-gold-tint)' : 'var(--cf-fill)',
          color: caliente ? 'var(--cf-gold-text)' : 'var(--cf-ink-2)',
        }}>{caliente ? `Caliente · de cada 10 así, pagan ${f.deCada10}` : 'Pidió algo'}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: ['cita', 'quiere_pagar', 'espera', 'precio', 'decidir'].includes(f.momento) ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>
          {TITULO_MOMENTO[f.momento]}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--cf-ink)', overflowWrap: 'anywhere' }}>{f.negocio}</h2>
        <span style={{ fontSize: 14, color: 'var(--cf-ink-2)', overflowWrap: 'anywhere' }}>
          {f.nombre ?? 'Sin nombre'} · {f.telefono ?? 'sin teléfono'} · se registró {haceCuanto(f.registro)}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        <Dato cifra={f.prestamos} rotulo="préstamos" />
        <Dato cifra={f.diasCobro} rotulo="días cobrando" />
        <Dato cifra={f.diasEntra} rotulo="días que entró" />
        <Dato cifra={f.diasParaVencer == null ? '—' : f.diasParaVencer < 0 ? 'vencida' : `${f.diasParaVencer} d`} rotulo={f.vence ? `vence ${fechaCorta(f.vence)}` : 'prueba'} />
      </div>

      <p style={{ margin: 0, fontSize: 13, color: 'var(--cf-ink-3)' }}>
        Por qué sale: {f.razon}. {f.diasSinEntrar >= 1 ? `Última vez en la app: ${f.ultimaEntrada ? haceCuanto(f.ultimaEntrada) : 'nunca'}.` : 'Entró hoy.'}
      </p>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>Mensaje (lo puedes cambiar)</span>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} style={{
          font: 'inherit', fontSize: 16, lineHeight: 1.45, color: 'var(--cf-ink)', background: 'var(--cf-surface)',
          border: '1px solid var(--cf-border)', borderRadius: 12, padding: 12, resize: 'vertical',
        }} />
      </label>

      {/* En Android se elige la app: el Business es el de Control Finanzas y
          va primero; `wa.me` solo abría el normal (lib/seguimiento/enlace-whatsapp). */}
      {wa && android ? (
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 8 }}>
          <a href={enlaceWhatsApp(wa, texto, 'business')} style={{ ...BOTON_WA, background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}>
            WhatsApp Business
          </a>
          <a href={enlaceWhatsApp(wa, texto, 'normal')} style={{ ...BOTON_WA, background: 'var(--cf-card)', color: 'var(--cf-ink)', border: '1px solid var(--cf-border-strong)' }}>
            WhatsApp
          </a>
        </div>
      ) : wa ? (
        <a href={enlaceWaMe(wa, texto)} target="_blank" rel="noopener noreferrer" style={{ ...BOTON_WA, background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)' }}>
          Escribirle por WhatsApp
        </a>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--cf-red-dark)' }}>No tiene un teléfono que sirva para WhatsApp.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>¿Qué pasó?</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
          {Object.entries(resultados).map(([clave, rotulo]) => {
            const activo = f.atencion?.resultado === clave
            return (
              <button key={clave} type="button" disabled={marcando} onClick={() => onMarcar(f.organizationId, clave)} style={{
                minHeight: 44, borderRadius: 12, font: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                background: activo ? 'var(--cf-ink)' : 'var(--cf-card)', color: activo ? 'var(--cf-card)' : 'var(--cf-ink)',
                border: activo ? '1px solid var(--cf-ink)' : '1px solid var(--cf-border-strong)',
              }}>{rotulo}</button>
            )
          })}
        </div>
        {f.atencion && (
          <span style={{ fontSize: 13, color: 'var(--cf-ink-3)' }}>
            Último: {resultados[f.atencion.resultado] ?? f.atencion.resultado} · {f.atencion.quien ?? '—'} · {haceCuanto(f.atencion.cuando)}
          </span>
        )}
      </div>
    </article>
  )
}

function Lista() {
  const sp = useSearchParams()
  const firma = { q: sp.get('q'), d: sp.get('d'), k: sp.get('k') }
  const consulta = new URLSearchParams(Object.entries(firma).filter(([, v]) => v)).toString()
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState(null)
  // Después de montar: en el servidor no hay `navigator`.
  const [android, setAndroid] = useState(false)
  useEffect(() => { setAndroid(esAndroid(navigator.userAgent)) }, [])
  const [marcando, setMarcando] = useState(false)

  const cargar = useCallback(() => {
    fetch(`/api/atender?${consulta}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'No se pudo cargar'); setDatos(d) })
      .catch((e) => setError(e.message))
  }, [consulta])
  useEffect(() => { cargar() }, [cargar])

  const marcar = async (organizationId, resultado) => {
    setMarcando(true)
    try {
      const r = await fetch('/api/atender', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...firma, organizationId, resultado }) })
      if (!r.ok) throw new Error((await r.json()).error || 'No se guardó')
      setDatos((d) => ({ ...d, filas: d.filas.map((f) => f.organizationId === organizationId ? { ...f, atencion: { resultado, quien: d.quien, cuando: new Date().toISOString() } } : f) }))
    } catch (e) { setError(e.message) } finally { setMarcando(false) }
  }

  if (error && !datos) return <p style={{ fontSize: 16, color: 'var(--cf-ink-2)' }}>{error}</p>
  if (!datos) return <p style={{ fontSize: 16, color: 'var(--cf-ink-3)' }}>Cargando…</p>

  /* Pendiente: sin atender, o atendido hace más de 2 días sin respuesta final.
     «Pagó» y «No le interesa» no vuelven a la lista de pendientes. */
  const cerrado = (a) => a && (a.resultado === 'pago' || a.resultado === 'no_interesa')
  const pendientes = datos.filas.filter((f) => !cerrado(f.atencion) && (!f.atencion || Date.now() - new Date(f.atencion.cuando).getTime() > 2 * 86400000))
  const atendidos = datos.filas.filter((f) => !pendientes.includes(f))
  return (
    <>
      <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>Control Finanzas · {datos.quien}</span>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: 'var(--cf-ink)' }}>Para atender hoy</h1>
        <p style={{ margin: 0, fontSize: 15, color: 'var(--cf-ink-2)' }}>
          {pendientes.length === 0 ? 'No hay nadie pendiente. Los negocios serios que entren salen aquí.' : `${pendientes.length} ${pendientes.length === 1 ? 'negocio serio' : 'negocios serios'} por atender, primero los que tienen que decidir.`}
        </p>
      </header>
      {error && <p style={{ margin: 0, fontSize: 14, color: 'var(--cf-red-dark)' }}>{error}</p>}
      {pendientes.map((f) => <Tarjeta key={f.organizationId} f={f} resultados={datos.resultados} onMarcar={marcar} marcando={marcando} android={android} />)}
      {atendidos.length > 0 && (
        <>
          <h2 style={{ margin: '12px 0 0', fontSize: 16, fontWeight: 800, color: 'var(--cf-ink-2)' }}>Ya atendidos ({atendidos.length})</h2>
          {atendidos.map((f) => <Tarjeta key={f.organizationId} f={f} resultados={datos.resultados} onMarcar={marcar} marcando={marcando} android={android} />)}
        </>
      )}
    </>
  )
}

export default function AtenderPage() {
  return (
    <main style={{ minHeight: '100dvh', background: 'var(--cf-surface)', fontFamily: 'var(--font-manrope), system-ui, sans-serif' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Suspense fallback={null}><Lista /></Suspense>
      </div>
    </main>
  )
}
