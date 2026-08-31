'use client'

import { Fragment } from 'react'

// components/pantallas/MenuCrear.jsx — turno 43·01, adenda 07 §4.
//
// ⚠️ ESTA ES LA IMPLEMENTACIÓN DE T43-01. NO HAY OTRA.
// El 30 jul 2026 se construyó un `MenuMas.jsx` contra la misma lámina sin
// comprobar que este archivo ya existía: mismos cuatro grupos, mismas cifras,
// mismos destinos en rejilla, mismo Lucas al pie. Se borró. Antes de construir
// una pantalla, buscar en `components/pantallas/` si ya está — los nombres no
// siempre coinciden con el número de lámina (aquí «Crear» y la lámina es «el
// menú del +»).
//
// El menú del +. Va sobre el BLOQUE OSCURO del sistema; el dorado a pantalla
// completa que tenía antes está revocado y explicado más abajo, junto a los
// colores.
//
// ⚠️ NO EXISTE EN ESCRITORIO. Ahí esa acción vive en el botón dorado de cada
// pantalla; un menú a pantalla completa en 1440 sería un salto en falso.
//
// TRES REGLAS:
//
//  1. LOS DESTINOS SE VEN DISTINTOS DE LAS ACCIONES. "Ir a" es rejilla de dos
//     columnas, filas más bajas y SIN FLECHA. Una acción hace algo; un destino
//     solo lleva. Si se ven iguales, el usuario los trata igual.
//  2. CADA OPCIÓN TRAE SU CIFRA. Con la cifra al lado el menú se vuelve panel y
//     el dueño decide sin entrar. Mismo criterio que la pantalla "Más".
//  3. LUCAS ES UNA TARJETA COMO LAS DEMÁS, no un objeto aparte: no es una
//     acción más, pero tampoco un parche pegado al pie.

/* ══ ⚠ EL DORADO A PANTALLA COMPLETA, REVOCADO ═══════════════════════════
 *
 * Aquí decía «LA ÚNICA PANTALLA DEL SISTEMA CON EL DORADO COMO SUPERFICIE», y
 * el dueño lo tumbó viéndolo en el teléfono: «el fondo del menú abierto me
 * parece bastante repelente ese color naranja».
 *
 * Y la regla ya estaba escrita en DESIGN.md, dos veces:
 *
 *   «El dorado #E7A400 se reserva a TRES COSAS: el monto principal de la
 *    pantalla, la acción primaria y el foco del campo activo. Nada más.»
 *   «Cuando una pantalla no tiene monto, no tiene nada dorado salvo su botón.»
 *
 * Este menú no tiene monto. La excepción se justificaba con «es el momento en
 * que la app pregunta», que es una razón de ánimo, no de sistema — y se pagaba
 * cara: la tabla de contraste de DESIGN.md existe casi entera por esta
 * pantalla, donde los dos textos más pequeños daban 2,61:1 y 2,98:1 y había que
 * ir subiendo alfas a mano hasta que pasaran.
 *
 * ── LO QUE VA EN SU LUGAR ──────────────────────────────────────────────────
 *
 * EL BLOQUE OSCURO, que es la superficie pesada que el sistema ya tiene: la
 * misma del panel de «Recaudado hoy» y la de la ficha del cliente. Sus valores
 * son literales y no tokens a propósito, igual que en `BloqueOscuro`: dentro
 * del bloque no manda el tema, manda que el fondo es negro.
 *
 * Tres cosas que se ganan y no son de gusto:
 *   · sobre una app clara, un plano casi negro se lee como UNA CAPA ENCIMA, que
 *     es lo que un menú a pantalla completa tiene que decir;
 *   · el dorado vuelve a ser acento —los iconos de lo que mueve plata y la X—
 *     en vez de ser el papel;
 *   · el contraste deja de depender de alfas medidos: todos los colores son
 *     opacos y el peor par queda en 5,02:1.
 */
const SUPERFICIE = '#15161A'
const TARJETA    = '#1E1F24'   // NO negro puro: el borde tiene que verse
/* La tarjeta y la hoja están a 1,10 de contraste entre sí —son dos oscuros—,
   así que sin el filete las tarjetas se funden con el fondo y las filas quedan
   flotando. Es la misma nota que lleva `BloqueOscuro`. */
