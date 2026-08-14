// components/armazon/iconos.jsx — UN solo juego de iconos, por destino.
//
// ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
// Lo reportó el dueño mirando los accesos directos del buscador:
//
//   «los íconos de gasto, de configuración, de caja, de mi plata no son los
//    mismos íconos que se utilizan en otras partes del sistema. Eso desconfigura
//    un poco. No está habiendo una consistencia de íconos para los distintos
//    apartados.»
//
// Y tenía razón por partida triple: la barra lateral tenía su juego, la pastilla
// de navegación otro, y los accesos directos del buscador un tercero dibujado a
// mano con `d=` sueltos. Tres dibujos para la misma caja.
//
// Aquí viven una vez y se piden POR RUTA, que es lo que no cambia: si mañana
// «Mi plata» se llama de otra forma, su icono sigue siendo el suyo.
//
// El trazo es el del armazón —1.9, puntas redondas, viewBox 24— y no se cambia
// por capricho: es lo que hace que un icono se vea de esta app y no de otra.

export const TRAZO = {
  fill: 'none',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

/* Los trazos son los de `BarraLateral`, que es el juego más completo y el que
   el dueño ve todo el día en escritorio. La pastilla usa los mismos para sus
   seis destinos: se copiaron de aquí, no al revés. */
export const ICONO_DE_RUTA = {
  '/dashboard':     <><path d="M4 11.5L12 4l8 7.5" /><path d="M6 10.5V20h12v-9.5" /></>,
  '/cobros-hoy':    <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3 2" /></>,
  '/rutas':         <><path d="M9 4.5L3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8 9 4.5z" /><path d="M9 4.5v12.7M15 6.8v12.7" /></>,
  '/prestamos':     <><rect x="3" y="6" width="18" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /></>,
  '/clientes':      <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" /><path d="M16 5.5a3 3 0 010 5.6M17.5 19.5c0-2.2-.8-3.6-2-4.5" /></>,
  '/caja':          <><rect x="3" y="7" width="18" height="12" rx="2.5" /><path d="M3 11h18M7.5 15h3" /></>,
  '/lineas-credito':<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18M7 15h4" /></>,
  '/capital':       <><path d="M4 20V9l8-5 8 5v11z" /><path d="M9.5 20v-5.5h5V20" /></>,
  '/gastos':        <><path d="M6 3.5h12v17l-3-1.6-3 1.6-3-1.6-3 1.6z" /><path d="M9 8.5h6M9 12.5h4" /></>,
  '/reportes':      <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  '/cobradores':    <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" /><path d="M16 5.5a3 3 0 010 5.6M17.5 19.5c0-2.2-.8-3.6-2-4.5" /></>,
  '/configuracion': <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4L6 18M18 18l-1.6-1.6M7.6 7.6L6 6" /></>,
  '/actividad':     <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5.2l3.2 1.9" /></>,
  '/socios':        <><circle cx="8" cy="9" r="2.8" /><circle cx="16" cy="9" r="2.8" /><path d="M2.5 19c0-2.6 2.4-4.2 5.5-4.2M21.5 19c0-2.6-2.4-4.2-5.5-4.2" /></>,
}

/**
 * El icono de un destino. Si la ruta no tiene el suyo devuelve `null`, para que
 * quien lo pinte decida qué hacer en vez de recibir un cuadrado vacío.
 */
export function IconoDeRuta({ href, size = 16, color = 'currentColor', style }) {
  const trazos = ICONO_DE_RUTA[href]
  if (!trazos) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color}
      style={{ flex: 'none', ...style }} {...TRAZO}>
      {trazos}
    </svg>
  )
}
