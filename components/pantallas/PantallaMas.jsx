'use client'

// components/pantallas/PantallaMas.jsx — turno 41·03, adenda 06 §5.
//
// El quinto destino de la pastilla. Es NAVEGACIÓN, así que lleva armazón
// completo: cabecera de 56px + pastilla con el quinto icono activo.
//
// LA DECISIÓN: cada fila lleva SU CIFRA. Un menú de nombres es un índice; con la
// cifra al lado es un panel. "Cobradores · 8 sin registrar nada" es un problema
// que se ve sin entrar.
//
// Ordenadas por FRECUENCIA DE USO, no alfabéticamente.
//
// ⚠️ EN ESCRITORIO NO EXISTE. La barra lateral ya lista todo con sus grupos.

import { ICONO_DE_RUTA } from '@/components/armazon/iconos'
import { Tarjeta } from '@/components/cf/primitivos'

/* Los iconos son de trazo, 20px, en gris. No compiten con las cifras.
   NO SE DIBUJAN AQUÍ: son los del sistema, pedidos por el destino de cada fila.
   Esta pantalla tenía su propio juego —Caja era un cajón aquí, una tarjeta en la
   barra lateral y una caja 3D en el menú del +— y el dueño lo dijo: «el cliente
   busca por el icono». Este mapa solo traduce el nombre corto a su ruta. */
const RUTA_DE = {
  plata: '/capital', caja: '/caja', negocio: '/dashboard/analiticas', simulador: '/prestamos/simulador',
  reportes: '/reportes', gastos: '/gastos', cobradores: '/cobradores', perdidos: '/clavos',
  socios: '/socios', quien: '/actividad', config: '/configuracion', soporte: '/soporte',
  tutoriales: '/tutoriales', cuaderno: '/migrador', excel: '/carga-masiva',
}
const I = Object.fromEntries(Object.entries(RUTA_DE).map(([k, ruta]) => [k, ICONO_DE_RUTA[ruta]]))

function Icono({ nombre, tam = 20 }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {I[nombre]}
    </svg>
  )
}

const TONOS = {
  bien:  'var(--cf-green-dark)',
  mal:   'var(--cf-red-dark)',
  ambar: 'var(--cf-gold-text-2)',
}

function Fila({ icono, nombre, cifra, tono, alto = 56, primera, onIr }) {
  return (
    <button type="button" onClick={onIr} style={{
      display: 'flex', alignItems: 'center', gap: 13, width: '100%', flex: 'none',
      minHeight: alto, padding: '0 16px', cursor: 'pointer', textAlign: 'left',
      background: 'none', border: 0,
      borderTop: primera ? 0 : '1px solid var(--cf-hairline)',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 34, minWidth: 34, height: 34, borderRadius: 10, flex: 'none',
        background: 'var(--cf-fill)', color: 'var(--cf-ink-2)',
      }}>
        <Icono nombre={icono} />
      </span>

      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{
          fontSize: 14.5, fontWeight: 600, color: 'var(--cf-ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{nombre}</span>
        {/* La cifra es lo que convierte el índice en panel. Sin ella la fila no
            aporta nada que el nombre no diga ya. */}
        {cifra && (
          <span className="cf-num" style={{
            fontSize: 12, lineHeight: 1.3, color: tono ? TONOS[tono] : 'var(--cf-ink-3)',
            fontWeight: tono ? 600 : 400,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{cifra}</span>
        )}
      </span>

      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink-4)"
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

function Rotulo({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase',
      color: 'var(--cf-ink-3)', padding: '0 2px', flex: 'none',
    }}>{children}</span>
  )
}

/* Los dos importadores son de UN SOLO USO. Fuera de la lista diaria, porque si
   compiten con "Mi plata" ganan atención que no merecen todos los días. */
function TarjetaCarga({ icono, titulo, nota, onIr }) {
  return (
    <button type="button" onClick={onIr} style={{
      flex: 1, minWidth: 0, cursor: 'pointer', textAlign: 'left',
      display: 'flex', flexDirection: 'column', gap: 8, padding: '15px 15px 16px',
      background: 'var(--cf-card)', border: '1px solid var(--cf-border)',
      borderRadius: 'var(--cf-r-card)',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 10, flex: 'none',
        background: 'var(--cf-gold-tint)', color: 'var(--cf-gold-dark)',
      }}>
        <Icono nombre={icono} />
      </span>
      <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--cf-ink)', lineHeight: 1.25 }}>
        {titulo}
      </span>
      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--cf-ink-3)', lineHeight: 1.35 }}>
        {nota}
      </span>
    </button>
  )
}

