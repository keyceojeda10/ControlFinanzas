// lib/__tests__/vistas-de-informes.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Que la gente sepa qué es lo que va a descargar» — el dueño, 16 ago 2026.
//
// Eso solo se cumple si lo que baja es lo MISMO que está viendo, y la forma de
// garantizarlo no es cuidado al escribirlo tres veces: es que haya una sola
// descripción del informe —`vistaDe`— y que la pantalla, el PDF y el Excel se
// pinten desde ella.
//
// Lo que estas pruebas cuidan:
//
//   1. Que un informe se quede sin traducir y baje una hoja vacía sin avisar.
//   2. Que `vistaDe` calcule algo. Es un traductor: en cuanto sume un total,
//      esa cifra vive en dos sitios y empieza la cuenta atrás para que digan
//      cosas distintas — el patrón que llevo toda la semana arreglando.
//   3. Que una columna se quede sin `tipo`. De ahí sale que la pantalla escriba
//      «$1.500.000», el Excel 1500000 y el PDF «1.500.000»: tres papeles que no
//      se pueden cotejar.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { vistaDe, TIPOS } from '@/lib/reportes/vistas'
import { INFORMES } from '@/lib/reportes/catalogo'

/* Respuestas de cada API, con la forma real que devuelven hoy. */
const CRUDOS = {
  entro: {
    periodo: 'mes',
    totales: { recaudado: 3_142_001, interes: 830_380, capital: 2_311_621 },
    data: [{ fecha: '2026-08-01', total: 120_000, interes: 30_000, capital: 90_000 }],
  },
  calle: [
    { id: 'r1', ruta: 'Norte', cobrador: 'Ana', clientes: 12, capitalActivo: 4_000_000, saldoPendiente: 5_200_000, cuotaDiariaTotal: 180_000 },
    { id: 'r2', ruta: 'Sur', cobrador: 'Luis', clientes: 8, capitalActivo: 2_000_000, saldoPendiente: 2_500_000, cuotaDiariaTotal: 90_000 },
  ],
  'cobros-mes': {
    monthLabel: 'Agosto 2026', totalClientes: 2, granTotal: 300_000,
    rutas: [{ rutaId: 'r1', ruta: 'Norte', cobrador: 'Ana', totalRuta: 300_000, clientes: [
      { nombre: 'Juan', totalMes: 200_000, saldoPendiente: 50_000 },
      { nombre: 'Rosa', totalMes: 100_000, saldoPendiente: 0 },
    ] }],
  },
  dia: {
    fecha: '2026-08-16', organizacion: 'Mi negocio', rutas: [],
    resumen: { totalRecaudado: 320_000, totalEsperado: 400_000, totalGastos: 0, disponible: 320_000, tasaRecaudo: 80, pagosCount: 2, pendientesCount: 3 },
    pagos: [{ cliente: 'Juan', ruta: 'Norte', monto: 120_000, hora: '5:07 p. m.' }],
  },
  contador: {
    recaudado: 1_000_000, interes: 300_000, capitalRecuperado: 700_000,
    gastos: 50_000, utilidad: 250_000, porcentajeGastos: 16.7, utilidadSobreCapital: 35.7,
    meses: [{ mes: '2026-08', interes: 300_000, capital: 700_000, gastos: 50_000 }],
  },
  cuentas: {
    totales: { entradas: 900_000, salidas: 400_000, neto: 500_000 },
    cuentas: [
      { nombre: 'Nequi', entradas: 900_000, salidas: 400_000, neto: 500_000 },
      { nombre: 'Daviplata', entradas: 0, salidas: 0, neto: 0 },
    ],
    sinMovimiento: ['Daviplata'],
  },
  resumen: {
    clientes: { total: 40, enMora: 5 },
    prestamos: { activos: 50, completados: 10, carteraActiva: 9_000_000, saldoPorCobrar: 7_000_000, capitalEnCalle: 6_000_000 },
    pagos: { totalPeriodo: 2_000_000, cantidad: 30, interesGanado: 500_000, capitalRecuperado: 1_500_000 },
  },
  cobradores: [
    { id: 'c1', nombre: 'Ana', ruta: 'Norte', clientes: 12, totalEsperado: 500_000, totalRecogido: 450_000, totalGastos: 10_000, totalDesembolsado: 300_000, eficiencia: 90 },
  ],
  seguros: { totalGeneral: 250_000, cantGeneral: 5, items: [{ ruta: 'Norte', cantidad: 5, total: 250_000 }] },
  rendimiento: {
    kpis: { recaudadoMes: 2_000_000, gananciaNetaMes: 400_000, capitalEnCalle: 6_000_000 },
    rentabilidadPorRuta: [{ rutaNombre: 'Norte', capitalDesplegado: 4_000_000, interesGanado: 300_000, prestamos: 12 }],
  },

  /* Los cuatro volcados que eran `/reportes/bajar`. Su traductor no describe
     nada: las columnas llegan del API, del mismo sitio del que salen las hojas
     del Excel. Por eso el crudo de ejemplo TRAE columnas: sin ellas la vista
     devuelve vacío a propósito, que es lo correcto cuando el API falló. */
  cartera: {
    total: 2,
    columnas: [{ clave: 'cliente', rotulo: 'Cliente', tipo: 'texto' }, { clave: 'saldo', rotulo: 'Saldo', tipo: 'dinero' }],
    filas: [{ cliente: 'Ana', saldo: 300_000 }, { cliente: 'Beto', saldo: 120_000 }],
  },
  'volcado-clientes': {
    total: 1,
    columnas: [{ clave: 'nombre', rotulo: 'Nombre', tipo: 'texto' }, { clave: 'debe', rotulo: 'Debe hoy', tipo: 'dinero' }],
    filas: [{ nombre: 'Ana', debe: 300_000 }],
  },
  'volcado-pagos': {
    total: 1,
    periodo: { desde: '2026-08-01', hasta: '2026-08-16' },
    columnas: [{ clave: 'fecha', rotulo: 'Fecha', tipo: 'fecha' }, { clave: 'monto', rotulo: 'Monto', tipo: 'dinero' }],
    filas: [{ fecha: '01/08/2026', monto: 50_000 }],
  },
  'volcado-cobradores': {
    total: 1,
    columnas: [{ clave: 'nombre', rotulo: 'Cobrador', tipo: 'texto' }, { clave: 'rutas', rotulo: 'Rutas', tipo: 'texto' }],
    filas: [{ nombre: 'Ana', rutas: 'Norte' }],
  },
}

