'use client'
// app/(dashboard)/prestamos/page.jsx - Lista de préstamos

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link                                   from 'next/link'
import { useAuth }                            from '@/hooks/useAuth'
import { useOffline }                         from '@/components/providers/OfflineProvider'
import { guardarEnCache, leerDeCache, obtenerPrestamosOffline } from '@/lib/offline'
import { Button }                             from '@/components/ui/Button'
import { SkeletonCard }                       from '@/components/ui/Skeleton'
import PrestamoCard                           from '@/components/prestamos/PrestamoCard'
import TarjetaCliente                         from '@/components/cf/TarjetaCliente'
import { useSitioDeLaLista }                  from '@/hooks/useSitioDeLaLista'
import { BarraProgreso }                      from '@/components/cf/primitivos'
import { ModoInteres, Dato, CreadoPor, EtiquetaNuevo, TRAZO } from '@/components/cf/Metadatos'
import { adaptarPrestamos, tresCifras, fechaCorta, fichaDe } from '@/lib/adaptadores/prestamos'
import { BarraFiltros, EncabezadoLista, BuscadorLista } from '@/components/pantallas/ListaClientes'
import { TresCifras }                         from '@/components/pantallas/ListaPrestamos'
import HojaFiltros, { ConmutadorVista, contarFiltros } from '@/components/pantallas/HojaFiltros'
import { filtrarPrestamosGuardados } from '@/lib/adaptadores/filtro-prestamos'
import { useMontado }                         from '@/hooks/useMontado'
import { StaggeredList }                      from '@/components/ui/StaggeredList'
import HojaWhatsApp                 from '@/components/whatsapp/HojaWhatsApp'
// El cobro rapido de la tarjeta. Es el MISMO modal que la ficha del prestamo y
// que el cobro por QR: montarlo desde una lista ya es un camino probado
// (`QrCobroModal` lo hace con `{ nombre, telefono }` de cliente). Escribir aqui
// un cobro propio habria sido un segundo sitio donde se registra plata.
import RegistrarPago               from '@/components/prestamos/RegistrarPago'
import Avatar                                 from '@/components/ui/Avatar'
import { Card }                               from '@/components/ui/Card'
import MonedaCF                               from '@/components/ui/MonedaCF'
import BadgeNuevo, { NuevoChip }               from '@/components/ui/BadgeNuevo'
import { useCountry }                         from '@/hooks/useCountry'
import { formatMoney, isHoy }                 from '@/lib/i18n'

const IconWA = (
  <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)
const IconPagar = (
  <svg className="w-full h-full" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
  </svg>
)

/* ══ ¿CUÁNDO LE COBRAS? ═══════════════════════════════════════════════════
 *
 * De qué día a qué día cae el próximo cobro. La ventana entera, no un solo
 * número: «mañana» es el día 1 y SOLO el día 1 — con un número arrastraba
 * también los de hoy.
 *
 * Vive aquí arriba porque la usan los dos sitios: la fila de chips y la sección
 * de la hoja de filtros. Tenerla escrita dos veces es como acaban diciendo
 * cosas distintas. */
/* ⚠ SIN `export`: una página de Next solo puede exportar lo suyo, y con esto
   el build fallaba con «does not match the required types of a Next.js Page». */
const VENTANAS_COBRO = {
  venceHoy:    [0, 0],
  venceManana: [1, 1],
  vence2:      [2, 2],
  vence3:      [3, 3],
  vence5:      [0, 5],
  vence7:      [0, 7],
  vence10:     [0, 10],
  vence15:     [0, 15],
  vence30:     [0, 30],
}

/* Lo que se ofrece dentro del filtro. Los sueltos («mañana», «en 2 días») son
   para armar la lista de un día concreto; los «de aquí a N» para planear la
   semana o la quincena. */
const CUANDO_COBRAS = [
  { valor: '',            nombre: 'Cualquier día' },
  { valor: 'venceHoy',    nombre: 'Hoy' },
  { valor: 'venceManana', nombre: 'Mañana' },
  { valor: 'vence2',      nombre: 'Pasado mañana' },
  { valor: 'vence3',      nombre: 'En 3 días' },
  { valor: 'vence5',      nombre: 'De aquí a 5 días' },
  { valor: 'vence7',      nombre: 'De aquí a una semana' },
  { valor: 'vence15',     nombre: 'De aquí a 15 días' },
  { valor: 'vence30',     nombre: 'De aquí a un mes' },
]

const ESTADOS = [
  { value: '',           label: 'Todos'     },
  { value: 'pendiente_aprobacion', label: 'Pendientes', color: 'var(--cf-gold-dark)', ownerOnly: true },
  { value: 'activo',     label: 'Activos'   },
  { value: 'mora',       label: 'En mora',  color: 'var(--cf-red-dark)' },
  /* ── LOS QUE VENCEN PRONTO ──
     Pedido por Miguel Ángel (Préstamos Rincón): «los filtros que más se usan
     son los de próximos a vencer, bien sea en 5 días o 10 días. Esta aplicación
     no tiene ese filtro, tiene otros pero no son los adecuados».

     ⚠ VAN PEGADOS A «EN MORA», no al final. Los puse primero después de «De
     hoy» y la captura enseñó por qué está mal: en 412px caben tres chips, así
     que quedaban en la séptima y octava posición, fuera de pantalla. Un filtro
     que hay que buscar es un filtro que no se usa — es el mismo argumento que
     metió aquí a «Perdidos» y «De hoy», y me lo salté.

     Y van aquí porque son la MISMA pregunta que «En mora», del otro lado: una
     es lo que ya se pasó y la otra lo que todavía se puede evitar. Por eso los
     nombres van en paralelo —«En mora · En 5 días · En 10 días»— y por eso son
     cortos: en una fila que se desliza, cada letra empuja al siguiente. */

  /* ⚠ «MAÑANA» NO ES «DE AQUÍ A UN DÍA»: es el día 1 y solo el día 1. Por eso
     cada uno lleva su ventana entera —de qué día a qué día— en vez de un solo
     número. Con un número, «mañana» arrastraba también los de hoy.

     El dueño lo pidió así: «si el cliente quiere saber a quién le toca cobrar
     mañana, o en un rango, o en 7 días, o en los próximos 15, así no puede
     filtrar». Los de 5 y 10 ya estaban; lo que faltaba era todo lo demás. */
  { value: 'venceHoy',   label: 'Hoy',        color: 'var(--cf-gold-dark)' },
  { value: 'venceManana', label: 'Mañana',    color: 'var(--cf-gold-dark)' },
  { value: 'vence5',     label: 'En 5 días',  color: 'var(--cf-gold-dark)' },
  { value: 'vence10',    label: 'En 10 días' },
  { value: 'vence15',    label: 'En 15 días' },
  { value: 'vence30',    label: 'En 30 días' },
  // «Renovar»: al dia y por encima del 80% pagado. Lo pide T02-06 como cuarto
  // chip, y es donde esta el crecimiento del negocio — prestarle de nuevo a
  // quien ya casi termino de pagar. No es un estado en la base: lo resuelve el
  // endpoint con `listosRenovar=1`, con el MISMO umbral que usa el panel para
  // contarlos, para que el numero de la fila y el largo de la lista coincidan.
  { value: 'renovar',    label: 'Renovar' },
  /* ── LOS DOS QUE EL DUEÑO NO ENCONTRABA ──
     «No hay un filtro claro para los préstamos clavos […] tampoco hay un filtro
     claro de nuevos préstamos.» No estaban escondidos en «Más filtros»: no
     existían en ningún sitio.

     Van AQUÍ, en la fila de chips, y no dentro de la hoja: la hoja es para
     afinar —la frecuencia, el modo de interés, la ruta— y estos dos son
     preguntas de todos los días. Un filtro que hay que buscar es un filtro que
     no se usa; lo dijo él con esas palabras: «o yo no lo he encontrado
     fácilmente».

     Ninguno de los dos es un estado en la base: los resuelve el endpoint con
     `clavo=1` y `nuevos=1`, igual que «mora» y «renovar». */
  { value: 'clavo',      label: 'Perdidos', color: 'var(--cf-red-dark)' },
  /* ⚠ «DE HOY», NO «NUEVOS (24h)». Lo puse primero a 24 horas y el dueño lo
     cuestionó con razón: todo lo demás de la app es un día —caja, cierre,
     recaudado— y una ventana móvil no cuadra contra ninguno.

     La PASTILLA de la tarjeta sí sigue a 24 horas, y por eso el chip cambia de
     nombre: la pastilla dice «recién creado» y el chip «entró en esta jornada».
     Con los dos llamándose «Nuevo» serían dos cifras distintas con el mismo
     nombre; con nombres distintos, son dos preguntas distintas. */
  { value: 'nuevos',     label: 'De hoy' },
  { value: 'completado', label: 'Completados' },
  { value: 'cancelado',  label: 'Cancelados' },
]

