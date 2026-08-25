// lib/__tests__/videos-graban-donde-se-montan.test.js
//
// ══ LA VOZ NUEVA SOBRE LAS TOMAS VIEJAS ════════════════════════════════════
//
// 25 ago 2026, rehaciendo el vídeo 1 porque su audio salió dañado. Se grabó
// bien —1:41 de imagen para 1:18 de voz— y el montaje devolvió 2:24. Los 43
// segundos de más eran de OTRO vídeo: el guion escribía en `/tmp/videos/…` y
// `voz.mjs` monta sobre `videos-tutoriales/tomas-NN`, así que le pegó la voz
// recién generada a las tomas del 21 de agosto.
//
// No dio ningún error. El vídeo salió, con voz y con subtítulos, y solo se supo
// midiendo la duración contra la de la voz.
//
// SIETE guiones tenían la ruta vieja —01, 02, 06, 08, 09, 10 y 12— y son
// EXACTAMENTE los que quedaron sin voz: se escribieron antes de que existiera
// el montaje, así que nunca les hizo falta caer donde él mira.
//
// ⚠ Y `/tmp` se vacía al reiniciar: las tomas de un vídeo de veinte minutos de
//   grabación desaparecían solas.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

const DIR = 'scripts/video-demo'
const VIDEOS = '/home/keyce/Desktop/videos-tutoriales'
/* Los tres que NO pasan por `correr`, con su motivo. Van escritos y no
   ignorados en silencio: una excepción sin nombre es una excepción que mañana
   nadie sabe si sigue siéndolo. */
const APARTE = {
  'v00-como-llegar.mjs': 'son las escenas de «cómo llegar», que se pegan a otros vídeos: su carpeta es `tomas-como-llegar`',
  'v03-onboarding.mjs': 'graba con su propio `recordVideo` y saca DOS vídeos según `FLUJO` (03 y 04)',
  'v13-corto-ventas.mjs': 'es el corto de ventas, montado aparte',
}

const guiones = readdirSync(resolve(process.cwd(), DIR))
  .filter((f) => /^v\d\d-.+\.mjs$/.test(f))
  .filter((f) => !APARTE[f])
  .sort()

describe('⚠ cada vídeo graba donde el montaje lo va a buscar', () => {
  it('hay guiones que revisar', () => {
    expect(guiones.length).toBeGreaterThan(15)
  })

  it('las excepciones siguen siendo las tres de siempre', () => {
    /* Si una deja de serlo —o aparece una cuarta— hay que mirarla, no ampliar
       la lista por inercia. */
    for (const [arch, motivo] of Object.entries(APARTE)) {
      const src = readFileSync(resolve(process.cwd(), DIR, arch), 'utf8')
      expect(motivo.length, `${arch} sin motivo escrito`).toBeGreaterThan(20)
      expect(src.includes('await correr({') && /dir: '\/home[^']*tomas-\d\d'/.test(src),
        `${arch} ya encaja en la regla: sácalo de APARTE`).toBe(false)
    }
  })

  for (const g of guiones) {
    const nn = g.slice(1, 3)
    const src = readFileSync(resolve(process.cwd(), DIR, g), 'utf8')

    it(`${g} deja las tomas en tomas-${nn}`, () => {
      const dir = src.match(/dir:\s*'([^']+)'/)
      expect(dir, 'no declara dónde deja las tomas').toBeTruthy()
      expect(dir[1], `voz.mjs mira en ${VIDEOS}/tomas-${nn}`).toBe(`${VIDEOS}/tomas-${nn}`)
    })

    it(`${g} deja el vídeo pegado en videos-tutoriales`, () => {
      const fin = src.match(/final:\s*'([^']+)'/)
      expect(fin).toBeTruthy()
      /* ⚠ Y NO en `/tmp`, que se vacía al reiniciar. */
      expect(fin[1].startsWith(`${VIDEOS}/`), `${fin[1]} está fuera`).toBe(true)
      expect(fin[1]).toMatch(/\.mp4$/)
    })
  }

  it('⚠ `voz.mjs` sigue mirando ahí, que es de donde sale la regla', () => {
    const voz = readFileSync(resolve(process.cwd(), DIR, 'voz.mjs'), 'utf8')
    expect(voz).toMatch(/const VIDEOS = '\/home\/keyce\/Desktop\/videos-tutoriales'/)
    expect(voz).toMatch(/\$\{VIDEOS\}\/tomas-\$\{video\.slice\(0, 2\)\}/)
  })
})
