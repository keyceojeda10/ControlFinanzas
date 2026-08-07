import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { adaptarCobrosHoy } from '@/lib/adaptadores/cobros'

// ── ADENDA 5 · E07 · LA TARJETA DE LA RUTA DE COBRO ────────────────────────
//
// «La tarjeta contestaba "cuánto debe". Tiene que contestar "cuánto le pido".»
//
// ⚠ La lámina dibuja como «HOY» una tarjeta de nueve cifras sin etiquetas que
// YA NO es la actual: la pantalla de hoy tiene la tira con rótulos (ATRASO ·
// CUMPLE · CUOTA · ÚLT. PAGO) y el saldo dice «debe $92.000». Comprobado en la
// pantalla real antes de tocar nada — si no, se acaba «arreglando» lo que ya
// está. Lo que sí faltaba es lo de aquí abajo.

const RAIZ = process.cwd()
const crudo = readFileSync(resolve(RAIZ, 'components/cf/ParadaDeCobro.jsx'), 'utf8')

// ⚠ La tarjeta salio de CobrarHoy.jsx a components/cf/ParadaDeCobro.jsx cuando
// /rutas/[id] tuvo que pintar la MISMA parada. Esta prueba mira el modulo
// compartido, asi que ahora cubre las dos pantallas de una vez.
const src = crudo
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? '' : l)).join('\n')

describe('la acción principal tiene su botón', () => {
  it('«Cobrar» existe y es DORADO, nunca verde', () => {
    /* Cobrar era lo único que no tenía botón: se hacía tocando la tarjeta
       entera, que es un gesto que hay que saberse, mientras los tres iconos
       secundarios se llevaban todo el peso visual.

       ⚠ El verde en este sistema significa «al día, pagado». Usarlo como color
       de acción rompe esa lectura justo en la pantalla donde se decide si
       alguien pagó. */
    const i = src.indexOf('>Cobrar</button>')
    expect(i, 'no hay botón de cobrar en la tarjeta').toBeGreaterThan(-1)
    const boton = src.slice(Math.max(0, i - 500), i)
    expect(boton).toMatch(/background: 'var\(--cf-gold\)'/)
    expect(boton, 'el botón de cobrar se puso verde').not.toMatch(/--cf-green/)
  })

  it('y no quita el gesto de siempre', () => {
    // Tocar la tarjeta sigue cobrando: el botón lo hace visible, no lo sustituye.
    const i = src.indexOf('>Cobrar</button>')
    expect(src.slice(Math.max(0, i - 500), i)).toMatch(/onClick=\{onClick\}/)
  })
})

describe('la distancia', () => {
  const fila = (cliente, coords) =>
    adaptarCobrosHoy({ clientes: [{ id: '1', nombre: 'X', cuota: 0, ...cliente }], resumen: {} },
      { pais: 'co', coords })

  const buscar = (r) => {
    const grupos = r?.grupos ?? r?.rutas ?? []
    return grupos[0]?.filas?.[0] ?? null
  }

  it('sale al lado de la dirección cuando hay GPS', () => {
    // «El cobrador decide el orden real con ella»: con dos clientes igual de
    // atrasados, va primero el que tiene al lado.
    const f = buscar(fila({ latitud: 7.87, longitud: -72.478, direccion: 'Cl 8' },
      { latitud: 7.8705, longitud: -72.478 }))
    expect(f?.distancia).toMatch(/^a \d+ m$/)
  })

  it('sin GPS no se inventa', () => {
    /* Inventar una distancia manda al cobrador a caminar mal, que es justo lo
       que esto viene a evitar. Por eso la pantalla tampoco deja ordenar por
       cercanía sin coordenadas. */
    const f = buscar(fila({ latitud: 7.87, longitud: -72.478 }, null))
    expect(f?.distancia).toBeNull()
  })

  it('ni cuando el cliente no tiene coordenadas', () => {
    const f = buscar(fila({ direccion: 'Cl 8' }, { latitud: 7.87, longitud: -72.478 }))
    expect(f?.distancia).toBeNull()
  })

  it('y se calla por encima de 50 km', () => {
    /* ⚠ MEDIDO EN EL ESPEJO: entre las 293 distancias reales salían «a 331,4
       km» y «a 413,4 km». Nadie recorre eso en una ruta a pie — son
       coordenadas mal capturadas. Una distancia absurda al lado de una
       dirección correcta hace dudar de la dirección. */
    const f = buscar(fila({ latitud: 4.7, longitud: -74.1 },
      { latitud: 7.87, longitud: -72.478 }))
    expect(f?.distancia).toBeNull()
  })

  it('en kilómetros cuando pasa del kilómetro', () => {
    // «a 1.240 m» se lee peor que «a 1,2 km» y la precisión no cambia nada.
    const f = buscar(fila({ latitud: 7.88, longitud: -72.478 },
      { latitud: 7.87, longitud: -72.478 }))
    expect(f?.distancia).toMatch(/^a \d+,\d km$/)
  })

  it('y redondeada a diez metros', () => {
    // El GPS de un teléfono no acierta al metro: «a 237 m» promete una
    // precisión que no existe.
    const f = buscar(fila({ latitud: 7.8702, longitud: -72.478 },
      { latitud: 7.87, longitud: -72.478 }))
    expect(Number(f.distancia.match(/\d+/)[0]) % 10).toBe(0)
  })
})