// Filtro por frecuencia de cobro (se aplica del lado cliente sobre lo cargado).
const FRECUENCIAS = [
  { value: '',          label: 'Toda frecuencia' },
  { value: 'diario',    label: 'Diarios'    },
  { value: 'semanal',   label: 'Semanales'  },
  { value: 'quincenal', label: 'Quincenales' },
  { value: 'mensual',   label: 'Mensuales'  },
]

const MODOS_INTERES = [
  { value: '',                label: 'Todo modo' },
  { value: 'fijo',            label: 'Cuota fija' },
  { value: 'unico',           label: 'De una vez' },
  { value: 'solo_interes',    label: 'Globo' },
  { value: 'saldo',           label: 'Sobre saldo' },
  { value: 'manual',          label: 'Manual' },
  { value: 'lineal',          label: 'Decreciente' },
  { value: 'lineal_dinamico', label: 'Dinamico' },
]

const LIMIT = 50

const VISTA_KEY_P = 'cf-prestamos-vista'

const P_COLOR_OK   = 'var(--cf-gold)'
const P_COLOR_HOT  = 'var(--cf-gold-dark)'
const P_COLOR_CRIT = 'var(--cf-red-dark)'
const P_COLOR_DONE = 'var(--cf-green-dark)'
const P_COLOR_OFF  = 'var(--cf-ink-3)'

const MODO_TAG = {
  fijo: 'Cuota fija', unico: 'De una vez', solo_interes: 'Globo',
  saldo: 'Sobre saldo', manual: 'Manual', lineal: 'Decreciente',
  lineal_dinamico: 'Dinamico', proporcional: 'Proporcional',
}

function pMoodColor(p) {
  if (p.estado === 'completado') return P_COLOR_DONE
  if (p.estado === 'cancelado')  return P_COLOR_OFF
  if (p.diasMora > 7)            return P_COLOR_CRIT
  if (p.diasMora > 0)            return P_COLOR_HOT
  return P_COLOR_OK
}

function pMoodLabel(p) {
  if (p.estado === 'completado') return 'OK'
  if (p.estado === 'cancelado')  return 'Can'
  if (p.diasMora > 7)            return `${p.diasMora}d`
  if (p.diasMora > 0)            return `${p.diasMora}d`
  if (p.pagoHoy)                 return 'Pagó'
  return 'OK'
}

