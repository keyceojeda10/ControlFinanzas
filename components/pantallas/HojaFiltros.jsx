'use client'

// components/pantallas/HojaFiltros.jsx — «Más filtros», en hoja inferior.
//
// EL PROBLEMA QUE RESUELVE: en préstamos había cuatro filas de filtros apiladas
// —estado, frecuencia, modo, ruta— más un desplegable y un «filtros avanzados».
// Con las dos franjas de aviso y la cabecera, eso son más de mil píxeles antes
// del primer préstamo, en un teléfono de 844. Se scrollea una pantalla entera
// para ver un solo préstamo.
//
// La regla del rediseño es «una pantalla, una respuesta». La respuesta de una
// lista son los préstamos, no los controles para encontrarlos. Arriba queda lo
// que se usa todos los días (buscar y el estado); lo demás vive aquí y solo se
// abre cuando hace falta.
//
// El botón de arriba lleva EL NÚMERO de filtros puestos, porque si no, un
// filtro escondido es un filtro olvidado: la lista sale corta y nadie sabe por
// qué.

import HojaInferior from '@/components/cf/HojaInferior'

/** Cuenta los grupos con algo elegido. Es lo que se pinta en el botón. */
export function contarFiltros(grupos = []) {
  return grupos.reduce((n, g) => {
    // Los interruptores no tienen `valor`: cada uno encendido es UN filtro
    // puesto. Sin esto, «Ocultar los ya cobrados» recortaba la lista y el chip
    // seguía diciendo «Filtros» a secas — que es cómo se busca durante un rato
    // por qué faltan clientes.
    if (g.tipo === 'interruptores') return n + (g.opciones?.filter((o) => o.activo).length ?? 0)
    // «Ordenar por» NO cuenta: siempre hay uno elegido, así que sumaría un
    // filtro permanente que no filtra nada.
    if (g.tipo === 'orden' || g.tipo === 'vistas') return n
    return n + (g.valor !== '' && g.valor != null ? 1 : 0)
  }, 0)
}

/** El botón que abre la hoja. Va en la fila del buscador. */
export function BotonFiltros({ n = 0, onClick }) {
  const puestos = n > 0
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={puestos ? `Más filtros, ${n} puestos` : 'Más filtros'}
      className="cf-boton-filtros"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, flex: 'none',
        // ⚠ ANCHO MÍNIMO FIJO. El rótulo cambia —«Filtros» sin nada puesto, el
        // número con algo— y esos dos textos NO miden igual, así que la fila
        // entera se recolocaba al poner o quitar un filtro: el buscador es
        // `flex-1` y se comía la diferencia, moviendo de paso el conmutador de
        // vista que va en medio. Con el mínimo, el botón no encoge al pasar a
        // número y nada se desplaza.
        //
        // En móvil el mínimo es 54 —cuadrado— porque la palabra «Filtros» se
        // esconde y queda solo el embudo: los 42px que sobran son los que le
        // faltaban al buscador para no cortar «Nombre o cédula».
        minWidth: 'var(--cf-min-filtros, 96px)',
        height: 'var(--cf-h-field)', padding: '0 14px', cursor: 'pointer',
        borderRadius: 999,
        background: puestos ? 'var(--cf-gold-tint)' : 'var(--cf-card)',
        border: `1px solid ${puestos ? 'var(--cf-gold-border)' : 'var(--cf-border)'}`,
        color: puestos ? 'var(--cf-gold-dark)' : 'var(--cf-ink-2)',
        fontSize: 13.5, fontWeight: 700,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 5h18l-7 8v5.5l-4 2V13z" />
      </svg>
      {/* El número SIEMPRE se ve —es el que dice que hay filtros puestos—; la
          palabra «Filtros» solo en pantalla ancha. En móvil el embudo se
          entiende solo y los 42px que libera son los que necesita el buscador. */}
      {puestos ? n : <span className="hidden lg:inline">Filtros</span>}
    </button>
  )
}

