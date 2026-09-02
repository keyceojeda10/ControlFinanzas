'use client'

// components/armazon/BarraLateral.jsx
//
// El armazón de escritorio. docs/design_handoff/02-ARMAZON.md sección D.
//
// NO hay cabecera superior en escritorio: todo el armazón vive acá y el ancho
// completo queda para el contenido. Cada pantalla pone su propio encabezado.
//
// LA BARRA LATERAL NUNCA SE OCULTA. Quien usa PC está revisando, no cobrando en
// la calle; ahí la navegación siempre ayuda. La regla de supresión es exclusiva
// de móvil.
//
// El cambio de tema SÍ va visible acá — a diferencia de móvil, donde vive en la
// hoja de cuenta — porque en la barra lateral no le quita sitio a nada.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { rolEnEspanol } from '@/lib/armazon'
import { getAvatarById } from '@/lib/avatars'
import { useOnline } from '@/hooks/useOnline'
import { useTheme } from '@/lib/theme/ThemeProvider'
import { ICONO_DE_RUTA } from '@/components/armazon/iconos'

const t = { fill: 'none', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }

/* Los de RUTA salen del juego compartido: la barra lateral, la pastilla y los
   accesos directos del buscador dibujaban cada uno los suyos, y por eso «gastos»
   o «mi plata» se veían distintos según dónde miraras. Aquí quedan los que NO
   son destinos —la lupa, la campana, el sol— que solo usa esta barra. */
const ICONOS = {
  dashboard:  ICONO_DE_RUTA['/dashboard'],
  cobros:     ICONO_DE_RUTA['/cobros-hoy'],
  rutas:      ICONO_DE_RUTA['/rutas'],
  prestamos:  ICONO_DE_RUTA['/prestamos'],
  clientes:   ICONO_DE_RUTA['/clientes'],
  caja:       ICONO_DE_RUTA['/caja'],
  buscar:     <><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></>,
  campana:    <><path d="M18 8.5a6 6 0 00-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5z" /><path d="M13.7 20.5a2 2 0 01-3.4 0" /></>,
  chevron:    <><path d="M6 9l6 6 6-6" /></>,
  sol:        <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  luna:       <><path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" /></>,
}

// Orden fijo del documento.
const PRINCIPAL = [
  // EXACTAMENTE LAS SEIS PANTALLAS DE NAVEGACIÓN, ni una más (lámina T39-05 y
  // regla §E de 02-ARMAZON.md). Yo tenía aquí «Líneas de crédito» como séptima:
  // se fue a «Más herramientas», que es donde va lo que no se toca a diario.
  { href: '/dashboard',            nombre: 'Dashboard',         icono: 'dashboard' },
  { href: '/cobros-hoy',           nombre: 'Cobrar hoy',        icono: 'cobros' },
  { href: '/rutas',                nombre: 'Rutas',             icono: 'rutas' },
  { href: '/prestamos',            nombre: 'Préstamos',         icono: 'prestamos' },
  { href: '/clientes',             nombre: 'Clientes',          icono: 'clientes' },
  { href: '/caja',                 nombre: 'Caja',              icono: 'caja' },
]

const HERRAMIENTAS = [
  { href: '/capital',              nombre: 'Capital' },
  { href: '/lineas-credito',       nombre: 'Líneas de crédito' },
  { href: '/gastos',               nombre: 'Gastos' },
  { href: '/reportes',             nombre: 'Reportes' },
  { href: '/dashboard/analiticas', nombre: '¿Cómo va el negocio?' },
  { href: '/cobradores',           nombre: 'Cobradores' },
  { href: '/socios',               nombre: 'Socios' },
  { href: '/migrador',             nombre: 'Pasar mi cuaderno' },
  { href: '/carga-masiva',         nombre: 'Importar Excel' },
  { href: '/clavos',               nombre: 'Perdidos' },
  { href: '/actividad',            nombre: 'Historial' },
  // Venía del grupo «Cuenta», que se fue: ver la nota de abajo. Configuración y
  // Soporte se quedaron cubiertos por HojaCuenta, pero Tutoriales no está ahí,
  // y quitarlo sin más lo dejaba sin ninguna vía desde la barra.
  { href: '/tutoriales',           nombre: 'Tutoriales' },
]

