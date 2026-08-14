'use client'

// components/armazon/Armazon.jsx — el armazón cableado.
//
// Es la pieza que faltaba entre `lib/armazon.js` (la regla, que solo sabe de
// rutas) y las pantallas (que saben su título pero no su sitio en el sistema).
//
// LA REGLA DECIDE LA FORMA; LA PÁGINA PONE EL CONTENIDO.
//
//   resolverArmazon(pathname) → qué cabecera va y si hay pastilla
//   useCabecera({ titulo… })  → qué dice esa cabecera
//
// Sin esto, cada página tendría que acordarse de dibujar su propia cabecera, y
// la regla de supresión volvería a ser una convención en vez de una norma: se
// cumpliría en las pantallas que alguien recordó y en las demás no.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { CABECERA, resolverArmazon, iniciales, rolEnEspanol, volverA, puedeRetroceder } from '@/lib/armazon'
import { useOnline } from '@/hooks/useOnline'
import { useTheme } from '@/lib/theme/ThemeProvider'
import CabeceraMovil from '@/components/armazon/CabeceraMovil'
import PastillaNav from '@/components/armazon/PastillaNav'
import HojaCuenta from '@/components/armazon/HojaCuenta'
import MenuCrear from '@/components/pantallas/MenuCrear'
import QrScanner from '@/components/qr/QrScanner'
import { olvidarCompartido } from '@/lib/pedir-compartido'

const ArmazonContext = createContext(null)

/**
 * Lo que una pantalla le dice a su cabecera.
 *
 * `acciones` es JSX y cambia de identidad en cada render, así que la
 * re-suscripción se dispara solo con los campos primitivos. Memoiza `acciones`
 * en la página (`useMemo`) si depende de algo que cambia.
 */
/**
 * VOLVER, EN ESCRITORIO.
 *
 * En PC no hay cabecera —`CabeceraMovil` es `flex lg:hidden`, y `02-ARMAZON.md
 * §D` lo pide así: «no hay cabecera superior en escritorio, todo el armazón vive
 * en una barra lateral»— pero eso dejaba las pantallas de DETALLE **sin salida**.
 *
 * El dueño lo reportó dos veces en la misma tanda: «no se puede volver atrás con
 * un botón a la ruta, sino dándole al menú» y «si me meto en ver todas las
 * cuotas, después no puedo salir, me toca ir a préstamos y ya me pierdo».
 *
 * La barra lateral NO sirve de salida: lleva a la sección, no al sitio del que
 * viniste. Desde la tabla de cuotas te deja en la LISTA de préstamos, no en el
 * préstamo que estabas mirando — que es exactamente lo que él describe.
 *
 * ⚠ SE MONTA DENTRO DE `<main>`, en `layout.jsx`. Pintarla dentro de `Armazon`
 * la sacaba por encima de la barra lateral y a todo el ancho de la ventana: se
 * vio en la captura, no en el código.
 *
 * Sale solo donde hay título de pantalla —o sea, donde `useCabecera` corrió—,
 * que es justo el conjunto de pantallas a las que se llega desde otra.
 */
