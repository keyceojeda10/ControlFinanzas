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
import CuotasExtraEditor   from '@/components/prestamos/CuotasExtraEditor'
import { calcularPrestamo } from '@/lib/calculos'
import { formatMoney, soloDecimal, formatFechaCalendario } from '@/lib/i18n'
import { CorregirPrestamo } from '@/components/pantallas/Gestion'
import { adaptarCorregir } from '@/lib/adaptadores/gestion'

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

// `modoInicial` es de donde viene la comparacion de calendarios (T12-02): la hoja
// enseña que en «Sobre saldo» el cliente pagaria menos, y al elegirlo abre este
// modal YA en ese modo. Sin el, elegir un calendario dejaba al dueño en un modal
// con el modo viejo puesto y teniendo que acordarse de cual habia elegido.
export default function EditarPrestamo({ prestamo, open, onClose, onSuccess, socios = [], modoInicial }) {
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
  const [modoInteres,  setModoInteres]  = useState(modoInicial || p.modoInteres || 'fijo')
  const [cuotaManual,  setCuotaManual]  = useState(
    (p.modoInteres === 'manual' || p.modoInteres === 'saldo') && p.cuotaManual
      ? String(Math.round(p.cuotaManual))
      : p.modoInteres === 'manual' ? String(Math.round(p.cuotaDiaria || 0)) : ''
  )
  const [diaCobroSem,  setDiaCobroSem]  = useState(p.diaCobroSemana ?? '')
  const [diaCobroMes,  setDiaCobroMes]  = useState(p.diaCobroMes ?? '')
  const [seguro,       setSeguro]       = useState(Boolean(p.seguro))
  const [montoSeguro,  setMontoSeguro]  = useState(String(p.montoSeguro || ''))
  const [nombreProd,   setNombreProd]   = useState(p.nombreProducto || '')
  const [socioId,      setSocioId]      = useState(p.socioId || '')
  const [capitalExtraState, setCapitalExtraState] = useState(
    Array.isArray(p.capitalExtra) ? p.capitalExtra : []
  )
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
        cuotaManual: (modoInteres === 'manual' || modoInteres === 'saldo') && Number(cuotaManual) > 0 ? Number(cuotaManual) : undefined,
        ...(capitalExtraState.length > 0 && { capitalExtra: capitalExtraState }),
      })
    } catch { return null }
  }, [monto, tasa, periodos, fechaInicio, frecuencia, modoInteres, cuotaManual, capitalExtraState])

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
        cuotaManual: (modoInteres === 'manual' || modoInteres === 'saldo') && Number(cuotaManual) > 0 ? Number(cuotaManual) : undefined,
        diaCobroSemana: (frecuencia === 'semanal' || frecuencia === 'quincenal') && diaCobroSem !== ''
          ? Number(diaCobroSem) : null,
        diaCobroMes: frecuencia === 'mensual' && diaCobroMes !== '' ? Number(diaCobroMes) : null,
        seguro,
        montoSeguro: seguro ? Number(montoSeguro) : null,
        nombreProducto: nombreProd || null,
        socioId: socioId || null,
        capitalExtra: capitalExtraState.length > 0 ? capitalExtraState : undefined,
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

  // ── T19-05 · LA CABECERA DE «CORREGIR EL PRÉSTAMO» ────────────────────────
  //
  // Con pagos encima, esta pantalla NO es un formulario de renegociar: los campos de
  // cálculo están bloqueados a propósito porque tocarlos inflaba la deuda. Lo que la
  // lámina aporta y aquí faltaba es decir CUÁNTOS pagos hay y qué pasa con cada
  // campo, en vez de un aviso genérico que se lee una vez y se olvida.
  //
  // El resumen va DENTRO del modal existente, no en una hoja aparte: el formulario
  // de abajo sigue siendo el que guarda, y partirlo en dos pantallas para cambiar
  // cómo se ve sería mover el riesgo de sitio.
  const resumenCorregir = adaptarCorregir(prestamo)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Corregir el préstamo"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>Cancelar</Button>
          <Button onClick={handleGuardar} loading={guardando}>Guardar cambios</Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        {/* T19-05: la consecuencia CAMPO POR CAMPO, con el numero real de pagos.
            Sustituye al aviso generico, que decia lo mismo para los tres campos y no
            distinguia el que si se puede tocar —la fecha de inicio— de los dos que
            estan bloqueados. */}
        <CorregirPrestamo
          aviso={resumenCorregir.aviso}
          peligrosos={resumenCorregir.peligrosos}
        />

        {/* Campos de cálculo: solo si NO hay pagos. Con pagos, cambiarlos
            recalculaba mal (re-cobraba interés) e inflaba la deuda. */}
        {!hayPagos && (<>
        {/* Monto */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Monto prestado</label>
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
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Tasa de interés (%)</label>
            <Input
              type="text"
              inputMode="decimal"
              value={tasa}
              onChange={(e) => setTasa(soloDecimal(e.target.value))}
              placeholder="Ej: 20"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Fecha de inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              max={hoyISO()}
              className="w-full h-10 rounded-[10px] border border-[var(--cf-border)] bg-[var(--cf-card)] px-3 text-sm text-[var(--cf-ink)]"
            />
          </div>
        </div>

        {/* Modo de interés */}
        <ModoInteresSelector
          modoInteres={modoInteres}
          onChange={(m) => { setModoInteres(m); setCapitalExtraState([]) }}
          monto={monto}
          tasa={tasa}
          frecuencia={frecuencia}
          diasPlazo={diasPlazo}
        />
        {modoInteres === 'manual' && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Cuota fija</label>
            <MoneyInput value={cuotaManual} onChange={(e) => setCuotaManual(e.target.value)} placeholder="Cuota por período" />
          </div>
        )}
        {modoInteres === 'saldo' && (
          <div>
            <MoneyInput
              label="Cuota fija personalizada (opcional)"
              value={cuotaManual}
              onChange={(e) => setCuotaManual(e.target.value)}
              placeholder="Dejar vacío para calcular automático"
            />
            <p className="text-[10px] mt-1 px-1" style={{ color: 'var(--cf-ink-3)' }}>
              Opcional: define la cuota en vez de calcularla con la fórmula francesa.
            </p>
          </div>
        )}

        {/* Cuotas extra */}
        {modoInteres !== 'manual' && (Number(periodos) || 0) > 1 && (
          <CuotasExtraEditor
            extras={capitalExtraState}
            onChange={setCapitalExtraState}
            numPeriodos={Number(periodos) || 1}
            frecuencia={frecuencia}
            fechaInicio={fechaInicio}
          />
        )}

        {/* Plazo y frecuencia */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Plazo (períodos)</label>
            <Input
              type="number"
              value={periodos}
              onChange={(e) => setPeriodos(e.target.value)}
              min="1"
              placeholder="Ej: 30"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Frecuencia de cobro</label>
            <select
              value={frecuencia}
              onChange={(e) => { setFrecuencia(e.target.value); setDiaCobroSem(''); setDiaCobroMes('') }}
              className="w-full h-10 rounded-[10px] border border-[var(--cf-border)] bg-[var(--cf-card)] px-3 text-sm text-[var(--cf-ink)]"
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
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Día de cobro (opcional)</label>
            <select
              value={diaCobroSem}
              onChange={(e) => setDiaCobroSem(e.target.value)}
              className="w-full h-10 rounded-[10px] border border-[var(--cf-border)] bg-[var(--cf-card)] px-3 text-sm text-[var(--cf-ink)]"
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
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Día del mes (opcional)</label>
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
        </>)}

        {/* Seguro */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="seguro-editar"
            checked={seguro}
            onChange={(e) => setSeguro(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          <label htmlFor="seguro-editar" className="text-sm text-[var(--cf-ink)]">Incluir seguro</label>
        </div>
        {seguro && (
          <MoneyInput value={montoSeguro} onChange={(e) => setMontoSeguro(e.target.value)} placeholder="Monto del seguro" />
        )}

        {/* Nombre producto (si es mercancía) */}
        {p.nombreProducto != null && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Nombre del producto</label>
            <Input value={nombreProd} onChange={(e) => setNombreProd(e.target.value)} placeholder="Ej: Televisor" />
          </div>
        )}

        {/* Socio */}
        {socios.length > 0 && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Socio (opcional)</label>
            <select
              value={socioId}
              onChange={(e) => setSocioId(e.target.value)}
              className="w-full h-10 rounded-[10px] border border-[var(--cf-border)] bg-[var(--cf-card)] px-3 text-sm text-[var(--cf-ink)]"
            >
              <option value="">Sin socio</option>
              {socios.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {/* Resumen en vivo — solo cuando se editan campos de cálculo (sin pagos) */}
        {!hayPagos && resumen && (
          <div className="rounded-[12px] border border-[var(--cf-border)] bg-[var(--cf-card)] p-3 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cf-ink-3)]">Resumen nuevo</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-[10px] text-[var(--cf-ink-3)]">Cuota</p>
                <p className="font-bold font-mono-display text-[var(--cf-gold)]">{formatMoney(resumen.cuotaDiaria)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--cf-ink-3)]">Total a pagar</p>
                <p className="font-bold font-mono-display text-[var(--cf-ink)]">{formatMoney(resumen.totalAPagar)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--cf-ink-3)]">Períodos</p>
                <p className="font-semibold text-[var(--cf-ink)]">{resumen.numPeriodos} {frecuencia}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--cf-ink-3)]">Fecha fin</p>
                <p className="font-semibold text-[var(--cf-ink)]">
                  {resumen.fechaFin ? formatFechaCalendario(resumen.fechaFin) : '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-[var(--cf-red-dark)] bg-[var(--cf-red-pill-bg)] rounded-[10px] px-3 py-2">{error}</p>
        )}
      </div>
    </Modal>
  )
}
