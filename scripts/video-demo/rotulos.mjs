// scripts/video-demo/rotulos.mjs
//
// Los rótulos se dibujan APARTE y se pegan encima en el montaje.
//
// ── POR QUÉ NO VAN DENTRO DE LA PÁGINA ─────────────────────────────────────
//
// Así estaban en la primera versión, y el dueño lo cazó viendo el vídeo: «a
// veces corta los subtítulos que pones, entonces es bastante extraño». La causa
// es que el acercamiento RECORTA la imagen, y si el rótulo está pintado dentro
// de la página se recorta con ella — media frase fuera del cuadro.
//
// Pegándolos después, encima del vídeo ya recortado:
//   · nunca se cortan, sea cual sea el zoom,
//   · caen SIEMPRE en el mismo sitio, que era la otra queja («se desencuadra un
//     poco a la izquierda, a la derecha, arriba o abajo»),
//   · y se pueden rehacer sin volver a grabar la pantalla.
//
// Se dibujan con el navegador y no con el `drawtext` de ffmpeg para poder usar
// la misma tipografía y el mismo redondeo que la aplicación.

import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const PLANTILLA = (texto, ancho) => `<!doctype html>
<meta charset="utf-8">
<style>
  html, body { margin: 0; background: transparent; }
  body {
    width: ${ancho}px;
    display: flex; justify-content: center;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  }
  .r {
    background: #0f1219; color: #fff;
    font-size: 40px; font-weight: 650; line-height: 1.32;
    letter-spacing: -.015em; text-align: center; text-wrap: balance;
    padding: 28px 40px; border-radius: 28px;
    max-width: ${Math.round(ancho * 0.86)}px;
    box-shadow: 0 18px 50px rgba(0,0,0,.55);
  }
</style>
<div class="r">${texto.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</div>`

/**
 * Dibuja cada rótulo como PNG con fondo transparente.
 * Devuelve [{ texto, fichero, alto }] — el alto hace falta para colocarlo.
 */
export async function dibujar(textos, { dir = '/tmp/cf-rotulos', ancho = 1080 } = {}) {
  mkdirSync(dir, { recursive: true })
  const nav = await chromium.launch()
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 400 } })
  const p = await ctx.newPage()
  const salida = []

  for (let i = 0; i < textos.length; i++) {
    const fichero = `${dir}/r${String(i).padStart(2, '0')}.png`
    await p.setContent(PLANTILLA(textos[i], ancho))
    await p.waitForTimeout(120)
    const caja = await p.locator('.r').boundingBox()
    // `omitBackground` deja el PNG con alfa: sin él, ffmpeg pega un rectángulo
    // blanco alrededor del rótulo.
    await p.locator('.r').screenshot({ path: fichero, omitBackground: true })
    salida.push({ texto: textos[i], fichero, alto: Math.round(caja.height), ancho: Math.round(caja.width) })
  }

  await nav.close()
  return salida
}
