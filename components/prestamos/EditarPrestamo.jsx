'use client'
// EditarPrestamo.jsx — Modal para editar un préstamo el mismo día que se creó.
// Solo disponible si el préstamo es de hoy y el usuario tiene permiso de gestión.
// Permite corregir todos los campos configurables. Si hay pagos, el monto queda bloqueado.

import { useState, useMemo } from 'react'
import { Modal }   from '@/components/ui/Modal'
import { Button }  from '@/components/ui/Button'
import { Input }   from '@/components/ui/Input'
import MoneyInput  from '@/components/ui/MoneyInput'
import ResumenCalculo    from '@/components/prestamos/ResumenCalculo'
import ModoInteresSelector from '@/components/prestamos/ModoInteresSelector'
import { calcularPrestamo } from '@/lib/calculos'
import { formatMoney }      from '@/lib/i18n'

const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

const hoyISO = () => {
  const d = new Date(Date.now() - 5 * 60 * 60 * 1000) // Colombia UTC-5
  return d.toISOString().slice(0, 10)
}

// Convierte diasPlazo → periodos según frecuencia.
const diasAperiodos = (dias, freq) => {
  const dp = DIAS_POR_PERIODO[freq] || 1
  return Math.ceil(dias / dp)
}
const periodosADias = (periodos, freq) => periodos * (DIAS_POR_PERIODO[freq] || 1)

