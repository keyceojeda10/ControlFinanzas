'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SkeletonCard } from '@/components/ui/Skeleton'

/* Lo que la gente contestó en la campaña, para poder hacer el sondeo.
 *
 * ⚠ SIN ESTA PANTALLA LA CAMPAÑA ES DE SOLO ESCRITURA. Se recoge todo, se
 * transcribe todo, y nadie lo lee nunca — que es peor que no preguntar, porque
 * además gasta la confianza de quien se tomó el trabajo de contestar.
 *
 * Las notas de voz llegan YA TRANSCRITAS desde el endpoint, así que esto es una
 * lista de textos y no una lista de audios que hay que oír de uno en uno. El
 * audio original sigue guardado por si hace falta el tono.
 */

const ROL = { owner: 'Dueño', cobrador: 'Cobrador', superadmin: 'Superadmin' }

/* ══ QUÉ SE HIZO CON CADA UNA ════════════════════════════════════════════════
 *
 * La pantalla las listaba y nada más. Con 7 sugerencias de 4 negocios en tres
 * días eso ya no se sostiene de memoria: la primera tanda se pasó tres días sin
 * contestar porque no había dónde ver cuáles quedaban.
 *
 * ⚠ ESTO NO LE ESCRIBE A NADIE. Es la libreta del dueño: él contesta por
 * WhatsApp, que es por donde ellos escriben. Lo que se guarda aquí es qué se
 * decidió y qué se le dijo, para no repetirse ni dejar a nadie colgado. */
const ESTADOS = [
  { id: 'nueva',      rotulo: 'Sin mirar',  tono: 'yellow' },
  { id: 'vista',      rotulo: 'Leída',      tono: 'blue' },
  { id: 'hecha',      rotulo: 'Hecha',      tono: 'green' },
  { id: 'descartada', rotulo: 'No se hace', tono: 'gray' },
]
const deEstado = (id) => ESTADOS.find((e) => e.id === id) ?? ESTADOS[0]

