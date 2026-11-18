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
import { useEffect, useState } from 'react'
import { isStandalone } from '@/components/layout/InstallButton'
import { pedirInstalar } from '@/components/layout/PuertaInstalacion'
import { BotonMinutoProfe } from '@/components/tutoriales/PiezasProfe'

/* Los iconos son de trazo, 20px, en gris. No compiten con las cifras.
   NO SE DIBUJAN AQUÍ: son los del sistema, pedidos por el destino de cada fila.
   Esta pantalla tenía su propio juego —Caja era un cajón aquí, una tarjeta en la
   barra lateral y una caja 3D en el menú del +— y el dueño lo dijo: «el cliente
   busca por el icono». Este mapa solo traduce el nombre corto a su ruta. */
const RUTA_DE = {
  plata: '/capital', caja: '/caja', negocio: '/dashboard/analiticas', simulador: '/prestamos/simulador',
  reportes: '/reportes', calendario: '/calendario', gastos: '/gastos', cobradores: '/cobradores', perdidos: '/clavos',
  socios: '/socios', quien: '/actividad', config: '/configuracion', soporte: '/soporte',
  tutoriales: '/tutoriales', cuaderno: '/migrador', excel: '/carga-masiva',
}
const I = Object.fromEntries(Object.entries(RUTA_DE).map(([k, ruta]) => [k, ICONO_DE_RUTA[ruta]]))
// Instalar no es una ruta: es la guía, que se abre encima de donde estés.
I.instalar = <><rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M12 7.5v6M9.5 11L12 13.5 14.5 11M10.5 18.5h3" /></>

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

/* ══ ESTILO «MI CUENTA» (18 nov 2026) ════════════════════════════════════════
 * El dueño, con el índice nuevo de Configuración: «me encantó ese estilo visual»,
 * y pidió llevarlo a Más. Lo mismo que allí: grupos con un título gris sobre el
 * fondo, y filas de borde a borde con el nombre grande y, debajo, una línea gris
 * que dice qué hay dentro (o la cifra, cuando la hay: sigue siendo un panel).
 * Los iconos se quedan —«el cliente busca por el icono»—, más grandes.
 *
 * Lo que dice cada fila cuando no tiene cifra. Una fila sin línea es un nombre
 * suelto; con ella se sabe a qué se entra sin entrar. */
const QUE_HAY = {
  plata: 'Tu plata para prestar',
  caja: 'Lo que entró y salió hoy',
  negocio: 'Ganancia y cómo rinde la cartera',
  simulador: 'Cuánto quedaría de cuota',
  reportes: 'Todos los informes, para ver o imprimir',
  calendario: 'Qué día le toca a quién',
  gastos: 'Lo que se gasta en la calle',
  cobradores: 'Tu equipo y lo que cobra cada uno',
  perdidos: 'Los préstamos que se quedaron sin pagar',
  quien: 'Quién hizo qué, en orden',
  config: 'Tu negocio, cómo prestas y los avisos',
  soporte: 'Escríbenos o mira tus casos',
  tutoriales: 'Los videos del profe, por tema',
  cuaderno: 'Le tomas foto y se pasa solo',
  excel: 'Si ya lo llevas en el computador',
}

/* `video`: el minuto del profe a la derecha (Adenda 6, C). `dorado`: los dos de
   pasar la cartera, que son de un solo uso y no del día a día. `alto` ya no se
   usa —todas miden lo mismo— y se acepta para no romper a quien lo pase. */
function Fila({ icono, nombre, cifra, tono, alto, primera, onIr, video, dorado = false }) {
  const linea = cifra || QUE_HAY[icono] || null
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%', flex: 'none', background: 'var(--cf-card)', borderTop: primera ? 0 : '1px solid var(--cf-border)' }}>
    <button type="button" onClick={onIr} style={{
      display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0,
      minHeight: 72, padding: '14px 20px', cursor: 'pointer', textAlign: 'left',
      background: 'none', border: 0, font: 'inherit',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 42, minWidth: 42, height: 42, borderRadius: 12, flex: 'none',
        background: dorado ? 'var(--cf-gold-tint)' : 'var(--cf-fill)',
        color: dorado ? 'var(--cf-gold-dark)' : 'var(--cf-ink-2)',
      }}>
        <Icono nombre={icono} tam={22} />
      </span>

      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 19, fontWeight: 500, letterSpacing: '-.01em', color: 'var(--cf-ink)', lineHeight: 1.2 }}>{nombre}</span>
        {/* La cifra es lo que convierte el índice en panel; sin cifra, qué hay. */}
        {linea && (
          <span className={cifra ? 'cf-num' : undefined} style={{
            fontSize: 14, lineHeight: 1.35,
            color: cifra && tono ? TONOS[tono] : 'var(--cf-ink-3)',
            fontWeight: cifra && tono ? 600 : 400,
          }}>{linea}</span>
        )}
      </span>

      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--cf-ink)"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none' }}>
        <path d="M9 5.5l6.5 6.5L9 18.5" />
      </svg>
    </button>
    {video && <BotonMinutoProfe id={video} style={{ marginRight: 14 }} />}
    </div>
  )
}

/* Lo del cobrador que es de todos los días; el resto va en «Herramientas». */
const DIA_COBRADOR = ['caja', 'gastos', 'reportes', 'calendario']

/* Un grupo: su título gris sobre el fondo y sus filas a todo el ancho. */
function Grupo({ titulo, children }) {
  return (
    <>
      <div style={{ padding: '18px 20px 10px', fontSize: 16, color: 'var(--cf-ink-3)', background: 'var(--cf-surface)' }}>{titulo}</div>
      <div style={{ background: 'var(--cf-card)', borderTop: '1px solid var(--cf-border)', borderBottom: '1px solid var(--cf-border)' }}>
        {children}
      </div>
    </>
  )
}

