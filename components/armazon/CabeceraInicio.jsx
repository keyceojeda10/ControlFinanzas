'use client'

/* ══ LA CABECERA DE INICIO (17 nov 2026) ══════════════════════════════════════
 *
 * Referencia del dueño: la cabecera de una app de domicilios —«muchos accesos
 * rápidos, filtros, categorías… queda bastante profesional»— y que al bajar «se
 * focaliza más en la búsqueda». Eligió la versión «todo negro» (B) para Inicio:
 * negro con detalles dorados, «la cabecera dorada sería mucho», y «Nuevo
 * préstamo» y «Nuevo cliente» destacados.
 *
 *   · Franja negra: perfil, el chip con lo cobrado hoy, el profe y la campana;
 *     la fecha, el saludo y lo que toca cobrar hoy; los dos botones de crear; y
 *     los accesos.
 *   · Una hoja con el BUSCADOR y los filtros del día.
 *   · Al bajar, cuando el buscador sale de la pantalla, aparece arriba la versión
 *     compacta: el buscador, los accesos en pequeño y los filtros.
 *
 * ⚠ UN SOLO BUSCADOR. «¿Qué necesitas hacer aquí?» y la lupa eran dos entradas
 * al mismo motor (la lupa encuentra clientes, préstamos y rutas ADEMÁS de las
 * acciones y las guías). El dueño: «hay dos formas de buscar… me confundió». El
 * campo de la cabecera abre la búsqueda global y lo dice: un cliente o lo que
 * necesitas hacer. «¿Qué necesitas…?» queda en las fichas de detalle.
 *
 * Solo móvil (`lg:hidden`): en PC está la barra lateral. La pastilla de abajo no
 * se toca.
 */
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useHayAvisos, useAvatarArmazon } from '@/components/armazon/Armazon'
import { getAvatarById } from '@/lib/avatars'
import { useRouter } from 'next/navigation'
import { Chip as ChipFiltro } from '@/components/cf/primitivos'

const NEGRO = '#15161A'       // fijo: en modo oscuro `--cf-ink` se vuelve claro
const NEGRO_2 = '#24252B'
const ORO = '#E7A400'
const ORO_TINTA = '#3A2900'
const RADIO_HOJA = 26
export const TEXTO_BUSCADOR = 'Busca un cliente o lo que necesitas hacer'

const trazo = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }
const Ic = ({ d, tam = 24 }) => <svg width={tam} height={tam} viewBox="0 0 24 24" {...trazo} aria-hidden>{d}</svg>
export const ICONOS = {
  hoy: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></>,
  prestamo: <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.5" /><path d="M19 3v4M17 5h4" /></>,
  cliente: <><circle cx="9.5" cy="8" r="3.5" /><path d="M3 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M19 8v6M16 11h6" /></>,
  cobrar: <><circle cx="12" cy="12" r="8.5" /><path d="M12 6.5v11M14.6 9.2c-.4-.9-1.4-1.5-2.6-1.5-1.5 0-2.6.8-2.6 2s1.1 1.7 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.2 0-2.2-.6-2.6-1.5" /></>,
  clientes: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5M16 5.2a3 3 0 010 5.6M18 14.6c1.7.6 2.7 2.1 3 4.9" /></>,
  prestamos: <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.5" /><path d="M6 9.5v.01M18 14.5v.01" /></>,
  caja: <><path d="M4 7.5h14.5A1.5 1.5 0 0120 9v9.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5V6a2 2 0 012-2h10" /><path d="M16 13.75h.01" /></>,
  rutas: <><path d="M9 4.5L3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z" /><path d="M9 4.5v13M15 6.5v13" /></>,
  simulador: <><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M8.5 7h7M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15v2.5" /></>,
  reportes: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  mas: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" /></>,
  lista: <path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01" />,
  buscar: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  campana: <><path d="M6 9.5a6 6 0 0112 0c0 6 2.5 7.5 2.5 7.5h-17S6 15.5 6 9.5z" /><path d="M10 20.5a2.2 2.2 0 004 0" /></>,
}

