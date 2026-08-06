import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { resolverArmazon, CABECERA } from '@/lib/armazon'

// ── ¿✕ DE CERRAR O FLECHA DE VOLVER? ────────────────────────────────────────
//
// El dueño lo planteó como duda, no como fallo, y eso es lo que la hace buena:
//
//   «simulador (con otro tipo de cabecera con botón de cierre no con botón de
//    volver atrás), está igual que los wizards, no sé si es inconsistencia»
//
// Lo era en un caso de tres. El criterio de `TAREA` está escrito en
// `lib/armazon.js`: **«salirse a medias pierde datos»**.
//
//   · migrador     → sí: hay una foto ya procesada    ✕ correcta
//   · carga masiva → sí: hay un Excel ya cargado      ✕ correcta
//   · simulador    → NO. Su propio código lo dice: «No escribe en la base».
//                    Se teclea un monto, se mira la cuota y se sale.
//
// Y de paso apareció lo que sí era inconsistencia pura: la cabecera de tarea
// pintaba su título a 15px y la de detalle a 17. Dos cabeceras de la misma app
// con distinto tamaño — «parecen dos aplicaciones distintas», que es la queja
// original.

describe('el criterio: pierde datos al salir → ✕; si no, flecha', () => {
  it('el simulador NO es una tarea: no guarda nada', () => {
    expect(resolverArmazon('/prestamos/simulador').cabecera).toBe(CABECERA.DETALLE)
  })

  it('…y su código lo confirma', () => {
    // Si algún día el simulador empezara a guardar, esta prueba avisa de que
    // hay que reconsiderar su cabecera.
    const src = readFileSync(resolve(process.cwd(), 'app/(dashboard)/prestamos/simulador/page.jsx'), 'utf8')
    expect(src).toMatch(/No escribe en la base/)
  })

  it('el migrador SÍ lo es: hay una foto procesada que se pierde', () => {
    expect(resolverArmazon('/migrador').cabecera).toBe(CABECERA.TAREA)
  })

  it('la carga masiva también: hay un Excel cargado', () => {
    expect(resolverArmazon('/carga-masiva').cabecera).toBe(CABECERA.TAREA)
  })

  it('y crear préstamo o cliente, que es de donde viene la regla', () => {
    expect(resolverArmazon('/prestamos/nuevo').cabecera).toBe(CABECERA.TAREA)
    expect(resolverArmazon('/clientes/nuevo').cabecera).toBe(CABECERA.TAREA)
  })
})

describe('las dos cabeceras miden lo mismo', () => {
  const cab = readFileSync(resolve(process.cwd(), 'components/armazon/CabeceraMovil.jsx'), 'utf8')

  it('el título de TAREA está a 17px, como el de DETALLE', () => {
    // Estaba a 15, que no existe en la escala de títulos (27 · 20 · 17).
    const tarea = cab.slice(cab.indexOf('function Tarea('))
    expect(tarea, 'volvió el 15px, que no está en la escala')
      .not.toMatch(/fontSize: 15, fontWeight: 600/)
    expect(tarea.slice(0, 2600)).toMatch(/fontSize: 17, fontWeight: 600/)
  })

  it('la ✕ mide 19px, como pide §6 para cerrar y atrás', () => {
    // Estaba a 17 —tamaño de icono de fila— y se veía más pequeña que la flecha
    // de volver de las demás cabeceras.
    const tarea = cab.slice(cab.indexOf('function Tarea('))
    expect(tarea.slice(0, 2600)).toMatch(/<svg width="19" height="19"[^>]*>\s*<path d="M18 6L6 18M6 6l12 12"/)
  })

  it('las dos usan Space Grotesk, no dos familias distintas', () => {
    const conFuente = (cab.match(/font-space-grotesk/g) ?? []).length
    expect(conFuente).toBeGreaterThanOrEqual(2)
  })
})
