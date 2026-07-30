'use client'

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
// El menú del +. LA ÚNICA PANTALLA DEL SISTEMA CON EL DORADO COMO SUPERFICIE.
// Se justifica porque es el momento en que la app pregunta, y porque es la
// pantalla más frecuente después del panel.
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
//  3. LUCAS ES UNA TARJETA BLANCA COMO LAS DEMÁS. Nunca un círculo oscuro sobre
//     el dorado: se lee como un parche, dos oscuros peleando en el mismo fondo.

const ORO      = '#E7A400'
const TINTA    = '#3A2900'
// MEDIDOS, no elegidos a ojo. El handoff pide .62 y .55, que sobre el dorado
// dan 2,98:1 y 2,61:1 — por debajo del minimo de 4,5:1 para texto pequeño. El
// primer alfa que pasa es .82 (4,55:1). Son los dos textos mas chicos de la
// pantalla mas saturada del sistema, asi que es justo donde se nota.
const TINTA_2  = 'rgba(58,41,0,.82)'   // 4,55:1 · fecha, 12px
const ROTULO   = 'rgba(58,41,0,.86)'   // 4,94:1 · rotulos de grupo, 10px
const LINEA    = '1px solid rgba(20,20,28,.07)'
const TARJETA  = 'rgba(255,255,255,.92)'

