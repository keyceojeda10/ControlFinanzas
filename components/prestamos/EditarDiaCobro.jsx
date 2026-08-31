'use client'
// components/prestamos/EditarDiaCobro.jsx — T19-02 «Cambiar el dia de cobro».
//
// PIEL NUEVA, MOTOR IGUAL. El payload, la cola offline y la validacion siguen
// siendo los de siempre.
//
// LA HOJA NUEVA SOLO CUBRE EL DIA DE LA SEMANA, que es lo que dibuja T19-02. Los
// otros dos casos se quedan con el formulario de antes y NO se pierden:
//
//   · dia del MES —«siempre el 15»—, que es como cobra media cartera mensual;
//   · las DOS fechas del quincenal —«el 15 y el 30»—, que la lamina ni menciona.
//
// Cambiar de forma la mitad y borrar la otra mitad no es rediseñar, es quitar
// funciones.
//
// «PARA SIEMPRE, NO SOLO ESTA VEZ» va en el subtitulo, y es lo que separa esta
// pantalla de aplazar. Quien quiere mover UN cobro entra aqui por error y le cambia
// el calendario al cliente para siempre.

import { useState, useEffect } from 'react'
import { Modal }  from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { encolarMutacion } from '@/lib/offline'
import HojaInferior from '@/components/cf/HojaInferior'
import { DiaDeCobro, PieGestion } from '@/components/pantallas/Gestion'
import { diasDeCobro, adaptarDiaDeCobro } from '@/lib/adaptadores/gestion'

const DIAS_SEMANA = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' },
  { value: '0', label: 'Domingo' },
]

