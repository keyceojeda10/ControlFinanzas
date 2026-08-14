// lib/__tests__/campana-sugerencias.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Quiero un banner que les permita a los usuarios poder colocar a través de
// imágenes, texto y hasta un mensaje de voz cuál sería lo que no les gusta de la
// aplicación o qué quisieran agregar.» — el dueño, 14 ago 2026.
//
// Lo que estas pruebas cuidan no es que el banner se pinte: es que la campaña no
// repita los dos errores que ya se cometieron aquí.
//
//   · La campaña de fotos de cuadernos (7–11 ago) era `esOwner &&`: los
//     cobradores, que caminan la ruta con la app en la mano ocho horas, no la
//     vieron nunca. Cuatro días, 465 negocios, CERO respuestas.
//   · Y lo que sube la gente no puede acabar en `public/`, que se sirve sin
//     sesión.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { campanaViva, tieneContenido, CIERRA_EN } from '@/lib/sugerencias'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('la campaña se apaga sola', () => {
  it('está viva antes de la fecha y muerta después', () => {
    expect(campanaViva(new Date(CIERRA_EN.getTime() - 1000))).toBe(true)
    expect(campanaViva(new Date(CIERRA_EN.getTime() + 1000))).toBe(false)
  })

  it('⚠ cierra a las 04:59Z, que es la medianoche colombiana', () => {
    /* Escrito como `T23:59` cerraría a las 6 de la tarde hora de Colombia, que
       es justo cuando el cobrador cuadra y abre la app. */
    expect(CIERRA_EN.toISOString()).toMatch(/T04:59:59/)
  })

  it('dura más de los cuatro días que no funcionaron', () => {
    const dias = Math.ceil((CIERRA_EN - new Date('2026-08-15T00:00:00Z')) / 86400000)
    expect(dias).toBeGreaterThanOrEqual(10)
  })
})

describe('no se manda un envío vacío', () => {
  it.each([
    [{ texto: 'algo' }, true],
    [{ texto: '   ' }, false],
    [{ imagenes: 1 }, true],
    [{ audio: true }, true],
    [{}, false],
  ])('%o -> %s', (entrada, esperado) => {
    expect(tieneContenido(entrada)).toBe(esperado)
  })
})

describe('⚠ el banner es para TODOS', () => {
  it('no está detrás de `esOwner`, como el de las fotos', () => {
    const src = leer('app/(dashboard)/dashboard/page.jsx')
    expect(src, 'no se encontró el banner montado').toMatch(/<BannerSugerencias \/>/)
    expect(src, 'volvió a quedar solo para dueños')
      .not.toMatch(/esOwner && <BannerSugerencias/)
  })
})

describe('⚠ lo que sube la gente no acaba en public/', () => {
  /* `public/` lo sirve Next como estático y NO pasa por la sesión: comprobado
     contra producción, `/uploads/...` responde 200 sin cuenta. Una captura de la
     cartera lleva nombres, cédulas y deudas de terceros. */
  const api = leer('app/api/sugerencias/route.js')

  it('guarda en el almacén, fuera de la web', () => {
    expect(api).toMatch(/SUGERENCIAS_DIR/)
    expect(api, 'volvió a escribir dentro de public/').not.toMatch(/public\//)
  })

  it('valida tipo y tamaño antes de escribir', () => {
    expect(api).toMatch(/tiposOk\.includes\(archivo\.type\)/)
    expect(api).toMatch(/buf\.length > maxBytes/)
  })

  it('⚠ si la transcripción falla, el audio no se pierde', () => {
    /* Tirar la nota de voz de alguien porque Groq tuvo un mal minuto sería lo
       contrario de lo que esta campaña intenta: se guarda ANTES de transcribir. */
    const bloque = api.match(/if \(audio\) \{[\s\S]*?\n  \}/)?.[0] ?? ''
    expect(bloque, 'no se encontró el bloque del audio').toBeTruthy()
    expect(bloque).toMatch(/await guardar\(audio/)
    expect(bloque.indexOf('guardar(audio')).toBeLessThan(bloque.indexOf('transcribirAudio'))
  })
})

describe('⚠ los adjuntos solo los ve el superadmin', () => {
  const api = leer('app/api/admin/sugerencias/archivo/route.js')

  it('exige rol de superadmin', () => {
    expect(api).toMatch(/rol !== 'superadmin'/)
  })

  it('el nombre del archivo NO viene de quien pregunta', () => {
    /* Se pide por índice dentro de una sugerencia y el nombre sale de la fila.
       Aceptando un nombre, un `../../.env` saldría por esta puerta. */
    expect(api).toMatch(/archivos\[i\]/)
    expect(api).not.toMatch(/searchParams\.get\('archivo'\)|searchParams\.get\('ruta'\)/)
  })

  it('y aun así comprueba que la ruta caiga dentro del almacén', () => {
    expect(api).toMatch(/completo\.startsWith\(base \+ path\.sep\)/)
  })
})

describe('la transcripción vive en un solo sitio', () => {
  it('el endpoint de voz y la campaña usan la misma función', () => {
    expect(leer('app/api/voz/transcribir/route.js')).toMatch(/from '@\/lib\/transcribir'/)
    expect(leer('app/api/sugerencias/route.js')).toMatch(/from '@\/lib\/transcribir'/)
  })
})
