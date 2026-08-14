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

export default function AdminSugerenciasPage() {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [rol, setRol] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

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
      if (!q) return true
      return `${s.texto} ${s.negocio} ${s.persona}`.toLowerCase().includes(q)
    })
  }, [datos, rol, busqueda])

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
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
