import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// La cabecera mide 56px SIEMPRE, en las tres variantes. La de tarea es la que
// se rompe sin avisar: `height:56` la fuerza igual, así que el desbordamiento
// no se ve como desbordamiento — se ve como una cabecera apretada y fea, que es
// mucho más difícil de atribuir a su causa.
//
// La cuenta: 8 (arriba) + 36 (botón) + 9 (hueco) + 3 (espina) = 56.
const fuente = fs.readFileSync(
  path.join(process.cwd(), 'components/armazon/CabeceraMovil.jsx'), 'utf8')

describe('CabeceraMovil · los 56px', () => {
  it('la variante de tarea no suma padding-bottom sobre el hueco de la espina', () => {
    // '8px 20px 12px' + marginTop:9 + espina:3 = 68px de contenido en 56.
    expect(fuente).not.toMatch(/padding: '8px 20px 12px'/)
    expect(fuente).toMatch(/padding: '8px 20px 0'/)
  })

  it('mantiene el hueco de 9px entre el botón y la espina', () => {
    expect(fuente).toMatch(/marginTop: 9/)
  })

  it('reserva el mismo hueco cuando no hay espina', () => {
    expect(fuente).toMatch(/height: 12, flex: 'none'/)
  })

  it('la altura sigue fijada por el token, no por el contenido', () => {
    expect(fuente).toMatch(/height: ALTO, minHeight: ALTO/)
    expect(fuente).toMatch(/const ALTO = 56/)
  })
})

// ── Valores de la lámina T39-01 ──
//
// Estos NO son mis decisiones: salen del archivo del paquete, comparando la
// captura del diseño contra la de la app. Van fijados porque los cuatro los
// tenía mal y en tres de ellos había escrito en el código una justificación de
// por qué mi versión era mejor. Una racionalización no es una decisión de
// diseño.
describe('CabeceraMovil · lo que dice la lámina', () => {
  it('el nombre de la marca va escrito al lado del logo, en dos líneas', () => {
    // Yo había puesto solo el glifo, argumentando que «el usuario ya sabe en
    // qué app está». La lámina lleva «Control / Finanzas».
    expect(fuente).toMatch(/>Control</)
    expect(fuente).toMatch(/>Finanzas</)
  })

  it('«Finanzas» va en dorado oscuro, no en gris', () => {
    expect(fuente).toMatch(/cf-gold-dark[^}]*}}>\s*Finanzas/s)
  })

  it('la campana lleva EL NÚMERO de avisos, no un punto', () => {
    // El punto no distingue «hay algo» de «hay mucho», y el número sí cambia
    // si abro la campana ahora o luego.
    expect(fuente).toMatch(/badge > 0/)
    expect(fuente).toMatch(/badge > 9 \? '9\+' : badge/)
    expect(fuente).toMatch(/minWidth: 17, height: 17/)
  })

  it('el avatar mide 34px, no 32', () => {
    expect(fuente).toMatch(/width: 34, minWidth: 34, height: 34/)
  })

  it('el punto de conexión mide 11px y es verde', () => {
    expect(fuente).toMatch(/width: 11, height: 11/)
    expect(fuente).toMatch(/cf-green/)
  })

  it('todo número lleva la gramática de cifras', () => {
    // Regla 1 de las cuatro que el índice dice que se rompen siempre.
    expect(fuente).toMatch(/tabular-nums lining-nums/)
  })
})