function PrestamoCardCompacto({ prestamo: p, esNuevo, ancla, alSalir }) {
  const color = pMoodColor(p)
  const label = pMoodLabel(p)
  const porcentaje = Math.max(0, Math.min(100, p.porcentajePagado ?? 0))

  return (
    <Card
      as={Link}
      href={`/prestamos/${p.id}`}
      id={ancla}
      data-ancla-lista=""
      onClick={() => alSalir?.(p.id)}
      glowColor={color}
      padding={false}
      hoverable
      className="block px-2.5 py-2.5 group"
    >
      {/* Row 1: Avatar + nombre */}
      <div className="flex items-center gap-2 mb-1.5">
        <Avatar
          nombre={p.cliente?.nombre}
          fotoUrl={p.cliente?.fotoUrl}
          size={28}
          fontSize={10}
          style={p.cliente?.fotoUrl ? { border: `1.5px solid ${color}` } : undefined}
        />
        <p className="text-[12px] font-semibold text-[var(--cf-ink)] leading-tight flex-1 min-w-0 truncate">
          {p.cliente?.nombre}
        </p>
      </div>

      {/* ══ ROW 2 Y 3: LAS PASTILLAS ARRIBA, LA PLATA SOLA ═══════════════════
          «En la vista de cuadritos las tarjetas no se entienden para nada: hay
           números montados encima de etiquetas y todo es un caos.»
                                                  — el dueño, 18 ago 2026

          Tenía razón y la cuenta lo explica: en cuadrícula la tarjeta mide unos
          180px, y aquí iban DOS pastillas más el monto en el mismo renglón. Las
          pastillas eran `shrink-0` y el monto `truncate`, así que la del modo se
          cortaba a media palabra —«Cuota fij»— y encima se le montaba
          «$1.040....».

          ⚠ LA PLATA NO SE RECORTA. Es la regla del proyecto y aquí se estaba
          rompiendo dos veces: la cifra con puntos suspensivos y encima pisada.
          Se le da su propio renglón, donde cabe entera y a mayor tamaño — que
          además es lo que uno viene a mirar.

          Y ninguna pastilla se pierde: el modo sigue ahí, solo que ahora puede
          encogerse él, que es una etiqueta y no una cifra. */}
      <div className="flex items-center gap-1 mb-1 min-w-0">
        <span
          className="inline-flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-px rounded-full shrink-0"
          style={{ background: `color-mix(in srgb, ${color} 13%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 21%, transparent)` }}
        >
          <span className="w-1 h-1 rounded-full" style={{ background: color }} />
          {label}
        </span>
        {p.modoInteres && MODO_TAG[p.modoInteres] && (
          <span
            className="text-[11px] font-semibold px-1.5 py-px rounded-full min-w-0 truncate"
            style={{ background: 'color-mix(in srgb, var(--cf-ink-2) 10%, transparent)', color: 'var(--cf-ink-2)', border: '1px solid color-mix(in srgb, var(--cf-ink-2) 20%, transparent)' }}
          >
            {MODO_TAG[p.modoInteres]}
          </span>
        )}
      </div>

      <p className="text-[15px] font-mono-display font-bold mb-1.5 leading-none whitespace-nowrap"
        style={{ color: p.diasMora > 0 ? color : 'var(--cf-ink)' }}>
        {formatMoney(p.saldoPendiente)}
      </p>

      {/* Row 3: progress */}
      <div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--cf-fill)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max(porcentaje, 2)}%`,
              background: porcentaje === 100
                ? P_COLOR_DONE
                : `linear-gradient(90deg, color-mix(in srgb, ${color} 60%, transparent), ${color})`,
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[11px] text-[var(--cf-ink-3)]">
            <span className="font-mono-display font-semibold" style={{ color }}>{porcentaje}%</span> pagado
          </p>
          {esNuevo && <NuevoChip />}
        </div>
      </div>
    </Card>
  )
}

const IconListaP = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
)

const IconGridP = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5h4.5v-4.5h-4.5zm0 12v4.5h4.5v-4.5h-4.5zm12-12v4.5h4.5v-4.5h-4.5zm0 12v4.5h4.5v-4.5h-4.5z" />
  </svg>
)

// Aquí la fila es un préstamo, no una persona: el mismo cliente puede tener
// tres, y volver «al cliente» dejaría al cobrador en la de arriba de las tres.
const ANCLA_PRESTAMO = (id) => `prestamo-${id}`

export default function PrestamosPage() {
  const { esOwner, puedeCrearPrestamos, orgNombre, ocultarSaldoWA, organizationId, loading: authLoading } = useAuth()
  const { lastSyncedAt } = useOffline()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [prestamos, setPrestamos] = useState([])
  const [buscar,    setBuscar]    = useState('')
  const [estado,    setEstado]    = useState(() => searchParams?.get('estado') || 'activo')
  const [frecuencia, setFrecuencia] = useState(() => searchParams?.get('frecuencia') || '')

  const [modoInteres, setModoInteres] = useState(() => searchParams?.get('modoInteres') || '')
  const [rutaId,    setRutaId]    = useState(() => searchParams?.get('rutaId') || '')
  const [renovacion, setRenovacion] = useState(() => searchParams?.get('renovacion') || '')
  const [sinPagosDias, setSinPagosDias] = useState(() => searchParams?.get('sinPagosDias') || '')
  // Llega del panel: «N prestamos con mas de 30 dias de mora». El enlace existia
  // y no filtraba nada porque ni la pagina ni el endpoint lo entendian.
  const [diasMoraMin, setDiasMoraMin] = useState(() => searchParams?.get('diasMoraMin') || '')
  /* El rango a mano, la otra mitad de «¿cuándo le cobras?». Las ventanas fijas
     cubren lo de todos los días; esto cubre «del 3 al 17», que es como se pide
     una quincena de verdad. Viven en la URL como los demás para que el filtro
     se pueda enlazar y sobreviva al botón de atrás. */
  const [cobraDesde, setCobraDesde] = useState(() => searchParams?.get('cobraDesde') || '')
  const [cobraHasta, setCobraHasta] = useState(() => searchParams?.get('cobraHasta') || '')

  // TODOS los filtros viven en la URL, no solo estado y frecuencia.
  //
  // Antes rutaId, renovacion y modoInteres eran estado local puro: no se podia
  // enlazar a una vista filtrada, el boton "atras" perdia el filtro, y ninguna
  // otra pantalla podia mandar aqui con algo ya aplicado. Un grep de "?rutaId="
  // en todo el repo daba cero resultados: la funcion existia y nadie podia
  // llegar a ella.
  //
  // useState solo lee la URL al montar, asi que hace falta el efecto para
  // cuando el query cambia estando ya en esta pantalla (ej. una alerta del
  // dashboard).
  const paramsPrevios = useRef(null)
  useEffect(() => {
    const g = (k) => searchParams?.get(k) || ''
    // `diasMoraMin` y `listosRenovar` llegan de los enlaces del panel. Se
    // traducen al chip que les corresponde para que la pantalla se abra con el
    // filtro puesto Y visible: un filtro activo que no se ve hace que la lista
    // parezca corta sin motivo.
    if (searchParams?.get('listosRenovar') === '1') setEstado('renovar')
    const clave = ['estado', 'frecuencia', 'rutaId', 'renovacion', 'modoInteres', 'sinPagosDias', 'diasMoraMin', 'cobraDesde', 'cobraHasta']
      .map(g).join('|')
    if (clave !== paramsPrevios.current) {
      paramsPrevios.current = clave
      setEstado(g('estado') || 'activo')
      setFrecuencia(g('frecuencia'))
      setRutaId(g('rutaId'))
      setRenovacion(g('renovacion'))
      setModoInteres(g('modoInteres'))
      setSinPagosDias(g('sinPagosDias'))
      setDiasMoraMin(g('diasMoraMin'))
      setCobraDesde(g('cobraDesde'))
      setCobraHasta(g('cobraHasta'))
    }
  }, [searchParams])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [page,      setPage]      = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total,     setTotal]     = useState(0)
  const [rutas,     setRutas]     = useState([])
  // La tercera cifra de T02-06. No se puede derivar de la lista: es del resumen
  // del dia. Si no llega, la tarjeta NO se pinta — un «$0 cobrado este mes» se
  // lee como «no cobre nada», que es otra cosa.
  const [cobradoMes, setCobradoMes] = useState(null)
  useEffect(() => {
    let vivo = true
    fetch(`/api/dashboard/resumen?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (vivo && d?.cobros?.mes != null) setCobradoMes(d.cobros.mes) })
      .catch(() => {})
    return () => { vivo = false }
  }, [])
  const [showFiltros, setShowFiltros] = useState(false)
  // Leer localStorage EN EL INICIALIZADOR desajusta la hidratación: el servidor
  // pone 'lista' y el primer render del cliente puede poner 'compacta', así que
  // React tira el árbol y lo repinta. Tiene que ser un efecto.
  // En un efecto, no leyendo `matchMedia` al pintar: eso hace que el servidor
  // diga una cosa y el cliente otra y React tire el arbol entero.
  const [anchaPantalla, setAnchaPantalla] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const leer = () => setAnchaPantalla(mq.matches)
    leer()
    mq.addEventListener('change', leer)
    return () => mq.removeEventListener('change', leer)
  }, [])

  // EN ESCRITORIO MANDA LA TABLA; en móvil, las tarjetas.
  //
  // El dueño: «la vista de PC es una y la vista de móvil es otra. La de PC es
  // como una tabla y la de móvil son las fichas». Y el pie de T14-01 lo dice
  // igual: «la tabla pasa a ser el modo por defecto; el mosaico queda como
  // alterno en el mismo conmutador que ya existe».
  //
  // La tabla YA ESTABA construida, pero escondida tras Filtros → «Cómo se ven»
  // → Tabla, o sea que había que ir a buscarla en cada dispositivo. Lo único
  // que cambia aquí es cuál es el DEFECTO.
  //
  // Lo guardado gana: si alguien eligió tarjetas en PC, se respeta. Solo se
  // decide por el ancho cuando no hay preferencia.
  // ⚠ POR TIPO DE PANTALLA, no una sola clave. Con una sola, quien ya tenía
  // `'lista'` guardado de antes no veía nunca la tabla —el dueño lo reportó como
  // «en la versión PC no veo la vista diferente»— y además elegir tarjetas en el
  // móvil le quitaba la tabla al PC.
  const [vistaP, setVistaP] = useState('lista')
  useEffect(() => {
    const clave = anchaPantalla ? `${VISTA_KEY_P}:pc` : VISTA_KEY_P
    try {
      const v = localStorage.getItem(clave)
      if (v) { setVistaP(v); return }
    } catch {}
    setVistaP(anchaPantalla ? 'tabla' : 'lista')
  }, [anchaPantalla])

  const cambiarVistaP = (v) => {
    setVistaP(v)
    // En la clave del tipo de pantalla en el que se eligió.
    localStorage.setItem(anchaPantalla ? `${VISTA_KEY_P}:pc` : VISTA_KEY_P, v)
  }

  // Una sola lista para el conmutador visible y para el grupo «Cómo se ven» de
  // la hoja, que si no acaban diciendo cosas distintas. Igual que en clientes.
  const OPCIONES_VISTA = [
    { valor: '', nombre: 'Fichas completas', icono: 'lista' },
    { valor: 'compacta', nombre: 'Cuadrícula', icono: 'cuadricula' },
    ...(anchaPantalla ? [{ valor: 'tabla', nombre: 'Tabla', icono: 'tabla' }] : []),
  ]

  const [isOffline, setIsOffline] = useState(false)
  useEffect(() => {
    const goOnline = () => { setIsOffline(false) }
    window.addEventListener('online', goOnline)
    return () => window.removeEventListener('online', goOnline)
  }, [])
  // Modal selector de plantillas WA (se abre desde swipe action)
  const [waContext, setWaContext] = useState(null)  // { cliente, prestamo }
  // El prestamo que se esta cobrando desde la tarjeta, sin salir de la lista.
  const [cobroRapido, setCobroRapido] = useState(null)
  const hasLoadedOnceRef = useRef(false)

  // Pais del usuario para badge "Nuevo" y formatos
  const { country } = useCountry()

  // Cargar rutas para filtros avanzados (solo owner)
  useEffect(() => {
    if (!esOwner) return
    fetch('/api/rutas').then(r => r.ok ? r.json() : []).then(data => {
      const list = Array.isArray(data) ? data : (data.rutas || [])
      setRutas(list.map(r => ({ id: r.id, nombre: r.nombre, cobrador: r.cobrador?.nombre || null, cobradorId: r.cobrador?.id || null })))
    }).catch(() => {})
  }, [esOwner])

  // Toggle "Agrupar por cliente". Persiste en localStorage para no resetear
  // la preferencia al cambiar de pagina.
  const [agrupar, setAgrupar] = useState(false)

  const montado = useMontado()
  const [hojaFiltros, setHojaFiltros] = useState(false)

  // Los filtros que salieron de la cabecera. "Agrupar" y la vista van aquí
  // también: no son filtros, pero son decisiones de cómo mirar la lista, y
  // ocupaban otros 85px arriba para algo que se cambia una vez al mes.
  /* ── UNA SOLA PREGUNTA, DOS MANERAS DE CONTESTARLA ──────────────────────
   * Las ventanas fijas y el rango a mano preguntan lo mismo: de qué día a qué
   * día cae el próximo cobro. Con las dos puestas a la vez el servidor tendría
   * que decidir cuál gana, y quien mira la pantalla vería «Hoy» encendido y una
   * lista de la quincena que viene.
   *
   * Así que se apagan la una a la otra, aquí, en el único sitio por donde pasan
   * las dos. */
  const elegirVentana = (v) => {
    setEstado(v || 'activo'); setCobraDesde(''); setCobraHasta(''); setPage(1)
  }
  const elegirRango = (d, h) => {
    setCobraDesde(d); setCobraHasta(h); setPage(1)
    if (d || h) setEstado((e) => (e.startsWith('vence') ? 'activo' : e))
  }

  /* ⚠ VA AQUÍ ARRIBA Y NO MÁS ABAJO: `gruposFiltro` lo usa, y un `const`
     declarado después de quien lo lee no es un error de compilación — es la
     pantalla EN BLANCO con «Cannot access before initialization». Pasa el
     build, pasan las pruebas, y solo se ve abriendo la pantalla. Cuarta vez en
     este repo; la primera que la caza el guión de capturas. */
  const gruposFiltro = [
    /* ⚠ VA EL PRIMERO, Y VA AQUÍ DENTRO.
       Se hizo antes como chips en la fila de arriba y el dueño no los encontró:
       «no veo lo de los filtros por fecha de cobro… en filtro no hay una sección
       que diga cobras mañana, en dos días, en cinco días, o en un mes». Los
       chips siguen estando como atajo, pero quien busca un filtro abre el
       filtro, y ahí es donde tiene que estar la lista completa.

       Es la primera pregunta de la mañana —«¿a quién le cobro?»— así que va
       arriba del todo, antes que la frecuencia o la ruta. */
    { id: 'cuando', titulo: '¿Cuándo le cobras?',
      valor: estado.startsWith('vence') ? estado : '',
      // Al quitarlo se vuelve a «activos», que es de donde salió.
      onCambiar: elegirVentana,
      opciones: CUANDO_COBRAS },
    /* La otra mitad de lo que pidió: «poderle colocar el rango de fecha». Va
       pegado debajo de las ventanas, sin título propio que compita, porque es
       la misma pregunta —y separado en otro bloque parecería otro filtro. */
    { id: 'cuandoRango', tipo: 'fechas', titulo: 'O entre dos fechas',
      desde: cobraDesde, hasta: cobraHasta, onCambiar: elegirRango },
    { id: 'frecuencia', titulo: 'Cada cuánto se cobra', valor: frecuencia,
      onCambiar: (v) => { setFrecuencia(v); setPage(1) },
      // Con el título encima, «Toda frecuencia» sobra: ahí va «Cualquiera».
      opciones: FRECUENCIAS.map(({ value, label }) => ({ valor: value, nombre: value === '' ? 'Cualquiera' : label })) },
    { id: 'modo', titulo: 'Cómo se cobra el interés', valor: modoInteres,
      onCambiar: (v) => { setModoInteres(v); setPage(1) },
      opciones: MODOS_INTERES.map(({ value, label }) => ({ valor: value, nombre: label })) },
    { id: 'ruta', titulo: 'Ruta', valor: rutaId,
      onCambiar: (v) => { setRutaId(v); setPage(1) },
      opciones: [{ valor: '', nombre: 'Todas las rutas' },
        ...rutas.map((r) => ({ valor: String(r.id), nombre: r.nombre }))] },
    /* ── LOS RÓTULOS, EN CASTELLANO Y SIN ADIVINANZAS ────────────────────
       «Hay filtros que se entienden muy bien, pero hay otros que no se entienden
       claramente a qué se refieren.» Los tres de aquí eran los peores:

         «Dias de mora» / «Mas de 7»  → sin tildes, y «más de 7» ¿de qué?
         «No me han pagado»           → el título dice quién, las opciones dicen
                                        cuándo, y «Hace +7 días» no cierra la frase
         «Nuevos o renovados»         → «nuevos» ahora es el chip de las 24 horas,
                                        así que decía dos cosas distintas

       La regla que se aplica: el título hace la pregunta y la opción la
       responde entera, de modo que se lean juntos como una frase. */
    { id: 'diasMora', titulo: 'Lleva atrasado', valor: diasMoraMin,
      onCambiar: (v) => { setDiasMoraMin(v); setPage(1) },
      opciones: [{ valor: '', nombre: 'Cualquiera' }, { valor: '7', nombre: 'Más de 7 días' },
        { valor: '15', nombre: 'Más de 15 días' }, { valor: '30', nombre: 'Más de 30 días' }] },
    { id: 'sinPagos', titulo: 'Sin recibir un peso desde hace', valor: sinPagosDias,
      onCambiar: (v) => { setSinPagosDias(v); setPage(1) },
      opciones: [{ valor: '', nombre: 'Cualquiera' }, { valor: '7', nombre: 'Más de 7 días' },
        { valor: '15', nombre: 'Más de 15 días' }, { valor: '30', nombre: 'Más de 30 días' }] },
    { id: 'renovacion', titulo: '¿Es una renovación?', valor: renovacion,
      onCambiar: (v) => { setRenovacion(v); setPage(1) },
      opciones: [{ valor: '', nombre: 'Da igual' }, { valor: 'si', nombre: 'Sí, le presté de nuevo' },
        { valor: 'no', nombre: 'No, es su primer préstamo' }] },
    // «Cómo verlo» y «Cómo se ven» eran dos rótulos que sonaban igual y hacían
    // cosas distintas. Ahora cada uno dice lo suyo.
    { id: 'agrupar', titulo: 'Juntar los de un mismo cliente', valor: agrupar ? 'cliente' : '',
      onCambiar: (v) => {
        const next = v === 'cliente'
        setAgrupar(next)
        try { localStorage.setItem('cf:prestamos:agrupar', next ? '1' : '0') } catch {}
      },
      opciones: [{ valor: '', nombre: 'No, uno por uno' }, { valor: 'cliente', nombre: 'Sí, agrupados' }] },
    // `tipo: 'vistas'` para que NO cuente como filtro: ver el comentario gemelo
    // en clientes. Elegir cuadrícula ponía un «1» en el botón de al lado y
    // movía la fila entera.
    { id: 'vista', tipo: 'vistas', titulo: 'Tamaño de la ficha', valor: vistaP === 'lista' ? '' : vistaP,
      onCambiar: (v) => cambiarVistaP(v || 'lista'),
      opciones: OPCIONES_VISTA },
  ]

  const nFiltros = contarFiltros(gruposFiltro)

  const limpiarFiltros = () => {
    setFrecuencia(''); setModoInteres(''); setRutaId('')
    setSinPagosDias(''); setRenovacion(''); setDiasMoraMin(''); setAgrupar(false); setPage(1)
    // Y la pregunta de arriba: el rango y la ventana fija, que es la misma cosa
    // escrita de dos maneras. Dejar una puesta al «limpiar» es de donde sale
    // «lo quité todo y la lista sigue corta».
    setCobraDesde(''); setCobraHasta('')
    setEstado((e) => (e.startsWith('vence') ? 'activo' : e))
  }
  useEffect(() => {
    try {
      const v = localStorage.getItem('cf:prestamos:agrupar')
      if (v === '1') setAgrupar(true)
    } catch {}
  }, [])
  const toggleAgrupar = useCallback(() => {
    setAgrupar((prev) => {
      const next = !prev
      try { localStorage.setItem('cf:prestamos:agrupar', next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  const fetchPrestamos = useCallback(async (q, est, p, { soft = false, frec = '', ruta = '', creador = '', renov = '', modo = '', sinPagos = '', desde = '', hasta = '' } = {}) => {
    const shouldUseSoftRefresh = soft && hasLoadedOnceRef.current
    setError('')
    setIsOffline(false)
    // ⚠ El rango entra en la clave. Sin él, lo guardado de un rango se pinta
    // como si fuera el resultado del siguiente.
    const cacheKey = `prestamos:${q || ''}:${est || ''}:${frec || ''}:${ruta || ''}:${creador || ''}:${renov || ''}:${modo || ''}:${sinPagos || ''}:${desde || ''}:${hasta || ''}:${p}`

    // Cache-first: pintar al instante desde IndexedDB si hay datos de este
    // filtro, y revalidar en segundo plano. Sin cache → skeleton.
    if (!shouldUseSoftRefresh) {
      try {
        const cached = await leerDeCache(cacheKey)
        if (cached && cached.prestamos) {
          setPrestamos(cached.prestamos)
          setTotal(cached.total)
          setTotalPages(cached.totalPages)
          setLoading(false)
        } else {
          setLoading(true)
        }
      } catch { setLoading(true) }
    }

    // Offline: go straight to IndexedDB (skip SW cache which may be stale)
    if (!navigator.onLine) {
      try {
        let cached = await leerDeCache(cacheKey)
        if (!cached) {
          const allPrestamos = await obtenerPrestamosOffline()
          if (allPrestamos.length > 0) {
            /* Los chips derivados —mora, renovar, perdidos, de hoy, por vencer—
               los resuelve `filtrarPrestamosGuardados`, la misma cuenta que hace
               el servidor. Escrito aquí a mano, tres de ellos filtraban por un
               estado que no existe y la lista salía vacía sin avisar. */
            let filtered = filtrarPrestamosGuardados(allPrestamos, { est, desde, hasta })
            if (frec) filtered = filtered.filter(pr => (pr.frecuencia || 'diario') === frec)
            if (q) {
              const ql = q.toLowerCase()
              filtered = filtered.filter(pr => pr.cliente?.nombre?.toLowerCase().includes(ql) || pr.cliente?.cedula?.includes(ql))
            }
            const start = (p - 1) * LIMIT
            cached = { prestamos: filtered.slice(start, start + LIMIT), total: filtered.length, totalPages: Math.ceil(filtered.length / LIMIT) }
          }
        }
        if (cached) {
          setPrestamos(cached.prestamos); setTotal(cached.total); setTotalPages(cached.totalPages)
          if (!navigator.onLine) setIsOffline(true)
          setLoading(false); hasLoadedOnceRef.current = true; return
        }
      } catch {}
    }

    try {
      const params = new URLSearchParams()
      if (q) params.set('buscar', q)
      // "mora" no es un estado en BD: pedimos activos y que el server filtre por
      // mora con soloMora=1. Antes se filtraba aca, sobre la pagina ya recortada,
      // asi que los morosos de la pagina 2 en adelante no se veian nunca.
      // Ni «mora» ni «renovar» son estados en la base: se piden los activos y el
      // servidor filtra sobre lo ya calculado. Antes se filtraba aca, sobre la
      // pagina ya recortada, asi que los morosos de la pagina 2 no se veian.
      const derivado = est === 'mora' || est === 'renovar' || est === 'clavo' || est === 'nuevos'
        || est.startsWith('vence')
      // ⚠ «Nuevos» NO fuerza `activo`: un préstamo metido hace dos horas puede
      // estar pendiente de aprobación, y ése es justo el que se busca al
      // revisar lo que entró hoy.
      const apiEstado = est === 'nuevos' ? '' : derivado ? 'activo' : est
      if (apiEstado) params.set('estado', apiEstado)
      if (est === 'mora') params.set('soloMora', '1')
      if (est === 'renovar') params.set('listosRenovar', '1')
      if (est === 'clavo') params.set('clavo', '1')
      if (est === 'nuevos') params.set('nuevos', '1')
      // El servidor filtra por la fecha del próximo cobro Y los devuelve
      // ordenados del más cercano al más lejano, que es la otra mitad de lo que
      // pidió: «que automáticamente los primeros sean los más cercanos a vencer».
      /* La ventana, de qué día a qué día. `porVencerDesde` es 0 si no se manda,
         así que «en N días» sigue queriendo decir «de hoy a N». */
      const VENTANA = VENTANAS_COBRO[est]
      if (VENTANA) {
        params.set('porVencerDesde', String(VENTANA[0]))
        params.set('porVencer', String(VENTANA[1]))
      }
      /* El rango a mano. No se manda junto con una ventana fija porque son la
         misma pregunta: la pantalla se encarga de que solo haya uno puesto. */
      if (desde) params.set('cobraDesde', desde)
      if (hasta) params.set('cobraHasta', hasta)
      if ((desde || hasta) && !params.get('estado')) params.set('estado', 'activo')
      if (frec) params.set('frecuencia', frec)
      if (ruta) params.set('rutaId', ruta)
      if (creador) params.set('creadoPorId', creador)
      if (renov) params.set('renovacion', renov)
      if (modo) params.set('modoInteres', modo)
      // Antes se leia de window.location porque el filtro no era estado. Ahora
      // llega por filtrosExtra como los demas.
      if (sinPagos) params.set('sinPagosDias', sinPagos)
      if (diasMoraMin) params.set('diasMoraMin', diasMoraMin)
      params.set('page', String(p))
      params.set('limit', String(LIMIT))
      const res = await fetch(`/api/prestamos?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.offline) throw new Error('offline')
      // El server ya filtro por mora (soloMora=1) y paginó sobre el resultado:
      // filtrar de nuevo aca recortaria la pagina que acaba de llegar.
      const items = data.prestamos
      setPrestamos(items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      guardarEnCache(cacheKey, { prestamos: items, total: data.total, totalPages: data.totalPages }).catch(() => {})
    } catch {
      try {
        let cached = await leerDeCache(cacheKey)
        if (!cached) {
          const allPrestamos = await obtenerPrestamosOffline()
          if (allPrestamos.length > 0) {
            /* Los chips derivados —mora, renovar, perdidos, de hoy, por vencer—
               los resuelve `filtrarPrestamosGuardados`, la misma cuenta que hace
               el servidor. Escrito aquí a mano, tres de ellos filtraban por un
               estado que no existe y la lista salía vacía sin avisar. */
            let filtered = filtrarPrestamosGuardados(allPrestamos, { est, desde, hasta })
            if (frec) filtered = filtered.filter(pr => (pr.frecuencia || 'diario') === frec)
            if (q) {
              const ql = q.toLowerCase()
              filtered = filtered.filter(pr => pr.cliente?.nombre?.toLowerCase().includes(ql) || pr.cliente?.cedula?.includes(ql))
            }
            const start = (p - 1) * LIMIT
            cached = { prestamos: filtered.slice(start, start + LIMIT), total: filtered.length, totalPages: Math.ceil(filtered.length / LIMIT) }
          }
        }
        if (cached) {
          setPrestamos(cached.prestamos)
          setTotal(cached.total)
          setTotalPages(cached.totalPages)
          if (!navigator.onLine) setIsOffline(true)
          setLoading(false)
          hasLoadedOnceRef.current = true
          return
        }
      } catch {}
      setError('No se pudieron cargar los préstamos.')
    } finally {
      setLoading(false)
      hasLoadedOnceRef.current = true
    }
  }, [])

  // Al filtrar por ruta se mandaba ADEMAS creadoPorId con el cobrador de esa
  // ruta. Pero creadoPorId es "quien creo el prestamo (auditoria)", no "de
  // quien es la ruta": el API los cruza con AND, asi que filtrar por ruta
  // escondia todos los prestamos que habia cargado el dueño. En una cartera
  // chica, donde carga el dueño, el filtro devolvia la lista VACIA — por eso
  // parecia que filtrar por ruta "no se podia".
  const filtrosExtra = { frec: frecuencia, ruta: rutaId, renov: renovacion, modo: modoInteres, sinPagos: sinPagosDias, desde: cobraDesde, hasta: cobraHasta }

  useEffect(() => { setPage(1); fetchPrestamos('', estado, 1, filtrosExtra) }, [fetchPrestamos, estado, frecuencia, rutaId, renovacion, modoInteres, sinPagosDias, cobraDesde, cobraHasta]) // eslint-disable-line react-hooks/exhaustive-deps

  // Estado -> URL. Sin esto el filtro no se puede compartir ni conservar al
  // volver atras. La comparacion contra la URL actual evita el bucle
  // URL -> estado -> URL (el efecto de arriba ya no ve un valor nuevo).
  useEffect(() => {
    const q = new URLSearchParams()
    if (estado && estado !== 'activo') q.set('estado', estado)
    if (frecuencia)   q.set('frecuencia', frecuencia)
    if (rutaId)       q.set('rutaId', rutaId)
    if (renovacion)   q.set('renovacion', renovacion)
    if (modoInteres)  q.set('modoInteres', modoInteres)
    if (sinPagosDias) q.set('sinPagosDias', sinPagosDias)
    if (cobraDesde)   q.set('cobraDesde', cobraDesde)
    if (cobraHasta)   q.set('cobraHasta', cobraHasta)
    const nueva = q.toString()
    if (nueva !== (searchParams?.toString() || '')) {
      router.replace(nueva ? `/prestamos?${nueva}` : '/prestamos', { scroll: false })
    }
  }, [estado, frecuencia, rutaId, renovacion, modoInteres, sinPagosDias, cobraDesde, cobraHasta]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(1)
    const t = setTimeout(() => fetchPrestamos(buscar, estado, 1, filtrosExtra), 300)
    return () => clearTimeout(t)
  }, [buscar, estado, frecuencia, rutaId, renovacion, modoInteres, cobraDesde, cobraHasta, fetchPrestamos]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cambio de página
  useEffect(() => {
    if (page > 1) fetchPrestamos(buscar, estado, page, filtrosExtra)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh silencioso cuando llega nueva sincronización global.
  useEffect(() => {
    if (!lastSyncedAt) return
    fetchPrestamos(buscar, estado, page, { soft: true, ...filtrosExtra })
  }, [lastSyncedAt, fetchPrestamos, buscar, estado, frecuencia, rutaId, renovacion, modoInteres, page]) // eslint-disable-line react-hooks/exhaustive-deps

  // Contar la mora sobre `prestamos` solo es exacto si tenemos toda la cartera
  // en memoria: con paginacion eso es UNA pagina y el numero sale corto (con 97
  // prestamos en 2 paginas decia "3 en mora" habiendo mas en la pagina 2). En el
  // filtro "En mora" el total que manda el server ya es el conteo real.
  const enMoraCount = estado === 'mora'
    ? total
    : prestamos.filter((p) => p.diasMora > 0).length
  const conteoMoraExacto = estado === 'mora' || totalPages <= 1

  // El servidor ya filtra por frecuencia (ver fetchPrestamos). En offline el
  // cache tambien la aplica. Se mantiene un filtro client-side defensivo por si
  // llega data sin filtrar (no hace daño: es idempotente).
  const prestamosVisibles = frecuencia
    ? prestamos.filter((p) => (p.frecuencia || 'diario') === frecuencia)
    : prestamos

  /* Volver al préstamo desde el que se entró. Ojo con la paginación: si al
     volver la lista trae menos filas, el préstamo puede ya no estar y se cae al
     respaldo por píxeles, que es lo que hace la ruta desde siempre. */
  const guardarSitio = useSitioDeLaLista({
    clave: 'prestamos',
    listo: !loading && prestamosVisibles.length > 0,
    ancla: ANCLA_PRESTAMO,
  })

  return (
    <div className="max-w-3xl lg:max-w-6xl mx-auto">
      {/* ── Cabecera de trabajo ──
          Antes de aquí había: título, subtítulo, botón dorado con texto, chip
          de Simulador, CUATRO filas de chips (estado, frecuencia, modo, ruta),
          un desplegable de rutas, "No me han pagado", "Filtros avanzados",
          buscador, "Agrupar" y un conmutador de vista. Más de mil píxeles antes
          del primer préstamo, en un teléfono de 844: se scrollea una pantalla
          entera para ver un solo préstamo.

          Y tres colores de chip compitiendo —dorado el estado, azul la
          frecuencia, morado el modo— cuando la regla es que lo único que brilla
          es la plata.

          Queda lo de todos los días: buscar y el estado. Lo demás vive en la
          hoja de "Más filtros", con su número puesto encima para que un filtro
          escondido no se convierta en un filtro olvidado. */}
      <div className="flex flex-col gap-3 mb-3">
        {/* ── El encabezado de T02-06 ──
            «Prestamos» y a la derecha «68 activos». Faltaba entero, igual que en
            clientes: la cabecera del armazon es la de navegacion y no lleva
            titulo, asi que la pantalla no decia ni como se llama. */}
        <EncabezadoLista
          titulo="Préstamos" total={total != null ? `${total} activos` : null}
          crearTexto="Nuevo préstamo"
          onCrear={puedeCrearPrestamos ? () => router.push('/prestamos/nuevo') : null}
        />

        {/* LAS TRES CIFRAS. Responden lo que la lista NO puede: recorriendo 68
            tarjetas no se sabe cuanto hay en total en la calle ni cuanto esta
            atascado. Se suman sobre la pagina visible cuando no hay totales del
            servidor — `parcial` lo marca para no dar por total lo que no lo es. */}
        <TresCifras {...tresCifras(prestamosVisibles, country, { cobradoMes })} />

        <div className="flex items-center gap-2">
          {/* El buscador de la lamina: radio 14, alto 46. Lo tenia como pildora,
              que es la forma del buscador de la BARRA LATERAL. Y al lado habia un
              + dorado con el FAB de la pastilla justo debajo: dos botones de
              crear en la misma pantalla. Se va el de arriba. */}
          <div className="flex-1 min-w-0">
            <BuscadorLista
              valor={buscar}
              onCambiar={(e) => { setBuscar(e.target.value); setPage(1) }}
              placeholder="Nombre o cédula"
            />
          </div>
          {/* En las dos pantallas. Lo bajé a la fila de estados y quedó peor:
              `BarraFiltros` se sale de su caja 20px por lado a propósito, así
              que el conmutador se le montaba encima. Ver el comentario largo en
              clientes. El hueco sale de que «Filtros» es solo icono en móvil. */}
          <ConmutadorVista
            valor={vistaP === 'lista' ? '' : vistaP}
            onCambiar={(v) => cambiarVistaP(v || 'lista')}
            opciones={OPCIONES_VISTA}
          />
        </div>

        {/* El estado se queda arriba porque es el que se toca todos los días.
            Con su conteo: sin el número hay que aplicar el filtro para saber si
            había algo detrás. */}
        <BarraFiltros
          activo={estado}
          onCambiar={(v) => { setEstado(v); setCobraDesde(''); setCobraHasta(''); setPage(1) }}
          onMasFiltros={() => setHojaFiltros(true)}
          hayMasFiltros={nFiltros > 0}
          // `montado &&`: esOwner sale de la sesión, que en el servidor no
          // existe. Sin esperar al montaje, el servidor pinta menos chips que
          // el cliente y React repinta el árbol entero.
          filtros={ESTADOS.filter((e) => !e.ownerOnly || (montado && esOwner)).map(({ value, label }) => ({
            id: value,
            nombre: label,
            conteo: loading ? undefined
              : value === estado ? total
              : value === 'mora' && conteoMoraExacto ? enMoraCount
              : undefined,
          }))}
        />
      </div>

      <HojaFiltros
        abierta={hojaFiltros}
        onCerrar={() => setHojaFiltros(false)}
        onLimpiar={limpiarFiltros}
        grupos={gruposFiltro}
      />

      {/* Offline indicator */}
      {isOffline && (
        <div className="bg-[var(--cf-gold-tint)] border border-[color-mix(in_srgb,var(--cf-gold-dark)_30%,transparent)] text-[var(--cf-gold-dark)] text-xs rounded-[12px] px-4 py-2.5 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--cf-gold)] animate-pulse shrink-0" />
          Datos guardados — sin conexión
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-[var(--cf-red-pill-bg)] border border-[color-mix(in_srgb,var(--cf-red-dark)_30%,transparent)] text-[var(--cf-red-dark)] text-sm rounded-[12px] px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* ── T14-01 · LA TABLA, SOLO EN 1440 ──
          Va FUERA de la lista, no dentro: `StaggeredList` es `grid-cols-2` en
          `lg`, asi que meterla ahi la convertia en UNA CELDA — media anchura,
          columnas aplastadas y el fundido de entrada encima. Una tabla no es un
          elemento de la lista: es la lista. */}
      {!loading && prestamosVisibles.length > 0 && !agrupar && vistaP === 'tabla' && (() => {
        const adaptados = adaptarPrestamos(prestamosVisibles, country)


            // ── T14-01 · LA TABLA, SOLO EN 1440 ──
            // Igual que en clientes: sentado lo que se hace es COMPARAR, y las
            // tarjetas obligan a recorrer. Las columnas son las de la lamina —
            // CLIENTE · MODALIDAD · PRESTADO · SALDO · CUMPLE · PROX. COBRO ·
            // ESTADO— y salen del ADAPTADOR, no del objeto crudo: asi la tabla
            // y la tarjeta dicen lo mismo. Leerlo del crudo ya me dejo una
            // tabla entera de «$0» en clientes.
              /* Por CLAVE cuando la hay: el rótulo de «Atraso» cambia a «Le
                 falta» según si lleva días de mora, y buscándolo por su texto
                 la columna se quedaba vacía sin dar ningún error. */
              const dame = (a, etq, clave) =>
                a?.cifras?.find((x) => (clave && x.clave === clave) || x.etiqueta === etq) ?? null
              const color = (c) => c?.tono === 'contra' ? 'var(--cf-red-dark)'
                : c?.tono === 'favor' ? 'var(--cf-green-dark)' : 'var(--cf-ink)'
              // Cliente y modalidad se estiran; las cifras van a ancho FIJO. Si
              // todas fueran flexibles, los montos cambiarían de sitio al pasar
              // de página y dejarían de poder compararse de un vistazo — es el
              // aviso que lleva escrito el primitivo `Tabla`.
              // MODALIDAD pide 170px fijos: con `1fr` se quedaba en ~95 y la
              // pastilla salía «Diario 22…», que es esconder justo lo que el
              // dueño pidió poder distinguir. Y las cifras van a ancho FIJO: si
              // todas fueran flexibles, los montos cambiarían de sitio al pasar
              // de página y dejarían de poder compararse de un vistazo.
              // El NOMBRE manda: es lo que se busca al recorrer la lista, y con
              // el autor debajo se quedaba en «FERNANDO MEN…». Así que el autor
              // sale de ahí y se va a su propia columna, como en clientes.
              // MODALIDAD pide 170 fijos o la pastilla dice «Diario 22…», que es
              // esconder justo lo que el dueño quería distinguir. Las cifras van
              // a ancho FIJO: con `fr` bailan de sitio al pasar de página y
              // dejan de poder compararse de un vistazo.
              // «Creado por:» necesita más sitio que el «creó» de antes.
              // NUEVE columnas, las mismas nueve de la cabecera. Contarlas es
              // obligatorio: si sobra un dato, se va a un segundo renglón de la
              // rejilla y la fila mide el doble — ya pasó en clientes y en el
              // JSX se ve perfecto.
              const COLS = '1.6fr 150px 150px 92px 92px 96px 84px 76px 88px'
        return (
                <div className="rounded-[14px] overflow-hidden" style={{ border: '1px solid var(--cf-border)' }}>
                  <div className="grid items-center px-4 py-2.5"
                    style={{ gridTemplateColumns: COLS, gap: 12, paddingLeft: 19,
                      background: 'var(--cf-surface)', borderBottom: '1px solid var(--cf-border)' }}>
                    {/* ⚠ «PAGADO», NO «SALDO». La celda enseña `a.monto`, que
                        es LO PAGADO —el dueño lo cambió a propósito: antes un
                        préstamo nuevo salía «$1.800.000 de $1.800.000» y se leía
                        como que ya había pagado todo—. Pero el rótulo seguía
                        diciendo «Saldo», así que un préstamo sin pagos mostraba
                        «$0» bajo una columna que promete lo que DEBE. Comprobado
                        contra la base: Fernando Méndez debe $124.000 y la tabla
                        decía $0.
                        Y se añade «Cumple», que es la columna que pide el pie de
                        T14-01: «la que hace el trabajo, para ver de un vistazo
                        quién paga y quién no». */}
                    {['Cliente', 'Modalidad', 'Creó', 'Prestado', 'Pagado', 'Saldo', 'Cumple', 'Atraso', 'Próximo cobro'].map((h, i) => (
                      <span key={h} className={`text-[10px] font-bold uppercase tracking-[.09em] ${i >= 3 && i <= 7 ? 'text-right' : ''}`}
                        style={{ color: 'var(--cf-ink-3)' }}>{h}</span>
                    ))}
                  </div>
                  {prestamosVisibles.map((p, i) => {
                    const a = adaptados[i]
                    const atraso = dame(a, 'Atraso', 'atraso')
                    return (
                      <button
                        key={p.id}
                        id={ANCLA_PRESTAMO(p.id)}
                        data-ancla-lista=""
                        type="button"
                        onClick={() => { guardarSitio(p.id); window.location.href = `/prestamos/${p.id}` }}
                        className="grid items-center w-full text-left px-4 py-3"
                        style={{
                          gridTemplateColumns: COLS, gap: 12,
                          background: 'var(--cf-card)', border: 0,
                          borderTop: i === 0 ? 'none' : '1px solid var(--cf-hairline)',
                          borderLeft: `3px solid ${a?.estado === 'mora' ? 'var(--cf-red)' : a?.estado === 'aldia' ? 'var(--cf-green)' : 'var(--cf-gold)'}`,
                          font: 'inherit', cursor: 'pointer',
                        }}
                      >
                        {/* Debajo del nombre, la RUTA y quién lo creó — no el
                            `contexto` entero: ése empieza por «Diario 22%
                            Clásico», que es exactamente lo que ya dice la
                            pastilla de la columna de al lado. Repetido, y encima
                            cortado por la mitad. */}
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-[14px] font-semibold" style={{ color: 'var(--cf-ink)', minWidth: 0, overflowWrap: 'anywhere' }}>{a?.nombre}</span>
                            <EtiquetaNuevo nuevo={a?.nuevo} />
                          </span>
                          {/* Solo la RUTA debajo del nombre. El autor se fue a su
                              propia columna: los dos aquí dejaban el nombre en
                              «FERNANDO MEN…» y al cobrador en «J…», o sea que no
                              servía ninguno de los tres. */}
                          <span className="flex items-center min-w-0">
                            <Dato trazo={TRAZO.ruta} apagado={a?.piezas?.ruta === 'Sin ruta'}>{a?.piezas?.ruta}</Dato>
                          </span>
                        </span>
                        {/* La MISMA pastilla de modo que la tarjeta de móvil, con
                            su icono: el dueño pidió poder distinguir el modo
                            «fácilmente», y eso no puede depender de en qué
                            dispositivo se mire. Antes esta celda repetía el
                            «de $124.000» que ya está en las columnas de plata. */}
                        <span className="min-w-0 flex">
                          {a?.piezas?.modo
                            ? <ModoInteres {...a.piezas.modo} />
                            : <span className="text-[13px] truncate" style={{ color: 'var(--cf-ink-2)' }}>—</span>}
                        </span>
                        {/* CREÓ, en su columna: el dueño lo pidió para las dos
                            pantallas y aquí competía con el nombre del cliente. */}
                        <span className="min-w-0 flex">
                          <CreadoPor nombre={a?.piezas?.autor} />
                        </span>
                        {/* PRESTADO es el capital que salio; SALDO lo que falta.
                            La tarjeta los pone uno encima de otro («$553.658 / de
                            $779.000»); aqui son dos columnas, que es lo que
                            permite sumarlas con la vista. */}
                        <span className="cf-fig text-[14px] text-right" style={{ color: 'var(--cf-ink-2)' }}>
                          {formatMoney(Math.round(p.montoPrestado ?? 0), country)}
                        </span>
                        {/* PAGADO: lo que ya entró. Es `a.monto`, la misma cifra
                            que la tarjeta pone arriba. */}
                        <span className="cf-fig text-[14px] text-right" style={{ color: 'var(--cf-ink-2)' }}>{a?.monto}</span>
                        {/* SALDO: lo que FALTA. Es la cifra por la que se decide
                            si vale la pena ir hoy, y hasta ahora no estaba en
                            ninguna columna de esta tabla. */}
                        <span className="cf-fig text-[14px] text-right" style={{ color: 'var(--cf-ink)', fontWeight: 600 }}>
                          {formatMoney(Math.max(0, Math.round((p.totalAPagar ?? 0) - (p.totalPagado ?? 0))), country)}
                        </span>
                        {/* CUMPLE: barra + número, «la columna que hace el
                            trabajo» según el pie de T14-01. El porcentaje ya
                            venía del API; solo no se estaba pintando. */}
                        <span className="flex items-center justify-end gap-2">
                          <BarraProgreso
                            porcentaje={a?.porcentaje ?? 0}
                            tono={a?.estado === 'mora' ? 'mora' : a?.estado === 'atraso' ? 'atraso' : 'aldia'}
                            alto={5}
                            style={{ flex: 1, minWidth: 0 }}
                          />
                          <span className="cf-num text-[12px] font-bold" style={{ color: 'var(--cf-ink-2)', flex: 'none' }}>
                            {a?.porcentaje ?? 0}%
                          </span>
                        </span>
                        <span className="cf-fig text-[13px] text-right" style={{ color: color(atraso) }}>{atraso?.valor ?? '—'}</span>
                        <span className="text-[13px] truncate" style={{
                          color: a?.estado === 'mora' ? 'var(--cf-red-dark)' : 'var(--cf-ink-2)',
                        }}>{fechaCorta(p.proximoCobro) ?? '—'}</span>
                        {/* La columna «Estado» se fue: repetía lo que ya dicen el
                            riel de color de la fila y la columna de atraso, y
                            ese ancho lo necesitaban el nombre y la modalidad.
                            El riel sigue: es el mismo portador de estado que la
                            tarjeta de móvil, así que la lectura no cambia entre
                            dispositivos (pie de T14-01). */}
                      </button>
                    )
                  })}
                </div>
              )
      })()}

      {/* Lista plana: orden cronologico puro (default) */}
      {!loading && prestamosVisibles.length > 0 && !agrupar && vistaP !== 'tabla' && (
        <StaggeredList className={vistaP === 'compacta' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2' : 'flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3'}>
          {/* La MISMA tarjeta que un cliente: un prestamo en lista no estrena
              tarjeta. Inventar una segunda obligaria a aprender dos objetos que
              se leen igual y significan lo mismo — alguien que te debe.
              Lo unico propio es la linea de contexto: la cuota y cada cuanto,
              en vez de la direccion. */}
          {(() => {
            const adaptados = adaptarPrestamos(prestamosVisibles, country)
            return prestamosVisibles.map((p, i) => (
              vistaP === 'compacta' ? (
                <BadgeNuevo key={p.id} fecha={p.createdAt}>
                  <PrestamoCardCompacto
                    prestamo={p}
                    esNuevo={isHoy(p.createdAt, country)}
                    ancla={ANCLA_PRESTAMO(p.id)}
                    alSalir={guardarSitio}
                  />
                </BadgeNuevo>
              ) : (
                <TarjetaCliente
                  key={p.id}
                  ancla={ANCLA_PRESTAMO(p.id)}
                  {...adaptados[i]}
                  /* ── EL DESPLEGABLE, CON EL DESGLOSE LARGO ──
                     «Un dropdown que tenga un desglose mucho más bonito sin
                     necesidad de entrar al préstamo directamente, y que también
                     dentro del dropdown ponerle el botón de las plantillas de
                     WhatsApp y también un cobro rápido.»

                     Aquí es UNA sola ficha —la de este préstamo— y va con
                     `largo`: prestado, total, ya pagó, le falta, capital afuera,
                     vence y último pago. En la lista de clientes son varias y
                     van cortas, o el desplegable dejaría de leerse de una
                     pasada. */
                  desglose={{
                    rotulo: 'Ver el desglose',
                    prestamos: [fichaDe(p, country, { largo: true })],
                  }}
                  onWhatsAppPrestamo={() => setWaContext({ cliente: p.cliente, prestamo: p })}
                  onCobrarPrestamo={() => setCobroRapido(p)}
                  onClick={() => { guardarSitio(p.id); window.location.href = `/prestamos/${p.id}` }}
                />
              )
            ))
          })()}
        </StaggeredList>
      )}

      {/* Lista agrupada por cliente: solo cuando el toggle esta activo */}
      {!loading && prestamosVisibles.length > 0 && agrupar && (() => {
        // Agrupa y reordena: cliente con prestamo mas nuevo arriba.
        const grupos = []
        const indice = new Map()
        for (const p of prestamosVisibles) {
          const key = p.clienteId
          if (!indice.has(key)) {
            indice.set(key, grupos.length)
            grupos.push({ cliente: p.cliente, prestamos: [], tieneNuevo: false, saldoTotal: 0, maxCreatedAt: 0 })
          }
          const g = grupos[indice.get(key)]
          g.prestamos.push(p)
          if (isHoy(p.createdAt, country)) g.tieneNuevo = true
          g.saldoTotal += p.saldoPendiente ?? 0
          const ts = new Date(p.createdAt).getTime()
          if (ts > g.maxCreatedAt) g.maxCreatedAt = ts
        }
        // Cliente cuyo prestamo mas nuevo es mas reciente, va primero.
        grupos.sort((a, b) => b.maxCreatedAt - a.maxCreatedAt)
        return (
          <div className="space-y-4">
            {grupos.map(({ cliente, prestamos: prestCliente, tieneNuevo, saldoTotal }) => {
              const tieneVarios = prestCliente.length > 1
              return (
                <div key={cliente.id}>
                  {tieneVarios && (
                    <div
                      className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg"
                      style={{ background: 'color-mix(in srgb, var(--cf-ink) 4%, transparent)' }}
                    >
                      <span
                        className="text-[11px] font-extrabold uppercase tracking-[.07em] truncate"
                        style={{ color: 'var(--cf-ink)' }}
                      >
                        {cliente.nombre}
                      </span>
                      <span
                        className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap font-mono-display"
                        style={{
                          background: 'color-mix(in srgb, var(--cf-gold) 12%, transparent)',
                          color: 'var(--cf-gold)',
                        }}
                      >
                        {prestCliente.length}
                      </span>
                      {tieneNuevo && (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[.07em] px-1.5 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            background: 'color-mix(in srgb, var(--cf-green-dark) 14%, transparent)',
                            color: 'var(--cf-green-dark)',
                            border: '1px solid color-mix(in srgb, var(--cf-green-dark) 35%, transparent)',
                          }}
                        >
                          <span className="w-1 h-1 rounded-full" style={{ background: 'var(--cf-green-dark)' }} />
                          Nuevo
                        </span>
                      )}
                      <span
                        className="ml-auto text-[10px] font-mono-display whitespace-nowrap"
                        style={{ color: 'var(--cf-ink-3)' }}
                      >
                        {formatMoney(Math.round(saldoTotal), country)}
                      </span>
                    </div>
                  )}
                  <div
                    className={tieneVarios ? 'space-y-2.5 pl-2 ml-1 border-l' : 'space-y-2.5'}
                    style={tieneVarios ? { borderColor: 'color-mix(in srgb, var(--cf-border) 60%, transparent)' } : undefined}
                  >
                    {prestCliente.map((p) => {
                      if (vistaP === 'compacta') {
                        return (
                          <BadgeNuevo key={p.id} fecha={p.createdAt}>
                            <PrestamoCardCompacto prestamo={p} esNuevo={isHoy(p.createdAt, country)} />
                          </BadgeNuevo>
                        )
                      }
                      const cardActions = []
                      if (p.cliente?.telefono) {
                        cardActions.push({
                          icon: IconWA,
                          label: 'WhatsApp',
                          color: '#25D366',
                          onClick: () => setWaContext({ cliente: p.cliente, prestamo: p }),
                        })
                      }
                      if (p.estado === 'activo') {
                        cardActions.push({
                          icon: IconPagar,
                          label: 'Registrar pago',
                          color: 'var(--cf-green-dark)',
                          onClick: () => { guardarSitio(p.id); window.location.href = `/prestamos/${p.id}?openPago=1` },
                        })
                      }
                      return (
                        <BadgeNuevo key={p.id} fecha={p.createdAt}>
                          <PrestamoCard
                            prestamo={p}
                            actions={cardActions}
                            esNuevo={isHoy(p.createdAt, country)}
                            ancla={ANCLA_PRESTAMO(p.id)}
                            alSalir={guardarSitio}
                          />
                        </BadgeNuevo>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Vacío con filtro de frecuencia activo (server o cliente no devolvió de esa frecuencia) */}
      {!loading && !error && frecuencia && prestamosVisibles.length === 0 && !buscar && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4">
            <MonedaCF pose="vacia" size={100} />
          </div>
          <p className="text-sm font-medium text-[var(--cf-ink)]">
            No hay préstamos {FRECUENCIAS.find((f) => f.value === frecuencia)?.label.toLowerCase()}
          </p>
          <p className="text-xs text-[var(--cf-ink-3)] mt-1">
            <button onClick={() => setFrecuencia('')} className="text-[var(--cf-ink-2)] hover:underline">
              Ver toda frecuencia
            </button>
          </p>
        </div>
      )}

      {/* Estado vacío */}
      {!loading && !error && prestamosVisibles.length === 0 && !(frecuencia && !buscar) && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4">
            <MonedaCF pose={buscar ? 'busca' : 'vacia'} size={100} />
          </div>
          {buscar ? (
            <>
              <p className="text-sm font-medium text-[var(--cf-ink)]">Sin resultados</p>
              <p className="text-xs text-[var(--cf-ink-3)] mt-1">No hay préstamos para "{buscar}"</p>
              <button onClick={() => setBuscar('')} className="mt-3 text-xs text-[var(--cf-gold)] hover:underline">
                Limpiar búsqueda
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-[var(--cf-ink)]">
                {estado === 'activo' ? 'No hay préstamos activos' : estado === 'mora' ? 'No hay préstamos en mora' : 'Sin préstamos'}
              </p>
              <p className="text-xs text-[var(--cf-ink-3)] mt-1">
                {estado !== '' && (
                  <button onClick={() => setEstado('')} className="text-[var(--cf-gold)] hover:underline">
                    Ver todos los estados
                  </button>
                )}
              </p>
              {!authLoading && puedeCrearPrestamos && (
                <Link href="/prestamos/nuevo" className="mt-4">
                  <Button size="sm">Crear préstamo</Button>
                </Link>
              )}
            </>
          )}
        </div>
      )}

      {/* Paginación */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--cf-border)] text-[var(--cf-ink-3)] hover:bg-[var(--cf-fill)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <span className="text-xs text-[var(--cf-ink-3)]">
            Página <span className="font-mono-display">{page}</span> de <span className="font-mono-display">{totalPages}</span>
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--cf-border)] text-[var(--cf-ink-3)] hover:bg-[var(--cf-fill)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}

      {/* ── COBRO RÁPIDO DESDE LA TARJETA ──
          El mismo modal de la ficha del préstamo, montado aquí. Al terminar se
          recarga la lista en silencio: sin eso la tarjeta seguiría diciendo el
          saldo de antes del pago que se acaba de registrar, que es la forma más
          rápida de que alguien cobre dos veces. */}
      {cobroRapido && (
        <RegistrarPago
          prestamoId={cobroRapido.id}
          cuotaDiaria={cobroRapido.cuotaDiaria}
          saldoPendiente={cobroRapido.saldoPendiente ?? ((cobroRapido.totalAPagar || 0) - (cobroRapido.totalPagado || 0))}
          open
          onClose={() => setCobroRapido(null)}
          onSuccess={() => {
            setCobroRapido(null)
            fetchPrestamos(buscar, estado, page, { soft: true, ...filtrosExtra })
          }}
          cliente={cobroRapido.cliente}
          prestamo={cobroRapido}
        />
      )}

      {/* Modal selector de plantillas WhatsApp (se abre desde swipe) */}
      <HojaWhatsApp
        open={!!waContext}
        onClose={() => setWaContext(null)}
        cliente={waContext?.cliente}
        prestamo={waContext?.prestamo}
        orgNombre={orgNombre}
        ocultarSaldo={ocultarSaldoWA}
        organizationId={organizationId}
      />
    </div>
  )
}