export default function AdminSugerenciasPage() {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [rol, setRol] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [borrador, setBorrador] = useState({})   // id -> texto que se está escribiendo
  const [guardando, setGuardando] = useState(null)

  /* Se cambia también en la lista de memoria para que la ficha se mueva al
     pulsar y no al recargar: si hay que refrescar para ver el cambio, la
     siguiente tanda se vuelve a atender a ciegas. */
  const anotar = async (id, cambio) => {
    setGuardando(id)
    const r = await fetch('/api/admin/sugerencias', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...cambio }),
    }).then((x) => x.json()).catch(() => ({ error: 'No se pudo guardar' }))
    setGuardando(null)
    if (r.error) { alert(r.error); return }
    setDatos((d) => ({
      ...d,
      sugerencias: d.sugerencias.map((s) => (s.id === id
        ? { ...s, estado: r.estado, respuesta: r.respuesta, respondidaEn: r.respondidaEn }
        : s)),
    }))
  }

  useEffect(() => {
    fetch('/api/admin/sugerencias')
      .then((r) => r.json())
      .then(setDatos)
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  const lista = useMemo(() => {
    const todas = datos?.sugerencias ?? []
    const q = busqueda.trim().toLowerCase()
    return todas.filter((s) => {
      if (rol !== 'todos' && s.rol !== rol) return false
      if (soloPendientes && (s.estado === 'hecha' || s.estado === 'descartada')) return false
      if (!q) return true
      return `${s.texto} ${s.negocio} ${s.persona}`.toLowerCase().includes(q)
    })
  }, [datos, rol, busqueda, soloPendientes])

  const pendientes = (datos?.sugerencias ?? [])
    .filter((s) => s.estado !== 'hecha' && s.estado !== 'descartada').length

  if (cargando) return <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
  if (datos?.error) return <p className="text-sm text-[var(--cf-red-dark)]">{datos.error}</p>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[25px] font-semibold text-[var(--color-text-primary)]">Lo que pide la gente</h1>
        <p className="text-xs text-[var(--color-text-muted)]">
          {datos?.total ?? 0} respuestas de {datos?.negocios ?? 0} negocios
          {datos?.porRol && Object.keys(datos.porRol).length > 0 && (
            <> · {Object.entries(datos.porRol).map(([r, n]) => `${n} ${ROL[r] ?? r}`).join(' · ')}</>
          )}
          {pendientes > 0 && (
            <> · <span style={{ color: 'var(--cf-gold-dark)', fontWeight: 700 }}>{pendientes} sin atender</span></>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {['todos', 'owner', 'cobrador'].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRol(r)}
            className="h-9 px-3.5 text-[13px] font-semibold"
            style={{
              borderRadius: 'var(--cf-r-control)',
              background: rol === r ? 'var(--cf-ink)' : 'var(--cf-card)',
              color: rol === r ? 'var(--cf-card)' : 'var(--cf-ink-2)',
              border: '1px solid var(--cf-border)', cursor: 'pointer',
            }}
          >
            {r === 'todos' ? 'Todas' : ROL[r]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSoloPendientes((v) => !v)}
          className="h-9 px-3.5 text-[13px] font-semibold"
          style={{
            borderRadius: 'var(--cf-r-control)',
            background: soloPendientes ? 'var(--cf-gold)' : 'var(--cf-card)',
            color: soloPendientes ? 'var(--cf-ink)' : 'var(--cf-ink-2)',
            border: '1px solid var(--cf-border)', cursor: 'pointer',
          }}
        >
          Sin atender
        </button>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en las respuestas…"
          className="h-9 px-3 text-[13px] outline-none min-w-0 flex-1"
          style={{
            borderRadius: 'var(--cf-r-control)', background: 'var(--cf-card)',
            border: '1px solid var(--cf-border)', color: 'var(--cf-ink)',
          }}
        />
      </div>

      {lista.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--cf-ink-3)]">
            {datos?.total ? 'Nada con ese filtro.' : 'Todavía no ha contestado nadie.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {lista.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[14px] font-bold" style={{ color: 'var(--cf-ink)' }}>{s.negocio}</span>
                <Badge variant={s.rol === 'owner' ? 'blue' : 'gray'}>{ROL[s.rol] ?? s.rol}</Badge>
                {s.plan && <Badge variant="gray">{s.plan}</Badge>}
                {s.fuente.includes('voz') && <Badge variant="yellow">nota de voz</Badge>}
                <Badge variant={deEstado(s.estado).tono}>{deEstado(s.estado).rotulo}</Badge>
                <span className="text-[11px] ml-auto" style={{ color: 'var(--cf-ink-3)' }}>
                  {s.persona} · {new Date(s.createdAt).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <p className="text-[14px] whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--cf-ink-2)' }}>
                {s.texto}
              </p>

              {s.adjuntos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {s.adjuntos.map((a) => (
                    a.esAudio ? (
                      <audio key={a.i} controls preload="none" className="h-9"
                        src={`/api/admin/sugerencias/archivo?id=${s.id}&i=${a.i}`} />
                    ) : (
                      <a key={a.i} href={`/api/admin/sugerencias/archivo?id=${s.id}&i=${a.i}`}
                        target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="Adjunto de la sugerencia" style={{
                          width: 96, height: 96, objectFit: 'cover',
                          borderRadius: 'var(--cf-r-control)', border: '1px solid var(--cf-border)',
                        }} src={`/api/admin/sugerencias/archivo?id=${s.id}&i=${a.i}`} />
                      </a>
                    )
                  ))}
                </div>
              )}

              {/* ── Qué se hizo con ella ── */}
              <div className="mt-4 pt-3" style={{ borderTop: '1px dashed var(--cf-border)' }}>
                <div className="flex flex-wrap gap-1.5">
                  {ESTADOS.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      disabled={guardando === s.id}
                      onClick={() => anotar(s.id, { estado: e.id })}
                      className="h-8 px-3 text-[12px] font-semibold"
                      style={{
                        borderRadius: 'var(--cf-r-control)',
                        background: s.estado === e.id ? 'var(--cf-ink)' : 'var(--cf-card)',
                        color: s.estado === e.id ? 'var(--cf-card)' : 'var(--cf-ink-3)',
                        border: '1px solid var(--cf-border)',
                        cursor: guardando === s.id ? 'wait' : 'pointer',
                      }}
                    >
                      {e.rotulo}
                    </button>
                  ))}
                </div>

                <textarea
                  value={borrador[s.id] ?? s.respuesta ?? ''}
                  onChange={(ev) => setBorrador((b) => ({ ...b, [s.id]: ev.target.value }))}
                  placeholder="Qué se le contestó (se guarda aquí, no se le envía)"
                  rows={2}
                  className="w-full mt-2 p-2.5 text-[13px] outline-none resize-y"
                  style={{
                    borderRadius: 'var(--cf-r-control)', background: 'var(--cf-fill)',
                    border: '1px solid var(--cf-border)', color: 'var(--cf-ink)',
                  }}
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    disabled={guardando === s.id || (borrador[s.id] ?? s.respuesta ?? '') === (s.respuesta ?? '')}
                    onClick={() => anotar(s.id, { respuesta: borrador[s.id] ?? '' })}
                    className="h-8 px-3 text-[12px] font-semibold"
                    style={{
                      borderRadius: 'var(--cf-r-control)',
                      background: 'var(--cf-gold)', color: 'var(--cf-ink)',
                      border: 'none',
                      opacity: (borrador[s.id] ?? s.respuesta ?? '') === (s.respuesta ?? '') ? 0.45 : 1,
                      cursor: 'pointer',
                    }}
                  >
                    Guardar la respuesta
                  </button>
                  {s.respondidaEn && (
                    <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
                      contestada el {new Date(s.respondidaEn).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
