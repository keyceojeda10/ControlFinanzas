import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { resolve, join } from 'path'
import { formatMoney, fijarPaisActivo, paisDeLaApp } from '@/lib/i18n'
import { abreviaturaDocumento, nombreDocumento, documentoParaMostrar } from '@/lib/documento'

// ── «¿DE VERDAD FUNCIONA CAMBIAR DE PAÍS?» ──────────────────────────────────
//
// La pregunta del dueño tras añadir el cono sur, y la respuesta era: a medias.
// Comprobado poniendo la organización del espejo en `ar` y luego en `py`:
//
//   ✅ los precios del plan          $82.000 ARS, no $259.000 COP
//   ✅ el registro                   validaba el teléfono argentino
//   ✅ el formulario de cliente      ya usaba `documentConfig.label` → «DNI»
//   ❌ 465 llamadas a `formatMoney`  sin país, caían a Colombia
//   ❌ 14 sitios con «CC» a fuego    un argentino veía «CC 12345678»
//
// Lo de `formatMoney` no se notaba en Argentina, Chile ni Uruguay porque
// comparten el símbolo `$`. En Paraguay sí: «$500.000» donde su moneda escribe
// «₲500.000». Medido en el espejo, antes y después.

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

describe('el país activo hace que las llamadas sin país acierten', () => {
  it('sin fijarlo, sigue cayendo a Colombia', () => {
    fijarPaisActivo(null)
    expect(paisDeLaApp()).toBe('co')
    expect(formatMoney(500000)).toBe('$500.000')
  })

  it('fijado, las 465 llamadas sin país aciertan', () => {
    fijarPaisActivo('py')
    expect(formatMoney(500000)).toBe('₲500.000')
    fijarPaisActivo('bo')
    expect(formatMoney(500000)).toBe('Bs 500.000')
    fijarPaisActivo(null)   // se deja como estaba para el resto de pruebas
  })

  it('un país que no existe no lo rompe', () => {
    fijarPaisActivo('zz')
    expect(paisDeLaApp()).toBe('co')
    fijarPaisActivo(null)
  })

  it('quien SÍ pasa el país sigue mandando', () => {
    /* El respaldo no pisa a nadie: `useCountry` y los endpoints lo pasan
       explícitamente y esos son los correctos. */
    fijarPaisActivo('py')
    expect(formatMoney(500000, 'co')).toBe('$500.000')
    fijarPaisActivo(null)
  })

  it('lo fija un componente de CLIENTE, nunca el layout servidor', () => {
    /* ⚠ En el servidor un valor de módulo se comparte entre peticiones: la de
       un negocio paraguayo y la de uno colombiano pasan por el mismo proceso,
       así que fijarlo allí haría que el segundo viera guaraníes. En el
       navegador no existe ese riesgo — cada pestaña es de una organización. */
    const comp = readFileSync(resolve(RAIZ, 'components/layout/PaisActivo.jsx'), 'utf8')
    expect(comp).toMatch(/^'use client'/)
    expect(comp).toMatch(/typeof window !== 'undefined'/)
    const layout = readFileSync(resolve(RAIZ, 'app/(dashboard)/layout.jsx'), 'utf8')
    expect(layout).toMatch(/<PaisActivo country=\{session\?\.user\?\.country \?\? 'co'\} \/>/)
    expect(layout, 'el layout servidor NO puede fijarlo por su cuenta')
      .not.toMatch(/fijarPaisActivo/)
  })
})

describe('el documento se llama como en cada país', () => {
  it('la abreviatura, que es la que va en las fichas', () => {
    fijarPaisActivo('ar'); expect(abreviaturaDocumento()).toBe('DNI')
    fijarPaisActivo('cl'); expect(abreviaturaDocumento()).toBe('RUT')
    fijarPaisActivo('co'); expect(abreviaturaDocumento()).toBe('CC')
    fijarPaisActivo(null)
  })

  it('y el nombre largo, para los rótulos', () => {
    fijarPaisActivo('ar'); expect(nombreDocumento()).toBe('DNI')
    fijarPaisActivo('bo'); expect(nombreDocumento()).toBe('Carnet de identidad')
    fijarPaisActivo(null)
  })

  it('⚠ los «SIN-» no se pintan como documento', () => {
    /* Cuando se carga un cliente sin cédula, el sistema le pone un `SIN-…` para
       no dejar el campo vacío. Cada uno de los catorce sitios lo comprobaba por
       su cuenta, y basta que uno se olvide para que un cobrador lea
       «CC SIN-a3f9b2» en la ficha. */
    expect(documentoParaMostrar('SIN-a3f9b2', 'co')).toBe(null)
    expect(documentoParaMostrar('', 'co')).toBe(null)
    expect(documentoParaMostrar(null, 'co')).toBe(null)
    expect(documentoParaMostrar('1034887', 'co')).toBe('CC 1034887')
    expect(documentoParaMostrar('12345678', 'ar')).toBe('DNI 12345678')
  })
})

describe('no quedan «CC» escritos a fuego', () => {
  it('en ninguna pantalla', () => {
    /* Eran catorce: tarjetas de cliente y préstamo, listas, líneas de crédito,
       socios, el pagaré, la hoja de ruta impresa, el recibo térmico, la imagen
       del recibo y la firma digital. Un argentino veía «CC» en todas. */
    const malos = []
    for (const p of [...jsxDe(resolve(RAIZ, 'app')), ...jsxDe(resolve(RAIZ, 'components'))]) {
      if (p.includes('estilo')) continue        // banco de pruebas
      const src = readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      for (const l of src.split('\n')) {
        if (/^\s*(\/\/|\*)/.test(l)) continue
        if (/\bCC \{|>CC:|`CC`|'CC'|"CC"/.test(l)) {
          malos.push(`${p.slice(RAIZ.length + 1)} → ${l.trim().slice(0, 60)}`)
        }
      }
    }
    expect(malos, `«CC» a fuego:\n  ${malos.join('\n  ')}`).toEqual([])
  })

  it('y el formulario de cliente ya lo hacía bien', () => {
    // Éste no hubo que tocarlo: usa `documentConfig` para el rótulo, el ejemplo
    // y hasta el tipo de teclado. Alguien lo hizo con cuidado.
    const src = readFileSync(resolve(RAIZ, 'components/clientes/ClienteForm.jsx'), 'utf8')
    // El rótulo pasó a un `<Etiqueta>` para poder colgarle el «opcional»; lo
    // que importa es que siga saliendo de `documentConfig`, no cómo se envuelve.
    expect(src).toMatch(/documentConfig\.label/)
    /* Se comprueba que el ejemplo SALE de `documentConfig`, no la frase exacta.
       El texto cambió al rediseñar —ahora empieza por «opcional», que es lo que
       pide T07-03— y esta prueba se cayó sin que la internacionalización se
       hubiera roto. Lo que no puede pasar es que el ejemplo vuelva a estar
       escrito a fuego. */
    expect(src).toMatch(/placeholder=\{`[^`]*\$\{documentConfig\.placeholder\}`\}/)
  })
})