const I = {
  pago:     <><path d="M12 3v18M17 7.5c0-2-2.2-3-5-3s-5 .9-5 2.8c0 4.4 10 2.2 10 6.6 0 2-2.2 3.1-5 3.1s-5-1.1-5-3" /></>,
  qr:       <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h.01" /></>,
  prestar:  <><rect x="2.5" y="6.5" width="13" height="9" rx="2" /><circle cx="9" cy="11" r="2" /><path d="M18 11h4M19.5 8.5L22 11l-2.5 2.5" /></>,
  gasto:    <><path d="M5.5 3h13v18l-2.2-1.6-2.1 1.6-2.2-1.6L9.8 21l-2.1-1.6L5.5 21z" /><path d="M9 8h6M9 12h6" /></>,
  cliente:  <><circle cx="10" cy="8" r="3.4" /><path d="M3.5 20a6.5 6.5 0 0113 0" /><path d="M18 8v6M15 11h6" /></>,
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
        background: destacada ? '#FDF3D6' : '#F3F3EF',
        color: destacada ? '#B07D00' : '#4A4E57',
      }}>
        <Icono nombre={icono} />
      </span>

      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 15, fontWeight: 600, color: '#14141C',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{nombre}</span>
        {cifra && (
          <span className="cf-num" style={{
            fontSize: 12, color: '#6B6F79', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{cifra}</span>
        )}
      </span>

      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B9BCC4"
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
      background: TARJETA, border: 0, borderRadius: 14,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 30, minWidth: 30, height: 30, borderRadius: 9, flex: 'none',
        background: '#F3F3EF', color: '#4A4E57',
      }}>
        <Icono nombre={icono} tam={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{
          fontSize: 13.5, fontWeight: 600, color: '#14141C', lineHeight: 1.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{nombre}</span>
        {cifra && (
          <span className="cf-num" style={{
            fontSize: 11, color: '#6B6F79', lineHeight: 1.3, marginTop: 1,
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
  onIr, onCerrar,
}) {
  const ir = (d) => () => onIr?.(d)

  return (
    <div style={{
      position: 'absolute', inset: 0, background: ORO, color: TINTA,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 9,
        padding: '22px 16px 100px',
      }}>
        <span style={{
          fontFamily: 'var(--font-space-grotesk), system-ui', fontSize: 24, fontWeight: 600,
          letterSpacing: '-.02em', color: TINTA, padding: '0 4px', flex: 'none',
        }}>¿Qué vas a hacer?</span>
        <span className="cf-num" style={{ fontSize: 12, color: TINTA_2, padding: '0 4px', marginTop: -5, flex: 'none' }}>
          {/* Sin fecha ni hora NO se pinta el separador: quedaba un «·»
              suelto bajo el título, que parece un fallo de render. */}
          {[fecha, hora].filter(Boolean).join(' · ')}
        </span>

        {/* Agrupadas por lo que le pasa a la plata, no por tipo de objeto.
            El dueño piensa "entra" o "sale", no "entidad Pago" o "entidad Gasto". */}
        <span style={{ height: 5, flex: 'none' }} />
        <Rotulo>Entra plata</Rotulo>
        <div style={{ background: TARJETA, borderRadius: 18, overflow: 'hidden', flex: 'none' }}>
          <Accion icono="pago" nombre="Registrar un pago" cifra={cobrosPendientes} destacada primera onClick={ir('/cobrar')} />
          <Accion icono="qr" nombre="Escanear un QR" onClick={ir('/qr')} />
        </div>

        <span style={{ height: 5, flex: 'none' }} />
        <Rotulo>Sale plata</Rotulo>
        <div style={{ background: TARJETA, borderRadius: 18, overflow: 'hidden', flex: 'none' }}>
          <Accion icono="prestar" nombre="Prestarle a alguien" cifra={plataLista} destacada primera onClick={ir('/prestamos/nuevo')} />
          <Accion icono="gasto" nombre="Anotar un gasto" onClick={ir('/gastos/nuevo')} />
        </div>

        <span style={{ height: 5, flex: 'none' }} />
        <Rotulo>Crear</Rotulo>
        <div style={{ background: TARJETA, borderRadius: 18, overflow: 'hidden', flex: 'none' }}>
          <Accion icono="cliente" nombre="Un cliente nuevo" alto={54} primera onClick={ir('/clientes/nuevo')} />
        </div>

        <span style={{ height: 5, flex: 'none' }} />
        <Rotulo>Ir a</Rotulo>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, flex: 'none' }}>
          <Destino icono="cobrar"  nombre="Cobrar hoy" cifra={cobrosCorto} onClick={ir('/cobros-hoy')} />
          <Destino icono="caja"    nombre="La caja"    cifra={cajaEstado} onClick={ir('/caja')} />
          <Destino icono="miplata" nombre="Mi plata"   cifra={plataCorto} onClick={ir('/capital')} />
          <Destino icono="plan"    nombre="Mi plan"    cifra={diasPlan} onClick={ir('/plan')} />
        </div>

        {/* Lucas va al pie y separado: no es una acción más, es otra forma de
            usar la app. Tarjeta blanca como las demás — un círculo oscuro aquí
            se leería como un parche sobre el dorado. */}
        <span style={{ height: 9, flex: 'none' }} />
        <button type="button" onClick={ir('/lucas')} style={{
          display: 'flex', alignItems: 'center', gap: 13, width: '100%', flex: 'none',
          minHeight: 66, padding: '0 15px', cursor: 'pointer', textAlign: 'left',
          background: TARJETA, border: 0, borderRadius: 18,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 37, minWidth: 37, height: 37, borderRadius: 12, flex: 'none',
            background: '#FDF3D6', color: '#B07D00',
          }}>
            <Icono nombre="lucas" />
          </span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#14141C' }}>Preguntarle a Lucas</span>
            <span style={{
              fontSize: 12, color: '#6B6F79', fontStyle: 'italic',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>«{ejemploLucas}»</span>
          </span>
        </button>
      </div>

      {/* El FAB se convierte en el botón de cerrar, EN EL MISMO SITIO. El pulgar
          ya está ahí: mover el objetivo sería castigar al que abrió el menú. */}
      <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{
        position: 'absolute', right: 22, bottom: 22,
        width: 62, height: 62, aspectRatio: '1', borderRadius: 999,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: '#15161A', border: 0, cursor: 'pointer',
        boxShadow: '0 6px 20px rgba(58,41,0,.32)',
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