/**
 * ── EL CONMUTADOR DE VISTA, A LA VISTA ─────────────────────────────────────
 *
 * Las tres vistas (fichas / cuadrícula / tabla) YA existían, pero el único modo
 * de cambiarlas era Filtros → «Cómo se ven»: dos toques y un panel de distancia.
 * El dueño pidió «que se vea», y tenía razón — un control que hay que ir a
 * buscar es un control que no existe.
 *
 * Se queda TAMBIÉN dentro de la hoja de filtros. Son la misma preferencia y la
 * hoja la lee del mismo sitio, así que no hay dos verdades: quien ya aprendió
 * el camino viejo lo conserva.
 *
 * ⚠ LA TABLA SOLO CON ANCHO. Ocho columnas en 393px no son una tabla, son un
 * acordeón horizontal; por eso `opciones` se filtra fuera y no se pinta a secas.
 *
 * Iconos, no texto: son tres y con rótulo («Completas · Compactas · Tabla») la
 * fila del buscador se queda sin sitio en móvil. Cada uno lleva su `title` y su
 * `aria-label`, que es lo que lo hace legible sin verlo.
 */
export function ConmutadorVista({ valor, onCambiar, opciones }) {
  if (!opciones?.length) return null
  return (
    <div
      role="group"
      aria-label="Cómo se ven"
      style={{
        display: 'inline-flex', alignItems: 'center', flex: 'none',
        height: 'var(--cf-h-field)', padding: 4, gap: 2,
        // Radio 14, no 999. La píldora redonda por fuera con pastillas redondas
        // por dentro daba dos curvas peleadas y el botón activo se leía como un
        // borrón; 14 es el radio de la caja del buscador que va al lado, así que
        // las dos piezas de la fila tienen la misma esquina. Lo de dentro va a
        // 10: metido, no concéntrico.
        borderRadius: 14,
        background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      }}
    >
      {opciones.map((o) => {
        const activa = valor === o.valor
        return (
          <button
            key={o.valor || 'lista'}
            type="button"
            onClick={() => onCambiar?.(o.valor)}
            title={o.nombre}
            aria-label={o.nombre}
            aria-pressed={activa}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              // 36 de ancho: el dedo necesita 36-44 y con 34 en una fila de tres
              // el de en medio se falla. El alto lo da el padre menos el relleno.
              width: 36, height: '100%', cursor: 'pointer',
              borderRadius: 10, border: 0,
              // La pastilla activa va con el dorado SÓLIDO de la marca, como la
              // pastilla de estado de la fila de abajo. El tinte claro sobre
              // tarjeta clara casi no se distinguía del apagado.
              background: activa ? 'var(--cf-gold)' : 'transparent',
              color: activa ? 'var(--cf-ink)' : 'var(--cf-ink-3)',
              transition: 'background .12s, color .12s',
            }}
          >
            {ICONO_VISTA[o.icono] ?? ICONO_VISTA.lista}
          </button>
        )
      })}
    </div>
  )
}

// Fichas completas, cuadrícula y tabla. Trazo 2 y 16px, como el embudo de
// «Filtros» que va justo al lado.
const ICONO_VISTA = {
  lista: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
    </svg>
  ),
  cuadricula: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>
  ),
  tabla: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </svg>
  ),
}

/**
 * grupos: [{ id, titulo, valor, onCambiar, opciones: [{ valor, nombre }] }]
 * La opción con valor '' es «sin filtrar» y va siempre primera.
 */
/**
 * ── LOS INTERRUPTORES DE T03-02 ──
 * «Solo con acuerdo de pago», «Ocultar los ya cobrados». Son filtros de sí/no,
 * y como pastilla no funcionan: una pastilla apagada no dice si el filtro está
 * puesto o si es la opción que no elegiste. Fila con su interruptor a la
 * derecha, que es lo que dibuja la lámina.
 */
function FilaInterruptor({ nombre, activo, onCambiar }) {
  return (
    <button
      type="button"
      onClick={() => onCambiar?.(!activo)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        minHeight: 46, padding: '10px 0', cursor: 'pointer',
        background: 'none', border: 0, textAlign: 'left',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--cf-ink)' }}>
        {nombre}
      </span>
      <span aria-hidden style={{
        flex: 'none', width: 44, height: 26, borderRadius: 999,
        background: activo ? 'var(--cf-ink)' : 'var(--cf-fill)',
        border: `1px solid ${activo ? 'var(--cf-ink)' : 'var(--cf-border-strong)'}`,
        display: 'flex', alignItems: 'center',
        padding: 2, transition: 'background .15s',
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: 999, background: 'var(--cf-card)',
          marginLeft: activo ? 18 : 0, transition: 'margin-left .15s',
          boxShadow: '0 1px 2px rgba(20,20,28,.2)',
        }} />
      </span>
    </button>
  )
}

