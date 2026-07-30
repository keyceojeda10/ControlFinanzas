'use client'
// app/(dashboard)/prestamos/simulador/page.jsx — turno 29.
//
// Usa la MISMA lógica de cálculo del sistema (`calcularPrestamo`) para que el
// número coincida con el préstamo real cuando se cree. No crea cliente, no toca
// la base de datos, no guarda nada.
//
// ── LO QUE CAMBIA RESPECTO A LA PANTALLA ANTERIOR ──
//
// 1. LA RESPUESTA SUBE AL TOPE y se recalcula al escribir. Estaba debajo de
//    todo, en un recuadro punteado que decía «escribe el monto para ver la
//    simulación»: se configuraba a ciegas y luego había que bajar a mirarla.
//
// 2. LOS CINCO MODOS SE COLAPSAN a una fila con el recomendado y un «cambiar».
//    La lista completa está bien escrita, pero como hoja que se abre solo si
//    hace falta — así el simulador cabe sin scroll.
//
// 3. EL RESULTADO ESTÁ REDACTADO PARA DECIRLO EN VOZ ALTA: «le cobras $20.000
//    cada día, 30 veces, hasta el 27 de agosto». No «cuota: 20.000».
//
// 4. Y EL QUE NO ES DE FORMA: DEJA DE SER UN CALLEJÓN SIN SALIDA. Decía «sin
//    registrar nada» como si fuera una virtud, y cuando el cliente aceptaba
//    había que teclear los mismos cuatro datos otra vez en crear préstamo.
//    Ahora la acción dorada es CREAR ESTE PRÉSTAMO, con todo prellenado. Nadie
//    simula por deporte: simula porque tiene un cliente enfrente.

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Simulador from '@/components/pantallas/Simulador'
import HojaInferior from '@/components/cf/HojaInferior'
import ModoInteresSelector from '@/components/prestamos/ModoInteresSelector'
import TablaAmortizacion from '@/components/prestamos/TablaAmortizacion'
import { Toggle } from '@/components/ui/Toggle'
import { useCabecera } from '@/components/armazon/Armazon'
import { calcularPrestamo } from '@/lib/calculos'
import { formatMoney, soloDecimal } from '@/lib/i18n'

const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

const FRECUENCIAS = [
  { value: 'diario',    label: 'Diario',    unidad: 'días',      cuotaLabel: 'Cuota diaria',    cada: 'cada día' },
  { value: 'semanal',   label: 'Semanal',   unidad: 'semanas',   cuotaLabel: 'Cuota semanal',   cada: 'cada semana' },
  { value: 'quincenal', label: 'Quincenal', unidad: 'quincenas', cuotaLabel: 'Cuota quincenal', cada: 'cada quincena' },
  { value: 'mensual',   label: 'Mensual',   unidad: 'meses',     cuotaLabel: 'Cuota mensual',   cada: 'cada mes' },
]

const PLAZO_DEFAULT = { diario: '30', semanal: '8', quincenal: '4', mensual: '3' }

const MODOS = {
  fijo: 'Cuota fija',
  unico: 'Interés de una sola vez',
  solo_interes: 'Solo interés, capital al final',
  saldo: 'Interés sobre lo que falta',
  manual: 'Yo decido la cuota',
  lineal: 'Interés que baja',
  lineal_dinamico: 'Proporcional',
}

const fmtFecha = (d) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : '—'

