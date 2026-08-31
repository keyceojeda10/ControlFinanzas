'use client'
import { useState, useMemo, useEffect } from 'react'
import { Renovar } from '@/components/pantallas/Renovar'
import { useRouter } from 'next/navigation'
import { Modal }    from '@/components/ui/Modal'
import { Button }   from '@/components/ui/Button'
import { Input }    from '@/components/ui/Input'
import { calcularPrestamo } from '@/lib/calculos'
import { soloDecimal } from '@/lib/i18n'
import { useAuth } from '@/hooks/useAuth'
import { montoCrudo, montoCrudoConModo, montoParaMostrarConModo } from '@/lib/adaptadores/pago'
import MetodoPagoSelector from '@/components/pagos/MetodoPagoSelector'
import ModoInteresSelector from '@/components/prestamos/ModoInteresSelector'
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
  /* La flecha de volver al menú de Gestión, si se llegó desde ahí. */
  onVolver,
  prestamoId,
  saldoPendiente,
  capitalRestante,
  prestamoAnterior,
  clienteNombre,
  montoMaximoPrestamo,
  // Las cuentas de la organización (Nequi, Bancolombia, Daviplata…). La ficha
  // del préstamo ya las carga: aquí solo se reciben.
  metodosPago = [],
  /* ⚠ LA MISMA HOJA, OTRA PREGUNTA.
   *
   * «Una persona tiene un préstamo en modo Globo, o sea paga solo intereses.
   *  Pero este cliente ha decidido comenzar a pagar por cuotas e interés a la
   *  vez, o sea modo banco, intereses sobre saldos. ¿Desde ahí donde está
   *  creado puedo hacerles el cambio?»            — un prestamista, 31 ago 2026
   *
   * No se puede cambiar sobre el préstamo vivo, y no por pereza: el mismo % vale
   * cosas distintas en cada modo —entre el más caro y el más barato hay 6,6x— y
   * los pagos ya hechos se repartieron con la regla vieja. Cambiar la etiqueta
   * dejaría cifras calculadas con una regla dentro de un préstamo que dice otra.
   *
   * Lo que sí vale es lo que él mismo pidió: «coger el capital de la persona y
   * solo cambiar el modo». Eso es EXACTAMENTE lo que ya hace renovar —cierra el
   * viejo, abre uno con el capital, los deja enlazados, no crea pago falso y no
   * mueve caja si no entregas nada—. Solo faltaba poder elegir el modo.
   *
   * Con `soloModo` la hoja se presenta como lo que es: sin atajos de «préstale
   * más», con el total ya puesto en el capital y con el selector arriba. */
  soloModo = false,
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
  // ── EL MODO ABREVIADO EN LA RENOVACIÓN ─────────────────────────────────
  // «40» son $40.000 con el interruptor puesto. `monto` guarda SIEMPRE pesos
  // reales —de ahí sale el préstamo nuevo— y `montoTecleado` es lo que se ve.
  // ⚠ Los atajos («Solo el saldo», «El doble») ponen cifras EXACTAS: van por
  // `fijarMonto`, que olvida lo tecleado, no por la conversión.
  const { modoAbreviado } = useAuth()
  const [montoTecleado, setMontoTecleado] = useState(null)
  /* POR DÓNDE SE ENTREGA LA DIFERENCIA.
     `null` = efectivo, que es el caso normal en gota a gota. Si se elige una
     cuenta, esa plata NO sale del fajo del cobrador y la caja tiene que saberlo:
     hasta ahora la renovación no mandaba el método y todo se contaba como
     efectivo, pidiéndole al cobrador un fajo que nunca tuvo.

     Guarda el objeto entero que devuelve `MetodoPagoSelector`
     —`{metodoPago, metodoPagoId, plataforma}`— porque ese es su contrato y
     además es lo que hace falta para pintar el rótulo con el nombre real. */
  const [cuentaEntrega, setCuentaEntrega] = useState(null)
  const fijarMonto = (v) => { setMontoTecleado(null); setMonto(v) }
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

  /* El modo del préstamo NUEVO. Arranca en el del viejo —renovar hereda, y eso
     no cambia— pero ahora se puede mover. La API ya lo aceptaba: lo que lo
     clavaba era esta pantalla. */
  const [modo, setModo] = useState(modoHeredado)
  const modoUsaTabla = ['solo_interes', 'lineal', 'lineal_dinamico'].includes(modo)
  const cambiaDeModo = modo !== modoHeredado

  /* Al abrir en «cambiar el modo» el total ya viene puesto en el capital: es la
     respuesta a la pregunta, no algo que haya que teclear. Y el modo se vuelve a
     sincronizar con el del préstamo por si la hoja se abrió antes de que
     cargara. */
  useEffect(() => {
    if (!open) return
    setModo(modoHeredado)
    if (soloModo && saldo > 0) { setMontoTecleado(null); setMonto(String(Math.round(saldo))) }
  }, [open, soloModo, saldo, modoHeredado])

  const calculo = useMemo(() => {
    if (!montoNum || !tasa || !diasPlazo) return null
    try {
      const usarManual = cuotaManualActiva && !modoUsaTabla && modo !== 'saldo'
      return calcularPrestamo({
        montoPrestado: montoNum,
        tasaInteres:   Number(tasa),
        diasPlazo,
        fechaInicio,
        frecuencia,
        modoInteres:   usarManual ? 'manual' : modo,
        ...(usarManual && { cuotaManual: Number(cuotaManual) }),
        ...(modo === 'saldo' && cuotaManualActiva && { cuotaManual: Number(cuotaManual) }),
        ...(modo === 'solo_interes' && { interesAdelantado: !!prestamoAnterior?.interesAdelantado }),
      })
    } catch { return null }
  }, [montoNum, tasa, diasPlazo, fechaInicio, frecuencia, modo, modoUsaTabla, cuotaManual, cuotaManualActiva, prestamoAnterior?.interesAdelantado])

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
          modoInteres:   (cuotaManualActiva && !modoUsaTabla && modo !== 'saldo') ? 'manual' : modo,
          ...((cuotaManualActiva && !modoUsaTabla && modo !== 'saldo') && { cuotaManual: Number(cuotaManual) }),
          ...(modo === 'saldo' && cuotaManualActiva && { cuotaManual: Number(cuotaManual) }),
          ...(seguro && montoSeguroNum > 0 && { seguro: true, montoSeguro: montoSeguroNum }),
          ...(modo === 'solo_interes' && prestamoAnterior?.interesAdelantado && { interesAdelantado: true }),
          // Por dónde sale la diferencia. Sin elegir nada = efectivo.
          ...(cuentaEntrega?.metodoPago === 'transferencia' && {
            metodoPago: 'transferencia', metodoPagoId: cuentaEntrega.metodoPagoId,
          }),
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
    setModo(modoHeredado)
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
    /* El título va en la CABECERA del modal, no dentro del cuerpo. Mientras
       estuvo dentro, el modal no tenía cabecera y se le pintaba una X
       flotante que al deslizar caía encima del capital adeudado. */
    <Modal
      onVolver={onVolver}
      open={open}
      onClose={handleClose}
      title={soloModo ? 'Cambiar el modo de cobro' : 'Renovar el préstamo'}
      subtitle={soloModo
        ? 'Se cierra este préstamo y se abre uno con el mismo capital. No sale ni entra dinero.'
        : (clienteNombre ? `Cierra el de ${clienteNombre} y abre uno nuevo` : 'Cierra el actual y abre uno nuevo')}
    >
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
          titulo={null}
          ayuda={null}
          saldoEtiqueta={modoUsaTabla ? 'Capital adeudado' : 'Saldo pendiente'}
          saldo={formatMoney(saldo)}
          saldoNota={`Se absorbe en el nuevo y el anterior queda como completado. Prestó ${formatMoney(montoAnterior)} · cuota ${formatMoney(cuotaAnterior)}.`}
          total={montoTecleado != null ? montoTecleado : montoParaMostrarConModo(monto, modoAbreviado, undefined)}
          onTotal={(v) => {
            const crudo = montoCrudo(v)
            setMontoTecleado(crudo)
            setMonto(montoCrudoConModo(crudo, modoAbreviado))
          }}
          simbolo="$"
          atajos={saldo > 0 && !soloModo ? [
            { etiqueta: 'Solo el saldo', valor: String(Math.round(saldo)) },
            { etiqueta: `+ ${formatMoney(500000)}`, valor: String(Math.round(saldo + 500000)) },
            { etiqueta: 'El doble', valor: String(Math.round(saldo * 2)) },
          ] : []}
          onAtajo={(v) => fijarMonto(v)}
          incluye={soloModo
            ? `Es el capital que pasa al préstamo nuevo. Si además le prestas más, sube el total.`
            : `El total INCLUYE lo que ya debe (${formatMoney(saldo)}). Escribe el total, no lo nuevo.`}
          antesDespues={calculo && cuotaAnterior > 0 ? {
            etiqueta: 'La cuota, antes y después',
            concepto: 'Cuota',
            antes: formatMoney(cuotaAnterior),
            despues: formatMoney(calculo.cuotaDiaria),
            tono: calculo.cuotaDiaria > cuotaAnterior ? 'empeora' : 'mejora',
          } : null}
          /* El rótulo sigue a la cuenta elegida: decir «en efectivo» cuando se
             entregó por Nequi es lo que descuadraba el fajo del cobrador. */
          entregaEtiqueta={cuentaEntrega?.metodoPago === 'transferencia'
            ? `Le entregas por ${cuentaEntrega.plataforma ?? 'transferencia'}`
            : 'Le entregas en efectivo'}
          /* ⚠ NADA QUE ENTREGAR NO ES ENTREGAR CERO. Renovando por lo justo del
             saldo no sale un peso, y el botón decía «Renovar y entregar $0». */
          entrega={montoNum > 0 && enMano > 0 ? formatMoney(enMano) : null}
          botonTexto={soloModo ? 'Cambiar el modo de cobro' : undefined}
          gananciaEtiqueta="Ganancia del nuevo"
          ganancia={calculo && calculo.totalAPagar > montoNum
            ? formatMoney(Math.round(calculo.totalAPagar - montoNum)) : null}
          onRenovar={handleSubmit}
          renovando={loading}
        >

        {/* ══ CÓMO SE VA A COBRAR ═══════════════════════════════════════════
            Se reusa `ModoInteresSelector`, el mismo de crear un préstamo, y no
            una lista propia: es el ÚNICO sitio que dice qué significa el % en
            cada modo —«por mes», «de todo el préstamo», «por cada cobro»— y esa
            frase es la que evita el error de 6,6x. Una segunda lista aquí se
            desincronizaría el día que cambie un modo.

            En una renovación normal va dentro de «Más opciones»: quien renueva
            casi nunca quiere cambiar de modo, y sacarlo a la vista sería
            ofrecerle una decisión que no venía a tomar. */}
        {soloModo && (
          <div className="space-y-2">
            <ModoInteresSelector
              modoInteres={modo}
              onChange={setModo}
              calculo={calculo}
              monto={montoNum}
              tasa={Number(tasa) || 0}
              frecuencia={frecuencia}
              diasPlazo={diasPlazo}
            />
            {/* ⚠ LO QUE SE CAPITALIZA, DICHO ANTES DE PULSAR.
                En un Globo ABIERTO el saldo es capital + el interés que ya
                corrió y no se ha pagado, y ese interés pasa a ser capital del
                préstamo nuevo: a partir de ahí genera interés él también. En un
                Globo con plazo no ocurre —ahí se arrastra el capital pelado—
                pero cuando ocurre hay que decirlo, no descubrirlo después. */}
            {capitalRestante == null && saldoTotal > 0 && (
              <p className="text-[11px] leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
                Pasan {formatMoney(saldoTotal)}: el capital más el interés que ya
                se causó y no está pagado. Ese interés queda como capital del
                préstamo nuevo.
              </p>
            )}
            {cambiaDeModo && (
              <p className="text-[11px] leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
                El préstamo de ahora queda como completado y su historial se
                conserva, enlazado desde el nuevo.
              </p>
            )}
          </div>
        )}

        {/* ── POR DÓNDE SALE LA DIFERENCIA ──────────────────────────────────
            Solo aparece si de verdad hay algo que entregar: renovar por lo
            justo del saldo no mueve un peso, y un selector ahí sería ruido.

            Sin esto la renovación no mandaba método y TODO se contaba como
            efectivo: si el prestamista pagaba por Nequi, la cuenta del día le
            pedía al cobrador un fajo que nunca tuvo. */}
        {metodosPago.length > 0 && enMano > 0 && (
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-[0.05em] mb-1.5" style={{ color: 'var(--cf-ink-3)' }}>
              ¿Por dónde le entregas los {formatMoney(enMano)}?
            </label>
            <MetodoPagoSelector
              metodosPago={metodosPago}
              value={cuentaEntrega}
              onSelect={setCuentaEntrega}
              compact
            />
          </div>
        )}

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
            {!soloModo && (
              <ModoInteresSelector
                modoInteres={modo}
                onChange={setModo}
                calculo={calculo}
                monto={montoNum}
                tasa={Number(tasa) || 0}
                frecuencia={frecuencia}
                diasPlazo={diasPlazo}
              />
            )}
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