export function VolverEscritorio() {
  const ctx = useContext(ArmazonContext)
  const de = ctx?.dePantalla
  if (!de?.titulo) return null

  return (
    <div className="hidden lg:flex" style={{
      alignItems: 'center', gap: 10, marginBottom: 16, minWidth: 0,
    }}>
      <button
        type="button"
        // La pantalla decide a dónde vuelve; si no lo dice, el armazón usa su
        // `volver` de siempre (retroceder, o subir de sección si no hay historia).
        onClick={de.onVolver ?? ctx?.volver}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, flex: 'none',
          height: 34, padding: '0 13px 0 9px', borderRadius: 12,
          background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
          cursor: 'pointer', font: 'inherit',
          fontSize: 13, fontWeight: 600, color: 'var(--cf-ink-2)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
          <path d="M15 5l-7 7 7 7" />
        </svg>
        Volver
      </button>
      <span style={{
        fontFamily: 'var(--font-space-grotesk), system-ui',
        fontSize: 20, fontWeight: 600, letterSpacing: '-.02em',
        color: 'var(--cf-ink)', flex: 'none',
      }}>{de.titulo}</span>
      {de.subtitulo && (
        <span className="cf-num" style={{
          fontSize: 13, color: 'var(--cf-ink-3)', minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{de.subtitulo}</span>
      )}
    </div>
  )
}

export function useCabecera({ titulo, subtitulo, acciones, paso, total, onVolver, onCerrar } = {}) {
  const ctx = useContext(ArmazonContext)
  const registrar = ctx?.registrar

  // El ref lleva siempre lo último; la clave decide cuándo vale la pena avisar.
  const ultimo = useRef(null)
  ultimo.current = { titulo, subtitulo, acciones, paso, total, onVolver, onCerrar }

  // Los MANEJADORES van en la clave como «hay o no hay», no por identidad.
  //
  // Sin esto, una pantalla que cambia a donde vuelve —configuracion: dentro de
  // una seccion al indice, en el indice fuera— registraba el `onVolver` del
  // PRIMER render y se quedaba con el para siempre, porque el titulo no cambiaba
  // y la clave tampoco. La flecha hacia lo que hacia al abrir la pantalla, no lo
  // que toca ahora. Es la misma familia de fallo que la flecha sin `onClick`.
  const clave = [
    titulo ?? '', subtitulo ?? '', paso ?? '', total ?? '',
    onVolver ? 'v' : '', onCerrar ? 'c' : '',
  ].join('|')

  useEffect(() => {
    if (!registrar) return
    // Se registran ENVOLTORIOS que leen del ref: asi el manejador que se ejecuta
    // es siempre el ultimo, aunque cambie de identidad en cada render.
    registrar({
      ...ultimo.current,
      onVolver: onVolver ? (...args) => ultimo.current.onVolver?.(...args) : undefined,
      onCerrar: onCerrar ? (...args) => ultimo.current.onCerrar?.(...args) : undefined,
    })
    return () => registrar(null)
  }, [registrar, clave])   // eslint-disable-line react-hooks/exhaustive-deps
}

export default function Armazon({ children, nombre: nombreServidor, rol: rolServidor = '', avatarId: avatarServidor = null, hayAvisos = false, onCrear }) {
  // EL FAB ESTABA MUERTO. `onCrear` se declaraba aquí pero el layout nunca lo
  // pasaba, así que el botón principal de crear —el que sale en TODAS las
  // pantallas de navegación— se pulsaba y no hacía nada: ni menú, ni navegar,
  // ni error. Un botón que no responde enseña a no volver a tocarlo.
  const [menuCrear, setMenuCrear] = useState(false)
  // El escaner de QR es un MODAL, no una ruta: `/qr` daba 404 desde el menu.
  const [escaner, setEscaner] = useState(false)
  const pathname = usePathname() || '/'
  const router = useRouter()

  // Retroceder SOLO si hay algo de la app detrás; si no, ir al padre.
  // `router.back()` a secas dejaba una pantalla en blanco al entrar por URL o
  // tras recargar, que es como se entra la mitad de las veces. Ver `volverA`.
  const volver = useCallback(() => {
    if (puedeRetroceder()) router.back()
    else router.push(volverA(pathname))
  }, [router, pathname])
  const conectado = useOnline()
  const { theme, setTheme } = useTheme() ?? {}
  const { data: session } = useSession()
  const [dePantalla, setDePantalla] = useState(null)

  // Cuántos avisos hay ahora mismo, publicado por PilaAvisos.
  const [avisos, setAvisos] = useState(0)
  useEffect(() => {
    const oir = (e) => setAvisos(Number(e.detail) || 0)
    window.addEventListener('cf:avisos', oir)
    return () => window.removeEventListener('cf:avisos', oir)
  }, [])

  // ── La hoja de cuenta ──
  // ESTABA CONSTRUIDA Y SIN MONTAR. HojaCuenta.jsx existe entero —identidad,
  // tema, accesos, estado de conexión, cerrar sesión— y el único sitio que la
  // instanciaba era app/estilo/page.jsx, el banco de pruebas. En la app, pulsar
  // el avatar no hacía nada: ni en la cabecera móvil ni en la barra lateral.
  //
  // Y no es un adorno: en T39-05 la navegación de escritorio no tiene grupo
  // «Cuenta», así que esta hoja es la única vía a Configuración y a cerrar
  // sesión. La escucha del evento es para la barra lateral, que cuelga de este
  // componente pero recibe sus props del layout.
  const [cuenta, setCuenta] = useState(false)
  useEffect(() => {
    const oir = () => setCuenta(true)
    window.addEventListener('cf:abrir-cuenta', oir)
    return () => window.removeEventListener('cf:abrir-cuenta', oir)
  }, [])

  const registrar = useMemo(() => (config) => setDePantalla(config), [])
  // `dePantalla` sale al contexto para que `VolverEscritorio` lo lea. Tiene que
  // ir por contexto y no pintarse aquí: este componente envuelve TAMBIÉN a la
  // barra lateral, así que lo que se pinte a este nivel sale por encima de ella
  // y a todo el ancho. La barra de volver va dentro de `<main>`.
  const valor = useMemo(() => ({ registrar, dePantalla, volver }), [registrar, dePantalla, volver])

  // El estado de conexión SE FUE de aquí. Vivía en este componente para pintar
  // el punto verde del avatar móvil, y T40-00-a —la cabecera elegida— quita ese
  // punto. En móvil la conexión ahora se dice con palabras en HojaCuenta.
  //
  // Quien sí lo sigue mostrando es la barra lateral (T39-05 le pone un punto de
  // 10px), y desde este cambio se lo detecta ella sola: es su único consumidor.

  const armazon = resolverArmazon(pathname)

  // El nombre lo manda el LAYOUT, que es servidor y ya tiene la sesión.
  // `useSession()` devuelve null durante el render del servidor, así que
  // derivar de él las iniciales hacía que el servidor pintara "·" y el cliente
  // "CA": desajuste de hidratación en TODAS las pantallas, y un parpadeo del
  // avatar en cada carga. La sesión de cliente queda solo como respaldo.
  const nombre = nombreServidor || session?.user?.nombre || session?.user?.name || ''
  const rol = rolServidor || session?.user?.rol || ''
  /* El avatar elegido en configuración. Mismo camino que el nombre —del layout
     servidor— por la misma razón: leerlo solo del cliente parpadea en cada
     carga. La sesión de cliente queda de respaldo, y así el cambio se ve sin
     tener que volver a entrar.

     ⚠ `??`, no `||`: `avatarServidor` puede ser `null` a propósito (el usuario
     le dio a «Quitar») y con `||` se recuperaría el de la sesión vieja, que es
     justo el que acaba de borrar. */
  const avatarId = avatarServidor ?? session?.user?.avatarId ?? null

  return (
    <ArmazonContext.Provider value={valor}>
      {/* UNA FLECHA QUE NO HACE NADA ES PEOR QUE NO TENERLA.

          `onVolver` lo pone la pantalla con `useCabecera`, y la mayoria no lo
          pasa: la flecha se pintaba igual, con el `onClick` a `undefined`. Se
          pulsaba y no pasaba nada — y en las pantallas que ademas traen su
          propio «‹ Clientes» dentro quedaban DOS flechas, de las cuales solo
          funcionaba la de abajo. Es lo que reporto el usuario.

          Volver atras es lo mismo en todas: `router.back()`. La pantalla solo lo
          sobreescribe cuando de verdad tiene que ir a otro sitio. */}
      {armazon.cabecera !== CABECERA.NINGUNA && (
        <CabeceraMovil
          variante={armazon.cabecera}
          iniciales={iniciales(nombre)}
          avatarId={avatarId}
          nombre={nombre}
          hayAvisos={avisos > 0 || hayAvisos}
          onCuenta={() => setCuenta(true)}
          titulo={dePantalla?.titulo}
          subtitulo={dePantalla?.subtitulo}
          acciones={dePantalla?.acciones}
          paso={dePantalla?.paso}
          total={dePantalla?.total}
          onVolver={dePantalla?.onVolver ?? volver}
          onCerrar={dePantalla?.onCerrar ?? volver}
        />
      )}

      {children}

      {/* ── EL HUECO DEL PIE, PARA TODA LA APP ───────────────────────────────
          La pastilla flota fija sobre el contenido, así que sin este hueco se
          come el final de la última tarjeta. El dueño lo reportó: «hay pantallas
          donde el menú sticky tapa la información al final… falta un espacio
          para que el menú no tape parte de la tarjeta».

          Va AQUÍ y no en cada pantalla a propósito. Ya lo puse una vez en el
          panel, pantalla por pantalla, y eso solo arregla la que se mira: el
          resto sigue tapada hasta que alguien la reporte. El armazón es el único
          que sabe si hay pastilla, así que es el único que puede reservarle el
          sitio SIEMPRE que la haya y nunca cuando no.

          112px = 62 de la pastilla + 18 de separación al borde + aire. Medido en
          el panel: con 96 el último renglón aún rozaba.

          `lg:hidden` porque sentado no hay pastilla y el hueco sobraría. */}
      {armazon.pastilla && <div className="h-[112px] lg:hidden" style={{ flex: 'none' }} aria-hidden />}

      {/* La pastilla NO se oculta con CSS: no se monta. Un `display:none` deja
          los cinco destinos en el árbol y un lector de pantalla los sigue
          anunciando en una pantalla donde no se puede navegar. */}
      {armazon.pastilla && <PastillaNav onCrear={onCrear ?? (() => setMenuCrear(true))} />}

      {escaner && (
        <QrScanner
          open={escaner}
          onClose={() => setEscaner(false)}
          onClientDetected={(clienteId) => {
            setEscaner(false)
            if (clienteId) router.push(`/clientes/${clienteId}`)
          }}
        />
      )}

      <HojaCuenta
        abierta={cuenta}
        onCerrar={() => setCuenta(false)}
        nombre={nombre}
        rol={rolEnEspanol(rol)}
        iniciales={iniciales(nombre)}
        avatarId={avatarId}
        conectado={conectado}
        tema={theme ?? 'system'}
        onCambiarTema={setTheme}
        onConfiguracion={() => { setCuenta(false); router.push('/configuracion') }}
        onPlan={() => { setCuenta(false); router.push('/configuracion/plan') }}
        onSoporte={() => { setCuenta(false); router.push('/soporte') }}
        onCerrarSesion={() => {
          /* ── AL SALIR SE BORRA LO LEÍDO, NO LO PENDIENTE ──────────────────
             Dos personas comparten teléfono más de lo que uno cree: el cobrador
             entrega el turno y el dueño entra en el mismo aparato. Sin esto, las
             respuestas guardadas del anterior siguen ahí, y si al siguiente le
             falla la red por un momento la app se las sirve.

             La barra vieja además llamaba a `limpiarDatosOffline()`, que BORRA
             LA BASE LOCAL ENTERA — incluidos los pagos que el cobrador todavía
             no ha subido. Eso no se copia: cerrar sesión no puede tragarse plata
             cobrada. Aquí solo se tira lo que se puede volver a pedir. */
          try { navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_API_CACHE' }) } catch {}
          olvidarCompartido()
          signOut({ callbackUrl: '/login' })
        }}
      />

      {menuCrear && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90 }}>
          <MenuCrear
          // El grupo que corresponde a donde estamos, primero. Es lo unico que
          // hace falta para que el + deje de esconder lo obvio.
          aqui={pathname?.startsWith('/clientes') ? 'crear'
            : pathname?.startsWith('/prestamos') ? 'sale' : null}
            fecha={new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            hora={new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            // `router.push`, no `window.location.href`: aquello RECARGABA LA APP
            // ENTERA en cada salto —fuentes, bundle, sesion— desde un menu cuyo
            // trabajo es llevarte rapido a otro sitio.
            onIr={(destino) => { setMenuCrear(false); router.push(destino) }}
            onEscanear={() => { setMenuCrear(false); setEscaner(true) }}
            onCerrar={() => setMenuCrear(false)}
          />
        </div>
      )}
    </ArmazonContext.Provider>
  )
}
