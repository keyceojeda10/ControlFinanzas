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
// barra aparece y desaparece.
//
// ⚠ Y AQUÍ ESTÁ LA CORRECCIÓN DEL 31 AGO 2026, QUE ES LO IMPORTANTE.
//
// El arreglo original ponía las DOS clases juntas, «vh» delante como respaldo:
// se creía que la segunda pisa a la primera. En CSS no manda el orden de las
// clases en el atributo, manda el orden en la HOJA — y Tailwind emite la de
// «dvh» ANTES que la de «vh». Misma especificidad, gana la última: mandaba el
// «vh», que era justo el que se quería evitar.
//
// Así que ESTE FICHERO PASÓ EN VERDE MESES CON EL FALLO VIVO: comprobaba que
// las dos clases estuvieran escritas, no cuál de las dos aplicaba. El dueño lo
// volvió a fotografiar en «Renovar el préstamo» y «Cambiar el modo de cobro».
//
// Ahora el par está PROHIBIDO. Las cáscaras compartidas (`Modal`, `BottomSheet`,
// `HojaInferior`) usan un token con `@supports`, donde el orden lo controlamos
// nosotros; las demás llevan «dvh» a secas, que es lo que aplican de todas
// formas los navegadores desde 2022.

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

  it('se acota con un token que decide con `@supports`', () => {
    // Por aquí pasan TODOS los modales, así que es el arreglo que más cubre.
    expect(modal).toMatch(/maxHeight: 'var\(--cf-alto-modal\)'/)
    const tokens = readFileSync(resolve(RAIZ, 'app/tokens-2026.css'), 'utf8')
    const i = tokens.indexOf('@supports (height: 1dvh)')
    expect(i).toBeGreaterThan(-1)
    // el respaldo en `vh` va ANTES; si no, el `@supports` no pisa nada
    expect(tokens.indexOf('--cf-alto-modal: 90vh')).toBeLessThan(i)
    expect(tokens.slice(i, i + 260)).toMatch(/--cf-alto-modal: 90dvh/)
  })

  it('y su cabecera con la X no se puede encoger', () => {
    /* `shrink-0`: es la única salida del modal. Si se encoge o se sale, el
       usuario se queda dentro sin poder cerrar. */
    // `id="cf-modal-title"`, no la cadena a secas: aparece antes en el
    // `aria-labelledby`, que está fuera de la cabecera.
    /* ⚠ SE BUSCA LA CABECERA, NO UNA VENTANA DE 400 CARACTERES. Al meter la
       flecha de volver (31 ago) el `shrink-0` quedó más arriba de esa ventana y
       la prueba cayó con el código correcto. Se ancla en la fila de la
       cabecera, que es lo que de verdad no puede encogerse. */
    const i = modal.indexOf('id="cf-modal-title"')
    expect(i).toBeGreaterThan(-1)
    const cabecera = modal.lastIndexOf('<div className="flex items-center', i)
    expect(cabecera).toBeGreaterThan(-1)
    expect(modal.slice(cabecera, i)).toMatch(/shrink-0/)
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
    expect(hoja).toMatch(/max-h-\[92dvh\]/)
    expect(hoja).not.toMatch(/max-h-\[92vh\]/)
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
        /* ⚠ AQUÍ DECÍA `if (linea.includes(dvh)) continue`, y por eso esta red
           dejaba pasar el fallo: el par «vh + dvh» en la misma línea ES el
           patrón roto, porque Tailwind emite el «dvh» antes y gana el «vh».
           Ahora el par no exime de nada; solo exime no medir en `vh`. */
        // ¿es una hoja? se ancla a un borde o se centra como diálogo
        if (!/inset-0|bottom-0|fixed|mt-auto|m-auto|items-end/.test(linea)) continue
        malas.push(`${p.slice(RAIZ.length + 1)} → ${linea.trim().slice(0, 80)}`)
      }
    }
    expect(malas, `hojas medidas solo en vh:\n  ${malas.join('\n  ')}`).toEqual([])
  })
})
