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
/* ══ UN DIBUJO POR COSA, Y NINGUNO REPETIDO (20 sep 2026) ═════════════════════
 *
 * El dueño: «el sistema tiene varios iconos para clientes, varios para caja,
 * varios para capital… hay que encontrar los mejores y unificar todo, porque el
 * cliente lo tiene en su memoria: busca por el icono».
 *
 * Había CUATRO juegos: este, otro dentro de la pastilla, otro en «Más» y otro en
 * el menú del +. Caja tenía tres dibujos (tarjeta, cajón, caja 3D) y Capital dos
 * (casa, tarjeta). Y este mismo juego se pisaba solo:
 *   · Caja y Líneas de crédito eran la MISMA tarjeta con una raya;
 *   · Cobrar hoy e Historial eran el MISMO reloj;
 *   · Clientes y Cobradores, las MISMAS dos personas;
 *   · Configuración parecía un sol (círculo con ocho rayos), no una tuerca.
 *
 * Ahora cada cosa tiene UN dibujo y ningún dibujo sirve para dos cosas:
 *   Caja = billetera (la plata que se tiene encima; es la del cobro) ·
 *   Capital = el banco con columnas (el fondo del negocio) ·
 *   Líneas de crédito = la tarjeta · Historial = el reloj que da marcha atrás ·
 *   Cobradores = la credencial · Reportes = la hoja · Cómo va = las barras.
 *
 * Los seis de la navegación principal NO cambian de idea —casa, reloj, mapa,
 * billete, personas—: es lo que la gente ya tiene en la memoria. */
export const ICONO_DE_RUTA = {
  '/dashboard':     <><path d="M4 11.5L12 4l8 7.5" /><path d="M6 10.5V20h12v-9.5" /></>,
  '/cobros-hoy':    <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5v5l3 2" /></>,
  '/rutas':         <><path d="M9 4.5L3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8 9 4.5z" /><path d="M9 4.5v12.7M15 6.8v12.7" /></>,
  '/prestamos':     <><rect x="3" y="6" width="18" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6.5 12h.01M17.5 12h.01" /></>,
  '/clientes':      <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19.5c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" /><path d="M16 5.5a3 3 0 010 5.6M17.5 19.5c0-2.2-.8-3.6-2-4.5" /></>,
  '/mas':           <><rect x="4" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" /></>,
  // La billetera: la plata del día, la que se lleva encima.
  '/caja':          <><path d="M17.5 8V6.2A2.2 2.2 0 0015.3 4H5.7A2.2 2.2 0 003.5 6.2v11.6A2.2 2.2 0 005.7 20h12.6a2.2 2.2 0 002.2-2.2v-7.6A2.2 2.2 0 0018.3 8H6" /><path d="M16.4 14h.01" /></>,
  // El banco: el fondo del negocio.
  '/capital':       <><path d="M3.5 9.5L12 4l8.5 5.5" /><path d="M5.5 9.5V17M10 9.5V17M14 9.5V17M18.5 9.5V17M3.5 20h17M4.5 17h15" /></>,
  '/lineas-credito':<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18M7 15h4" /></>,
  '/gastos':        <><path d="M6 3.5h12v17l-3-1.6-3 1.6-3-1.6-3 1.6z" /><path d="M9 8.5h6M9 12.5h4" /></>,
  '/reportes':      <><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  '/dashboard/analiticas': <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  // La credencial: alguien que trabaja para ti.
  '/cobradores':    <><rect x="4.5" y="4" width="15" height="17" rx="2.5" /><path d="M10 4V2.8h4V4" /><circle cx="12" cy="10.5" r="2.5" /><path d="M8 17.3a4.1 4.1 0 018 0" /></>,
  '/socios':        <><circle cx="8" cy="9" r="2.8" /><circle cx="16" cy="9" r="2.8" /><path d="M2.5 19c0-2.6 2.4-4.2 5.5-4.2M21.5 19c0-2.6-2.4-4.2-5.5-4.2" /></>,
  // El reloj que da marcha atrás: lo que YA pasó. (Cobrar hoy es el reloj a secas.)
  '/actividad':     <><path d="M3.5 12a8.5 8.5 0 102.6-6.1L3.5 8.5" /><path d="M3.5 4v4.5H8M12 7.5v5l3 1.8" /></>,
  '/clavos':        <><circle cx="12" cy="12" r="8.5" /><path d="M8.8 8.8l6.4 6.4M15.2 8.8l-6.4 6.4" /></>,
  '/prestamos/simulador': <><rect x="4.5" y="2.5" width="15" height="19" rx="2.5" /><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 15.5v3" /></>,
  '/configuracion': <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5v.2a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1h-.2a2 2 0 110-4h.1a1.7 1.7 0 001.6-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h.1a1.7 1.7 0 001-1.5v-.2a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v.1a1.7 1.7 0 001.5 1h.2a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>,
  '/configuracion/plan': <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  '/soporte':       <><path d="M21 11.5a8.4 8.4 0 01-12.6 7.3L3 20.5l1.8-5.2A8.4 8.4 0 1121 11.5z" /></>,
  '/tutoriales':    <><circle cx="12" cy="12" r="8.5" /><path d="M10 8.5l6 3.5-6 3.5z" /></>,
  '/migrador':      <><path d="M4 4.5A1.5 1.5 0 015.5 3H18a1 1 0 011 1v16a1 1 0 01-1 1H5.5A1.5 1.5 0 014 19.5z" /><path d="M4 17.5h15M8 3v18" /></>,
  '/carga-masiva':      <><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5M9.5 12l5 5M14.5 12l-5 5" /></>,
  // Lucas es un DESTELLO, no un globo de chat: el globo es Soporte (una persona).
  '/asistente':     <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M18.5 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></>,
}

/** Lo que se HACE (no un sitio al que se va). Las usa el menú del +. */
export const ICONO_DE_ACCION = {
  pago:     <><path d="M12 3v18M17 7.5c0-2-2.2-3-5-3s-5 .9-5 2.8c0 4.4 10 2.2 10 6.6 0 2-2.2 3.1-5 3.1s-5-1.1-5-3" /></>,
  qr:       <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h.01" /></>,
  // El billete de Préstamos, saliendo: prestar es ESE billete yéndose.
  prestar:  <><rect x="2.5" y="6.5" width="13" height="10" rx="2.2" /><circle cx="9" cy="11.5" r="2.1" /><path d="M18 11.5h4M19.5 9L22 11.5 19.5 14" /></>,
  // Una persona de Clientes, con su «+».
  clienteNuevo: <><circle cx="10" cy="8" r="3.4" /><path d="M3.5 20a6.5 6.5 0 0113 0" /><path d="M18.5 8v6M15.5 11h6" /></>,
}

/**
 * El icono de un destino. Si la ruta no tiene el suyo devuelve `null`, para que
 * quien lo pinte decida qué hacer en vez de recibir un cuadrado vacío.
 */
/** Cualquier icono del sistema: por `ruta` ('/caja') o por `accion` ('pago'). */
export function Icono({ ruta, accion, size = 20, color = 'currentColor', grosor, style }) {
  const trazos = ruta ? ICONO_DE_RUTA[ruta] : ICONO_DE_ACCION[accion]
  if (!trazos) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" stroke={color} aria-hidden="true"
      style={{ flex: 'none', ...style }} {...TRAZO} {...(grosor ? { strokeWidth: grosor } : {})}>
      {trazos}
    </svg>
  )
}

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
