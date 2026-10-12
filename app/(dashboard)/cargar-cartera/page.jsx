'use client'
/* ── «QUE TE LA CARGUEMOS» ───────────────────────────────────────────────────
 *
 * Bloque 4 del plan de seguimiento (12 oct 2026). El dueño sube fotos del
 * cuaderno o de las cartulinas, el Excel o el PDF que tenga, todo junto y tal
 * cual, y un asesor se la deja cargada en máximo 24 horas. Lo de aquí solo
 * recibe: la lectura y la revisión pasan en el servidor y en el panel
 * (lib/carga-asesor/, /admin/cargas).
 *
 * El dato: de los que declaran más de 100 clientes, solo el 9 % llega a cargar
 * la cartera, y quien no la carga no paga.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCabecera } from '@/components/armazon/Armazon'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney } from '@/lib/i18n'

/* De cinco en cinco: treinta fotos del teléfono en una sola petición pueden
   pasar de 100 MB y el servidor la corta. Así además se ve que avanza. */
const POR_TANDA = 5
const ACEPTA = 'image/jpeg,image/png,image/webp,application/pdf,.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv'
const ABIERTA = ['recibida', 'leyendo', 'en_revision', 'importando']

const etiqueta = { fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--cf-ink-3)' }
const tarjeta = { background: 'var(--cf-card)', border: '1px solid var(--cf-border)', borderRadius: 18, padding: 16 }

function IconoArchivo({ tipo }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {tipo === 'imagen'
        ? <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 9" /></>
        : <><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5" /></>}
    </svg>
  )
}

