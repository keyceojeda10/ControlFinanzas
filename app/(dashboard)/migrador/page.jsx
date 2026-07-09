'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { calcularPrestamo } from '@/lib/calculos'
import { formatMoney } from '@/lib/i18n'
import MoneyInput from '@/components/ui/MoneyInput'
import { invalidarCachePorPrefijo } from '@/lib/offline'
import ModoInteresSelector from '@/components/prestamos/ModoInteresSelector'
import DiasSinCobroSelector from '@/components/ui/DiasSinCobroSelector'

const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoyISO = () => getColombiaDate().toISOString().slice(0, 10)

const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }
const PLAZO_DEFAULT = { diario: '30', semanal: '8', quincenal: '4', mensual: '2' }
const FRECUENCIAS = [
  { key: 'diario', label: 'Diario' },
  { key: 'semanal', label: 'Semanal' },
  { key: 'quincenal', label: 'Quincenal' },
  { key: 'mensual', label: 'Mensual' },
]
const CHIPS_MONTO = [50000, 100000, 200000, 500000, 1000000]

function fichaVacia(defaults) {
  return {
    nombre: '',
    cedula: '',
    telefono: '',
    direccion: '',
    monto: '',
    tasa: defaults.tasa,
    frecuencia: defaults.frecuencia,
    plazoUnidades: PLAZO_DEFAULT[defaults.frecuencia],
    modoInteres: defaults.modoInteres,
    fechaInicio: hoyISO(),
    esEnCurso: false,
    yaAbonado: '',
    cuotaManual: '',
    diasSinCobro: [],
    rutaId: defaults.rutaId,
  }
}

function calcularDiasPlazo(plazoUnidades, frecuencia) {
  return String((Number(plazoUnidades) || 0) * (DIAS_POR_PERIODO[frecuencia] || 1))
}

function calcularFicha(ficha) {
  const m = Number(ficha.monto)
  const t = Number(ficha.tasa)
  const d = Number(calcularDiasPlazo(ficha.plazoUnidades, ficha.frecuencia))
  if (m <= 0 || t < 0 || d <= 0) return null
  const cm = ficha.modoInteres === 'manual' ? Number(ficha.cuotaManual) : 0
  try {
    return calcularPrestamo({
      montoPrestado: m, tasaInteres: t, diasPlazo: d,
      fechaInicio: ficha.fechaInicio || hoyISO(),
      frecuencia: ficha.frecuencia, modoInteres: ficha.modoInteres,
      ...(cm > 0 && { cuotaManual: cm }),
    })
  } catch { return null }
}

// ─── Vista: selector foto vs manual ───────────────────────────────
function SelectorMetodo({ onFoto, onManual, ocrLoading, ocrError, fotoInputRef, onFotoChange, numero }) {
  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--color-accent)', color: '#000' }}>
            {numero}
          </div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Agregar cliente #{numero}
          </h2>
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Si tienes una foto de la cartulina, cuaderno o libreta del cliente, la IA puede leer los datos por ti. Si no, puedes escribir todo manual.
        </p>
      </div>

      <div className="space-y-3">
        <input ref={fotoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFotoChange} />
        <button type="button" onClick={onManual} disabled={ocrLoading}
          className="w-full text-left rounded-2xl p-5 transition-all active:scale-[0.98] disabled:opacity-60"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-card)), var(--color-bg-card))',
            border: '1.5px solid color-mix(in srgb, var(--color-accent) 30%, var(--color-border))',
          }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Escribir manual</h3>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Escribe el nombre, cédula, monto y condiciones del préstamo.</p>
            </div>
          </div>
        </button>

        <button type="button" onClick={onFoto} disabled={ocrLoading}
          className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ background: 'var(--color-bg-card)', border: '1.5px solid var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--color-info, #3b82f6) 12%, transparent)', color: 'var(--color-info, #3b82f6)' }}>
              {ocrLoading ? (
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {ocrLoading ? 'Leyendo foto...' : 'Desde foto'}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {ocrLoading ? 'Extrayendo datos...' : 'La IA lee la cartulina o libreta'}
              </p>
            </div>
          </div>
        </button>
      </div>

      {ocrError && (
        <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{ background: 'var(--color-danger-dim)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {ocrError}
        </div>
      )}
    </div>
  )
}

function EditableResumenRow({ label, value, children, valueColor }) {
  const [editing, setEditing] = useState(false)
  return (
    <div>
      {editing ? (
        <div className="space-y-1.5 py-1">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
            <button type="button" onClick={() => setEditing(false)} className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ color: 'var(--color-success)', background: 'color-mix(in srgb, var(--color-success) 12%, transparent)' }}>OK</button>
          </div>
          {children}
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="flex justify-between items-center w-full py-1 text-left group">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-semibold" style={{ color: valueColor || 'var(--color-text-primary)' }}>{value}</span>
            <svg className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: 'var(--color-text-muted)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" /></svg>
          </span>
        </button>
      )}
    </div>
  )
}

