'use client'
// components/prestamos/ModificarPlazo.jsx — Modal para extender o corregir fecha fin

import { useState, useEffect, useMemo } from 'react'
import HojaInferior from '@/components/cf/HojaInferior'
import { ModificarPlazo as HojaPlazo, PieGestion } from '@/components/pantallas/Gestion'
import { adaptarPlazo } from '@/lib/adaptadores/gestion'
import { useCountry } from '@/hooks/useCountry'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { encolarMutacion } from '@/lib/offline'
// ⚠ SE USABA SIN IMPORTAR. Dos llamadas —las fechas de inicio y fin— y ninguna
// importación: la pantalla reventaba al abrirse con «formatFechaCalendario is
// not defined». Apareció en los logs de producción (`/prestamos/[id]`,
// 5 ago 2026), no en el build: sin TypeScript, una función inexistente pasa
// `next build` y los tests, y solo falla al renderizar. Es el mismo patrón que
// tumbó producción con la TDZ hace dos días.
import { formatFechaCalendario } from '@/lib/i18n'

const toISODate = (d) => {
  const date = d instanceof Date ? d : new Date(d)
  return date.toISOString().slice(0, 10)
}

const addDays = (fechaInicio, dias) => {
  const d = new Date(fechaInicio)
  d.setDate(d.getDate() + dias)
  return d
}