export default function PantallaMas({
  plataLista, rendimiento, gastosMes, cobradoresSinRegistrar,
  perdidos, socios, usuarios = 1, onIr,
  // Dentro del layout el margen lateral ya lo pone el <main>.
  sinMargen = false,
  // El menú del cobrador: ver el aviso largo más abajo.
  esCobrador = false, puedeReportarGastos = true, puedeCrearClientes = false,
}) {
  const ir = (destino) => () => onIr?.(destino)

  /** «Ninguno todavía» cuando no hay: es la única cifra que invita a entrar. */
  const textoSocios = (n) => {
    const c = Number(n ?? 0)
    if (c === 0) return 'Ninguno todavía'
    return c === 1 ? '1 socio' : `${c} socios`
  }

  // ── SOCIOS DEJA DE ESCONDERSE ──
  //
  // Iba detrás de `socios.cantidad > 0`, con el mismo criterio que Equipo:
  // catorce filas de las que cuatro no aplican es peor que diez que sí.
  //
  // Pero con Socios ese criterio se muerde la cola: PARA VER SOCIOS HABÍA QUE
  // TENER SOCIOS. El único camino a `/socios/nuevo` desde el móvil era el
  // buscador global o escribir la URL a mano, así que quien nunca hubiera
  // entrado desde un computador no sabía que la función existe. En escritorio
  // no pasaba: la barra lateral la pinta siempre.
  //
  // «Historial» no tiene ese problema y se queda como estaba: si hay un
  // solo usuario, la pantalla que abre está vacía por definición y no hay nada
  // que hacer para llenarla desde ahí.
  const hayEquipo = usuarios > 1

  /* ══ EL «MÁS» DEL COBRADOR ═══════════════════════════════════════════════
     Veía el mismo menú que el dueño: Capital con su saldo, «¿Cómo va el negocio?»,
     Cobradores, Socios, Historial… y al tocarlos, una pantalla de «no tienes
     permiso». Peor que el rebote era la cifra: el saldo del capital salía en la
     fila. Ahora ve lo que puede usar: su caja, el simulador, sus gastos, la hoja
     de cobros (Reportes) y los perdidos de su ruta. Cargar clientes, solo si el
     dueño le dio ese permiso. */
  if (esCobrador) {
    const suyas = [
      { icono: 'caja',      nombre: 'Caja',      cifra: null, destino: '/caja' },
      { icono: 'simulador', nombre: 'Simulador', cifra: 'Cuánto quedaría de cuota', destino: '/prestamos/simulador' },
      puedeReportarGastos && { icono: 'gastos', nombre: 'Gastos', cifra: null, destino: '/gastos' },
      { icono: 'reportes',  nombre: 'Reportes',  cifra: 'La hoja de cobros del día', destino: '/reportes' },
      { icono: 'perdidos',  nombre: 'Perdidos',  cifra: 'Los de tu ruta', destino: '/clavos' },
    ].filter(Boolean)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: sinMargen ? '0' : '8px var(--cf-pad-screen) 0' }}>
        <Rotulo>Más herramientas</Rotulo>
        <Tarjeta plana>
          {suyas.map((h, i) => (
            <Fila key={h.nombre} {...h} primera={i === 0} onIr={ir(h.destino)} />
          ))}
        </Tarjeta>

        {puedeCrearClientes && (
          <>
            <Rotulo>Cargar datos</Rotulo>
            <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
              <TarjetaCarga icono="cuaderno" titulo="Pasar mi cuaderno"
                nota="Le tomas foto y se pasa solo" onIr={ir('/migrador')} />
            </div>
          </>
        )}

        <Rotulo>Cuenta</Rotulo>
        <Tarjeta plana>
          <Fila icono="config"     nombre="Configuración" alto={54} primera onIr={ir('/configuracion')} />
          <Fila icono="soporte"    nombre="Soporte"       alto={54} onIr={ir('/soporte')} />
          <Fila icono="tutoriales" nombre="Tutoriales"    alto={54} onIr={ir('/tutoriales')} />
        </Tarjeta>
        <span aria-hidden style={{ height: 96, flex: 'none' }} />
      </div>
    )
  }

  /* ⚠ «CAPITAL» E «HISTORIAL», CON EL NOMBRE DE LA PANTALLA. Se llamaban
     «Mi plata» y «Quién hizo qué» —los nombres «del usuario» de la lámina— pero
     la pantalla de detrás decía «Capital» en su cabecera, la otra «Actividad»,
     y el buscador Ctrl+K la llamaba «Historial»: tres nombres para lo mismo.
     El dueño, 2 sep 2026: «en vez de entenderse fácilmente, se complica, se
     enreda mucho. Capital e historial. Ya está». Un mismo nombre en el menú,
     en la cabecera y en el buscador, o no es un nombre. */
  const herramientas = [
    { icono: 'plata',      nombre: 'Capital',             cifra: plataLista && `${plataLista} listos para prestar`, destino: '/capital' },
    /* ⚠ LA CAJA SOLO SE ALCANZABA DESDE EL BOTÓN +.
       Reportado por el dueño: «caja debería estar en el menú de los 4
       cuadritos porque es una opción muy importante y en móvil solo sale en el
       menú FAB».

       Va SEGUNDA, pegada a «Capital», porque son las dos preguntas de dinero:
       cuánto tengo para prestar y cuánto entró hoy. Separarlas obligaría a
       recorrer la lista para pasar de una a otra.

       Sin cifra, como «Reportes»: el API de esta pantalla no trae nada de la
       caja del día, y añadir una consulta a la pantalla que más se abre para
       llenar un renglón no compensa. Un dato inventado sería peor. */
    { icono: 'caja',       nombre: 'Caja',                cifra: null, destino: '/caja' },
    { icono: 'negocio',    nombre: '¿Cómo va el negocio?', cifra: rendimiento, tono: 'bien', destino: '/dashboard/analiticas' },
    // Salió de la cabecera de préstamos: se consulta antes de prestar, no todos
    // los días, y allí costaba 50px permanentes en la pantalla más apretada.
    { icono: 'simulador',  nombre: 'Simulador',           cifra: 'Cuánto quedaría de cuota', destino: '/prestamos/simulador' },
    { icono: 'reportes',   nombre: 'Reportes',            cifra: null, destino: '/reportes' },
    { icono: 'gastos',     nombre: 'Gastos',              cifra: gastosMes, tono: 'ambar', destino: '/gastos' },
    { icono: 'cobradores', nombre: 'Cobradores',          cifra: cobradoresSinRegistrar, tono: 'mal', destino: '/cobradores' },
    { icono: 'perdidos',   nombre: 'Perdidos',            cifra: perdidos, destino: '/clavos' },
    // `socios.resumen` NUNCA EXISTIÓ: `adaptarMas` solo produce `{ cantidad }`,
    // así que la fila salía sin cifra incluso cuando aparecía. Ahora dice
    // cuántos hay, y cuando no hay ninguno lo dice también — que es
    // precisamente cuando la fila sirve para algo.
    { icono: 'socios', nombre: 'Socios', cifra: textoSocios(socios?.cantidad), destino: '/socios' },
    hayEquipo && { icono: 'quien',  nombre: 'Historial',      cifra: null, destino: '/actividad' },
  ].filter(Boolean)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cf-gap-cards)', padding: sinMargen ? '0' : '8px var(--cf-pad-screen) 0' }}>
      <Rotulo>Más herramientas</Rotulo>
      <Tarjeta plana>
        {herramientas.map((h, i) => (
          <Fila key={h.nombre} {...h} primera={i === 0} onIr={ir(h.destino)} />
        ))}
      </Tarjeta>

      <Rotulo>Cargar datos</Rotulo>
      <div style={{ display: 'flex', gap: 10, flex: 'none' }}>
        <TarjetaCarga icono="cuaderno" titulo="Pasar mi cuaderno"
          nota="Le tomas foto y se pasa solo" onIr={ir('/migrador')} />
        <TarjetaCarga icono="excel" titulo="Importar Excel"
          nota="Si ya lo llevas en el computador" onIr={ir('/carga-masiva')} />
      </div>

      <Rotulo>Cuenta</Rotulo>
      <Tarjeta plana>
        <Fila icono="config"     nombre="Configuración" alto={54} primera onIr={ir('/configuracion')} />
        <Fila icono="soporte"    nombre="Soporte"       alto={54} onIr={ir('/soporte')} />
        <Fila icono="tutoriales" nombre="Tutoriales"    alto={54} onIr={ir('/tutoriales')} />
      </Tarjeta>

      {/* SITIO PARA LA PASTILLA. La regla 2 del armazón dice que ningún texto
          puede quedar detrás de la barra flotante: el contenido pasa por debajo
          mientras se hace scroll —así se ve que hay más—, pero al llegar al final
          nada puede estar tapado.

          Sin esto, «Soporte» y «Tutoriales» quedaban debajo de la pastilla en la
          lista más larga del sistema: existían, se podían pulsar en teoría, y no
          se veían nunca.

          Va aquí y no en el armazón porque es la única pantalla del rediseño que
          termina en una tarjeta pegada al borde; si aparecen más, el espaciador
          sube al `<main>`. */}
      <span aria-hidden style={{ height: 96, flex: 'none' }} />
    </div>
  )
}