/** Los accesos de Inicio, con los permisos de quien mira. */
export function accesosDeInicio({ esOwner = false } = {}) {
  return [
    { id: 'hoy', nombre: 'Hoy', href: '/dashboard', activo: true },
    { id: 'cobrar', nombre: 'Cobrar hoy', href: '/cobros-hoy' },
    { id: 'clientes', nombre: 'Clientes', href: '/clientes' },
    { id: 'prestamos', nombre: 'Préstamos', href: '/prestamos' },
    { id: 'caja', nombre: 'Caja', href: '/caja' },
    { id: 'rutas', nombre: 'Rutas', href: '/rutas' },
    { id: 'simulador', nombre: 'Simulador', href: '/prestamos/simulador' },
    ...(esOwner ? [{ id: 'reportes', nombre: 'Reportes', href: '/reportes' }] : []),
    { id: 'mas', nombre: 'Más', href: '/mas' },
  ]
}

const abrir = (evento) => () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(evento)) }

/* El ícono que la persona eligió en Configuración; si no eligió, sus iniciales.
   Sale de `getAvatarById`, la misma lista que la pantalla donde se elige. */
function Avatar({ iniciales }) {
  const dibujo = getAvatarById(useAvatarArmazon())
  return (
    <button type="button" onClick={abrir('cf:abrir-cuenta')} aria-label="Tu cuenta" className="cf-cab-toque" style={{
      width: 42, height: 42, borderRadius: 999, flex: 'none', border: `1.5px solid ${ORO}`, background: NEGRO_2,
      color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 0 0 4px rgba(231,164,0,.12)',
      padding: 0, overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {dibujo
        // eslint-disable-next-line @next/next/no-img-element -- SVG local de 42px, como en CabeceraMovil
        ? <img src={dibujo.src} alt="" aria-hidden style={{ width: '100%', height: '100%', display: 'block' }} />
        : iniciales}
    </button>
  )
}

/* El chip: el nombre y lo cobrado hoy, como «Carlos × 1826 pts» en la referencia.
   Sin datos todavía no dice $0: el cero es un dato y aún no se sabe. */
/* SIN EL NOMBRE (18 nov 2026). Con «Carlos · $200.000 hoy» el «hoy» ya se salía
   de la píldora, y con un día de $10.000.000 se montaba sobre el profe. El nombre
   ya lo dice el saludo de abajo («Buenos días, Carlos»); la cifra no se recorta. */
function Chip({ cobrado, fmt }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px', borderRadius: 999,
      flex: 'none', background: NEGRO_2, color: '#fff', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
      border: '1px solid rgba(255,255,255,.06)',
    }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: ORO, flex: 'none' }} />
      <span className="cf-num" style={{ fontWeight: 800, color: cobrado == null ? 'rgba(255,255,255,.5)' : '#fff' }}>{cobrado == null ? '…' : fmt(cobrado)}</span>
      <span className="cf-cab-chip-hoy" style={{ color: 'rgba(255,255,255,.55)', fontWeight: 500 }}>hoy</span>
    </span>
  )
}

function Campana({ punto: puntoPedido }) {
  const avisos = useHayAvisos()
  const punto = puntoPedido || avisos
  return (
    <button type="button" onClick={abrir('cf:abrir-avisos')} aria-label="Avisos" className="cf-cab-toque" style={{
      width: 44, height: 44, borderRadius: 999, border: 0, background: 'transparent', color: '#fff',
      display: 'grid', placeItems: 'center', cursor: 'pointer', position: 'relative', flex: 'none',
    }}>
      <Ic d={ICONOS.campana} />
      {punto && <span style={{ position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 999, background: ORO, border: `2px solid ${NEGRO}` }} />}
    </button>
  )
}

/** El buscador único: abre la búsqueda global (clientes, préstamos, acciones y guías). */
export function Buscador({ grande = false }) {
  return (
    <button type="button" onClick={abrir('cf:abrir-buscador')} className="cf-cab-toque" style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%', height: grande ? 50 : 52, padding: '0 16px',
      borderRadius: 999, cursor: 'text', textAlign: 'left', font: 'inherit',
      background: grande ? 'var(--cf-fill)' : 'var(--cf-card)',
      border: grande ? '1px solid transparent' : '1px solid var(--cf-border)',
      boxShadow: grande ? 'none' : '0 4px 14px rgba(21,22,26,.06)',
      color: 'var(--cf-ink-3)', fontSize: 15.5,
    }}>
      <span style={{ color: 'var(--cf-ink)', display: 'flex' }}><Ic d={ICONOS.buscar} tam={22} /></span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{TEXTO_BUSCADOR}</span>
    </button>
  )
}