export default function EditarPrestamo({ prestamo, open, onClose, onSuccess, socios = [] }) {
  // Los hooks SIEMPRE se llaman (regla de React). Si no hay préstamo el modal no se abre.
  const p = prestamo || {}
  const hayPagos = (p.pagos || []).filter(
    (pg) => !['recargo', 'descuento'].includes(pg.tipo)
  ).length > 0

  // Estado inicial desde el préstamo existente (fallback vacío si no hay prestamo)
  const [monto,        setMonto]        = useState(String(Math.round(p.montoPrestado || 0)))
  const [tasa,         setTasa]         = useState(String(p.tasaInteres || 0))
  const [frecuencia,   setFrecuencia]   = useState(p.frecuencia || 'diario')
  const [periodos,     setPeriodos]     = useState(String(diasAperiodos(p.diasPlazo || 30, p.frecuencia || 'diario')))
  const [fechaInicio,  setFechaInicio]  = useState(
    p.fechaInicio ? new Date(p.fechaInicio).toISOString().slice(0, 10) : hoyISO()
  )
  const [modoInteres,  setModoInteres]  = useState(p.modoInteres || 'fijo')
  const [cuotaManual,  setCuotaManual]  = useState(
    p.modoInteres === 'manual' ? String(Math.round(p.cuotaDiaria || 0)) : ''
  )
  const [diaCobroSem,  setDiaCobroSem]  = useState(p.diaCobroSemana ?? '')
  const [diaCobroMes,  setDiaCobroMes]  = useState(p.diaCobroMes ?? '')
  const [seguro,       setSeguro]       = useState(Boolean(p.seguro))
  const [montoSeguro,  setMontoSeguro]  = useState(String(p.montoSeguro || ''))
  const [nombreProd,   setNombreProd]   = useState(p.nombreProducto || '')
  const [socioId,      setSocioId]      = useState(p.socioId || '')
  const [error,        setError]        = useState('')
  const [guardando,    setGuardando]    = useState(false)

  const diasPlazo = periodosADias(Number(periodos) || 1, frecuencia)

  // Preview en vivo del nuevo cálculo
  const resumen = useMemo(() => {
    const m = Number(monto)
    const t = Number(tasa)
    const p = Number(periodos)
    if (!m || !t || !p || !fechaInicio) return null
    try {
      return calcularPrestamo({
        montoPrestado: m,
        tasaInteres: t,
        diasPlazo: periodosADias(p, frecuencia),
        fechaInicio: new Date(fechaInicio),
        frecuencia,
        modoInteres,
        cuotaManual: modoInteres === 'manual' ? Number(cuotaManual) : undefined,
      })
    } catch { return null }
  }, [monto, tasa, periodos, fechaInicio, frecuencia, modoInteres, cuotaManual])

  const handleGuardar = async () => {
    setError('')
    const m = Number(monto)
    if (!m || m <= 0) { setError('El monto debe ser mayor a 0'); return }
    if (!Number(tasa) && Number(tasa) !== 0) { setError('La tasa de interés es requerida'); return }
    if (!Number(periodos) || Number(periodos) < 1) { setError('El plazo debe ser al menos 1 período'); return }

    setGuardando(true)
    try {
      const body = {
        modo: 'editar',
        montoPrestado: m,
        tasaInteres: Number(tasa),
        diasPlazo,
        fechaInicio,
        frecuencia,
        modoInteres,
        cuotaManual: modoInteres === 'manual' ? Number(cuotaManual) : undefined,
        diaCobroSemana: (frecuencia === 'semanal' || frecuencia === 'quincenal') && diaCobroSem !== ''
          ? Number(diaCobroSem) : null,
        diaCobroMes: frecuencia === 'mensual' && diaCobroMes !== '' ? Number(diaCobroMes) : null,
        seguro,
        montoSeguro: seguro ? Number(montoSeguro) : null,
        nombreProducto: nombreProd || null,
        socioId: socioId || null,
      }

      const res = await fetch(`/api/prestamos/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al guardar'); return }
      onSuccess?.(data)
      onClose?.()
    } catch { setError('Error de conexión') }
    finally { setGuardando(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar préstamo"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={handleGuardar} loading={guardando}>Guardar cambios</Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        {hayPagos && (
          <div className="rounded-[10px] px-3 py-2.5 text-[12px]"
            style={{ background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', color: 'var(--color-warning)', border: '1px solid color-mix(in srgb, var(--color-warning) 25%, transparent)' }}>
            Este préstamo ya tiene pagos. El monto no se puede cambiar. Puedes corregir tasa, plazo y frecuencia.
          </div>
        )}

        {/* Monto */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Monto prestado</label>
          <MoneyInput
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            disabled={hayPagos}
            placeholder="Ej: 500.000"
          />
        </div>

        {/* Tasa e interés */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Tasa de interés (%)</label>
            <Input
              type="number"
              value={tasa}
              onChange={(e) => setTasa(e.target.value)}
              placeholder="Ej: 20"
              min="0"
              step="0.5"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Fecha de inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              max={hoyISO()}
              className="w-full h-10 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm text-[var(--color-text-primary)]"
            />
          </div>
        </div>

        {/* Modo de interés */}
        <ModoInteresSelector value={modoInteres} onChange={setModoInteres} />
        {modoInteres === 'manual' && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Cuota fija</label>
            <MoneyInput value={cuotaManual} onChange={(e) => setCuotaManual(e.target.value)} placeholder="Cuota por período" />
          </div>
        )}

        {/* Plazo y frecuencia */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Plazo (períodos)</label>
            <Input
              type="number"
              value={periodos}
              onChange={(e) => setPeriodos(e.target.value)}
              min="1"
              placeholder="Ej: 30"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Frecuencia de cobro</label>
            <select
              value={frecuencia}
              onChange={(e) => { setFrecuencia(e.target.value); setDiaCobroSem(''); setDiaCobroMes('') }}
              className="w-full h-10 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm text-[var(--color-text-primary)]"
            >
              <option value="diario">Diario</option>
              <option value="semanal">Semanal</option>
              <option value="quincenal">Quincenal</option>
              <option value="mensual">Mensual</option>
            </select>
          </div>
        </div>

        {/* Día ancla */}
        {(frecuencia === 'semanal' || frecuencia === 'quincenal') && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Día de cobro (opcional)</label>
            <select
              value={diaCobroSem}
              onChange={(e) => setDiaCobroSem(e.target.value)}
              className="w-full h-10 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm text-[var(--color-text-primary)]"
            >
              <option value="">Sin día fijo</option>
              {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((d,i) => (
                <option key={i} value={i}>{d}</option>
              ))}
            </select>
          </div>
        )}
        {frecuencia === 'mensual' && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Día del mes (opcional)</label>
            <Input
              type="number"
              value={diaCobroMes}
              onChange={(e) => setDiaCobroMes(e.target.value)}
              min="1"
              max="31"
              placeholder="Ej: 15"
            />
          </div>
        )}

        {/* Seguro */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="seguro-editar"
            checked={seguro}
            onChange={(e) => setSeguro(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <label htmlFor="seguro-editar" className="text-sm text-[var(--color-text-primary)]">Incluir seguro</label>
        </div>
        {seguro && (
          <MoneyInput value={montoSeguro} onChange={(e) => setMontoSeguro(e.target.value)} placeholder="Monto del seguro" />
        )}

        {/* Nombre producto (si es mercancía) */}
        {p.nombreProducto != null && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Nombre del producto</label>
            <Input value={nombreProd} onChange={(e) => setNombreProd(e.target.value)} placeholder="Ej: Televisor" />
          </div>
        )}

        {/* Socio */}
        {socios.length > 0 && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Socio (opcional)</label>
            <select
              value={socioId}
              onChange={(e) => setSocioId(e.target.value)}
              className="w-full h-10 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 text-sm text-[var(--color-text-primary)]"
            >
              <option value="">Sin socio</option>
              {socios.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Resumen en vivo */}
        {resumen && (
          <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Resumen nuevo</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)]">Cuota</p>
                <p className="font-bold font-mono-display text-[var(--color-accent)]">{formatMoney(resumen.cuotaDiaria)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)]">Total a pagar</p>
                <p className="font-bold font-mono-display text-[var(--color-text-primary)]">{formatMoney(resumen.totalAPagar)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)]">Períodos</p>
                <p className="font-semibold text-[var(--color-text-primary)]">{resumen.numPeriodos} {frecuencia}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--color-text-muted)]">Fecha fin</p>
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {resumen.fechaFin ? new Date(resumen.fechaFin).toLocaleDateString('es-CO', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-[var(--color-danger)] bg-[var(--color-danger-dim)] rounded-[10px] px-3 py-2">{error}</p>
        )}
      </div>
    </Modal>
  )
}
