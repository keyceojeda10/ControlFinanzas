/* CÓMO HA PAGADO ESTE CLIENTE, EN UNA MARCA.
 *
 * ══ LO QUE PIDIÓ EL PRESTAMISTA ═══════════════════════════════════════════
 *
 *   «Tenemos clientes que pagan súper bien y clientes que pagan mal. Es como
 *    para que el cobrador sepa qué clientela está trabajando bien y cuál mal.»
 *
 * Pidió que el administrador marcara a cada uno. Se hace al revés —se calcula
 * del historial y él puede corregir— porque nadie califica 7.624 clientes y una
 * marca a mano envejece. Lo que estas pruebas fijan es esa decisión.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { calificacionDe, explicacion, NIVELES, TEXTO } from '@/lib/calificacion'

const raiz = join(import.meta.dirname, '..', '..')
const leer = (p) => readFileSync(join(raiz, p), 'utf8')

describe('la regla', () => {
  it('quien termina a tiempo es verde', () => {
    expect(calificacionDe({ terminados: 3, clavos: 0, peorRetraso: 0 }).nivel).toBe('verde')
  })

  it('una semana de retraso todavía es verde, y ocho días ya no', () => {
    /* El corte no es un gusto: 65 % de los 4.703 préstamos terminados de
       producción cierran a tiempo y otro 17 % dentro de la semana. Poner el
       corte antes pintaría de ámbar a cuatro de cada cinco. */
    expect(calificacionDe({ terminados: 2, peorRetraso: 7 }).nivel).toBe('verde')
    expect(calificacionDe({ terminados: 2, peorRetraso: 8 }).nivel).toBe('ambar')
  })

  it('un mes de retraso es ámbar, más de un mes es rojo', () => {
    expect(calificacionDe({ terminados: 2, peorRetraso: 30 }).nivel).toBe('ambar')
    expect(calificacionDe({ terminados: 2, peorRetraso: 31 }).nivel).toBe('rojo')
  })

  it('un clavo es rojo aunque todo lo demás fuera perfecto', () => {
    /* Un préstamo dado por perdido es la peor señal que hay, y puede convivir
       con nueve pagados al día. El máximo manda, no el promedio. */
    expect(calificacionDe({ terminados: 9, clavos: 1, peorRetraso: 0 }).nivel).toBe('rojo')
  })

  it('⚠ sin historial NO hay estrella, que no es lo mismo que estrella roja', () => {
    /* 4.675 de 7.624 clientes no han terminado ningún préstamo. Pintarles un
       cero los dejaría como los peores de la lista cuando solo son nuevos: es
       la misma trampa que ya corrigió el cumplimiento. */
    expect(calificacionDe({ terminados: 0, clavos: 0, peorRetraso: 0 })).toBeNull()
    expect(calificacionDe({})).toBeNull()
    expect(calificacionDe(null)).toBeNull()
  })

  it('el número que va dentro es cuántos ha terminado', () => {
    expect(calificacionDe({ terminados: 5, peorRetraso: 0 }).numero).toBe(5)
  })
})

describe('la corrección a mano', () => {
  it('lo que puso el administrador manda sobre el cálculo', () => {
    const c = calificacionDe({ terminados: 4, peorRetraso: 60, manual: 'verde' })
    expect(c.nivel).toBe('verde')
    expect(c.automatico).toBe('rojo')   // sin perder lo que decía el sistema
    expect(c.aMano).toBe(true)
  })

  it('⚠ un cliente SIN historial sí puede llevar marca si se la ponen', () => {
    /* Es justo el caso que pidió: alguien a quien conoce de antes y sabe cómo
       paga, aunque el sistema todavía no tenga con qué juzgarlo. */
    const c = calificacionDe({ terminados: 0, manual: 'rojo' })
    expect(c.nivel).toBe('rojo')
    expect(c.automatico).toBeNull()
    expect(c.numero).toBe(0)
  })

  it('un nivel inventado se ignora, no se pinta', () => {
    expect(calificacionDe({ terminados: 0, manual: 'azul' })).toBeNull()
    expect(calificacionDe({ terminados: 2, peorRetraso: 0, manual: 'azul' }).nivel).toBe('verde')
  })

  it('la explicación dice que la puso una persona, y qué decía el sistema', () => {
    const c = calificacionDe({ terminados: 4, peorRetraso: 60, manual: 'verde' })
    const t = explicacion(c, 'Juan')
    expect(t).toContain('Juan')
    expect(t).toContain(TEXTO.rojo)
    // Y sin corregir, la explicación es el porqué del cálculo.
    expect(explicacion(calificacionDe({ terminados: 1, peorRetraso: 0 }))).toMatch(/sin atrasarse/i)
  })
})