/* Un acceso sobre negro: el icono en su círculo y el nombre debajo. */
function Acceso({ a }) {
  return (
    <Link href={a.href} className="cf-cab-acceso" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, width: 70, flex: 'none',
      textDecoration: 'none', paddingBottom: 12, position: 'relative',
    }}>
      <span className="cf-cab-circulo" style={{
        width: 54, height: 54, borderRadius: 999, display: 'grid', placeItems: 'center',
        background: a.activo ? 'rgba(231,164,0,.14)' : NEGRO_2, color: a.activo ? ORO : '#fff',
        border: a.activo ? '1px solid rgba(231,164,0,.45)' : '1px solid rgba(255,255,255,.06)',
      }}><Ic d={ICONOS[a.id]} tam={25} /></span>
      <span style={{ fontSize: 12, lineHeight: 1.2, textAlign: 'center', fontWeight: a.activo ? 700 : 500, color: a.activo ? '#fff' : 'rgba(255,255,255,.7)' }}>{a.nombre}</span>
      {a.activo && <span style={{ position: 'absolute', bottom: 0, left: 12, right: 12, height: 3, borderRadius: 3, background: ORO }} />}
    </Link>
  )
}

/** Los atajos del día, con su número (el cero también va). Con el MISMO `Chip`
 *  que los filtros de las listas: dos formas de píldora en la app se leen como
 *  dos cosas distintas. En Inicio son atajos a una lista, no filtros: ninguno va
 *  marcado como puesto. */
