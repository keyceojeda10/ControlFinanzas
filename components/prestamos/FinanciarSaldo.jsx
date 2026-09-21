'use client'
/* LA HOJA «FINANCIAR EL SALDO». El contenido vive en `Gestion.jsx` (`Financiar`)
 * como el resto de hojas que cambian plata; aquí va su estado y el envío.
 *
 * El envío va a la MISMA ruta que renovar (`/api/prestamos/[id]/renovar`) con
 * `financiar: true`, y la pantalla solo manda tres cosas: el interés en pesos,
 * el plazo y la frecuencia. La deuda, la tasa y la fecha las decide el servidor
 * al guardar —ver el comentario de esa ruta—. La cifra de abajo sale de la
 * misma función que usa el servidor (`vistaFinanciar`), así que lo que se ve es
 * lo que se guarda salvo que entre un pago entre medias.
 */
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import HojaInferior, { salirDeHojaHacia } from '@/components/cf/HojaInferior'
import { conPantalla } from '@/components/cf/Procesando'
import { Financiar, PieGestion } from '@/components/pantallas/Gestion'
import { interesPorPorcentaje, vistaFinanciar, DIAS_POR_PERIODO } from '@/lib/financiar'
import { montoCrudoConModo } from '@/lib/adaptadores/pago'
import { useAuth } from '@/hooks/useAuth'

const UNIDAD = { diario: 'días', semanal: 'semanas', quincenal: 'quincenas', mensual: 'meses' }
const CUOTA = { diario: 'La cuota diaria', semanal: 'La cuota semanal', quincenal: 'La cuota quincenal', mensual: 'La cuota mensual' }
const ATAJOS_PCT = [10, 15, 20].map((v) => ({ id: `p${v}`, etiqueta: `${v} %`, valor: v }))
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/* Hoy en el calendario del teléfono, como «YYYY-MM-DD». Solo para la vista
   previa: la fecha que se guarda la pone el servidor en el país del negocio. */
function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// «21 oct», sin `Intl`: el ICU nuevo mete un «de» (ver bug_icu_de_en_fecha_corta).
function fechaCorta(f) {
  const d = new Date(f)
  if (Number.isNaN(d.getTime())) return null
  // Las fechas del cálculo vienen a medianoche de Bogotá (05:00 UTC): se lee en UTC.
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`
}
// El porcentaje admite «15,5» y «15.5»: aquí el punto es decimal, no de miles.
const porcentajeDe = (v) => Math.max(0, Number(String(v ?? '').trim().replace(',', '.')) || 0)

export default function FinanciarSaldo({
  abierta, onCerrar, onVolver,
  prestamoId, clienteNombre, deuda, frecuencia = 'diario', diasPlazoAntes, formatMoney,
}) {
  const router = useRouter()
  /* ⚠ EN «MILES» SE ESCRIBE 200 Y SON $200.000. Los negocios que trabajan así lo
     tienen puesto en la organización, y el recargo ya lo respetaba: sin esto, aquí
     se financiarían $200 en vez de $200.000. */
  const { modoAbreviado } = useAuth()
  const periodoDias = DIAS_POR_PERIODO[frecuencia] ?? 1
  const cuotasIniciales = Math.max(1, Math.round((Number(diasPlazoAntes) || 30) / periodoDias))

  const [modo, setModo] = useState('porcentaje')
  const [pct, setPct] = useState('')
  const [cifra, setCifra] = useState('')
  const [cuotas, setCuotas] = useState(cuotasIniciales)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  /* ⚠ AL ABRIR SE EMPIEZA EN BLANCO: el interés NO viene puesto. Una cifra
     heredada es la que termina cobrada de un toque de más —ya pasó en la hoja
     del interés, que heredaba la cuota—. Los atajos están a un dedo. */
  useEffect(() => {
    if (!abierta) return
    setModo('porcentaje'); setPct(''); setCifra(''); setCuotas(cuotasIniciales); setError('')
  }, [abierta, cuotasIniciales])

  const interes = modo === 'porcentaje'
    ? (String(pct).trim() === '' ? null : interesPorPorcentaje(deuda, porcentajeDe(pct)))
    : (String(cifra).trim() === '' ? null : Math.round(Number(montoCrudoConModo(cifra, modoAbreviado)) || 0))

  const vista = useMemo(
    () => (interes == null ? null : vistaFinanciar({ deuda, interes, periodos: cuotas, frecuencia, fechaInicio: hoyISO() })),
    [deuda, interes, cuotas, frecuencia],
  )

  const pctNum = porcentajeDe(pct)
  const equivale = modo === 'porcentaje' && pctNum > 0 && interes > 0
    ? `${String(pct).replace('.', ',')} % de ${formatMoney(deuda)} = ${formatMoney(interes)}`
    : null

  async function financiar() {
    if (interes == null || !vista) return
    setEnviando(true)
    setError('')
    try {
      const res = await conPantalla('financiar', () => fetch(`/api/prestamos/${prestamoId}/renovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ financiar: true, interes, diasPlazo: vista.diasPlazo, frecuencia }),
      }))
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'No se pudo financiar. Intenta de nuevo.'); return }
      /* A la cartulina nueva: es la que se va a cobrar desde hoy.
         ⚠ `salirDeHojaHacia`, NO `onCerrar()` + `router.replace`: al cerrarse la
         hoja retira su entrada del historial con un `back()` diferido, que llega
         en mitad de la navegación y la aborta. Pasó aquí mismo en el espejo: se
         financió en la base y la pantalla se quedó en la cartulina vieja con sus
         66 días de atraso —justo lo que el cliente no quería ver—. */
      onCerrar?.()
      salirDeHojaHacia(router, `/prestamos/${data.id}`)
    } catch {
      setError('Sin conexión. No se guardó nada: intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      onVolver={onVolver}
      titulo="Financiar el saldo"
      subtitulo={clienteNombre}
      accion={
        <PieGestion
          onCancelar={onCerrar}
          onAceptar={financiar}
          textoAceptar={vista ? `Financiar ${formatMoney(vista.total)}` : 'Financiar'}
          cifra={vista ? formatMoney(vista.total) : null}
          deslizar
          deshabilitado={!vista || enviando}
          aceptando={enviando}
          error={error}
        />
      }
    >
      <Financiar
        modo={modo}
        onModo={setModo}
        porcentaje={pct}
        onPorcentaje={setPct}
        atajosPorcentaje={ATAJOS_PCT}
        porcentajeActivo={ATAJOS_PCT.find((a) => String(a.valor) === String(pct))?.id ?? null}
        onAtajoPorcentaje={(a) => setPct(String(a.valor))}
        monto={cifra}
        onMonto={setCifra}
        enMiles={!!modoAbreviado}
        equivale={equivale}
        cuotas={cuotas}
        unidad={UNIDAD[frecuencia] ?? 'cuotas'}
        onMenos={() => setCuotas((n) => Math.max(1, n - 1))}
        onMas={() => setCuotas((n) => n + 1)}
        debeAntes={deuda > 0 ? formatMoney(deuda) : null}
        debeDespues={vista ? formatMoney(vista.total) : null}
        cuota={vista ? formatMoney(vista.cuota) : null}
        rotuloCuota={CUOTA[frecuencia] ?? 'La cuota'}
        desde={vista ? 'hoy' : null}
        hasta={vista ? fechaCorta(vista.fechaFin) : null}
      />
    </HojaInferior>
  )
}
