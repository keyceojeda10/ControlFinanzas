// lib/__tests__/errores-viejos-muertos.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El vigilante de errores destapó cuatro fallos que llevaban meses en el
// registro sin que nadie los mirara. Antes de tocarlos hubo que comprobar si
// seguían vivos — tocar código sano es como se rompen cosas sanas — y los
// cuatro estaban muertos: cada arreglo lleva la fecha del ÚLTIMO error.
//
//   95 × Cannot access 'tU' before initialization  · último 4 ago
//        → d35ce3ea, 4 ago 14:52 «Ordenar la ruta, otra vez»
//   16 × onCerrarVisita is not defined             · último 7 ago
//        → 3011772d, 7 ago 09:33 «no se recibía y mataba TODAS las rutas»
//    3 × tutorial is not defined                   · último 11 ago
//        → 94361cf5, 11 ago 08:34
//    1 × formatFechaCalendario is not defined      · último 5 ago
//        → c4ac7fc3, 5 ago 00:17 «una función usada sin importar»
//
// Esta prueba no revive los cuatro fallos: fija lo que los mataba, que es lo
// único que puede volver. Los tres primeros ya tienen su prueba propia; el
// cuarto la trajo en su commit (`funciones-sin-importar`).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

describe('⚠ los cuatro que el vigilante destapó siguen muertos', () => {
  it('`onCerrarVisita` es una prop declarada, no una variable del aire', () => {
    /* Se usaba sin recibirla, así que reventaba la fila entera y con ella TODAS
       las rutas. Es el patrón que este proyecto ya tiene fichado: el
       sub-componente usa una variable del padre sin que se la pasen. */
    const fila = leer('components/cf/ParadaDeCobro.jsx')
    const firma = fila.slice(fila.indexOf('export function FilaCobro({'), fila.indexOf('export function FilaCobro({') + 700)
    expect(firma, 'volvió a usarse sin declararla').toMatch(/onCerrarVisita/)
  })

  it('en la lista de tutoriales la variable del `map` se llama `t`', () => {
    /* Decía `tutorial.id` dentro de un `map` cuya variable es `t`. Solo en la
       rama de búsqueda —justo la que abre el enlace `?t=`—, así que la pantalla
       reventaba únicamente al llegar desde un enlace. */
    const lista = leer('components/TutorialesList.jsx')
    expect(lista, 'volvió `tutorial` donde la variable es `t`')
      .not.toMatch(/defaultOpen=\{[^}]*\btutorial\.id\b/)
  })

  it('`ModificarPlazo` importa lo que usa', () => {
    const m = leer('components/prestamos/ModificarPlazo.jsx')
    expect(m).toMatch(/import \{ formatFechaCalendario \} from '@\/lib\/i18n'/)
  })

  it('⚠ y en la ruta, los dos que leen `clientesFiltrados` van DESPUÉS', () => {
    /* Un `const` leído antes de existir revienta al pintar, y `next build`
       compila sin quejarse: el fallo solo aparece al ejecutar. La página de
       detalle de ruta dejó de abrir EN PRODUCCIÓN y los cobradores no pudieron
       trabajar. 95 veces en el registro. */
    const ruta = leer('app/(dashboard)/rutas/[id]/page.jsx')
    const declara = ruta.indexOf('const clientesFiltrados')
    const usa = ruta.indexOf('const reordenarPorNumero')
    expect(declara).toBeGreaterThan(0)
    expect(usa, '`reordenarPorNumero` volvió a subir por encima de `clientesFiltrados`').toBeGreaterThan(declara)
  })
})