export default function CargarCartera() {
  const router = useRouter()
  const { rol } = useAuth()
  useCabecera({ titulo: 'Que te la carguemos', subtitulo: 'Un asesor pasa tu cuaderno a la app', onVolver: () => router.back() })

  const [estado, setEstado] = useState({ cargando: true, solicitud: null, max: 40 })
  const [elegidos, setElegidos] = useState([])
  const [nota, setNota] = useState('')
  const [subiendo, setSubiendo] = useState(null) // { hechos, total }
  const [error, setError] = useState('')
  const [rechazados, setRechazados] = useState([])
  const input = useRef(null)

  const cargar = () => fetch('/api/carga-asesor')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('No pudimos ver tu carga'))))
    .then((j) => setEstado({ cargando: false, solicitud: j.solicitud, max: j.maxArchivos ?? 40 }))
    .catch((e) => { setEstado((s) => ({ ...s, cargando: false })); setError(e.message) })

  useEffect(() => { cargar() }, [])

  const elegir = (e) => {
    const nuevos = [...(e.target.files ?? [])]
    setElegidos((prev) => [...prev, ...nuevos])
    setError('')
    if (input.current) input.current.value = ''
  }
  const quitar = (i) => setElegidos((prev) => prev.filter((_, k) => k !== i))

  const mandar = async () => {
    if (!elegidos.length) return
    setError('')
    setRechazados([])
    setSubiendo({ hechos: 0, total: elegidos.length })
    const malos = []
    let ultima = null
    for (let i = 0; i < elegidos.length; i += POR_TANDA) {
      const fd = new FormData()
      for (const f of elegidos.slice(i, i + POR_TANDA)) fd.append('archivos', f, f.name)
      if (i === 0 && nota.trim()) fd.append('nota', nota.trim())
      try {
        const r = await fetch('/api/carga-asesor', { method: 'POST', body: fd })
        const j = await r.json().catch(() => ({}))
        if (!r.ok && !j.rechazados) throw new Error(j.error || 'No se pudo subir')
        malos.push(...(j.rechazados ?? []))
        if (j.solicitud) ultima = j.solicitud
      } catch (e) {
        setError(`${e.message}. Lo que ya subió quedó guardado; intenta de nuevo con el resto.`)
        setElegidos((prev) => prev.slice(i))
        setSubiendo(null)
        if (ultima) setEstado((s) => ({ ...s, solicitud: ultima }))
        return
      }
      setSubiendo({ hechos: Math.min(i + POR_TANDA, elegidos.length), total: elegidos.length })
    }
    setRechazados(malos)
    setElegidos([])
    setNota('')
    setSubiendo(null)
    if (ultima) setEstado((s) => ({ ...s, solicitud: ultima }))
    else cargar()
  }

  if (rol && rol !== 'owner') {
    return <p style={{ padding: 16, fontSize: 14, color: 'var(--cf-ink-2)' }}>Esto lo pide el administrador de la cuenta.</p>
  }
  if (estado.cargando) {
    return <div style={{ padding: 16 }}><div style={{ ...tarjeta, height: 160, opacity: 0.5 }} /></div>
  }

  const sol = estado.solicitud
  const abierta = sol && ABIERTA.includes(sol.estado)
  const cargada = sol?.estado === 'aprobada'
  const quedan = Math.max(0, estado.max - (abierta ? sol.archivos.length : 0))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0 32px', maxWidth: 560, margin: '0 auto', width: '100%' }}>
      {cargada && (
        <section style={{ ...tarjeta, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={etiqueta}>Tu cartera quedó cargada</span>
          <span className="cf-fig" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1, color: 'var(--cf-ink)' }}>
            {sol.cargado?.clientes ?? 0} clientes
          </span>
          {sol.cargado?.enLaCalle != null && (
            <span style={{ fontSize: 14, color: 'var(--cf-ink-2)' }}>{formatMoney(sol.cargado.enLaCalle)} en la calle</span>
          )}
          <Link href="/cobros-hoy" style={{
            height: 52, borderRadius: 14, background: 'var(--cf-gold)', color: 'var(--cf-gold-ink)', fontSize: 16, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
          }}>Ir a cobrar</Link>
        </section>
      )}

      {abierta && (
        <section style={{ ...tarjeta, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={etiqueta}>Recibimos tus archivos</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)', lineHeight: 1.4 }}>
            Un asesor está cargando tu cartera. Te avisamos por WhatsApp cuando quede lista, en máximo 24 horas.
          </span>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sol.archivos.map((a) => (
              <li key={a.n} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--cf-ink-2)', overflowWrap: 'anywhere' }}>
                <span style={{ color: 'var(--cf-ink-3)', flex: 'none', display: 'inline-flex' }}><IconoArchivo tipo={a.tipo} /></span>
                {a.nombre}
              </li>
            ))}
          </ul>
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>Si te faltó algo, súbelo abajo: se suma a la misma carga.</span>
        </section>
      )}

      {!abierta && !cargada && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--cf-ink)', lineHeight: 1.4 }}>
            Sube lo que tengas, tal cual: fotos del cuaderno o de las cartulinas, tu Excel o el PDF de otro sistema.
          </span>
          <span style={{ fontSize: 13, color: 'var(--cf-ink-2)', lineHeight: 1.5 }}>
            Un asesor revisa cada cliente y te la deja cargada en máximo 24 horas. Tu prueba de 7 días empieza cuando la recibas lista.
          </span>
        </section>
      )}

      {!cargada && (
        <section style={{ ...tarjeta, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <span style={etiqueta}>{abierta ? 'Agregar más archivos' : 'Tus archivos'}</span>
          <input ref={input} type="file" multiple accept={ACEPTA} onChange={elegir} style={{ display: 'none' }} />
          <button type="button" onClick={() => input.current?.click()} disabled={!!subiendo || quedan === 0} style={{
            minHeight: 96, borderRadius: 16, border: '1.5px dashed var(--cf-border)', background: 'var(--cf-surface)',
            color: 'var(--cf-ink)', font: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6, padding: 16,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ color: 'var(--cf-gold-dark)' }}>
              <path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v2.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V16" />
            </svg>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Elegir fotos o archivos</span>
            <span style={{ fontSize: 12, color: 'var(--cf-ink-3)' }}>Puedes elegir varios a la vez · hasta {quedan} más</span>
          </button>

          {elegidos.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {elegidos.map((f, i) => (
                <li key={`${f.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--cf-ink)' }}>
                  <span style={{ color: 'var(--cf-ink-3)', flex: 'none', display: 'inline-flex' }}><IconoArchivo tipo={f.type?.startsWith('image/') ? 'imagen' : 'doc'} /></span>
                  <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{f.name}</span>
                  {!subiendo && (
                    <button type="button" onClick={() => quitar(i)} aria-label={`Quitar ${f.name}`} style={{
                      width: 40, height: 40, borderRadius: 12, border: 0, background: 'transparent', color: 'var(--cf-ink-3)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!abierta && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-2)' }}>¿Algo que debamos saber? (opcional)</span>
              <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} maxLength={1000}
                placeholder="Por ejemplo: son dos rutas, la de la mañana y la de la tarde"
                style={{ borderRadius: 14, border: '1px solid var(--cf-border)', background: 'var(--cf-surface)', color: 'var(--cf-ink)', padding: 12, fontSize: 16, font: 'inherit', resize: 'vertical' }} />
            </label>
          )}

          {error && <span role="alert" style={{ fontSize: 13, color: 'var(--cf-red-dark)' }}>{error}</span>}
          {rechazados.length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--cf-red-dark)' }}>No se pudieron recibir: {rechazados.join(' · ')}</span>
          )}

          <button type="button" onClick={mandar} disabled={!elegidos.length || !!subiendo} style={{
            height: 52, borderRadius: 14, border: 0, font: 'inherit', fontSize: 16, fontWeight: 700, cursor: elegidos.length && !subiendo ? 'pointer' : 'default',
            background: elegidos.length ? 'var(--cf-gold)' : 'var(--cf-fill)', color: elegidos.length ? 'var(--cf-gold-ink)' : 'var(--cf-ink-3)',
          }}>
            {subiendo
              ? `Subiendo ${subiendo.hechos} de ${subiendo.total}…`
              : abierta ? `Agregar ${elegidos.length || ''} ${elegidos.length === 1 ? 'archivo' : 'archivos'}`.replace('  ', ' ')
                : 'Mandar para que la carguen'}
          </button>
        </section>
      )}
    </div>
  )
}
