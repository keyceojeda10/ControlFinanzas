'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import MoneyInput from '@/components/ui/MoneyInput'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { formatMoney } from '@/lib/i18n'
import { useCountry } from '@/hooks/useCountry'

export default function SocioDetallePage() {
  const { id } = useParams()
  const router = useRouter()
  const { esOwner, loading: authLoading } = useAuth()
  const { country } = useCountry()
  const fmt = (v) => formatMoney(v, country)

  const [socio, setSocio] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [confirmEliminarSocio, setConfirmEliminarSocio] = useState(false)
  const [loadingEliminar, setLoadingEliminar] = useState(false)

  const [modalAporte, setModalAporte] = useState(false)
  const [tipoAporte, setTipoAporte] = useState('aporte')
  const [montoAporte, setMontoAporte] = useState('')
  const [notaAporte, setNotaAporte] = useState('')
  const [fechaAporte, setFechaAporte] = useState('')
  const [loadingAporte, setLoadingAporte] = useState(false)

  const [editando, setEditando] = useState(false)
  const [formEdit, setFormEdit] = useState({})
  const [loadingEdit, setLoadingEdit] = useState(false)

  const [confirmEliminar, setConfirmEliminar] = useState(null)

  const [anioLiquidacion, setAnioLiquidacion] = useState(new Date().getFullYear())

  const cargar = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/socios/${id}`)
      if (!res.ok) throw new Error('Error al cargar socio')
      setSocio(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  const registrarAporte = async () => {
    if (!montoAporte || Number(montoAporte) <= 0) return
    setLoadingAporte(true)
    try {
      const res = await fetch(`/api/socios/${id}/aportes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: Number(montoAporte), nota: notaAporte, tipo: tipoAporte, ...(fechaAporte && { fecha: fechaAporte }) }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Error')
      }
      setModalAporte(false)
      setMontoAporte('')
      setNotaAporte('')
      setFechaAporte('')
      setTipoAporte('aporte')
      cargar()
    } catch (e) {
      alert(e.message)
    } finally {
      setLoadingAporte(false)
    }
  }

  const eliminarAporte = async (aporteId) => {
    try {
      const res = await fetch(`/api/socios/${id}/aportes?aporteId=${aporteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      setConfirmEliminar(null)
      cargar()
    } catch (e) {
      alert(e.message)
    }
  }

  const guardarEdicion = async () => {
    setLoadingEdit(true)
    try {
      const res = await fetch(`/api/socios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formEdit),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Error al guardar')
      setEditando(false)
      cargar()
    } catch (e) {
      alert(e.message)
    } finally {
      setLoadingEdit(false)
    }
  }

  const eliminarSocio = async () => {
    setLoadingEliminar(true)
    try {
      const res = await fetch(`/api/socios/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')
      router.push('/socios')
    } catch (e) {
      alert(e.message)
      setConfirmEliminarSocio(false)
    } finally {
      setLoadingEliminar(false)
    }
  }

  const toggleActivo = async () => {
    try {
      const res = await fetch(`/api/socios/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !socio.activo }),
      })
      if (!res.ok) throw new Error('Error')
      cargar()
    } catch (e) {
      alert(e.message)
    }
  }

  if (authLoading) return null

  if (!esOwner) {
    return <div className="p-4 text-center" style={{ color: 'var(--color-text-muted)' }}>No tienes acceso.</div>
  }

  if (loading) {
    return <div className="space-y-3 pb-28"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
  }

  if (error || !socio) {
    return <div className="p-4 text-center" style={{ color: 'var(--color-danger)' }}>{error || 'No encontrado'}</div>
  }

  const prestamosConInteresAnio = socio.prestamos
    .map((p) => ({ ...p, interesAnio: p.interesesPorAnio?.[anioLiquidacion] || 0 }))
    .filter((p) => p.interesAnio > 0)
  const interesesAnio = prestamosConInteresAnio.reduce((acc, p) => acc + p.interesAnio, 0)
  const aportesAnio = (socio.aportes || []).filter(a => a.tipo !== 'retiro' && new Date(a.fecha).getFullYear() === anioLiquidacion).reduce((a, b) => a + b.monto, 0)
  const retirosAnio = (socio.aportes || []).filter(a => a.tipo === 'retiro' && new Date(a.fecha).getFullYear() === anioLiquidacion).reduce((a, b) => a + b.monto, 0)
  const roiAnio = aportesAnio > 0 ? Math.round((interesesAnio / aportesAnio) * 100) : (socio.totalAportes > 0 ? Math.round((interesesAnio / socio.totalAportes) * 100) : 0)

  return (
    <div className="pb-28 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {socio.nombre}
          </h1>
          {socio.cedula && (
            <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>CC {socio.cedula}</p>
          )}
          {socio.telefono && (
            <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>{socio.telefono}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => { setFormEdit({ nombre: socio.nombre, cedula: socio.cedula || '', telefono: socio.telefono || '', notas: socio.notas || '' }); setEditando(true) }}
          >
            Editar
          </Button>
        </div>
      </div>

      {/* Resumen */}
      <div
        className="rounded-[16px] p-4 grid grid-cols-2 gap-3"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Aportes</p>
          <p className="text-[16px] font-bold" style={{ color: 'var(--color-accent)' }}>{fmt(socio.totalAportes)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Retiros</p>
          <p className="text-[16px] font-bold" style={{ color: 'var(--color-danger)' }}>{fmt(socio.totalRetiros || 0)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Balance neto</p>
          <p className="text-[16px] font-bold" style={{ color: 'var(--color-text-primary)' }}>{fmt(socio.balanceNeto ?? socio.totalAportes)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Intereses cobrados</p>
          <p className="text-[16px] font-bold" style={{ color: 'var(--color-success)' }}>{fmt(socio.interesesCobrados)}</p>
        </div>
      </div>

      {/* Liquidacion anual */}
      <div
        className="rounded-[16px] p-4"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Liquidacion {anioLiquidacion}
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => setAnioLiquidacion((a) => a - 1)}
              className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[13px]"
              style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}
            >
              {'<'}
            </button>
            <button
              onClick={() => setAnioLiquidacion((a) => a + 1)}
              className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[13px]"
              style={{ background: 'var(--color-bg-hover)', color: 'var(--color-text-muted)' }}
            >
              {'>'}
            </button>
          </div>
        </div>

        {prestamosConInteresAnio.length === 0 && !aportesAnio && !retirosAnio ? (
          <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>Sin movimientos en {anioLiquidacion}</p>
        ) : (
          <>
            {prestamosConInteresAnio.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {p.clienteNombre}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {fmt(p.montoPrestado)} al {p.tasaInteres}%
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--color-success)' }}>
                    {fmt(p.interesAnio)}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                    {p.estado === 'activo' ? 'Activo' : 'Completado'}
                  </p>
                </div>
              </div>
            ))}

            {(aportesAnio > 0 || retirosAnio > 0) && (
              <div className="pt-2 mt-1 space-y-1" style={{ borderTop: '1px dashed var(--color-border)' }}>
                {aportesAnio > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span style={{ color: 'var(--color-text-muted)' }}>Aportes en {anioLiquidacion}</span>
                    <span className="font-medium" style={{ color: 'var(--color-accent)' }}>+{fmt(aportesAnio)}</span>
                  </div>
                )}
                {retirosAnio > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span style={{ color: 'var(--color-text-muted)' }}>Retiros en {anioLiquidacion}</span>
                    <span className="font-medium" style={{ color: 'var(--color-danger)' }}>-{fmt(retirosAnio)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-3 mt-1 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>Intereses {anioLiquidacion}</p>
                <p className="text-[16px] font-bold" style={{ color: 'var(--color-success)' }}>{fmt(interesesAnio)}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>Rendimiento (ROI)</p>
                <p className="text-[13px] font-semibold" style={{ color: roiAnio > 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}>{roiAnio}%</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Prestamos del socio */}
      <div
        className="rounded-[16px] p-4"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <h2 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--color-text-primary)' }}>
          Prestamos ({socio.prestamos.length})
        </h2>
        {socio.prestamos.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
            No hay prestamos asociados. Al crear un prestamo puedes asignar este socio como responsable.
          </p>
        ) : (
          <div className="space-y-2">
            {socio.prestamos.map((p) => (
              <div
                key={p.id}
                className="rounded-[12px] p-3"
                style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {p.clienteNombre}
                  </p>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{
                      background: p.estado === 'activo'
                        ? 'color-mix(in srgb, var(--color-success) 12%, transparent)'
                        : 'color-mix(in srgb, var(--color-text-muted) 12%, transparent)',
                      color: p.estado === 'activo' ? 'var(--color-success)' : 'var(--color-text-muted)',
                    }}
                  >
                    {p.estado}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Capital</p>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{fmt(p.montoPrestado)}</p>
                  </div>
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Cobrado</p>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--color-text-primary)' }}>{fmt(p.totalPagado)}</p>
                  </div>
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Intereses</p>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--color-success)' }}>{fmt(p.interesesCobrados)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Movimientos (aportes y retiros) */}
      <div
        className="rounded-[16px] p-4"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Movimientos ({socio.aportes.length})
          </h2>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setTipoAporte('retiro'); setModalAporte(true) }}>Retiro</Button>
            <Button onClick={() => { setTipoAporte('aporte'); setModalAporte(true) }}>Aporte</Button>
          </div>
        </div>
        {socio.aportes.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>Sin movimientos registrados.</p>
        ) : (
          <div className="space-y-2">
            {socio.aportes.map((a) => {
              const esRetiro = a.tipo === 'retiro'
              return (
                <div key={a.id} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md shrink-0"
                      style={{
                        background: esRetiro ? 'color-mix(in srgb, var(--color-danger) 12%, transparent)' : 'color-mix(in srgb, var(--color-success) 12%, transparent)',
                        color: esRetiro ? 'var(--color-danger)' : 'var(--color-success)',
                      }}
                    >
                      {esRetiro ? 'Retiro' : 'Aporte'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium" style={{ color: esRetiro ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                        {esRetiro ? '-' : '+'}{fmt(a.monto)}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(a.fecha).toLocaleDateString('es-CO')}
                        {a.nota && ` — ${a.nota}`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmEliminar(a.id)}
                    className="text-[11px] px-2 py-1 rounded-[8px] shrink-0"
                    style={{ color: 'var(--color-danger)', background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)' }}
                  >
                    Eliminar
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {socio.notas && (
        <div
          className="rounded-[16px] p-4"
          style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        >
          <h2 className="text-[14px] font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>Notas</h2>
          <p className="text-[13px] whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>{socio.notas}</p>
        </div>
      )}

      {/* Modal registrar aporte/retiro */}
      <Modal open={modalAporte} onClose={() => setModalAporte(false)} title={tipoAporte === 'retiro' ? 'Registrar retiro' : 'Registrar aporte'}>
        <div className="space-y-4">
          {tipoAporte === 'retiro' && (
            <p className="text-[12px] px-3 py-2 rounded-[10px]" style={{ background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', color: 'var(--color-warning)' }}>
              El retiro se restara del capital disponible del negocio.
            </p>
          )}
          <MoneyInput
            label={tipoAporte === 'retiro' ? 'Monto del retiro' : 'Monto del aporte'}
            value={montoAporte}
            onChange={(e) => setMontoAporte(e.target.value)}
          />
          <Input
            label="Fecha"
            type="date"
            value={fechaAporte}
            onChange={(e) => setFechaAporte(e.target.value)}
          />
          <Input
            label="Nota (opcional)"
            value={notaAporte}
            onChange={(e) => setNotaAporte(e.target.value)}
            placeholder={tipoAporte === 'retiro' ? 'Ej: Retiro de utilidades julio' : 'Ej: Aporte de julio'}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalAporte(false)} className="flex-1">Cancelar</Button>
            <Button onClick={registrarAporte} loading={loadingAporte} className="flex-1">
              {tipoAporte === 'retiro' ? 'Registrar retiro' : 'Registrar aporte'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal editar socio */}
      <Modal open={editando} onClose={() => setEditando(false)} title="Editar socio">
        <div className="space-y-4">
          <Input label="Nombre" value={formEdit.nombre || ''} onChange={(e) => setFormEdit((f) => ({ ...f, nombre: e.target.value }))} />
          <Input label="Cédula" value={formEdit.cedula || ''} onChange={(e) => setFormEdit((f) => ({ ...f, cedula: e.target.value }))} />
          <Input label="Teléfono" value={formEdit.telefono || ''} onChange={(e) => setFormEdit((f) => ({ ...f, telefono: e.target.value }))} />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-[0.05em]" style={{ color: 'var(--color-text-muted)' }}>Notas</label>
            <textarea
              value={formEdit.notas || ''}
              onChange={(e) => setFormEdit((f) => ({ ...f, notas: e.target.value }))}
              rows={3}
              className="px-3 py-2 rounded-[10px] text-sm resize-none"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditando(false)} className="flex-1">Cancelar</Button>
            <Button onClick={guardarEdicion} loading={loadingEdit} className="flex-1">Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* Acciones */}
      <div
        className="rounded-[16px] p-4 space-y-3"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
      >
        <h2 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>Acciones</h2>
        <div className="flex gap-3">
          <button
            onClick={toggleActivo}
            className="flex-1 py-2.5 rounded-[10px] text-[13px] font-medium transition-colors"
            style={{
              background: socio.activo ? 'color-mix(in srgb, var(--color-warning) 10%, transparent)' : 'color-mix(in srgb, var(--color-success) 10%, transparent)',
              color: socio.activo ? 'var(--color-warning)' : 'var(--color-success)',
            }}
          >
            {socio.activo ? 'Desactivar socio' : 'Reactivar socio'}
          </button>
          <button
            onClick={() => setConfirmEliminarSocio(true)}
            className="flex-1 py-2.5 rounded-[10px] text-[13px] font-medium transition-colors"
            style={{
              background: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
              color: 'var(--color-danger)',
            }}
          >
            Eliminar socio
          </button>
        </div>
      </div>

      {/* Confirmar eliminar aporte */}
      <ConfirmModal
        open={!!confirmEliminar}
        onClose={() => setConfirmEliminar(null)}
        title="Eliminar aporte"
        message="Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        color="danger"
        onConfirm={() => eliminarAporte(confirmEliminar)}
      />

      {/* Confirmar eliminar socio */}
      <ConfirmModal
        open={confirmEliminarSocio}
        onClose={() => setConfirmEliminarSocio(false)}
        title="Eliminar socio"
        message={`Se eliminara a ${socio.nombre} y todos sus aportes. Los prestamos asociados quedaran sin socio. Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        color="danger"
        loading={loadingEliminar}
        onConfirm={eliminarSocio}
      />
    </div>
  )
}
