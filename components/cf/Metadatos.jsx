'use client'

// components/cf/Metadatos.jsx — la línea de datos de la tarjeta, con aire.
//
// ── QUÉ PROBLEMA RESUELVE ──────────────────────────────────────────────────
//
// El dueño: «toda esa información sale, pero está muy apretada, y creo que le
// podríamos dar un poco de aire y definirlas un poco mejor». Y aparte: «hay que
// poder distinguir, ponerle un ícono, creado por Carlos… el modo de interés
// también con su ícono».
//
// Lo que había era UNA línea de 12px gris con todo pegado por puntos medios:
//
//     CC 9588665688 · 3134973979 · RUTA. #. 5 · creó JHOAN
//     Diario 22% Clásico · RUTA. #. 5 · creó JHOAN
//
// Cuatro datos distintos, mismo color, mismo peso, mismo tamaño, sin nada que
// diga dónde acaba uno y empieza el otro. Los propios comentarios del código lo
// admitían —«la línea ya lleva tres cosas»— y la tarjeta acabó dejándola partir
// en dos renglones, que es tratar el síntoma.
//
// ── LA DECISIÓN: PIEZAS, NO UNA CADENA ─────────────────────────────────────
//
// Cada dato es una PIEZA con su icono. El icono hace tres cosas que el punto
// medio no hacía: separa sin gastar ancho, dice QUÉ es el dato sin leerlo, y
// deja que el ojo salte directo al que busca. En una lista de 1.074 préstamos
// eso es la diferencia entre recorrer y buscar.
//
// Los iconos son SVG inline estilo heroicons, 13px, trazo 1.8, `--cf-ink-4`.
// **Nunca emojis** — es regla del proyecto, reportada dos veces.
//
// El icono va en `--cf-ink-4` y el texto en `--cf-ink-3`: el icono es la pista,
// no el dato. Si pesaran igual, ocho iconos por tarjeta serían ruido.

import { iconoModo, etiquetaModo } from '@/lib/dinero/modos'

/* Los trazos de lo que NO es un modo de interés. Mismo criterio que
   `ICONO_MODO`: `viewBox="0 0 24 24"`, trazo 1.8, sin relleno. */
const TRAZO = {
  // Documento de identidad: una tarjeta con una línea de datos.
  cedula: 'M3 6.5h18v11H3zM7 10.5h3v3H7zM13 10.5h5M13 14h3',
  // Teléfono.
  telefono: 'M6.5 3.5h11v17h-11zM10.5 17.5h3',
  // Ruta: el mismo mapa plegado de la barra lateral, en pequeño.
  ruta: 'M9 5L3.5 7v12L9 17l6 2 5.5-2V5L15 7z M9 5v12 M15 7v12',
  // Persona: quién lo creó.
  autor: 'M12 12a3.6 3.6 0 100-7.2 3.6 3.6 0 000 7.2zM5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6',
  // Calendario, para fechas sueltas.
  fecha: 'M4 6.5h16v14H4zM4 10.5h16M8 3.5v4M16 3.5v4',
}

function Icono({ trazo, size = 13 }) {
  return (
    <svg
      aria-hidden
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="var(--cf-ink-4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ flex: 'none' }}
    >
      <path d={trazo} />
    </svg>
  )
}

/**
 * Una pieza: icono + texto, que no se parten entre sí.
 *
 * `whiteSpace: nowrap` en el conjunto es lo que impide que un dato quede con el
 * icono en un renglón y el texto en el siguiente — se ve mal y se lee peor. Si
 * no cabe, salta ENTERA a la línea de abajo, que es lo que hace el `flexWrap`
 * del contenedor.
 */
export function Dato({ trazo, children, titulo, fuerte = false }) {
  if (children == null || children === '') return null
  return (
    <span
      title={titulo}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        // `minWidth: 0` + `shrink` y NO `flex:'none'`: con `none` cada dato
        // exigía su ancho entero, ninguno cabía al lado de otro y los cuatro se
        // apilaban en cuatro renglones. La tarjeta se estiraba, la pastilla de
        // estado quedaba flotando en un hueco blanco y pasaban de caber tres
        // clientes en pantalla a dos. Se vio en la captura, no en el código.
        //
        // Encogiendo, caben dos por renglón y el que no cabe recorta su texto.
        minWidth: 0, flexShrink: 1,
      }}
    >
      <Icono trazo={trazo} />
      <span className="cf-num" style={{
        fontSize: 12,
        fontWeight: fuerte ? 600 : 400,
        color: fuerte ? 'var(--cf-ink-2)' : 'var(--cf-ink-3)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{children}</span>
    </span>
  )
}

