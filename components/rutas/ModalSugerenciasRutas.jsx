'use client'
// components/rutas/ModalSugerenciasRutas.jsx
// Modal que muestra grupos sugeridos de clientes sin ruta y permite crear
// rutas nuevas con un click, o agregar clientes a rutas existentes.

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ModalSugerenciasRutas({ open, onClose, onSuccess }) {
  const [cargando, setCargando] = useState(true)
  const [datos, setDatos] = useState(null) // { gruposSugeridos, sugerenciasRutaExistente, sueltos, totalSinRuta }
  const [cobradores, setCobradores] = useState([])
  const [nombres, setNombres] = useState({}) // grupoId -> nombre editable
  const [selCobrador, setSelCobrador] = useState({}) // grupoId -> cobradorId
  const [creando, setCreando] = useState(null) // grupoId en proceso
  const [agregando, setAgregando] = useState(null) // sugerenciaIdx en proceso
  const [errores, setErrores] = useState({}) // grupoId -> mensaje
  const [grupos, setGrupos] = useState([])
  const [sugerencias, setSugerencias] = useState([])

  const cargar = async () => {
    setCargando(true)
    try {
      const [rRec, rCob] = await Promise.all([
        fetch('/api/rutas/recomendaciones'),
        fetch('/api/cobradores'),
      ])
      const dRec = rRec.ok ? await rRec.json() : null
      const dCob = rCob.ok ? await rCob.json() : []
      const cobs = Array.isArray(dCob) ? dCob.filter((c) => c.activo) : []
      setCobradores(cobs)
      if (dRec) {
        setDatos(dRec)
        setGrupos(dRec.gruposSugeridos || [])
        setSugerencias(dRec.sugerenciasRutaExistente || [])
        // Inicializar nombres editables con el sugerido
        const inicNombres = {}
        const inicCob = {}
        for (const g of dRec.gruposSugeridos || []) {
          inicNombres[g.id] = g.nombreSugerido
          inicCob[g.id] = '' // por defecto sin cobrador (el owner cobra)
        }
        setNombres(inicNombres)
        setSelCobrador(inicCob)
      }
    } catch {
      setDatos(null)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (open) cargar()
  }, [open])

  const crearRuta = async (grupo) => {
    const nombre = (nombres[grupo.id] || '').trim() || grupo.nombreSugerido
    if (!nombre) {
      setErrores((p) => ({ ...p, [grupo.id]: 'Ingresa un nombre' }))
      return
    }
    setCreando(grupo.id)
    setErrores((p) => ({ ...p, [grupo.id]: '' }))
    try {
      const body = { nombre }
      if (selCobrador[grupo.id]) body.cobradorId = selCobrador[grupo.id]
      const rCrear = await fetch('/api/rutas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const dCrear = await rCrear.json()
      if (!rCrear.ok) {
        setErrores((p) => ({ ...p, [grupo.id]: dCrear.error || 'No se pudo crear la ruta' }))
        return
      }
      const nuevaRutaId = dCrear.id
      const clienteIds = grupo.clientes.map((c) => c.id)
      const rAsig = await fetch(`/api/rutas/${nuevaRutaId}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteIds }),
      })
      const dAsig = await rAsig.json()
      if (!rAsig.ok) {
        setErrores((p) => ({ ...p, [grupo.id]: dAsig.error || 'Ruta creada pero no se asignaron clientes' }))
        return
      }
      // Quitar el grupo del modal y notificar al padre.
      setGrupos((prev) => prev.filter((g) => g.id !== grupo.id))
      onSuccess?.()
    } catch {
      setErrores((p) => ({ ...p, [grupo.id]: 'Error de conexion' }))
    } finally {
      setCreando(null)
    }
  }

  const agregarAExistente = async (sug, idx) => {
    setAgregando(idx)
    try {
      const r = await fetch(`/api/rutas/${sug.rutaId}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clienteIds: [sug.clienteId] }),
      })
      const d = await r.json()
      if (!r.ok) {
        alert(d.error || 'No se pudo agregar')
        return
      }
      setSugerencias((prev) => prev.filter((_, i) => i !== idx))
      onSuccess?.()
    } catch {
      alert('Error de conexion')
    } finally {
      setAgregando(null)
    }
  }

  const nadaQueMostrar = !cargando && grupos.length === 0 && sugerencias.length === 0

  return (
    <Modal open={open} onClose={onClose} title="Sugerencias de rutas" size="lg">
      {cargando && (
        <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
          Analizando direcciones...
        </p>
      )}

      {!cargando && datos && (
        <div className="space-y-4">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Detectamos clientes sin ruta con direcciones parecidas. Crea una ruta con cada grupo en un click.
            El nombre y el cobrador son editables.
          </p>

          {grupos.map((g) => (
            <div
              key={g.id}
              className="rounded-[12px] border p-3 space-y-3"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  "{g.nombreSugerido}"
                </span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)',
                    color: 'var(--color-accent)',
                  }}
                >
                  {g.clientes.length} cliente{g.clientes.length === 1 ? '' : 's'}
                </span>
              </div>

              <ul className="space-y-1 max-h-32 overflow-auto pr-1">
                {g.clientes.map((c) => (
                  <li
                    key={c.id}
                    className="text-[11px] flex items-center gap-2 px-2 py-1 rounded-md"
                    style={{ background: 'color-mix(in srgb, var(--color-text-primary) 3%, transparent)' }}
                  >
                    <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {c.nombre}
                    </span>
                    {c.direccion && (
                      <span className="truncate" style={{ color: 'var(--color-text-muted)' }}>
                        · {c.direccion}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  label="Nombre de la ruta"
                  value={nombres[g.id] || ''}
                  onChange={(e) => setNombres((p) => ({ ...p, [g.id]: e.target.value }))}
                />
                {cobradores.length > 0 && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                      Cobrador
                    </label>
                    <select
                      value={selCobrador[g.id] || ''}
                      onChange={(e) => setSelCobrador((p) => ({ ...p, [g.id]: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 rounded-[10px] border text-sm"
                      style={{
                        background: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <option value="">Sin cobrador (yo cobro)</option>
                      {cobradores.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {errores[g.id] && (
                <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{errores[g.id]}</p>
              )}

              <div className="flex justify-end">
                <Button onClick={() => crearRuta(g)} loading={creando === g.id}>
                  Crear ruta y asignar {g.clientes.length}
                </Button>
              </div>
            </div>
          ))}

          {sugerencias.length > 0 && (
            <div
              className="rounded-[12px] border p-3 space-y-2"
              style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-card)' }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
                Agregar a rutas existentes
              </p>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                Estos clientes encajan con rutas que ya tienes.
              </p>
              <ul className="space-y-1.5">
                {sugerencias.map((s, idx) => (
                  <li
                    key={`${s.clienteId}-${s.rutaId}`}
                    className="flex items-center gap-2 px-2 py-2 rounded-md"
                    style={{ background: 'color-mix(in srgb, var(--color-text-primary) 3%, transparent)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {s.clienteNombre}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)' }}>
                        → {s.rutaNombre} · {s.motivo}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => agregarAExistente(s, idx)}
                      disabled={agregando === idx}
                      className="shrink-0 px-3 py-1.5 rounded-[8px] text-[11px] font-semibold border transition-colors disabled:opacity-50"
                      style={{
                        borderColor: 'color-mix(in srgb, var(--color-accent) 40%, transparent)',
                        color: 'var(--color-accent)',
                      }}
                    >
                      {agregando === idx ? 'Agregando...' : 'Agregar'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {datos.sueltos > 0 && grupos.length > 0 && (
            <p className="text-[11px] text-center" style={{ color: 'var(--color-text-muted)' }}>
              {datos.sueltos} cliente{datos.sueltos === 1 ? '' : 's'} sin agrupacion clara. Asigna manualmente desde su perfil.
            </p>
          )}

          {nadaQueMostrar && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
              Todos los clientes con dirección parecida ya están agrupados. Buen trabajo.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
