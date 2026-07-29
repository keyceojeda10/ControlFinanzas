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
import { useState } from 'react'

const t = { fill: 'none', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }

const ICONOS = {
  dashboard:  <><path d="M4 11.5L12 4l8 7.5" /><path d="M6 10.5V20h12v-9.5" /></>,
  cobros:     <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3 2" /></>,
  rutas:      <><path d="M9 4.5L3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8 9 4.5z" /><path d="M9 4.5v12.7M15 6.8v12.7" /></>,
  prestamos:  <><rect x="3" y="6" width="18" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /></>,
  lineas:     <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18M7 15h4" /></>,
  clientes:   <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" /><path d="M16 5.5a3 3 0 010 5.6M17.5 19.5c0-2.2-.8-3.6-2-4.5" /></>,
  caja:       <><rect x="3" y="7" width="18" height="12" rx="2.5" /><path d="M3 11h18M7.5 15h3" /></>,
  buscar:     <><circle cx="11" cy="11" r="7" /><path d="M16.5 16.5L21 21" /></>,
  campana:    <><path d="M18 8.5a6 6 0 00-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5z" /><path d="M13.7 20.5a2 2 0 01-3.4 0" /></>,
  chevron:    <><path d="M6 9l6 6 6-6" /></>,
  sol:        <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  luna:       <><path d="M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z" /></>,
}

// Orden fijo del documento.
const PRINCIPAL = [
  { href: '/dashboard',            nombre: 'Dashboard',         icono: 'dashboard' },
  { href: '/cobros-hoy',           nombre: 'Cobrar hoy',        icono: 'cobros' },
  { href: '/rutas',                nombre: 'Rutas',             icono: 'rutas' },
  { href: '/prestamos',            nombre: 'Préstamos',         icono: 'prestamos' },
  { href: '/lineas-credito',       nombre: 'Líneas de crédito', icono: 'lineas' },
  { href: '/clientes',             nombre: 'Clientes',          icono: 'clientes' },
  { href: '/caja',                 nombre: 'Caja',              icono: 'caja' },
]

const HERRAMIENTAS = [
  { href: '/capital',              nombre: 'Mi plata' },
  { href: '/gastos',               nombre: 'Gastos' },
  { href: '/reportes',             nombre: 'Reportes' },
  { href: '/dashboard/analiticas', nombre: '¿Cómo va el negocio?' },
  { href: '/cobradores',           nombre: 'Cobradores' },
  { href: '/socios',               nombre: 'Socios' },
  { href: '/migrador',             nombre: 'Pasar mi cuaderno' },
  { href: '/carga-masiva',         nombre: 'Importar Excel' },
  { href: '/clavos',               nombre: 'Perdidos' },
  { href: '/actividad',            nombre: 'Quién hizo qué' },
]

const CUENTA = [
  { href: '/configuracion',        nombre: 'Configuración' },
  { href: '/soporte',              nombre: 'Soporte' },
  { href: '/tutoriales',           nombre: 'Tutoriales' },
]

function Item({ href, nombre, icono, activo }) {
  return (
    <Link href={href} aria-current={activo ? 'page' : undefined}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 10,
        height: 37, padding: '0 12px', borderRadius: 13,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <button type="button" onClick={() => setAbierto(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 30, padding: '0 12px', background: 'none', border: 0, cursor: 'pointer',
          fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase',
          color: 'var(--cf-ink-3)',
        }}>
        {titulo}
        <svg width="14" height="14" viewBox="0 0 24 24" {...t} stroke="var(--cf-ink-4)"
          style={{ transform: abierto ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }}>
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
  nombre = '', rol = '', iniciales = '', conectado = true,
  hayAvisos = false, tema = 'light', onCambiarTema, onBuscar, onAvisos, onCuenta,
}) {
  const pathname = usePathname() || '/'

  return (
    <aside style={{
      width: 'var(--cf-w-sidebar)', minWidth: 'var(--cf-w-sidebar)',
      height: '100dvh', position: 'sticky', top: 0,
      background: 'var(--cf-card)',
      borderRight: '1px solid var(--cf-border)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── Zona superior ── */}
      <div style={{ padding: '16px 15px 13px', borderBottom: '1px solid var(--cf-divider)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flex: 'none', width: 32, minWidth: 32, height: 32, aspectRatio: '1',
            borderRadius: 10, background: 'var(--cf-gold)', border: '2px solid var(--cf-gold-light)',
            fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 16, fontWeight: 700, color: 'var(--cf-gold-ink)',
          }}>$</span>
          <span style={{ flex: 1, minWidth: 0, lineHeight: 1.1 }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)' }}>Control</span>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--cf-ink-3)' }}>Finanzas</span>
          </span>
          <button type="button" onClick={onAvisos} aria-label="Avisos"
            style={{
              position: 'relative', flex: 'none', width: 32, height: 32, borderRadius: 10,
              background: 'var(--cf-fill)', border: 0, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" {...t} stroke="var(--cf-ink-2)">{ICONOS.campana}</svg>
            {hayAvisos && <span style={{ position: 'absolute', top: 5, right: 6, width: 8, height: 8, borderRadius: 999, background: 'var(--cf-red)', border: '2px solid var(--cf-card)' }} />}
          </button>
        </div>

        <button type="button" onClick={onBuscar}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            height: 38, padding: '0 10px', borderRadius: 13,
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
        <div style={{ height: 1, background: 'var(--cf-divider)', margin: '8px 0' }} />
        <Grupo titulo="Más herramientas" items={HERRAMIENTAS} pathname={pathname} />
        <Grupo titulo="Cuenta" items={CUENTA} pathname={pathname} />
      </nav>

      {/* ── Zona de cuenta ── */}
      <div style={{ padding: 12, borderTop: '1px solid var(--cf-divider)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <SelectorTema tema={tema} onCambiar={onCambiarTema} />
        <button type="button" onClick={onCuenta}
          style={{
            display: 'flex', alignItems: 'center', gap: 9, width: '100%',
            padding: 10, borderRadius: 14,
            background: 'var(--cf-card)', border: '1px solid var(--cf-border)', cursor: 'pointer',
          }}>
          <span style={{ position: 'relative', flex: 'none' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 999, background: 'var(--cf-blue)',
              fontSize: 12, fontWeight: 700, color: '#FFF',
            }}>{iniciales}</span>
            <span style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: 999, background: conectado ? 'var(--cf-green)' : 'var(--cf-ink-4)', border: '2px solid var(--cf-card)' }} />
          </span>
          <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--cf-ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--cf-ink-3)' }}>{rol}</span>
          </span>
          <svg width="15" height="15" viewBox="0 0 24 24" {...t} stroke="var(--cf-ink-4)" style={{ flex: 'none', transform: 'rotate(-90deg)' }}>{ICONOS.chevron}</svg>
        </button>
      </div>
    </aside>
  )
}
