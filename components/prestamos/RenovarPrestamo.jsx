'use client'
import { useState, useMemo } from 'react'
import { Renovar } from '@/components/pantallas/Renovar'
import { useRouter } from 'next/navigation'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { calcularPrestamo } from '@/lib/calculos'
import { soloDecimal } from '@/lib/i18n'
import { useCountry } from '@/hooks/useCountry'

const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoyISO = () => getColombiaDate().toISOString().slice(0, 10)

const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }
const LABEL_PLAZO      = { diario: 'Plazo (días)', semanal: 'Plazo (semanas)', quincenal: 'Plazo (quincenas)', mensual: 'Plazo (meses)' }
const DEFAULT_PLAZO    = { diario: '30', semanal: '8', quincenal: '4', mensual: '2' }

function diasAUnidades(dias, frecuencia) {
  const d = DIAS_POR_PERIODO[frecuencia] || 1
  return String(Math.round((Number(dias) || 30) / d))
}

export default function RenovarPrestamo({
  prestamoId,
  saldoPendiente,
  capitalRestante,
  prestamoAnterior,
  clienteNombre,
  montoMaximoPrestamo,
  open,
  onClose,
}) {
  const router = useRouter()
  const { formatMoney } = useCountry()

  const saldoTotal = Math.max(0, Number(saldoPendiente) || 0)
  // Para globo/lineal, el minimo es el capital adeudado (sin intereses futuros)
  const saldo = capitalRestante != null ? Math.max(0, Number(capitalRestante)) : saldoTotal
  const freqInicial = prestamoAnterior?.frecuencia ?? 'diario'
  const cuotaAnterior = prestamoAnterior?.cuotaDiaria ?? 0
  const montoAnterior = prestamoAnterior?.montoPrestado ?? 0

  const [monto,       setMonto]       = useState('')
  const [tasa,        setTasa]        = useState(String(prestamoAnterior?.tasaInteres ?? '20'))
  const [plazoUnidades, setPlazoUnidades] = useState(
    prestamoAnterior?.diasPlazo
      ? diasAUnidades(prestamoAnterior.diasPlazo, freqInicial)
      : DEFAULT_PLAZO[freqInicial] ?? '30'
  )
  const [frecuencia,  setFrecuencia]  = useState(freqInicial)
  const [fechaInicio, setFechaInicio] = useState(hoyISO())
  const [seguro,      setSeguro]      = useState(false)
  const [montoSeguro, setMontoSeguro] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [masOpciones, setMasOpciones] = useState(false)
  const [cuotaManual, setCuotaManual] = useState('')
  const cuotaManualActiva = cuotaManual !== '' && Number(cuotaManual) > 0

  const montoNum = Number(monto) || 0
  const montoSeguroNum = seguro ? (Number(montoSeguro) || 0) : 0
  const enMano = Math.max(0, montoNum - saldo)
  const diasPlazo = (Number(plazoUnidades) || 0) * (DIAS_POR_PERIODO[frecuencia] || 1)

  const modoHeredado = ['fijo', 'unico', 'saldo', 'manual', 'solo_interes', 'lineal', 'lineal_dinamico'].includes(prestamoAnterior?.modoInteres)
    ? prestamoAnterior.modoInteres : 'fijo'
  const modoUsaTabla = ['solo_interes', 'lineal', 'lineal_dinamico'].includes(modoHeredado)

  const calculo = useMemo(() => {
    if (!montoNum || !tasa || !diasPlazo) return null
    try {
      const usarManual = cuotaManualActiva && !modoUsaTabla && modoHeredado !== 'saldo'
      return calcularPrestamo({
        montoPrestado: montoNum,
        tasaInteres:   Number(tasa),
        diasPlazo,
        fechaInicio,
        frecuencia,
        modoInteres:   usarManual ? 'manual' : modoHeredado,
        ...(usarManual && { cuotaManual: Number(cuotaManual) }),
        ...(modoHeredado === 'saldo' && cuotaManualActiva && { cuotaManual: Number(cuotaManual) }),
        ...(modoHeredado === 'solo_interes' && { interesAdelantado: !!prestamoAnterior?.interesAdelantado }),
      })
    } catch { return null }
  }, [montoNum, tasa, diasPlazo, fechaInicio, frecuencia, modoHeredado, modoUsaTabla, cuotaManual, cuotaManualActiva, prestamoAnterior?.interesAdelantado])

  const handleSubmit = async () => {
    if (montoNum <= 0) { setError('Ingresa el total del nuevo préstamo'); return }
    if (montoNum < saldo) {
      setError(`El total debe cubrir al menos el saldo actual (${formatMoney(saldo)})`)
      return
    }
    if (!tasa || Number(tasa) < 0) { setError('Tasa inválida'); return }
    if (!plazoUnidades || diasPlazo <= 0) { setError('Plazo inválido'); return }
    // EL TOPE DEL CLIENTE. Estaba solo como `disabled` en el boton viejo, y ese
    // boton ya no existe: `Renovar` pinta el suyo. Sin esto se podia renovar por
    // encima del tope con solo pulsar.
    if (montoMaximoPrestamo > 0 && montoNum > montoMaximoPrestamo) {
      setError(`Supera el tope de ${formatMoney(montoMaximoPrestamo)} para este cliente`)
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/prestamos/${prestamoId}/renovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          montoPrestado: montoNum,
          tasaInteres:   Number(tasa),
          diasPlazo,
          fechaInicio,
          frecuencia,
          modoInteres:   (cuotaManualActiva && !modoUsaTabla && modoHeredado !== 'saldo') ? 'manual' : modoHeredado,
          ...((cuotaManualActiva && !modoUsaTabla && modoHeredado !== 'saldo') && { cuotaManual: Number(cuotaManual) }),
          ...(modoHeredado === 'saldo' && cuotaManualActiva && { cuotaManual: Number(cuotaManual) }),
          ...(seguro && montoSeguroNum > 0 && { seguro: true, montoSeguro: montoSeguroNum }),
          ...(modoHeredado === 'solo_interes' && prestamoAnterior?.interesAdelantado && { interesAdelantado: true }),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al renovar')
      }
      const { id: nuevoId } = await res.json()
      handleClose()
      router.push(`/prestamos/${nuevoId}`)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setMonto('')
    setSeguro(false)
    setMontoSeguro('')
    setCuotaManual('')
    setError('')
    setMasOpciones(false)
    setPlazoUnidades(DEFAULT_PLAZO[frecuencia] ?? '30')
    onClose?.()
  }

  const cuotaCambio = calculo && cuotaAnterior
    ? calculo.cuotaDiaria - cuotaAnterior
    : null

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="space-y-4">

        {/* -- T05-02, MONTADA --
            Lo de arriba eran cuatro bloques sueltos: un aviso naranja, un
            resumen del prestamo actual, el campo del total y un desglose. Y el
            campo se explicaba con un EJEMPLO ESCRITO -«debe $1.000.000, le
            prestas $1.000.000 mas = total $2.000.000»- que es la señal de que
            la resta se estaba haciendo de cabeza, con el cliente delante y la
            plata en la mano.

            `Renovar` deja la cifra que de verdad importa calculada y en negro,
            y el boton la repite: «Renovar y entregar $369.500». Las condiciones
            del prestamo -tasa, plazo, frecuencia, seguro- siguen enteras, ahora
            dentro del componente. */}
        <Renovar
          titulo="Renovar el préstamo"
          ayuda={clienteNombre ? `Cierra el de ${clienteNombre} y abre uno nuevo` : 'Cierra el actual y abre uno nuevo'}
          saldoEtiqueta={modoUsaTabla ? 'Capital adeudado' : 'Saldo pendiente'}
          saldo={formatMoney(saldo)}
          saldoNota={`Se absorbe en el nuevo y el anterior queda como completado. Prestó ${formatMoney(montoAnterior)} · cuota ${formatMoney(cuotaAnterior)}.`}
          total={monto}
          onTotal={(v) => setMonto(soloDecimal(v))}
          simbolo="$"
          atajos={saldo > 0 ? [
            { etiqueta: 'Solo el saldo', valor: String(Math.round(saldo)) },
            { etiqueta: `+ ${formatMoney(500000)}`, valor: String(Math.round(saldo + 500000)) },
            { etiqueta: 'El doble', valor: String(Math.round(saldo * 2)) },
          ] : []}
          onAtajo={(v) => setMonto(v)}
          incluye={`El total INCLUYE lo que ya debe (${formatMoney(saldo)}). Escribe el total, no lo nuevo.`}
          antesDespues={calculo && cuotaAnterior > 0 ? {
            etiqueta: 'La cuota, antes y después',
            concepto: 'Cuota',
            antes: formatMoney(cuotaAnterior),
            despues: formatMoney(calculo.cuotaDiaria),
            tono: calculo.cuotaDiaria > cuotaAnterior ? 'empeora' : 'mejora',
          } : null}
          entregaEtiqueta="Le entregas en efectivo"
          entrega={montoNum > 0 ? formatMoney(enMano) : null}
          gananciaEtiqueta="Ganancia del nuevo"
          ganancia={calculo && calculo.totalAPagar > montoNum
            ? formatMoney(Math.round(calculo.totalAPagar - montoNum)) : null}
          onRenovar={handleSubmit}
          renovando={loading}
        >

        {/* El aviso de que no llega al saldo se queda: es plata mal puesta. */}
        {montoNum > 0 && montoNum < saldo && (
          <p className="text-xs font-medium" style={{ color: 'var(--cf-red-dark)' }}>
            El total debe ser al menos {formatMoney(saldo)} (el saldo actual)
          </p>
        )}

        {/* Tasa + Plazo */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Tasa (%)"
            type="text"
            inputMode="decimal"
            value={tasa}
            onChange={(e) => setTasa(soloDecimal(e.target.value))}
          />
          <div>
            <Input
              label={LABEL_PLAZO[frecuencia]}
              type="number"
              inputMode="numeric"
              value={plazoUnidades}
              onChange={(e) => setPlazoUnidades(e.target.value)}
            />
            {frecuencia !== 'diario' && plazoUnidades && (
              <p className="text-[10px] mt-1 px-0.5" style={{ color: 'var(--cf-ink-3)' }}>= {diasPlazo} días</p>
            )}
          </div>
        </div>

        {/* Frecuencia */}
        <div>
          <label className="block text-[11px] font-medium uppercase tracking-[0.05em] mb-1.5" style={{ color: 'var(--cf-ink-3)' }}>
            Frecuencia de cobro
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {['diario', 'semanal', 'quincenal', 'mensual'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setFrecuencia(f); setPlazoUnidades(DEFAULT_PLAZO[f] ?? '30') }}
                className="h-9 rounded-[10px] border text-xs font-medium capitalize transition-all cursor-pointer"
                style={frecuencia === f
                  ? { background: 'rgba(245,197,24,0.12)', borderColor: 'var(--cf-gold)', color: 'var(--cf-gold)' }
                  : { background: 'transparent', borderColor: 'var(--cf-border)', color: 'var(--cf-ink-3)' }
                }
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Mas opciones colapsable */}
        <button
          type="button"
          onClick={() => setMasOpciones(!masOpciones)}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 transition-colors"
          style={{ color: 'var(--cf-ink-3)' }}
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${masOpciones ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          {masOpciones ? 'Menos opciones' : 'Mas opciones'}
        </button>

        {masOpciones && (
          <div className="space-y-3">
            <Input
              label="Fecha de inicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
            <div className="rounded-xl p-3" style={{ border: '1px solid var(--cf-border)' }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seguro}
                  onChange={(e) => setSeguro(e.target.checked)}
                  className="w-4 h-4 accent-[#6366f1]"
                />
                <span className="text-sm font-medium" style={{ color: 'var(--cf-ink)' }}>Cobrar seguro</span>
              </label>
              {seguro && (
                <div className="mt-2.5">
                  <Input
                    label="Monto del seguro"
                    type="number"
                    inputMode="numeric"
                    placeholder="Ej: 10.000"
                    value={montoSeguro}
                    onChange={(e) => setMontoSeguro(e.target.value)}
                    prefix="$"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Preview cuota + comparacion */}
        {calculo && montoNum >= saldo && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--cf-ink-3)' }}>
                Nueva cuota {frecuencia}
                {!cuotaManualActiva && !modoUsaTabla && (
                  <button
                    type="button"
                    onClick={() => setCuotaManual(String(calculo.cuotaDiaria))}
                    className="ml-1.5 underline"
                    style={{ color: 'var(--cf-gold)' }}
                  >
                    editar
                  </button>
                )}
              </span>
              {cuotaManualActiva ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium" style={{ color: 'var(--cf-ink-3)' }}>$</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={cuotaManual}
                    onChange={(e) => setCuotaManual(e.target.value)}
                    className="w-24 h-8 px-2 text-right text-base font-bold rounded-lg outline-none font-mono-display"
                    style={{ background: 'var(--cf-surface)', border: '1.5px solid var(--cf-gold)', color: 'var(--cf-ink)' }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setCuotaManual('')}
                    className="ml-0.5 text-xs underline"
                    style={{ color: 'var(--cf-ink-3)' }}
                  >
                    auto
                  </button>
                </div>
              ) : (
                <span className="text-base font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
                  {formatMoney(calculo.cuotaDiaria)}
                </span>
              )}
            </div>
            {cuotaCambio !== null && cuotaCambio !== 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>vs cuota anterior</span>
                <span className="text-xs font-semibold" style={{ color: cuotaCambio > 0 ? 'var(--cf-red-dark)' : 'var(--cf-green-dark)' }}>
                  {cuotaCambio > 0 ? '+' : ''}{formatMoney(cuotaCambio)}
                </span>
              </div>
            )}
            {calculo.ultimaCuota && calculo.ultimaCuota !== calculo.cuotaDiaria && calculo.numPeriodos > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--cf-ink-3)' }}>Ultima cuota (ajuste)</span>
                <span className="text-sm font-semibold font-mono-display" style={{ color: 'var(--cf-ink-3)' }}>
                  {formatMoney(calculo.ultimaCuota)}
                </span>
              </div>
            )}
            {montoSeguroNum > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--cf-ink-3)' }}>Seguro</span>
                <span className="text-sm font-semibold font-mono-display" style={{ color: '#6366f1' }}>
                  {formatMoney(montoSeguroNum)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1" style={{ borderTop: '1px solid rgba(34,197,94,0.15)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--cf-ink-3)' }}>Total a pagar</span>
              <span className="text-sm font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>
                {formatMoney(calculo.totalAPagar + montoSeguroNum)}
              </span>
            </div>

            {/* La cuota fijada no cubre el interes de la tasa en el plazo pedido,
                asi que el plazo se alarga. Antes pasaba en silencio: un prestamista
                renovo esperando 12 cuotas por $3.600.000 y le quedaron 22 por
                $6.600.000. Ahora lo ve antes de confirmar. */}
            {calculo.plazoExtendido && (
              <div
                className="mt-2 rounded-[12px] p-3"
                style={{
                  background: 'color-mix(in srgb, var(--cf-gold-dark) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 30%, transparent)',
                }}
              >
                <p className="text-[12px] font-semibold" style={{ color: 'var(--cf-gold-dark)' }}>
                  El plazo se alarga para cubrir el interés
                </p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--cf-ink-2)' }}>
                  Con una cuota de {formatMoney(calculo.cuotaDiaria)} y una tasa del {tasa}%, se necesitan{' '}
                  <span className="font-semibold">{calculo.periodosReales} cobros</span> ({calculo.diasReales} días)
                  en vez de los {calculo.periodosPedidos} que pediste. Por eso el total es{' '}
                  {formatMoney(calculo.totalAPagar)} y no {formatMoney(calculo.totalSinExtender)}.
                </p>
                <p className="text-[10px] mt-1.5" style={{ color: 'var(--cf-ink-3)' }}>
                  Si querías {formatMoney(calculo.totalSinExtender)} en {calculo.periodosPedidos} cobros, baja la tasa.
                  Si querías terminar en ese plazo, sube la cuota.
                </p>
              </div>
            )}
          </div>
        )}

        {montoMaximoPrestamo > 0 && montoNum > montoMaximoPrestamo && (
          <p className="text-xs font-semibold" style={{ color: 'var(--cf-red-dark)' }}>
            Supera el tope de {formatMoney(montoMaximoPrestamo)} para este cliente
          </p>
        )}

        {error && <p className="text-sm" style={{ color: 'var(--cf-red-dark)' }}>{error}</p>}

        </Renovar>

        {/* «Cancelar» de segunda: el boton principal lo pinta `Renovar`, y dos
            botones del mismo tamaño hacen dudar cual es el que sigue. */}
        <button type="button" onClick={handleClose} style={{
          height: 44, border: 0, background: 'none', cursor: 'pointer',
          font: 'inherit', fontSize: 14, fontWeight: 700, color: 'var(--cf-ink-3)',
          width: '100%',
        }}>Cancelar</button>

      </div>
    </Modal>
  )
}
