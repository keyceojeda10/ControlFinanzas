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

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { CABECERA, resolverArmazon, iniciales, rolEnEspanol } from '@/lib/armazon'
import { useOnline } from '@/hooks/useOnline'
import { useTheme } from '@/lib/theme/ThemeProvider'
import CabeceraMovil from '@/components/armazon/CabeceraMovil'
import PastillaNav from '@/components/armazon/PastillaNav'
import HojaCuenta from '@/components/armazon/HojaCuenta'
import MenuCrear from '@/components/pantallas/MenuCrear'

const ArmazonContext = createContext(null)

/**
 * Lo que una pantalla le dice a su cabecera.
 *
 * `acciones` es JSX y cambia de identidad en cada render, así que la
 * re-suscripción se dispara solo con los campos primitivos. Memoiza `acciones`
 * en la página (`useMemo`) si depende de algo que cambia.
 */
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

export default function Armazon({ children, nombre: nombreServidor, rol: rolServidor = '', hayAvisos = false, onCrear }) {
  // EL FAB ESTABA MUERTO. `onCrear` se declaraba aquí pero el layout nunca lo
  // pasaba, así que el botón principal de crear —el que sale en TODAS las
  // pantallas de navegación— se pulsaba y no hacía nada: ni menú, ni navegar,
  // ni error. Un botón que no responde enseña a no volver a tocarlo.
  const [menuCrear, setMenuCrear] = useState(false)
  const pathname = usePathname() || '/'
  const router = useRouter()
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
  const valor = useMemo(() => ({ registrar }), [registrar])

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
          hayAvisos={avisos > 0 || hayAvisos}
          onCuenta={() => setCuenta(true)}
          titulo={dePantalla?.titulo}
          subtitulo={dePantalla?.subtitulo}
          acciones={dePantalla?.acciones}
          paso={dePantalla?.paso}
          total={dePantalla?.total}
          onVolver={dePantalla?.onVolver ?? (() => router.back())}
          onCerrar={dePantalla?.onCerrar ?? (() => router.back())}
        />
      )}

      {children}

      {/* La pastilla NO se oculta con CSS: no se monta. Un `display:none` deja
          los cinco destinos en el árbol y un lector de pantalla los sigue
          anunciando en una pantalla donde no se puede navegar. */}
      {armazon.pastilla && <PastillaNav onCrear={onCrear ?? (() => setMenuCrear(true))} />}

      <HojaCuenta
        abierta={cuenta}
        onCerrar={() => setCuenta(false)}
        nombre={nombre}
        rol={rolEnEspanol(rol)}
        iniciales={iniciales(nombre)}
        conectado={conectado}
        tema={theme ?? 'system'}
        onCambiarTema={setTheme}
        onConfiguracion={() => { setCuenta(false); router.push('/configuracion') }}
        onPlan={() => { setCuenta(false); router.push('/configuracion/plan') }}
        onSoporte={() => { setCuenta(false); router.push('/soporte') }}
        onCerrarSesion={() => signOut({ callbackUrl: '/login' })}
      />

      {menuCrear && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90 }}>
          <MenuCrear
            fecha={new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            hora={new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            onIr={(destino) => { setMenuCrear(false); window.location.href = destino }}
            onCerrar={() => setMenuCrear(false)}
          />
        </div>
      )}
    </ArmazonContext.Provider>
  )
}