const diffDays = (desde, hasta) => {
  const ms = new Date(hasta) - new Date(desde)
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

export default function ModificarPlazo({
  /* La flecha de volver al menú de Gestión, si se llegó desde ahí. */
  onVolver,
  prestamoId,
  prestamo,
  open,
  onClose,
  onSuccess,
}) {
  const { formatMoney } = useCountry()
  const [modo, setModo] = useState('extender') // 'extender' | 'corregir'

  const [diasExtra,   setDiasExtra]   = useState('')
  const [nuevaFecha,  setNuevaFecha]  = useState('')
  const [nuevaFechaInicio, setNuevaFechaInicio] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const fechaInicio = prestamo?.fechaInicio
  const fechaFinActual = prestamo?.fechaFin
  const diasPlazoActual = prestamo?.diasPlazo || 0
  const cuotaActual = prestamo?.cuotaDiaria || 0
  const totalAPagar = prestamo?.totalAPagar || 0
  const frecuencia = prestamo?.frecuencia || 'diario'

  // Inicializar inputs cuando se abre
  useEffect(() => {
    if (open && fechaFinActual) {
      setNuevaFecha(toISODate(fechaFinActual))
      setDiasExtra('')
      setError('')
    }
    if (open && fechaInicio) {
      setNuevaFechaInicio(toISODate(fechaInicio))
    }
  }, [open, fechaFinActual, fechaInicio])

  // Preview de corregir inicio: nueva fecha fin = fin actual + (nuevoInicio - inicioActual)
  const previewInicio = useMemo(() => {
    if (modo !== 'corregirInicio' || !nuevaFechaInicio || !fechaInicio || !fechaFinActual) return null
    const delta = diffDays(toISODate(fechaInicio), nuevaFechaInicio)
    if (delta === 0) return null
    const nuevaFin = addDays(fechaFinActual, delta)
    return { delta, nuevaFin: toISODate(nuevaFin) }
  }, [modo, nuevaFechaInicio, fechaInicio, fechaFinActual])

  // Cálculos del preview
  const diasPorPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[frecuencia] || 1

  const preview = useMemo(() => {
    if (!nuevaFecha || !fechaInicio) return null
    const nuevoDiasPlazo = diffDays(fechaInicio, nuevaFecha)
    if (nuevoDiasPlazo <= 0) return null

    const totalPeriodosNuevos = Math.ceil(nuevoDiasPlazo / diasPorPeriodo)

    if (modo === 'extender') {
      const cuotaBase = totalAPagar / totalPeriodosNuevos
      const nuevaCuota = Math.max(50, Math.round(cuotaBase / 50) * 50)
      const nuevoTotal = nuevaCuota * totalPeriodosNuevos
      return {
        nuevoDiasPlazo,
        nuevaCuota,
        nuevoTotal,
        cuotaDelta: nuevaCuota - cuotaActual,
      }
    }
    return { nuevoDiasPlazo }
  }, [nuevaFecha, fechaInicio, modo, totalAPagar, cuotaActual, diasPorPeriodo])

  // Bidireccional: al cambiar días → actualiza fecha
  const handleDiasChange = (val) => {
    setDiasExtra(val)
    const dias = Number(val)
    if (!dias || !fechaFinActual) return
    const nueva = addDays(fechaFinActual, dias)
    setNuevaFecha(toISODate(nueva))
  }

  // Bidireccional: al cambiar fecha → actualiza días
  const handleFechaChange = (val) => {
    setNuevaFecha(val)
    if (!val || !fechaFinActual) return
    const dias = diffDays(fechaFinActual, val)
    setDiasExtra(dias > 0 ? String(dias) : '')
  }

  const handleSubmit = async () => {
    if (modo === 'corregirInicio') {
      if (!nuevaFechaInicio) { setError('Ingresa la nueva fecha de inicio'); return }
      const hoy = toISODate(new Date())
      if (nuevaFechaInicio > hoy) { setError('La fecha de inicio no puede ser futura'); return }
    } else {
      if (!nuevaFecha) { setError('Ingresa la nueva fecha'); return }
      if (preview && preview.nuevoDiasPlazo <= 0) {
        setError('La fecha debe ser posterior al inicio del préstamo')
        return
      }
    }

    setLoading(true)
    setError('')

    const payload = modo === 'corregirInicio'
      ? { modo, fechaInicio: nuevaFechaInicio }
      : { modo, fechaFin: nuevaFecha }

    // Offline: encolar mutacion y cerrar. El servidor recalculara cuota al sincronizar.
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await encolarMutacion({
          tipo: 'prestamo.update',
          entityId: prestamoId,
          payload,
          baseUpdatedAt: prestamo?.updatedAt,
        })
        try { sessionStorage.setItem('cf-toast', 'Plazo modificado. Se sincronizará al volver online.') } catch {}
        onSuccess?.()
        handleClose()
      } catch (e) {
        setError('No se pudo guardar offline.')
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const res = await fetch(`/api/prestamos/${prestamoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.status === 503 && !navigator.onLine) {
        await encolarMutacion({ tipo: 'prestamo.update', entityId: prestamoId, payload, baseUpdatedAt: prestamo?.updatedAt })
        try { sessionStorage.setItem('cf-toast', 'Plazo modificado. Se sincronizará al volver online.') } catch {}
        onSuccess?.()
        handleClose()
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al modificar plazo')
      }
      onSuccess?.()
      handleClose()
    } catch (e) {
      // Si el fetch fallo por red (sin navigator.onLine = false todavia), encolar
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        try {
          await encolarMutacion({ tipo: 'prestamo.update', entityId: prestamoId, payload, baseUpdatedAt: prestamo?.updatedAt })
          try { sessionStorage.setItem('cf-toast', 'Plazo modificado. Se sincronizará al volver online.') } catch {}
          onSuccess?.()
          handleClose()
          return
        } catch {}
      }
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setDiasExtra('')
    setError('')
    onClose?.()
  }

  // ── LA HOJA DE T13-02 ──────────────────────────────────────────────────────
  //
  // Solo para EXTENDER, que es lo que la lámina dibuja. «Corregir fin» y «corregir
  // inicio» siguen por el formulario de abajo, que es el que sabe pedir una fecha:
  // ahí no se está repartiendo el saldo en más cuotas, se está arreglando un dato
  // mal metido, y un contador de cuotas no sirve para eso.
  //
  // EL CONTADOR SUSTITUYE al campo «días extra» más el selector de fecha, que se
  // contradecían entre sí. Aquí el contador es la única fuente: la fecha se deriva
  // de él y se manda al mismo endpoint de siempre.
  if (modo === 'extender') {
    const porPeriodo = diasPorPeriodo
    const pendientes = Math.max(1, Number(prestamo?.cuotasPendientes ?? 1))
    // Cuántas cuotas faltan HOY según lo que se lleva tecleado: el contador arranca
    // en las que faltan y los `diasExtra` lo mueven.
    const extra = Math.max(0, Number(diasExtra) || 0)
    const cuotas = pendientes + Math.round(extra / porPeriodo)
    const datos = adaptarPlazo(prestamo, cuotas) ?? {}

    const mover = (delta) => {
      const nuevas = Math.max(pendientes, cuotas + delta)
      handleDiasChange(String((nuevas - pendientes) * porPeriodo))
    }

    return (
      <HojaInferior
      onVolver={onVolver}
        abierta={open}
        onCerrar={handleClose}
        titulo="Modificar el plazo"
        subtitulo={[
          prestamo?.cliente?.nombre,
          `le quedan ${pendientes} ${pendientes === 1 ? 'cuota' : 'cuotas'}`,
        ].filter(Boolean).join(' · ')}
        accion={
          <PieGestion
            onCancelar={handleClose}
            onAceptar={handleSubmit}
            textoAceptar={cuotas > pendientes ? `Guardar ${cuotas} cuotas` : 'Guardar'}
            aceptando={loading}
            deshabilitado={cuotas <= pendientes}
            error={error}
          />
        }
      >
        <HojaPlazo
          intenciones={[
            { id: 'extender', etiqueta: 'Extender plazo' },
            { id: 'corregirFin', etiqueta: 'Corregir fin' },
            { id: 'corregirInicio', etiqueta: 'Corregir inicio' },
          ]}
          intencion="extender"
          onIntencion={(i) => setModo(i.id)}
          cuotas={cuotas}
          cuotasAntes={pendientes}
          minimoCuotas={pendientes}
          onMenos={() => mover(-1)}
          onMas={() => mover(1)}
          {...datos}
        />
      </HojaInferior>
    )
  }

  return (
    <Modal onVolver={onVolver} open={open} onClose={handleClose} title="Modificar plazo">
      <div className="space-y-4">
        {/* Toggle de modo */}
        <div>
          <label className="block text-[11px] font-medium text-[var(--cf-ink-3)] uppercase tracking-[0.05em] mb-1.5">
            ¿Qué quieres hacer?
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setModo('extender')}
              className={[
                'h-auto py-2.5 px-3 rounded-[10px] border text-left transition-all cursor-pointer',
                modo === 'extender'
                  ? 'bg-[rgba(245,197,24,0.1)] border-[var(--cf-gold)]'
                  : 'bg-transparent border-[var(--cf-border)] hover:bg-[var(--cf-surface)]',
              ].join(' ')}
            >
              <div className={`text-xs font-semibold ${modo === 'extender' ? 'text-[var(--cf-gold)]' : 'text-[var(--cf-ink)]'}`}>
                Extender plazo
              </div>
              <div className="text-[10px] text-[var(--cf-ink-3)] mt-0.5 leading-tight">
                Dar más tiempo. Recalcula cuota.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setModo('corregir')}
              className={[
                'h-auto py-2.5 px-3 rounded-[10px] border text-left transition-all cursor-pointer',
                modo === 'corregir'
                  ? 'bg-[rgba(59,130,246,0.1)] border-[var(--cf-ink-2)]'
                  : 'bg-transparent border-[var(--cf-border)] hover:bg-[var(--cf-surface)]',
              ].join(' ')}
            >
              <div className={`text-xs font-semibold ${modo === 'corregir' ? 'text-[var(--cf-ink-2)]' : 'text-[var(--cf-ink)]'}`}>
                Corregir fin
              </div>
              <div className="text-[10px] text-[var(--cf-ink-3)] mt-0.5 leading-tight">
                Error en fecha fin. No toca cuota.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setModo('corregirInicio')}
              className={[
                'h-auto py-2.5 px-3 rounded-[10px] border text-left transition-all cursor-pointer',
                modo === 'corregirInicio'
                  ? 'bg-[rgba(59,130,246,0.1)] border-[var(--cf-ink-2)]'
                  : 'bg-transparent border-[var(--cf-border)] hover:bg-[var(--cf-surface)]',
              ].join(' ')}
            >
              <div className={`text-xs font-semibold ${modo === 'corregirInicio' ? 'text-[var(--cf-ink-2)]' : 'text-[var(--cf-ink)]'}`}>
                Corregir inicio
              </div>
              <div className="text-[10px] text-[var(--cf-ink-3)] mt-0.5 leading-tight">
                Error en fecha inicio. Mueve el fin igual.
              </div>
            </button>
          </div>
        </div>

        {/* Resumen actual */}
        <div className="px-3 py-2.5 rounded-[10px] bg-[var(--cf-card)] border border-[var(--cf-border)] space-y-1">
          {modo === 'corregirInicio' && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--cf-ink-3)]">Fecha inicio actual</span>
              <span className="text-xs text-[var(--cf-ink)] font-mono-display">
                {fechaInicio ? formatFechaCalendario(fechaInicio) : '—'}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--cf-ink-3)]">Fecha fin actual</span>
            <span className="text-xs text-[var(--cf-ink)] font-mono-display">
              {fechaFinActual ? formatFechaCalendario(fechaFinActual) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--cf-ink-3)]">Cuota {frecuencia}</span>
            <span className="text-xs text-[var(--cf-ink)] font-mono-display">{formatMoney(cuotaActual)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--cf-ink-3)]">Plazo actual</span>
            <span className="text-xs text-[var(--cf-ink)]">{diasPlazoActual} días</span>
          </div>
        </div>

        {/* Inputs: fecha fin (extender/corregir) o fecha inicio (corregirInicio) */}
        {modo === 'corregirInicio' ? (
          <Input
            label="Nueva fecha de inicio"
            type="date"
            value={nuevaFechaInicio}
            onChange={(e) => setNuevaFechaInicio(e.target.value)}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Días extra"
              type="number"
              inputMode="numeric"
              placeholder="Ej: 15"
              value={diasExtra}
              onChange={(e) => handleDiasChange(e.target.value)}
            />
            <Input
              label="Nueva fecha fin"
              type="date"
              value={nuevaFecha}
              onChange={(e) => handleFechaChange(e.target.value)}
            />
          </div>
        )}

        {/* Preview corregir inicio */}
        {modo === 'corregirInicio' && previewInicio && (
          <div className="rounded-[12px] border p-3 space-y-1.5" style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.25)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--cf-ink-3)]">Nueva fecha fin</span>
              <span className="text-xs font-semibold text-[var(--cf-ink)] font-mono-display">
                {new Date(previewInicio.nuevaFin + 'T00:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <p className="text-[10px] text-[var(--cf-ink-3)] leading-snug pt-1">
              Se corre el inicio {previewInicio.delta > 0 ? `+${previewInicio.delta}` : previewInicio.delta} días y el fin se mueve igual. La cuota, el total y los pagos no cambian.
            </p>
          </div>
        )}

        {/* Preview */}
        {modo !== 'corregirInicio' && preview && (
          <div
            className="rounded-[12px] border p-3 space-y-1.5"
            style={{
              background: modo === 'extender' ? 'rgba(245,197,24,0.06)' : 'rgba(59,130,246,0.06)',
              borderColor:  modo === 'extender' ? 'rgba(245,197,24,0.25)' : 'rgba(59,130,246,0.25)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[var(--cf-ink-3)]">Nuevo plazo</span>
              <span className="text-xs font-semibold text-[var(--cf-ink)]">{preview.nuevoDiasPlazo} días</span>
            </div>
            {modo === 'extender' && preview.nuevaCuota != null && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--cf-ink-3)]">Nueva cuota {frecuencia}</span>
                  <span className="text-xs font-bold text-[var(--cf-gold)] font-mono-display">
                    {formatMoney(preview.nuevaCuota)}
                    {preview.cuotaDelta !== 0 && (
                      <span className={`ml-1 text-[11px] ${preview.cuotaDelta < 0 ? 'text-[var(--cf-green-dark)]' : 'text-[var(--cf-red-dark)]'}`}>
                        ({preview.cuotaDelta > 0 ? '+' : ''}{formatMoney(Math.abs(preview.cuotaDelta))})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--cf-ink-3)]">Total a pagar</span>
                  <span className="text-xs font-semibold text-[var(--cf-ink)] font-mono-display">
                    {formatMoney(preview.nuevoTotal)}
                  </span>
                </div>
              </>
            )}
            {modo === 'corregir' && (
              <p className="text-[10px] text-[var(--cf-ink-3)] leading-snug pt-1">
                Solo se actualizará la fecha. La cuota, el total y los pagos no cambian.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm text-[var(--cf-red-dark)]">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">
            {modo === 'extender' ? 'Extender plazo' : modo === 'corregirInicio' ? 'Corregir inicio' : 'Corregir fin'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
