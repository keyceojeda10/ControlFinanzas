'use client'

// components/migrador/LoteFotos.jsx — el cuaderno entero, de una sentada.
//
// ══ POR QUÉ EXISTE ════════════════════════════════════════════════════════
//
// Medido contra producción: de 429 negocios, **226 cargaron su cartera a mano a
// uno o dos clientes por minuto**, y el 73 % se quedó en cinco clientes o menos.
// De los que pasan de 21 clientes paga la mitad; de los que se quedan en cinco,
// el 1 %. Y no es que no entiendan la app: 202 cargaron su primer cliente en la
// primera hora y después se pararon. **El muro es pasar el cuaderno.**
//
// El OCR que había lee hasta 5 fotos pero las FUSIONA en un solo cliente. Aquí
// cada foto trae los que traiga —una cartulina trae uno, una hoja de cuaderno
// trae treinta— y todos caen en una lista que se revisa de una pasada.
//
// ══ DÓNDE ESTÁ EL VALOR (y no es el OCR) ══════════════════════════════════
//
// No sabemos qué tan bien lee: no había fotos reales para medirlo antes de
// construir. Así que esto está diseñado para que **un OCR mediocre siga
// sirviendo**: con un 60 % de acierto se ahorra el 60 % del tecleo, siempre que
// corregir un campo cueste un toque y no una reescritura. De ahí:
//
//   · el semáforo por fila, para saber a cuáles hay que mirar
//   · el filtro «solo las que hay que revisar»
//   · y lo que el OCR NUNCA va a acertar —tasa, modo de interés, ruta— se pone
//     UNA vez arriba y aplica a todas
//
// ══ ⚠ POR QUÉ NO USA `/api/carga-masiva/importar` ═════════════════════════
//
// Sería el reuso obvio: ya crea clientes y préstamos en bloque, con límites de
// plan, movimiento de capital y transacción por cliente. Pero **fuerza
// `modoInteres: 'fijo'`** (`route.js`:175). En este sistema el mismo «20 %»
// significa cosas distintas según el modo —hasta 6,6 veces de diferencia— así
// que importar la cartera de un negocio que trabaja sobre saldo la crearía
// entera mal, sin un solo error a la vista.
//
// Se crea por `/api/clientes` + `/api/prestamos`, que es el camino que ya usa
// este mismo migrador de uno en uno y que sí respeta el modo y arma la tabla de
// amortización. Cuesta dos peticiones por cliente; a cambio, la plata queda
// bien.

import { abonoSinResolver } from '@/lib/dinero/monto-raro'
import PreguntaAbonoRaro from '@/components/prestamos/PreguntaAbonoRaro'
import { useState, useRef, useEffect, useCallback } from 'react'
import { BotonPrimario, Chip, EtiquetaCampo, Pastilla } from '@/components/cf/primitivos'
import MoneyInput from '@/components/ui/MoneyInput'
import { guardarEnCache, leerDeCache } from '@/lib/offline'
import { useAuth } from '@/hooks/useAuth'
import { formatMoney } from '@/lib/i18n'
import { montoConTasa, inicioPorLoAbonado, choqueDeCuota } from '@/lib/cartulina-datos'
import { MODOS_EN_ORDEN, etiquetaModo } from '@/lib/dinero/modos'
import { unirFilasDelLote, marcadorDeFila } from '@/lib/carga-asesor/al-lote'

const FRECUENCIAS = [
  { key: 'diario', label: 'Diario' },
  { key: 'semanal', label: 'Semanal' },
  { key: 'quincenal', label: 'Quincenal' },
  { key: 'mensual', label: 'Mensual' },
]
const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }
const PLAZO_DEFAULT = { diario: 30, semanal: 8, quincenal: 4, mensual: 2 }

const COLOR = {
  verde: 'var(--cf-green)',
  ambar: 'var(--cf-gold)',
  rojo: 'var(--cf-red)',
}
const ROTULO = { verde: 'Lista', ambar: 'Revisar', rojo: 'Falta lo básico' }
const NO_APUNTADA = 'Se guardó pero no se pudo apuntar: toca Crear otra vez'
const SIN_APUNTAR = 'Falta cómo apuntar la carga'

/* ══ ⚠ LO QUE DE VERDAD SE VA A GUARDAR, EN UNA SOLA FUNCIÓN ══════════════
 *
 * Esto empezó siendo tres cálculos sueltos —uno en el semáforo, otro en el
 * texto de la fila y otro al guardar— y se separaron en el peor sitio posible.
 *
 * El fallo, cazado corriendo el lote entero contra el espejo: el OCR devuelve
 * `tasa: ''` cuando no la encuentra en la foto, y `''` NO es `null`. Así que
 * `f.tasa ?? base.tasa` daba `''` —el `??` solo cae al defecto con null o
 * undefined— y `Number('')` es 0. El texto de la fila usaba `||`, así que decía
 * «diario 20 %»… y al guardar se creaban los siete préstamos AL 0 % DE INTERÉS.
 *
 * La pantalla mostraba una cosa y guardaba otra. Sobre una cartera de veinte
 * millones eso son cuatro millones de interés que desaparecen sin un error a la
 * vista, y no se descubre hasta que no cuadra la plata meses después.
 *
 * Ahora hay UN resolvedor y lo usan los tres. Si mañana se añade un campo con
 * defecto, entra aquí y los tres lo heredan.
 */
/* Los modos, con los MISMOS nombres que la lista de préstamos: si aquí se
   llamaran distinto, el mismo préstamo tendría dos nombres según dónde se mire. */
const MODOS = MODOS_EN_ORDEN.filter((m) => m !== 'manual').map((m) => ({ valor: m, nombre: etiquetaModo(m) }))

export function efectivo(f, base) {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }
  const frecuencia = f.frecuencia || base.frecuencia
  return {
    nombre: f.nombre?.trim() ?? '',
    monto: num(f.monto),
    // `||` y no `??`: el campo vacío del formulario es '' y tiene que caer al
    // valor de arriba, igual que si no viniera.
    tasa: num(f.tasa) ?? num(base.tasa),
    frecuencia,
    /* ⚠ EL MODO, POR PRÉSTAMO Y NO SOLO PARA LA TANDA ENTERA.
       «El modo de interés no se puede seleccionar ahora mismo en cada préstamo
       que se extrae». Y hace falta: en la tabla que mandó el cliente conviven
       préstamos de cuota fija con otros donde el cliente paga solo el interés
       cada mes y el capital no baja nunca —eso es Globo—. Importarlos todos
       como cuota fija hace que el sistema crea que la deuda se salda sola. */
    modoInteres: f.modoInteres || base.modoInteres || 'fijo',
    plazoUnidades: num(f.plazoUnidades) ?? PLAZO_DEFAULT[frecuencia],
  }
}

const hoyBogota = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10)

/* Sin fecha en el papel y con abonos, el préstamo no empezó hoy: ver
   `inicioPorLoAbonado` (lib/cartulina-datos.js, DETALLES-CARTERA #2). */
function inicioDeLaFila(f, base, hoy = hoyBogota()) {
  return inicioPorLoAbonado({ ...efectivo(f, base), fechaInicio: f.fechaInicio, yaAbonado: f.yaAbonado, hoy })
}

/* La cuota del papel contra la que sale con la forma de cobro: ver
   `choqueDeCuota` (lib/cartulina-datos.js, DETALLES-CARTERA #7). */
function choqueDeLaFila(f, base) {
  return choqueDeCuota({ ...efectivo(f, base), cuotaLeida: f.cuotaLeida, hoy: hoyBogota() })
}

/* El semáforo se recalcula EN EL NAVEGADOR cada vez que se edita una fila, no
   solo cuando llega del servidor: si no, corregir el monto de una fila roja la
   dejaría roja y el usuario no sabría que ya está bien. Misma regla que
   `semaforo()` en `lib/cartulina.js`; se repite aquí porque esa vive en el
   servidor y esto corre mientras se teclea. */
/* En estos modos NO hay «cuántos cobros»: el cliente paga el interés hasta que
   devuelve el capital, y el papel no lo dice porque no existe. Pedirlo sería
   marcar en ámbar un dato que nadie puede rellenar. */
const MODOS_SIN_PLAZO = ['solo_interes']