/* Pinta una lista de filas dentro de su grupo. */
function Filas({ lista, ir }) {
  return lista.map((h, i) => <Fila key={h.nombre} {...h} primera={i === 0} onIr={ir(h.destino)} />)
}

/* ── INSTALAR LA APP, A LA VISTA ──
   «La gente lo pregunta muchísimo por WhatsApp: cómo descarga la aplicación»
   (Carlos, 19 oct 2026). La guía existía (PuertaInstalacion) pero solo se
   llegaba por Configuración. Va aquí, con su video, y solo a quien todavía no
   la tiene instalada: enseñarle a instalar a quien ya la instaló confunde. */
function FilaInstalar() {
  const [instalada, setInstalada] = useState(true)
  useEffect(() => { setInstalada(isStandalone()) }, [])
  if (instalada) return null
  return (
    <Fila icono="instalar" nombre="Instalar la app" cifra="En tu teléfono, como cualquier app" alto={54}
      onIr={() => pedirInstalar('mas')} video="inicio-instalar" />
  )
}

/* Los dos importadores son de UN SOLO USO: van en su propio grupo, al final y en
   dorado, para que no compitan con «Capital» en el día a día. */

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
      { icono: 'calendario', nombre: 'Calendario', cifra: 'Qué día le toca a quién', destino: '/calendario' },
      { icono: 'perdidos',  nombre: 'Clavos',  cifra: 'Los de tu ruta', destino: '/clavos' },
    ].filter(Boolean)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--cf-surface)', margin: sinMargen ? '-14px -20px 0' : '0' }}>
        <Grupo titulo="Tu día">
          <Filas lista={suyas.filter((h) => DIA_COBRADOR.includes(h.icono))} ir={ir} />
        </Grupo>
        <Grupo titulo="Herramientas">
          <Filas lista={suyas.filter((h) => !DIA_COBRADOR.includes(h.icono))} ir={ir} />
        </Grupo>

        {puedeCrearClientes && (
          <Grupo titulo="Pasar tu cartera">
            <Fila icono="cuaderno" nombre="Pasar mi cuaderno" dorado primera onIr={ir('/migrador')} />
          </Grupo>
        )}

        <Grupo titulo="Tu cuenta">
          <Fila icono="config"     nombre="Configuración" alto={54} primera onIr={ir('/configuracion')} />
          <Fila icono="soporte"    nombre="Soporte"       alto={54} onIr={ir('/soporte')} />
          <Fila icono="tutoriales" nombre="Tutoriales"    alto={54} onIr={ir('/tutoriales')} />
          <FilaInstalar />
        </Grupo>
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
    // «Un calendario donde la gente pudiera ver qué día le toca a qué persona»
    // (6 nov 2026). Aquí y no en «Cobrar hoy»: no todo el mundo usa «Cobrar hoy».
    { icono: 'calendario', nombre: 'Calendario',          cifra: 'Qué día le toca a quién', destino: '/calendario' },
    { icono: 'gastos',     nombre: 'Gastos',              cifra: gastosMes, tono: 'ambar', destino: '/gastos' },
    { icono: 'cobradores', nombre: 'Cobradores',          cifra: cobradoresSinRegistrar, tono: 'mal', destino: '/cobradores' },
    { icono: 'perdidos',   nombre: 'Clavos',              cifra: perdidos, destino: '/clavos' },
    // `socios.resumen` NUNCA EXISTIÓ: `adaptarMas` solo produce `{ cantidad }`,
    // así que la fila salía sin cifra incluso cuando aparecía. Ahora dice
    // cuántos hay, y cuando no hay ninguno lo dice también — que es
    // precisamente cuando la fila sirve para algo.
    { icono: 'socios', nombre: 'Socios', cifra: textoSocios(socios?.cantidad), destino: '/socios' },
    hayEquipo && { icono: 'quien',  nombre: 'Historial',      cifra: null, destino: '/actividad' },
  ].filter(Boolean)

  /* LOS GRUPOS (18 nov 2026), por la pregunta que responde cada fila. El orden
     de dentro sigue siendo el de uso: Capital y Caja, las dos de plata, juntas
     y arriba. */
  const grupo = (iconos) => herramientas.filter((h) => iconos.includes(h.icono))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--cf-surface)', margin: sinMargen ? '-14px -20px 0' : '0' }}>
      <Grupo titulo="Tu plata"><Filas lista={grupo(['plata', 'caja', 'gastos'])} ir={ir} /></Grupo>
      <Grupo titulo="Tu negocio"><Filas lista={grupo(['negocio', 'reportes', 'calendario', 'perdidos', 'simulador'])} ir={ir} /></Grupo>
      <Grupo titulo="Tu equipo"><Filas lista={grupo(['cobradores', 'socios', 'quien'])} ir={ir} /></Grupo>

      <Grupo titulo="Pasar tu cartera">
        <Fila icono="cuaderno" nombre="Pasar mi cuaderno" dorado primera onIr={ir('/migrador')} />
        <Fila icono="excel"    nombre="Importar Excel"    dorado onIr={ir('/carga-masiva')} />
      </Grupo>

      <Grupo titulo="Tu cuenta">
        {/* El video de Configuración va aquí, en la puerta, y no dentro de
            Configuración (27 oct 2026): se mira antes de entrar a buscar. */}
        <Fila icono="config"     nombre="Configuración" alto={54} primera onIr={ir('/configuracion')} video="inicio-configuracion" />
        <Fila icono="soporte"    nombre="Soporte"       alto={54} onIr={ir('/soporte')} />
        <Fila icono="tutoriales" nombre="Tutoriales"    alto={54} onIr={ir('/tutoriales')} />
        <FilaInstalar />
      </Grupo>

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