// EL GRUPO «CUENTA» NO EXISTE EN T39-05. En la lámina, después de «Más
// herramientas» va un espaciador y luego directo el pie: selector de tema y
// ficha del usuario. Yo tenía un segundo grupo desplegable con Configuración,
// Soporte y Tutoriales — redundante con la ficha del usuario, que lleva el
// chevron precisamente porque ES el acceso a todo eso.
//
// Solo se pudo quitar después de montar HojaCuenta y de que el avatar abriera
// de verdad: hasta hace un rato pulsarlo no hacía nada, así que este grupo era
// la única forma de llegar a Configuración en escritorio.

/**
 * La campana. Igual que el FAB, tenía su prop y nadie se la pasaba: era un
 * <button> sin onClick, decorativo. Su destino es la hoja «Cosas por resolver»
 * —lo que no ganó la franja de arriba—, que vive en PilaAvisos, hermana en el
 * árbol y no antepasada. Por eso el aviso va por evento del navegador.
 */
/** Igual que en la cabecera movil: `layout.jsx` monta la barra sin `onBuscar`. */
function abrirBuscador() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('cf:abrir-buscador'))
}

function abrirAvisos() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('cf:abrir-avisos'))
}

/**
 * La ficha del usuario, abajo. Mismo caso: `onCuenta` estaba declarado y nadie
 * se lo pasaba, así que pulsar el avatar no hacía NADA —ni en escritorio ni en
 * móvil—. Y HojaCuenta, que es su destino, estaba construida y solo montada en
 * el banco de pruebas: en la app no existía.
 *
 * Importa más de lo que parece: en T39-05 no hay grupo «Cuenta» en la
 * navegación, así que esta ficha es la ÚNICA vía a Configuración y a cerrar
 * sesión. Un avatar muerto dejaba la app sin salida.
 *
 * Va por evento por lo mismo que los avisos: quien monta la hoja es Armazon,
 * que es antepasado de esta barra pero no le pasa props (las trae el layout).
 */
function abrirCuenta() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('cf:abrir-cuenta'))
}

function Item({ href, nombre, icono, activo }) {
  return (
    <Link href={href} aria-current={activo ? 'page' : undefined}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center',
        // `flex: none` NO ES DECORACIÓN. Sin él, al desplegar «Más
        // herramientas» flexbox ENCOGE los items de arriba para meter lo nuevo:
        // los siete destinos principales pasaban de 37px a la mitad y quedaban
        // apiñados. Flexbox encoge ANTES de dejar que el <nav> scrollee, así que
        // hay que quitarle esa licencia para que scrollee, que es lo correcto.
        flex: 'none',
        // gap 11, no 10: es lo que dice T39-05.
        height: 37, minHeight: 37, padding: '0 12px', borderRadius: 13, gap: 11,
        background: activo ? 'var(--cf-gold-tint)' : 'transparent',
        color: activo ? 'var(--cf-gold-text)' : 'var(--cf-ink-2)',
        fontSize: 14, fontWeight: activo ? 700 : 600,
        textDecoration: 'none',
      }}>
      {activo && (
        // El riel: la marca de "estás aquí" sin gastar dorado saturado.
        <span style={{ position: 'absolute', left: 0, top: 7, bottom: 7, width: 3, borderRadius: 999, background: 'var(--cf-gold)' }} />
      )}
      {icono && (
        <svg width="17" height="17" viewBox="0 0 24 24" {...t}
          stroke={activo ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)'}
          strokeWidth={activo ? 2.1 : 1.9} style={{ flex: 'none' }}>
          {ICONOS[icono]}
        </svg>
      )}
      <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
    </Link>
  )
}

