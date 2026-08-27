'use client'
// app/(dashboard)/prestamos/nuevo/page.jsx - Formulario de nuevo préstamo

import { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react'
import { abreviaturaDocumento } from '@/lib/documento'
import { useRouter, useSearchParams }              from 'next/navigation'
import Link                                        from 'next/link'
import { useAuth }                                 from '@/hooks/useAuth'
import { Button }                                  from '@/components/ui/Button'
import { Input }                                   from '@/components/ui/Input'
import MoneyInput                                  from '@/components/ui/MoneyInput'
import { calcularPrestamo } from '@/lib/calculos'
import { fechaDePeriodo } from '@/lib/dinero/calendario'
import { useCabecera } from '@/components/armazon/Armazon'
import { usePantallaAncha } from '@/hooks/usePantallaAncha'
import { formatMoney, soloDecimal } from '@/lib/i18n'
import { GrupoSegmentado } from '@/components/cf/primitivos2'
import AvisoUltimaCuota                            from '@/components/prestamos/AvisoUltimaCuota'
import ModoInteresSelector, { AvisoPorCobro, avisoDelPorcentaje } from '@/components/prestamos/ModoInteresSelector'
import TablaAmortizacion                           from '@/components/prestamos/TablaAmortizacion'
import CuotasExtraEditor                           from '@/components/prestamos/CuotasExtraEditor'
import Stepper                                     from '@/components/ui/Stepper'
import DiasSinCobroSelector                        from '@/components/ui/DiasSinCobroSelector'
import { Toggle }                                  from '@/components/ui/Toggle'
import MetodoPagoSelector                          from '@/components/pagos/MetodoPagoSelector'
import { guardarPrestamoPendiente, obtenerClientesOffline } from '@/lib/offline'

const getColombiaDate = () => new Date(Date.now() - 5 * 60 * 60 * 1000)
const hoyISO = () => getColombiaDate().toISOString().slice(0, 10)

/**
 * «4 ago» para el calendario del panel.
 *
 * ⚠ `timeZone: 'UTC'` NO ES OPCIONAL. `lib/dinero/calendario.js` calcula las
 * fechas de cobro entera y deliberadamente en UTC («producción corre en UTC y
 * el desarrollo en Bogotá, así que un error con métodos locales es invisible
 * aquí y real allí»). Formatearlas con la zona del navegador las corre un día
 * para cualquiera al oeste de UTC-5 — Costa Rica, sin ir más lejos, que es
 * UTC-6 y sí tenemos ahí.
 */
/**
 * Las columnas del calendario del panel: # · fecha · cuota · saldo.
 *
 * ⚠ UNA SOLA CONSTANTE PARA LA CABECERA Y PARA LAS FILAS. Las escribí por
 * separado y quedaron en 52px y 46px: las columnas salían corridas y en el JSX
 * las dos rejillas se leen idénticas. Es la segunda vez que me pasa en este
 * rediseño —la otra fue la lista de clientes, con 8 columnas arriba y 7
 * abajo—, y las dos veces solo se vio midiendo el DOM.
 */
const COLUMNAS_CALENDARIO = '18px 52px 1fr 1fr'

const fechaCorta = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  })
    // `es-CO` devuelve «13 de ago.» — con «de» y con punto. En una columna de
    // 52px eso no cabe, y la lámina la escribe «4 ago».
    .replace(' de ', ' ')
    .replace('.', '')
}

const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

// Cómo se llaman las cuotas según cada cuánto se cobra. Estaba escrito con un
// ternario de cuatro ramas en tres sitios distintos.
const UNIDAD_PLAZO = { diario: 'días', semanal: 'semanas', quincenal: 'quincenas', mensual: 'meses' }
const UNIDAD_CUOTA = { diario: 'diaria', semanal: 'semanal', quincenal: 'quincenal', mensual: 'mensual' }

/**
 * Las opciones de segundo nivel —el día de la semana dentro de «semanal»—.
 *
 * ⚠ EL FONDO INACTIVO ES `--cf-card`, NO `--cf-surface`. En tema claro los dos
 * son blancos, y en cuanto el formulario pasó a descansar sobre una hoja
 * blanca, todo lo que iba sobre `--cf-surface` se quedó sin nada que lo
 * separara del fondo: «en PC ni siquiera los veo». El borde es lo que los
 * dibuja, así que tiene que estar siempre.
 */
function estiloOpcionMenor(activo) {
  return activo
    ? { background: 'color-mix(in srgb, var(--cf-gold) 14%, transparent)', borderColor: 'var(--cf-gold)', color: 'var(--cf-gold-dark, var(--cf-gold))' }
    : { background: 'var(--cf-card)', borderColor: 'var(--cf-border)', color: 'var(--cf-ink-2)' }
}

// Modo de interes preferido del prestamista (lo elige una vez con el asistente y
// queda por defecto). Guardado en el dispositivo para no repetir el test en cada
// prestamo; se puede rehacer cuando quiera.
const KEY_MODO_PREFERIDO = 'cf-modo-interes-preferido'
const MODOS_VALIDOS = ['fijo', 'unico', 'solo_interes', 'saldo', 'manual', 'lineal', 'lineal_dinamico']
const leerModoPreferido = () => {
  if (typeof window === 'undefined') return null
  try { const v = localStorage.getItem(KEY_MODO_PREFERIDO); return MODOS_VALIDOS.includes(v) ? v : null } catch { return null }
}
const guardarModoPreferido = (m) => { try { localStorage.setItem(KEY_MODO_PREFERIDO, m) } catch {} }

// Card de seccion premium (definida fuera para evitar perdida de focus)
const SectionCard = ({ icon, title, color = 'var(--cf-gold)', children, accent }) => (
  <div
    className="rounded-[20px] p-4"
    style={{
      background: `linear-gradient(135deg, color-mix(in srgb, ${color} 6%, var(--cf-card)) 0%, var(--cf-card) 100%)`,
      border: '1px solid var(--cf-border)',
    }}
  >
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-[6px] flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
        >
          <span className="w-3.5 h-3.5">{icon}</span>
        </div>
        <p className="text-[11px] font-extrabold uppercase tracking-[.07em]" style={{ color }}>
          {title}
        </p>
      </div>
      {accent}
    </div>
    <div className="space-y-3">{children}</div>
  </div>
)

function EditableRow({ label, value, pencil, editor, valueColor }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="py-2 border-b" style={{ borderColor: 'color-mix(in srgb, var(--cf-border) 50%, transparent)' }}>
      {editing ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--cf-ink-3)' }}>{label}</span>
            <button type="button" onClick={() => setEditing(false)} className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ color: 'var(--cf-green-dark)', background: 'color-mix(in srgb, var(--cf-green-dark) 12%, transparent)' }}>OK</button>
          </div>
          {editor}
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="flex justify-between items-center w-full text-left group">
          <span className="text-sm" style={{ color: 'var(--cf-ink-3)' }}>{label}</span>
          <span className="flex items-center gap-1.5">
            <span className="font-semibold text-sm" style={{ color: valueColor || 'var(--cf-ink)' }}>{value}</span>
            <span className="opacity-40 group-hover:opacity-100 transition-opacity">{pencil}</span>
          </span>
        </button>
      )}
    </div>
  )
}

// Wrapper con Suspense requerido por useSearchParams en Next.js build
export default function NuevoPrestamoPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-40">
        <svg className="animate-spin w-6 h-6 text-[var(--cf-gold)]" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    }>
      <NuevoPrestamo />
    </Suspense>
  )
}