export default function HojaFiltros({
  abierta, onCerrar, grupos = [], onLimpiar,
  // T03-02 la titula «Filtrar y ordenar», porque además de filtrar ordena. El
  // valor por defecto es el de antes, para las cinco pantallas que ya la usan.
  titulo = 'Más filtros',
  // «Ver 11 cobros · $460.867». El pie de T03-02 lo pide literal: el botón dice
  // CUÁNTOS y CUÁNTA PLATA quedan seleccionados. Sin eso hay que cerrar la hoja
  // para saber si el filtro dejó algo, y se vuelve a abrir a corregir.
  accion,
  pie,
}) {
  const n = contarFiltros(grupos)

  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo={titulo}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {grupos.map((g) => (
          <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {g.titulo && (
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.04em',
                textTransform: 'uppercase', color: 'var(--cf-ink-3)' }}>
                {g.titulo}
              </span>
            )}
            {g.tipo === 'interruptores' ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {g.opciones.map((o) => (
                  <FilaInterruptor
                    key={String(o.valor)}
                    nombre={o.nombre}
                    activo={!!o.activo}
                    onCambiar={(v) => g.onCambiar?.(o.valor, v)}
                  />
                ))}
              </div>
            ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--cf-gap-chips)' }}>
              {g.opciones.map((o) => {
                const activo = String(g.valor ?? '') === String(o.valor)
                // «Sin filtrar» elegido NO se pinta como filtro puesto. Con el
                // mismo negro, seis grupos sin tocar se leen como seis filtros
                // aplicados y uno se va a buscar por qué la lista sale corta.
                const neutro = String(o.valor) === ''
                return (
                  <button
                    key={String(o.valor)}
                    type="button"
                    onClick={() => g.onCambiar?.(o.valor)}
                    style={{
                      // Un solo color para «elegido» en toda la hoja. Antes cada
                      // fila tenía el suyo —azul la frecuencia, morado el modo—
                      // y tres colores compitiendo enseñan tres jerarquías que
                      // no existen. Aquí lo único que brilla es la plata.
                      height: 38, padding: '0 15px', cursor: 'pointer',
                      borderRadius: 999, fontSize: 13.5,
                      fontWeight: activo ? 700 : 600,
                      background: activo && !neutro ? 'var(--cf-ink)'
                        : activo ? 'var(--cf-fill)' : 'var(--cf-card)',
                      color: activo && !neutro ? 'var(--cf-card)' : 'var(--cf-ink-2)',
                      border: `1px solid ${activo && !neutro ? 'var(--cf-ink)'
                        : activo ? 'var(--cf-border-strong)' : 'var(--cf-border)'}`,
                    }}
                  >
                    {o.nombre}
                    {/* «Al día · 11». El pie de T03-02 empieza por ahí: «hoy hay
                        cuatro chips SIN CONTEO». Un rango de atraso sin su
                        número obliga a pulsarlo para saber si hay alguien
                        dentro, y con cuatro rangos son cuatro tanteos. */}
                    {o.conteo != null && (
                      <span className="cf-num" style={{
                        marginLeft: 6, fontWeight: 600,
                        opacity: activo && !neutro ? 0.7 : 0.55,
                      }}>· {o.conteo}</span>
                    )}
                  </button>
                )
              })}
            </div>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
          {n > 0 && (
            <button
              type="button"
              onClick={onLimpiar}
              style={{
                flex: 1, height: 'var(--cf-h-btn-2)', cursor: 'pointer',
                borderRadius: 'var(--cf-r-control)', background: 'var(--cf-card)',
                border: '1px solid var(--cf-border-strong)',
                fontSize: 14.5, fontWeight: 700, color: 'var(--cf-ink-2)',
              }}
            >
              Quitar los {n}
            </button>
          )}
          <button
            type="button"
            onClick={onCerrar}
            style={{
              flex: 1, height: 'var(--cf-h-btn-2)', cursor: 'pointer',
              borderRadius: 'var(--cf-r-control)', background: 'var(--cf-gold)',
              border: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--cf-gold-ink)',
            }}
          >
            {/* «Ver 11 cobros · $460.867» en T03-02. Sin la cifra hay que cerrar
                la hoja para saber si el filtro dejó algo, y se vuelve a abrir a
                corregir. `accion` es opcional: las cinco pantallas que ya usan
                esta hoja siguen diciendo «Ver resultados». */}
            {accion || 'Ver resultados'}
          </button>
        </div>

        {pie}
      </div>
    </HojaInferior>
  )
}