describe('está cableada en las tres pantallas donde se ve un cliente', () => {
  /* El fallo del comprobante se reportó DOS DÍAS SEGUIDOS por arreglar un
     camino y dejar el otro. La misma estrella se mira en la lista, en la ficha
     y en la parada de la ruta: si una se queda sin el dato, el mismo cliente
     sale marcado en una pantalla y mudo en la otra. */
  it('la tarjeta de la lista la pinta', () => {
    expect(leer('components/cf/TarjetaCliente.jsx')).toContain('<EstrellaCliente')
  })

  it('la parada de la ruta la pinta', () => {
    expect(leer('components/cf/ParadaDeCobro.jsx')).toContain('<EstrellaCliente')
  })

  it('la ficha del cliente la pinta CON su palabra', () => {
    /* En la ficha hay sitio para decir qué significa el color, así que se dice:
       un color a secas obliga a adivinar. */
    expect(leer('components/clientes/ClienteHeroCard.jsx')).toContain('<MarcaComoPaga')
  })

  it('⚠ y en la ficha se pinta AUNQUE NO HAYA MARCA, o no hay dónde asignarla', () => {
    /* El agujero que encontró el dueño: «si no tiene estrella, no se puede
       asignar». La marca de la ficha se pinta siempre —vacía dice «Sin
       calificar»— y siempre lleva su `onClick`. Son 3.639 de 6.656 clientes, y
       son justo los que su cliente quería marcar a mano porque los conoce.

       Anclado en el JSX y no en la prosa: el nivel entra con `?.` (opcional) y
       el texto tiene rama para cuando no hay. */
    const src = leer('components/clientes/ClienteHeroCard.jsx')
    expect(src).toContain('nivel={calificacion?.nivel}')
    expect(src).toContain("'Sin calificar'")
    expect(src).toContain('onClick={onAbrirCalificacion}')
    // Y no está envuelta en un `{calificacion && ...}` que la haría desaparecer.
    expect(src).not.toMatch(/\{calificacion && \(\s*<MarcaComoPaga/)
  })

  it('⚠ el número YA NO va dentro de la estrella', () => {
    /* «Primero no me gustó el número de adentro. No dice nada realmente.» Un
       «8» suelto no tiene unidad y obliga a leer el título para entenderlo: si
       un control necesita etiqueta para entenderse, el mapeo es débil. El color
       es el juicio; el conteo va donde se puede decir con palabras. */
    const src = leer('components/cf/primitivos.jsx')
    expect(src).not.toMatch(/export function EstrellaCliente\(\{[^}]*numero/)
    for (const donde of ['components/cf/TarjetaCliente.jsx', 'components/cf/ParadaDeCobro.jsx',
                         'app/(dashboard)/clientes/page.jsx', 'components/clientes/ClienteHeroCard.jsx']) {
      expect(leer(donde), donde).not.toMatch(/<(EstrellaCliente|MarcaComoPaga)[^>]*numero=/)
    }
  })

  it('la marca NO usa la píldora completa, que está reservada', () => {
    /* `--cf-r-full` (999) es de cinco cosas —avatar, punto, pastilla de estado,
       barra de progreso y el botón +— y ésta sería la sexta. La compacta no
       lleva caja ninguna; la que va con palabra usa el radio de pastilla. */
    const src = leer('components/cf/primitivos.jsx')
    /* ⚠ ACOTADO A LA MARCA, no a todo el bloque: el globo del «tac» vive entre
       medias y sí lleva un punto redondo de 7px, que es un uso legítimo de la
       píldora. Una prueba que mira un rango demasiado ancho falla por lo que no
       debe y acaba borrándose. */
    const marca = src.slice(src.indexOf('export function MarcaComoPaga'),
                            src.indexOf('/* ══ 5 · Botones'))
    expect(marca).not.toContain('--cf-r-full')
    expect(marca).not.toMatch(/borderRadius:\s*999/)
    expect(marca).toContain("borderRadius: 'var(--cf-r-pill)'")
  })

  it('⚠ la estrella no lleva caja detrás: el material va en ella', () => {
    /* Apilar una superficie clara sobre la tarjeta blanca hunde la legibilidad,
       y a 22px el radio de icono se lee como un círculo. Lo probé y era peor.
       El volumen son el filo claro y la sombra teñida del propio color. */
    const src = leer('components/cf/primitivos.jsx')
    /* Solo el botón de la estrella, hasta donde empieza el globo. */
    const compacta = src.slice(src.indexOf('export function EstrellaCliente'),
                               src.indexOf('function GloboDeEstrella'))
    const estilo = compacta.slice(compacta.indexOf('<button'), compacta.indexOf('</button>'))
    expect(estilo).toContain("background: 'none'")
    expect(estilo).not.toMatch(/borderRadius/)
    expect(src).toContain('drop-shadow')
  })

  it('⚠ y los TRES APIs la calculan', () => {
    /* Ninguno puede quedarse fuera: `/api/clientes` alimenta la lista,
       `/api/cobros-hoy` y `/api/rutas/[id]` alimentan la MISMA tarjeta de la
       calle, y la ficha sale de `/api/clientes/[id]`. */
    for (const api of ['app/api/clientes/route.js', 'app/api/clientes/[id]/route.js',
                       'app/api/cobros-hoy/route.js', 'app/api/rutas/[id]/route.js']) {
      expect(leer(api), api).toContain('calificacionDe(')
    }
  })

  it('⚠ y los que enumeran campos PIDEN `calificacionManual`', () => {
    /* Un campo que existe y no se pide vale `undefined`: no da error y quien lo
       lee decide en silencio. Sin él, la corrección del dueño no llegaría a la
       calle y la ruta diría una cosa y la lista otra.

       Solo estos dos hacen falta: la ficha y la ruta traen el cliente con
       `include`, que ya arrastra todas las columnas. Si alguno pasara a `select`
       tendría que entrar en esta lista. */
    for (const api of ['app/api/clientes/route.js', 'app/api/cobros-hoy/route.js']) {
      expect(leer(api), api).toContain('calificacionManual: true')
    }
    for (const api of ['app/api/clientes/[id]/route.js', 'app/api/rutas/[id]/route.js']) {
      expect(leer(api), api).toMatch(/include: \{/)
    }
  })

  it('la consulta del historial vive en UN solo sitio', () => {
    /* Cuatro copias del mismo SQL es cómo divergen dos pantallas. Ningún API
       vuelve a escribirlo: todos llaman al helper. */
    for (const api of ['app/api/clientes/route.js', 'app/api/cobros-hoy/route.js',
                       'app/api/rutas/[id]/route.js']) {
      expect(leer(api), api).toContain('historialPorCliente(')
      expect(leer(api), api).not.toContain("estado IN ('completado', 'cancelado')")
    }
  })
})

describe('el «tac» que explica el color', () => {
  it('⚠ tocar la estrella NO abre la ficha del cliente', () => {
    /* La estrella vive DENTRO de la tarjeta, que al tocarla navega. Sin frenar
       el toque, la curiosidad te saca de la lista — y son 33 estrellas por
       pantalla. Se frena en los DOS eventos: el `click` y el `pointerdown`,
       porque las tarjetas de la ruta responden al segundo. */
    const src = leer('components/cf/primitivos.jsx')
    const bloque = src.slice(src.indexOf('export function EstrellaCliente'),
                             src.indexOf('function GloboDeEstrella'))
    expect(bloque).toContain('e.stopPropagation()')
    expect(bloque).toContain('onPointerDown={(e) => e.stopPropagation()}')
  })

  it('el globo va en un portal, no dentro de la fila', () => {
    /* `position: fixed` deja de ser fijo si un ancestro tiene `transform`, y
       las listas de esta app entran animadas: sin portal el globo saldría
       desplazado justo donde más se va a tocar. */
    expect(leer('components/cf/primitivos.jsx')).toContain('createPortal(')
  })

  it('dice el nivel aunque nadie le pase el texto', () => {
    const src = leer('components/cf/primitivos.jsx')
    expect(src).toMatch(/TEXTO_NIVEL = \{[^}]*Buen cliente/)
  })
})

describe('quién puede calificar', () => {
  it('⚠ solo el dueño: el cobrador la ve y no la cambia', () => {
    /* «Como para que el administrador solamente pueda hacer eso.» Endpoint
       propio y no el PATCH general de cliente, que un cobrador con
       `puedeEditarClientes` sí puede usar: reusarlo habría dejado calificar al
       cobrador al que la marca pretende avisar. */
    const src = leer('app/api/clientes/[id]/calificacion/route.js')
    expect(src).toContain("session.user.rol !== 'owner'")
    expect(src).toContain('403')
  })

  it('se puede volver atrás: `null` devuelve el mando al cálculo', () => {
    const src = leer('app/api/clientes/[id]/calificacion/route.js')
    expect(src).toContain('calificacionManual: nivel ?? null')
  })

  it('los tres niveles y nada más', () => {
    expect(NIVELES).toEqual(['rojo', 'ambar', 'verde'])
  })
})