export function Filtros({ pildoras = [] }) {
  const router = useRouter()
  return (
    <div style={{ display: 'flex', gap: 'var(--cf-gap-chips)', overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -20px', padding: '2px 20px' }}>
      {pildoras.map((p) => (
        <ChipFiltro key={p.t} conteo={p.n} onClick={() => router.push(p.href)}
          style={p.rojo ? { color: 'var(--cf-red-dark)' } : undefined}>
          {p.t}
        </ChipFiltro>
      ))}
    </div>
  )
}

/** Lo que queda arriba al bajar: el buscador, los accesos en pequeño y los filtros. */
export function Compacta({ visible, accesos, pildoras, arriba = null, abajo = null }) {
  return (
    <div aria-hidden={!visible} className="lg:hidden cf-cab-compacta" style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40,
      transform: visible ? 'translateY(0)' : 'translateY(-110%)', opacity: visible ? 1 : 0,
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <div style={{
        /* Sólido, no translúcido: a través del vidrio se colaba el brillo dorado
           de las tarjetas de abajo y se veía como una mancha entre los filtros. */
        background: 'var(--cf-card)', borderBottom: '1px solid var(--cf-border)',
        // 20 a los lados, como el <main>: las tiras de filtros salen 20 de su caja.
        padding: 'max(10px, env(safe-area-inset-top)) 20px 10px', display: 'flex', flexDirection: 'column', gap: 8,
        '--cf-fondo-tira': 'var(--cf-card)',
        boxShadow: '0 10px 24px rgba(21,22,26,.07)',
      }}>
        {arriba ?? <Buscador grande />}
        <div style={{ display: 'flex', gap: 18, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -20px', padding: '0 20px', borderBottom: '1px solid var(--cf-border)' }}>
          {accesos.map((a) => (
            <Link key={a.id} href={a.href} tabIndex={visible ? 0 : -1} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 0 9px', flex: 'none', textDecoration: 'none',
              color: 'var(--cf-ink)', fontSize: 14, fontWeight: a.activo ? 700 : 500,
              borderBottom: a.activo ? `3px solid ${ORO}` : '3px solid transparent', marginBottom: -1,
            }}><span style={{ display: 'flex', color: a.activo ? 'var(--cf-gold-dark)' : 'var(--cf-ink-2)' }}><Ic d={ICONOS[a.id]} tam={18} /></span>{a.nombre}</Link>
          ))}
        </div>
        {abajo ?? <Filtros pildoras={pildoras} />}
      </div>
    </div>
  )
}

/* El tacto: todo lo que se toca se hunde un poco. Sin animación si el teléfono la
   pidió quitar. */
const ESTILO = `
.cf-cab-toque, .cf-cab-acceso .cf-cab-circulo { transition: transform .15s ease, background-color .15s ease; }
.cf-cab-toque:active, .cf-cab-acceso:active .cf-cab-circulo { transform: scale(.96); }
.cf-cab-compacta { transition: transform .26s cubic-bezier(.2,.8,.2,1), opacity .2s ease; }
@media (prefers-reduced-motion: reduce) { .cf-cab-toque, .cf-cab-acceso .cf-cab-circulo, .cf-cab-compacta { transition: none; } }
/* Teléfonos de 360 px: con un día de $12.345.678 la fila de arriba se pasaba
   14 px del borde, y «Nuevo préstamo» se partía en dos renglones. Se va la
   palabra «hoy» (la cifra no se toca) y los dos botones bajan un punto. */
.cf-cab-boton { white-space: nowrap; }
@media (max-width: 380px) {
  .cf-cab-chip-hoy { display: none; }
  .cf-cab-boton { font-size: 15px !important; gap: 6px !important; }
}
`

export default function CabeceraInicio({
  nombre = '', iniciales = '·', saludo = '', fecha = '', fmt = String,
  cifras = {}, hayAvisos = false, profe = null,
  puedePrestar = true, puedeCrearCliente = true, esOwner = false,
}) {
  /* La compacta sale cuando el buscador de la hoja deja de verse por arriba: el
     relevo es continuo, sin un umbral de píxeles que cambie con cada teléfono. */
  const marca = useRef(null)
  const [abajo, setAbajo] = useState(false)
  useEffect(() => {
    const el = marca.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setAbajo(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const primero = (nombre || '').split(/\s+/)[0] || ''
  const accesos = accesosDeInicio({ esOwner })
  const pildoras = [
    { t: 'Para cobrar hoy', n: cifras.porCobrar, href: '/cobros-hoy' },
    { t: 'Ya pagaron', n: cifras.yaPagaron, href: '/cobros-hoy' },
    { t: 'En mora', n: cifras.enMora, href: '/clientes?filtro=mora', rojo: cifras.enMora > 0 },
  ]
  const hayDatos = cifras.cobradoHoy != null

  return (
    /* -20px: el `px-5 py-5` del <main>. La franja va de borde a borde y hasta arriba. */
    <div className="lg:hidden" style={{ margin: '-20px -20px 0' }}>
      <style>{ESTILO}</style>
      <div style={{
        background: `radial-gradient(120% 70% at 100% 0%, rgba(231,164,0,.16), transparent 58%), ${NEGRO}`,
        // Lo que la hoja se monta encima (RADIO_HOJA) más el aire de antes.
        paddingBottom: RADIO_HOJA + 10,
      }}>
        {/* Perfil, cobrado hoy, profe y avisos. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'max(14px, env(safe-area-inset-top)) 16px 0' }}>
          <Avatar iniciales={iniciales} />
          <Chip cobrado={hayDatos ? cifras.cobradoHoy : null} fmt={fmt} />
          <span style={{ flex: 1 }} />
          {profe}
          <Campana punto={hayAvisos} />
        </div>

        {/* La fecha, el saludo y lo que toca hoy. */}
        <div style={{ padding: '22px 18px 0' }}>
          <span style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>{fecha}</span>
          <h1 style={{ margin: '6px 0 0', color: '#fff', fontSize: 30, fontWeight: 650, letterSpacing: '-.025em', lineHeight: 1.1, fontFamily: 'var(--font-space-grotesk), system-ui' }}>
            {saludo}{primero ? `, ${primero}` : ''}
          </h1>
          {hayDatos && (
            <p className="cf-num" style={{ margin: '8px 0 0', fontSize: 15, color: 'rgba(255,255,255,.72)', lineHeight: 1.4 }}>
              {cifras.porCobrar > 0
                ? <>Hoy te toca cobrar <strong style={{ color: ORO, fontWeight: 800 }}>{fmt(cifras.esperadoHoy)}</strong> a {cifras.porCobrar} {cifras.porCobrar === 1 ? 'cliente' : 'clientes'}.</>
                : <>Hoy no te toca cobrarle a nadie.</>}
            </p>
          )}
        </div>

        {/* Los dos de crear, destacados. Cada uno solo si tiene el permiso. */}
        {(puedePrestar || puedeCrearCliente) && (
          <div style={{ display: 'flex', gap: 10, padding: '18px 16px 0' }}>
            {puedePrestar && (
              <Link href="/prestamos/nuevo" className="cf-cab-toque cf-cab-boton" style={{
                flex: 1, height: 54, borderRadius: 16, background: ORO, color: ORO_TINTA, fontWeight: 800, fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none',
                boxShadow: '0 8px 22px rgba(231,164,0,.28)',
              }}><Ic d={ICONOS.prestamo} tam={22} />Nuevo préstamo</Link>
            )}
            {puedeCrearCliente && (
              <Link href="/clientes/nuevo" className="cf-cab-toque cf-cab-boton" style={{
                flex: 1, height: 54, borderRadius: 16, border: '1.5px solid rgba(255,255,255,.22)', color: '#fff', fontWeight: 700, fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', background: 'rgba(255,255,255,.03)',
              }}><Ic d={ICONOS.cliente} tam={22} />Nuevo cliente</Link>
            )}
          </div>
        )}

        {/* Los accesos, sobre negro. */}
        <div style={{ display: 'flex', gap: 2, overflowX: 'auto', scrollbarWidth: 'none', padding: '22px 10px 0' }}>
          {accesos.map((a) => <Acceso key={a.id} a={a} />)}
        </div>
      </div>

      {/* La hoja: el buscador único y los filtros del día. */}
      <div style={{
        /* ⚠ SE MONTA LO MISMO QUE MIDE LA CURVA. Montada 16 con una curva de 26,
           detrás de las esquinas asomaba el fondo claro de la página: un pedazo
           recto a cada lado (el dueño, con la captura). */
        background: 'var(--cf-surface)', borderRadius: `${RADIO_HOJA}px ${RADIO_HOJA}px 0 0`, marginTop: -RADIO_HOJA, position: 'relative',
        // En modo oscuro la hoja y la franja son casi del mismo negro: el filo la separa.
        boxShadow: '0 -1px 0 var(--cf-border)',
        padding: '18px 20px 4px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <Buscador />
        <span ref={marca} aria-hidden style={{ display: 'block', height: 0 }} />
        <Filtros pildoras={pildoras} />
      </div>

      <Compacta visible={abajo} accesos={accesos} pildoras={pildoras} />
    </div>
  )
}

/* ══ LA CABECERA DE LAS LISTAS: Clientes, Préstamos, Cobrar hoy (17 nov 2026) ══
 *
 * La versión «hoja sobre negro» (A) que el dueño eligió para las listas: franja
 * negra corta con el perfil, un chip con el nombre de la pantalla y su cifra, el
 * profe y la campana; y la hoja con LAS PIEZAS DE LA PROPIA PANTALLA —su
 * buscador, que filtra la lista, y sus filtros con conteo—, más la fila de
 * accesos para saltar de una sección a otra, con la de crear en dorado.
 *
 * ⚠ LAS PIEZAS SE RECIBEN, NO SE REHACEN (`buscador`, `filtros`). Cada lista
 * tiene meses de arreglos en su buscador y en sus filtros (conteos del servidor,
 * la hoja de «más filtros», el conmutador de vista). Rehacerlos aquí sería el
 * «rediseño que pierde funciones» de siempre.
 */
export function CabeceraSeccion({
  activo, titulo, cifra = null, alerta = null, crear = null,
  iniciales = '·', hayAvisos = false, profe = null, esOwner = false,
  buscador = null, filtros = null,
}) {
  const marca = useRef(null)
  const [abajo, setAbajo] = useState(false)
  useEffect(() => {
    const el = marca.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setAbajo(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const accesos = [
    // `crear.onClick` para lo que se crea en una hoja de la misma pantalla (Nueva ruta).
    ...(crear ? [{ id: crear.icono, nombre: crear.nombre, href: crear.href, onClick: crear.onClick, destacado: true }] : []),
    ...accesosDeInicio({ esOwner }).map((a) => ({ ...a, activo: a.id === activo })),
  ]

  return (
    <div className="lg:hidden" style={{ margin: '-20px -20px 14px' }}>
      <style>{ESTILO}</style>
      <div style={{
        background: `radial-gradient(120% 90% at 100% 0%, rgba(231,164,0,.14), transparent 60%), ${NEGRO}`,
        paddingBottom: RADIO_HOJA + 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 'max(14px, env(safe-area-inset-top)) 16px 0' }}>
          <Avatar iniciales={iniciales} />
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: '0 14px', borderRadius: 999, minWidth: 0,
            background: NEGRO_2, color: '#fff', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', border: '1px solid rgba(255,255,255,.06)',
          }}>
            {titulo}
            {cifra != null && <><span aria-hidden style={{ width: 4, height: 4, borderRadius: 999, background: ORO }} /><span className="cf-num" style={{ fontWeight: 800 }}>{cifra}</span></>}
            {alerta && <span className="cf-num" style={{ color: '#FF8A80', fontWeight: 700, fontSize: 13 }}>{alerta}</span>}
          </span>
          <span style={{ flex: 1 }} />
          {profe}
          <Campana punto={hayAvisos} />
        </div>
      </div>

      <div style={{
        background: 'var(--cf-card)', borderRadius: `${RADIO_HOJA}px ${RADIO_HOJA}px 0 0`, marginTop: -RADIO_HOJA, position: 'relative',
        boxShadow: '0 -1px 0 var(--cf-border)', borderBottom: '1px solid var(--cf-border)',
        // 20 a los lados: lo mismo que el <main>, porque las tiras de filtros de
        // las listas salen de su caja justo eso para llegar al borde.
        padding: '18px 20px 10px', display: 'flex', flexDirection: 'column', gap: 12,
        // La tira de filtros pinta su botón anclado con este fondo (BarraFiltros).
        '--cf-fondo-tira': 'var(--cf-card)',
      }}>
        {buscador}
        <span ref={marca} aria-hidden style={{ display: 'block', height: 0 }} />
        <div style={{ display: 'flex', gap: 2, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -20px', padding: '0 14px', borderBottom: '1px solid var(--cf-border)' }}>
          {accesos.map((a) => {
            const Pieza = a.onClick ? 'button' : Link
            return (
            <Pieza key={a.id} {...(a.onClick ? { type: 'button', onClick: a.onClick } : { href: a.href })} className="cf-cab-acceso" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 70, flex: 'none',
              textDecoration: 'none', paddingBottom: 10, position: 'relative',
              background: 'none', border: 0, padding: '0 0 10px', font: 'inherit', cursor: 'pointer',
            }}>
              <span className="cf-cab-circulo" style={{
                width: 52, height: 52, borderRadius: 999, display: 'grid', placeItems: 'center',
                background: a.destacado ? ORO : a.activo ? NEGRO : 'var(--cf-fill)',
                color: a.destacado ? ORO_TINTA : a.activo ? '#fff' : 'var(--cf-ink)',
                boxShadow: a.destacado ? '0 6px 16px rgba(231,164,0,.3)' : 'none',
              }}><Ic d={ICONOS[a.id]} tam={24} /></span>
              <span style={{ fontSize: 12, lineHeight: 1.2, textAlign: 'center', fontWeight: a.activo || a.destacado ? 700 : 500, color: 'var(--cf-ink)' }}>{a.nombre}</span>
              {a.activo && <span style={{ position: 'absolute', bottom: 0, left: 12, right: 12, height: 3, borderRadius: 3, background: 'var(--cf-ink)' }} />}
            </Pieza>
            )
          })}
        </div>
        {filtros}
      </div>

      <Compacta visible={abajo} accesos={accesos.filter((a) => !a.destacado)} arriba={buscador} abajo={filtros} />
    </div>
  )
}
