'use client'

import { useState, useEffect, useCallback } from 'react'
import { SkeletonCard } from '@/components/ui/Skeleton'

/* LO QUE SALIÓ POR WHATSAPP.
 *
 * ⚠ POR QUÉ EXISTE: el 28 de agosto no se pudo contestar «¿se mandó o no?».
 * Un envío a 36 organizaciones quedó en duda y no había forma de saberlo desde
 * ninguna parte —ni el panel, ni la base, ni los registros de la aplicación—.
 * Hizo falta una hora, el syslog del servidor y la analítica de Meta por medias
 * horas para concluir que no había salido.
 *
 * Esta pantalla contesta esa pregunta en cinco segundos: se busca el teléfono
 * y se ve qué se le mandó, cuándo, y qué dijo Meta. */

const fecha = (d) => new Date(d).toLocaleString('es-CO', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
})

export default function EnviosWhatsApp() {
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [telefono, setTelefono] = useState('')
  const [plantilla, setPlantilla] = useState('')
  const [dias, setDias] = useState(7)

  const traer = useCallback(() => {
    setCargando(true)
    const p = new URLSearchParams({ dias: String(dias) })
    if (telefono.trim()) p.set('telefono', telefono.trim())
    if (plantilla) p.set('plantilla', plantilla)
    fetch(`/api/admin/whatsapp-bot/envios?${p}`)
      .then((r) => r.json())
      .then(setDatos)
      .catch(() => setDatos({ envios: [], total: 0, fallidos: 0, porPlantilla: [] }))
      .finally(() => setCargando(false))
  }, [telefono, plantilla, dias])

  useEffect(() => { traer() }, [traer])

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--cf-ink)]">Envíos de WhatsApp</h1>
        <p className="text-[13px] text-[var(--cf-ink-3)] mt-1">
          Todo lo que sale del sistema, con lo que contestó Meta. Busca un teléfono
          para ver qué se le ha mandado.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Teléfono"
          inputMode="numeric"
          className="px-3 h-10 rounded-[10px] border border-[var(--cf-border-soft)] bg-[var(--cf-card)] text-[14px] text-[var(--cf-ink)] w-44"
        />
        <select
          value={plantilla}
          onChange={(e) => setPlantilla(e.target.value)}
          className="px-3 h-10 rounded-[10px] border border-[var(--cf-border-soft)] bg-[var(--cf-card)] text-[14px] text-[var(--cf-ink)]"
        >
          <option value="">Todas las plantillas</option>
          {(datos?.porPlantilla ?? []).map((p) => (
            <option key={p.plantilla} value={p.plantilla === '(texto libre)' ? '' : p.plantilla}>
              {p.plantilla} · {p.veces}
            </option>
          ))}
        </select>
        <select
          value={dias}
          onChange={(e) => setDias(Number(e.target.value))}
          className="px-3 h-10 rounded-[10px] border border-[var(--cf-border-soft)] bg-[var(--cf-card)] text-[14px] text-[var(--cf-ink)]"
        >
          {[1, 7, 30, 90].map((d) => (
            <option key={d} value={d}>{d === 1 ? 'Hoy' : `${d} días`}</option>
          ))}
        </select>
      </div>

      {cargando && !datos ? (
        <SkeletonCard />
      ) : (
        <>
          {/* El cero es un dato: si no salió nada, hay que verlo, no esconderlo. */}
          <div className="flex gap-3 flex-wrap">
            <Cifra rotulo="Enviados" valor={datos?.total ?? 0} />
            <Cifra rotulo="Fallidos" valor={datos?.fallidos ?? 0}
              color={datos?.fallidos ? 'var(--cf-red-dark)' : undefined} />
            <Cifra rotulo="Plantillas distintas" valor={datos?.porPlantilla?.length ?? 0} />
          </div>

          <div className="rounded-[12px] border border-[var(--cf-border-soft)] overflow-hidden bg-[var(--cf-card)]">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--cf-ink-3)] border-b border-[var(--cf-border-soft)]">
                    <th className="px-3 py-2.5 font-semibold">Cuándo</th>
                    <th className="px-3 py-2.5 font-semibold">Teléfono</th>
                    <th className="px-3 py-2.5 font-semibold">Plantilla</th>
                    <th className="px-3 py-2.5 font-semibold">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {(datos?.envios ?? []).map((e) => (
                    <tr key={e.id} className="border-b border-[var(--cf-border-soft)] last:border-0">
                      <td className="px-3 py-2.5 text-[var(--cf-ink-3)] whitespace-nowrap">{fecha(e.createdAt)}</td>
                      {/* El teléfono NO se recorta: es lo que identifica. */}
                      <td className="px-3 py-2.5 font-mono text-[var(--cf-ink)]">{e.telefono}</td>
                      <td className="px-3 py-2.5 text-[var(--cf-ink-2)]">{e.plantilla || 'texto libre'}</td>
                      <td className="px-3 py-2.5">
                        {e.ok ? (
                          <span className="text-[var(--cf-green-dark)] font-semibold">entregado a Meta</span>
                        ) : (
                          <span className="text-[var(--cf-red-dark)]">{e.error?.slice(0, 70) || 'falló'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!(datos?.envios ?? []).length && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-[var(--cf-ink-3)]">
                        No salió ningún mensaje con ese filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Cifra({ rotulo, valor, color }) {
  return (
    <div className="rounded-[12px] border border-[var(--cf-border-soft)] bg-[var(--cf-card)] px-4 py-3 min-w-[128px]">
      <div className="text-[11px] uppercase tracking-wide text-[var(--cf-ink-3)] font-semibold">{rotulo}</div>
      <div className="text-[22px] font-bold mt-0.5" style={{ color: color || 'var(--cf-ink)' }}>{valor}</div>
    </div>
  )
}
