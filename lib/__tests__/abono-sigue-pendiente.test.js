import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { filaDeCobro } from '../adaptadores/cobros'
import { paradasDeRuta } from '../adaptadores/ruta'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const tarjeta = leer('components/cf/ParadaDeCobro.jsx')
const tira    = leer('components/cf/primitivos.jsx')
const cobrosHoy = leer('app/(dashboard)/cobros-hoy/page.jsx')
const tarjetaCliente = leer('components/cf/TarjetaCliente.jsx')

/* ⚠ ESTO BLOQUEABA COBRAR DINERO EN PRODUCCION.
   Reportado: «se hace un pago de cualquier prestamo del monto que sea, asi
   quede debiendo, sale como cobrado y ya no permite seguir cobrandole mas».

   La tarjeta VIEJA de la ruta lo distinguia con `abonoConPendiente` y pintaba
   «Abono hoy · sigue pendiente». Al unificar las dos tarjetas se colapsaron
   `pagoHoy` y `cobroPendienteHoy` en un solo `cobrada`, y el cliente con tres
   prestamos que abonaba uno quedaba tachado, en verde y sin boton. */
describe('abono parcial: la fila sigue viva', () => {
  const base = { id: 'c1', nombre: 'Jesus Barreto', cuota: 8000, saldoTotal: 300000, diasMora: 16 }

  it('pagar algo NO es haber cobrado, si todavia le toca', () => {
    const f = filaDeCobro({ ...base, pagoHoy: true, cobroPendienteHoy: true, montoCobradoHoy: 8000 })
    expect(f.cobrada).toBe(false)
    expect(f.abonoHoy).toBeTruthy()
  })

  it('cerrada solo cuando ya no queda nada que cobrarle hoy', () => {
    const f = filaDeCobro({ ...base, pagoHoy: true, cobroPendienteHoy: false, montoCobradoHoy: 8000 })
    expect(f.cobrada).toBe(true)
    expect(f.abonoHoy).toBeNull()
  })

  it('sin pagar no hay linea de abono', () => {
    const f = filaDeCobro({ ...base, pagoHoy: false, cobroPendienteHoy: true })
    expect(f.cobrada).toBe(false)
    expect(f.abonoHoy).toBeNull()
  })

  it('en la ruta cuenta como parada PENDIENTE, no como hecha', () => {
    // Si contara como hecha, ni saldria en «por cobrar hoy» ni sumaria al
    // contador del boton: el cobrador la daria por cerrada.
    const { visitas } = paradasDeRuta([
      { id: 'c1', nombre: 'Jesus', pagoHoy: true, cobroPendienteHoy: true, montoPagadoHoy: 8000,
        prestamosActivos: [{ id: 'p', saldoPendiente: 300000, totalAPagar: 400000, totalPagado: 100000 }] },
    ])
    expect(visitas).toHaveLength(1)
    expect(visitas[0].cobrada).toBe(false)
  })

  it('conserva su tira de cifras', () => {
    // Se escondia con `pagoHoy`, asi que el que abonaba y seguia debiendo se
    // quedaba sin atraso, sin cumplimiento y sin ultimo pago —justo el que los
    // necesita, porque el atraso es lo que se le va a pedir ahora—. Se veia en
    // el espejo al lado de una vecina que si los tenia.
    const f = filaDeCobro({ ...base, pagoHoy: true, cobroPendienteHoy: true,
      montoCobradoHoy: 8000, montoParaPonerseAlDia: 24000 })
    expect(f.cifras).toBeTruthy()
    /* ⚠ Y EL COBRADO TAMBIEN LA LLEVA YA. Aqui decia «el cerrado sigue sin
       ella: ya esta tachado y con su hora». El dueño lo rebatio:

         «no le sale la tarjeta completa de toda la informacion de sus
          prestamos. Sale muy reducido […] estamos limitando la vista del orden
          y de la informacion que puede tener ese cliente»

       Y es cierto donde importa: quien tiene DOS prestamos y salda el de hoy
       sigue debiendo el otro, y la fila reducida no lo decia. Que esta hecha se
       lee por el numero verde, el nombre tachado, la hora y el monto en verde. */
    expect(filaDeCobro({ ...base, pagoHoy: true, cobroPendienteHoy: false }).cifras).toBeTruthy()
  })

  it('la tarjeta pinta la linea y NO tacha', () => {
    expect(tarjeta).toMatch(/\{abonoHoy && !cobrada && \(/)
    expect(tarjeta).toMatch(/sigue pendiente/)
  })
})

/* Reportado: «alguien se quiere saltar un cliente y entonces a aquel no lo
   puede gestionar; no le va a dar la opcion de tocarle el WhatsApp, la
   ubicacion o el cobro rapido». El orden de la ruta es una sugerencia, no un
   carril. */
describe('las acciones estan en todas las fichas', () => {
  it('no dependen de ser la parada actual', () => {
    /* Y desde el reporte del 7 de agosto, tampoco de estar sin cobrar: una
       parada hecha se quedaba sin forma de mandarle el recibo por WhatsApp ni
       de abrir su ficha. Lo que NO vuelve es el boton dorado — ahi ya no hay
       nada que cobrar hoy. */
    /* ⚠ La lista NO se fija entera: al añadirse «Deshacer el cobro» —que solo
       sale en la parada YA cobrada— esta condición ganó un término y las tres
       pruebas que la copiaban al pie de la letra se pusieron rojas sin que
       nada se hubiera roto. Lo que aquí importa es que el bloque no vuelva a
       depender de `!cobrada`, no cuántas acciones hay. */
    expect(tarjeta).toMatch(/\{\(onLlamar \|\| onWhatsApp \|\| onMapa \|\| onMas/)
    expect(tarjeta, 'las acciones volvieron a depender de estar sin cobrar')
      .not.toMatch(/\{!cobrada && \(onLlamar/)
    expect(tarjeta).not.toMatch(/\{activa && !cobrada && \(onWhatsApp/)
    expect(tarjeta).toMatch(/\{!cobrada && \(\s*<button/)
  })

  it('la parada actual se sigue distinguiendo por otro lado', () => {
    // Se quita el muro sin perder «donde voy»: borde dorado y aviso de mora.
    expect(tarjeta).toMatch(/activa && !cobrada \? '1\.5px solid var\(--cf-gold\)'/)
    expect(tarjeta).toMatch(/\{avisoMora && activa && !cobrada && \(/)
  })

  it('vuelve el boton de llamar, que la tarjeta vieja tenia', () => {
    expect(tarjeta).toMatch(/aria-label="Llamar"/)
  })
})

/* Reportado con captura: «$1.272.0004 0%» — el atraso metido encima del
   cumplimiento. El valor no llevaba NI recorte ni ajuste; la etiqueta si. */
describe('la cifra no se sale de su columna', () => {
  it('el valor lleva recorte, no solo la etiqueta', () => {
    const bloque = tira.slice(tira.indexOf('export function TiraCifras'))
    // Del `<span className="cf-fig">` hasta que cierra su `style`: ahi dentro
    // tiene que estar el recorte, o la cifra larga pisa la columna vecina.
    const i = bloque.indexOf('className="cf-fig"')
    const valor = bloque.slice(i, bloque.indexOf('}}>', i))
    expect(valor).toMatch(/overflow: 'hidden'/)
    expect(valor).toMatch(/whiteSpace: 'nowrap'/)
  })

  it('las cifras largas bajan de cuerpo, y no se abrevian', () => {
    // «$1,27M» se lee rapido pero no se puede decir en voz alta en la puerta,
    // y esta linea es justo la que el cobrador lee para pedir.
    expect(tira).toMatch(/function pasoLargo/)
    expect(tira).not.toMatch(/TiraCifras[\s\S]{0,2000}toFixed\(1\)[\s\S]{0,50}M/)
  })
})

/* Reportado: «el iconito de la ruta, uno le da un clic ahi y no hace nada». */
describe('el boton redondo del mapa', () => {
  // ⚠ SIN COMENTARIOS. La comprobacion de abajo se cazo a si misma: el
  // comentario que explica el fallo contiene el codigo del fallo. Ya paso antes
  // con la barra de acciones.
  const pantalla = leer('components/pantallas/CobrarHoy.jsx')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')

  it('no le pasa el evento del clic como si fuera una fila', () => {
    // `onClick={onMapa}` le entregaba el MouseEvent: `fila.id` salia undefined,
    // no encontraba cliente y la rama de respaldo pedia ese mismo cliente.
    expect(pantalla).toMatch(/onClick=\{\(\) => onMapa\(\)\}/)
    expect(pantalla).not.toMatch(/onClick=\{onMapa\}/)
  })

  it('sin fila arma la ruta del dia, y avisa si no hay ubicaciones', () => {
    expect(cobrosHoy).toMatch(/if \(!fila\)/)
    expect(cobrosHoy).toMatch(/waypoints=/)
    // Mandar a un mapa vacio es el fallo de «acabar en la lista de rutas sin
    // saber por que», ya reportado una vez.
    expect(cobrosHoy).toMatch(/Ninguno de los cobros de hoy tiene la ubicaci/)
  })
})

/* Lo que la tarjeta vieja decia y la nueva se habia dejado. Tres tocan dinero. */
describe('los avisos que se habian perdido', () => {
  it('la cuota extra de hoy, que cambia lo que se cobra', () => {
    const f = filaDeCobro({ id: 'c', nombre: 'X', cuotaExtraHoy: true, montoCuotaExtra: 20000 })
    expect(f.avisos.some((a) => /cuota extra/i.test(a.texto))).toBe(true)
  })

  it('el clavo, que si no se lee como un cliente normal', () => {
    const f = filaDeCobro({ id: 'c', nombre: 'X', tieneClavo: true })
    expect(f.avisos.some((a) => /perdido/i.test(a.texto))).toBe(true)
  })

  it('el moratorio pendiente', () => {
    const f = filaDeCobro({ id: 'c', nombre: 'X', moratorioPendiente: true })
    expect(f.avisos.some((a) => /moratorio/i.test(a.texto))).toBe(true)
  })

  it('sin nada de eso no hay renglones', () => {
    expect(filaDeCobro({ id: 'c', nombre: 'X' }).avisos).toEqual([])
  })
})

/* Reportado: «deberia poder retomar exactamente por donde quedo; si es una
   ruta de 50 o 100 clientes va a ser bastante tedioso estar volviendo a bajar».

   ⚠ LA MAQUINA SE MUDO A `lib/sitio-de-la-lista`, que es la que usan ahora las
   cuatro listas. Lo que aqui se comprueba es que la RUTA sigue enganchada a
   ella: el ancla que pinta y la que busca tienen que ser la misma, y el
   desplazamiento tiene que salir del contenedor y no de la ventana.
   El comportamiento en si —el id por delante de los pixeles, el 0 valido— se
   comprueba en `volver-al-sitio.test.js`, contra la funcion de verdad. */
describe('volver a donde se iba', () => {
  const ruta = leer('app/(dashboard)/rutas/[id]/page.jsx')

  it('el ancla de cada ficha existe', () => {
    // Me la lleve por delante al sustituir la tarjeta: sin ella
    // `getElementById` devuelve null y no se restaura nada.
    expect(ruta).toMatch(/ancla=\{ANCLA_CLIENTE\(fila\.id\)\}/)
    expect(ruta).toMatch(/const ANCLA_CLIENTE = \(id\) => `cliente-\$\{id\}`/)
    expect(tarjeta).toMatch(/<div id=\{ancla\}/)
  })

  it('guarda el scroll del CONTENEDOR, no el de la ventana', () => {
    // La lista va en un div con overflow: `window.scrollY` es siempre 0, y
    // como se guardaba en cadena, «0» daba verdadero y la restauracion subia
    // arriba del todo sin llegar a probar el respaldo.
    expect(ruta).toMatch(/const scrollTopDeLaLista = \(\) => desplazamientoActual\(\)/)
    expect(ruta).not.toMatch(/ruta-scrollY-\$\{id\}`, String\(window\.scrollY\)/)
  })

  it('la ruta usa la maquina compartida, no una copia suya', () => {
    expect(ruta).toMatch(/from '@\/lib\/sitio-de-la-lista'/)
    // La copia vieja vivia aqui dentro; si vuelve, vuelven las cuatro listas
    // desincronizadas.
    expect(ruta).not.toMatch(/const contenedorDeLaLista = \(\) => \{/)
  })

  it('⚠ el NOMBRE del cliente tambien guarda el sitio', () => {
    /* Este era el camino roto que reporto INVERSIONESJYM. `onClick` y `onMas`
       pasaban por `navegarACobroCliente`, que guarda; el nombre saltaba pelado
       y al volver la lista aparecia arriba del todo. Y es el UNICO destino de
       la tarjeta compacta cuando el cliente no tiene prestamo vivo. */
    const i = ruta.indexOf('onAbrirCliente={')
    expect(i).toBeGreaterThan(-1)
    const bloque = ruta.slice(i, i + 400)
    expect(bloque.indexOf('guardarContextoRuta')).toBeGreaterThan(-1)
    expect(bloque.indexOf('guardarContextoRuta')).toBeLessThan(bloque.indexOf('router.push'))
  })
})

/* ⚠ LAS OTRAS TRES LISTAS. No guardaban el sitio por NINGUN camino: se entraba
   a una ficha, se volvia, y aparecian arriba del todo. Cada `expect` de aqui es
   una via por la que se sale de una lista; si se anade una cuarta y no guarda,
   esto no la ve — por eso se comprueba tambien que ninguna quede con un salto
   pelado a `/clientes/` o `/prestamos/`. */
describe('las cuatro listas guardan el sitio', () => {
  const clientes  = leer('app/(dashboard)/clientes/page.jsx')
  const prestamos = leer('app/(dashboard)/prestamos/page.jsx')
  const pantalla  = leer('components/pantallas/CobrarHoy.jsx')

  it('«Cobros de hoy» pinta el ancla y guarda al salir', () => {
    expect(cobrosHoy).toMatch(/useSitioDeLaLista/)
    expect(cobrosHoy).toMatch(/ancla=\{ANCLA_CLIENTE\}/)
    // Sin esto el `Carril` sale sin `id` y no hay a donde volver.
    expect(pantalla).toMatch(/ancla=\{ancla \? ancla\(f\.id\) : undefined\}/)
  })

  it('ninguna lista salta a una ficha sin guardar antes', () => {
    for (const [nombre, src] of [['clientes', clientes], ['prestamos', prestamos], ['cobros-hoy', cobrosHoy]]) {
      const saltos = src.match(/window\.location\.href = `\/(clientes|prestamos)\/\$\{[^`]+`/g) ?? []
      for (const salto of saltos) {
        const i = src.indexOf(salto)
        // Los 120 caracteres de antes tienen que llevar el guardado.
        expect(src.slice(Math.max(0, i - 120), i), `${nombre}: «${salto}» salta sin guardar`)
          .toMatch(/guardarSitio\(/)
      }
    }
  })

  it('las tarjetas llevan su ancla puesta', () => {
    expect(clientes).toMatch(/ancla=\{ANCLA_CLIENTE\(c\.id\)\}/)
    expect(prestamos).toMatch(/ancla=\{ANCLA_PRESTAMO\(p\.id\)\}/)
    expect(tarjetaCliente).toMatch(/id=\{ancla\}/)
  })

  it('la fila de la TABLA tambien, que es la de escritorio', () => {
    expect(clientes).toMatch(/id=\{ANCLA_CLIENTE\(c\.id\)\}/)
    expect(prestamos).toMatch(/id=\{ANCLA_PRESTAMO\(p\.id\)\}/)
  })
})