export default function SimuladorPage() {
  const router = useRouter()

  const [monto, setMonto] = useState('')
  const [tasa, setTasa] = useState('20')
  const [frecuencia, setFrecuencia] = useState('diario')
  const [plazoUnidades, setPlazoUnidades] = useState('30')
  const [modoInteres, setModoInteres] = useState('fijo')
  const [interesAdelantado, setInteresAdelantado] = useState(false)
  const [cuotaManual, setCuotaManual] = useState('')

  const [hojaModos, setHojaModos] = useState(false)
  const [hojaTabla, setHojaTabla] = useState(false)
  const [aviso, setAviso] = useState('')

  useCabecera({ titulo: 'Simulador', subtitulo: 'La cuota para enseñársela, sin registrar nada' })

  const freqInfo = FRECUENCIAS.find((f) => f.value === frecuencia) || FRECUENCIAS[0]
  const diasPlazo = (Number(plazoUnidades) || 0) * (DIAS_POR_PERIODO[frecuencia] || 1)
  const cuotaManualActiva = modoInteres === 'manual'
  const saldoCuotaPersonalizada = modoInteres === 'saldo' && cuotaManual !== '' && Number(cuotaManual) > 0

  const calculo = useMemo(() => {
    const m = Number(monto)
    const t = Number(tasa)
    if (!m || tasa === '' || tasa == null || !diasPlazo) return null
    const cm = cuotaManualActiva || saldoCuotaPersonalizada ? Number(cuotaManual) : 0
    try {
      return calcularPrestamo({
        montoPrestado: m,
        tasaInteres: t,
        diasPlazo,
        fechaInicio: new Date(),
        frecuencia,
        modoInteres,
        ...(cm > 0 && { cuotaManual: cm }),
        interesAdelantado: modoInteres === 'solo_interes' && interesAdelantado,
      })
    } catch {
      return null
    }
  }, [monto, tasa, diasPlazo, frecuencia, modoInteres, cuotaManualActiva,
    saldoCuotaPersonalizada, cuotaManual, interesAdelantado])

  const numCuotas = calculo?.numPeriodos || 0
  const cuotaDistinta = calculo?.ultimaCuota && calculo?.cuotaDiaria
    && calculo.ultimaCuota !== calculo.cuotaDiaria && numCuotas > 1

  // Texto plano para WhatsApp.
  const textoCompartir = useMemo(() => {
    if (!calculo) return ''
    const L = ['*Simulación de crédito*', '']
    L.push(`Monto del crédito: ${formatMoney(Number(monto))}`)
    L.push(cuotaDistinta
      ? `${freqInfo.cuotaLabel}: de ${formatMoney(calculo.cuotaDiaria)} a ${formatMoney(calculo.ultimaCuota)}`
      : `${freqInfo.cuotaLabel}: ${formatMoney(calculo.cuotaDiaria)}`)
    L.push(`Número de cuotas: ${numCuotas}`)
    L.push(`Total a pagar: ${formatMoney(calculo.totalAPagar)}`)
    L.push(`Interés: ${formatMoney(calculo.totalInteres)}`)
    L.push(`Termina el: ${fmtFecha(calculo.fechaFin)}`)
    return L.join('\n')
  }, [calculo, monto, cuotaDistinta, freqInfo, numCuotas])

  const mandar = async () => {
    if (!textoCompartir) return
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'Simulación de crédito', text: textoCompartir }); return } catch {}
    }
    // Donde no hay hoja de compartir, al portapapeles Y SE DICE: un botón que
    // copia en silencio parece que no hizo nada.
    try {
      await navigator.clipboard.writeText(textoCompartir)
      setAviso('Copiado. Pégalo en el chat del cliente.')
      setTimeout(() => setAviso(''), 2500)
    } catch {
      setAviso('Este aparato no deja copiar ni compartir.')
    }
  }

  // ── EL ATAJO QUE NO EXISTÍA ──
  // Se lleva los cuatro datos ya ajustados. Lo único que falta al llegar es de
  // quién es el préstamo, que es justo lo que aquí todavía no se sabe.
  const crear = () => {
    const p = new URLSearchParams({
      monto: String(Number(monto) || ''),
      tasa: String(tasa),
      frecuencia,
      plazo: String(plazoUnidades),
      modo: modoInteres,
    })
    router.push(`/prestamos/nuevo?${p}`)
  }

  const cambiarFrecuencia = (etiqueta) => {
    const f = FRECUENCIAS.find((x) => x.label === etiqueta)
    if (!f) return
    setFrecuencia(f.value)
    // El plazo por defecto de cada frecuencia: dejar «30» al pasar a mensual
    // simularía dos años y medio, que no es lo que nadie quiere ver.
    setPlazoUnidades(PLAZO_DEFAULT[f.value] || '30')
  }

  // Con puntos de mil al escribir. «500000» se lee, pero medio millón escrito
  // seguido es justo donde se cuela un cero de más — y aquí se le está diciendo
  // una cifra a un cliente en la cara. Se guarda el número pelado y solo se
  // PINTA con puntos.
  const montoConPuntos = monto === '' ? '' : Number(monto).toLocaleString('es-CO')

  // La cuota va con su rango cuando cambia a lo largo del préstamo: decir un
  // solo número en «interés que baja» sería mentirle al cliente en la cara.
  const cuotaTexto = !calculo ? '—'
    : cuotaDistinta ? `${formatMoney(calculo.cuotaDiaria)}–${formatMoney(calculo.ultimaCuota)}`
      : formatMoney(calculo.cuotaDiaria)

  return (
    <>
      {aviso && (
        <p className="text-[13px] mb-2 text-center" style={{ color: 'var(--cf-ink-2)' }}>{aviso}</p>
      )}

      <Simulador
        sinDatos={!calculo ? 'Escribe cuánto le vas a prestar y aquí sale la cuota.' : null}
        cuota={cuotaTexto}
        cada={freqInfo.cada}
        veces={numCuotas}
        hasta={fmtFecha(calculo?.fechaFin)}
        tuPlata={formatMoney(Number(monto) || 0)}
        tuPlataNum={Number(monto) || 0}
        ganas={formatMoney(calculo?.totalInteres || 0)}
        ganasNum={calculo?.totalInteres || 0}

        monto={montoConPuntos}
        onMonto={(v) => setMonto(String(v).replace(/\D/g, ''))}
        interes={tasa}
        onInteres={(v) => setTasa(soloDecimal(v))}
        cobros={plazoUnidades}
        onCobros={(v) => setPlazoUnidades(soloDecimal(v))}
        unidadCobros={freqInfo.unidad}

        frecuencia={freqInfo.label}
        frecuencias={FRECUENCIAS.map((f) => f.label)}
        onFrecuencia={cambiarFrecuencia}

        modo={MODOS[modoInteres] ?? modoInteres}
        recomendado={modoInteres === 'fijo'}
        onCambiarModo={() => setHojaModos(true)}

        onCrear={calculo ? crear : null}
        onMandar={calculo ? mandar : null}
        onTabla={calculo ? () => setHojaTabla(true) : null}
      />

      {/* Los cinco modos, como hoja: la lista entera ocupa media pantalla y solo
          hace falta cuando se va a cambiar. */}
      <HojaInferior
        abierta={hojaModos}
        onCerrar={() => setHojaModos(false)}
        titulo="Cómo se cobra el interés"
      >
        <ModoInteresSelector
          modoInteres={modoInteres}
          onChange={(m) => { setModoInteres(m); setHojaModos(false) }}
          calculo={calculo}
          monto={Number(monto) || 0}
          tasa={Number(tasa) || 0}
          frecuencia={frecuencia}
          diasPlazo={diasPlazo}
        />

        {/* Los dos ajustes que solo existen dentro de su modo. Fuera de él no se
            enseñan: un campo que no hace nada es peor que no tenerlo. */}
        {cuotaManualActiva && (
          <label className="flex flex-col gap-2 mt-4">
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--cf-ink-3)' }}>
              Cuánto le cobras {freqInfo.cada}
            </span>
            <input
              type="text" inputMode="decimal"
              value={cuotaManual}
              onChange={(e) => setCuotaManual(soloDecimal(e.target.value))}
              placeholder="Ej: 20.000"
              className="h-12 px-3.5 rounded-[14px] text-[16px] font-semibold outline-none"
              style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)', color: 'var(--cf-ink)' }}
            />
          </label>
        )}

        {modoInteres === 'solo_interes' && (
          <div className="flex items-center gap-3 mt-4">
            <span className="flex-1 text-[13px]" style={{ color: 'var(--cf-ink)' }}>
              Cobrar el primer interés al entregar
            </span>
            <Toggle checked={interesAdelantado} onChange={setInteresAdelantado} />
          </div>
        )}
      </HojaInferior>

      <HojaInferior
        abierta={hojaTabla}
        onCerrar={() => setHojaTabla(false)}
        titulo="Cobro por cobro"
        subtitulo={calculo
          ? `${numCuotas} ${numCuotas === 1 ? 'cobro' : 'cobros'} · termina el ${fmtFecha(calculo.fechaFin)}`
          : null}
      >
        {calculo && (
          <TablaAmortizacion tabla={calculo.tablaAmortizacion} frecuencia={frecuencia} />
        )}
      </HojaInferior>
    </>
  )
}
