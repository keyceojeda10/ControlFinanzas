'use client'
// app/(dashboard)/calculadora/page.jsx
// Calculadora / simulador de préstamos. Usa la MISMA lógica de cálculo del
// sistema (calcularPrestamo) para que el número coincida con el préstamo real
// cuando el usuario lo cree. No crea cliente, no toca BD, no guarda nada.
// Pensada para mostrarle/compartirle la cotización al cliente final.

import { useState, useMemo } from 'react'
import MoneyInput from '@/components/ui/MoneyInput'
import ModoInteresSelector from '@/components/prestamos/ModoInteresSelector'
import TablaAmortizacion from '@/components/prestamos/TablaAmortizacion'
import { calcularPrestamo } from '@/lib/calculos'
import { formatMoney } from '@/lib/i18n'

const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

const FRECUENCIAS = [
  { value: 'diario',    label: 'Diario',    unidad: 'días',      cuotaLabel: 'Cuota diaria' },
  { value: 'semanal',   label: 'Semanal',   unidad: 'semanas',   cuotaLabel: 'Cuota semanal' },
  { value: 'quincenal', label: 'Quincenal', unidad: 'quincenas', cuotaLabel: 'Cuota quincenal' },
  { value: 'mensual',   label: 'Mensual',   unidad: 'meses',     cuotaLabel: 'Cuota mensual' },
]

const PLAZO_DEFAULT = { diario: '30', semanal: '8', quincenal: '4', mensual: '3' }

const fmtFecha = (d) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

