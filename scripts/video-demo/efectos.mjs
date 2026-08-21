// scripts/video-demo/efectos.mjs
//
// Los efectos que se le pueden pedir a una grabación de pantalla: acercarse a
// un detalle, subrayarlo, poner un rótulo, mover un cursor que se vea.
//
// ── POR QUÉ SE INYECTAN EN LA PÁGINA Y NO SE AÑADEN DESPUÉS ────────────────
//
// Un subrayado puesto en el montaje va pegado a un segundo, y en cuanto la
// pantalla cambia de sitio un botón, el recuadro queda señalando el vacío.
// Inyectado en la página va pegado al ELEMENTO: se mide en el DOM en el momento
// de grabar, así que sigue siendo correcto después de cualquier rediseño.
//
// ⚠ El zoom NO se hace con `transform` sobre el `body`: la aplicación tiene
//   barra de navegación y botón flotante en `position: fixed`, y un ancestro
//   transformado los saca de su sitio — se vería la pastilla flotando en mitad
//   de la pantalla. Se hace recortando y ampliando en el montaje (ffmpeg), con
//   las coordenadas que `apuntar()` va anotando durante la grabación.

const CSS = `
  #cf-capa { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; }

  /* ⚠ EL FOCO VA EN SU PROPIO ELEMENTO. Estaba junto al borde en un solo
     \`box-shadow\` con \`transition: all\`, y el navegador no interpolaba una
     sombra de 9999px: el resto de la pantalla no llegaba a oscurecerse nunca y
     el subrayado se leía como un borde suelto en vez de como un foco. */
  .cf-foco {
    position: fixed; border-radius: 16px; pointer-events: none; opacity: 0;
    box-shadow: 0 0 0 4000px rgba(10,12,18,.62);
    transition: left .45s cubic-bezier(.22,1,.36,1), top .45s cubic-bezier(.22,1,.36,1),
                width .45s cubic-bezier(.22,1,.36,1), height .45s cubic-bezier(.22,1,.36,1),
                opacity .3s ease;
  }
  .cf-halo {
    position: fixed; border-radius: 16px; pointer-events: none; opacity: 0;
    border: 3px solid #f5c518; box-shadow: 0 0 22px rgba(245,197,24,.75);
    transition: left .45s cubic-bezier(.22,1,.36,1), top .45s cubic-bezier(.22,1,.36,1),
                width .45s cubic-bezier(.22,1,.36,1), height .45s cubic-bezier(.22,1,.36,1),
                opacity .3s ease;
  }
  .cf-foco.on, .cf-halo.on { opacity: 1; }

  .cf-rotulo {
    position: fixed; left: 50%; transform: translateX(-50%);
    background: #0f1219; color: #fff; font-weight: 600;
    padding: 15px 22px; border-radius: 16px; max-width: 86%;
    font-size: 20px; line-height: 1.35; text-align: center;
    letter-spacing: -.01em;
    box-shadow: 0 14px 40px rgba(0,0,0,.6);
    opacity: 0; transition: opacity .3s ease;
  }
  .cf-rotulo.on { opacity: 1; }

  .cf-cursor {
    position: fixed; width: 28px; height: 28px; margin: -14px 0 0 -14px;
    border-radius: 50%; background: rgba(245,197,24,.35);
    border: 2px solid #f5c518; opacity: 0;
    transition: left .5s cubic-bezier(.22,1,.36,1), top .5s cubic-bezier(.22,1,.36,1),
                transform .18s ease, background .18s ease, opacity .3s ease;
  }
  .cf-cursor.on { opacity: 1; }
  .cf-cursor.pulsa { transform: scale(.65); background: rgba(245,197,24,.8); }
`


/** Prepara la página: capa de efectos y desactivar animaciones que estorban. */
export async function preparar(page) {
  await page.addStyleTag({ content: CSS })
  await page.evaluate(() => {
    if (document.getElementById('cf-capa')) return
    const capa = document.createElement('div')
    capa.id = 'cf-capa'
    capa.innerHTML =
      '<div class="cf-foco"></div><div class="cf-halo"></div>' +
      '<div class="cf-rotulo"></div><div class="cf-cursor"></div>'
    document.body.appendChild(capa)
  })
}

