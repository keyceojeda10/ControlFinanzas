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
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { CABECERA, resolverArmazon } from '@/lib/armazon'
import CabeceraMovil from '@/components/armazon/CabeceraMovil'
import PastillaNav from '@/components/armazon/PastillaNav'
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

  const clave = `${titulo ?? ''}|${subtitulo ?? ''}|${paso ?? ''}|${total ?? ''}`

  useEffect(() => {
    if (!registrar) return
    registrar(ultimo.current)
    return () => registrar(null)
  }, [registrar, clave])
}

/** Iniciales del nombre. Dos letras: más se lee como una palabra rota. */
function iniciales(nombre = '') {
  const partes = String(nombre).trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '·'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

export default function Armazon({ children, nombre: nombreServidor, hayAvisos = false, onCrear }) {
  // EL FAB ESTABA MUERTO. `onCrear` se declaraba aquí pero el layout nunca lo
  // pasaba, así que el botón principal de crear —el que sale en TODAS las
  // pantallas de navegación— se pulsaba y no hacía nada: ni menú, ni navegar,
  // ni error. Un botón que no responde enseña a no volver a tocarlo.
  const [menuCrear, setMenuCrear] = useState(false)
  const pathname = usePathname() || '/'
  const { data: session } = useSession()
  const [dePantalla, setDePantalla] = useState(null)
  const [conectado, setConectado] = useState(true)

  const registrar = useMemo(() => (config) => setDePantalla(config), [])
  const valor = useMemo(() => ({ registrar }), [registrar])

  // El punto verde del avatar dice si lo que se está viendo llegó del servidor.
  // En una app que se usa en la calle, con señal intermitente, es la diferencia
  // entre "no me han pagado" y "todavía no me ha llegado".
  useEffect(() => {
    const actualizar = () => setConectado(navigator.onLine)
    actualizar()
    window.addEventListener('online', actualizar)
    window.addEventListener('offline', actualizar)
    return () => {
      window.removeEventListener('online', actualizar)
      window.removeEventListener('offline', actualizar)
    }
  }, [])

  const armazon = resolverArmazon(pathname)

  // El nombre lo manda el LAYOUT, que es servidor y ya tiene la sesión.
  // `useSession()` devuelve null durante el render del servidor, así que
  // derivar de él las iniciales hacía que el servidor pintara "·" y el cliente
  // "CA": desajuste de hidratación en TODAS las pantallas, y un parpadeo del
  // avatar en cada carga. La sesión de cliente queda solo como respaldo.
  const nombre = nombreServidor || session?.user?.nombre || session?.user?.name || ''

  return (
    <ArmazonContext.Provider value={valor}>
      {armazon.cabecera !== CABECERA.NINGUNA && (
        <CabeceraMovil
          variante={armazon.cabecera}
          iniciales={iniciales(nombre)}
          conectado={conectado}
          hayAvisos={hayAvisos}
          titulo={dePantalla?.titulo}
          subtitulo={dePantalla?.subtitulo}
          acciones={dePantalla?.acciones}
          paso={dePantalla?.paso}
          total={dePantalla?.total}
          onVolver={dePantalla?.onVolver}
          onCerrar={dePantalla?.onCerrar}
        />
      )}

      {children}

      {/* La pastilla NO se oculta con CSS: no se monta. Un `display:none` deja
          los cinco destinos en el árbol y un lector de pantalla los sigue
          anunciando en una pantalla donde no se puede navegar. */}
      {armazon.pastilla && <PastillaNav onCrear={onCrear ?? (() => setMenuCrear(true))} />}

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
