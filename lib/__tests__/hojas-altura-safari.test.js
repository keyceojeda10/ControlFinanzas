import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { resolve, join } from 'path'

// ── `vh` NO SIRVE PARA UNA HOJA EN EL SAFARI DEL IPHONE ────────────────────
//
// `100vh` es la altura del viewport SIN la barra de herramientas del navegador.
// En Safari de iPhone esa barra está ahí casi siempre, así que `90vh` es MÁS
// ALTO que lo que se ve, y una hoja anclada a un borde se extiende por fuera.
//
// Se reportó dos veces el mismo día, con captura, y con dos síntomas distintos:
//
//   · la hoja de plantillas de WhatsApp — anclada abajo: se salía el PIE, y el
//     botón verde de «Abrir WhatsApp» solo asomaba el borde;
//   · el modal de «Generar comprobante» — también anclado abajo (`items-end`),
//     así que lo que se salía era lo de ARRIBA: la cabecera con la X. Un modal
//     del que no se puede salir.
//
// `dvh` es la altura dinámica —la que de verdad queda— y se reajusta cuando la
// barra aparece y desaparece. El `vh` se deja DELANTE como respaldo: quien no
// entienda `dvh` se queda con el comportamiento de antes en vez de sin tope.

const RAIZ = process.cwd()

function jsxDe(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next') continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) jsxDe(p, acc)
    else if (e.endsWith('.jsx')) acc.push(p)
  }
  return acc
}

describe('el modal de la app', () => {
  const modal = readFileSync(resolve(RAIZ, 'components/ui/Modal.jsx'), 'utf8')

  it('se acota con `dvh`, no solo con `vh`', () => {
    // Por aquí pasan TODOS los modales, así que es el arreglo que más cubre.
    expect(modal).toMatch(/max-h-\[90vh\] max-h-\[90dvh\]/)
  })

  it('y su cabecera con la X no se puede encoger', () => {
    /* `shrink-0`: es la única salida del modal. Si se encoge o se sale, el
       usuario se queda dentro sin poder cerrar. */
    // `id="cf-modal-title"`, no la cadena a secas: aparece antes en el
    // `aria-labelledby`, que está fuera de la cabecera.
    const i = modal.indexOf('id="cf-modal-title"')
    expect(i).toBeGreaterThan(-1)
    expect(modal.slice(Math.max(0, i - 400), i)).toMatch(/shrink-0/)
  })
})

describe('la hoja de plantillas de WhatsApp', () => {
  const hoja = readFileSync(resolve(RAIZ, 'components/whatsapp/HojaWhatsApp.jsx'), 'utf8')
  /* Sin comentarios: el de arriba del archivo CITA «el botón que manda es
     "Abrir WhatsApp", abajo», así que el `indexOf` caía en el comentario y no
     en el botón. Van cinco veces hoy con este mismo patrón. */
  const plantillas = readFileSync(resolve(RAIZ, 'components/pantallas/Plantillas.jsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? '' : l)).join('\n')

  it('se acota con `dvh`', () => {
    expect(hoja).toMatch(/max-h-\[92vh\] max-h-\[92dvh\]/)
  })

  it('y su botón reserva la zona segura del teléfono', () => {
    /* Con 24px clavados, el botón queda debajo de la barra de Safari o de la
       raya del gesto de inicio. */
    // Se ancla en el botón, que es lo que se estaba quedando tapado.
    const i = plantillas.indexOf('Abrir WhatsApp')
    expect(i).toBeGreaterThan(-1)
    expect(plantillas.slice(Math.max(0, i - 1800), i))
      .toMatch(/env\(safe-area-inset-bottom/)
  })
})

describe('ninguna hoja anclada a un borde se mide solo en `vh`', () => {
  it('en toda la app', () => {
    /* Una hoja o modal es lo que se ancla a un borde de la pantalla. Si su
       altura sale de `vh` a secas, en el iPhone se sale por el lado contrario
       al que está anclada — y con ella, su salida.

       Las listas internas con scroll no entran: van dentro de un contenedor que
       ya está acotado, y perder unos píxeles ahí no deja a nadie encerrado. */
    const malas = []
    for (const p of [...jsxDe(resolve(RAIZ, 'components')), ...jsxDe(resolve(RAIZ, 'app'))]) {
      const src = readFileSync(p, 'utf8')
      for (const linea of src.split('\n')) {
        const m = linea.match(/max-h-\[(\d+)vh\]/)
        if (!m) continue
        if (linea.includes(`${m[1]}dvh`)) continue
        // ¿es una hoja? se ancla a un borde o se centra como diálogo
        if (!/inset-0|bottom-0|fixed|mt-auto|m-auto|items-end/.test(linea)) continue
        malas.push(`${p.slice(RAIZ.length + 1)} → ${linea.trim().slice(0, 80)}`)
      }
    }
    expect(malas, `hojas medidas solo en vh:\n  ${malas.join('\n  ')}`).toEqual([])
  })
})