/**
 * La fila de piezas.
 *
 * `gap: 12` de columna y `6` de fila: el hueco entre datos tiene que ser mayor
 * que el hueco de dentro de un dato (5px entre icono y texto), o los datos se
 * leen como uno solo. Es el mismo motivo por el que se quitaron los puntos.
 */
export function Metadatos({ children, style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', flexWrap: 'wrap',
      columnGap: 10, rowGap: 5, minWidth: 0, ...style,
    }}>{children}</div>
  )
}

/**
 * El modo de interés con su icono propio y su color.
 *
 * Va aparte de `Dato` porque es el único que lleva color: el dueño pidió poder
 * distinguirlo «fácilmente», y en una línea de cuatro grises el quinto gris no
 * se distingue. Lleva el dorado de la marca, que es el color de «así se pactó».
 *
 * La etiqueta sale de `ETIQUETA_MODO` y el trazo de `ICONO_MODO`, los dos en
 * `lib/dinero/modos.js`: el nombre del modo ya tuvo SEIS versiones distintas
 * repartidas por la app y no va a volver a pasar.
 */
export function ModoInteres({ modo, frecuencia, tasa }) {
  if (!modo && !frecuencia && !tasa) return null
  const texto = [frecuencia, tasa, etiquetaModo(modo)].filter(Boolean).join(' ')
  return (
    <span title={texto} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      // Se ENCOGE. En la tarjeta hay ancho de sobra, pero en una celda de tabla
      // la pastilla se desbordaba encima de la columna de al lado —se veía
      // «Semanal 20% Clásico» pisando el $1.000.000 de PRESTADO—. Encogiendo,
      // recorta su texto y se queda dentro; el título lo dice entero al pasar
      // por encima.
      minWidth: 0, flexShrink: 1, maxWidth: '100%',
      height: 20, padding: '0 8px 0 6px', borderRadius: 999,
      background: 'var(--cf-gold-tint-2)',
      border: '1px solid var(--cf-gold-border)',
    }}>
      <svg aria-hidden width="13" height="13" viewBox="0 0 24 24" fill="none"
        stroke="var(--cf-gold-dark)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
        style={{ flex: 'none' }}>
        <path d={iconoModo(modo)} />
      </svg>
      <span className="cf-num" style={{
        fontSize: 11.5, fontWeight: 600, color: 'var(--cf-gold-text)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{texto}</span>
    </span>
  )
}

/**
 * QUIÉN LO CREÓ. «Creado por: JHOAN».
 *
 * Va en su propio componente y no como un `Dato` suelto porque el rótulo se
 * escribía en TRES sitios —la tarjeta, la tabla de clientes y la de préstamos—
 * y basta con que uno se quede atrás para que la misma app diga dos cosas. Es
 * el mismo motivo por el que las etiquetas de los modos viven en un solo
 * archivo: ese nombre llegó a tener seis versiones.
 *
 * El dueño lo pidió así, con dos puntos: «debería decir "creado por:"». «creó
 * JHOAN» se lee como si JHOAN fuera el verbo de otra frase.
 */
export function CreadoPor({ nombre }) {
  if (!nombre) return null
  return (
    <Dato trazo={TRAZO.autor} titulo={`Creado por ${nombre}`}>
      {`Creado por: ${nombre}`}
    </Dato>
  )
}

/**
 * «NUEVO» — creado en las últimas 24 horas.
 *
 * La misma pastilla que la tarjeta, para la tabla de escritorio. Aquí no cabe
 * un punto de 7px al lado del nombre y esperar que alguien lo vea: en una tabla
 * de quince filas, lo que distingue una fila es el color y la palabra.
 */
export function EtiquetaNuevo({ nuevo }) {
  if (!nuevo) return null
  return (
    <span aria-label="Creado en las últimas 24 horas" title="Creado en las últimas 24 horas" style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, flex: 'none',
      height: 18, padding: '0 7px 0 5px', borderRadius: 999,
      background: 'color-mix(in srgb, var(--cf-green) 14%, transparent)',
      border: '1px solid color-mix(in srgb, var(--cf-green) 32%, transparent)',
    }}>
      <span aria-hidden style={{
        width: 5, height: 5, borderRadius: 999, flex: 'none',
        background: 'var(--cf-green-dark)',
      }} />
      <span style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: '.04em',
        color: 'var(--cf-green-dark)', textTransform: 'uppercase',
      }}>Nuevo</span>
    </span>
  )
}

export { TRAZO }
