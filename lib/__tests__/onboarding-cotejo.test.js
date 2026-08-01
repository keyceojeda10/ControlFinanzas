import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { tramosDePlan, limiteInicial } from '../adaptadores/planes.js'
import { PLANES_CONFIG, DIAS_PRUEBA, getPrecioPlan } from '../planes.js'

const RAIZ = join(process.cwd())
const onboarding = readFileSync(join(RAIZ, 'components/pantallas/Onboarding.jsx'), 'utf8')

/* ══════════════════════════════════════════════════════════════════════════
   Lo que estas pruebas defienden

   La lámina T37-02 trae CUATRO cifras falsas juntas: «30 días» (son 14), «pases
   de 20 clientes» (son 100) y los tramos 20/40/100 (son 100/450/1.000). En el
   intento anterior las copié tal cual y las shipeé — o sea el producto vendido
   cinco veces peor de lo que es, prometiendo el doble de prueba de la que hay.

   Ninguna prueba de las que había lo habría visto: el componente era correcto y
   el dato era falso. Así que estas pruebas no comprueban aritmética, comprueban
   PROCEDENCIA — que la pantalla no pueda escribir un número de plan a mano.
   ══════════════════════════════════════════════════════════════════════════ */

describe('las cifras del plan no se escriben en la pantalla', () => {
  it('ninguna de las cuatro cifras falsas de la lámina está en el código', () => {
    // El cuerpo, sin los comentarios: los comentarios SÍ citan «30 días» y
    // «hasta 20» porque documentan el error, y una aserción negativa que tropieza
    // con mi propia prosa es un falso positivo que ya me pasó siete veces.
    const cuerpo = onboarding
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

    // Buscadas como cifras en JSX o en cadena, no como subcadena suelta: «30»
    // aparece legítimamente en un `maxWidth: '30ch'`.
    expect(cuerpo).not.toMatch(/>\s*30\s+d[ií]as/i)
    expect(cuerpo).not.toMatch(/(GRATIS|Gratis)\s+30/)
    expect(cuerpo).not.toMatch(/pases de\s+20\b/)
    expect(cuerpo).not.toMatch(/[Hh]asta\s+(20|40|100)\s*(clientes)?\s*['"<]/)

    // Y ningún precio literal: si un precio se escribe aquí, el día que suba
    // esta pantalla miente y el resto de la app no.
    expect(cuerpo).not.toMatch(/\$?\s*(39|59|79)\.000/)
  })

  it('los días de prueba llegan por prop, no como literal', () => {
    // Los tres sitios donde la lámina escribe «30 días» usan la misma variable.
    expect(onboarding).toMatch(/Usa la app completa \{dias\} d[ií]as/)
    expect(onboarding).toMatch(/Gratis \{dias\} d[ií]as/)
  })

  it('el tope de clientes llega por prop', () => {
    expect(onboarding).toMatch(/pases de \{limite\} clientes/)
  })
})

describe('lo que el adaptador le da a T37-02', () => {
  const formatear = (n) => `$${n.toLocaleString('es-CO')}`
  const tramos = tramosDePlan('co', formatear)

  it('son tres tramos y traen los topes reales de PLANES_CONFIG', () => {
    expect(tramos).toHaveLength(3)
    for (const t of tramos) {
      expect(t.limite).toBe(PLANES_CONFIG[t.id].maxClientes)
      expect(t.precio).toBe(formatear(getPrecioPlan(t.id, 'co')))
    }
  })

  it('el primer tope es de tres cifras, no 20 — es lo que la lámina se inventa', () => {
    // Sin fijar el valor: si mañana el plan Inicial pasa a 150, la prueba sigue
    // valiendo. Lo que no puede volver es un tope de dos dígitos, que es lo que
    // hace que alguien con 68 clientes en un cuaderno crea que no le caben.
    expect(tramos[0].limite).toBeGreaterThanOrEqual(100)
    expect(limiteInicial()).toBe(tramos[0].limite)
  })

  it('van de menor a mayor: es una escalera, no un catálogo', () => {
    const topes = tramos.map((t) => t.limite)
    expect([...topes].sort((a, b) => a - b)).toEqual(topes)
  })

  it('«clientes» sale solo en el primero — repetirlo estrecha el precio', () => {
    expect(tramos[0].techoBreve).toMatch(/clientes$/)
    expect(tramos[1].techoBreve).not.toMatch(/clientes/)
    expect(tramos[2].techoBreve).not.toMatch(/clientes/)
    // Pero el techo completo sigue existiendo, porque T10-01 lo usa entero.
    expect(tramos[1].techo).toMatch(/clientes$/)
  })

  it('el techo lleva el separador de miles del país, no el crudo', () => {
    const mil = tramos.find((t) => t.limite >= 1000)
    if (mil) expect(mil.techoBreve).toMatch(/1\.000/)
  })
})

describe('los días de prueba tienen una sola fuente', () => {
  it('DIAS_PRUEBA es el que aplica el endpoint de registro', () => {
    const ruta = readFileSync(join(RAIZ, 'app/api/auth/registro/route.js'), 'utf8')
    // Sin comentarios: los de esa ruta CITAN el `+ 14` que se quitó, para dejar
    // dicho qué estaba mal. Es la octava vez que una aserción negativa tropieza
    // con mi propia prosa en vez de con el código.
    const codigo = ruta
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

    expect(codigo).toMatch(/DIAS_PRUEBA/)
    expect(codigo).not.toMatch(/\+\s*14\b/)
  })

  it('el fin de la prueba se calcula una vez y se reusa', () => {
    const ruta = readFileSync(join(RAIZ, 'app/api/auth/registro/route.js'), 'utf8')
    const codigo = ruta
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

    // Un solo `setDate(... + DIAS_PRUEBA)` en todo el archivo. Había tres: la
    // columna de la organización, la de la suscripción y la del correo — y la del
    // correo se recalculaba después de la transacción, así que podía cruzar la
    // medianoche y prometerle al usuario un día distinto del que quedó guardado.
    const cuentas = codigo.match(/\+\s*DIAS_PRUEBA/g) ?? []
    expect(cuentas).toHaveLength(1)

    // Y el correo lee la fecha que devolvió la transacción.
    expect(codigo).toMatch(/fechaVencimiento:\s*resultado\.vencimiento/)
  })

  it('y es el mismo que el bot le dice al cliente por WhatsApp', () => {
    const contexto = readFileSync(join(RAIZ, 'lib/bot/prompts/contexto.js'), 'utf8')
    expect(contexto).toMatch(/diasPrueba:\s*DIAS_PRUEBA/)
  })

  it('DIAS_PRUEBA es un entero positivo', () => {
    expect(Number.isInteger(DIAS_PRUEBA)).toBe(true)
    expect(DIAS_PRUEBA).toBeGreaterThan(0)
  })
})

describe('la forma que la lámina sí manda', () => {
  it('la tarjeta del $0 va carbón, no dorada: el dorado es la acción', () => {
    // Si esa tarjeta fuera dorada habría dos focos en la pantalla y el botón
    // «Cargar mi cartera» —que es el paso que decide si el negocio se queda—
    // dejaría de ser el único sitio donde mirar.
    expect(onboarding).toMatch(/const CARBON = '#15161A'/)
    expect(onboarding).toMatch(/background: CARBON, borderRadius: 20/)
  })

  it('la acción dorada es cargar la cartera, no «continuar»', () => {
    expect(onboarding).toMatch(/Cargar mi cartera/)
    expect(onboarding).toMatch(/Pagar un plan desde ya/)
  })

  it('la de éxito manda a cobrar, no al panel', () => {
    expect(onboarding).toMatch(/Ver los \$\{cobrosHoy\} cobros de hoy/)
  })

  it('el progreso son segmentos, no una barra con porcentaje', () => {
    // Una barra al 75% obliga a estimar cuántos pasos quedan; cuatro trozos se
    // cuentan de un golpe.
    expect(onboarding).toMatch(/function Segmentos/)
    expect(onboarding).not.toMatch(/width:\s*`\$\{.*100\)\}%`/)
  })

  it('las barras de progreso no se encogen (regla 3)', () => {
    const seg = onboarding.slice(onboarding.indexOf('function Segmentos'))
    expect(seg.slice(0, 600)).toMatch(/flexShrink: 0/)
  })

  it('el campo del teléfono es controlado y no es type=number', () => {
    // `type=number` rechaza el separador que no coincide con el locale del
    // teléfono, y las flechas de incremento no sirven para un móvil.
    expect(onboarding).toMatch(/value=\{numero \?\? ''\}/)
    expect(onboarding).not.toMatch(/type="number"/)
    expect(onboarding).toMatch(/type="tel"/)
  })

  it('no hay emojis: los iconos son SVG', () => {
    expect(onboarding).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u)
  })
})

describe('los cuatro pasos del arranque (T01)', () => {
  const arranque = readFileSync(join(RAIZ, 'components/pantallas/Arranque.jsx'), 'utf8')

  it('cada paso tiene su salida', () => {
    // Un arranque que no se puede saltar se abandona. Las tres frases son de la
    // lámina y cada una está en su paso.
    expect(arranque).toMatch(/Ya conozco el sistema, saltar/)
    expect(arranque).toMatch(/Lo registro después/)
    expect(arranque).toMatch(/Empezar con la cartera vacía/)
  })

  it('el paso del capital dice la consecuencia de dejarlo en cero', () => {
    // La advertencia es prop: el texto exacto lo pone quien cablea, pero el hueco
    // tiene que existir o el aviso desaparece.
    expect(arranque).toMatch(/advertencia/)
  })

  it('el campo del capital no es type=number', () => {
    // Doce países, dos convenios de miles: `type=number` rechaza el separador que
    // no coincide con el locale del teléfono.
    const cap = arranque.slice(arranque.indexOf('export function ArranqueCapital'))
    expect(cap).toMatch(/type="text" inputMode="decimal"/)
    expect(cap).not.toMatch(/type="number"/)
  })

  it('la cifra de «19 de cada 20» no está escrita en el código', () => {
    const cuerpo = arranque
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    // No está verificada contra la base. Si no llega por prop, no se afirma.
    expect(cuerpo).not.toMatch(/19 de cada 20/)
  })

  it('las barras de progreso no se encogen (regla 3)', () => {
    expect(arranque).toMatch(/flexShrink: 0/)
  })
})

describe('la revisión del OCR — T01-04, «donde se abandona»', () => {
  const revision = readFileSync(join(RAIZ, 'components/pantallas/RevisionCarga.jsx'), 'utf8')
  const wizard = readFileSync(join(RAIZ, 'components/onboarding/wizard/WizardExcel.jsx'), 'utf8')

  it('el campo de corrección es controlado', () => {
    // Era `defaultValue=""`: el padre no podía prellenar lo que el OCR leyó a
    // medias, que es justo lo que la lámina dibuja («1 0 3 4 …»).
    expect(revision).toMatch(/value=\{r\.valor \?\? ''\}/)
    const cuerpo = revision.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(cuerpo).not.toMatch(/defaultValue=/)
  })

  it('lo que se corrige a mano llega a lo que se importa', () => {
    // EL BUG: el wizard construía la importación desde `filasEscaladas()` y no
    // pasaba `onCorregir`, así que se escribía la cédula que faltaba, se pulsaba
    // «crear los N clientes» y el cliente entraba sin ella.
    expect(wizard).toMatch(/onCorregir=\{corregir\}/)
    expect(wizard).toMatch(/aCargaMasiva\(filasCorregidas\(\)/)
  })

  it('el reparo no desaparece mientras se escribe', () => {
    // Si `adaptarRevision` viera las filas ya corregidas, la tarjeta se cerraría
    // en la primera tecla y el campo se iría de la pantalla.
    expect(wizard).toMatch(/adaptarRevision\(\{ \.\.\.lectura, filas: filasEscaladas\(\) \}/)
    expect(wizard).toMatch(/revisar: f\.revisar && !resuelta/)
  })

  it('cada cliente es su propia tarjeta y la que se revisa lleva anillo', () => {
    // En una lista con divisores no se puede resaltar una fila, y el trabajo aquí
    // es encontrar las dos de siete que están mal.
    expect(revision).toMatch(/border: abierto \? '1\.5px solid var\(--cf-gold\)'/)
    expect(revision).toMatch(/boxShadow: abierto \?/)
  })

  it('la primera con reparos arranca abierta y se puede cerrar a mano', () => {
    expect(revision).toMatch(/primeraConReparos/)
    // `-1` distingue «la cerró» de «no ha tocado nada»; sin eso volvería a abrirse.
    expect(revision).toMatch(/setAbierta\(activa === i \? -1 : i\)/)
  })
})