const BORDE      = '1px solid rgba(255,255,255,.10)'
const LINEA      = '1px solid rgba(255,255,255,.09)'
const TEXTO      = '#F3F3F6'   // 14,85:1 sobre la tarjeta
const TEXTO_2    = '#A3A8B2'   //  6,89:1 · cifras al pie de cada fila
const ROTULO     = '#8A8E98'   //  5,02:1 · rótulos de grupo, 10px
const FLECHA     = '#6E727A'   //  3,41:1 · es un grafismo, mínimo 3:1
const CHIP_BG    = 'rgba(255,255,255,.07)'
const CHIP_FG    = '#A3A8B2'
const CHIP_ORO_BG = 'rgba(245,184,36,.14)'
const CHIP_ORO_FG = '#F5B824'

const I = {
  pago:     <><path d="M12 3v18M17 7.5c0-2-2.2-3-5-3s-5 .9-5 2.8c0 4.4 10 2.2 10 6.6 0 2-2.2 3.1-5 3.1s-5-1.1-5-3" /></>,
  qr:       <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h.01" /></>,
  prestar:  <><rect x="2.5" y="6.5" width="13" height="9" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M18 11h4M19.5 8.5L22 11l-2.5 2.5" /></>,
  gasto:    <><path d="M5.5 3h13v18l-2.2-1.6-2.1 1.6-2.2-1.6L9.8 21l-2.1-1.6L5.5 21z" /><path d="M9 8h6M9 12h6" /></>,
  cliente:  <><circle cx="10" cy="8" r="3.4" /><path d="M3.5 20a6.5 6.5 0 0113 0" /><path d="M18 8v6M15 11h6" /></>,
  /* El MISMO trazo que usa «Más» para «Pasar mi cuaderno»: la misma cosa en dos
     sitios tiene que verse igual, o parecen dos funciones distintas. */
  cartera:  <><path d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5" /><path d="M7.5 7.5L12 3l4.5 4.5M12 3v13.5" /></>,
  cobrar:   <><path d="M9 11l3 3 6-6" /><path d="M21 12a9 9 0 11-4.2-7.6" /></>,
  caja:     <><path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5L12 12l9-4.5M12 12v9" /></>,
  miplata:  <><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10.5h19M17 15h1.5" /></>,
  plan:     <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  lucas:    <><path d="M21 11.5a8.4 8.4 0 01-12.6 7.3L3 20.5l1.8-5.2A8.4 8.4 0 1121 11.5z" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" /></>,
}

function Icono({ nombre, tam = 20 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {I[nombre]}
    </svg>
  )
}

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.11em', textTransform: 'uppercase',
      color: ROTULO, padding: '0 4px', flex: 'none',
    }}>{children}</span>
  )
}