export function estadoDe(f, base) {
  const e = efectivo(f, base)
  if (!e.nombre || !e.monto) return 'rojo'
  /* ⚠ SIN FRECUENCIA O SIN TASA NO SE CREA NADA. En el migrador nunca pasa: lo
     de arriba arranca en «diario» y «20». La carga que revisa el dueño arranca
     de «Cómo prestas por defecto» del negocio y, si no lo tiene, VACÍO —nunca
     se supone—, así que la fila sin lo suyo y sin lo de arriba no tiene con qué
     crearse. Sin esto se mandaba `tasaInteres: null`: el API lo rechaza DESPUÉS
     de haber creado el cliente, y queda un cliente sin préstamo. */
  if (!e.frecuencia || e.tasa == null) return 'rojo'
  /* La fila que el lector vio repetida no se crea hasta que el dueño diga
     «No es la misma»: crearla sin mirar es el mismo préstamo dos veces. */
  if (f._repetidaDe && !f.noEsLaMisma) return 'rojo'

  /* ⚠ ÁMBAR SOLO POR LO QUE NO SE PUEDE RESOLVER. La tasa y el plazo ahora
     SIEMPRE tienen valor —el de arriba o el del defecto— así que marcarlos en
     ámbar sería pedir revisar algo que ya está decidido. */

  /* Lo primero: si el lector dejó una duda concreta en esta fila, ahí sí hay
     algo que mirar, y la fila lo dice con el campo por su nombre. */
  if (f._dudas?.length) return 'ambar'
  // Un abono que parece escrito en miles: la fila lo pregunta al abrirla.
  if (abonoSinResolver({ abono: f.yaAbonado, montoPrestado: e.monto, confirmado: f.abonoConfirmado })) return 'ambar'

  if (!f.frecuencia) return 'ambar'

  /* ⚠ Y EL PLAZO SOLO SE PIDE DONDE EXISTE. Se vio en la pantalla, no en el
     código: con la tabla de un cliente —cuarenta préstamos de interés mensual—
     salían las SEIS filas diciendo «Revisar», incluidas las que estaban
     perfectas, porque esa hoja no trae «cuántos cobros» en ninguna parte. Y si
     todo está marcado, nada está marcado: el prestamista deja de mirar. */
  if (!MODOS_SIN_PLAZO.includes(e.modoInteres) && !(Number(f.plazoUnidades) > 0)) return 'ambar'
  /* Y si la cuota del papel no es la que sale: se guardaría otra cuota y el
     cobrador cobraría otra plata (DETALLES-CARTERA #7, decisión de Carlos). */
  if (choqueDeLaFila(f, base)) return 'ambar'
  return 'verde'
}

/* Por qué está en rojo, dicho en la fila. Lo de nombre y monto es lo de
   siempre («Falta lo básico»); lo demás solo sale en la carga del dueño. */
function motivoRojo(f, base) {
  const e = efectivo(f, base)
  if (!e.nombre || !e.monto) return ROTULO.rojo
  if (!e.frecuencia) return 'Falta cada cuánto se cobra'
  if (e.tasa == null) return 'Falta el interés'
  if (f._repetidaDe && !f.noEsLaMisma) return 'Parece repetida'
  return ROTULO.rojo
}

/* Lo de arriba al abrir la pantalla. */
export function baseDeArranque(solicitud, baseInicial) {
  return solicitud
    ? { tasa: '', frecuencia: '', modoInteres: 'fijo', rutaId: '', ...(baseInicial ?? {}) }
    : { tasa: '20', frecuencia: 'diario', modoInteres: 'fijo', rutaId: '' }
}

/* Lo que dice la fila cerrada: monto, frecuencia, tasa.
   ⚠ La fila cuyo préstamo YA SE CREÓ lo dice desde `_ficha`, lo que se guardó:
   si se cambia lo de arriba después, `efectivo` daría otra cosa y la fila
   enseñaría un préstamo que no es el que existe. */
export function resumenDeLaFila(f, base) {
  if (f._prestamoId && f._ficha) {
    const c = f._ficha
    return `${formatMoney(c.monto ?? 0)} · ${c.frecuencia} ${c.tasa}% · ${etiquetaModo(c.modoInteres)}`
  }
  return `${formatMoney(efectivo(f, base).monto ?? 0)} · ${efectivo(f, base).frecuencia} ${efectivo(f, base).tasa}%`
}

/* La clave del lote del migrador: una por negocio, en el teléfono. */
function claveDelMigrador(organizationId) {
  const claveLote = `migrador:lote:${organizationId || 'sin-negocio'}`
  return claveLote
}

/* ══ DOS ENTRADAS: LAS FOTOS QUE SE SUBEN AQUÍ, O LO QUE YA LEYÓ UNA SOLICITUD ══
 *
 * Sin `filasIniciales` es el migrador de siempre (`/migrador` y el asistente).
 * Con ellas es la carga que el dueño revisa y carga: las filas que leyó una
 * `SolicitudCarga`, y cada préstamo creado se APUNTA en ella (`onCreada`) antes
 * de salir del lote. Si no se apunta, el préstamo existe y la solicitud no lo
 * sabe: al volver a entrar la fila saldría otra vez y se crearía dos veces.
 *
 *   filasIniciales  filas de `filasParaLote` (lib/carga-asesor/al-lote.js)
 *   creadas         ids de fila ya creados: no salen nunca
 *   baseInicial     lo de arriba, de «Cómo prestas por defecto» del negocio
 *   claveLote       dónde se guarda el lote en el teléfono (`carga:<id>`)
 *   enlaceArchivo   (n) => url del archivo original; tipoArchivo (n) => 'imagen'|'excel'|'pdf'
 *   onCreada        (fila, { clienteId, prestamoId }) => Promise: apuntar el préstamo
 *   onQuitadas      (ids) => quitó las últimas filas sin crear: se cierra la solicitud
 *   sinSubir        sin los botones de galería y cámara
 *   bloqueada       la página sabe que el servidor ya no deja crear (sube más
 *                   archivos, pide ayuda): no se crea ni se quita nada nuevo
 *   onCreando       (bool) => avisa cuándo empieza y acaba «Crear», para que la
 *                   página no desmonte el lote ni cambie la carga a mitad
 *   solicitudId     el id de la `SolicitudCarga`: con él, reintentar «Crear»
 *                   tras un corte de red no repite clientes ni préstamos
 *                   (`marcadorDeFila`, `idempotente`; ver `crear`)
 */