export default function EditarDiaCobro({
  /* La flecha de volver al menú de Gestión, si se llegó desde ahí. */
  onVolver, prestamoId, prestamo, open, onClose, onSuccess }) {
  const frecuencia = prestamo?.frecuencia || 'diario'
  const esSemana = frecuencia === 'semanal' || frecuencia === 'quincenal'
  const esMes = frecuencia === 'mensual'
  const esQuincenal = frecuencia === 'quincenal'

  // modo: 'semana' = por dia de la semana, 'mes' = por numero de dia del mes
  const [modo, setModo] = useState('semana')
  const [valor, setValor] = useState('')
  const [valor2, setValor2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (esSemana) {
      if (prestamo?.diaCobroMes != null && prestamo?.diaCobroSemana == null) {
        setModo('mes')
        setValor(String(prestamo.diaCobroMes))
        setValor2(prestamo?.diaCobroMes2 != null ? String(prestamo.diaCobroMes2) : '')
      } else {
        setModo('semana')
        setValor(prestamo?.diaCobroSemana != null ? String(prestamo.diaCobroSemana) : '')
        setValor2('')
      }
    } else if (esMes) {
      setModo('mes')
      setValor(prestamo?.diaCobroMes != null ? String(prestamo.diaCobroMes) : '')
      setValor2('')
    } else {
      setModo('semana')
      setValor('')
      setValor2('')
    }
  }, [open, esSemana, esMes, prestamo?.diaCobroSemana, prestamo?.diaCobroMes, prestamo?.diaCobroMes2])

  const handleClose = () => { setError(''); onClose?.() }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    const payload = { modo: 'diaCobro' }
    if (modo === 'semana' && esSemana) {
      payload.diaCobroSemana = valor === '' ? null : Number(valor)
      payload.diaCobroMes = null
      payload.diaCobroMes2 = null
    } else {
      payload.diaCobroMes = valor === '' ? null : Number(valor)
      payload.diaCobroSemana = null
      payload.diaCobroMes2 = (esQuincenal && modo === 'mes' && valor2 !== '') ? Number(valor2) : null
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await encolarMutacion({
          tipo: 'prestamo.update',
          entityId: prestamoId,
          payload,
          baseUpdatedAt: prestamo?.updatedAt,
        })
        try { sessionStorage.setItem('cf-toast', 'Día de cobro actualizado. Se sincronizará al volver online.') } catch {}
        onSuccess?.()
        handleClose()
      } catch {
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al actualizar')
      }
      onSuccess?.()
      handleClose()
    } catch (e) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        try {
          await encolarMutacion({ tipo: 'prestamo.update', entityId: prestamoId, payload, baseUpdatedAt: prestamo?.updatedAt })
          try { sessionStorage.setItem('cf-toast', 'Día de cobro actualizado. Se sincronizará al volver online.') } catch {}
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

  if (!esSemana && !esMes) {
    return (
      <Modal onVolver={onVolver} open={open} onClose={handleClose} title="Día de cobro">
        <p className="text-sm text-[var(--cf-ink-3)]">
          La frecuencia diaria no admite un día fijo de cobro.
        </p>
        <div className="pt-3">
          <Button variant="secondary" onClick={handleClose} className="w-full">Cerrar</Button>
        </div>
      </Modal>
    )
  }

  // ── LA HOJA DE T19-02 ──────────────────────────────────────────────────────
  //
  // Solo para el dia de la SEMANA. Con `modo === 'mes'` se cae al formulario de
  // abajo, que es el que sabe pedir un dia del mes y las dos fechas del quincenal.
  if (esSemana && modo === 'semana') {
    const dias = diasDeCobro(prestamo, prestamo?.diasSinCobro ?? prestamo?.cliente?.diasSinCobro)
    const elegido = valor === '' ? null : Number(valor)
    const datos = adaptarDiaDeCobro(
      prestamo,
      elegido,
      // El proximo cobro con el dia nuevo lo calcula el SERVIDOR al guardar. Aqui no
      // se recalcula: ya hay tres funciones que responden a esa pregunta y se
      // contradicen, y esta es la pantalla que las mueve.
      null,
      prestamo?.diasSinCobro ?? prestamo?.cliente?.diasSinCobro,
    )
    const nombreElegido = dias.find((d) => d.id === elegido)?.nombre

    return (
      <HojaInferior
      onVolver={onVolver}
        abierta={open}
        onCerrar={handleClose}
        titulo="Cambiar el día de cobro"
        subtitulo="Para siempre, no solo esta vez"
        accion={
          <PieGestion
            onCancelar={handleClose}
            onAceptar={handleSubmit}
            textoAceptar={nombreElegido ? `Guardar los ${nombreElegido}` : 'Guardar'}
            aceptando={loading}
            deshabilitado={elegido == null}
            error={error}
          />
        }
      >
        <DiaDeCobro
          dias={dias}
          dia={elegido}
          onDia={(d) => setValor(String(d.id))}
          nota={datos.nota}
          {...datos}
        />

        {/* La otra forma de fijarlo, que la lamina no dibuja y que media cartera
            mensual usa: «siempre el 15». Va como enlace, no como opcion de la fila:
            son dos maneras distintas de contestar la misma pregunta, y ponerlas al
            mismo nivel es lo que hacia que se contradijeran. */}
        <button type="button" onClick={() => { setModo('mes'); setValor('') }} style={{
          alignSelf: 'flex-start', padding: '0 2px', border: 0, background: 'none',
          cursor: 'pointer', font: 'inherit', textAlign: 'left',
          fontSize: 12, fontWeight: 700, color: 'var(--cf-gold-dark)',
        }}>Mejor por día del mes {esQuincenal ? '(o dos fechas)' : ''}</button>
      </HojaInferior>
    )
  }

  return (
    <Modal onVolver={onVolver} open={open} onClose={handleClose} title="Día de cobro">
      <div className="space-y-4">
        <p className="text-xs text-[var(--cf-ink-3)] leading-snug">
          {modo === 'semana'
            ? 'Fija el día de la semana en que siempre se cobra. Aunque se atrase un pago, el próximo cobro caerá en ese día.'
            : 'Fija el día del mes en que siempre se cobra. Si el mes no tiene ese día, se cobra el último día disponible.'}
        </p>

        {esSemana && (
          <div className="flex gap-1 p-1 rounded-[12px]" style={{ background: 'var(--cf-fill)', border: '1px solid var(--cf-border)' }}>
            <button
              type="button"
              onClick={() => { setModo('semana'); setValor('') }}
              className="flex-1 py-1.5 text-[11px] font-semibold rounded-[8px] transition-all"
              style={modo === 'semana' ? {
                background: 'var(--cf-card)',
                color: 'var(--cf-gold)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
              } : { color: 'var(--cf-ink-3)' }}
            >
              Día de la semana
            </button>
            <button
              type="button"
              onClick={() => { setModo('mes'); setValor('') }}
              className="flex-1 py-1.5 text-[11px] font-semibold rounded-[8px] transition-all"
              style={modo === 'mes' ? {
                background: 'var(--cf-card)',
                color: 'var(--cf-gold)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
              } : { color: 'var(--cf-ink-3)' }}
            >
              {esQuincenal ? 'Días del mes' : 'Día del mes'}
            </button>
          </div>
        )}

        {modo === 'mes' && esQuincenal ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[var(--cf-ink-3)] uppercase tracking-[0.05em]">
                Primer cobro
              </label>
              <select
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="h-10 px-2 rounded-[10px] bg-[var(--cf-surface)] border border-[var(--cf-border)] text-sm text-[var(--cf-ink)]"
              >
                <option value="">—</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[var(--cf-ink-3)] uppercase tracking-[0.05em]">
                Segundo cobro
              </label>
              <select
                value={valor2}
                onChange={(e) => setValor2(e.target.value)}
                className="h-10 px-2 rounded-[10px] bg-[var(--cf-surface)] border border-[var(--cf-border)] text-sm text-[var(--cf-ink)]"
              >
                <option value="">—</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[var(--cf-ink-3)] uppercase tracking-[0.05em]">
              {modo === 'semana' ? 'Día de la semana' : 'Día del mes'}
            </label>
            <select
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="h-10 px-2 rounded-[10px] bg-[var(--cf-surface)] border border-[var(--cf-border)] text-sm text-[var(--cf-ink)]"
            >
              <option value="">Sin día fijo (corre según inicio)</option>
              {modo === 'semana'
                ? DIAS_SEMANA.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)
                : Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
            </select>
          </div>
        )}

        {error && <p className="text-sm text-[var(--cf-red-dark)]">{error}</p>}

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleSubmit} loading={loading} className="flex-1">Guardar</Button>
        </div>
      </div>
    </Modal>
  )
}