function Grupo({ titulo, items, pathname, abiertoPorDefecto = false }) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto || items.some(i => pathname.startsWith(i.href)))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 'none' }}>
      {/* Las medidas y la línea son de T39-05: el rótulo mide 35 de alto y lleva
          ÉL el borde superior, con `padding: 13px 12px 0` y `margin-top: 6`. Yo
          tenía el rótulo a 30 y la línea aparte, como un <div> separador de 1px
          con margen 8 — dos formas de dibujar lo mismo, pero la separación
          quedaba más suelta de lo que pide la lámina. */}
      <button type="button" onClick={() => setAbierto(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flex: 'none', height: 35, minHeight: 35,
          padding: '13px 12px 0', marginTop: 6,
          borderTop: '1px solid var(--cf-divider)',
          borderLeft: 0, borderRight: 0, borderBottom: 0,
          background: 'none', cursor: 'pointer',
          fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase',
          color: 'var(--cf-ink-3)',
        }}>
        {titulo}
        {/* Cerrado apunta ABAJO, abierto arriba: es lo que dibuja la lámina. Yo
            lo tenía apuntando a la derecha cuando está cerrado. */}
        <svg width="14" height="14" viewBox="0 0 24 24" {...t} strokeWidth={2.2} stroke="var(--cf-ink-3)"
          style={{ transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          {ICONOS.chevron}
        </svg>
      </button>
      {abierto && items.map(i => (
        <Item key={i.href} {...i} activo={pathname === i.href || pathname.startsWith(i.href + '/')} />
      ))}
    </div>
  )
}

function SelectorTema({ tema, onCambiar }) {
  const ops = [
    { id: 'light', nombre: 'Claro',  icono: 'sol' },
    { id: 'dark',  nombre: 'Oscuro', icono: 'luna' },
    { id: 'system', nombre: 'Auto',  icono: null },
  ]
  return (
    <div style={{
      display: 'flex', gap: 5, padding: 4, borderRadius: 12,
      background: 'var(--cf-fill)', border: '1px solid var(--cf-divider)',
    }}>
      {ops.map(o => {
        const a = tema === o.id
        return (
          <button key={o.id} type="button" onClick={() => onCambiar?.(o.id)}
            style={{
              flex: 1, height: 32, borderRadius: 9, border: 0, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              background: a ? 'var(--cf-card)' : 'transparent',
              boxShadow: a ? '0 1px 2px rgba(20,20,28,.1)' : 'none',
              fontSize: 12, fontWeight: a ? 700 : 600,
              color: a ? 'var(--cf-ink)' : 'var(--cf-ink-3)',
            }}>
            {o.icono && <svg width="14" height="14" viewBox="0 0 24 24" {...t} stroke={a ? 'var(--cf-gold-dark)' : 'var(--cf-ink-3)'}>{ICONOS[o.icono]}</svg>}
            {o.nombre}
          </button>
        )
      })}
    </div>
  )
}