/** Rótulo abajo (o arriba, si el detalle está abajo). */
export async function rotular(page, texto, { arriba = false, ms = 0 } = {}) {
  await page.evaluate(({ texto, arriba }) => {
    const r = document.querySelector('.cf-rotulo')
    if (!r) return
    r.textContent = texto
    r.style.top = arriba ? '28px' : ''
    r.style.bottom = arriba ? '' : '110px'
    r.classList.add('on')
  }, { texto, arriba })
  if (ms) await page.waitForTimeout(ms)
}

export async function quitarRotulo(page) {
  await page.evaluate(() => document.querySelector('.cf-rotulo')?.classList.remove('on'))
}

/**
 * Subraya un elemento: halo dorado y el resto de la pantalla atenuado.
 * Devuelve su caja, que es lo que después usa el zoom del montaje.
 *
 * ⚠ MIDE PLAYWRIGHT, PINTA EL NAVEGADOR. Al principio le pasaba el selector al
 * `evaluate` y lo resolvía con `querySelector`, pero entonces solo valen
 * selectores CSS: `button:has-text("Cobrar")` es de Playwright y dentro del
 * navegador revienta. Aquí se localiza con `locator`, se mide con
 * `boundingBox()` y al navegador solo le llegan cuatro números.
 */
export async function subrayar(page, selector, { texto = null, ms = 1800, margen = 8, espera = 6000 } = {}) {
  const el = page.locator(selector).first()
  /* ⚠ ESPERA CORTA Y A PROPÓSITO. Con los 30 s que trae Playwright de fábrica,
     un subrayado que no encuentra su elemento se queda medio minuto quieto
     DENTRO DE LA GRABACIÓN: la toma de la verificación salió de 81 segundos en
     vez de 6, y como la llamada estaba en un `try` nadie se enteró. Un fallo
     así tiene que doler rápido. */
  await el.waitFor({ state: 'visible', timeout: espera })
  await el.scrollIntoViewIfNeeded().catch(() => {})
  await page.waitForTimeout(350)
  const caja = await el.boundingBox()
  if (!caja) throw new Error(`subrayar: no encuentro «${selector}» en pantalla`)

  await page.evaluate(({ caja, margen }) => {
    for (const sel of ['.cf-foco', '.cf-halo']) {
      const h = document.querySelector(sel)
      if (!h) continue
      h.style.left = `${caja.x - margen}px`
      h.style.top = `${caja.y - margen}px`
      h.style.width = `${caja.width + margen * 2}px`
      h.style.height = `${caja.height + margen * 2}px`
      h.classList.add('on')
    }
  }, { caja, margen })

  if (texto) await rotular(page, texto, { arriba: caja.y > 420 })
  if (ms) await page.waitForTimeout(ms)
  return { x: caja.x, y: caja.y, w: caja.width, h: caja.height }
}

export async function quitarSubrayado(page) {
  await page.evaluate(() => {
    for (const sel of ['.cf-foco', '.cf-halo', '.cf-rotulo']) {
      document.querySelector(sel)?.classList.remove('on')
    }
  })
}

/** Lleva el cursor sobre un elemento y lo pulsa, para que se vea el gesto. */
export async function tocar(page, selector, { pausa = 700 } = {}) {
  const el = page.locator(selector).first()
  await el.scrollIntoViewIfNeeded().catch(() => {})
  const caja = await el.boundingBox()
  if (!caja) throw new Error(`tocar: no encuentro «${selector}»`)
  const x = caja.x + caja.width / 2, y = caja.y + caja.height / 2

  await page.evaluate(({ x, y }) => {
    const c = document.querySelector('.cf-cursor')
    if (c) { c.style.left = `${x}px`; c.style.top = `${y}px`; c.classList.add('on') }
  }, { x, y })
  await page.waitForTimeout(600)
  await page.evaluate(() => document.querySelector('.cf-cursor')?.classList.add('pulsa'))
  await page.waitForTimeout(180)
  await page.evaluate(() => document.querySelector('.cf-cursor')?.classList.remove('pulsa'))
  await el.click().catch(() => {})
  await page.waitForTimeout(pausa)
  return { x, y }
}

/**
 * Anota «en el segundo N, acércate a esta caja». El montaje lo aplica después.
 * Se guarda el instante relativo al arranque de la grabación.
 */
export function apuntador(t0) {
  const marcas = []
  return {
    marcas,
    apuntar(caja, { dura = 2.2, escala = 1.9 } = {}) {
      marcas.push({ t: (Date.now() - t0) / 1000, dura, escala, ...caja })
    },
  }
}