describe('⚠ los doce informes tienen traductor', () => {
  for (const informe of INFORMES) {
    it(`«${informe.titulo}» se traduce`, () => {
      const vista = vistaDe(informe.id, CRUDOS[informe.id] ?? {})
      expect(vista).toBeTruthy()
      expect(Array.isArray(vista.cifras)).toBe(true)
      expect(Array.isArray(vista.tabla.columnas)).toBe(true)
      expect(Array.isArray(vista.tabla.filas)).toBe(true)
    })
  }

  it('los que se ven traen cifras o tabla, no una hoja en blanco', () => {
    /* `listado-cobros` y `crudo` son papeles: no tienen vista y lo declaran.
       Los otros diez, si salen vacíos con datos de verdad, es que el traductor
       está mirando un campo que ya no existe. */
    for (const informe of INFORMES) {
      const vista = vistaDe(informe.id, CRUDOS[informe.id] ?? {})
      if (vista.soloDescarga) continue
      const tieneAlgo = vista.cifras.length > 0 || vista.tabla.filas.length > 0
      expect(tieneAlgo, `«${informe.titulo}» sale vacío con datos reales`).toBe(true)
    }
  })
})

describe('⚠ toda columna dice de qué tipo es', () => {
  it('y el tipo es uno de los conocidos', () => {
    for (const informe of INFORMES) {
      const { tabla } = vistaDe(informe.id, CRUDOS[informe.id] ?? {})
      for (const c of tabla.columnas) {
        expect(TIPOS, `«${informe.titulo}» → columna «${c.rotulo}» con tipo «${c.tipo}»`).toContain(c.tipo)
        expect(c.clave, `«${informe.titulo}» tiene una columna sin clave`).toBeTruthy()
        expect(c.rotulo, `«${informe.titulo}» tiene una columna sin rótulo`).toBeTruthy()
      }
    }
  })

  it('cada columna existe de verdad en sus filas', () => {
    /* Una clave mal escrita no da error: pinta la columna entera vacía. Solo se
       ve abriendo la pantalla, y por eso se comprueba aquí. */
    for (const informe of INFORMES) {
      const { tabla } = vistaDe(informe.id, CRUDOS[informe.id] ?? {})
      if (!tabla.filas.length) continue
      for (const c of tabla.columnas) {
        expect(Object.prototype.hasOwnProperty.call(tabla.filas[0], c.clave),
          `«${informe.titulo}» → la columna «${c.rotulo}» pide «${c.clave}» y la fila no lo trae`).toBe(true)
      }
    }
  })
})

describe('⚠ el traductor NO calcula del negocio', () => {
  const fuente = readFileSync(resolve(process.cwd(), 'lib/reportes/vistas.js'), 'utf8')

  it('no consulta la base', () => {
    expect(fuente).not.toMatch(/prisma|findMany|aggregate|queryRaw/)
  })

  it('no importa nada de cálculo', () => {
    /* Sumar aquí sería poner esa cifra en un segundo sitio. Las sumas que hay
       —`suma('saldoPendiente')`— son de las filas que el API ya mandó, para el
       encabezado; no vuelven a mirar préstamos ni pagos. */
    expect(fuente).not.toMatch(/from '@\/lib\/calculos'/)
    expect(fuente).not.toMatch(/from '@\/lib\/dinero/)
  })
})

describe('las cifras del encabezado salen de lo que mandó el API', () => {
  it('«Lo que entró» respeta los totales tal cual', () => {
    const v = vistaDe('entro', CRUDOS.entro)
    expect(v.cifras.map((c) => c.valor)).toEqual([3_142_001, 830_380, 2_311_621])
  })

  it('«Movimientos por cuenta» esconde las quietas pero las nombra', () => {
    const v = vistaDe('cuentas', CRUDOS.cuentas)
    expect(v.tabla.filas).toHaveLength(1)
    expect(v.tabla.filas[0].nombre).toBe('Nequi')
    expect(v.nota).toMatch(/Daviplata/)
  })

  it('«Para el contador» calla el porcentaje cuando no se puede calcular', () => {
    /* Escribir 0% en una hoja que va al contador es peor que dejar el hueco. */
    const v = vistaDe('contador', { ...CRUDOS.contador, porcentajeGastos: null, utilidadSobreCapital: null })
    expect(v.nota).toBeNull()
  })

  it('un informe desconocido no revienta', () => {
    expect(vistaDe('no-existe', {}).tabla.filas).toEqual([])
  })
})