/* Una ACCIÓN: alta, ancho completo, con flecha. Hace algo. */
function Accion({ icono, nombre, cifra, destacada, alto = 56, primera, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 13, width: '100%', flex: 'none',
      minHeight: destacada ? 62 : alto, padding: '0 15px', cursor: 'pointer', textAlign: 'left',
      background: 'none', border: 0, borderTop: primera ? 0 : LINEA,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 37, minWidth: 37, height: 37, borderRadius: 12, flex: 'none',
        background: destacada ? CHIP_ORO_BG : CHIP_BG,
        color: destacada ? CHIP_ORO_FG : CHIP_FG,
      }}>
        <Icono nombre={icono} />
      </span>

      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 15, fontWeight: 600, color: TEXTO,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{nombre}</span>
        {cifra && (
          <span className="cf-num" style={{
            fontSize: 12, color: TEXTO_2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{cifra}</span>
        )}
      </span>

      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={FLECHA}
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

/* Un DESTINO: bajo, media columna, SIN FLECHA. Solo lleva. */
function Destino({ icono, nombre, cifra, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 calc(50% - 5px)', minWidth: 0,
      minHeight: 52, padding: '0 12px', cursor: 'pointer', textAlign: 'left',
      background: TARJETA, border: BORDE, borderRadius: 14,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 30, minWidth: 30, height: 30, borderRadius: 9, flex: 'none',
        background: CHIP_BG, color: CHIP_FG,
      }}>
        <Icono nombre={icono} tam={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{
          fontSize: 13.5, fontWeight: 600, color: TEXTO, lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{nombre}</span>
        {cifra && (
          <span className="cf-num" style={{
            fontSize: 11, color: TEXTO_2, lineHeight: 1.3, marginTop: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{cifra}</span>
        )}
      </span>
    </button>
  )
}

export default function MenuCrear({
  fecha, hora,
  cobrosPendientes, plataLista, cajaEstado, diasPlan,
  cobrosCorto, plataCorto,
  ejemploLucas = '¿cuánto recaudé esta semana?',
  onIr, onCerrar, onEscanear,
  // Qué se viene a hacer desde la pantalla en la que se está: 'crear' en
  // Clientes, 'sale' en Préstamos. El armazón es el único que sabe dónde
  // estamos, así que lo manda él.
  aqui = null,
}) {
  const ir = (d) => () => onIr?.(d)

  // Agrupadas por lo que le pasa a la plata, no por tipo de objeto: el dueño
  // piensa «entra» o «sale», no «entidad Pago» o «entidad Gasto».
  const grupos = [
    {
      id: 'entra', rotulo: 'Entra plata',
      filas: <>
        {/* `/cobrar` NO EXISTE, y era 404. Un pago se registra desde el
            prestamo o desde la lista de hoy, asi que se va a la lista: ahi
            esta a quien hay que cobrarle, que es lo que se venia a hacer. */}
        <Accion icono="pago" nombre="Registrar un pago" cifra={cobrosPendientes} destacada primera onClick={ir('/cobros-hoy')} />
        {/* El escaner NO ES UNA RUTA, es un modal. `/qr` daba 404. */}
        <Accion icono="qr" nombre="Escanear un QR" onClick={onEscanear} />
      </>,
    },
    {
      id: 'sale', rotulo: 'Sale plata',
      filas: <>
        <Accion icono="prestar" nombre="Prestarle a alguien" cifra={plataLista} destacada primera onClick={ir('/prestamos/nuevo')} />
        {/* `/gastos/nuevo` tampoco existe: el gasto se anota en una hoja
            dentro de /gastos. */}
        <Accion icono="gasto" nombre="Anotar un gasto" onClick={ir('/gastos?anotar=1')} />
      </>,
    },
    {
      id: 'crear', rotulo: 'Crear',
      filas: <>
        <Accion icono="cliente" nombre="Un cliente nuevo" alto={54} primera onClick={ir('/clientes/nuevo')} />
        {/* ── ⚠ PASAR LA CARTERA, AQUÍ Y NO SOLO EN «MÁS» ──────────────────
            Estaba únicamente en «Más herramientas», entre otras once entradas.
            Y es la acción que decide si el prestamista se queda: el 73 % se
            atasca en cinco clientes o menos, y quien no pasa su cuaderno no
            llega a usar nada de lo demás.

            Va en «Crear» y no en «Ir a» porque eso es lo que hace: crea
            clientes, solo que de treinta en treinta. Una sola entrada y no dos
            —foto y Excel— porque el migrador ya pregunta por cuál entras: dos
            aquí serían dos decisiones antes de empezar. */}
        <Accion icono="cartera" nombre="Pasar mi cartera"
          cifra="De una foto, del cuaderno o de un Excel"
          alto={54} onClick={ir('/migrador')} />
      </>,
    },
  ]

  // El grupo de la pantalla en la que se esta, primero. `aqui` lo manda el
  // armazon, que es el unico que sabe donde estamos.
  const GRUPOS = aqui
    ? [...grupos.filter((g) => g.id === aqui), ...grupos.filter((g) => g.id !== aqui)]
    : grupos

  return (
    <div style={{
      position: 'absolute', inset: 0, background: SUPERFICIE, color: TEXTO,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 9,
        padding: '22px 16px 100px',
      }}>
        <span style={{
          fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 24, fontWeight: 600,
          letterSpacing: '-.02em', color: TEXTO, padding: '0 4px', flex: 'none',
        }}>¿Qué vas a hacer?</span>
        <span className="cf-num" style={{ fontSize: 12, color: TEXTO_2, padding: '0 4px', marginTop: -5, flex: 'none' }}>
          {/* Sin fecha ni hora NO se pinta el separador: quedaba un «·»
              suelto bajo el título, que parece un fallo de render. */}
          {[fecha, hora].filter(Boolean).join(' · ')}
        </span>

        {/* ── LO QUE SE VIENE A HACER DESDE ESTA PANTALLA, ARRIBA ──
            El menu era siempre el mismo, en el mismo orden. Desde «Clientes» se
            pulsaba el + y lo primero era «Registrar un pago»: «Un cliente
            nuevo» quedaba en el TERCER grupo, cuarta fila. Desde una pantalla
            que se llama Clientes, eso no es encontrar el boton de crear
            cliente — el usuario dijo, con razon, que no lo veia.

            Ahora el grupo que corresponde a la pantalla sube al principio. El
            resto no se mueve ni se quita: sigue estando todo, y quien ya sabia
            donde buscarlo lo encuentra igual, solo que un poco mas abajo. */}
        {GRUPOS.map((g) => (
          <Fragment key={g.id}>
            <span style={{ height: 5, flex: 'none' }} />
            <Rotulo>{g.rotulo}</Rotulo>
            <div style={{ background: TARJETA, border: BORDE, borderRadius: 18, overflow: 'hidden', flex: 'none' }}>
              {g.filas}
            </div>
          </Fragment>
        ))}

        <span style={{ height: 5, flex: 'none' }} />
        <Rotulo>Ir a</Rotulo>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, flex: 'none' }}>
          <Destino icono="cobrar"  nombre="Cobrar hoy" cifra={cobrosCorto} onClick={ir('/cobros-hoy')} />
          <Destino icono="caja"    nombre="La caja"    cifra={cajaEstado} onClick={ir('/caja')} />
          <Destino icono="miplata" nombre="Mi plata"   cifra={plataCorto} onClick={ir('/capital')} />
          {/* Era `/plan` — 404. La pantalla vive bajo configuracion. */}
          <Destino icono="plan"    nombre="Mi plan"    cifra={diasPlan} onClick={ir('/configuracion/plan')} />
        </div>

        {/* Lucas va al pie y separado: no es una acción más, es otra forma de
            usar la app. Tarjeta blanca como las demás — un círculo oscuro aquí
            se leería como un parche sobre el dorado. */}
        <span style={{ height: 9, flex: 'none' }} />
        {/* `/lucas` era 404: la ruta se llama `/asistente`. */}
        <button type="button" onClick={ir('/asistente')} style={{
          display: 'flex', alignItems: 'center', gap: 13, width: '100%', flex: 'none',
          minHeight: 66, padding: '0 15px', cursor: 'pointer', textAlign: 'left',
          background: TARJETA, border: BORDE, borderRadius: 18,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 37, minWidth: 37, height: 37, borderRadius: 12, flex: 'none',
            background: CHIP_ORO_BG, color: CHIP_ORO_FG,
          }}>
            <Icono nombre="lucas" />
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: TEXTO }}>Preguntarle a Lucas</span>
            <span style={{
              fontSize: 12, color: TEXTO_2, fontStyle: 'italic',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>«{ejemploLucas}»</span>
          </span>
        </button>
      </div>

      {/* El FAB se convierte en el botón de cerrar, EN EL MISMO SITIO. El pulgar
          ya está ahí: mover el objetivo sería castigar al que abrió el menú. */}
      <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{
        // MISMAS COORDENADAS QUE LA PASTILLA, y por eso salen de los tokens y no
        // de un 22 escrito a mano: estaba a 22/22 y la pastilla a 16/18, asi que
        // el boton SE MOVIA SEIS PIXELES bajo el dedo al abrir el menu. El
        // comentario de aqui abajo decia «EN EL MISMO SITIO» y no lo estaba.
        position: 'absolute',
        right: 'var(--cf-nav-side)',
        bottom: 'calc(var(--cf-nav-inset) + env(safe-area-inset-bottom, 0px))',
        width: 62, height: 62, aspectRatio: '1', borderRadius: 999,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        /* ⚠ ERA `#15161A` CON LA X DORADA, y esa es exactamente la superficie
           que ahora tiene la hoja: el botón desaparecía. Sube un escalón y se
           le pone filete, que es como se separan dos oscuros en este sistema.
           La sombra deja de ser marrón (venía del fondo dorado). */
        background: '#26282F', border: '1px solid rgba(255,255,255,.16)',
        cursor: 'pointer',
        boxShadow: '0 6px 20px rgba(0,0,0,.45)',
        transform: 'translateZ(0)',   // GPU Mali: el radio rompe el rasterizado sin esto
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F5B824"
          strokeWidth="2.6" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