// ─── Vista: formulario de cliente + préstamo ──────────────────────
function FormularioFicha({ ficha, set, calculo, diasPlazo, rutas, defaultRutaId, nombreRef, error, onGuardar, saving, editando, numero, sinCedula, setSinCedula }) {
  const freqLabel = FRECUENCIAS.find(f => f.key === ficha.frecuencia)?.label?.toLowerCase() || ficha.frecuencia
  const unidadPlazo = { diario: 'días', semanal: 'semanas', quincenal: 'quincenas', mensual: 'meses' }[ficha.frecuencia] || 'días'
  const [modoInteresTocado, setModoInteresTocado] = useState(editando)

  const handleFrecuenciaChange = (freq) => {
    set('frecuencia', freq)
    set('plazoUnidades', PLAZO_DEFAULT[freq])
  }

  const saldoPendiente = useMemo(() => {
    if (!calculo) return null
    const abonado = Number(ficha.yaAbonado) || 0
    return calculo.totalAPagar - abonado
  }, [calculo, ficha.yaAbonado])

  return (
    <div className="space-y-5">
      {/* ── ENCABEZADO ── */}
      {!editando && (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'var(--color-accent)', color: '#000' }}>
            {numero}
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>Cliente #{numero}</h2>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Completa los datos y configura su préstamo</p>
          </div>
        </div>
      )}

      {/* ── DATOS DEL CLIENTE ── */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-1"
          style={{ color: 'var(--color-accent)' }}>Datos del cliente</h3>
        <p className="text-[11px] mb-2.5" style={{ color: 'var(--color-text-muted)' }}>
          Nombre y teléfono son obligatorios. Cédula y dirección son opcionales.
        </p>
        <div className="space-y-2.5">
          <input ref={nombreRef} type="text" placeholder="Nombre completo *" autoFocus
            value={ficha.nombre} onChange={e => set('nombre', e.target.value)}
            className="w-full h-11 rounded-[10px] border px-3 text-sm"
            style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
          <div className={`grid gap-2.5 ${sinCedula ? '' : 'grid-cols-2'}`}>
            {!sinCedula && (
              <input type="text" placeholder="Cédula" inputMode="numeric"
                value={ficha.cedula} onChange={e => set('cedula', e.target.value)}
                className="w-full h-11 rounded-[10px] border px-3 text-sm"
                style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
            )}
            <input type="tel" placeholder="Teléfono *"
              value={ficha.telefono} onChange={e => set('telefono', e.target.value)}
              className="w-full h-11 rounded-[10px] border px-3 text-sm"
              style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={sinCedula}
              onChange={(e) => {
                setSinCedula(e.target.checked)
                if (e.target.checked) set('cedula', '')
              }}
              className="accent-[var(--color-accent)] w-4 h-4 rounded" />
            <span className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
              No tengo el número de la cédula
            </span>
          </label>
          <input type="text" placeholder="Dirección (opcional)"
            value={ficha.direccion} onChange={e => set('direccion', e.target.value)}
            className="w-full h-11 rounded-[10px] border px-3 text-sm"
            style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
        </div>
      </div>

      {/* ── PRÉSTAMO ── */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide mb-1"
          style={{ color: 'var(--color-accent)' }}>Condiciones del préstamo</h3>
        <p className="text-[11px] mb-2.5" style={{ color: 'var(--color-text-muted)' }}>
          Configura el monto, la tasa, la frecuencia de cobro y el plazo. Si este cliente tiene condiciones diferentes a los demas, puedes cambiarlo aqui.
        </p>
        <div className="space-y-3">
          {/* Monto */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
              style={{ color: 'var(--color-text-muted)' }}>Cuanto le prestas?</label>
            <MoneyInput
              value={ficha.monto}
              onChange={e => set('monto', e.target.value)}
              placeholder="Monto prestado *"
              className="!h-12 !text-base !font-semibold"
            />
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {CHIPS_MONTO.map(v => (
                <button key={v} type="button" onClick={() => set('monto', String(v))}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
                  style={{
                    background: Number(ficha.monto) === v ? 'var(--color-accent-soft)' : 'var(--color-bg-base)',
                    borderColor: Number(ficha.monto) === v ? 'var(--color-accent)' : 'var(--color-border)',
                    color: Number(ficha.monto) === v ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  }}>
                  {formatMoney(v)}
                </button>
              ))}
            </div>
          </div>

          {/* Tasa + Frecuencia + Plazo */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
                style={{ color: 'var(--color-text-muted)' }}>Tasa %</label>
              <input type="number" inputMode="decimal" value={ficha.tasa}
                onChange={e => set('tasa', e.target.value)}
                className="w-full h-10 rounded-[10px] border px-3 text-sm"
                style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
                style={{ color: 'var(--color-text-muted)' }}>Frecuencia</label>
              <select value={ficha.frecuencia} onChange={e => handleFrecuenciaChange(e.target.value)}
                className="w-full h-10 rounded-[10px] border px-2 text-sm"
                style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                {FRECUENCIAS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
                style={{ color: 'var(--color-text-muted)' }}>Plazo ({unidadPlazo})</label>
              <input type="number" inputMode="numeric" value={ficha.plazoUnidades}
                onChange={e => set('plazoUnidades', e.target.value)}
                className="w-full h-10 rounded-[10px] border px-3 text-sm"
                style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
            </div>
          </div>

          {/* Modo interés */}
          <ModoInteresSelector modoInteres={ficha.modoInteres} onChange={v => { set('modoInteres', v); setModoInteresTocado(true); if (v !== 'manual') set('cuotaManual', '') }}
            monto={ficha.monto} tasa={ficha.tasa} frecuencia={ficha.frecuencia} diasPlazo={diasPlazo} />

          {ficha.modoInteres === 'manual' && (
            <div>
              <MoneyInput
                label="Cuota exacta por periodo"
                value={ficha.cuotaManual}
                onChange={e => set('cuotaManual', e.target.value)}
                placeholder="Ej: 60.000"
              />
              <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>Tu defines la cuota. Total = cuota x número de cobros.</p>
            </div>
          )}

          {/* Fecha inicio */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
              style={{ color: 'var(--color-text-muted)' }}>Fecha de inicio del préstamo</label>
            <input type="date" value={ficha.fechaInicio} onChange={e => set('fechaInicio', e.target.value)}
              max={hoyISO()} className="w-full h-10 rounded-[10px] border px-3 text-sm"
              style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
          </div>

          {/* Días sin cobro */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
              style={{ color: 'var(--color-text-muted)' }}>Dias sin cobro</label>
            <p className="text-[10px] mb-2" style={{ color: 'var(--color-text-muted)' }}>Dias de la semana en que NO se cobra a este cliente.</p>
            <DiasSinCobroSelector value={ficha.diasSinCobro} onChange={arr => set('diasSinCobro', arr)} compact />
          </div>

          {/* Préstamo en curso */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={ficha.esEnCurso} onChange={e => set('esEnCurso', e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--color-accent)]" />
            <div>
              <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Este préstamo ya tiene abonos</span>
              <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>Activalo si el cliente ya venia pagando y estás migrando un préstamo en curso</p>
            </div>
          </label>

          {ficha.esEnCurso && (
            <div>
              <MoneyInput
                label="Cuanto ha pagado hasta ahora?"
                value={ficha.yaAbonado}
                onChange={e => set('yaAbonado', e.target.value)}
                placeholder="Monto total ya abonado"
              />
            </div>
          )}

          {/* Ruta */}
          {rutas.length > 0 && !defaultRutaId && (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1 block"
                style={{ color: 'var(--color-text-muted)' }}>Ruta de cobro</label>
              <select value={ficha.rutaId} onChange={e => set('rutaId', e.target.value)}
                className="w-full h-10 rounded-[10px] border px-3 text-sm"
                style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                <option value="">Sin ruta</option>
                {rutas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── RESUMEN DEL PRESTAMO (solo después de elegir modo de interés) ── */}
      {calculo && modoInteresTocado && (
        <div className="rounded-[12px] overflow-hidden"
          style={{ border: '1.5px solid color-mix(in srgb, var(--color-success) 35%, var(--color-border))' }}>
          <div className="px-3.5 py-2 flex items-center justify-between" style={{ background: 'color-mix(in srgb, var(--color-success) 10%, var(--color-bg-base))' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-success)' }}>
              Resumen del prestamo
            </p>
            <span className="text-[9px]" style={{ color: 'var(--color-text-muted)' }}>Toca para editar</span>
          </div>
          <div className="px-3.5 py-2 space-y-0" style={{ background: 'var(--color-bg-base)' }}>
            {/* Editable: Monto */}
            <EditableResumenRow label="Monto" value={formatMoney(Number(ficha.monto))}>
              <MoneyInput
                value={ficha.monto}
                onChange={e => set('monto', e.target.value)}
                className="!h-8"
              />
            </EditableResumenRow>

            {/* Editable: Tasa */}
            <EditableResumenRow label="Interés" value={`${ficha.tasa}% mensual`}>
              <div className="flex items-center gap-1.5">
                <input type="number" inputMode="decimal" value={ficha.tasa} onChange={e => set('tasa', e.target.value)}
                  className="w-20 h-8 rounded-lg border px-2 text-sm text-right"
                  style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} autoFocus />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>% mensual</span>
              </div>
            </EditableResumenRow>

            {/* Editable: Frecuencia */}
            <EditableResumenRow label="Frecuencia" value={FRECUENCIAS.find(f => f.key === ficha.frecuencia)?.label || ficha.frecuencia}>
              <select value={ficha.frecuencia} onChange={e => handleFrecuenciaChange(e.target.value)}
                className="w-full h-8 rounded-lg border px-2 text-sm"
                style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} autoFocus>
                {FRECUENCIAS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </EditableResumenRow>

            {/* Editable: Plazo */}
            <EditableResumenRow label="Plazo" value={`${ficha.plazoUnidades} ${unidadPlazo}`}>
              <div className="flex items-center gap-1.5">
                <input type="number" inputMode="numeric" value={ficha.plazoUnidades} onChange={e => set('plazoUnidades', e.target.value)}
                  className="w-20 h-8 rounded-lg border px-2 text-sm text-right"
                  style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} autoFocus />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{unidadPlazo}</span>
              </div>
            </EditableResumenRow>

            {/* Editable: Modo interés */}
            <EditableResumenRow label="Modo" value={{ fijo: 'Clásico', unico: 'De una vez', saldo: 'Sobre saldo', manual: 'Manual', lineal: 'Decreciente', lineal_dinamico: 'Decr. dinámico' }[ficha.modoInteres] || 'Clásico'}>
              <select value={ficha.modoInteres} onChange={e => { set('modoInteres', e.target.value); setModoInteresTocado(true); if (e.target.value !== 'manual') set('cuotaManual', '') }}
                className="w-full h-8 rounded-lg border px-2 text-sm"
                style={{ background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} autoFocus>
                <option value="fijo">Clásico</option>
                <option value="unico">De una vez</option>
                <option value="saldo">Sobre saldo</option>
                <option value="manual">Manual</option>
                <option value="lineal">Decreciente</option>
                <option value="lineal_dinamico">Decr. dinámico</option>
              </select>
            </EditableResumenRow>

            {/* Editable: Cuota manual (si aplica) */}
            {ficha.modoInteres === 'manual' && (
              <EditableResumenRow label="Cuota exacta" value={formatMoney(Number(ficha.cuotaManual || 0))}>
                <MoneyInput
                  value={ficha.cuotaManual}
                  onChange={e => set('cuotaManual', e.target.value)}
                  className="!h-8"
                />
              </EditableResumenRow>
            )}

            {/* Calculados — read only */}
            <div className="pt-2 mt-1 space-y-1.5" style={{ borderTop: '2px solid color-mix(in srgb, var(--color-success) 25%, var(--color-border))' }}>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Cuota {freqLabel}</span>
                <span className="text-base font-bold" style={{ color: 'var(--color-success)' }}>{formatMoney(calculo.cuotaDiaria)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total a pagar</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatMoney(calculo.totalAPagar)}</span>
              </div>
              {calculo.totalInteres > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ganancia</span>
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{formatMoney(calculo.totalInteres)}</span>
                </div>
              )}
              {calculo.numeroCuotas && (
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Número de cuotas</span>
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{calculo.numeroCuotas}</span>
                </div>
              )}
            </div>

            {ficha.esEnCurso && Number(ficha.yaAbonado) > 0 && saldoPendiente !== null && (
              <div className="flex justify-between items-center pt-1.5" style={{ borderTop: '1px dashed var(--color-border)' }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Saldo pendiente</span>
                <span className="text-sm font-bold" style={{ color: 'var(--color-accent)' }}>{formatMoney(saldoPendiente)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-[10px] text-sm"
          style={{ background: 'var(--color-danger-dim)', color: 'var(--color-danger)', border: '1px solid color-mix(in srgb, var(--color-danger) 30%, transparent)' }}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {error}
        </div>
      )}

      {/* Boton guardar */}
      <button type="button" onClick={onGuardar} disabled={saving}
        className="w-full h-12 rounded-[12px] text-sm font-bold transition-all disabled:opacity-50"
        style={{ background: 'var(--color-accent)', color: '#000' }}>
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {editando ? 'Actualizando...' : 'Guardando...'}
          </span>
        ) : editando ? 'Guardar cambios' : 'Guardar y agregar siguiente'}
      </button>
    </div>
  )
}

// ─── Vista: card de cliente en la lista ───────────────────────────
function ClienteCard({ item, indice, onEditar, onEliminar, eliminando }) {
  const freqLabel = FRECUENCIAS.find(f => f.key === item.frecuencia)?.label || item.frecuencia
  return (
    <div className="rounded-[12px] border overflow-hidden transition-all"
      style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
          style={{ background: 'var(--color-success-dim)', color: 'var(--color-success)' }}>
          {indice}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--color-text-primary)' }}>{item.nombre}</p>
          <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            {formatMoney(item.monto)} · {freqLabel} · Cuota {formatMoney(item.cuota)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-bold" style={{ color: 'var(--color-accent)' }}>{formatMoney(item.totalAPagar)}</p>
          <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>total</p>
        </div>
      </div>
      <div className="flex border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button type="button" onClick={onEditar}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
          </svg>
          Editar
        </button>
        <div style={{ width: 1, background: 'var(--color-border)' }} />
        <button type="button" onClick={onEliminar} disabled={eliminando}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors disabled:opacity-50"
          style={{ color: 'var(--color-danger)' }}>
          {eliminando ? (
            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          )}
          Eliminar
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export default function MigradorPage() {
  const router = useRouter()
  const { esOwner, loading: authLoading } = useAuth()
  const nombreRef = useRef(null)
  const fotoRef = useRef(null)

  const [rutas, setRutas] = useState([])

  const defaults = { tasa: '20', frecuencia: 'diario', modoInteres: 'fijo', rutaId: '' }

  // vista: 'lista' | 'selector' | 'formulario'
  const [vista, setVista] = useState('selector')
  const [ficha, setFicha] = useState(() => fichaVacia(defaults))
  const [creados, setCreados] = useState([])
  const [editandoIdx, setEditandoIdx] = useState(null)
  const [saving, setSaving] = useState(false)
  const [eliminandoIdx, setEliminandoIdx] = useState(null)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState('')
  const [sinCedula, setSinCedula] = useState(false)

  useEffect(() => {
    if (!authLoading && !esOwner) router.replace('/dashboard')
  }, [authLoading, esOwner, router])

  useEffect(() => {
    fetch('/api/rutas').then(r => r.json()).then(list => setRutas(Array.isArray(list) ? list : [])).catch(() => {})
  }, [])

  const diasPlazo = useMemo(() => calcularDiasPlazo(ficha.plazoUnidades, ficha.frecuencia), [ficha.plazoUnidades, ficha.frecuencia])
  const calculo = useMemo(() => calcularFicha(ficha), [ficha.monto, ficha.tasa, diasPlazo, ficha.fechaInicio, ficha.frecuencia, ficha.modoInteres, ficha.cuotaManual])

  const set = useCallback((campo, valor) => {
    setFicha(prev => ({ ...prev, [campo]: valor }))
    if (error) setError('')
  }, [error])

  const irA = useCallback((v) => {
    setVista(v)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  // ── OCR ──
  const handleFoto = async (e) => {
    const archivos = Array.from(e.target.files ?? [])
    if (!archivos.length) return
    if (fotoRef.current) fotoRef.current.value = ''
    setOcrLoading(true)
    setOcrError('')
    setError('')

    const fd = new FormData()
    archivos.forEach(f => fd.append('fotos', f))

    try {
      const res = await fetch('/api/herramientas/leer-cartulina', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setOcrError(json.error ?? 'No pudimos leer la foto'); setOcrLoading(false); return }

      const d = json.datos || {}
      const nueva = { ...fichaVacia(defaults) }
      if (d.nombre) nueva.nombre = d.nombre
      if (d['cédula'] || d.cedula) nueva.cedula = d['cédula'] || d.cedula
      if (d['teléfono'] || d.telefono) nueva.telefono = d['teléfono'] || d.telefono
      if (d['dirección'] || d.direccion) nueva.direccion = d['dirección'] || d.direccion
      if (d.montoPrestado) nueva.monto = String(d.montoPrestado)
      if (d.tasaInteres) nueva.tasa = String(d.tasaInteres)
      if (d.frecuencia && DIAS_POR_PERIODO[d.frecuencia]) {
        nueva.frecuencia = d.frecuencia
        nueva.plazoUnidades = PLAZO_DEFAULT[d.frecuencia]
      }
      if (d.diasPlazo) {
        const porPeriodo = DIAS_POR_PERIODO[nueva.frecuencia] || 1
        nueva.plazoUnidades = String(Math.round(Number(d.diasPlazo) / porPeriodo))
      }
      if (d.fechaInicio) nueva.fechaInicio = d.fechaInicio
      if (d.montoPagadoHasta || d.cuotasPagadas) {
        nueva.esEnCurso = true
        if (d.montoPagadoHasta) nueva.yaAbonado = String(d.montoPagadoHasta)
      }

      setFicha(nueva)
      irA('formulario')
    } catch {
      setOcrError('Error de conexión al leer la foto')
    } finally {
      setOcrLoading(false)
    }
  }

  // ── Guardar (crear o editar) ──
  const guardar = async () => {
    if (!ficha.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!sinCedula && !ficha.cedula.trim()) { setError('La cédula es obligatoria'); return }
    if (!ficha.telefono.trim()) { setError('El teléfono es obligatorio'); return }
    if (!ficha.monto || Number(ficha.monto) <= 0) { setError('El monto es obligatorio'); return }
    if (!calculo) { setError('Revisa los datos del préstamo'); return }

    setSaving(true)
    setError('')

    try {
      const esEdicion = editandoIdx !== null
      const item = esEdicion ? creados[editandoIdx] : null

      const cedulaFinal = sinCedula
        ? `SIN-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
        : ficha.cedula.trim()

      if (esEdicion && item) {
        const clienteRes = await fetch(`/api/clientes/${item.clienteId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre: ficha.nombre.trim(),
            cedula: cedulaFinal,
            telefono: ficha.telefono.trim(),
            ...(ficha.direccion.trim() ? { direccion: ficha.direccion.trim() } : {}),
            diasSinCobro: ficha.diasSinCobro,
          }),
        })
        if (!clienteRes.ok) {
          const d = await clienteRes.json()
          setError(d.error || 'Error al actualizar el cliente')
          setSaving(false)
          return
        }

        const prestamoRes = await fetch(`/api/prestamos/${item.prestamoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modo: 'editar',
            montoPrestado: Number(ficha.monto),
            tasaInteres: Number(ficha.tasa),
            diasPlazo: Number(diasPlazo),
            fechaInicio: ficha.fechaInicio,
            frecuencia: ficha.frecuencia,
            modoInteres: ficha.modoInteres,
            ...(ficha.modoInteres === 'manual' && calculo?.cuotaDiaria > 0 && { cuotaManual: calculo.cuotaDiaria }),
          }),
        })
        if (!prestamoRes.ok) {
          const d = await prestamoRes.json()
          setError(d.error || 'Cliente actualizado pero error en el prestamo')
          setSaving(false)
          return
        }

        setCreados(prev => prev.map((c, i) => i === editandoIdx ? {
          ...c,
          nombre: ficha.nombre.trim(),
          cedula: cedulaFinal,
          telefono: ficha.telefono.trim(),
          direccion: ficha.direccion.trim(),
          monto: Number(ficha.monto),
          tasa: Number(ficha.tasa),
          frecuencia: ficha.frecuencia,
          plazoUnidades: ficha.plazoUnidades,
          modoInteres: ficha.modoInteres,
          fechaInicio: ficha.fechaInicio,
          totalAPagar: calculo.totalAPagar,
          cuota: calculo.cuotaDiaria,
        } : c))

        setEditandoIdx(null)
        setSuccessMsg(`${ficha.nombre.trim()} actualizado`)
      } else {
        const clientePayload = {
          nombre: ficha.nombre.trim(),
          cedula: cedulaFinal,
          telefono: ficha.telefono.trim(),
          ...(ficha.direccion.trim() && { direccion: ficha.direccion.trim() }),
          ...(ficha.rutaId && { rutaId: ficha.rutaId }),
          ...(ficha.diasSinCobro.length > 0 && { diasSinCobro: ficha.diasSinCobro }),
        }
        const resCliente = await fetch('/api/clientes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(clientePayload),
        })
        const dataCliente = await resCliente.json()
        if (!resCliente.ok) { setError(dataCliente.error || 'Error al crear el cliente'); setSaving(false); return }
        invalidarCachePorPrefijo('clientes:').catch(() => {})

        const prestamoPayload = {
          clienteId: dataCliente.id,
          montoPrestado: Number(ficha.monto),
          tasaInteres: Number(ficha.tasa),
          diasPlazo: Number(diasPlazo),
          fechaInicio: ficha.fechaInicio,
          frecuencia: ficha.frecuencia,
          modoInteres: ficha.modoInteres,
          ...(ficha.modoInteres === 'manual' && calculo?.cuotaDiaria > 0 && { cuotaManual: calculo.cuotaDiaria }),
          ...(ficha.esEnCurso && Number(ficha.yaAbonado) > 0 && { yaAbonado: Number(ficha.yaAbonado) }),
        }
        const resPrestamo = await fetch('/api/prestamos', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prestamoPayload),
        })
        const dataPrestamo = await resPrestamo.json()
        if (!resPrestamo.ok) { setError(dataPrestamo.error || 'Cliente creado pero error en el prestamo'); setSaving(false); return }

        setCreados(prev => [...prev, {
          nombre: ficha.nombre.trim(),
          cedula: cedulaFinal,
          telefono: ficha.telefono.trim(),
          direccion: ficha.direccion.trim(),
          monto: Number(ficha.monto),
          tasa: Number(ficha.tasa),
          frecuencia: ficha.frecuencia,
          plazoUnidades: ficha.plazoUnidades,
          modoInteres: ficha.modoInteres,
          fechaInicio: ficha.fechaInicio,
          diasSinCobro: ficha.diasSinCobro,
          totalAPagar: calculo.totalAPagar,
          cuota: calculo.cuotaDiaria,
          clienteId: dataCliente.id,
          prestamoId: dataPrestamo.id,
        }])

        setSuccessMsg(`${ficha.nombre.trim()} guardado`)
      }

      setFicha(fichaVacia(defaults))
      setSinCedula(false)
      irA('selector')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  // ── Eliminar ──
  const eliminar = async (idx) => {
    const item = creados[idx]
    if (!item) return
    setEliminandoIdx(idx)
    try {
      await fetch(`/api/prestamos/${item.prestamoId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'cancelado' }),
      })
      await fetch(`/api/clientes/${item.clienteId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'inactivar' }),
      })
      setCreados(prev => prev.filter((_, i) => i !== idx))
      setSuccessMsg(`${item.nombre} eliminado`)
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch {
      setError('Error al eliminar')
    } finally {
      setEliminandoIdx(null)
    }
  }

  // ── Abrir edición ──
  const abrirEdicion = (idx) => {
    const item = creados[idx]
    const esSinCed = item.cedula?.startsWith('SIN-')
    setSinCedula(!!esSinCed)
    setFicha({
      nombre: item.nombre, cedula: esSinCed ? '' : (item.cedula || ''), telefono: item.telefono || '',
      direccion: item.direccion || '', monto: String(item.monto), tasa: String(item.tasa),
      frecuencia: item.frecuencia, plazoUnidades: item.plazoUnidades || PLAZO_DEFAULT[item.frecuencia],
      modoInteres: item.modoInteres || defaults.modoInteres, fechaInicio: item.fechaInicio || hoyISO(),
      esEnCurso: false, yaAbonado: '', cuotaManual: item.cuotaManual ? String(item.cuotaManual) : '',
      diasSinCobro: item.diasSinCobro || [],
      rutaId: item.rutaId || defaults.rutaId,
    })
    setEditandoIdx(idx)
    irA('formulario')
    setError('')
  }

  if (authLoading || !esOwner) return null

  const totalCapital = creados.reduce((s, c) => s + c.monto, 0)
  const totalAPagarGlobal = creados.reduce((s, c) => s + c.totalAPagar, 0)
  const proximoNumero = creados.length + 1

  // ── Header dinámico ──
  const headerTitulo = {
    lista: 'Tu cartera',
    selector: creados.length > 0 ? 'Agregar cliente' : 'Migrador de cartera',
    formulario: editandoIdx !== null ? `Editar: ${creados[editandoIdx]?.nombre || 'cliente'}` : `Cliente #${proximoNumero}`,
  }[vista]

  const headerSub = {
    lista: `${creados.length} cliente${creados.length !== 1 ? 's' : ''} agregado${creados.length !== 1 ? 's' : ''}`,
    selector: creados.length > 0 ? 'Como quieres registrar este cliente?' : 'Agrega tus clientes con foto o manual, uno a uno',
    formulario: editandoIdx !== null ? 'Modifica lo que necesites y guarda' : 'Completa los datos y su prestamo',
  }[vista]

  const volverLabel = {
    lista: 'Salir del migrador',
    selector: creados.length > 0 ? 'Ver mis clientes' : 'Salir',
    formulario: 'Volver',
  }[vista]

  const handleVolver = () => {
    if (vista === 'lista') { router.back(); return }
    if (vista === 'selector') {
      if (creados.length > 0) { irA('lista') } else { router.back() }
      return
    }
    if (vista === 'formulario') {
      setEditandoIdx(null)
      setError('')
      irA('selector')
    }
  }

  return (
    <div className="max-w-lg mx-auto pb-32">
      {/* Header */}
      <div className="mb-5">
        <button onClick={handleVolver}
          className="flex items-center gap-1.5 text-sm mb-3 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {volverLabel}
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{headerTitulo}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{headerSub}</p>
          </div>
          {creados.length > 0 && vista !== 'lista' && (
            <button type="button" onClick={() => irA('lista')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors"
              style={{ background: 'var(--color-success-dim)', color: 'var(--color-success)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              {creados.length}
            </button>
          )}
        </div>
      </div>

      {/* Link a carga masiva Excel */}
      {vista === 'selector' && (
        <Link href="/carga-masiva"
          className="flex items-center gap-2 px-3 py-2 rounded-[10px] mb-4 text-[12px] transition-colors"
          style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)', color: 'var(--color-text-muted)' }}>
          <svg className="w-3.5 h-3.5 shrink-0" style={{ color: '#22c55e' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>Tienes un archivo Excel? <span className="font-semibold" style={{ color: '#22c55e' }}>Importalo aqui</span></span>
        </Link>
      )}

      {/* Success msg (global) */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-[12px] mb-4 text-sm font-medium"
          style={{ background: 'var(--color-success-dim)', color: 'var(--color-success)', border: '1px solid var(--color-success-border)' }}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {successMsg}
        </div>
      )}

      {/* ════════ VISTA: LISTA ════════ */}
      {vista === 'lista' && (
        <>
          {/* Resumen global */}
          <div className="rounded-[12px] border p-4 mb-4"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 6%, var(--color-bg-card)), var(--color-bg-card))', borderColor: 'color-mix(in srgb, var(--color-accent) 25%, var(--color-border))' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-accent)' }}>
                Resumen de cartera
              </span>
              <span className="text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                {creados.length} cliente{creados.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Capital prestado</p>
                <p className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>{formatMoney(totalCapital)}</p>
              </div>
              <div>
                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Total a cobrar</p>
                <p className="text-base font-bold" style={{ color: 'var(--color-accent)' }}>{formatMoney(totalAPagarGlobal)}</p>
              </div>
            </div>
          </div>

          {/* Lista de creados */}
          <div className="space-y-2 mb-5">
            {creados.map((c, i) => (
              <ClienteCard key={c.clienteId} item={c} indice={i + 1}
                onEditar={() => abrirEdicion(i)}
                onEliminar={() => eliminar(i)}
                eliminando={eliminandoIdx === i} />
            ))}
          </div>

          {/* Boton agregar otro */}
          <button type="button" onClick={() => { setFicha(fichaVacia(defaults)); setSinCedula(false); setEditandoIdx(null); setError(''); setOcrError(''); irA('selector') }}
            className="w-full h-14 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{ background: 'var(--color-accent)', color: '#000' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Agregar otro cliente
          </button>

          <button type="button" onClick={() => router.push('/prestamos')}
            className="w-full h-12 rounded-2xl text-sm font-semibold mt-3 border transition-all"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', background: 'var(--color-bg-surface)' }}>
            Termine, ir a prestamos
          </button>
        </>
      )}

      {/* ════════ VISTA: SELECTOR ════════ */}
      {vista === 'selector' && (
        <>
          {/* Mini-lista de clientes ya creados (contexto visual) */}
          {creados.length > 0 && (
            <div className="mb-5">
              <button type="button" onClick={() => irA('lista')}
                className="w-full text-left rounded-[12px] border px-4 py-3 transition-colors"
                style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                      style={{ color: 'var(--color-success)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {creados.length} cliente{creados.length !== 1 ? 's' : ''} agregado{creados.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium" style={{ color: 'var(--color-accent)' }}>Ver lista</span>
                </div>
                <div className="mt-1.5 flex gap-1 flex-wrap">
                  {creados.slice(-5).map((c, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-muted)' }}>
                      {c.nombre.split(' ')[0]}
                    </span>
                  ))}
                  {creados.length > 5 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-muted)' }}>
                      +{creados.length - 5} mas
                    </span>
                  )}
                </div>
              </button>
            </div>
          )}

          <SelectorMetodo
            onFoto={() => fotoRef.current?.click()}
            onManual={() => { setFicha(fichaVacia(defaults)); irA('formulario') }}
            ocrLoading={ocrLoading}
            ocrError={ocrError}
            fotoInputRef={fotoRef}
            onFotoChange={handleFoto}
            numero={proximoNumero}
          />
        </>
      )}

      {/* ════════ VISTA: FORMULARIO ════════ */}
      {vista === 'formulario' && (
        <div className="rounded-[12px] border overflow-hidden p-4"
          style={{ background: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }}>
          <FormularioFicha
            ficha={ficha} set={set} calculo={calculo} diasPlazo={diasPlazo}
            rutas={rutas} defaultRutaId={defaults.rutaId} nombreRef={nombreRef}
            error={error} onGuardar={guardar} saving={saving}
            editando={editandoIdx !== null} numero={proximoNumero}
            sinCedula={sinCedula} setSinCedula={setSinCedula}
          />
        </div>
      )}
    </div>
  )
}