export default function LoteFotos({
  rutas = [], onListo, onSalir,
  filasIniciales, creadas, baseInicial, claveLote: claveDeFuera,
  enlaceArchivo, tipoArchivo, onCreada, onQuitadas, sinSubir = false,
  bloqueada = false, onCreando, solicitudId,
}) {
  const solicitud = Array.isArray(filasIniciales)
  /* ⚠ DOS ENTRADAS, NO UNA. La única que había llevaba `capture="environment"`
     y el botón decía «Elegir las fotos»: en Android `capture` abre la CÁMARA
     directamente y, con él puesto, el navegador IGNORA el `multiple`. O sea que
     la pantalla prometía «hasta 30 fotos de una vez» y daba una foto por vez,
     y quien ya tenía fotografiado el cuaderno no podía escoger nada.
     Es el mismo reparto que ya usa la ficha del cliente: galería y cámara
     separadas, cada una con su botón. */
  const inputRef = useRef(null)
  const camaraRef = useRef(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')
  const [filas, setFilas] = useState([])
  const [aviso, setAviso] = useState(null)   // { porFoto, fallos, uso }
  const [soloRevisar, setSoloRevisar] = useState(false)
  const [abierta, setAbierta] = useState(null)
  const [creando, setCreando] = useState(null)  // { hechos, total, fallos: [] }
  const enCurso = !!creando
  useEffect(() => { onCreando?.(enCurso) }, [enCurso, onCreando])

  /* ── LO QUE SE PONE UNA VEZ ──
     El OCR no va a leer nunca en qué modo de interés trabaja el negocio ni a
     qué ruta va la cartera: no está escrito en la cartulina. Pedirlo por fila
     serían treinta veces la misma respuesta. */
  /* En la carga del dueño lo de arriba sale de «Cómo prestas por defecto» y, si
     no lo hay, VACÍO: nunca se supone «diario» ni «20 %», ni siquiera si la
     página no manda `baseInicial`. */
  const [base, setBase] = useState(baseDeArranque(solicitud, baseInicial))

  /* ══ EL LOTE SE QUEDA GUARDADO EN EL TELÉFONO (inducción del 18 nov 2026) ══
     «Estaba pasando su cartera tomando fotos desde el cuaderno, se salió y ya
     no pudo retomar desde donde quedó». Lo leído vivía solo en la memoria de la
     pantalla: al salir se perdía todo —y cada foto ya se había pagado por leer—.
     Ahora va al almacén del teléfono (el mismo de trabajar sin señal), por
     negocio, y al volver se ofrece seguir donde iba.
     ⚠ Las filas que se crean SALEN del lote en cuanto quedan guardadas, y el
     cliente creado se anota en su fila antes del préstamo: si sale a mitad de
     «Crear», al retomar no se duplica nadie (ver `crear`). */
  const { organizationId } = useAuth()
  const claveLote = (solicitud && claveDeFuera) || claveDelMigrador(organizationId)
  const [pendiente, setPendiente] = useState(null)   // { filas, base, guardadoEn }
  const loteLeido = useRef(false)
  useEffect(() => {
    if (!organizationId || solicitud) return
    let vivo = true
    leerDeCache(claveLote)
      .then((g) => { if (vivo && g?.filas?.length) setPendiente(g) })
      .catch(() => {})
      .finally(() => { loteLeido.current = true })
    return () => { vivo = false }
  }, [organizationId, claveLote, solicitud])
  /* ── LA CARGA DEL DUEÑO: lo que ya leyó la solicitud ──
     Arranca de lo guardado en el teléfono si lo hay (lo que el dueño corrigió no
     se pisa) y se le suma lo del servidor que no esté ya. Sin «Seguir donde
     iba»: esta carga es una sola y no hay otra que empezar.
     ⚠ LO YA CREADO SALE AUNQUE ESTUVIERA GUARDADO. Si la pantalla se cerró
     justo después de apuntar un préstamo, el teléfono aún tiene la fila; si no
     se quitara aquí, se podría crear otra vez. Las quitadas también se guardan:
     si no, al volver a entrar el servidor las devolvería. */
  const [quitadas, setQuitadas] = useState([])
  const [solicitudLista, setSolicitudLista] = useState(false)
  const creadasAqui = useRef(new Set())   // ids creados en esta pantalla, antes de que `creadas` se entere
  const servidor = useRef({ filas: filasIniciales, creadas })
  servidor.current = { filas: filasIniciales, creadas }
  const conocidas = (quit) => [...(servidor.current.creadas ?? []), ...creadasAqui.current, ...quit]
  useEffect(() => {
    if (!organizationId || !solicitud) return
    let vivo = true
    const arrancar = (g) => {
      if (!vivo) return
      const yaCreadas = new Set([...(servidor.current.creadas ?? []), ...creadasAqui.current])
      const quit = Array.isArray(g?.quitadas) ? g.quitadas : []
      const locales = (Array.isArray(g?.filas) ? g.filas : []).filter((f) => !yaCreadas.has(f._id))
      loteLeido.current = true
      setQuitadas(quit)
      setFilas(unirFilasDelLote(locales, servidor.current.filas, conocidas(quit)))
      if (g?.base) setBase(g.base)
      setSolicitudLista(true)
    }
    leerDeCache(claveLote).then(arrancar).catch(() => arrancar(null))
    return () => { vivo = false }
  }, [organizationId, claveLote, solicitud])

  /* Lo que llega del servidor DESPUÉS (la lectura sigue, o se creó algo en otro
     teléfono): se suma lo nuevo y sale lo que ya se creó. Se compara por ids,
     no por el arreglo: la página puede mandar uno nuevo en cada pintada. */
  const llaveServidor = solicitud
    ? `${(filasIniciales ?? []).map((f) => f._id).join('|')}#${(creadas ?? []).join('|')}`
    : ''
  useEffect(() => {
    if (!solicitud || !solicitudLista) return
    const yaCreadas = new Set(servidor.current.creadas ?? [])
    setFilas((prev) => unirFilasDelLote(
      prev.filter((f) => !yaCreadas.has(f._id)), servidor.current.filas, conocidas(quitadas)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llaveServidor, solicitudLista])

  useEffect(() => {
    // Mientras se ofrece el lote de antes no se pisa: la pantalla está vacía.
    if (!organizationId || !loteLeido.current || pendiente) return
    if (solicitud) {
      guardarEnCache(claveLote, filas.length || quitadas.length ? { filas, base, quitadas, guardadoEn: Date.now() } : null).catch(() => {})
      return
    }
    guardarEnCache(claveLote, filas.length ? { filas, base, guardadoEn: Date.now() } : null).catch(() => {})
  }, [filas, base, organizationId, claveLote, pendiente, solicitud, quitadas])
  const seguirLote = () => { setFilas(pendiente.filas); if (pendiente.base) setBase(pendiente.base); setPendiente(null) }
  const descartarLote = () => { guardarEnCache(claveLote, null).catch(() => {}); setPendiente(null) }

  /* ⚠ EL HUECO DEL PIE SE MIDE, NO SE ESCRIBE A MANO.
   *
   * Era `paddingBottom: 96` y la barra mide más cuando aparece el aviso de
   * «filas sin nombre o sin monto»: con la fila abierta, el pie tapaba los
   * últimos campos y no se podían tocar. Se vio midiendo con `elementFromPoint`
   * —en el JSX estaban perfectos— y lo agravé yo al añadir dos campos más.
   *
   * Un número fijo se queda corto cada vez que la barra crece, y crece por
   * contenido. Midiéndola, el hueco se ajusta solo. */
  const refPie = useRef(null)
  const [altoPie, setAltoPie] = useState(112)
  useEffect(() => {
    const pie = refPie.current
    if (!pie || typeof ResizeObserver === 'undefined') return
    const medir = () => setAltoPie(Math.ceil(pie.getBoundingClientRect().height) + 16)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(pie)
    return () => ro.disconnect()
  }, [])

  const subir = useCallback(async (e) => {
    const archivos = Array.from(e.target.files ?? [])
    if (inputRef.current) inputRef.current.value = ''
    if (!archivos.length) return
    setSubiendo(true); setError('')

    const fd = new FormData()
    archivos.forEach((f) => fd.append('fotos', f))
    try {
      const res = await fetch('/api/herramientas/leer-cartulinas-lote', { method: 'POST', body: fd })
      /* ⚠ EL `json()` VA APARTE DEL `fetch`, y no es cosmético: si la respuesta
         no es JSON —un 504 del proxy, un HTML de error, un cuerpo vacío porque
         se cortó la subida— `res.json()` lanza DENTRO del mismo `try` y el
         `catch` de abajo lo contaba como «sin conexión». Me lo comí probando en
         el espejo: la petición llegaba y respondía, y la pantalla decía que no
         había internet. Un mensaje que miente sobre la causa hace perder la
         tarde. */
      let json = null
      try { json = await res.json() } catch {
        setError(res.status === 413
          ? 'Las fotos pesan demasiado juntas. Prueba con menos de una vez.'
          : `El servidor respondió algo que no entendemos (${res.status}). Vuelve a intentarlo.`)
        setSubiendo(false); return
      }
      if (!res.ok) { setError(json?.error ?? 'No pudimos leer las fotos'); setSubiendo(false); return }

      const nuevas = (json.clientes ?? []).map((c, i) => ({
        _id: `${Date.now()}-${i}`,
        _foto: c._foto,
        nombre: c.nombre ?? '',
        cedula: c.cedula ?? '',
        telefono: c.telefono ?? '',
        direccion: c.direccion ?? '',
        /* ⚠ EL CAPITAL SALE DEL TOTAL Y DE LA TASA DE ARRIBA.
           Las cartulinas de verdad casi nunca escriben lo entregado: escriben el
           total y el plan de cobro. Mirando solo `montoPrestado`, la lectura
           salía bien y la fila llegaba vacía igual. Ver `montoConTasa`. */
        monto: montoConTasa(c, base.tasa) ?? '',
        // El default se aplica al pintar, no al guardar: así, si el usuario
        // cambia la tasa de arriba, las filas que el OCR no leyó la siguen.
        tasa: c.tasaInteres ?? '',
        frecuencia: c.frecuencia ?? '',
        /* «8 x 150» dice el número de cobros directamente y sin dividir nada.
           Antes solo se miraba `diasPlazo`, y el lector confundía los 8 cobros
           con 8 días: un préstamo de ocho semanas quedaba a ocho días. */
        plazoUnidades: c.numeroCuotas
          ? String(c.numeroCuotas)
          : c.diasPlazo && c.frecuencia
            ? Math.max(1, Math.round(c.diasPlazo / (DIAS_POR_PERIODO[c.frecuencia] || 1)))
            : '',
        fechaInicio: c.fechaInicio ?? '',
        // El estado en que va: lo que el OCR haya podido leer de las cuotas
        // tachadas, o el saldo que el prestamista se sabe de memoria.
        yaAbonado: c.montoPagadoHasta ?? '',
        // La cuota escrita en el papel: se compara con la que sale (`choqueDeLaFila`).
        cuotaLeida: Number(c.valorCuota) > 0 ? Number(c.valorCuota) : '',
        saldoPendiente: c.saldoPendiente ?? '',
        /* Lo que el lector tuvo que CORREGIR de la cartulina. Se guarda para
           enseñarlo en la fila: una cifra ajustada sin decirlo es una cifra
           inventada desde el punto de vista del prestamista, que tiene el papel
           delante y ve otro número. */
        _avisos: [c._avisoTotal, c._avisoAbonado].filter(Boolean),
        /* Qué CELDA mirar y qué dice el papel. Ver `lib/cartulina-dudas.js`. */
        _dudas: c._dudas ?? [],
        // El día del mes, cuando el papel traía eso en vez de una fecha.
        diaCobro: c.diaCobro ?? '',
        _ia: c,   // lo que trajo la IA, tal cual, para la telemetría
      }))
      // Se ACUMULAN: se sube el cuaderno por tandas, no de una sola vez.
      setFilas((prev) => [...prev, ...nuevas])
      setAviso({
        porFoto: json.porFoto ?? [], fallos: json.fallos ?? [], uso: json.uso,
        /* El cuadre contra el total escrito en la hoja: lo único que detecta AL
           PESO si se quedó alguien sin leer. Ver `cuadreDelTotal`. */
        cuadres: json.cuadres ?? [],
      })
    } catch (e) {
      // Aquí sí es la red: el `fetch` ni llegó.
      setError(`No se pudo enviar: ${e?.message ?? 'sin conexión'}. Prueba con menos fotos.`)
    } finally {
      setSubiendo(false)
    }
  }, [])

  const editar = (id, campo, valor) =>
    setFilas((prev) => prev.map((f) => {
      if (f._id !== id) return f
      /* ⚠ CORREGIR UN CAMPO BORRA SU DUDA. Sin esto, el aviso se queda puesto
         aunque ya lo hayas arreglado —y la fila en ámbar para siempre—, que es
         la forma más rápida de enseñarle a alguien a ignorar los avisos.
         `monto` cubre las dudas que hablan del importe; el resto casa por
         nombre de campo. */
      const dudas = (f._dudas ?? []).filter((d) => d.campo !== campo)
      return { ...f, [campo]: valor, _dudas: dudas }
    }))
  const quitarDelLote = (id) => setFilas((prev) => prev.filter((f) => f._id !== id))
  /* En la carga del dueño, lo quitado se apunta: la solicitud no se puede
     cerrar mientras le queden filas sin crear ni quitar. Si se quitan las
     últimas sin crear nada más, la página la cierra (`onQuitadas`). */
  const avisarQuitadas = useRef(false)   // se quitaron las últimas: avisar a la página
  const quitar = (id) => {
    if (!solicitud) { quitarDelLote(id); return }
    // Mientras se crea no se quita nada: la fila podría estar creándose ahora mismo.
    // Ni con la carga bloqueada: quitar la última la cerraría (`onQuitadas`).
    if (creando || bloqueada) return
    /* Con el estado de verdad (`prev`), no con el de la última pintada: dos
       toques seguidos sobre filas distintas verían la lista vieja. El aviso a
       la página va en un efecto, no dentro del `setFilas` (React puede llamar
       dos veces a la función que se le pasa). */
    setQuitadas((q) => (q.includes(id) ? q : [...q, id]))
    setFilas((prev) => {
      const quedan = prev.filter((f) => f._id !== id)
      if (!quedan.length && prev.length) avisarQuitadas.current = true
      return quedan
    })
  }
  useEffect(() => {
    if (!avisarQuitadas.current || filas.length) return
    avisarQuitadas.current = false
    onQuitadas?.(quitadas)
  }, [filas, quitadas, onQuitadas])

  const conEstado = filas.map((f) => ({ ...f, _estado: estadoDe(f, base) }))
  const cuenta = {
    verde: conEstado.filter((f) => f._estado === 'verde').length,
    ambar: conEstado.filter((f) => f._estado === 'ambar').length,
    rojo: conEstado.filter((f) => f._estado === 'rojo').length,
  }
  const visibles = soloRevisar ? conEstado.filter((f) => f._estado !== 'verde') : conEstado
  /* ⚠ LA FILA CUYO PRÉSTAMO YA EXISTE ES CREABLE SIEMPRE: solo le falta
     apuntarlo. Si se cambiara lo de arriba y se pusiera en rojo, se quedaría
     sin apuntar para siempre. */
  const creables = conEstado.filter((f) => f._prestamoId || f._estado !== 'rojo')
  const rojasSinCrear = conEstado.filter((f) => f._estado === 'rojo' && !f._prestamoId).length
  // ¿$80 o $80.000? Mientras alguna fila no conteste, no se crea nada de la tanda.
  const abonosPorResolver = creables.filter((f) => !f._prestamoId && abonoSinResolver({ abono: f.yaAbonado, montoPrestado: efectivo(f, base).monto, confirmado: f.abonoConfirmado })).length

  /* ── CREAR ──
     De tres en tres. En serie, treinta clientes son sesenta viajes seguidos y
     el teléfono parece colgado; todos a la vez, el servidor recibe sesenta
     peticiones de golpe. Y va contando: quien sube su cuaderno entero necesita
     ver que avanza. */
  const crear = async () => {
    if (abonosPorResolver || bloqueada) return
    /* ⚠ SIN CÓMO APUNTAR, NO SE CREA NADA. En la carga del dueño, un préstamo
       creado y no apuntado en la solicitud vuelve a salir al entrar otra vez y
       se crearía dos veces. Es un fallo de la página que monta esto, no del
       dueño: se dice y no se toca la plata. */
    if (solicitud && typeof onCreada !== 'function') {
      console.error('LoteFotos: modo solicitud sin onCreada; no se crea nada')
      setError(SIN_APUNTAR)
      return
    }
    setCreando({ hechos: 0, total: creables.length, fallos: [] })
    const fallos = []
    let hechos = 0
    const creados = []

    const A_LA_VEZ = 3
    for (let i = 0; i < creables.length; i += A_LA_VEZ) {
      const tanda = creables.slice(i, i + A_LA_VEZ)
      await Promise.all(tanda.map(async (f) => {
        /* ⚠ EL CLIENTE QUE YA QUEDÓ GUARDADO NO SE VUELVE A CREAR (DETALLES-
           CARTERA #1). Si el cliente entró y su préstamo no, la fila se queda
           con `_clienteId`: el reintento crea SOLO el préstamo. Antes volvía a
           crear el cliente —409 «ya existe» con cédula, o un duplicado sin
           ella— y esa persona se quedaba sin préstamo y sin salida. */
        let clienteId = f._clienteId || null
        /* ⚠ Y EL PRÉSTAMO QUE YA SE CREÓ, TAMPOCO. En la carga del dueño, si se
           creó pero no se pudo apuntar en la solicitud, la fila se queda con
           `_prestamoId`: el reintento SOLO lo apunta. Crearlo otra vez sería
           el mismo préstamo dos veces, con su desembolso. */
        let prestamoId = f._prestamoId || null
        try {
          /* ⚠ `modoInteres` sale de `efectivo`, que ya cae al de la tanda si la
             fila no tiene el suyo. Antes se cogía `base.modoInteres` a pelo, así
             que aunque la fila dijera «Globo» se guardaba el de arriba: el
             selector de la fila no habría hecho nada. */
          const { monto, tasa, frecuencia, plazoUnidades: plazo, modoInteres } = efectivo(f, base)
          const diasPlazo = plazo * (DIAS_POR_PERIODO[frecuencia] || 1)

          if (!prestamoId) {
            if (!clienteId) {
              const resC = await fetch('/api/clientes', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  nombre: f.nombre.trim(),
                  // Sin cédula el API la rechaza, y la cartulina casi nunca la
                  // trae: 1.683 clientes de producción ya viven con este marcador.
                  /* ⚠ EN LA CARGA DEL DUEÑO, EL MISMO EN CADA INTENTO (piloto
                     del 22 nov 2026). Con el aleatorio, el cliente que entró
                     justo antes de cortarse la red se creaba otra vez al
                     reintentar. `marcadorDeFila` sale de la solicitud y la
                     fila: `/api/clientes` lo reconoce y contesta 409. */
                  cedula: f.cedula?.trim() || (solicitud && marcadorDeFila(solicitudId, f._id)) || `SIN-${Date.now()}${Math.floor(Math.random() * 1000)}`,
                  telefono: f.telefono?.trim() || '',
                  ...(f.direccion?.trim() && { direccion: f.direccion.trim() }),
                  ...(base.rutaId && { rutaId: base.rutaId }),
                }),
              })
              const dataC = await resC.json()
              /* En la carga del dueño, «ya existe» es el cliente que creó el
                 intento anterior (o el que ya tenía esa cédula en el negocio):
                 se sigue con él. Si está bloqueado en otra ruta, no. */
              if (solicitud && resC.status === 409 && dataC.existingId && !dataC.bloqueada) {
                clienteId = dataC.existingId
              } else if (!resC.ok) {
                throw new Error(dataC.error || 'no se pudo crear el cliente')
              } else {
                clienteId = dataC.id
              }
              // Anotado YA: si sale antes del préstamo, al retomar no lo crea otra vez.
              const idCliente = clienteId
              setFilas((prev) => prev.map((x) => (x._id === f._id ? { ...x, _clienteId: idCliente } : x)))
            }

            const resP = await fetch('/api/prestamos', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clienteId,
                montoPrestado: monto,
                tasaInteres: tasa,
                diasPlazo,
                fechaInicio: inicioDeLaFila(f, base),
                frecuencia,
                // Ya estaba en la calle: no es plata de hoy (DETALLES-CARTERA #2).
                yaEstabaEnLaCalle: true,
                modoInteres,
                /* El día del mes en que cobra, cuando el papel solo traía eso.
                   `Prestamo.diaCobroMes` ya existe: sin pasarlo, el préstamo
                   estrena un calendario que no es el que el prestamista cobra. */
                ...(Number.isInteger(f.diaCobro) && { diaCobroMes: f.diaCobro }),
                ...(Number(f.yaAbonado) > 0 && { yaAbonado: Number(f.yaAbonado) }),
                /* Si el navegador cortó el intento anterior y el servidor sí lo
                   creó, devuelve ese mismo (`yaExistia`) en vez de otro.
                   ⚠ NO EN LA FILA QUE EL DUEÑO DIJO «NO ES LA MISMA». Esa fila
                   salió «Repetida» porque trae la misma cédula y la misma huella
                   que otra: con `idempotente`, el servidor le devolvería el
                   préstamo de la otra y el segundo se perdería sin aviso. El
                   dueño dijo que son dos préstamos. Se acepta el riesgo, raro,
                   de que un corte de red justo en esa fila la cree dos veces. */
                ...(solicitud && f.noEsLaMisma !== true && { idempotente: true }),
              }),
            })
            const dataP = await resP.json()
            if (!resP.ok) throw new Error(`${dataP.error || 'no se pudo crear el préstamo'}. ${f.nombre?.trim() || 'El cliente'} ya quedó guardado: al tocar «Crear» otra vez se guarda solo su préstamo`)
            prestamoId = dataP.id
          }

          /* Se devuelve la ficha ENTERA, no solo los ids: la pantalla de
             `/migrador` pinta un resumen de cartera con el capital y el total a
             cobrar, y para eso necesita el monto, la tasa y el plazo de cada
             uno. Devolver solo el id la obligaría a volver a pedirlos. */
          /* La ficha de un préstamo creado en un intento anterior es la que se
             guardó entonces (`_ficha`), no la de la fila ahora. */
          const ficha = f._ficha ?? {
            nombre: f.nombre.trim(),
            cedula: f.cedula?.trim() ?? '',
            telefono: f.telefono?.trim() ?? '',
            direccion: f.direccion?.trim() ?? '',
            monto, tasa,
            frecuencia, plazoUnidades: plazo,
            modoInteres,
            fechaInicio: inicioDeLaFila(f, base),
            diasSinCobro: [],
            clienteId, prestamoId,
          }

          /* ── ⚠ APUNTADO EN LA SOLICITUD ANTES DE SALIR DEL LOTE ──
             El préstamo se anota primero en la fila (si se cierra la pantalla
             ahora, el teléfono ya sabe que existe) y se espera a que la
             solicitud lo apunte. Si no se pudo, la fila se queda con su
             préstamo y el reintento solo lo apunta. */
          if (onCreada) {
            const idCliente = clienteId, idPrestamo = prestamoId
            setFilas((prev) => prev.map((x) => (x._id === f._id ? { ...x, _clienteId: idCliente, _prestamoId: idPrestamo, _ficha: ficha } : x)))
            try {
              await onCreada(f, { clienteId, prestamoId })
            } catch {
              throw new Error(NO_APUNTADA)
            }
          }
          creadasAqui.current.add(f._id)

          creados.push(ficha)
          // Guardada: sale del lote en el acto (no al final de la tanda entera).
          setFilas((prev) => prev.filter((x) => x._id !== f._id))
        } catch (e) {
          // El motivo viaja PEGADO A LA FILA, no en una lista aparte: «1 no se
          // pudo crear» sin decir cuál ni por qué es un callejón sin salida.
          fallos.push({ _id: f._id, nombre: f.nombre || '(sin nombre)', error: e.message, clienteId, prestamoId })
        }
        hechos++
        setCreando({ hechos, total: creables.length, fallos: [...fallos] })
      }))
    }

    // ── Telemetría: qué trajo la IA y qué quedó guardado ──
    // No hay forma de saber si el OCR acierta sin fotos de prueba; esto lo
    // averigua solo, con los primeros usuarios reales.
    // En la carga del dueño no hay qué medir: esas filas no vienen de la IA de fotos.
    if (!solicitud) {
    fetch('/api/herramientas/precision-cartulina', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filas: creables.map((f) => ({
          ia: f._ia,
          final: {
            nombre: f.nombre, cedula: f.cedula, telefono: f.telefono, direccion: f.direccion,
            montoPrestado: efectivo(f, base).monto,
            tasaInteres: efectivo(f, base).tasa,
            frecuencia: efectivo(f, base).frecuencia,
            diasPlazo: efectivo(f, base).plazoUnidades,
          },
        })),
      }),
    }).catch(() => {})
    }

    setCreando(null)

    /* ── ⚠ SI ALGUNA FALLÓ, NO SE SALE DE LA PANTALLA ──
       Antes navegaba igual y dejaba un «1 no se pudo crear» en un mensaje que
       se va a los seis segundos: el usuario perdía la fila y el motivo, y no
       tenía forma de reintentarla sin volver a fotografiar.

       Las que se crearon se van —ya están guardadas, repetirlas sería
       duplicarlas— y las que fallaron se quedan con su motivo escrito, listas
       para corregir y volver a pulsar. */
    /* ⚠ EN LA CARGA DEL DUEÑO NO SE TIRA NINGUNA FILA. En el migrador las rojas
       «se quedan fuera»: no se crean y se van. Aquí cada fila de la solicitud
       tiene que acabar creada o quitada A PROPÓSITO —si no, la solicitud no se
       puede cerrar y lo que se tiró sin decir vuelve a salir—, así que las que
       no se crearon se quedan en la lista. */
    if (solicitud) {
      const conFallo = new Map(fallos.map((x) => [x._id, x]))
      setFilas((prev) => prev.map((f) => {
        const x = conFallo.get(f._id)
        if (!x) return f
        return { ...f, _error: x.error, _clienteId: x.clienteId || f._clienteId || null, _prestamoId: x.prestamoId || f._prestamoId || null }
      }))
      if (fallos.length) {
        setError(creados.length
          ? `Se guardaron ${creados.length}. Estos ${fallos.length} no: revisa el motivo en cada uno.`
          : `No se pudo guardar ninguno. El motivo está en cada fila.`)
      }
      const quedan = filas.filter((f) => !creadasAqui.current.has(f._id)).length
      onListo?.({ creados, fallos, ...(quedan > 0 && { quedanFilas: true }), quitadas })
      return
    }

    if (fallos.length) {
      const conFallo = new Map(fallos.map((x) => [x._id, x]))
      setFilas((prev) => prev
        .filter((f) => conFallo.has(f._id))
        .map((f) => ({ ...f, _error: conFallo.get(f._id).error, _clienteId: conFallo.get(f._id).clienteId || f._clienteId || null })))
      setError(creados.length
        ? `Se guardaron ${creados.length}. Estos ${fallos.length} no: revisa el motivo en cada uno.`
        : `No se pudo guardar ninguno. El motivo está en cada fila.`)
      onListo?.({ creados, fallos, quedanFilas: true })
      return
    }

    setFilas([])
    onListo?.({ creados, fallos })
  }

  // ══ VACÍO: todavía no ha subido nada ══
  // (Mientras se crea, las filas van saliendo: sin `!creando` la pantalla
  // volvía a «sube tus fotos» antes de terminar la última tanda.)
  /* La carga del dueño, mientras se lee lo guardado en el teléfono: sin esto se
     vería un instante «Tómale foto a todo el cuaderno». */
  if (solicitud && !solicitudLista) {
    return (
      <div role="status" style={{ padding: '22px 18px', fontSize: 14, color: 'var(--cf-ink-3)', textAlign: 'center' }}>
        Cargando lo que se leyó…
      </div>
    )
  }

  if (solicitud && !filas.length && !creando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div role="status" style={{
          padding: '22px 18px', borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)',
          border: '1px solid var(--cf-border)', display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--cf-ink)' }}>No queda nada por cargar</span>
          <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
            Todas las filas de esta carga ya se crearon o se quitaron.
          </span>
        </div>
        {error && (
          <div style={{
            padding: '12px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.4,
            background: 'var(--cf-red-pill-bg)', border: '1px solid var(--cf-red-pill-border)',
            color: 'var(--cf-red-dark)',
          }}>{error}</div>
        )}
      </div>
    )
  }

  if (!filas.length && !creando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {pendiente && (
          <div role="status" style={{
            padding: '16px 18px', borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)',
            border: '1.5px solid var(--cf-gold)', display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--cf-ink)' }}>Tienes una carga sin terminar</span>
              <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--cf-ink-2)' }}>
                {pendiente.filas.length} {pendiente.filas.length === 1 ? 'cartulina leída' : 'cartulinas leídas'} que todavía no se guardaron
                {pendiente.guardadoEn ? `, del ${new Date(pendiente.guardadoEn).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}` : ''}.
                Sigue donde ibas: no hay que volver a tomar las fotos.
              </span>
            </div>
            <BotonPrimario onClick={seguirLote}>Seguir donde iba</BotonPrimario>
            <button type="button" onClick={descartarLote} style={{
              height: 40, border: 0, background: 'none', cursor: 'pointer', font: 'inherit',
              fontSize: 14, fontWeight: 600, color: 'var(--cf-ink-3)', textDecoration: 'underline', textUnderlineOffset: 3,
            }}>Empezar de nuevo</button>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" multiple
          onChange={subir} style={{ display: 'none' }} />
        <input ref={camaraRef} type="file" accept="image/*" capture="environment"
          onChange={subir} style={{ display: 'none' }} />

        <div style={{
          padding: '22px 18px', borderRadius: 'var(--cf-r-card)',
          background: 'var(--cf-gold-tint-2)', border: '1px solid var(--cf-gold-border)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--cf-ink)' }}>
            Tómale foto a todo el cuaderno
          </span>
          <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--cf-ink-2)' }}>
            Hasta 30 fotos de una vez. Sirve una cartulina por cliente y también
            una hoja con la lista de todos: leemos lo que haya en cada foto y te
            lo dejamos en una lista para que revises antes de guardar.
          </span>
        </div>

        {error && (
          <div style={{
            padding: '12px 14px', borderRadius: 12, fontSize: 13, lineHeight: 1.4,
            background: 'var(--cf-red-pill-bg)', border: '1px solid var(--cf-red-pill-border)',
            color: 'var(--cf-red-dark)',
          }}>{error}</div>
        )}

        {!sinSubir && (
          <BotonPrimario onClick={() => inputRef.current?.click()} disabled={subiendo}>
            {subiendo ? 'Leyendo las fotos…' : 'Elegir las fotos'}
          </BotonPrimario>
        )}

        {/* La cámara sigue estando, pero de segunda: casi todo el mundo
            fotografía el cuaderno primero y sube después, y es la única vía que
            admite las 30 de una vez. */}
        {!subiendo && !sinSubir && (
          <button type="button" onClick={() => camaraRef.current?.click()} style={{
            background: 'none', border: 0, cursor: 'pointer', font: 'inherit',
            fontSize: 13, fontWeight: 700, color: 'var(--cf-ink-2)', padding: 8,
            textDecoration: 'underline', textUnderlineOffset: 3,
          }}>Tomarlas ahora con la cámara</button>
        )}

        {subiendo && (
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)', textAlign: 'center' }}>
            Puede tardar un minuto. No cierres la pantalla.
          </span>
        )}

        {onSalir && (
          <button type="button" onClick={onSalir} style={{
            background: 'none', border: 0, cursor: 'pointer', font: 'inherit',
            fontSize: 13, fontWeight: 700, color: 'var(--cf-ink-3)', padding: 8,
          }}>Prefiero escribirlos a mano</button>
        )}
      </div>
    )
  }

  // ══ LA REVISIÓN ══
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: altoPie }}>
      <input ref={inputRef} type="file" accept="image/*" multiple
        onChange={subir} style={{ display: 'none' }} />
      <input ref={camaraRef} type="file" accept="image/*" capture="environment"
        onChange={subir} style={{ display: 'none' }} />

      {/* Lo que se pone UNA vez y vale para todas */}
      <div style={{
        padding: 14, borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)',
        border: '1px solid var(--cf-border)', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)' }}>
          Vale para todos estos préstamos
        </span>
        <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--cf-ink-3)' }}>
          Esto no está escrito en la cartulina, así que se pone aquí una vez. Si
          alguno va distinto, lo cambias en su fila.
        </span>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ flex: '1 1 120px', minWidth: 0 }}>
            <EtiquetaCampo>Interés</EtiquetaCampo>
            <input
              type="text" inputMode="decimal" value={base.tasa}
              onChange={(e) => setBase((b) => ({ ...b, tasa: e.target.value.replace(/[^\d.,]/g, '') }))}
              style={{
                width: '100%', height: 46, padding: '0 12px', borderRadius: 'var(--cf-r-control)',
                border: '1px solid var(--cf-border-strong)', background: 'var(--cf-card)',
                color: 'var(--cf-ink)', font: 'inherit', fontSize: 15, fontWeight: 700,
              }} />
          </label>
          <label style={{ flex: '2 1 180px', minWidth: 0 }}>
            <EtiquetaCampo>Cada cuánto se cobra</EtiquetaCampo>
            <select
              value={base.frecuencia}
              onChange={(e) => setBase((b) => ({ ...b, frecuencia: e.target.value }))}
              style={{
                width: '100%', height: 46, padding: '0 12px', borderRadius: 'var(--cf-r-control)',
                border: '1px solid var(--cf-border-strong)', background: 'var(--cf-card)',
                color: 'var(--cf-ink)', font: 'inherit', fontSize: 15, fontWeight: 700,
              }}>
              {/* Sin frecuencia arriba (el negocio no la tiene), el selector lo dice:
                  enseñar «Diario» con el valor vacío sería decir una y guardar otra. */}
              {!base.frecuencia && <option value="">Elige cada cuánto</option>}
              {FRECUENCIAS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </label>
        </div>

        {/* ── ⚠ EL MODO, TAMBIÉN AQUÍ ARRIBA ────────────────────────────────
            Estaba solo en el estado interno, con «cuota fija» fijo y sin forma
            de cambiarlo. Se vio en la pantalla: con la tabla de un cliente
            —cuarenta préstamos donde solo se cobra el interés cada mes— había
            que entrar fila por fila a corregirlo cuarenta veces, o importarlos
            todos mal.

            Va donde va la tasa y la frecuencia, y por la misma razón que dice
            esta tarjeta: no está escrito en el papel, se pone una vez, y la fila
            que sea distinta lo cambia en la suya. */}
        <label>
          <EtiquetaCampo>Cómo les cobras</EtiquetaCampo>
          <select
            value={base.modoInteres}
            onChange={(e) => setBase((b) => ({ ...b, modoInteres: e.target.value }))}
            style={{
              width: '100%', height: 46, padding: '0 12px', borderRadius: 'var(--cf-r-control)',
              border: '1px solid var(--cf-border-strong)', background: 'var(--cf-card)',
              color: 'var(--cf-ink)', font: 'inherit', fontSize: 15, fontWeight: 700,
            }}>
            {MODOS.map((m) => <option key={m.valor} value={m.valor}>{m.nombre}</option>)}
          </select>
        </label>

        {rutas.length > 0 && (
          <label>
            <EtiquetaCampo>A qué ruta van</EtiquetaCampo>
            <select
              value={base.rutaId}
              onChange={(e) => setBase((b) => ({ ...b, rutaId: e.target.value }))}
              style={{
                width: '100%', height: 46, padding: '0 12px', borderRadius: 'var(--cf-r-control)',
                border: '1px solid var(--cf-border-strong)', background: 'var(--cf-card)',
                color: 'var(--cf-ink)', font: 'inherit', fontSize: 15, fontWeight: 700,
              }}>
              <option value="">Sin ruta por ahora</option>
              {rutas.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </label>
        )}
      </div>

      {/* El recuento y el filtro */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip activo={!soloRevisar} onClick={() => setSoloRevisar(false)} conteo={filas.length}>Todos</Chip>
        <Chip activo={soloRevisar} onClick={() => setSoloRevisar(true)} conteo={cuenta.ambar + cuenta.rojo}>
          Hay que revisar
        </Chip>
        {!sinSubir && (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={subiendo}
            style={{
              marginLeft: 'auto', height: 36, padding: '0 12px', cursor: 'pointer',
              borderRadius: 'var(--cf-r-pill)', background: 'var(--cf-card)',
              border: '1px solid var(--cf-border-strong)', font: 'inherit',
              fontSize: 12, fontWeight: 700, color: 'var(--cf-ink-2)',
            }}>
            {subiendo ? 'Leyendo…' : '+ Más fotos'}
          </button>
        )}
      </div>

      {/* ── ⚠ EL CUADRE CONTRA EL TOTAL DE LA HOJA ──────────────────────────
          Estas tablas traen su propia suma abajo, y compararla con lo leído es
          lo ÚNICO que dice al peso si falta alguien. Medido contra la captura
          real de un cliente el 31 ago 2026: el lector sacó 21 clientes que
          sumaban $79.814.000 donde la hoja decía $86.814.000, y esos $7.000.000
          de diferencia eran EXACTAMENTE los tres préstamos que se había dejado
          —dos clientes enteros y el segundo préstamo de un tercero—.

          Ninguna medida de confianza encuentra eso. Una resta sí. */}
      {aviso?.cuadres?.map((c) => (
        <div key={c.foto} style={{
          padding: '11px 13px', borderRadius: 12, fontSize: 13, lineHeight: 1.45,
          background: 'var(--cf-gold-bg)', border: '1px solid var(--cf-gold-border)',
          color: 'var(--cf-gold-text-2)',
        }}>
          <b>Foto {c.foto}:</b> {c.texto}
        </div>
      ))}

      {aviso?.fallos?.length > 0 && (
        <div style={{
          padding: '11px 13px', borderRadius: 12, fontSize: 12, lineHeight: 1.45,
          background: 'var(--cf-gold-bg)', border: '1px solid var(--cf-gold-border)',
          color: 'var(--cf-gold-text-2)',
        }}>
          {aviso.fallos.length === 1 ? 'Una foto no se pudo leer' : `${aviso.fallos.length} fotos no se pudieron leer`}
          {' '}({aviso.fallos.map((f) => `#${f.foto}`).join(', ')}). Vuelve a tomarlas con más luz.
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 14px', borderRadius: 12, fontSize: 13,
          background: 'var(--cf-red-pill-bg)', border: '1px solid var(--cf-red-pill-border)',
          color: 'var(--cf-red-dark)',
        }}>{error}</div>
      )}

      {/* Las filas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibles.map((f) => (
          <Fila
            key={f._id} f={f} base={base} rutas={rutas}
            enlaceArchivo={enlaceArchivo} tipoArchivo={tipoArchivo}
            abierta={abierta === f._id}
            onAbrir={(caja) => {
              const abrir = abierta !== f._id
              setAbierta(abrir ? f._id : null)
              /* ⚠ AL ABRIR, LA FILA SE TRAE A LA VISTA.
                 El pie es fijo, así que una fila abierta a media pantalla deja
                 sus últimos campos DEBAJO de él: existen, se ven a medias y no
                 se pueden tocar. Se cazó con `elementFromPoint`, no leyendo el
                 JSX. El hueco del final no lo arregla —la fila está en medio de
                 la lista, no al final—; traerla arriba, sí.

                 En el cuadro siguiente, cuando el desplegable ya tiene su
                 altura: hacerlo antes lo calcula sobre la fila cerrada. */
              if (abrir && caja) {
                requestAnimationFrame(() => requestAnimationFrame(() =>
                  caja.scrollIntoView({ block: 'start', behavior: 'smooth' })))
              }
            }}
            onEditar={(campo, valor) => editar(f._id, campo, valor)}
            onQuitar={() => quitar(f._id)}
          />
        ))}
      </div>

      {/* El pie, fijo: es la acción por la que se abrió esta pantalla */}
      <div ref={refPie} style={{
        position: 'fixed', left: 0, right: 0,
        bottom: 'calc(var(--cf-nav-inset, 0px) + env(safe-area-inset-bottom, 0px))',
        padding: '12px 16px 14px', background: 'var(--cf-card)',
        borderTop: '1px solid var(--cf-border)', zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {solicitud && rojasSinCrear > 0 && (
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)', textAlign: 'center' }}>
            {rojasSinCrear === 1 ? 'Una fila en rojo no se crea' : `${rojasSinCrear} filas en rojo no se crean`}: ábrelas para ver qué les falta, o quítalas.
          </span>
        )}
        {!solicitud && cuenta.rojo > 0 && (
          <span style={{ fontSize: 12, color: 'var(--cf-ink-3)', textAlign: 'center' }}>
            {cuenta.rojo === 1 ? 'Una fila' : `${cuenta.rojo} filas`} sin nombre o sin monto se {cuenta.rojo === 1 ? 'queda' : 'quedan'} fuera
          </span>
        )}
        {abonosPorResolver > 0 && (
          <span role="alert" style={{ fontSize: 12, fontWeight: 600, color: 'var(--cf-gold-text-2)', textAlign: 'center' }}>
            {abonosPorResolver === 1 ? 'Una fila tiene' : `${abonosPorResolver} filas tienen`} un abono por revisar: ábrelas en «¿Ya te ha abonado algo?».
          </span>
        )}
        <BotonPrimario onClick={crear} disabled={!creables.length || !!creando || abonosPorResolver > 0 || bloqueada}>
          {creando
            ? `Creando… ${creando.hechos} de ${creando.total}`
            : `Crear ${creables.length} cliente${creables.length === 1 ? '' : 's'}`}
        </BotonPrimario>
      </div>
    </div>
  )
}

