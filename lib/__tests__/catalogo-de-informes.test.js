// lib/__tests__/catalogo-de-informes.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Hay reportes por todos lados. Hay reportes en caja, hay reportes en
//  reportes, hay reportes en cómo va el negocio. Unos están abajo, otros arriba
//  en cabecera, otros al lado de los títulos. Si la gente va a buscar un reporte
//  específico, de pronto ni siquiera está en el apartado de reportes.»
//   — el dueño, 16 ago 2026, leyendo la sugerencia de Préstamos Rincón.
//
// Contado antes de tocar nada: OCHO descargas en SIETE pantallas, más ocho
// informes que solo se ven. El catálogo las junta en una definición.
//
// ⚠ ESTA ES LA PRUEBA QUE HACE MECÁNICA LA MUDANZA. Al fundir dos pantallas en
//   una, la forma de fallar no es que reviente: es que una descarga se quede sin
//   renglón y nadie lo note hasta que un cliente la busque. Aquí está la lista
//   completa de lo que había, y si algo no tiene sitio, falla.
//
// Lo que NO entra —y no es un olvido—: el pagaré, el recibo y la hoja de la
// ruta. Son documentos de un caso: se piden estando con el cliente delante, no
// se buscan a ciegas.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { INFORMES, PERIODOS, informesDelPlan, informeBloqueado, buscarInforme } from '@/lib/reportes/catalogo'

/* Las ocho descargas que existían repartidas, con el endpoint que las genera.
   Es la tabla del plan, escrita como comprobación. */
const LO_QUE_HABIA = [
  ['resumen del negocio',      '/api/reportes/resumen-pdf'],
  ['listado de cobros',        '/api/reportes/listado-cobros'],
  ['exportaciones en Excel',   '/api/reportes/exportar'],
  ['rendimiento',              '/api/dashboard/analiticas/reporte-pdf'],
  ['pagos del día',            '/api/pagos/export'],
]

describe('⚠ ninguna descarga se quedó sin sitio', () => {
  const todos = INFORMES.map((i) => `${i.ver ?? ''} ${i.bajar ?? ''}`).join(' ')

  for (const [nombre, endpoint] of LO_QUE_HABIA) {
    it(`«${nombre}» tiene su renglón`, () => {
      expect(todos, `${endpoint} no aparece en ningún informe del catálogo`).toContain(endpoint)
    })
  }

  it('y los que solo se veían también', () => {
    for (const e of ['cartera', 'cobros-mes', 'dia', 'ingresos', 'cobradores', 'seguros']) {
      expect(todos, `falta /api/reportes/${e}`).toContain(`/api/reportes/${e}`)
    }
  })
})

describe('el catálogo está bien escrito', () => {
  it('cada informe dice qué contesta, en una línea', () => {
    for (const i of INFORMES) {
      expect(i.contesta, `«${i.titulo}» no dice qué contesta`).toBeTruthy()
      // Una línea: si hace falta un párrafo, el informe no está claro.
      expect(i.contesta.length, `«${i.titulo}» se explica demasiado largo`).toBeLessThan(90)
    }
  })

  it('los identificadores no se repiten', () => {
    const ids = INFORMES.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todos los períodos que nombran existen', () => {
    const validos = Object.values(PERIODOS).map((p) => p.id)
    for (const i of INFORMES) {
      expect(i.periodos.length, `«${i.titulo}» no ofrece ningún período`).toBeGreaterThan(0)
      for (const p of i.periodos) expect(validos, `«${i.titulo}» pide «${p}»`).toContain(p)
    }
  })

  it('⚠ el que no se ve ni se baja está marcado como pendiente', () => {
    /* Un renglón sin nada detrás es un botón muerto — el fallo que esta app ya
       tuvo cuatro veces. Si no hace nada todavía, que lo diga. */
    for (const i of INFORMES) {
      if (!i.ver && !i.bajar) expect(i.pendiente, `«${i.titulo}» no lleva a ningún sitio y no está marcado`).toBe(true)
    }
  })

  it('⚠ toda pantalla que nombra EXISTE en el disco', () => {
    /* Escribí la primera versión con `/reportes/entro`, `/reportes/calle` y
       cuatro más que me inventé pensando en cómo quedaría la pantalla nueva.
       Ninguna existía: habrían sido seis renglones llevando a un 404. Esta
       prueba lo mira contra el disco, no contra mi memoria. */
    for (const i of INFORMES) {
      if (!i.pantalla) continue
      const ruta = resolve(process.cwd(), `app/(dashboard)${i.pantalla}/page.jsx`)
      expect(existsSync(ruta), `«${i.titulo}» apunta a ${i.pantalla} y no existe`).toBe(true)
    }
  })

  it('los dos que pidió Rincón están, aunque falten por construir', () => {
    expect(buscarInforme('contador')).toBeTruthy()
    expect(buscarInforme('cuentas')).toBeTruthy()
  })
})

describe('⚠ el escalado por plan se respeta', () => {
  it('con plan Básico (nivel 1) se abren los de todos los días', () => {
    const suyos = informesDelPlan(1).map((i) => i.id)
    // Los que Préstamos Rincón usa: es cliente de Básico.
    for (const id of ['entro', 'calle', 'cobros-mes', 'contador', 'cuentas']) {
      expect(suyos, `«${id}» debería estar en Básico`).toContain(id)
    }
  })

  it('y los de plan mayor NO se abren', () => {
    expect(informeBloqueado(buscarInforme('rendimiento'), 1)).toBe(true)
    expect(informeBloqueado(buscarInforme('cobradores'), 1)).toBe(true)
  })

  it('⚠ pero SIGUEN en la lista, para saber qué se está perdiendo', () => {
    /* Esconderlos deja al prestamista sin enterarse de que existen, y esta
       pantalla es justo donde se decide subir de plan. */
    expect(INFORMES.map((i) => i.id)).toContain('rendimiento')
  })
})

describe('⚠ el índice lleva al informe, no a su pantalla', () => {
  /* Mandar a `/reportes` a quien pidió «los cobros del mes» lo deja arriba de
     3.700 píxeles buscando otra vez — que es la queja entera. Por eso cada
     renglón arrastra su ancla, y por eso el ancla tiene que EXISTIR: si no,
     el enlace no falla, sencillamente no se mueve, y nadie se entera. */
  const FUENTES = [
    'app/(dashboard)/reportes/page.jsx',
    'components/pantallas/Bajar.jsx',
  ].map((r) => readFileSync(resolve(process.cwd(), r), 'utf8')).join('\n')

  for (const i of INFORMES.filter((x) => x.ancla)) {
    it(`«${i.titulo}» tiene su ancla puesta`, () => {
      expect(FUENTES, `falta id="informe-..." para ${i.id}`)
        .toContain(`id="${i.ancla.slice(1)}"`)
    })
  }

  it('el índice está montado en la pantalla', () => {
    const pantalla = readFileSync(resolve(process.cwd(), 'app/(dashboard)/reportes/page.jsx'), 'utf8')
    expect(pantalla).toMatch(/<IndiceDeInformes nivel=\{nivel\}/)
  })

  it('⚠ y NO pinta los que todavía no existen', () => {
    /* «Para el contador» y «Movimientos por cuenta» están declarados porque los
       pidió Rincón y entran en la tanda 2. Pintarlos ya sería un renglón que no
       lleva a ningún sitio. */
    const indice = readFileSync(resolve(process.cwd(), 'components/reportes/IndiceDeInformes.jsx'), 'utf8')
    expect(indice).toMatch(/INFORMES\.filter\(\(i\) => !i\.pendiente\)/)
  })
})