export default function BarraLateral({
  nombre = '', rol = '', iniciales = '', avatarId = null,
  hayAvisos = false, onBuscar, onAvisos, onCuenta,
}) {
  const pathname = usePathname() || '/'

  // El punto del avatar dice si lo que se está viendo llegó del servidor: en una
  // app que se usa con señal intermitente, es la diferencia entre «no me han
  // pagado» y «todavía no me ha llegado».
  //
  // Se detecta ACÁ y no por prop: era lo único que Armazon calculaba para pasar
  // hacia abajo, y con la cabecera móvil sin punto (T40-00-a) esta barra quedó
  // como única consumidora.
  //
  // Y se usa `useOnline()`, que ya existía, en vez del `navigator.onLine` que yo
  // había escrito a mano: ese miente cuando hay WiFi sin paso a internet —el
  // limbo típico del cobrador en la calle— y habría pintado el punto en verde
  // justo en el caso en que hay que avisar. El hook además hace ping a /api/ping.
  const conectado = useOnline()

  // El tema sale del proveedor de verdad, que ya está montado en app/layout.js.
  // Llegaba por prop con `'light'` por defecto y NADIE se la pasaba: las tres
  // pastillas Claro/Oscuro/Auto se pulsaban y no cambiaban nada, y encima la
  // activa siempre se dibujaba en «Claro» aunque la app estuviera en oscuro.
  const { theme, setTheme } = useTheme() ?? {}

  // Cuántos avisos hay, para el número de la campana. Lo publica PilaAvisos por
  // evento; `hayAvisos` queda como respaldo booleano para el banco de pruebas.
  // El layout tampoco pasaba esta prop, así que la campana de escritorio no
  // podía enterarse de nada.
  const [avisos, setAvisos] = useState(0)
  useEffect(() => {
    const oir = (e) => setAvisos(Number(e.detail) || 0)
    window.addEventListener('cf:avisos', oir)
    return () => window.removeEventListener('cf:avisos', oir)
  }, [])
  const cuantosAvisos = avisos || (hayAvisos ? 1 : 0)

  return (
    // Solo escritorio. `display` NO puede ir en el estilo en linea: le ganaria
    // a `hidden` y la barra saldria tambien en el telefono, encima de la
    // pastilla.
    <aside className="hidden lg:flex cf-no-print" style={{
      flex: 'none',
      width: 'var(--cf-w-sidebar)', minWidth: 'var(--cf-w-sidebar)',
      height: '100dvh', position: 'sticky', top: 0,
      background: 'var(--cf-card)',
      borderRight: '1px solid var(--cf-border)',
      flexDirection: 'column',
    }}>
      {/* ── Zona superior ── */}
      <div style={{ padding: '16px 15px 13px', borderBottom: '1px solid var(--cf-divider)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* EL LOGO LLEVA AL PANEL. Era un `<img>` suelto: el dueño reportó
              que «el icono de la aplicación no sirve para volver al inicio».
              Tocar la marca es lo primero que intenta cualquiera que se siente
              perdido, y aquí no hacía nada. */}
          <Link href="/dashboard" aria-label="Ir al panel" style={{ display: 'flex', flex: 'none' }}>
            <img
              src="/logo-icon.svg"
              alt="Control Finanzas"
              width={32}
              height={32}
              /* Radio 11 acá, no 10: T39-05 lo dibuja un punto más redondo que
                 el de la cabecera móvil (T40-00-a dice 10). Es un píxel, pero
                 es el que hay escrito. */
              style={{ flex: 'none', width: 32, minWidth: 32, height: 32, aspectRatio: '1', borderRadius: 11 }}
            />
          </Link>
          {/* 13px y line-height 1.12, literal de T39-05. Yo los tenía a 14, y a
              esa altura las dos líneas del logotipo pesan más que el nombre de
              la pantalla activa, que es lo que hay que leer. */}
          <span style={{ flex: 1, minWidth: 0, lineHeight: 1.12 }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--cf-ink)' }}>Control</span>
            {/* «Finanzas» en dorado: T39-05 lo pinta #b07d00 = --cf-gold-dark. */}
            <span style={{ display: 'block', fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--cf-gold-dark)' }}>Finanzas</span>
          </span>
          <button type="button" onClick={onAvisos ?? abrirAvisos} aria-label="Avisos"
            style={{
              position: 'relative', flex: 'none', width: 32, height: 32, borderRadius: 10,
              background: 'var(--cf-fill)', border: '1px solid var(--cf-divider)', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" {...t} strokeWidth={2} stroke="var(--cf-ink-2)">{ICONOS.campana}</svg>
            {/* ACÁ SÍ VA EL NÚMERO, al contrario que en móvil.
                T40-00-a quitó el conteo de la cabecera —«el conteo exacto no
                cambia ninguna decisión»— pero es una lámina de 390px y el turno
                40 no tiene variante de escritorio. La única lámina de 1440 es
                T39-05, y dibuja un «3». Y tiene sentido que difieran: en el
                teléfono se cobra, y ahí un número más es ruido; en el PC se
                revisa, y saber si son 2 o 14 sí cambia por dónde empezar.
                Medidas literales: desborda la esquina (top/right -3), mínimo 16
                de ancho para que un número de dos cifras no lo deforme. */}
            {cuantosAvisos > 0 && (
              <span className="cf-num" style={{
                position: 'absolute', top: -3, right: -3,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999,
                background: 'var(--cf-red)', border: '2px solid var(--cf-card)',
                fontSize: 11, fontWeight: 700, color: '#FFF',
              }}>{cuantosAvisos}</span>
            )}
          </button>
        </div>

        <button type="button" onClick={onBuscar ?? abrirBuscador}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            height: 38, padding: '0 12px', borderRadius: 13,
            background: 'var(--cf-fill)', border: '1px solid var(--cf-divider)',
            cursor: 'pointer', width: '100%',
          }}>
          <svg width="15" height="15" viewBox="0 0 24 24" {...t} stroke="var(--cf-ink-4)" style={{ flex: 'none' }}>{ICONOS.buscar}</svg>
          <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: 'var(--cf-ink-4)' }}>Buscar…</span>
          <span style={{
            height: 20, padding: '0 6px', borderRadius: 6, display: 'inline-flex', alignItems: 'center',
            background: 'var(--cf-card)', border: '1px solid rgba(20,20,28,.1)',
            fontFamily: 'ui-monospace, monospace', fontSize: 10, fontWeight: 600, color: 'var(--cf-ink-3)',
          }}>Ctrl+K</span>
        </button>
      </div>

      {/* ── Navegación ── */}
      <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {PRINCIPAL.map(i => (
          <Item key={i.href} {...i} activo={pathname === i.href || pathname.startsWith(i.href + '/')} />
        ))}
        {/* La línea la lleva el rótulo del grupo, como en la lámina. */}
        <Grupo titulo="Más herramientas" items={HERRAMIENTAS} pathname={pathname} />
        {/* Y aquí acaba: en T39-05, detrás del grupo va este espaciador vacío y
            nada más. El grupo «Cuenta» que yo tenía se fue al pie, que es donde
            la lámina pone el acceso a la cuenta. */}
        <div style={{ flex: 1, minHeight: 0 }} />
      </nav>

      {/* ── Zona de cuenta ── */}
      <div style={{ padding: 12, borderTop: '1px solid var(--cf-divider)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SelectorTema tema={theme ?? 'system'} onCambiar={setTheme} />
        <button type="button" onClick={onCuenta ?? abrirCuenta}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: 10, borderRadius: 14,
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)', cursor: 'pointer',
          }}>
          <span style={{ position: 'relative', flex: 'none' }}>
            {/* El avatar elegido en configuración, si lo hay. Antes solo se
                pintaban las iniciales aunque el usuario hubiera escogido uno. */}
            {avatarId && getAvatarById(avatarId) ? (
              <img src={getAvatarById(avatarId).src} alt="" aria-hidden loading="lazy" style={{
                display: 'inline-block', overflow: 'hidden',
                width: 32, height: 32, borderRadius: 999,
              }} />
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 999, background: 'var(--cf-blue)',
                /* 11px acá, no 12: la lámina baja un punto respecto al avatar de
                   la cabecera móvil, porque al lado hay nombre y rol y las
                   iniciales dejan de ser lo que se lee. */
                fontSize: 11, fontWeight: 700, color: '#FFF',
              }}>{iniciales}</span>
            )}
            <span style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: 999, background: conectado ? 'var(--cf-green)' : 'var(--cf-ink-4)', border: '2px solid var(--cf-card)' }} />
          </span>
          <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
            {/* Traducido: en la base el rol es `owner`, y salía así tal cual. */}
            <span style={{ display: 'block', fontSize: 11, color: 'var(--cf-ink-3)' }}>{rolEnEspanol(rol)}</span>
          </span>
          <svg width="15" height="15" viewBox="0 0 24 24" {...t} stroke="var(--cf-ink-4)" style={{ flex: 'none', transform: 'rotate(-90deg)' }}>{ICONOS.chevron}</svg>
        </button>
      </div>
    </aside>
  )
}