function NuevoPrestamo() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { puedeCrearPrestamos, esOwner, loading: authLoading } = useAuth()

  const clienteIdParam = searchParams.get('clienteId') ?? ''

  const [clienteId,    setClienteId]    = useState(clienteIdParam)
  const [clientes,     setClientes]     = useState([])
  const [clienteNombre, setClienteNombre] = useState('')
  // ── LO QUE VIENE DEL SIMULADOR ──
  //
  // El simulador era un callejon sin salida: se ajustaba el monto, el interes,
  // el plazo y el modo, se le enseñaba la cuota al cliente… y cuando aceptaba
  // habia que teclear los mismos cuatro datos otra vez aqui. Nadie simula por
  // deporte: simula porque tiene un cliente enfrente.
  //
  // Se leen UNA VEZ, al arrancar el estado, y no en un efecto: asi el
  // formulario nace con los datos puestos en vez de parpadear vacio y luego
  // llenarse, y escribir encima no se pisa con lo que traia la URL.
  const deLaUrl = (clave, porDefecto) => {
    const v = searchParams.get(clave)
    return v != null && v !== '' ? v : porDefecto
  }
  const [monto,        setMonto]        = useState(() => deLaUrl('monto', ''))
  const [tasa,         setTasa]         = useState(() => deLaUrl('tasa', '20'))
  // plazo se ingresa en la unidad de la frecuencia (dias, semanas, quincenas o meses)
  const [plazoUnidades, setPlazoUnidades] = useState(() => deLaUrl('plazo', '30'))
  const [frecuencia,   setFrecuencia]   = useState(() => deLaUrl('frecuencia', 'diario'))
  // Dia ancla opcional: fija el dia de cobro sin importar cuando empieza el prestamo
  // - semanal/quincenal: 0=dom..6=sab (string '' = sin ancla)
  // - mensual: 1..31 (string '' = sin ancla)
  const [diaCobroSemana, setDiaCobroSemana] = useState('')
  const [diaCobroMes, setDiaCobroMes]       = useState('')
  const [diaCobroMes2, setDiaCobroMes2]     = useState('')
  const [modoDiaCobro, setModoDiaCobro]     = useState('semana') // 'semana' | 'mes'
  // Dias totales derivados de plazoUnidades × diasPorPeriodo
  const plazo = String((Number(plazoUnidades) || 0) * (DIAS_POR_PERIODO[frecuencia] || 1))
  const [fechaInicio,  setFechaInicio]  = useState(hoyISO())
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [buscadorCliente, setBuscadorCliente] = useState('')
  const [modalInyeccion, setModalInyeccion] = useState(null) // { faltante, saldoActual, montoInyeccion, descripcion }
  const [inyectando, setInyectando] = useState(false)

  // Modo: 'prestamo' (con interés) o 'mercancia' (cuota fija)
  const [modo, setModo] = useState('prestamo')
  const [numCuotas, setNumCuotas] = useState('10')
  // Mercancia: precio de venta total (lo que le deja la mercancia al cliente).
  // La ganancia = precioVenta - valor del articulo (monto). La cuota = precioVenta / numCuotas.
  const [precioVenta, setPrecioVenta] = useState('')
  // Mercancia: nombre del producto (gorra, reloj...) para dar referencia. Opcional.
  const [nombreProducto, setNombreProducto] = useState('')
  // Préstamo en curso (migración)
  const [esEnCurso, setEsEnCurso] = useState(false)
  /* A qué se abonó ese pago previo. Solo se pregunta en el préstamo abierto,
     que es donde la respuesta hace lo que dice — ver lib/dinero/abono-previo.js. */
  const [tipoAbonoPrevio, setTipoAbonoPrevio] = useState('completo')
  const [yaAbonado, setYaAbonado] = useState('')
  // Cobro de seguro (opcional)
  const [seguro, setSeguro] = useState(false)
  const [montoSeguro, setMontoSeguro] = useState('')
  const [socioId, setSocioId] = useState('')
  const [listaSocios, setListaSocios] = useState([])
  // Cuenta de la que sale el desembolso (efectivo por defecto). Alimenta el
  // desglose "dinero por cuenta". No afecta el calculo del prestamo.
  const [metodosPago, setMetodosPago] = useState([])
  const [cuentaDesembolso, setCuentaDesembolso] = useState({ metodoPago: 'efectivo', metodoPagoId: null, plataforma: null })
  // Modo de interes: 'fijo' (clasico, default) | 'unico' | 'saldo' | 'manual'.
  const [modoInteres, setModoInteres] = useState(() => deLaUrl('modo', 'fijo'))
  const [modoPreferido, setModoPreferido] = useState(null)
  const [interesAdelantado, setInteresAdelantado] = useState(false)
  /* ⚠ PRÉSTAMO ABIERTO: sin plazo ni fecha de vencimiento. Solo en Globo.
     «Presto $690.000 al 10% mensual, el cliente paga solo los intereses y el
      capital queda pendiente. Probé GLOBO pero me exige un plazo y una fecha
      final, y mi modelo no funciona así.» — un cliente, 18 ago 2026. Y no era
     raro: 25 negocios lo estaban forzando estirando el plazo hasta tres años. */
  const [sinPlazo, setSinPlazo] = useState(false)
  /* La bandera solo vale en Globo. Se deriva en vez de guardarse para que
     cambiar de modo no deje un préstamo «abierto» de otro tipo por olvido. */
  const esAbierto = modoInteres === 'solo_interes' && sinPlazo
  const [capitalExtra, setCapitalExtra] = useState([])

  /* ⚠ SI DEJA DE SER ABIERTO, LA RESPUESTA SE OLVIDA. El API rechaza cualquier
     tipo que no sea 'completo' fuera del abierto, así que dejarla puesta al
     cambiar de modo daría un 400 al guardar sobre una opción que ya no se ve.
     Es el mismo patrón del interruptor que se queda encendido sin hacer nada. */
  useEffect(() => {
    if (!esAbierto) setTipoAbonoPrevio('completo')
  }, [esAbierto])
  // ── «TE QUEDAN $3.2M DISPONIBLES EN CAJA» (T16-00) ──
  // La lámina lo pone debajo del monto, y es la pregunta que el prestamista se
  // hace justo ahí: si presta esto, ¿con qué se queda?
  //
  // Solo para el dueño: `/api/capital` devuelve 403 a un cobrador, y el
  // capital del negocio no es dato suyo.
  const [saldoCaja, setSaldoCaja] = useState(null)
  useEffect(() => {
    if (!esOwner) return
    fetch('/api/capital')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.capital?.saldo != null) setSaldoCaja(Number(d.capital.saldo)) })
      .catch(() => {})
  }, [esOwner])
  const [cuotaManual, setCuotaManual] = useState('')
  const cuotaManualActiva = modoInteres === 'manual'
  const saldoCuotaPersonalizada = modoInteres === 'saldo' && cuotaManual !== '' && Number(cuotaManual) > 0
  // Dias sin cobro especificos para este cliente (se actualizan en su ficha
  // al crear el prestamo). Permite que en frecuencia diaria se elijan dias
  // de la semana en que NO se cobra (ej. domingo).
  const [diasSinCobroCliente, setDiasSinCobroCliente] = useState([])
  const [diasSinCobroEditado, setDiasSinCobroEditado] = useState(false)

  // Firma digital del cliente (capturada en paso 2)
  const [firmaBase64, setFirmaBase64] = useState(null)
  const [firmaStrokes, setFirmaStrokes] = useState(false)
  const firmaCanvasRef = useRef(null)
  const firmaDrawing = useRef(false)
  const firmaLastPt = useRef(null)
  const lastValidCalculo = useRef(null)

  const setupFirmaCanvas = useCallback(() => {
    const canvas = firmaCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2.5
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#15161A'
  }, [])

  const firmaGetPoint = (e) => {
    const canvas = firmaCanvasRef.current
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches?.[0]
    return {
      x: (touch?.clientX ?? e.clientX) - rect.left,
      y: (touch?.clientY ?? e.clientY) - rect.top,
    }
  }
  const firmaStart = (e) => { e.preventDefault(); firmaDrawing.current = true; firmaLastPt.current = firmaGetPoint(e) }
  const firmaDraw = (e) => {
    if (!firmaDrawing.current) return
    e.preventDefault()
    const ctx = firmaCanvasRef.current?.getContext('2d')
    if (!ctx) return
    const pt = firmaGetPoint(e)
    ctx.beginPath()
    ctx.moveTo(firmaLastPt.current.x, firmaLastPt.current.y)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    firmaLastPt.current = pt
    if (!firmaStrokes) setFirmaStrokes(true)
  }
  const firmaEnd = () => { firmaDrawing.current = false; firmaLastPt.current = null }
  const firmaLimpiar = () => {
    const canvas = firmaCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setFirmaStrokes(false)
    setFirmaBase64(null)
  }

  // Wizard: 3 pasos. 0 = Cliente, 1 = Plan (sub-pasos internos), 2 = Confirmar y firma.
  const [paso, setPaso] = useState(0)

  /* ══ T16-00 · EN PC NO HAY QUE HACER WIZARD ═══════════════════════════════
   *
   * Medido a 1440px antes de tocar nada: el primer paso enseñaba TRES CLIENTES
   * ocupando media pantalla, con dos tercios vacíos, y había que pulsar
   * «Continuar» dos veces para llegar a escribir el monto. Al lado, el panel de
   * la cuenta prometía «aquí verás la cuota» sin nada que enseñar todavía.
   *
   * En una pantalla ancha, elegir cliente y poner las condiciones caben juntos:
   * son los DATOS del préstamo. Confirmar sigue aparte porque es otro acto —se
   * firma— y porque ahí es donde se mira la tabla entera.
   *
   * ⚠ 1280px es `xl` de Tailwind, el mismo punto donde aparece la columna de la
   *   cuenta. Si se cambia uno hay que cambiar el otro, o el formulario se
   *   junta sin tener dónde enseñar el resultado.
   *
   * ⚠ VA POR `usePantallaAncha`, EL HOOK QUE YA HABÍA. Escribí el `matchMedia`
   *   a mano sin ver que estaba tres líneas más abajo, ya importado en este
   *   mismo archivo. Su efecto resuelve lo de siempre: leerlo al pintar hace
   *   que el servidor diga una cosa y el navegador otra, y React tira el árbol
   *   entero. El primer render dice «teléfono», que es el que no pierde nada. */
  const unaPantalla = usePantallaAncha(1280)

  // Sub-pasos del wizard de datos (paso 1)

  /* Los índices de `paso` NO cambian en PC: siguen siendo 0 · 1 · 2, y lo que
     se hace es SALTARSE el 1 —su contenido ya está pintado dentro del 0—. Así
     ningún `paso === 2` de los que hay repartidos por el archivo cambia de
     significado, que es de donde salen los fallos silenciosos. */
  const PASOS = [
    { label: 'Cliente' },
    { label: 'Condiciones' },
    { label: 'Confirmar' },
  ]
  const PASOS_PC = [
    { label: 'Datos' },
    { label: 'Confirmar' },
  ]
  /* Cliente y condiciones, en la misma pantalla. `verCondiciones` es lo único
     que se ensancha: el bloque de condiciones se pinta también en el paso 0. */
  const verCondiciones = paso === 1 || (unaPantalla && paso === 0)

  /* ── LA CABECERA ────────────────────────────────────────────────────────────
   *
   * ⚠⚠ VA AQUÍ Y NO MÁS ABAJO, Y ES LA TERCERA VEZ QUE LO APRENDO.
   *
   * Estaba después de `if (authLoading) return null` (línea ~718). Con la sesión
   * cargando, el componente salía ANTES de llamar a este hook; cuando terminaba
   * de cargar, lo llamaba. Dos renders con distinto número de hooks es el React
   * error #310, y la pantalla entera se caía:
   *
   *     «No podemos conectarnos ahora mismo» — en la pantalla con la que se
   *     crea un préstamo, la que más se usa para mover plata.
   *
   * Llegó a producción porque `next build` NO lo ve, las 2.849 pruebas tampoco
   * —ninguna monta esta pantalla— y en desarrollo la sesión suele estar ya
   * caliente, así que no se dispara. Solo aparece cargando la página de verdad.
   *
   * Y tiene que ir DESPUÉS de `paso` y `PASOS`, que es lo que lee: subirlo más
   * arriba lo rompe por la otra punta (leer una `const` antes de declararla).
   * El sitio correcto es este hueco entre las dos cosas.
   */
  /* ¿Cabe el campo grande con los atajos dentro? Va AQUÍ ARRIBA, con los demás
     hooks y antes de cualquier `return`, por lo mismo que `useCabecera`. */
  const pantallaAncha = usePantallaAncha()

  useCabecera({
    // El título dice EN QUÉ PASO SE ESTÁ, no «Nuevo préstamo»: la espina ya
    // cuenta cuántos van, y el nombre del paso es lo que le falta al que teclea.
    //
    // ⚠ EN PC LOS PASOS SON OTROS. Con `PASOS[paso]` la cabecera decía
    // «Cliente» mientras la espina, dos dedos más abajo, decía «Datos» y el
    // formulario entero estaba en pantalla: dos nombres para lo mismo.
    titulo: (unaPantalla ? (paso === 0 ? PASOS_PC[0] : PASOS_PC[1]) : PASOS[paso])?.label ?? 'Nuevo préstamo',
    paso: unaPantalla ? (paso === 0 ? 1 : 2) : paso + 1,
    total: unaPantalla ? PASOS_PC.length : PASOS.length,
  })

  // Pre-llenar desde cartulina si venimos de importar
  useEffect(() => {
    if (!searchParams.get('fromCartulina')) return
    try {
      const raw = sessionStorage.getItem('cf-cartulina-prestamo')
      if (!raw) return
      const datos = JSON.parse(raw)
      if (datos.montoPrestado)  setMonto(String(datos.montoPrestado))
      if (datos.tasaInteres)    setTasa(String(datos.tasaInteres))
      if (datos.frecuencia && ['diario','semanal','quincenal','mensual'].includes(datos.frecuencia)) {
        setFrecuencia(datos.frecuencia)
        setModoDiaCobro(datos.frecuencia === 'mensual' ? 'mes' : 'semana')
        const dias = datos.diasPlazo || 0
        const porPeriodo = DIAS_POR_PERIODO[datos.frecuencia] || 1
        if (dias > 0) setPlazoUnidades(String(Math.round(dias / porPeriodo)))
      } else if (datos.diasPlazo) {
        setPlazoUnidades(String(datos.diasPlazo))
      }
      if (datos.fechaInicio)    setFechaInicio(datos.fechaInicio)
      if (datos.esEnCurso)      setEsEnCurso(true)
      if (datos.yaAbonado)      setYaAbonado(String(datos.yaAbonado))
      // Limpiar después de consumir
      sessionStorage.removeItem('cf-cartulina-prestamo')
      /* Avanzar directo a las condiciones si ya tenemos cliente.
         ⚠ EN PC NO HAY PASO 1: sus condiciones se pintan dentro del 0. Saltar
         al 1 dejaba una pantalla sin el bloque de cliente y con el contador
         diciendo «Confirmar».
         ⚠ Y se lee `matchMedia` A MANO, no `unaPantalla`: este efecto corre en
         el mismo montaje que el que lo calcula, así que todavía valdría
         `false` y el salto se haría igual. */
      const cabenJuntos = typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches
      if (datos.clienteId && clienteIdParam) setPaso(cabenJuntos ? 0 : 1)
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!esOwner) return
    fetch('/api/socios').then(r => r.ok ? r.json() : []).then(d => setListaSocios(d || [])).catch(() => {})
  }, [esOwner])

  // Metodos de pago (cuentas de transferencia) para elegir de donde sale el desembolso.
  useEffect(() => {
    fetch('/api/metodos-pago').then(r => r.ok ? r.json() : []).then(d => setMetodosPago(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  // Modo de interes preferido (elegido con el asistente): pre-seleccionarlo al
  // montar para no repetir el test en cada prestamo. Se lee del dispositivo.
  useEffect(() => {
    const pref = leerModoPreferido()
    if (pref) { setModoPreferido(pref); setModoInteres(pref) }
  }, [])

  // Ultimo prestamo del cliente para "Repetir condiciones".
  const [ultimoPrestamo, setUltimoPrestamo] = useState(null)
  useEffect(() => {
    if (!clienteId) { setUltimoPrestamo(null); return }
    let cancelado = false
    fetch(`/api/prestamos/ultimo-cliente?clienteId=${encodeURIComponent(clienteId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelado) setUltimoPrestamo(d?.ultimo || null) })
      .catch(() => {})
    return () => { cancelado = true }
  }, [clienteId])

  // Cargar dias sin cobro actuales del cliente al seleccionarlo.
  useEffect(() => {
    if (!clienteId) { setDiasSinCobroCliente([]); setDiasSinCobroEditado(false); return }
    const c = clientes.find(x => x.id === clienteId)
    if (!c) return
    try {
      const arr = c.diasSinCobro ? JSON.parse(c.diasSinCobro) : []
      setDiasSinCobroCliente(Array.isArray(arr) ? arr : [])
      setDiasSinCobroEditado(false)
    } catch {
      setDiasSinCobroCliente([])
    }
  }, [clienteId, clientes])

  const repetirCondicionesUltimo = () => {
    if (!ultimoPrestamo) return
    const u = ultimoPrestamo
    setMonto(String(Math.round(u.montoPrestado)))
    setTasa(String(u.tasaInteres))
    const freq = u.frecuencia || 'diario'
    setFrecuencia(freq)
    setModoDiaCobro(freq === 'mensual' ? 'mes' : 'semana')
    setDiaCobroSemana('')
    setDiaCobroMes('')
    setDiaCobroMes2('')
    const diasPorPer = DIAS_POR_PERIODO[freq] || 1
    setPlazoUnidades(String(Math.max(1, Math.round((u.diasPlazo || 0) / diasPorPer))))
    if (u.diaCobroSemana != null) setDiaCobroSemana(String(u.diaCobroSemana))
    if (u.diaCobroMes != null) setDiaCobroMes(String(u.diaCobroMes))
  }

  // Guard de permiso
  useEffect(() => {
    if (!authLoading && !puedeCrearPrestamos) router.replace('/prestamos')
  }, [authLoading, puedeCrearPrestamos, router])

  // Cargar clientes para el selector — online + offline (cache/pendientes)
  useEffect(() => {
    const cargar = async () => {
      let lista = []
      if (navigator.onLine) {
        try {
          const r = await fetch('/api/clientes')
          const d = await r.json()
          lista = Array.isArray(d) ? d : []
        } catch {}
      }
      if (lista.length === 0) {
        // Fallback: leer cache offline (incluye pendientes inyectados optimistamente)
        try { lista = await obtenerClientesOffline() } catch {}
      }
      if (clienteIdParam) {
        const c = lista.find((x) => x.id === clienteIdParam)
        if (c) {
          setClienteNombre(c.nombre)
        } else if (navigator.onLine) {
          try {
            const r2 = await fetch(`/api/clientes/${clienteIdParam}`)
            if (r2.ok) {
              const cl = await r2.json()
              if (cl?.id) {
                const mini = { id: cl.id, nombre: cl.nombre, cedula: cl.cedula, telefono: cl.telefono, rutaId: cl.rutaId, montoMaximoPrestamo: cl.montoMaximoPrestamo ?? 0 }
                lista = [mini, ...lista]
                setClienteNombre(cl.nombre)
              }
            }
          } catch {}
        }
      }
      setClientes(lista)
    }
    cargar()
  }, [clienteIdParam])

  // Default plazo por frecuencia (en unidades de esa frecuencia)
  const defaultPlazoPorFrecuencia = (freq) => {
    if (freq === 'diario')    return '30'  // 30 dias
    if (freq === 'semanal')   return '8'   // 8 semanas
    if (freq === 'quincenal') return '4'   // 4 quincenas
    if (freq === 'mensual')   return '2'   // 2 meses
    return '30'
  }

  // Cuando cambia el modo, ajustar defaults
  const handleModoChange = (nuevoModo) => {
    setModo(nuevoModo)
    if (nuevoModo === 'mercancia') {
      setTasa('0')
      setNumCuotas('10')
      setPlazoUnidades('10')
    } else {
      setTasa('20')
      setPlazoUnidades(defaultPlazoPorFrecuencia(frecuencia))
    }
  }

  // Cuando cambia frecuencia en modo prestamo, resetear plazo al default de esa frecuencia
  const handleFrecuenciaChange = (nuevaFreq) => {
    setFrecuencia(nuevaFreq)
    setDiaCobroSemana('')
    setDiaCobroMes('')
    setDiaCobroMes2('')
    setModoDiaCobro(nuevaFreq === 'mensual' ? 'mes' : 'semana')
    if (modo === 'prestamo') {
      setPlazoUnidades(defaultPlazoPorFrecuencia(nuevaFreq))
    }
  }

  // En modo mercancia, numCuotas y plazoUnidades son lo mismo
  useEffect(() => {
    if (modo === 'mercancia') {
      setPlazoUnidades(numCuotas)
    }
  }, [numCuotas, modo])

  /* LOS DOS PRIMEROS COBROS DEL QUINCENAL, EN CRISTIANO.
   *
   * `fechaDePeriodo` cuenta las apariciones REALES de los dias de cobro desde
   * la entrega, y es la MISMA que pone las fechas en la tabla y la que contesta
   * «proximo cobro». Repetir la cuenta aqui seria abrir un calendario nuevo, y
   * de ahi salio el fallo del quincenal corrido: el prestamo decia una fecha en
   * su tabla y otra en la pantalla.
   *
   * Las fechas se leen en UTC porque asi se guardan (T05:00Z = medianoche en
   * Bogota); con la zona del navegador un cobro del dia 1 se lee dia 31. */
  const dosPrimerosCobros = useMemo(() => {
    if (frecuencia !== 'quincenal' || modoDiaCobro !== 'mes') return null
    const d1 = Number(diaCobroMes)
    if (!Number.isInteger(d1) || d1 < 1 || d1 > 31) return null
    const d2 = Number(diaCobroMes2)
    const inicio = new Date(`${fechaInicio}T05:00:00.000Z`)
    if (Number.isNaN(inicio.getTime())) return null
    const escribir = (f) => f && f.toLocaleDateString('es-CO', {
      timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
    })
    const args = {
      fechaInicio: inicio, freq: 'quincenal', diasPeriodo: 15,
      diaCobroMes: d1,
      ...(Number.isInteger(d2) && d2 >= 1 && d2 <= 31 ? { diaCobroMes2: d2 } : {}),
    }
    try {
      return [escribir(fechaDePeriodo(1, args)), escribir(fechaDePeriodo(2, args))]
    } catch { return null }
  }, [frecuencia, modoDiaCobro, diaCobroMes, diaCobroMes2, fechaInicio])

  // Cálculo en tiempo real — usa el ultimo resultado valido como fallback
  // para que el panel de resumen no desaparezca al editar campos (ej: borrar
  // temporalmente el monto o plazo antes de escribir el nuevo valor).
  const calculo = useMemo(() => {
    const m = Number(monto)
    const t = Number(tasa)
    const p = Number(plazo)
    if (!m || (tasa === '' || tasa == null) || !p || !fechaInicio) return lastValidCalculo.current
    // En mercancia el cobrador pone el PRECIO DE VENTA total; la cuota sale de
    // repartirlo en numCuotas y la ganancia = precioVenta - valor del articulo.
    // Internamente se trata como manual (cuota fija) para no tocar el resto del
    // sistema. En modo prestamo manual la cuota la fija el cobrador directo.
    let cm = 0
    if (modo === 'mercancia') {
      const pv = Number(precioVenta)
      const nc = Number(numCuotas)
      cm = pv > 0 && nc > 0 ? Math.round(pv / nc) : 0
    } else if (cuotaManualActiva) {
      cm = Number(cuotaManual)
    } else if (modoInteres === 'saldo' && Number(cuotaManual) > 0) {
      cm = Number(cuotaManual)
    }
    const resultado = calcularPrestamo({
      montoPrestado: m,
      tasaInteres: t,
      diasPlazo: p,
      fechaInicio,
      frecuencia,
      modoInteres: modo === 'mercancia' ? 'manual' : modoInteres,
      ...(cm > 0 && { cuotaManual: cm }),
      interesAdelantado: modoInteres === 'solo_interes' && interesAdelantado && !esAbierto,
      ...(esAbierto && { sinPlazo: true }),
      ...(capitalExtra.length > 0 && { capitalExtra }),
      /* ⚠ LA MISMA CONDICIÓN QUE AL GUARDAR. Esta previsualización llevaba
         `modoDiaCobro === 'mes'`, que es el interruptor de QUINCENAL: en mensual
         el día de corte nunca entraba aquí, aunque las dos vías de guardado sí
         lo mandan. O sea que el prestamista escribía «30», veía una tabla con
         otras fechas, confirmaba, y el préstamo nacía con un calendario que no
         era el que había revisado. */
      ...((frecuencia === 'mensual' || (frecuencia === 'quincenal' && modoDiaCobro === 'mes')) && diaCobroMes !== '' && { diaCobroMes: Number(diaCobroMes) }),
      ...(frecuencia === 'quincenal' && modoDiaCobro === 'mes' && diaCobroMes2 !== '' && { diaCobroMes2: Number(diaCobroMes2) }),
    })
    lastValidCalculo.current = resultado
    return resultado
  }, [monto, tasa, plazo, fechaInicio, frecuencia, modo, modoInteres, cuotaManualActiva, cuotaManual, saldoCuotaPersonalizada, precioVenta, numCuotas, interesAdelantado, esAbierto, capitalExtra, modoDiaCobro, diaCobroMes, diaCobroMes2])

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(buscadorCliente.toLowerCase()) ||
    c.cedula.includes(buscadorCliente)
  )

  const crearPrestamoRequest = async (inyeccionPrevia = null) => {
    const res = await fetch('/api/prestamos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clienteId,
        montoPrestado: Number(monto),
        tasaInteres: Number(tasa),
        diasPlazo: Number(plazo),
        fechaInicio,
        frecuencia,
        ...((frecuencia === 'semanal' || (frecuencia === 'quincenal' && modoDiaCobro === 'semana')) && diaCobroSemana !== '' && { diaCobroSemana: Number(diaCobroSemana) }),
        ...((frecuencia === 'mensual' || (frecuencia === 'quincenal' && modoDiaCobro === 'mes')) && diaCobroMes !== '' && { diaCobroMes: Number(diaCobroMes) }),
        ...(frecuencia === 'quincenal' && modoDiaCobro === 'mes' && diaCobroMes2 !== '' && { diaCobroMes2: Number(diaCobroMes2) }),
        ...(esEnCurso && Number(yaAbonado) > 0 && { yaAbonado: Number(yaAbonado) }),
        ...(esEnCurso && Number(yaAbonado) > 0 && esAbierto && { tipoAbonoPrevio }),
        ...(calculo?.cuotaDiaria > 0 && (cuotaManualActiva || modo === 'mercancia') && { cuotaManual: calculo.cuotaDiaria }),
        ...(modoInteres === 'saldo' && Number(cuotaManual) > 0 && { cuotaManual: Number(cuotaManual) }),
        modoInteres: modo === 'mercancia' ? 'manual' : modoInteres,
        ...(modo === 'mercancia' && nombreProducto.trim() && { nombreProducto: nombreProducto.trim() }),
        ...(inyeccionPrevia && { inyeccionPrevia }),
        ...(seguro && Number(montoSeguro) > 0 && { seguro: true, montoSeguro: Number(montoSeguro) }),
        ...(modoInteres === 'solo_interes' && interesAdelantado && !esAbierto && { interesAdelantado: true }),
        ...(esAbierto && { sinPlazo: true }),
        ...(capitalExtra.length > 0 && { capitalExtra }),
        ...(socioId && { socioId }),
        metodoPago: cuentaDesembolso.metodoPago,
        ...(cuentaDesembolso.metodoPago === 'transferencia' && cuentaDesembolso.metodoPagoId && { metodoPagoId: cuentaDesembolso.metodoPagoId }),
      }),
    })
    const data = await res.json()
    return { ok: res.ok, data }
  }

  const clienteSeleccionado = clientes.find(c => c.id === clienteId) ?? null

  /* Los atajos del monto se pintan DENTRO del campo cuando hay sitio y debajo
     cuando no, así que se declaran una vez y se colocan en los dos sitios. Si se
     escriben dos veces, un día se cambia uno y el otro se queda como estaba. */
  const atajosDeMonto = [50000, 100000, 200000, 500000, 1000000].map((v) => (
    <button key={v} type="button" onClick={() => setMonto(String(v))}
      className="px-2.5 h-7 rounded-lg text-[11px] font-semibold transition-all shrink-0"
      style={String(monto) === String(v)
        ? { background: 'color-mix(in srgb, var(--cf-gold) 15%, transparent)', border: '1px solid var(--cf-gold)', color: 'var(--cf-gold)' }
        : { background: 'var(--cf-fill)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink-3)' }}
    >{v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}k`}</button>
  ))

  // Sobre saldo con una cuota que no cubre ni el interes del primer periodo: el
  // prestamo no amortiza nunca (el capital se queda quieto y todo se apila en la
  // ultima cuota). No se deja avanzar hasta corregirla.
  const cuotaInsuficiente = !!calculo?.cuotaInsuficiente

  // ── EL AVISO ESPERA A QUE TERMINE DE ESCRIBIR ──
  //
  // `cuotaInsuficiente` es cierto desde la PRIMERA tecla: quien va a escribir
  // «300.000» pasa por «3», «30», «300»… y con todos ellos la cuota no cubre el
  // interes. Asi que el recuadro rojo «Con esa cuota la deuda nunca baja» salta
  // mientras teclea, en un prestamo que va a quedar perfectamente bien.
  //
  // Lo grabo un dueño en video y me hizo diagnosticar mal: vi el aviso con
  // «$ 3» en el campo y lo di por un fallo de calculo. No lo era —el aviso es
  // correcto para esa cifra— pero acusa a quien todavia no ha terminado.
  //
  // ⚠ SOLO SE RETRASA EL AVISO, NO EL BLOQUEO. `puedeAvanzarPaso` sigue leyendo
  // `cuotaInsuficiente` sin retardo: si de verdad la cuota no alcanza, el boton
  // no se habilita ni por un instante. Lo que espera es el rojo en pantalla.
  const [avisoCuotaVisible, setAvisoCuotaVisible] = useState(false)
  useEffect(() => {
    if (!cuotaInsuficiente) { setAvisoCuotaVisible(false); return }
    const t = setTimeout(() => setAvisoCuotaVisible(true), 900)
    return () => clearTimeout(t)
  }, [cuotaInsuficiente, cuotaManual])


  // ── UNA SOLA COMPROBACION, NO CINCO ──
  //
  // Habia dos funciones: una por sub-paso y otra por paso. Con las condiciones
  // en una pantalla, la del paso ya cubre casi todo —monto, plazo, fecha y que
  // el calculo salga— y solo faltaba subir lo especifico de mercancia, que
  // vivia en la del sub-paso 0.
  /* Lo que hace falta para que las condiciones estén bien puestas. Estaba
     escrito dentro del `if (paso === 1)` de abajo, y en PC hace falta también
     en el 0: copiarlo habría sido tener dos verdades que se separan al primer
     cambio.

     ⚠ Va ANTES de `puedeAvanzarPaso`, que la llama. Las dos son `const`, así
     que solo se leen al pintar y el orden no rompe nada hoy; escrito al revés
     sí rompería el día que alguien la llame desde arriba. */
  const condicionesListas = () => {
    if (clienteSeleccionado?.montoMaximoPrestamo > 0 && Number(monto) > clienteSeleccionado.montoMaximoPrestamo) return false
    // Mercancia: se vende mas caro de lo que costo, y en un numero de cuotas.
    // Sin esto se podia «vender» con perdida y el calculo salia en negativo.
    if (modo === 'mercancia') {
      return Number(monto) > 0 && Number(precioVenta) > Number(monto) && Number(numCuotas) > 0 && !!calculo
    }
    /* En un abierto no hay plazo que pedir: exigirlo dejaba el botón apagado
       para siempre en el único modo que no lo necesita. */
    return Number(monto) > 0 && Number(tasa) >= 0 && (esAbierto || Number(plazoUnidades) > 0) && !!fechaInicio && !!calculo
  }

  const puedeAvanzarPaso = () => {
    if (cuotaInsuficiente) return false
    /* ⚠ EN PC EL PASO 0 LLEVA LAS DOS COSAS. Con el `return !!clienteId` de
       antes, «Revisar préstamo» se habilitaba con solo elegir cliente y saltaba
       a la firma con el monto vacío. Se comprueban las dos, no una. */
    if (paso === 0) return unaPantalla ? (!!clienteId && condicionesListas()) : !!clienteId
    if (paso === 1) return condicionesListas()
    if (paso === 2) return !!calculo
    return true
  }
  /* En PC el 1 no existe: su contenido vive dentro del 0. Saltárselo aquí, y no
     esconder el botón, es lo que evita que «Atrás» devuelva a una pantalla en
     blanco. */
  const irAlSiguientePaso = () => {
    if (!puedeAvanzarPaso()) return
    setPaso(p => (unaPantalla && p === 0 ? 2 : Math.min(PASOS.length - 1, p + 1)))
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const irAlPasoAnterior = () => {
    setPaso(p => (unaPantalla && p === 2 ? 0 : Math.max(0, p - 1)))
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  useEffect(() => {
    if (paso === 2) setTimeout(setupFirmaCanvas, 80)
  }, [paso, setupFirmaCanvas])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!clienteId)  { setError('Selecciona un cliente'); return }
    if (!monto)      { setError('Ingresa el monto'); return }
    if (!calculo)    { setError('Verifica los datos del préstamo'); return }
    if (esEnCurso && Number(yaAbonado) > calculo.totalAPagar) {
      setError('El abono no puede ser mayor al total a pagar'); return
    }

    setLoading(true)
    setError('')

    const payloadOffline = {
      clienteId,
      montoPrestado: Number(monto),
      tasaInteres: Number(tasa),
      diasPlazo: Number(plazo),
      fechaInicio,
      frecuencia,
      ...((frecuencia === 'semanal' || (frecuencia === 'quincenal' && modoDiaCobro === 'semana')) && diaCobroSemana !== '' && { diaCobroSemana: Number(diaCobroSemana) }),
      ...((frecuencia === 'mensual' || (frecuencia === 'quincenal' && modoDiaCobro === 'mes')) && diaCobroMes !== '' && { diaCobroMes: Number(diaCobroMes) }),
      ...(frecuencia === 'quincenal' && modoDiaCobro === 'mes' && diaCobroMes2 !== '' && { diaCobroMes2: Number(diaCobroMes2) }),
      ...(esEnCurso && Number(yaAbonado) > 0 && { yaAbonado: Number(yaAbonado) }),
      ...(esEnCurso && Number(yaAbonado) > 0 && esAbierto && { tipoAbonoPrevio }),
      ...(calculo?.cuotaDiaria > 0 && (cuotaManualActiva || modo === 'mercancia') && { cuotaManual: calculo.cuotaDiaria }),
      ...(modoInteres === 'saldo' && Number(cuotaManual) > 0 && { cuotaManual: Number(cuotaManual) }),
      modoInteres: modo === 'mercancia' ? 'manual' : modoInteres,
      ...(modo === 'mercancia' && nombreProducto.trim() && { nombreProducto: nombreProducto.trim() }),
      ...(seguro && Number(montoSeguro) > 0 && { seguro: true, montoSeguro: Number(montoSeguro) }),
      ...(socioId && { socioId }),
      metodoPago: cuentaDesembolso.metodoPago,
      ...(cuentaDesembolso.metodoPago === 'transferencia' && cuentaDesembolso.metodoPagoId && { metodoPagoId: cuentaDesembolso.metodoPagoId }),
    }

    // Offline: encolar sin intentar fetch (evita esperar timeout)
    // Volvemos a /prestamos (que ya está cacheado) en vez de al detalle por
    // tempId — esa URL no está en cache del SW y mostraría "Sin conexion".
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await guardarPrestamoPendiente(payloadOffline)
        try { sessionStorage.setItem('cf-toast', 'Préstamo guardado. Se sincronizará al volver online.') } catch {}
        router.push('/prestamos')
        return
      } catch {
        setError('No se pudo guardar offline.')
        setLoading(false)
        return
      }
    }

    try {
      const { ok, data } = await crearPrestamoRequest()
      if (!ok) {
        if (data?.capitalInsuficiente) {
          setModalInyeccion({
            faltante: Number(data.faltante) || 0,
            saldoActual: Number(data.saldoActual) || 0,
            montoInyeccion: String(Number(data.faltante) || 0),
            descripcion: '',
          })
          return
        }
        setError(data?.error ?? 'Error al crear el préstamo')
        return
      }
      // Subir firma si el cliente firmo en el canvas
      const firmaData = firmaStrokes ? firmaCanvasRef.current?.toDataURL('image/png') : null
      if (firmaData && data.id) {
        try {
          await fetch(`/api/prestamos/${data.id}/firma`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firma: firmaData }),
          })
        } catch {}
      }
      // Si el usuario edito los dias sin cobro del cliente desde aqui,
      // sincronizar la ficha del cliente.
      if (diasSinCobroEditado) {
        try {
          await fetch(`/api/clientes/${clienteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ diasSinCobro: diasSinCobroCliente }),
          })
        } catch {}
      }
      if (data.pendienteAprobacion) {
        try { sessionStorage.setItem('cf-toast', 'Solicitud enviada. El administrador debe aprobar el prestamo.') } catch {}
      }
      // ?nuevo=1 hace que el detalle abra el WhatsApp de "Credito aprobado".
      // Solo si el prestamo quedo activo: si esta pendiente de aprobacion, todavia
      // no hay credito que anunciar.
      router.push(`/prestamos/${data.id}${data.pendienteAprobacion ? '' : '?nuevo=1'}`)
    } catch {
      if (!navigator.onLine) {
        try {
          await guardarPrestamoPendiente(payloadOffline)
          try { sessionStorage.setItem('cf-toast', 'Préstamo guardado. Se sincronizará al volver online.') } catch {}
          router.push('/prestamos')
          return
        } catch {}
      }
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const confirmarInyeccionYCrear = async () => {
    if (!modalInyeccion) return
    const monto = Number(modalInyeccion.montoInyeccion)
    if (!Number.isFinite(monto) || monto <= 0) {
      setError('El monto de la inyección debe ser mayor a 0')
      return
    }
    setInyectando(true)
    setError('')
    try {
      const { ok, data } = await crearPrestamoRequest({
        monto,
        descripcion: modalInyeccion.descripcion?.trim() || null,
      })
      if (!ok) {
        setError(data?.error ?? 'Error al crear el préstamo con inyección')
        return
      }
      setModalInyeccion(null)
      router.push(`/prestamos/${data.id}${data.pendienteAprobacion ? '' : '?nuevo=1'}`)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setInyectando(false)
    }
  }

  if (authLoading) return null
  if (!puedeCrearPrestamos) return null

  // ── Helpers de UI ─────────────────────────────────────────────
  const FRECUENCIAS = [
    { key: 'diario',    label: 'Diario' },
    { key: 'semanal',   label: 'Semanal' },
    { key: 'quincenal', label: 'Quincenal' },
    { key: 'mensual',   label: 'Mensual' },
  ]

  const DIAS_SEMANA = [
    { v: '1', l: 'Lun' }, { v: '2', l: 'Mar' }, { v: '3', l: 'Mie' },
    { v: '4', l: 'Jue' }, { v: '5', l: 'Vie' }, { v: '6', l: 'Sab' }, { v: '0', l: 'Dom' },
  ]

  const completedIndices = paso > 0 ? [0] : []

  // El `pb` de abajo reserva el hueco de la franja de acción, que es `fixed` y
  // no ocupa sitio en el flujo. Eran `pb-44`(176) de cuando la cuota flotaba en
  // su propia caja aparte; ahora la franja es UNA pieza y mide ~134 con la
  // cuota dentro. Se deja holgura: el último campo pegado al filete se lee como
  // si estuviera cortado.
  /* La cabecera se llama ARRIBA, antes de los `return null` de permisos: aquí
     abajo provocaba el React error #310 y tumbaba la pantalla entera. El porqué,
     donde se llama. */

  return (
    /* En móvil sigue siendo la columna de 672px de siempre. En escritorio se
       ensancha para que quepan las dos columnas de T16-00; el formulario NO
       crece, se queda en sus 672px, y lo que aparece al lado es la cuenta. */
    <div className="max-w-2xl xl:max-w-[1076px] mx-auto pb-40 lg:pb-36">
      {/* Stepper */}
      {/* Sin contador: el de dentro del paso 2 («Paso 1 de 5») es el que avanza
          al pulsar «Continuar». Con los dos, la pantalla decia «PASO 2 DE 3» y
          «Paso 1 de 5» a la vez. */}
      {/* ⚠ EL CONTADOR TAMBIÉN CAMBIA. En PC son DOS pasos, no tres: decir
          «paso 1 de 3» y no tener nunca un paso 2 al que ir es prometer una
          pantalla que no existe. `paso` sigue valiendo 0·1·2 por dentro; aquí
          se traduce, que es el único sitio donde el número se lee. */}
      <Stepper
        steps={unaPantalla ? PASOS_PC : PASOS}
        activeIndex={unaPantalla ? (paso === 0 ? 0 : 1) : paso}
        completedIndices={completedIndices}   /* siempre es [0] o [], vale igual en los dos */
        contador={false}
        onChange={(idx) => {
          const destino = unaPantalla ? (idx === 0 ? 0 : 2) : idx
          if (destino <= paso) setPaso(destino)
        }}
      />

      {/* ══ T16-00 · LAS DOS COLUMNAS ══
          La lámina de escritorio: el formulario a la izquierda y la cuenta a la
          derecha, recalculándose al escribir. «Subir el interés de 20 a 25 mueve
          la cuota, la ganancia y las ocho filas mientras se decide — que es
          exactamente lo que el dueño hace hoy con una calculadora al lado.»

          Antes esto era un `aside` con `position: fixed` colgado del borde
          derecho. Era un atajo mío para no tocar los tres pasos, y se notaba:
          flotaba sin relación con nada y SE MONTABA ENCIMA de la pastilla
          «Repetir anterior», que salía cortada a media palabra. Ahora es una
          columna de verdad, así que ni tapa ni la tapan.

          `items-start` + `sticky` en el panel: la columna izquierda mide 2.654px
          y la derecha 600, y sin eso el panel se estira hasta abajo y la cuenta
          queda fuera de la vista justo cuando se está tecleando el monto. */}
      <div className="xl:grid xl:grid-cols-[minmax(0,672px)_380px] xl:gap-6 xl:items-start">
        {/* ── EL FORMULARIO VA SOBRE PAPEL ──
            Los campos flotaban sueltos sobre el fondo de la app, sin nada
            detrás: «las cajitas no tienen fondo, entonces se ve un poco
            extraño». En la lámina todo el formulario descansa sobre una hoja
            blanca, y es lo que le da el peso a la columna frente al panel de la
            derecha, que también es una hoja.

            Solo desde `xl`: en el teléfono la pantalla YA es la hoja, y meter
            una tarjeta dentro de otra añade un borde que no separa nada. */}
        <div className="min-w-0 xl:rounded-[16px] xl:p-6 xl:border xl:bg-[var(--cf-card)] xl:border-[var(--cf-border)]">

      {error && (
        <div className="mt-6 rounded-[12px] px-4 py-3 text-sm"
          style={{ background: 'var(--cf-red-pill-bg)', color: 'var(--cf-red-dark)', border: '1px solid color-mix(in srgb, var(--cf-red-dark) 30%, transparent)' }}
        >
          {error}
        </div>
      )}

      {/* PASO 1 — Cliente */}
      {paso === 0 && (() => {
        const buscando = buscadorCliente.trim().length > 0
        // Recientes: los 3 ultimos creados (asumimos que `clientes` viene en
        // orden segun el API; tomamos los primeros 3 como aproximacion de "recientes").
        const recientes = clientes.slice(0, 3)

        const renderClienteRow = (c, mostrarCheck = true) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setClienteId(c.id)
              setClienteNombre(c.nombre)
              setBuscadorCliente('')
            }}
            className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-[12px] border transition-all"
            style={{
              background: c.id === clienteId
                ? 'color-mix(in srgb, var(--cf-gold) 12%, transparent)'
                : 'var(--cf-fill)',
              borderColor: c.id === clienteId
                ? 'var(--cf-gold)'
                : 'var(--cf-border)',
            }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
              style={{
                background: 'color-mix(in srgb, var(--cf-gold) 18%, transparent)',
                color: 'var(--cf-gold)',
              }}
            >
              {c.nombre?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: 'var(--cf-ink)' }}>{c.nombre}</p>
              <p className="text-xs truncate" style={{ color: 'var(--cf-ink-3)' }}>{abreviaturaDocumento()} {c.cedula}</p>
            </div>
            {mostrarCheck && c.id === clienteId && (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" style={{ color: 'var(--cf-gold)' }}>
                <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-7.997 8a1 1 0 01-1.414 0L3.296 10.71a1 1 0 011.415-1.415l3.29 3.29 7.288-7.295a1 1 0 011.415 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        )

        return (
          <section className="mt-8">
            <h2 className="text-[22px] font-bold leading-tight" style={{ color: 'var(--cf-ink)' }}>
              {clienteSeleccionado ? '¿Continuamos con este cliente?' : 'Elige el cliente'}
            </h2>
            <p className="text-sm mt-1.5" style={{ color: 'var(--cf-ink-3)' }}>
              {clienteSeleccionado
                ? 'Si necesitas cambiarlo, usa el buscador.'
                : 'Busca por nombre o cédula, o elige uno de los recientes.'}
            </p>

            {/* Cliente ya seleccionado: card grande en lugar de fila pequena */}
            {clienteSeleccionado && !buscando && (
              <div
                className="mt-7 rounded-[20px] p-4 flex items-center gap-3"
                style={{
                  background: 'color-mix(in srgb, var(--cf-gold) 8%, var(--cf-card))',
                  border: '1.5px solid var(--cf-gold)',
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 text-base font-bold"
                  style={{
                    background: 'color-mix(in srgb, var(--cf-gold) 22%, transparent)',
                    color: 'var(--cf-gold)',
                  }}
                >
                  {clienteSeleccionado.nombre?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base truncate" style={{ color: 'var(--cf-ink)' }}>
                    {clienteSeleccionado.nombre}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--cf-ink-3)' }}>
                    {abreviaturaDocumento()} {clienteSeleccionado.cedula}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setClienteId(''); setClienteNombre('') }}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-[8px] transition-colors"
                  style={{ color: 'var(--cf-ink-3)', background: 'var(--cf-fill)' }}
                >
                  Cambiar
                </button>
              </div>
            )}

            {clienteSeleccionado?.montoMaximoPrestamo > 0 && (
              <div
                className="mt-3 rounded-[12px] px-3.5 py-2.5 flex items-center gap-2.5"
                style={{ background: 'color-mix(in srgb, var(--cf-gold-dark) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--cf-gold-dark) 25%, transparent)' }}
              >
                <svg className="w-4 h-4 shrink-0" style={{ color: 'var(--cf-gold-dark)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Tope de prestamo</p>
                  <p className="text-sm font-bold font-mono-display" style={{ color: 'var(--cf-gold-dark)' }}>
                    {formatMoney(clienteSeleccionado.montoMaximoPrestamo)}
                  </p>
                </div>
              </div>
            )}

            {/* Buscador */}
            <div className="mt-7">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-4 h-4 pointer-events-none"
                  style={{ color: 'var(--cf-ink-3)' }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  value={buscadorCliente}
                  onChange={(e) => setBuscadorCliente(e.target.value)}
                  placeholder="Buscar por nombre o cédula"
                  className="w-full h-12 pl-10 pr-4 rounded-[12px] border text-sm focus:outline-none transition-colors"
                  style={{
                    background: 'var(--cf-fill)',
                    borderColor: 'var(--cf-border)',
                    color: 'var(--cf-ink)',
                  }}
                />
              </div>
            </div>

            {/* RESULTADOS: solo si esta buscando */}
            {buscando && (
              <div className="mt-3 space-y-1.5">
                {clientesFiltrados.length === 0 ? (
                  /* No estaba en la lista y no había nada que hacer: «Sin
                     resultados» y a buscarse la vida. El cliente al que le vas a
                     prestar puede ser nuevo — de hecho es el caso normal cuando
                     alguien llega por primera vez— y desde aquí no se podía
                     crear salvo que la cartera estuviera vacía del todo. */
                  <div className="text-center py-8">
                    <p className="text-sm mb-4" style={{ color: 'var(--cf-ink-3)' }}>
                      Nadie con «{buscadorCliente.trim()}» en tu cartera.
                    </p>
                    <Link href="/clientes/nuevo"
                      className="inline-flex h-11 px-5 rounded-[12px] items-center justify-center text-sm font-bold transition-all active:scale-[0.98]"
                      style={{ background: 'var(--cf-gold)', color: '#111' }}>
                      Crear este cliente
                    </Link>
                  </div>
                ) : (
                  clientesFiltrados.slice(0, 8).map((c) => renderClienteRow(c))
                )}
              </div>
            )}

            {/* RECIENTES: solo si NO esta buscando y no hay cliente seleccionado (o hay uno pero queremos mostrar opciones rapidas) */}
            {!buscando && !clienteSeleccionado && recientes.length > 0 && (
              <div className="mt-5">
                <p className="text-[10px] font-extrabold uppercase tracking-[.07em] mb-2" style={{ color: 'var(--cf-ink-3)' }}>
                  Recientes
                </p>
                <div className="space-y-1.5">
                  {recientes.map((c) => renderClienteRow(c, false))}
                </div>
              </div>
            )}

            {/* Antes esto era un parrafo suelto sin ningun boton. Se llega aca
                desde tres lugares distintos (el vacio de /prestamos, el nav de
                abajo y el CTA del dashboard) y el usuario tenia que adivinar
                solo que debia irse a /clientes/nuevo. */}
            {!buscando && !clienteSeleccionado && recientes.length === 0 && (
              <div className="text-center py-8 mt-3">
                <p className="text-sm mb-4" style={{ color: 'var(--cf-ink-3)' }}>
                  Todavía no tienes clientes. Un préstamo siempre va a nombre de alguien.
                </p>
                <div className="flex flex-col gap-2 max-w-[260px] mx-auto">
                  <Link href="/clientes/nuevo"
                    className="w-full h-11 rounded-[12px] flex items-center justify-center text-sm font-bold transition-all active:scale-[0.98]"
                    style={{ background: 'var(--cf-gold)', color: '#111' }}>
                    Crear mi primer cliente
                  </Link>
                  <Link href="/migrador"
                    className="w-full h-11 rounded-[12px] flex items-center justify-center text-sm font-medium border transition-all active:scale-[0.98]"
                    style={{ borderColor: 'var(--cf-border)', color: 'var(--cf-ink-2)' }}>
                    Pasar mi cuaderno completo
                  </Link>
                </div>
              </div>
            )}
          </section>
        )
      })()}

      {/* PASO 2 — Wizard guiado con sub-pasos */}
      {/* T16-00: en PC este bloque va DEBAJO del de cliente, no en otra pantalla. */}
      {/* En PC este bloque va pegado al de cliente, en la misma hoja: sin una
          raya se lee como un solo texto que no acaba. En el teléfono no hace
          falta, porque es la pantalla siguiente. */}
      {verCondiciones && (
        <section className={`mt-8 space-y-6 ${verCondiciones && paso === 0 ? 'xl:mt-8 xl:pt-8 xl:border-t xl:border-[var(--cf-border)]' : ''}`}>
          {/* Barra de progreso del sub-paso */}
          <div>
            <div className="flex items-center justify-between mb-2">
              {/* ⚠ EL NOMBRE, SOLO CUANDO NO SE VE YA. Servía de recordatorio de
                  para quién es el préstamo cuando el cliente estaba en la
                  pantalla ANTERIOR. En PC está tres dedos más arriba y
                  resaltado, y sin cliente elegido salía un «Cliente» suelto en
                  mitad del formulario que no era ni título ni dato. */}
              <p className="text-sm font-semibold" style={{ color: 'var(--cf-ink)' }}>
                {unaPantalla && paso === 0 ? '' : (clienteNombre || 'Cliente')}
              </p>
              {ultimoPrestamo && (
                <button
                  type="button"
                  onClick={() => repetirCondicionesUltimo()}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: 'color-mix(in srgb, var(--cf-gold) 12%, transparent)', color: 'var(--cf-gold)' }}
                >
                  Repetir anterior
                </button>
              )}
            </div>
          </div>

          {/* SUB-PASO 0: Tipo + Monto */}
          {(
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--cf-ink)' }}>
                  {modo === 'mercancia' ? '¿Cuánto vale el artículo?' : '¿Cuánto le prestas?'}
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--cf-ink-3)' }}>
                  {modo === 'mercancia' ? 'El valor real de la mercancía.' : 'El dinero que le entregas al cliente.'}
                </p>
              </div>

              {/* ── PRÉSTAMO O MERCANCÍA ──
                  Se quedaron del lenguaje viejo mientras todo lo de alrededor
                  cambiaba: píldoras de 22px y 44 de alto al lado de la
                  frecuencia, que es rectangular de 12px y 48. Parecían de otra
                  pantalla, y el reporte fue exacto: «no rediseñaste esos
                  botones».

                  Y en escritorio casi no se veían. El inactivo iba sobre
                  `--cf-surface`, que en claro es blanco: en cuanto puse la hoja
                  blanca detrás, «Mercancía» se quedó sin nada que lo separara
                  del fondo. Eso lo rompí yo al meter el papel.

                  ⚠ `rounded-[12px]` A MANO, no `rounded-xl`: el tema redefine
                  `--radius-xl` a 22px, así que `rounded-xl` NO son los 12 de
                  Tailwind. Ninguno de los radios del tema (11/14/18/22) está en
                  el canon, que manda 8/10/12/16/20.

                  Mismo patrón que la frecuencia a propósito: son dos preguntas
                  de la misma clase —elegir una de varias— y con dos lenguajes
                  distintos se leen como si fueran cosas distintas. */}
              <div className="grid grid-cols-2 gap-2">
                {[['prestamo', 'Préstamo'], ['mercancia', 'Mercancía']].map(([clave, etiqueta]) => {
                  const activo = modo === clave
                  return (
                    <button key={clave} type="button" onClick={() => handleModoChange(clave)}
                      className="h-12 rounded-[12px] border text-sm font-semibold transition-all"
                      style={activo
                        ? { background: 'var(--cf-ink)', borderColor: 'var(--cf-ink)', color: 'var(--cf-card)' }
                        : { background: 'var(--cf-card)', borderColor: 'var(--cf-border)', color: 'var(--cf-ink-2)' }}
                    >{etiqueta}</button>
                  )
                })}
              </div>

              {modo === 'mercancia' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>
                    Nombre del producto <span style={{ opacity: 0.6 }}>(opcional)</span>
                  </label>
                  <div className="mt-1.5">
                    <Input type="text" value={nombreProducto} onChange={(e) => setNombreProducto(e.target.value)} placeholder="Ej: Gorra, Reloj Casio..." maxLength={100} />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>
                  {modo === 'mercancia' ? 'Valor del artículo' : 'Monto del préstamo'}
                </label>
                {/* ── EL MONTO, A TAMAÑO DE PROTAGONISTA (T16-00) ──
                    Es la cifra alrededor de la que gira la pantalla entera y
                    salía con el mismo tamaño que la cédula. La lámina lo pone a
                    34px sobre papel blanco, y mete los atajos DENTRO del propio
                    campo en vez de dejarlos sueltos debajo.

                    En pantalla estrecha los atajos van fuera: dentro de un
                    campo de 340px no caben cinco pastillas sin estrujar la
                    cifra, que es justo lo que se está mirando. */}
                <div className="mt-2" style={{ '--cf-hueco-sufijo': '268px' }}>
                  <MoneyInput
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    placeholder="0"
                    tamano="grande"
                    sufijo={pantallaAncha ? atajosDeMonto : null}
                  />
                </div>
                {!pantallaAncha && (
                  <div className="flex gap-1.5 flex-wrap mt-2">{atajosDeMonto}</div>
                )}
                {clienteSeleccionado?.montoMaximoPrestamo > 0 && Number(monto) > clienteSeleccionado.montoMaximoPrestamo && (
                  <p className="text-xs mt-2 font-semibold" style={{ color: 'var(--cf-red-dark)' }}>
                    Supera el tope de {formatMoney(clienteSeleccionado.montoMaximoPrestamo)}
                  </p>
                )}
                {/* ── LO QUE QUEDA EN CAJA DESPUÉS (T16-00) ──
                    Es la pregunta que el prestamista se hace justo aquí: si
                    presta esto, ¿con qué se queda? Antes había que salir a
                    Capital, mirarlo y volver.

                    En rojo si el préstamo lo deja en negativo — prestar más de
                    lo que hay es una decisión válida (se repone), pero tiene
                    que verse ANTES de darle a crear, no después en la caja. */}
                {saldoCaja != null && Number(monto) > 0 && (() => {
                  const queda = Math.round(saldoCaja - Number(monto))
                  return (
                    <p className="text-[11.5px] mt-2" style={{ color: queda < 0 ? 'var(--cf-red-dark)' : 'var(--cf-ink-3)' }}>
                      {queda < 0
                        ? `Te quedarías en ${formatMoney(queda)}: es más de lo que hay en caja.`
                        : `Te quedan ${formatMoney(queda)} disponibles en caja después de este préstamo.`}
                    </p>
                  )
                })()}
              </div>

              {modo === 'mercancia' && (
                <>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Número de cuotas</label>
                    <Input type="number" inputMode="numeric" value={numCuotas} onChange={(e) => setNumCuotas(e.target.value)} placeholder="10" suffix="cuotas" />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Precio de venta</label>
                    <div className="mt-1.5"><MoneyInput value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} placeholder="Ej: 120.000" /></div>
                    <p className="text-[10px] mt-1" style={{ color: 'var(--cf-ink-3)' }}>Tu ganancia = precio de venta - valor del artículo.</p>
                    {Number(precioVenta) > 0 && Number(numCuotas) > 0 && Number(monto) > 0 && (
                      <div className="mt-2 rounded-xl border px-3 py-2 flex items-center justify-between gap-3"
                        style={{ background: 'color-mix(in srgb, var(--cf-green-dark) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--cf-green-dark) 30%, transparent)' }}>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Cuota</p>
                          <p className="text-sm font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>{formatMoney(Math.round(Number(precioVenta) / Number(numCuotas)))}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Ganancia</p>
                          <p className="text-sm font-bold font-mono-display" style={{ color: 'var(--cf-green-dark)' }}>
                            {formatMoney(Number(precioVenta) - Number(monto))}
                            {Number(monto) > 0 ? ` (${Math.round(((Number(precioVenta) - Number(monto)) / Number(monto)) * 100)}%)` : ''}
                          </p>
                        </div>
                      </div>
                    )}
                    {Number(precioVenta) > 0 && Number(precioVenta) <= Number(monto) && (
                      <p className="text-[10px] mt-1.5 font-semibold" style={{ color: 'var(--cf-red-dark)' }}>El precio de venta debe ser mayor al valor del artículo.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* SUB-PASO 1: Frecuencia de cobro */}
          {(
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--cf-ink)' }}>Cada cuanto cobra?</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--cf-ink-3)' }}>Elige la frecuencia con que el cliente paga las cuotas.</p>
              </div>

              {/* ── LAS CUATRO, EN UNA FILA (T16-00) ──
                  Eran cuatro tarjetas de 672px de ancho para tres palabras, con
                  su bolita de radio y una frase explicando qué es «semanal».
                  Apiladas sumaban 340px de alto ellas solas.

                  La lámina las pone como pastillas en una fila y la elegida en
                  NEGRO —no en dorado—: el oro está reservado a la acción de
                  seguir, y aquí lo que hace falta es que se vea cuál está
                  puesta de un vistazo. La descripción baja a un renglón debajo,
                  y solo la de la elegida: las otras tres no hacen falta hasta
                  que se tocan.

                  Por debajo de `sm` van dos y dos, que a 393px es lo que cabe
                  sin que «Quincenal» se parta. */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FRECUENCIAS.map(f => {
                  const activo = frecuencia === f.key
                  return (
                    <button key={f.key} type="button" onClick={() => handleFrecuenciaChange(f.key)}
                      className="h-12 rounded-[12px] text-sm font-semibold transition-all"
                      style={activo
                        ? { background: 'var(--cf-ink)', border: '1px solid var(--cf-ink)', color: 'var(--cf-card)' }
                        : { background: 'var(--cf-card)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink-2)' }}>
                      {f.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[12px] -mt-3" style={{ color: 'var(--cf-ink-3)' }}>
                {{
                  diario: 'Cobra todos los días hábiles.',
                  semanal: 'Cobra una vez por semana.',
                  quincenal: 'Cobra cada dos semanas.',
                  mensual: 'Cobra una vez al mes.',
                }[frecuencia]}
              </p>

              {/* Dia ancla para semanal */}
              {frecuencia === 'semanal' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Que dia cobras?</label>
                  <p className="text-[10px] mt-0.5 mb-1.5" style={{ color: 'var(--cf-ink-3)' }}>Fija el dia de la semana. "Auto" usa el dia de inicio.</p>
                  {/* El día se queda en oro y no en tinta: es una elección DE
                      DENTRO de «semanal», no de las de arriba. Si todo se marca
                      igual de fuerte, deja de leerse qué depende de qué. */}
                  <div className="grid grid-cols-7 gap-1">
                    <button type="button" onClick={() => setDiaCobroSemana('')}
                      className="h-10 rounded-[10px] border text-[10px] font-semibold transition-all"
                      style={estiloOpcionMenor(diaCobroSemana === '')}>Auto</button>
                    {DIAS_SEMANA.slice(0, 6).map(d => (
                      <button key={d.v} type="button" onClick={() => setDiaCobroSemana(d.v)}
                        className="h-10 rounded-[10px] border text-[10px] font-semibold transition-all"
                        style={estiloOpcionMenor(diaCobroSemana === d.v)}>{d.l}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Dia ancla para quincenal */}
              {frecuencia === 'quincenal' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Que dia cobras?</label>
                  <div className="flex gap-1 p-1 rounded-[12px] mb-2 mt-1.5" style={{ background: 'var(--cf-fill)', border: '1px solid var(--cf-border)' }}>
                    <button type="button" onClick={() => { setModoDiaCobro('semana'); setDiaCobroMes(''); setDiaCobroMes2('') }}
                      className="flex-1 py-1.5 text-[10px] font-semibold rounded-[8px] transition-all"
                      style={modoDiaCobro === 'semana' ? { background: 'var(--cf-card)', color: 'var(--cf-gold)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } : { color: 'var(--cf-ink-3)' }}>Dia de la semana</button>
                    <button type="button" onClick={() => { setModoDiaCobro('mes'); setDiaCobroSemana('') }}
                      className="flex-1 py-1.5 text-[10px] font-semibold rounded-[8px] transition-all"
                      style={modoDiaCobro === 'mes' ? { background: 'var(--cf-card)', color: 'var(--cf-gold)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' } : { color: 'var(--cf-ink-3)' }}>Dias del mes</button>
                  </div>
                  {modoDiaCobro === 'semana' ? (
                    /* ⚠ EL MISMO SELECTOR, SEGUNDA VÍA. «Qué día cobras» sale
                       por dos caminos —desde semanal y desde quincenal— y la
                       primera vez arreglé solo el de arriba. Es el fallo que ya
                       me costó dos días con el comprobante: si algo se ve por
                       varios sitios, hay que buscarlos TODOS.

                       Y el comentario va SIN LLAVES: dentro de una rama de
                       ternario solo cabe una expresión, y `{…}` + `<div>` son
                       dos hijos sueltos. Eso tumbó la pantalla entera. */
                    <div className="grid grid-cols-7 gap-1">
                      <button type="button" onClick={() => setDiaCobroSemana('')}
                        className="h-10 rounded-[10px] border text-[10px] font-semibold transition-all"
                        style={estiloOpcionMenor(diaCobroSemana === '')}>Auto</button>
                      {DIAS_SEMANA.slice(0, 6).map(d => (
                        <button key={d.v} type="button" onClick={() => setDiaCobroSemana(d.v)}
                          className="h-10 rounded-[10px] border text-[10px] font-semibold transition-all"
                          style={estiloOpcionMenor(diaCobroSemana === d.v)}>{d.l}</button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                      <Input type="number" inputMode="numeric" value={diaCobroMes}
                        onChange={(e) => { const v = e.target.value; if (v === '' || (Number(v) >= 1 && Number(v) <= 31)) setDiaCobroMes(v) }}
                        label="Primer cobro" placeholder="Ej: 5" min={1} max={31} />
                      <Input type="number" inputMode="numeric" value={diaCobroMes2}
                        onChange={(e) => { const v = e.target.value; if (v === '' || (Number(v) >= 1 && Number(v) <= 31)) setDiaCobroMes2(v) }}
                        label="Segundo cobro" placeholder="Ej: 20" min={1} max={31} />
                      </div>
                      {/* ── LOS DOS PRIMEROS COBROS, ESCRITOS ─────────────────
                          «Escogía el día, el primer día, escogía el segundo día
                          y me mandaba para otro mes.» Pidió poder poner día Y
                          MES, y lo que necesitaba era VER en qué fechas iba a
                          cobrar: un «16» a secas no dice si cae este mes o el
                          que viene, y de eso depende si el préstamo nace en
                          mora. Poner el mes a mano sería una tercera fuente de
                          verdad para el calendario, que es de donde salió el
                          fallo que esto acompaña.

                          ⚠ SALE DE `fechaDePeriodo`, la misma que pone las
                          fechas en la tabla y la que contesta «próximo cobro».
                          Una cuenta propia aquí volvería a ser dos calendarios.

                          El mismo bloque que ya existe para mensual, que nació
                          de lo mismo: «un prestamista lo hacía a mano en cada
                          préstamo porque el sistema no se lo enseñaba». */}
                      {dosPrimerosCobros && (
                        <div className="mt-2 rounded-[10px] border p-2.5"
                          style={{ borderColor: 'var(--cf-border-soft)', background: 'var(--cf-fill)' }}>
                          <p className="text-[11px] font-semibold" style={{ color: 'var(--cf-ink-2)' }}>
                            Le cobras el {dosPrimerosCobros[0]}
                            {dosPrimerosCobros[1] ? ` y el ${dosPrimerosCobros[1]}` : ''}
                          </p>
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                            Cuenta desde el dia que entregas. Si el mes no tiene ese dia, se cobra el ultimo.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Dia ancla para mensual — solo dia del mes (diaCobroSemana no aplica) */}
              {frecuencia === 'mensual' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Que dia del mes cobras?</label>
                  <p className="text-[10px] mt-0.5 mb-1.5" style={{ color: 'var(--cf-ink-3)' }}>Si el mes no tiene ese dia, se cobra el ultimo dia disponible.</p>
                  <Input type="number" inputMode="numeric" value={diaCobroMes}
                    onChange={(e) => { const v = e.target.value; if (v === '' || (Number(v) >= 1 && Number(v) <= 31)) setDiaCobroMes(v) }}
                    placeholder="Auto (segun fecha de inicio)" min={1} max={31} />

                  {/* ── EL PRIMER COBRO, ESCRITO ────────────────────────────
                      Escribir «30» aquí no dice nada por sí solo, y de lo que
                      pasa detrás depende plata: el primer tramo casi nunca mide
                      un mes. Un prestamista lo hacía a mano en cada préstamo
                      porque el sistema no se lo enseñaba. Aquí queda la cuenta
                      hecha antes de confirmar: qué día se cobra, cuántos días
                      trae y cuánto es esa primera cuota. */}
                  {calculo?.prorrateoPrimerPeriodo && calculo.tablaAmortizacion?.[0] && (
                    <div className="mt-2 rounded-[10px] border p-2.5"
                      style={{ borderColor: 'var(--cf-border-soft)', background: 'var(--cf-fill)' }}>
                      <p className="text-[11px] font-semibold" style={{ color: 'var(--cf-ink-2)' }}>
                        Primer cobro el {new Date(calculo.primerCobro).toLocaleDateString('es-CO', {
                          timeZone: 'UTC', day: 'numeric', month: 'long',
                        })}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                        Son {calculo.diasPrimerPeriodo} dias desde que entregas, asi que esa cuota
                        trae el interes de {calculo.diasPrimerPeriodo} dias y no de un mes:{' '}
                        <span className="font-mono-display font-semibold" style={{ color: 'var(--cf-ink-2)' }}>
                          {formatMoney(calculo.tablaAmortizacion[0].cuotaTotal)}
                        </span>. Las demas van completas.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SUB-PASO 2: Interes + Plazo */}
          {(
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--cf-ink)' }}>¿Cuánto de interés?</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--cf-ink-3)' }}>Define la tasa y en cuanto tiempo paga.</p>
              </div>

              {/* ── EL INTERÉS Y EL PLAZO, UNO AL LADO DEL OTRO (T16-00) ──
                  Se leen juntos («20% a 8 semanas») y se decidían en dos filas
                  separadas, cada una de ancho completo. La lámina los pone en
                  dos columnas y con la cifra grande, porque son cifras que se
                  MIRAN, no campos que se rellenan.

                  Los atajos se quedan aunque la lámina no los dibuje: son un
                  mockup de una pantalla, no el inventario de lo que la pantalla
                  hace, y quitarlos sería perder función por parecerme a un
                  dibujo. */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Interés mensual</label>
                  <div className="mt-1.5 relative flex items-center h-[68px] rounded-[14px] px-4"
                    style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
                    <input
                      type="text" inputMode="decimal" value={tasa}
                      onChange={(e) => setTasa(soloDecimal(e.target.value))}
                      placeholder="20"
                      className="cf-campo-grande bg-transparent border-0 outline-none w-[92px] text-[30px] font-semibold tracking-[-.02em]"
                      style={{ color: 'var(--cf-ink)' }}
                    />
                    <span className="text-[18px] font-semibold -ml-1" style={{ color: 'var(--cf-ink-3)' }}>%</span>
                    {/* La lámina dice «tu valor de siempre». Lo único que sé de
                        verdad es la tasa del préstamo ANTERIOR de este cliente
                        —es lo que devuelve `ultimo-cliente`—, así que el texto
                        dice eso y no algo que no puedo comprobar. */}
                    {ultimoPrestamo?.tasaInteres != null
                      && String(ultimoPrestamo.tasaInteres) === String(tasa) && (
                      <span className="absolute right-4 text-[11.5px]" style={{ color: 'var(--cf-ink-3)' }}>
                        igual que el anterior
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {[5, 10, 15, 20, 25, 30].map(v => (
                      <button key={v} type="button" onClick={() => setTasa(String(v))}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                        style={String(v) === tasa
                          ? { background: 'var(--cf-gold)', color: '#000' }
                          : { background: 'var(--cf-card)', color: 'var(--cf-ink-3)', border: '1px solid var(--cf-border)' }
                        }
                      >{v}%</button>
                    ))}
                  </div>
                </div>

                {/* ⚠ EN UN ABIERTO NO HAY CUOTAS QUE CONTAR. Pedirle un número
                    al prestamista y luego no usarlo es peor que no pedirlo: se
                    queda creyendo que su préstamo termina ahí. En su lugar se
                    dice en una línea qué va a pasar. */}
                {esAbierto ? (
                  <div className="rounded-[14px] p-3.5" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--cf-ink)' }}>Sin fecha de vencimiento</p>
                    <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--cf-ink-3)' }}>
                      {{ diario: 'Cada día', semanal: 'Cada semana', quincenal: 'Cada quincena', mensual: 'Cada mes' }[frecuencia] || 'Cada mes'} se le cobra el interés
                      {calculo?.cuotaDiaria ? ` de ${formatMoney(calculo.cuotaDiaria)}` : ''} y el capital queda quieto.
                      Cuando el cliente abone a capital, el interés del período siguiente baja solo.
                      El préstamo se cierra cuando el capital llegue a cero.
                    </p>
                  </div>
                ) : (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Cuántas cuotas</label>
                  <div className="mt-1.5 flex items-center h-[68px] rounded-[14px] pl-4 pr-2.5 gap-2"
                    style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
                    <input
                      type="text" inputMode="numeric" value={plazoUnidades}
                      onChange={(e) => setPlazoUnidades(e.target.value.replace(/\D/g, ''))}
                      className="cf-campo-grande bg-transparent border-0 outline-none w-[66px] text-[30px] font-semibold tracking-[-.02em]"
                      style={{ color: 'var(--cf-ink)' }}
                    />
                    <span className="text-[13.5px] flex-1 min-w-0 truncate" style={{ color: 'var(--cf-ink-3)' }}>
                      {UNIDAD_PLAZO[frecuencia]}
                    </span>
                    {/* Sumar y restar de uno en uno: el plazo se afina, no se
                        teclea de cero. `type="button"` a propósito — dentro de un
                        formulario, un botón sin tipo envía. */}
                    {[['−', -1], ['+', 1]].map(([signo, paso]) => (
                      <button key={signo} type="button"
                        onClick={() => setPlazoUnidades(String(Math.max(1, (Number(plazoUnidades) || 0) + paso)))}
                        className="w-10 h-10 rounded-[10px] text-[17px] font-semibold shrink-0 transition-all"
                        style={{ background: 'var(--cf-fill)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink-2)' }}
                        aria-label={paso > 0 ? 'Una cuota más' : 'Una cuota menos'}
                      >{signo}</button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {(frecuencia === 'diario' ? [15, 20, 25, 30, 45, 60]
                      : frecuencia === 'semanal' ? [4, 6, 8, 10, 12, 16]
                      : frecuencia === 'quincenal' ? [2, 3, 4, 6, 8, 12]
                      : [1, 2, 3, 4, 6, 12]
                    ).map(v => (
                      <button key={v} type="button" onClick={() => setPlazoUnidades(String(v))}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                        style={String(v) === plazoUnidades
                          ? { background: 'var(--cf-gold)', color: '#000' }
                          : { background: 'var(--cf-card)', color: 'var(--cf-ink-3)', border: '1px solid var(--cf-border)' }
                        }
                      >{v}</button>
                    ))}
                    {/* ── «NO SÉ» ES UNA RESPUESTA, Y AQUÍ ES LA CORRECTA ──────
                        Reportado por Rhoders el 19 ago 2026, en este mismo paso:
                        «a cuántas cuotas debería salir uno que sea indefinido,
                        porque no sé cuándo me va a pagar» · «no sé cuántas
                        cuotas ponerle».

                        El préstamo abierto YA existe y esta pantalla ya sabe
                        enseñarlo —la rama de arriba— pero se enciende con el
                        modo, que se elige en el paso SIGUIENTE, y con un
                        interruptor que está en el resumen. Así que en el momento
                        de la pregunta la única salida era inventarse un número.
                        Le tocó preguntar por WhatsApp.

                        Deja el Globo puesto, que es el único modo que admite no
                        tener plazo; si después elige otro, la pregunta vuelve. */}
                    <button type="button"
                      onClick={() => { setModoInteres('solo_interes'); setSinPlazo(true); setInteresAdelantado(false) }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                      style={{ background: 'var(--cf-card)', color: 'var(--cf-ink-3)', border: '1px dashed var(--cf-border-strong)' }}
                    >No sé</button>
                  </div>
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--cf-ink-3)' }}>
                    Si no sabes cuándo te paga, toca <span style={{ fontWeight: 600 }}>No sé</span>: el
                    préstamo queda sin fecha de vencimiento y solo cobra el interés de cada mes.
                  </p>
                </div>
                )}
              </div>

              {Number(monto) > 0 && Number(tasa) > 0 && (
                <p className="text-[12px] -mt-2" style={{ color: 'var(--cf-ink-3)' }}>
                  Al {tasa}% sobre {formatMoney(Number(monto))} = {formatMoney(Math.round(Number(monto) * Number(tasa) / 100))} de interés por mes
                  {esAbierto ? ' · sin fecha de vencimiento'
                    : (frecuencia !== 'diario' && plazoUnidades ? ` · ${plazo} días en total` : '')}
                </p>
              )}

              {/* Preview del interes mensual (sin cuota/total — eso depende del modo de interes que se elige en el paso siguiente) */}
              {Number(monto) > 0 && Number(tasa) > 0 && Number(plazoUnidades) > 0 && (
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'color-mix(in srgb, var(--cf-gold) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--cf-gold) 15%, transparent)' }}>
                  <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>
                    {formatMoney(Number(monto))} al {tasa}% por {plazoUnidades} {frecuencia === 'diario' ? 'días' : frecuencia === 'semanal' ? 'semanas' : frecuencia === 'quincenal' ? 'quincenas' : 'meses'}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--cf-ink-3)' }}>
                    La cuota exacta depende del modo de interés que elijas en el siguiente paso.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* SUB-PASO 3: Tipo de interes */}
          {modo === 'prestamo' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--cf-ink)' }}>¿Cómo cobra el interés?</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--cf-ink-3)' }}>La mayoria usa el clásico. Si no estas seguro, dejalo asi.</p>
              </div>

              <ModoInteresSelector
                modoInteres={modoInteres}
                onChange={(m) => {
                  setModoInteres(m)
                  setCapitalExtra([])
                  /* «Cuota fija personalizada» es OPCIONAL y su propio texto dice
                     «dejar vacío para calcular automático»: tiene que quedar
                     vacía. Antes se rellenaba con `calculo.cuotaDiaria`, que en
                     este punto todavía es la del modo que se está ABANDONANDO
                     —el estado no se ha aplicado—, así que al elegir «sobre
                     saldo» aparecía la cuota del clásico, y esa se guardaba tal
                     cual. Un prestamista lo reportó con el caso exacto: la
                     tarjeta ofrecía $225.700 y el campo traía $266.700. En
                     producción salieron así 12 préstamos de 6 negocios; el peor,
                     $15.000.000 con cuota de $4.950.000 en vez de $4.528.900.
                     `manual` sí necesita una cuota de partida: ahí el número no
                     es opcional, lo pone el prestamista a propósito. */
                  if (m !== 'manual') setCuotaManual('')
                  else if (calculo?.cuotaDiaria) setCuotaManual(String(calculo.cuotaDiaria))
                }}
                calculo={calculo}
                monto={monto}
                tasa={tasa}
                frecuencia={frecuencia}
                diasPlazo={plazo}
                preferido={modoPreferido}
                onGuardarPreferido={(m) => { guardarModoPreferido(m); setModoPreferido(m) }}
              />

              {/* ══ EL PRÉSTAMO ABIERTO, JUSTO DEBAJO DE SU MODO ══════════════
                  ⚠ ESTE ES EL SITIO. Lo puse primero en el panel «Resumen del
                  préstamo · toca para editar», que también tiene un selector de
                  modo, y en la pantalla no aparecía por ningún lado: el modo se
                  elige AQUÍ, en las tarjetas grandes, y aquel panel es solo para
                  retocar después. Lo cazó la prueba del navegador, no leyendo.

                  Va debajo y no dentro de la tarjeta de Globo porque no es otro
                  modo: es una variante del mismo, y meterla como sexta tarjeta
                  obligaría a elegir entre «Globo» y «Globo abierto» a quien
                  todavía no sabe cuál quiere. */}
              {modoInteres === 'solo_interes' && (
                <div className="rounded-[14px] p-3.5" style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold" style={{ color: 'var(--cf-ink)' }}>Sin fecha de vencimiento</p>
                      <p className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--cf-ink-3)' }}>
                        El cliente paga solo el interés cada cobro y el capital queda pendiente
                        hasta que él quiera abonarlo.
                      </p>
                    </div>
                    <Toggle checked={sinPlazo} onChange={(v) => { setSinPlazo(v); if (v) setInteresAdelantado(false) }} />
                  </div>
                  {esAbierto && (
                    <p className="text-[11px] mt-2.5 pt-2.5 leading-relaxed" style={{ color: 'var(--cf-ink-3)', borderTop: '1px solid var(--cf-hairline)' }}>
                      No se le pide plazo ni fecha final. Cuando abone a capital, el interés del
                      cobro siguiente baja solo. El préstamo se cierra cuando el capital llegue a cero.
                    </p>
                  )}
                </div>
              )}

              {cuotaManualActiva && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Cuota exacta</label>
                  <div className="mt-1.5">
                    <MoneyInput value={cuotaManual} onChange={(e) => setCuotaManual(e.target.value)} placeholder="Ej: 60.000" />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--cf-ink-3)' }}>Tu defines la cuota. Total = cuota x número de cobros.</p>
                </div>
              )}

              {modoInteres === 'saldo' && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Cuota fija personalizada (opcional)</label>
                  <div className="mt-1.5">
                    <MoneyInput value={cuotaManual} onChange={(e) => setCuotaManual(e.target.value)} placeholder="Dejar vacío para calcular automático" />
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: 'var(--cf-ink-3)' }}>
                    {saldoCuotaPersonalizada
                      ? 'Cuota fija definida por ti. La última cuota ajusta para cerrar el saldo.'
                      : 'Si defines una cuota, se usa en vez de la calculada. El interés se descuenta del saldo cada período.'}
                  </p>

                  {/* La cuota no cubre ni el interes: el prestamo nunca se termina
                      de pagar. Se explica con los numeros exactos en vez de dejar
                      que el sistema arme una tabla imposible en silencio. */}
                  {avisoCuotaVisible && (
                    <div
                      className="mt-3 rounded-xl border p-3"
                      style={{
                        background: 'color-mix(in srgb, var(--cf-red-dark) 10%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--cf-red-dark) 30%, transparent)',
                      }}
                    >
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--cf-red-dark)' }}>
                        Con esa cuota la deuda nunca baja
                      </p>
                      <p className="text-[11px] mt-1" style={{ color: 'var(--cf-ink-2)' }}>
                        El primer período genera{' '}
                        <span className="font-mono-display font-semibold">{formatMoney(calculo.interesPrimerPeriodo)}</span>{' '}
                        de interés. Si la cuota es menor, solo alcanza para intereses y el capital se queda igual.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setCuotaManual(String(calculo.cuotaSugerida))}
                          className="h-8 px-3 rounded-[10px] text-[11px] font-semibold"
                          style={{ background: 'var(--cf-gold)', color: 'var(--cf-ink)' }}
                        >
                          Usar {formatMoney(calculo.cuotaSugerida)}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCuotaManual('')}
                          className="h-8 px-3 rounded-[10px] text-[11px] font-semibold border"
                          style={{ borderColor: 'var(--cf-border)', color: 'var(--cf-ink-2)' }}
                        >
                          Calcular automático
                        </button>
                      </div>
                      <p className="text-[10px] mt-2" style={{ color: 'var(--cf-ink-3)' }}>
                        Mínimo para cubrir el interés: {formatMoney(calculo.cuotaMinima)}. Con{' '}
                        {formatMoney(calculo.cuotaSugerida)} termina de pagar en el plazo elegido.
                      </p>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}

          {/* SUB-PASO 4: Opciones adicionales */}
          {(
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--cf-ink)' }}>Opciones adicionales</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--cf-ink-3)' }}>Todo es opcional. Si no necesitas nada, avanza.</p>
              </div>

              {clienteId && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Dias sin cobro</label>
                  <p className="text-[10px] mt-0.5 mb-2" style={{ color: 'var(--cf-ink-3)' }}>Dias en que NO se cobra. Se guarda en la ficha del cliente.</p>
                  <DiasSinCobroSelector value={diasSinCobroCliente} onChange={(arr) => { setDiasSinCobroCliente(arr); setDiasSinCobroEditado(true) }} compact />
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Fecha de inicio</label>
                <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} max={hoyISO()} />
              </div>

              <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border cursor-pointer"
                style={{ background: 'var(--cf-fill)', borderColor: 'var(--cf-border)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--cf-ink)' }}>Cobrar seguro</p>
                  <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Suma un cargo fijo al préstamo</p>
                </div>
                <input type="checkbox" checked={seguro} onChange={(e) => setSeguro(e.target.checked)} className="w-5 h-5 accent-[var(--cf-gold)]" />
              </label>
              {seguro && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Monto del seguro</label>
                  <div className="mt-1.5"><MoneyInput value={montoSeguro} onChange={(e) => setMontoSeguro(e.target.value)} placeholder="0" /></div>
                </div>
              )}

              {modoInteres !== 'manual' && calculo?.numPeriodos > 1 && (
                <CuotasExtraEditor
                  extras={capitalExtra}
                  onChange={setCapitalExtra}
                  numPeriodos={calculo.numPeriodos}
                  frecuencia={frecuencia}
                  fechaInicio={fechaInicio}
                />
              )}

              {esOwner && listaSocios.length > 0 && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Socio responsable</label>
                  <select
                    value={socioId}
                    onChange={(e) => setSocioId(e.target.value)}
                    className="mt-1.5 w-full h-10 px-2 rounded-[12px] text-sm"
                    style={{ background: 'var(--cf-fill)', border: '1px solid var(--cf-border)', color: 'var(--cf-ink)' }}
                  >
                    <option value="">Sin socio</option>
                    {listaSocios.filter(s => s.activo).map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border cursor-pointer"
                style={{ background: 'var(--cf-fill)', borderColor: 'var(--cf-border)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--cf-ink)' }}>Ya habia pagado algo antes</p>
                  <p className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Migrar un préstamo con abonos previos</p>
                </div>
                <input type="checkbox" checked={esEnCurso} onChange={(e) => setEsEnCurso(e.target.checked)} className="w-5 h-5 accent-[var(--cf-gold)]" />
              </label>
              {esEnCurso && (
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>Monto ya abonado</label>
                  <div className="mt-1.5"><MoneyInput value={yaAbonado} onChange={(e) => setYaAbonado(e.target.value)} placeholder="0" /></div>

                  {/* ══ ¿A QUÉ SE ABONÓ? ═══════════════════════════════════════
                      «El sistema no está preguntando si esos abonos son a
                      intereses, si son a capital o qué tipo de abonos es»
                      (26 ago 2026). Solo aparece en el préstamo ABIERTO: es el
                      único modo donde la respuesta hace lo que dice y nada más.
                      En los demás, marcar «capital» le regala un mes al cliente
                      o lo mete en 31 días de mora según el modo — la tabla
                      medida está en lib/dinero/abono-previo.js.

                      El renglón de debajo lleva CIFRAS, no una explicación: es
                      lo que deja al prestamista cotejarlo contra su cuaderno sin
                      tocar nada, y lo que evita que conteste en automático. */}
                  {esAbierto && Number(yaAbonado) > 0 && (() => {
                    const cap = Math.max(0, Number(monto) || 0)
                    const ab = Math.min(Number(yaAbonado) || 0, cap)
                    const t = (Number(tasa) || 0) / 100
                    const mes = Math.round(cap * t)
                    const mesNuevo = Math.round((cap - ab) * t)
                    const consecuencia = {
                      completo: `Se toma como el interés que ya corrió. Te sigue debiendo ${formatMoney(cap)}.`,
                      capital: `Bajó lo que te debe a ${formatMoney(cap - ab)}. El mes pasa de ${formatMoney(mes)} a ${formatMoney(mesNuevo)}.`,
                      intereses: `Solo te pagó la ganancia. Te sigue debiendo ${formatMoney(cap)} y el mes sigue en ${formatMoney(mes)}.`,
                    }[tipoAbonoPrevio]
                    return (
                      <div className="mt-3">
                        <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--cf-ink-3)' }}>¿A qué se abonó?</label>
                        <div className="mt-1.5">
                          <GrupoSegmentado
                            opciones={[
                              { id: 'completo', nombre: 'Cuotas' },
                              { id: 'capital', nombre: 'Capital' },
                              { id: 'intereses', nombre: 'Interés' },
                            ]}
                            valor={tipoAbonoPrevio}
                            onElegir={setTipoAbonoPrevio}
                          />
                        </div>
                        <p className="text-xs mt-1.5" style={{ color: 'var(--cf-ink-3)' }}>{consecuencia}</p>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Resumen completo antes de confirmar — editable */}
              {calculo && (() => {
                const DIAS_FULL_SINGULAR = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
                const diasPorPeriodo = DIAS_POR_PERIODO[frecuencia] || 1
                const periodos = calculo.numPeriodos || Math.max(1, Math.round(Number(plazo) / diasPorPeriodo))
                let cobrosTotales = periodos
                if (frecuencia === 'diario' && diasSinCobroCliente.length > 0) {
                  const cobrosPorSemana = 7 - diasSinCobroCliente.length
                  const diasReales = periodos * diasPorPeriodo
                  cobrosTotales = Math.max(1, Math.round((cobrosPorSemana * diasReales) / 7))
                }
                const totalConSeguro = calculo.totalAPagar + (seguro && Number(montoSeguro) > 0 ? Number(montoSeguro) : 0)
                const ganancia = calculo.totalAPagar - Number(monto || 0)
                const pctGanancia = Number(monto) > 0 ? Math.round((ganancia / Number(monto)) * 100) : 0
                const labelFreq = { diario: 'diaria', semanal: 'semanal', quincenal: 'quincenal', mensual: 'mensual' }[frecuencia]
                const unidadPlazoL = { diario: 'días', semanal: 'semanas', quincenal: 'quincenas', mensual: 'meses' }[frecuencia]
                const modoLabel = { fijo: 'Clásico', unico: 'De una vez', solo_interes: 'Globo', saldo: 'Sobre saldo', manual: 'Manual', lineal: 'Decreciente', lineal_dinamico: 'Dinámico' }[modoInteres] || 'Clásico'
                const pencil = <svg className="w-3 h-3 shrink-0" style={{ color: 'var(--cf-ink-3)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" /></svg>

                return (
                  <div className="rounded-2xl overflow-hidden"
                    style={{ border: '1px solid color-mix(in srgb, var(--cf-green-dark) 25%, var(--cf-border))' }}>
                    <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--cf-green-dark) 8%, var(--cf-card)), var(--cf-card))' }}>
                      <p className="text-[10px] font-extrabold uppercase tracking-[.07em]" style={{ color: 'var(--cf-green-dark)' }}>Resumen del préstamo</p>
                      <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Toca para editar</span>
                    </div>
                    <div className="px-4 py-2" style={{ background: 'var(--cf-card)' }}>
                      {/* Cuota + Total — calculados, no editables */}
                      <div className="grid grid-cols-2 gap-3 pb-2 mb-1" style={{ borderBottom: '2px solid color-mix(in srgb, var(--cf-green-dark) 20%, var(--cf-border))' }}>
                        <div>
                          <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Cuota {labelFreq}</p>
                          <p className="text-lg font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>{formatMoney(calculo.cuotaDiaria)}</p>
                        </div>
                        <div>
                          <p className="text-[10px]" style={{ color: 'var(--cf-ink-3)' }}>Total a pagar</p>
                          <p className="text-lg font-bold font-mono-display" style={{ color: 'var(--cf-ink)' }}>{formatMoney(totalConSeguro)}</p>
                        </div>
                      </div>

                      {/* Editables */}
                      <div className="space-y-0 text-sm">
                        <EditableRow label="Monto prestado" value={<span className="font-mono-display">{formatMoney(Number(monto || 0))}</span>} pencil={pencil}
                          editor={<MoneyInput value={monto} onChange={e => setMonto(e.target.value)} autoFocus />} />

                        {modo === 'prestamo' && (
                          <EditableRow label="Interés" value={`${tasa || 0}% mensual`} valueColor="var(--cf-gold)" pencil={pencil}
                            editor={
                              <div className="flex items-center gap-1.5">
                                <input type="text" inputMode="decimal" value={tasa} onChange={e => setTasa(soloDecimal(e.target.value))}
                                  className="w-20 h-8 rounded-lg border px-2 text-sm text-right"
                                  style={{ background: 'var(--cf-fill)', borderColor: 'var(--cf-border)', color: 'var(--cf-ink)' }} autoFocus />
                                <span className="text-xs" style={{ color: 'var(--cf-ink-3)' }}>% mensual</span>
                              </div>
                            } />
                        )}

                        <EditableRow label="Frecuencia" value={{ diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' }[frecuencia]} pencil={pencil}
                          editor={
                            <select value={frecuencia} onChange={e => { setFrecuencia(e.target.value); const nd = { diario: '30', semanal: '8', quincenal: '4', mensual: '2' }[e.target.value]; if (nd) setPlazoUnidades(nd) }}
                              className="h-8 rounded-lg border px-2 text-sm"
                              style={{ background: 'var(--cf-fill)', borderColor: 'var(--cf-border)', color: 'var(--cf-ink)' }} autoFocus>
                              <option value="diario">Diario</option><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option>
                            </select>
                          } />

                        {/* ⚠ CON EL INTERRUPTOR PUESTO, «Plazo: 6 meses» ES LO
                            CONTRARIO DE LO QUE SE ELIGIÓ, y está tres renglones
                            encima del propio interruptor. Reportado en captura:
                            «es bastante confuso». */}
                        <EditableRow label="Plazo" value={esAbierto ? 'sin plazo' : (calculo?.numPeriodos > Number(plazoUnidades) ? `${calculo.numPeriodos} ${unidadPlazoL}` : `${plazoUnidades} ${unidadPlazoL}`)} pencil={pencil}
                          editor={
                            <div className="flex items-center gap-1.5">
                              <input type="number" inputMode="numeric" value={plazoUnidades} onChange={e => setPlazoUnidades(e.target.value)}
                                className="w-20 h-8 rounded-lg border px-2 text-sm text-right"
                                style={{ background: 'var(--cf-fill)', borderColor: 'var(--cf-border)', color: 'var(--cf-ink)' }} autoFocus />
                              <span className="text-xs" style={{ color: 'var(--cf-ink-3)' }}>{unidadPlazoL}</span>
                            </div>
                          } />
                        {calculo?.numPeriodos > Number(plazoUnidades) && (
                          <p className="text-[10px] px-1 -mt-1 pb-1" style={{ color: 'var(--cf-gold-dark)' }}>
                            Plazo extendido de {plazoUnidades} a {calculo.numPeriodos} {unidadPlazoL} para cubrir el interés
                          </p>
                        )}

                        {modo === 'prestamo' && (
                          <EditableRow label="Modo" value={modoLabel} pencil={pencil}
                            editor={
                              <select value={modoInteres} onChange={e => setModoInteres(e.target.value)}
                                className="h-8 rounded-lg border px-2 text-sm"
                                style={{ background: 'var(--cf-fill)', borderColor: 'var(--cf-border)', color: 'var(--cf-ink)' }} autoFocus>
                                <option value="fijo">Clásico</option><option value="unico">De una vez</option><option value="solo_interes">Globo</option><option value="saldo">Sobre saldo</option><option value="manual">Manual</option><option value="lineal">Decreciente</option><option value="lineal_dinamico">Decr. dinámico</option>
                              </select>
                            } />
                        )}

                        {modoInteres === 'solo_interes' && (
                          <>
                            {/* ⚠ EL ABIERTO VA PRIMERO Y APAGA AL OTRO. El interés
                                adelantado se cobra sobre la ÚLTIMA cuota, y en un
                                abierto no hay última: dejar los dos encendidos
                                sería ofrecer algo que no se puede cumplir. */}
                            <div className="flex items-center justify-between py-1.5 px-1">
                              <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Sin fecha de vencimiento</span>
                              <Toggle checked={sinPlazo} onChange={(v) => { setSinPlazo(v); if (v) setInteresAdelantado(false) }} />
                            </div>
                            {!sinPlazo && (
                              <div className="flex items-center justify-between py-1.5 px-1">
                                <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Interés adelantado</span>
                                <Toggle checked={interesAdelantado} onChange={setInteresAdelantado} />
                              </div>
                            )}
                          </>
                        )}

                        {cuotaManualActiva && (
                          <EditableRow label="Cuota exacta" value={<span className="font-mono-display">{formatMoney(Number(cuotaManual || 0))}</span>} pencil={pencil}
                            editor={<MoneyInput value={cuotaManual} onChange={e => setCuotaManual(e.target.value)} autoFocus />} />
                        )}
                      </div>

                      {/* La cuota fijada no cubre el interes de la tasa en el plazo
                          pedido, asi que el plazo se alarga solo. Antes pasaba en
                          silencio y el prestamista se enteraba con el prestamo hecho. */}
                      {calculo?.plazoExtendido && (
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

                      {/* Va junto al del plazo extendido a proposito: los dos
                          cuentan una consecuencia de lo que uno escribio, no un
                          error. Ver components/prestamos/AvisoUltimaCuota. */}
                      <AvisoUltimaCuota
                        calculo={calculo}
                        onCuota={(v) => setCuotaManual(String(v))}
                        onPlazo={(n) => setPlazoUnidades(String(n))}
                      />

                      {/* Info calculada — read only */}
                      <div className="space-y-0 mt-1 pt-1" style={{ borderTop: '1px dashed color-mix(in srgb, var(--cf-border) 70%, transparent)' }}>
                        {/* ⚠ EN UN ABIERTO NO HAY «COBROS TOTALES» NI GANANCIA
                            TOTAL: no se sabe cuántos meses va a durar. Decir «6
                            cobros» y «$0 (0%)» son dos cifras inventadas sobre
                            un préstamo que puede durar años. Lo que sí se sabe
                            —y es lo que gana— es el interés de cada cobro. */}
                        {esAbierto ? (
                          <div className="flex items-center justify-between py-1.5">
                            <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Ganas cada cobro</span>
                            <span className="text-xs font-semibold font-mono-display" style={{ color: 'var(--cf-green-dark)' }}>
                              {formatMoney(Math.round(calculo?.cuotaDiaria || 0))}
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Cobros totales</span>
                              <span className="text-xs font-semibold" style={{ color: 'var(--cf-ink)' }}>{cobrosTotales}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Ganancia</span>
                              <span className="text-xs font-semibold font-mono-display" style={{ color: 'var(--cf-green-dark)' }}>{formatMoney(ganancia)} ({pctGanancia}%)</span>
                            </div>
                          </>
                        )}
                        {diasSinCobroCliente.length > 0 && (
                          <div className="flex items-center justify-between py-1.5">
                            <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Sin cobro</span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--cf-ink)' }}>{diasSinCobroCliente.sort((a, b) => a - b).map(n => DIAS_FULL_SINGULAR[n].charAt(0).toUpperCase() + DIAS_FULL_SINGULAR[n].slice(1)).join(', ')}</span>
                          </div>
                        )}
                        {seguro && Number(montoSeguro) > 0 && (
                          <div className="flex items-center justify-between py-1.5">
                            <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Seguro</span>
                            <span className="text-xs font-semibold font-mono-display" style={{ color: 'var(--cf-ink-2)' }}>{formatMoney(Number(montoSeguro))}</span>
                          </div>
                        )}
                        {esEnCurso && Number(yaAbonado) > 0 && (
                          <div className="flex items-center justify-between py-1.5">
                            <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Abono previo</span>
                            <span className="text-xs font-semibold font-mono-display" style={{ color: 'var(--cf-green-dark)' }}>{formatMoney(Number(yaAbonado))}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {calculo?.tablaAmortizacion?.length > 0 && (
                      <div className="px-4 py-3 border-t" style={{ borderColor: 'color-mix(in srgb, var(--cf-border) 50%, transparent)', background: 'var(--cf-card)' }}>
                        <TablaAmortizacion
                          tabla={calculo.tablaAmortizacion}
                          frecuencia={frecuencia}
                          modoInteres={modoInteres}
                        />
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </section>
      )}

      {/* ═══ PASO 2: CONFIRMAR + FIRMA ═══ */}
      {paso === 2 && calculo && (() => {
        const labelFrecuencia = { diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' }[frecuencia]
        const unidadPlazoLabel = { diario: 'días', semanal: 'semanas', quincenal: 'quincenas', mensual: 'meses' }[frecuencia]
        const modoLabel = { fijo: 'Clásico', unico: 'De una vez', solo_interes: 'Globo', saldo: 'Sobre saldo', manual: 'Manual', lineal: 'Decreciente', lineal_dinamico: 'Dinámico' }[modoInteres] || 'Clásico'
        const pencilIcon = <svg className="w-3 h-3 shrink-0" style={{ color: 'var(--cf-ink-3)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" /></svg>
        return (
          <section className="space-y-4 pb-28">
            <SectionCard
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              title="Resumen del préstamo"
              color="var(--cf-green-dark)"
              accent={<span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Toca un campo para editar</span>}
            >
              <div className="space-y-0 text-sm">
                {/* Cliente — no editable */}
                <div className="flex justify-between py-2 border-b" style={{ borderColor: 'color-mix(in srgb, var(--cf-border) 50%, transparent)' }}>
                  <span style={{ color: 'var(--cf-ink-3)' }}>Cliente</span>
                  <span className="font-semibold">{clienteSeleccionado?.nombre}</span>
                </div>

                {/* Monto — editable */}
                <EditableRow label="Monto" value={<span className="font-mono-display">{formatMoney(Number(monto))}</span>}
                  pencil={pencilIcon}
                  editor={<MoneyInput value={monto} onChange={e => setMonto(e.target.value)} autoFocus />}
                />

                {/* Tasa — editable (solo prestamo, no mercancia) */}
                {modo === 'prestamo' && (
                  <EditableRow label="Interés" value={`${tasa}% mensual`}
                    pencil={pencilIcon}
                    editor={
                      <div className="flex items-center gap-1.5">
                        <input type="text" inputMode="decimal" value={tasa} onChange={e => setTasa(soloDecimal(e.target.value))}
                          className="w-20 h-8 rounded-lg border px-2 text-sm text-right"
                          style={{ background: 'var(--cf-fill)', borderColor: 'var(--cf-border)', color: 'var(--cf-ink)' }} autoFocus />
                        <span className="text-xs" style={{ color: 'var(--cf-ink-3)' }}>% mensual</span>
                      </div>
                    }
                  />
                )}

                {/* Frecuencia — editable */}
                <EditableRow label="Frecuencia" value={labelFrecuencia}
                  pencil={pencilIcon}
                  editor={
                    <select value={frecuencia} onChange={e => { setFrecuencia(e.target.value); const newDefault = { diario: '30', semanal: '8', quincenal: '4', mensual: '2' }[e.target.value]; if (newDefault) setPlazoUnidades(newDefault) }}
                      className="h-8 rounded-lg border px-2 text-sm"
                      style={{ background: 'var(--cf-fill)', borderColor: 'var(--cf-border)', color: 'var(--cf-ink)' }} autoFocus>
                      <option value="diario">Diario</option>
                      <option value="semanal">Semanal</option>
                      <option value="quincenal">Quincenal</option>
                      <option value="mensual">Mensual</option>
                    </select>
                  }
                />

                {/* Plazo — editable */}
                {/* La otra vista del mismo panel. Ver la nota de arriba: son dos
                    y arreglar una y dejar la otra ya me ha pasado. */}
                <EditableRow label="Plazo" value={esAbierto ? 'sin plazo' : (calculo?.numPeriodos > Number(plazoUnidades) ? `${calculo.numPeriodos} ${unidadPlazoLabel}` : `${plazoUnidades} ${unidadPlazoLabel}`)}
                  pencil={pencilIcon}
                  editor={
                    <div className="flex items-center gap-1.5">
                      <input type="number" inputMode="numeric" value={plazoUnidades} onChange={e => setPlazoUnidades(e.target.value)}
                        className="w-20 h-8 rounded-lg border px-2 text-sm text-right"
                        style={{ background: 'var(--cf-fill)', borderColor: 'var(--cf-border)', color: 'var(--cf-ink)' }} autoFocus />
                      <span className="text-xs" style={{ color: 'var(--cf-ink-3)' }}>{unidadPlazoLabel}</span>
                    </div>
                  }
                />
                {calculo?.numPeriodos > Number(plazoUnidades) && (
                  <p className="text-[10px] px-1 -mt-1 pb-1" style={{ color: 'var(--cf-gold-dark)' }}>
                    Plazo extendido de {plazoUnidades} a {calculo.numPeriodos} {unidadPlazoLabel} para cubrir el interés
                  </p>
                )}

                {/* Modo interés — editable (solo prestamo) */}
                {modo === 'prestamo' && (
                  <EditableRow label="Modo" value={modoLabel}
                    pencil={pencilIcon}
                    editor={
                      <select value={modoInteres} onChange={e => setModoInteres(e.target.value)}
                        className="h-8 rounded-lg border px-2 text-sm"
                        style={{ background: 'var(--cf-fill)', borderColor: 'var(--cf-border)', color: 'var(--cf-ink)' }} autoFocus>
                        <option value="fijo">Clásico</option>
                        <option value="unico">De una vez</option>
                        <option value="solo_interes">Globo</option>
                        <option value="saldo">Sobre saldo</option>
                        <option value="manual">Manual</option>
                        <option value="lineal">Decreciente</option>
                        <option value="lineal_dinamico">Decr. dinámico</option>
                      </select>
                    }
                  />
                )}

                {/* ⚠ SON DOS VISTAS DEL MISMO PANEL, y esto ya me mordió antes:
                    arreglar una y dejar la otra. Los dos interruptores van en
                    las dos. */}
                {modoInteres === 'solo_interes' && (
                  <>
                    <div className="flex items-center justify-between py-1.5 px-1">
                      <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Sin fecha de vencimiento</span>
                      <Toggle checked={sinPlazo} onChange={(v) => { setSinPlazo(v); if (v) setInteresAdelantado(false) }} />
                    </div>
                    {!sinPlazo && (
                      <div className="flex items-center justify-between py-1.5 px-1">
                        <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Interés adelantado</span>
                        <Toggle checked={interesAdelantado} onChange={setInteresAdelantado} />
                      </div>
                    )}
                  </>
                )}

                {/* Cuota manual — editable si modo manual */}
                {cuotaManualActiva && (
                  <EditableRow label="Cuota exacta" value={<span className="font-mono-display">{formatMoney(Number(cuotaManual || 0))}</span>}
                    pencil={pencilIcon}
                    editor={<MoneyInput value={cuotaManual} onChange={e => setCuotaManual(e.target.value)} autoFocus />}
                  />
                )}

                {/* Calculados — read only */}
                <div className="pt-2 mt-1 space-y-2" style={{ borderTop: '2px solid color-mix(in srgb, var(--cf-green-dark) 25%, var(--cf-border))' }}>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--cf-ink-3)' }}>Cuota {frecuencia === 'diario' ? 'diaria' : labelFrecuencia.toLowerCase()}</span>
                    <span className="font-bold font-mono-display" style={{ color: 'var(--cf-green-dark)' }}>{formatMoney(calculo.cuotaDiaria)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--cf-ink-3)' }}>Total a pagar</span>
                    <span className="font-bold font-mono-display" style={{ color: 'var(--cf-gold)' }}>{formatMoney(calculo.totalAPagar)}</span>
                  </div>
                  {calculo.totalInteres > 0 && (
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--cf-ink-3)' }}>Ganancia</span>
                      <span className="font-semibold font-mono-display" style={{ color: 'var(--cf-green-dark)' }}>{formatMoney(calculo.totalInteres)}</span>
                      {/* Lo último que se lee antes de confirmar. Si el modo
                      multiplica el interés por el número de cobros, aquí es
                      donde tiene que verse. */}
                  <AvisoPorCobro aviso={avisoDelPorcentaje(modoInteres, calculo,
                    { monto: Number(monto) || 0, tasa: Number(tasa) || 0 })} />
                </div>
                  )}
                  {/* Lo último que se lee antes de confirmar. Si el modo
                      multiplica el interés por el número de cobros, aquí es
                      donde tiene que verse. */}
                  <AvisoPorCobro aviso={avisoDelPorcentaje(modoInteres, calculo,
                    { monto: Number(monto) || 0, tasa: Number(tasa) || 0 })} />
                </div>
              </div>
            </SectionCard>

            {/* De que cuenta sale el dinero (alimenta el desglose por cuenta) */}
            <SectionCard
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>}
              title="¿De qué cuenta sale?"
              color="var(--cf-ink-2)"
              accent={<span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>Para el desglose por cuenta</span>}
            >
              <p className="text-[11px] mb-2.5" style={{ color: 'var(--cf-ink-3)' }}>
                De dónde entregas este dinero. Por defecto efectivo.
              </p>
              <MetodoPagoSelector
                metodosPago={metodosPago}
                compact
                value={{ metodoPago: cuentaDesembolso.metodoPago, metodoPagoId: cuentaDesembolso.metodoPagoId }}
                onSelect={(sel) => setCuentaDesembolso(sel)}
              />
            </SectionCard>

            <SectionCard
              icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" /></svg>}
              title="Firma del cliente"
              color="var(--cf-ink-2)"
            >
              <p className="text-[11px] mb-2" style={{ color: 'var(--cf-ink-3)' }}>
                El cliente firma con el dedo sobre el recuadro. Opcional.
              </p>
              <div className="relative rounded-[12px] overflow-hidden border" style={{ borderColor: 'var(--cf-border)', background: '#ffffff' }}>
                <canvas
                  ref={firmaCanvasRef}
                  className="w-full touch-none"
                  style={{ height: 180, cursor: 'crosshair' }}
                  onMouseDown={firmaStart}
                  onMouseMove={firmaDraw}
                  onMouseUp={firmaEnd}
                  onMouseLeave={firmaEnd}
                  onTouchStart={firmaStart}
                  onTouchMove={firmaDraw}
                  onTouchEnd={firmaEnd}
                />
                {!firmaStrokes && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-sm text-[#aaa]">Firmar aqui</p>
                  </div>
                )}
              </div>
              {firmaStrokes && (
                <button
                  type="button"
                  onClick={firmaLimpiar}
                  className="mt-2 text-[11px] font-medium px-3 py-1 rounded-[8px] transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--cf-ink-3)' }}
                >
                  Limpiar firma
                </button>
              )}
            </SectionCard>
          </section>
        )
      })()}

        </div>{/* ── fin de la columna del formulario ── */}

        {/* ── LA CUENTA, AL LADO Y EN VIVO ──
            Solo desde `xl`: por debajo no hay sitio para dos columnas y la
            cuota sigue saliendo en la franja de abajo, como en el teléfono.

            El orden es el de la lámina: primero la cuota —que es la cifra que
            se está buscando—, luego lo que se gana, y debajo el calendario
            entero. */}
        <aside
          data-panel="cuenta"
          className="hidden xl:block sticky top-20 rounded-[16px] overflow-hidden"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}
        >
          <div className="px-4 pt-3.5 pb-4">
            {/* El punto verde es de la lámina y hace falta: sin él, «se
                recalcula al escribir» es una promesa; con él se lee como algo
                que está vivo ahora mismo. */}
            <p className="text-[10px] font-extrabold uppercase tracking-[.07em] flex items-center gap-1.5" style={{ color: 'var(--cf-ink-3)' }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--cf-green-dark)' }} />
              Se recalcula al escribir
            </p>

            {!calculo ? (
              <p className="text-[12.5px] mt-2 leading-relaxed" style={{ color: 'var(--cf-ink-3)' }}>
                Escribe el monto, la tasa y el plazo y aquí verás la cuota,
                cuánto ganas y cómo queda el calendario.
              </p>
            ) : (
              <>
                {/* La cuota y la ganancia van A LA PAR, no una debajo de otra
                    en una lista: son las dos cifras de la decisión —lo que él
                    cobra cada vez y lo que se lleva al final— y la lámina las
                    pone en la misma línea, la ganancia en dorado. */}
                <div className="flex items-end justify-between gap-3 mt-3">
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-bold uppercase tracking-[.08em]" style={{ color: 'var(--cf-ink-3)' }}>
                      Cuota {UNIDAD_CUOTA[frecuencia]}
                    </p>
                    <p className="cf-fig text-[30px] leading-none mt-1 truncate"
                       style={{ letterSpacing: '-.03em', color: 'var(--cf-ink)' }}>
                      {formatMoney(calculo.cuotaDiaria)}
                    </p>
                  </div>
                  <div className="text-right min-w-0">
                    {/* ⚠ EN UN ABIERTO LA GANANCIA TOTAL NO SE PUEDE SABER: el
                        préstamo dura lo que el cliente tarde en abonar. Salía
                        «$0», que es la única cifra que seguro es falsa. Lo que
                        sí se sabe es lo que gana en cada cobro. */}
                    <p className="text-[10.5px] font-bold uppercase tracking-[.08em]" style={{ color: 'var(--cf-ink-3)' }}>
                      {esAbierto ? 'Ganas cada cobro' : 'Ganancia'}
                    </p>
                    <p className="cf-fig text-[19px] leading-none mt-1 truncate"
                       style={{ letterSpacing: '-.02em', color: 'var(--cf-gold)' }}>
                      {formatMoney(Math.round((esAbierto ? calculo.cuotaDiaria : calculo.totalInteres) || 0))}
                    </p>
                  </div>
                </div>

                {/* ── LA PROPORCIÓN, EN UNA BARRA ──
                    Cuánto de lo que va a volver es su plata y cuánto es
                    ganancia. En cifras hay que restar mentalmente; en la barra
                    se ve de un golpe si el interés se está comiendo el préstamo
                    o es una porción razonable. */}
                {calculo.totalAPagar > 0 && (
                  <>
                    <div className="flex h-2 rounded-full overflow-hidden mt-3.5" style={{ background: 'var(--cf-fill)' }}>
                      <div style={{
                        width: `${Math.min(100, Math.max(0, (Number(monto) || 0) / calculo.totalAPagar * 100))}%`,
                        background: 'var(--cf-ink)',
                      }} />
                      <div className="flex-1" style={{ background: 'var(--cf-gold)' }} />
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-2 text-[11.5px]" style={{ color: 'var(--cf-ink-3)' }}>
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ background: 'var(--cf-ink)' }} />
                        Capital <b className="cf-fig font-bold" style={{ color: 'var(--cf-ink)' }}>{formatMoney(Number(monto) || 0)}</b>
                      </span>
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-[3px] shrink-0" style={{ background: 'var(--cf-gold)' }} />
                        Total <b className="cf-fig font-bold" style={{ color: 'var(--cf-ink)' }}>{formatMoney(calculo.totalAPagar)}</b>
                      </span>
                    </div>
                  </>
                )}

                {/* ESTE AVISO VA AQUÍ, NO AL FINAL.
                    Dice que la cuota no cubre el interés y que el préstamo se va
                    a alargar solo. Es una decisión que se toma MOVIENDO la tasa
                    o la cuota, así que tiene que verse mientras se mueven —no
                    después de confirmar. */}
                {avisoCuotaVisible && (
                  <p className="text-[11.5px] font-semibold mt-3 rounded-[10px] px-2.5 py-2 leading-snug"
                    style={{
                      color: 'var(--cf-red-dark)',
                      background: 'var(--cf-red-pill-bg)',
                      border: '1px solid color-mix(in srgb, var(--cf-red-dark) 25%, transparent)',
                    }}>
                    Con esta cuota no alcanza a cubrir el interés: el préstamo se
                    alargaría solo. Sube la cuota o baja la tasa.
                  </p>
                )}
              </>
            )}
          </div>

          {/* El calendario ENTERO, no las seis primeras filas. La lámina lo pide
              completo, y aquí sí cabe: el panel tiene su propio scroll y la
              cabecera se queda pegada arriba, así que da igual que sean 8 cobros
              o 90. Antes se recortaba a 6 porque el panel flotaba sin altura
              conocida y una lista larga se salía de la pantalla. */}
          {calculo && Array.isArray(calculo.tablaAmortizacion) && calculo.tablaAmortizacion.length > 0 && (
            <div className="max-h-[38vh] overflow-y-auto"
                 style={{ borderTop: '1px solid var(--cf-border)' }}>
              {/* Los nombres salen de `lib/calculos.js`: la fila trae
                  `cuotaTotal`, `saldoRestante` y `fechaEsperada`. Escribí
                  `f.cuota` de memoria y no existe — habría pintado una columna
                  de ceros sin que nada fallara, que es como se cuelan estas. */}
              <div className="grid gap-2 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[.06em] sticky top-0"
                style={{
                  gridTemplateColumns: COLUMNAS_CALENDARIO,
                  color: 'var(--cf-ink-3)',
                  background: 'var(--cf-card)',
                  borderBottom: '1px solid var(--cf-border)',
                }}>
                <span>#</span>
                <span>Fecha</span>
                <span style={{ textAlign: 'right' }}>Cuota</span>
                <span style={{ textAlign: 'right' }}>Saldo</span>
              </div>
              {calculo.tablaAmortizacion.map((f) => (
                <div key={f.numeroPeriodo} className="grid gap-2 px-4 py-[3px]"
                  style={{ gridTemplateColumns: COLUMNAS_CALENDARIO }}>
                  <span className="cf-num text-[11.5px]" style={{ color: 'var(--cf-ink-3)' }}>{f.numeroPeriodo}</span>
                  <span className="text-[11px]" style={{ color: 'var(--cf-ink-3)' }}>{fechaCorta(f.fechaEsperada)}</span>
                  <span className="cf-fig text-[11.5px] font-semibold" style={{ textAlign: 'right', color: 'var(--cf-ink)' }}>
                    {formatMoney(Math.round(f.cuotaTotal || 0))}
                  </span>
                  <span className="cf-fig text-[11.5px]" style={{ textAlign: 'right', color: 'var(--cf-ink-3)' }}>
                    {formatMoney(Math.round(f.saldoRestante || 0))}
                  </span>
                </div>
              ))}
              <div className="h-2" />
            </div>
          )}
        </aside>
      </div>{/* ── fin de las dos columnas ── */}

      {/* ══ T01-06 · LA FRANJA DE ACCIÓN: UNA SOLA PIEZA ══
          La cuota en vivo y los botones eran DOS bloques flotantes, uno encima
          del otro, cada uno con su fondo, su borde y su sombra. Encajarlos
          costó dos rondas de arreglos —primero se solapaban, luego quedaron
          demasiado separados— y las dos veces el fallo era el mismo: dos cajas
          que hay que alinear a mano no se alinean nunca.

          La lámina las tiene en LA MISMA caja: un bloque blanco con un filete
          arriba, la cuota dentro y el botón debajo. Sin hueco que ajustar,
          sin sombra, y sin dos anchos que mantener a la par.

          ⚠ VA PEGADO AL BORDE. Esta pantalla es `TAREA`: nunca tuvo pastilla,
          así que subir la barra para esquivarla solo dejaba un hueco muerto.
          El dueño lo vio de una: «se ve terrible».

          ⚠ Y EL BORDE IZQUIERDO SALE DEL TOKEN, NO DE UN NÚMERO FIJO.
          El menú lateral mide `--cf-w-sidebar` = 250px y esto arrancaba en la
          clase `left-60` de Tailwind, que son 240px clavados: la barra
          SOBRESALÍA 10px por debajo del menú y, como llevaba sombra hacia
          arriba, esos 10px se veían como una franja gris pegada al menú.
          Con el token no se pueden volver a desincronizar. */}
      <div
        className="fixed left-0 right-0 lg:left-[var(--cf-w-sidebar)] bottom-0 z-[46] px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+12px)] lg:px-6 lg:pb-6"
        style={{
          background: 'var(--cf-card)',
          borderTop: '1px solid var(--cf-border)',
        }}
      >
        {/* LA CUOTA, EN VIVO. Antes solo salía en el último sub-paso: se
            ajustaba el monto, el interés y el plazo A CIEGAS y la cifra
            aparecía al final. La lámina la pone aquí, grande —30px, no 13—,
            porque es la cifra que se está buscando mientras se mueven los
            controles de arriba. */}
        {/* `xl:hidden`: desde `xl` la cuota ya está arriba en el panel, a 32px y
            junto a la ganancia y el calendario. Dejarla también aquí ponía la
            misma cifra dos veces en la misma pantalla. */}
        {paso === 1 && calculo && (
          <div className="xl:hidden max-w-2xl mx-auto flex items-end justify-between gap-4 mb-3.5">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--cf-ink-3)' }}>
                {frecuencia === 'diario' ? 'Cuota diaria' : frecuencia === 'semanal' ? 'Cuota semanal' : frecuencia === 'quincenal' ? 'Cuota quincenal' : 'Cuota mensual'}
              </p>
              <p className="cf-fig text-[26px] sm:text-[30px] leading-none truncate mt-1"
                 style={{ letterSpacing: '-.03em', color: 'var(--cf-ink)' }}>
                {formatMoney(calculo.cuotaDiaria)}
              </p>
            </div>
            <div className="text-right min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: 'var(--cf-ink-3)' }}>Total a pagar</p>
              <p className="cf-fig text-[17px] leading-none truncate mt-1"
                 style={{ letterSpacing: '-.02em', color: 'var(--cf-ink-2)' }}>
                {formatMoney(calculo.totalAPagar)}
              </p>
            </div>
          </div>
        )}

        {/* Los botones se alinean con la COLUMNA DEL FORMULARIO, no con el
            centro de la pantalla: la caja de fuera mide ahora 1076px por las dos
            columnas, y un `mx-auto` a secas dejaba «Revisar préstamo» flotando
            bajo el panel de la cuenta, que no es lo que se está rellenando. */}
        <div className="max-w-2xl xl:max-w-[1076px] mx-auto flex items-center gap-3 xl:pr-[404px]">
          {paso === 0 ? (
            <Button type="button" variant="secondary" onClick={() => router.back()} disabled={loading} className="flex-1">
              Cancelar
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={irAlPasoAnterior} disabled={loading} className="flex-1">
              Atrás
            </Button>
          )}
          {paso < PASOS.length - 1 ? (
            <Button
              type="button"
              onClick={irAlSiguientePaso}
              disabled={paso <= 1 ? !puedeAvanzarPaso() : false}
              className="flex-[2]"
            >
              {/* En PC el 0 ya lleva las condiciones: lo siguiente es revisar. */}
              {paso === 1 || (unaPantalla && paso === 0) ? 'Revisar préstamo' : 'Continuar'}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              loading={loading}
              disabled={!puedeAvanzarPaso()}
              className="flex-[2]"
            >
              Crear préstamo
            </Button>
          )}
        </div>
      </div>

      {/* Modal de inyeccion de capital (sin cambios) */}
      {modalInyeccion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="bg-[var(--cf-surface)] border border-[var(--cf-border)] rounded-[20px] w-full max-w-md p-5">
            <h3 className="text-base font-semibold text-[var(--cf-ink)] mb-1">Capital insuficiente</h3>
            <p className="text-sm text-[var(--cf-ink)] mb-3">
              Tu saldo actual de capital es <span className="font-mono-display text-[var(--cf-gold)]">{formatMoney(modalInyeccion.saldoActual)}</span>. Te faltan <span className="font-mono-display text-[var(--cf-red-dark)]">{formatMoney(modalInyeccion.faltante)}</span> para este préstamo.
            </p>
            <p className="text-xs text-[var(--cf-ink-3)] mb-4">
              Puedes inyectar ese dinero ahora (por ejemplo, de tus ahorros o de un socio) y el sistema crea el préstamo. La inyección queda registrada en tus movimientos de capital.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[var(--cf-ink-3)] mb-1">Monto a inyectar</label>
                <MoneyInput
                  value={modalInyeccion.montoInyeccion}
                  onChange={(e) => setModalInyeccion(m => ({ ...m, montoInyeccion: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--cf-ink-3)] mb-1">Descripción (opcional)</label>
                <Input
                  type="text"
                  value={modalInyeccion.descripcion}
                  onChange={(e) => setModalInyeccion(m => ({ ...m, descripcion: e.target.value }))}
                  placeholder="Ej: ahorros personales, aporte socio..."
                />
              </div>
            </div>

            {error && (
              <div className="mt-3 text-sm text-[var(--cf-red-dark)]">{error}</div>
            )}

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => { setModalInyeccion(null); setError('') }}
                disabled={inyectando}
                className="flex-1 px-4 py-2 bg-[var(--cf-fill)] text-[var(--cf-ink)] text-sm font-semibold rounded-[12px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarInyeccionYCrear}
                disabled={inyectando}
                className="flex-1 px-4 py-2 bg-[var(--cf-green-dark)] text-[#0a1f14] text-sm font-semibold rounded-[12px] disabled:opacity-50"
              >
                {inyectando ? 'Procesando...' : 'Inyectar y crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

