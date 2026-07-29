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

// ── Valores de T40-00-a, la cabecera ELEGIDA ──
//
// OJO CON EL TURNO. T39-01 dibuja la cabecera con el nombre escrito, la campana
// con número y el avatar a 34px. T40-00-a es de un turno posterior, la guía la
// llama «la cabecera definitiva» y su pie dice «elegida»: solo el glifo, punto
// de 8px y avatar de 32px. Manda T40.
//
// Estas pruebas existen porque yo «corregí» la cabecera hacia T39-01 y la dejé
// peor, con tres cambios en dirección equivocada. Si alguien vuelve a hacerlo,
// que falle aquí.
describe('CabeceraMovil · T40-00-a, la elegida', () => {
  it('SOLO el glifo: sin logotipo escrito', () => {
    // «El usuario ya sabe en qué app está, así que el logotipo escrito no
    // aporta y pesa» — pie de T40-00-a, literal.
    expect(fuente).not.toMatch(/>Control</)
    expect(fuente).not.toMatch(/>Finanzas</)
  })

  it('la campana lleva un PUNTO de 8px, no un número', () => {
    // «El conteo exacto de avisos no cambia ninguna decisión» — misma fuente.
    expect(fuente).toMatch(/width: 8, height: 8, borderRadius: 999/)
    expect(fuente).not.toMatch(/badge > 9/)
  })

  it('el avatar mide 32px', () => {
    expect(fuente).toMatch(/width: 32, minWidth: 32, height: 32/)
    expect(fuente).not.toMatch(/width: 34, minWidth: 34/)
  })

  it('a la derecha van TRES cosas, no cuatro', () => {
    const nav = fuente.slice(fuente.indexOf('function Navegacion'))
    const hasta = nav.slice(0, nav.indexOf('</header>'))
    expect((hasta.match(/<BotonIcono/g) || []).length).toBe(2)  // buscar + campana
    expect(hasta).toMatch(/<Avatar/)                             // y el avatar
  })

  it('el avatar NO lleva punto de conexión', () => {
    // T39-01 le cuelga uno verde de 11px; T40-00-a, del turno siguiente y
    // marcada «elegida», lo quita. Esta prueba fijaba los 11px del turno 39.
    expect(fuente).not.toMatch(/width: 11, height: 11/)
    expect(fuente).not.toMatch(/conectado/)
  })

  it('el estado de conexión no se pierde: lo dice HojaCuenta con palabras', () => {
    // Quitar el punto solo es correcto si la información sigue estando en algún
    // sitio. Está en la hoja de cuenta, que es a donde lleva este avatar.
    const hoja = fs.readFileSync(
      path.join(process.cwd(), 'components/armazon/HojaCuenta.jsx'), 'utf8')
    expect(hoja).toMatch(/Sin conexión/)
  })

  it('los números van por la clase .cf-num, que trae la gramática de cifras', () => {
    // Regla 1 de las cuatro globales. Aquí NO va en línea: la aplica la
    // utilidad .cf-num de tokens-2026.css, que es donde vive tabular-nums.
    expect(fuente).toMatch(/className="cf-num"/)
    const tokens = fs.readFileSync(
      path.join(process.cwd(), 'app/tokens-2026.css'), 'utf8')
    expect(tokens).toMatch(/\.cf-num[^}]*tabular-nums/s)
  })
})