/* ══ UNA FILA ══
   Cerrada enseña lo que decide si hay que abrirla: el semáforo, el nombre y el
   monto. Abierta, todo lo demás. Con treinta filas, una tarjeta completa cada
   una es una pantalla de scroll infinito donde no se distingue cuál falta. */
/* De qué archivo salió la fila, dicho como lo diría el dueño. */
function nombreDelArchivo(f, tipoArchivo) {
  const n = f._archivo
  if (tipoArchivo?.(n) === 'imagen') return `foto ${n}`
  if (f._hoja) return `Excel, hoja ${f._hoja}`
  return `archivo ${n}`
}

function Fila({ f, base, onAbrir, abierta, onEditar, onQuitar, enlaceArchivo, tipoArchivo }) {
  const refCaja = useRef(null)
  const color = COLOR[f._estado]
  /* El préstamo de esta fila YA EXISTE, solo falta apuntarlo: no se edita ni se
     quita. Cambiarle el monto aquí no cambiaría el préstamo creado, y quitarla
     dejaría un préstamo de verdad sin apuntar en la solicitud. */
  const yaCreada = !!f._prestamoId
  const repetida = f._repetidaDe && !f.noEsLaMisma && !yaCreada
  // Lo que se dice cuando está en rojo; la repetida lo explica en su renglón.
  const motivo = f._estado === 'rojo' && !yaCreada ? motivoRojo(f, base) : null
  const soloRepetida = motivo === 'Parece repetida'
  const boton = {
    height: 32, padding: '0 12px', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 700,
    borderRadius: 'var(--cf-r-pill)', background: 'var(--cf-card)', border: '1px solid var(--cf-border-strong)',
  }
  const campo = {
    width: '100%', height: 44, padding: '0 11px', borderRadius: 'var(--cf-r-pill)',
    border: '1px solid var(--cf-border-strong)', background: 'var(--cf-card)',
    color: 'var(--cf-ink)', font: 'inherit', fontSize: 14,
  }

  return (
    <div ref={refCaja} style={{
      borderRadius: 'var(--cf-r-card)', background: 'var(--cf-card)',
      border: `1px solid ${f._error ? 'var(--cf-red-pill-border)' : 'var(--cf-border)'}`,
      overflow: 'hidden',
      /* ⚠ POR DEBAJO DE LA CABECERA, que también es fija. Con 12px la fila
         subía tanto que su nombre quedaba tapado por el título de la pantalla:
         se cambia un campo tapado abajo por otro tapado arriba. */
      scrollMarginTop: 76,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px' }}>
        <span aria-hidden style={{
          width: 9, height: 9, minWidth: 9, borderRadius: 999, flex: 'none', background: color,
        }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <input
            value={f.nombre} placeholder="¿Cómo se llama?"
            onChange={(e) => onEditar('nombre', e.target.value)}
            style={{
              border: 0, background: 'none', padding: 0, font: 'inherit',
              fontSize: 15, fontWeight: 700, color: 'var(--cf-ink)', minWidth: 0, width: '100%',
            }} />
          {f._error && (
            <span style={{ fontSize: 11, lineHeight: 1.35, color: 'var(--cf-red-dark)', fontWeight: 700 }}>
              {yaCreada ? f._error : `No se guardó: ${f._error}`}
            </span>
          )}
          <span className="cf-num" style={{ fontSize: 11, color: 'var(--cf-ink-3)' }}>
            {/* Del mismo resolvedor que el guardado: si la fila dice una cosa
                y se guarda otra, nadie lo nota hasta que no cuadra la plata. */}
            {motivo && !soloRepetida ? motivo : resumenDeLaFila(f, base)}
            {f._foto ? ` · foto ${f._foto}` : ''}
            {/* El original, en otra pestaña: el dueño mira la foto o la hoja de
                donde salió y confirma la cifra sin salir de la lista. */}
            {enlaceArchivo && f._archivo != null && (
              <>
                {' · '}
                <a href={enlaceArchivo(f._archivo)} target="_blank" rel="noopener"
                  style={{ color: 'var(--cf-ink-2)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                  {nombreDelArchivo(f, tipoArchivo)}
                </a>
              </>
            )}
          </span>
          {/* ── LA QUE PARECE REPETIDA ──
              El lector la vio igual a otra fila. No se crea hasta que el dueño
              decida: es la misma (se quita) o no lo es (sigue su camino). */}
          {repetida && (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 12, lineHeight: 1.4, fontWeight: 700, color: 'var(--cf-red-dark)' }}>
                Parece la misma que la fila {f._repetidaDe}
              </span>
              <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={onQuitar} style={{ ...boton, color: 'var(--cf-red-dark)' }}>Quitar</button>
                <button type="button" onClick={() => onEditar('noEsLaMisma', true)} style={{ ...boton, color: 'var(--cf-ink)' }}>No es la misma</button>
              </span>
            </span>
          )}
          {/* ⚠ SE DICE LO QUE SE CORRIGIÓ. En la cartulina de Lorena hay dos
              préstamos y el viejo está escrito arriba en grande: se toma el
              vivo, pero el prestamista tiene el papel en la mano y ve el otro
              número. Callarlo es pedirle que confíe a ciegas en la cifra de una
              foto. */}
          {f._avisos?.map((t, i) => (
            <span key={i} style={{ fontSize: 11, lineHeight: 1.35, color: 'var(--cf-gold-dark)' }}>{t}</span>
          ))}

          {/* ── LA CUOTA DEL PAPEL Y LA QUE SE VA A GUARDAR (DETALLES-CARTERA #7) ──
              Las dos cifras con su nombre y, si hay una forma de cobro que da
              la del papel, el botón para usarla. */}
          {(() => {
            // El préstamo ya creado no se cambia desde aquí: ni aviso ni botón.
            const ch = yaCreada ? null : choqueDeLaFila(f, base)
            if (!ch) return null
            return (
              <span style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--cf-ink-2)' }}>
                En la cartulina dice <b className="cf-num" style={{ color: 'var(--cf-ink)' }}>{formatMoney(ch.leida)}</b>; con {etiquetaModo(ch.modo)} sale <b className="cf-num" style={{ color: 'var(--cf-ink)' }}>{formatMoney(ch.conElModo)}</b>.
                {ch.sugerido ? (
                  <>
                    {' '}Con «{etiquetaModo(ch.sugerido)}» sale igual.{' '}
                    <button type="button" onClick={() => onEditar('modoInteres', ch.sugerido)}
                      style={{ border: 0, background: 'none', padding: 0, font: 'inherit', fontWeight: 700, color: 'var(--cf-ink)', textDecoration: 'underline', cursor: 'pointer' }}>
                      Usar «{etiquetaModo(ch.sugerido)}»
                    </button>
                  </>
                ) : ' Con ninguna forma de cobro sale esa cuota: revisa el monto, el interés o los cobros.'}
              </span>
            )
          })()}

          {/* ── QUÉ DATO MIRAR, Y QUÉ DICE EL PAPEL ──
              «Que diga qué número puede no corresponder para que el cliente sepa
              exactamente dónde tiene que arreglar.» Con cuarenta renglones, un
              semáforo por FILA obliga a repasarlos todos —más trabajo que
              teclearlos—. Aquí va el campo por su nombre y, entre comillas, lo
              que dice la foto: el prestamista la tiene delante y lo confirma de
              un vistazo, sin tener que adivinar qué entendimos mal. */}
          {f._dudas?.map((d, i) => (
            <span key={`d${i}`} style={{
              fontSize: 11, lineHeight: 1.4, color: 'var(--cf-ink-2)',
              display: 'flex', gap: 5, alignItems: 'baseline',
            }}>
              <span aria-hidden style={{
                width: 5, height: 5, borderRadius: 999, flex: 'none',
                background: 'var(--cf-gold-dark)', transform: 'translateY(-2px)',
              }} />
              <span>
                {d.texto}
                {d.dato && (
                  <> {' '}<span className="cf-num" style={{
                    color: 'var(--cf-ink)', fontWeight: 700,
                    background: 'var(--cf-fill)', padding: '1px 5px', borderRadius: 5,
                  }}>{d.dato}</span></>
                )}
              </span>
            </span>
          ))}
        </div>
        {f._estado !== 'verde' && !yaCreada && <Pastilla tono={f._estado === 'rojo' ? 'mora' : 'atraso'}>{soloRepetida ? 'Repetida' : ROTULO[f._estado]}</Pastilla>}
        {!yaCreada && (
        <button type="button" onClick={() => onAbrir(refCaja.current)} aria-label={abierta ? 'Cerrar' : 'Abrir'}
          style={{ background: 'none', border: 0, cursor: 'pointer', padding: 4, flex: 'none' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-3)"
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        )}
      </div>

      {abierta && !yaCreada && (
        <div style={{
          padding: '4px 13px 13px', display: 'flex', flexDirection: 'column', gap: 10,
          borderTop: '1px solid var(--cf-border-soft)',
        }}>
          <label>
            <EtiquetaCampo>Cuánto le prestaste</EtiquetaCampo>
            {/* ⚠ `MoneyInput` devuelve un EVENTO, no el valor —`onChange({target:{value}})`—
                y pone su propio `style`: pasarle uno lo pisa entero y se lleva
                por delante el fondo y el borde. Se usa tal cual porque es el
                campo que sabe del MODO ABREVIADO: con él encendido se escribe
                «40» y son $40.000, y un `<input>` propio se lo lleva por
                delante en silencio. Ya pasó dos veces. */}
            <MoneyInput value={String(f.monto ?? '')} onChange={(e) => onEditar('monto', e.target.value)} />
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1, minWidth: 0 }}>
              <EtiquetaCampo>Interés</EtiquetaCampo>
              <input type="text" inputMode="decimal" value={f.tasa ?? ''} placeholder={String(base.tasa)}
                onChange={(e) => onEditar('tasa', e.target.value.replace(/[^\d.,]/g, ''))} style={campo} />
            </label>
            <label style={{ flex: 1, minWidth: 0 }}>
              <EtiquetaCampo>Cuántos cobros</EtiquetaCampo>
              <input type="text" inputMode="numeric" value={f.plazoUnidades ?? ''}
                placeholder={String(PLAZO_DEFAULT[f.frecuencia || base.frecuencia])}
                onChange={(e) => onEditar('plazoUnidades', e.target.value.replace(/\D/g, ''))} style={campo} />
            </label>
          </div>

          <label>
            <EtiquetaCampo>Cada cuánto</EtiquetaCampo>
            <select value={f.frecuencia || base.frecuencia}
              onChange={(e) => onEditar('frecuencia', e.target.value)} style={campo}>
              {!(f.frecuencia || base.frecuencia) && <option value="">Elige cada cuánto</option>}
              {FRECUENCIAS.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
          </label>

          {/* ── EL MODO, POR PRÉSTAMO ──
              Antes solo se elegía para la tanda entera, y en una misma libreta
              conviven los dos casos: unos pagan cuota fija y otros pagan solo el
              interés cada mes con el capital intacto. Meter a los segundos como
              cuota fija hace que el sistema crea que la deuda se salda sola, y
              esa es la diferencia entre una cartera correcta y una inventada. */}
          <label>
            <EtiquetaCampo>Cómo le cobras</EtiquetaCampo>
            <select value={f.modoInteres || base.modoInteres || 'fijo'}
              onChange={(e) => onEditar('modoInteres', e.target.value)} style={campo}>
              {MODOS.map((m) => <option key={m.valor} value={m.valor}>{m.nombre}</option>)}
            </select>
          </label>

          {/* El día del mes, cuando el papel solo traía eso y no una fecha. */}
          {(f.diaCobro || (f.frecuencia || base.frecuencia) === 'mensual') && (
            <label>
              <EtiquetaCampo>Qué día del mes le cobras</EtiquetaCampo>
              <input type="text" inputMode="numeric" value={f.diaCobro ?? ''} placeholder="Ej: 26"
                onChange={(e) => onEditar('diaCobro', e.target.value.replace(/\D/g, '').slice(0, 2))}
                style={campo} />
            </label>
          )}

          {/* ── EN QUÉ PUNTO VA ──
              El dato que decide si la migración sirve: un préstamo a medias
              importado como nuevo le debe al prestamista todo lo ya cobrado.
              El OCR lo intenta con las cuotas tachadas; si no, el prestamista
              se sabe de memoria cuánto lleva abonado. */}
          <label>
            <EtiquetaCampo>¿Ya te ha abonado algo?</EtiquetaCampo>
            <MoneyInput value={String(f.yaAbonado ?? '')} onChange={(e) => onEditar('yaAbonado', e.target.value)} />
            <PreguntaAbonoRaro abono={f.yaAbonado} montoPrestado={efectivo(f, base).monto}
              confirmado={f.abonoConfirmado} onCorregir={(v) => onEditar('yaAbonado', v)} onConfirmar={(v) => onEditar('abonoConfirmado', v)} />
          </label>

          {/* Cuándo empezó: si el papel no lo dice y ya abonó, se calcula por lo
              abonado (`inicioDeLaFila`) y se puede corregir aquí. */}
          {(f.fechaInicio || Number(f.yaAbonado) > 0) && (
            <label>
              <EtiquetaCampo>¿Cuándo empezó?</EtiquetaCampo>
              <input type="date" value={inicioDeLaFila(f, base)} max={hoyBogota()}
                onChange={(e) => onEditar('fechaInicio', e.target.value)} style={campo} />
              {!f.fechaInicio && (
                <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--cf-ink-3)' }}>
                  Calculado por lo que lleva abonado. Cámbialo si empezó otro día.
                </span>
              )}
            </label>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1, minWidth: 0 }}>
              <EtiquetaCampo>Cédula</EtiquetaCampo>
              <input value={f.cedula ?? ''} placeholder="Si no la tienes, déjala vacía"
                onChange={(e) => onEditar('cedula', e.target.value)} style={campo} />
            </label>
            <label style={{ flex: 1, minWidth: 0 }}>
              <EtiquetaCampo>Teléfono</EtiquetaCampo>
              <input value={f.telefono ?? ''} inputMode="numeric"
                onChange={(e) => onEditar('telefono', e.target.value)} style={campo} />
            </label>
          </div>

          <label>
            <EtiquetaCampo>Dónde vive</EtiquetaCampo>
            <input value={f.direccion ?? ''} onChange={(e) => onEditar('direccion', e.target.value)} style={campo} />
          </label>

          <button type="button" onClick={onQuitar} style={{
            alignSelf: 'flex-start', background: 'none', border: 0, cursor: 'pointer',
            font: 'inherit', fontSize: 12, fontWeight: 700, color: 'var(--cf-red-dark)', padding: '6px 0',
          }}>Quitar de la lista</button>
        </div>
      )}
    </div>
  )
}