export default function CalculadoraPage() {
  const [monto, setMonto] = useState('')
  const [tasa, setTasa] = useState('20')
  const [frecuencia, setFrecuencia] = useState('diario')
  const [plazoUnidades, setPlazoUnidades] = useState('30')
  const [modoInteres, setModoInteres] = useState('fijo')
  const [cuotaManual, setCuotaManual] = useState('')
  const [copiado, setCopiado] = useState(false)

  const freqInfo = FRECUENCIAS.find((f) => f.value === frecuencia) || FRECUENCIAS[0]
  const cuotaManualActiva = modoInteres === 'manual'
  const diasPlazo = (Number(plazoUnidades) || 0) * (DIAS_POR_PERIODO[frecuencia] || 1)

  const cambiarFrecuencia = (nueva) => {
    setFrecuencia(nueva)
    setPlazoUnidades(PLAZO_DEFAULT[nueva] || '30')
  }

  const calculo = useMemo(() => {
    const m = Number(monto)
    const t = Number(tasa)
    if (!m || tasa === '' || tasa == null || !diasPlazo) return null
    const cm = cuotaManualActiva ? Number(cuotaManual) : 0
    try {
      return calcularPrestamo({
        montoPrestado: m,
        tasaInteres: t,
        diasPlazo,
        fechaInicio: new Date(),
        frecuencia,
        modoInteres,
        ...(cm > 0 && { cuotaManual: cm }),
      })
    } catch {
      return null
    }
  }, [monto, tasa, diasPlazo, frecuencia, modoInteres, cuotaManualActiva, cuotaManual])

  const numCuotas = calculo?.numPeriodos || 0
  const cuotaDistinta =
    calculo?.ultimaCuota && calculo?.cuotaDiaria && calculo.ultimaCuota !== calculo.cuotaDiaria && numCuotas > 1

  // Texto plano para WhatsApp.
  const textoCompartir = useMemo(() => {
    if (!calculo) return ''
    const L = []
    L.push('*Simulación de crédito*')
    L.push('')
    L.push(`Monto del crédito: ${formatMoney(Number(monto))}`)
    if (modoInteres === 'lineal' && cuotaDistinta) {
      L.push(`${freqInfo.cuotaLabel}: de ${formatMoney(calculo.cuotaDiaria)} a ${formatMoney(calculo.ultimaCuota)}`)
    } else {
      L.push(`${freqInfo.cuotaLabel}: ${formatMoney(calculo.cuotaDiaria)}`)
    }
    L.push(`Número de cuotas: ${numCuotas}`)
    L.push(`Total a pagar: ${formatMoney(calculo.totalAPagar)}`)
    L.push(`Interés: ${formatMoney(calculo.totalInteres)}`)
    L.push(`Termina el: ${fmtFecha(calculo.fechaFin)}`)
    return L.join('\n')
  }, [calculo, monto, modoInteres, cuotaDistinta, freqInfo, numCuotas])

  const copiar = async () => {
    if (!textoCompartir) return
    try {
      await navigator.clipboard.writeText(textoCompartir)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {}
  }

  const compartir = async () => {
    if (!textoCompartir) return
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Simulación de crédito', text: textoCompartir })
        return
      } catch {
        // usuario canceló o no soportado: caer a copiar
      }
    }
    copiar()
  }

  return (
    <div className="max-w-2xl mx-auto pb-28">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-xl font-bold text-[white]">Calculadora de préstamos</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Simula una cuota para mostrarle a tu cliente. No registra nada.
        </p>
      </header>

      <div className="space-y-4">
        {/* ── Datos del crédito ── */}
        <section
          className="rounded-[16px] p-4 sm:p-5"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 5%, var(--color-bg-card)) 0%, var(--color-bg-card) 100%)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MoneyInput
              label="Monto a prestar"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Ej: 500.000"
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[var(--color-text-secondary)]">Interés (%)</label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  inputMode="decimal"
                  value={tasa}
                  onChange={(e) => setTasa(e.target.value)}
                  placeholder="20"
                  className="w-full h-10 rounded-[12px] border text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[rgba(245,197,24,0.2)] transition-all pl-3 pr-8"
                />
                <span className="absolute right-3 text-[var(--color-text-muted)] text-sm pointer-events-none select-none">%</span>
              </div>
            </div>
          </div>

          {/* Frecuencia */}
          <div className="mt-4">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Frecuencia de cobro
            </label>
            <div className="grid grid-cols-4 gap-2 mt-1.5">
              {FRECUENCIAS.map((f) => {
                const activo = frecuencia === f.value
                return (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => cambiarFrecuencia(f.value)}
                    className="h-10 rounded-[10px] border text-xs font-semibold transition-all"
                    style={
                      activo
                        ? { background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }
                        : { background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }
                    }
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Plazo */}
          <div className="mt-4">
            <label className="text-xs font-medium text-[var(--color-text-secondary)]">
              Plazo ({freqInfo.unidad})
            </label>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="number"
                inputMode="numeric"
                value={plazoUnidades}
                onChange={(e) => setPlazoUnidades(e.target.value)}
                placeholder="Ej: 30"
                className="w-full h-10 rounded-[12px] border text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[rgba(245,197,24,0.2)] transition-all px-3"
              />
              <span className="shrink-0 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                = {diasPlazo} días
              </span>
            </div>
          </div>

          {/* Modo de interés */}
          <div className="mt-4">
            <ModoInteresSelector
              modoInteres={modoInteres}
              onChange={setModoInteres}
              monto={monto}
              tasa={tasa}
              frecuencia={frecuencia}
              diasPlazo={diasPlazo}
            />
          </div>

          {/* Cuota manual (solo modo manual) */}
          {cuotaManualActiva && (
            <div className="mt-4">
              <MoneyInput
                label="Cuota exacta que quieres cobrar"
                value={cuotaManual}
                onChange={(e) => setCuotaManual(e.target.value)}
                placeholder="Ej: 20.000"
              />
            </div>
          )}
        </section>

        {/* ── Resultado tipo recibo ── */}
        {calculo ? (
          <section
            className="rounded-[18px] overflow-hidden"
            style={{ border: '1px solid color-mix(in srgb, var(--color-accent) 30%, var(--color-border))' }}
          >
            {/* Encabezado del recibo */}
            <div
              className="px-5 py-4 flex items-center justify-between gap-3"
              style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, var(--color-bg-card))' }}
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Simulación de crédito
                </p>
                <p className="text-2xl font-bold font-mono-display text-[var(--color-accent)] leading-tight mt-0.5">
                  {formatMoney(Number(monto))}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">monto del crédito</p>
              </div>
              <div
                className="shrink-0 w-12 h-12 rounded-[12px] flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--color-accent) 18%, transparent)', color: 'var(--color-accent)' }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-6 4h4M5 3h14a1 1 0 011 1v17l-3-2-2 2-2-2-2 2-2-2-3 2V4a1 1 0 011-1z" />
                </svg>
              </div>
            </div>

            {/* Cuerpo: la cuota es el dato estrella */}
            <div className="px-5 py-5 bg-[var(--color-bg-card)]">
              <div className="text-center py-2">
                <p className="text-xs text-[var(--color-text-muted)]">{freqInfo.cuotaLabel}</p>
                <p className="text-4xl font-extrabold font-mono-display text-[white] leading-none mt-1">
                  {formatMoney(calculo.cuotaDiaria)}
                </p>
                <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                  {cuotaDistinta ? (
                    <>baja hasta {formatMoney(calculo.ultimaCuota)} · {numCuotas} cuotas</>
                  ) : (
                    <>× {numCuotas} {numCuotas === 1 ? 'cuota' : 'cuotas'}</>
                  )}
                </p>
              </div>

              {/* Desglose */}
              <dl className="mt-5 divide-y divide-[var(--color-border)]">
                <Row k="Total a pagar" v={formatMoney(calculo.totalAPagar)} strong />
                <Row k="Interés" v={formatMoney(calculo.totalInteres)} accent="var(--color-warning)" />
                <Row k="Número de cuotas" v={`${numCuotas}`} />
                <Row k="Termina el" v={fmtFecha(calculo.fechaFin)} />
              </dl>

              {modoInteres === 'lineal' && calculo.tablaAmortizacion?.length > 0 && (
                <div className="mt-4">
                  <TablaAmortizacion tabla={calculo.tablaAmortizacion} frecuencia={frecuencia} />
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="px-5 py-4 bg-[var(--color-bg-card)] border-t border-[var(--color-border)] grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={copiar}
                className="h-11 rounded-[12px] border text-sm font-semibold transition-all flex items-center justify-center gap-2"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: copiado ? 'var(--color-success)' : 'var(--color-text-primary)' }}
              >
                {copiado ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Copiado
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Copiar
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={compartir}
                className="h-11 rounded-[12px] text-sm font-semibold transition-all flex items-center justify-center gap-2"
                style={{ background: 'var(--color-accent)', color: '#1a1a1a' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                Compartir
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-[18px] border border-dashed border-[var(--color-border)] px-5 py-12 text-center bg-[var(--color-bg-card)]">
            <div className="w-12 h-12 rounded-[14px] mx-auto flex items-center justify-center mb-3" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)', color: 'var(--color-accent)' }}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m-6 4h6m-2 5h2M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" /></svg>
            </div>
            <p className="text-sm font-medium text-[white]">Escribe el monto para ver la simulación</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">El cálculo aparece al instante.</p>
          </section>
        )}
      </div>
    </div>
  )
}

function Row({ k, v, strong, accent }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-sm text-[var(--color-text-secondary)]">{k}</dt>
      <dd
        className={`font-mono-display ${strong ? 'text-lg font-bold' : 'text-sm font-semibold'}`}
        style={{ color: accent || (strong ? 'var(--color-accent)' : 'var(--color-text-primary)') }}
      >
        {v}
      </dd>
    </div>
  )
}
