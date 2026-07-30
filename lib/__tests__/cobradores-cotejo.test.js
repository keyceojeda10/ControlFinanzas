import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  efectividadDe, tonoEfectividad, entregaEnEfectivo,
  agrupaCobradores, miDia, miSemana,
} from '../adaptadores/cobradores.js'

const pesos = (n) => `$${(Number(n) || 0).toLocaleString('es-CO')}`
const comp = readFileSync(join(process.cwd(), 'components/pantallas/Cobradores.jsx'), 'utf8')
const api = readFileSync(join(process.cwd(), 'app/api/cobradores/route.js'), 'utf8')
const cuerpo = comp.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('efectividad: plata sobre plata, y a veces no existe', () => {
  it('es lo recogido sobre lo esperado', () => {
    // T36-03 la define: «$188.000 de $235.000 → 80%».
    expect(efectividadDe(188000, 235000)).toBe(80)
  })

  it('sin nada esperado NO es cero, es que no existe', () => {
    // Un 0% rojo por un domingo o un día sin cobro es una acusación falsa.
    expect(efectividadDe(0, 0)).toBeNull()
    expect(efectividadDe(50000, 0)).toBeNull()
  })

  it('no baja de cero aunque los datos vengan raros', () => {
    expect(efectividadDe(-1000, 50000)).toBe(0)
  })

  it('el verde empieza en 70', () => {
    expect(tonoEfectividad(70)).toBe('ok')
    expect(tonoEfectividad(69)).toBe('aviso')
    expect(tonoEfectividad(39)).toBe('malo')
    expect(tonoEfectividad(null)).toBe('neutro')
  })
})

describe('debe entregar: efectivo, no lo recogido', () => {
  it('es solo el efectivo cuando el API manda el desglose', () => {
    // Lo que entró por transferencia YA está en la cuenta.
    expect(entregaEnEfectivo({ recaudadoHoy: 188000, recaudadoEfectivoHoy: 153000 })).toBe(153000)
  })

  it('sin desglose cae en el total, que es la suposición conservadora', () => {
    // De más para entregar, nunca de menos.
    expect(entregaEnEfectivo({ recaudadoHoy: 188000 })).toBe(188000)
  })

  it('el API manda el desglose', () => {
    // Sin `metodoPago` en el select, «debe entregar» miente en cuanto alguien
    // paga por Nequi. Esta prueba muere si se quita.
    expect(api).toMatch(/metodoPago: true/)
    expect(api).toMatch(/recaudadoEfectivoHoy:/)
    expect(api).toMatch(/recaudadoDigitalHoy:/)
  })
})

describe('T09-02 · los dos grupos', () => {
  const lista = [
    { id: 'a', nombre: 'Pepito', activo: true, ruta: { id: 'r2', nombre: 'Ruta 2' },
      cantidadClientes: 9, recaudadoHoy: 61500, recaudadoEfectivoHoy: 61500, esperadoHoy: 74100 },
    { id: 'b', nombre: 'Carlos lopez', activo: true, ruta: null, cantidadClientes: 0 },
    { id: 'c', nombre: 'Vieja cuenta', activo: false, ruta: null },
  ]

  it('separa por si tiene ruta, que es lo que decide si puede cobrar', () => {
    const r = agrupaCobradores(lista, pesos)
    expect(r.cobrando.map((c) => c.id)).toEqual(['a'])
    expect(r.sinRuta.map((c) => c.id)).toEqual(['b'])
  })

  it('las desactivadas no cuentan como problema', () => {
    // Están apagadas a propósito; no son un hueco que arreglar.
    const r = agrupaCobradores(lista, pesos)
    expect(r.aviso.cuantas).toBe(1)
    expect(r.resumen).toBe('2 cuentas · 1 con ruta asignada')
  })

  it('sin cuentas sueltas no hay aviso', () => {
    const r = agrupaCobradores([lista[0]], pesos)
    expect(r.aviso).toBeNull()
  })

  it('el detalle lleva la ruta Y el conteo de clientes', () => {
    // El nombre de la ruta solo no dice si esa persona tiene trabajo.
    expect(agrupaCobradores(lista, pesos).cobrando[0].detalle).toBe('Ruta 2 · 9 clientes')
  })

  it('las iniciales salen de dos palabras, o de una', () => {
    const r = agrupaCobradores([
      { id: '1', nombre: 'Carmen Calanche', activo: true, ruta: null },
      { id: '2', nombre: 'Pepito', activo: true, ruta: null },
      { id: '3', nombre: '', activo: true, ruta: null },
    ], pesos)
    expect(r.sinRuta.map((c) => c.iniciales)).toEqual(['CC', 'PE', '··'])
  })

  it('cero por entregar no se pinta como si debiera algo', () => {
    const r = agrupaCobradores([{ ...lista[0], recaudadoHoy: 0, recaudadoEfectivoHoy: 0 }], pesos)
    expect(r.cobrando[0].debeAlgo).toBe(false)
  })

  it('el componente lee exactamente lo que el adaptador escribe', () => {
    // La cuarta vez que un campo del adaptador no coincidía con el del
    // componente. Las claves se comprueban, no se suponen.
    const c = agrupaCobradores(lista, pesos).cobrando[0]
    for (const clave of ['nombre', 'iniciales', 'detalle', 'hoy', 'efectividad', 'entrega']) {
      expect(c[clave], clave).toBeDefined()
      expect(cuerpo, clave).toMatch(new RegExp(`c\\.${clave}`))
    }
  })
})

describe('T36-03 · el día del cobrador', () => {
  const datos = {
    recaudadoHoy: 188000, recaudadoEfectivoHoy: 153000, recaudadoDigitalHoy: 35000,
    esperadoHoy: 235000, clientesPagaron: 9, clientesEsperados: 11,
  }

  it('la cifra que entrega es el efectivo, no lo recogido', () => {
    // Es la cuenta que hoy se hace de memoria y por la que se pelea.
    const d = miDia(datos, pesos)
    expect(d.recogido).toBe('$188.000')
    expect(d.entrega).toBe('$153.000')
  })

  it('dice POR QUÉ no entrega todo, o la cifra parece un descuadre', () => {
    expect(miDia(datos, pesos).entregaDetalle).toContain('$35.000')
  })

  it('sin transferencias no inventa una explicación', () => {
    const d = miDia({ ...datos, recaudadoDigitalHoy: 0, recaudadoEfectivoHoy: 188000 }, pesos)
    expect(d.entregaDetalle).toBe('efectivo · todo lo de hoy')
  })

  it('deduce el efectivo si solo llega el digital', () => {
    const d = miDia({ recaudadoHoy: 100000, recaudadoDigitalHoy: 30000 }, pesos)
    expect(d.entrega).toBe('$70.000')
  })

  it('sin nada esperado no enseña porcentaje ni el «de $X»', () => {
    const d = miDia({ recaudadoHoy: 40000, esperadoHoy: 0 }, pesos)
    expect(d.porcentaje).toBeNull()
    expect(d.deEsperado).toBeNull()
    expect(d.barra).toBe(0)
  })

  it('cuenta los que faltaron en singular cuando es uno', () => {
    const d = miDia({ ...datos, clientesPagaron: 10 }, pesos)
    expect(d.clientes).toContain('1 quedó pendiente')
  })

  it('si pagaron todos no habla de pendientes', () => {
    const d = miDia({ ...datos, clientesPagaron: 11 }, pesos)
    expect(d.clientes).toBe('11 de 11 clientes te pagaron')
  })
})

describe('la semana: el mejor día se mide sobre los que ya pasaron', () => {
  const semana = [
    { etiqueta: 'L', valor: 64 }, { etiqueta: 'M', valor: 88 }, { etiqueta: 'M', valor: 41 },
    { etiqueta: 'J', valor: 76 }, { etiqueta: 'V', valor: 100, hoy: true },
    { etiqueta: 'S', valor: 0 }, { etiqueta: 'D', valor: 0 },
  ]

  it('hoy es el dorado, no el máximo', () => {
    // Regla del dorado único, y es lo que el cobrador busca al mirar.
    const r = miSemana(semana, pesos)
    expect(r.barras[4].tono).toBe('oro')
    expect(r.barras.filter((b) => b.tono === 'oro')).toHaveLength(1)
  })

  it('no cuenta los días que no han llegado para decir cuál fue el mejor', () => {
    // Con el miércoles a media mañana, decirle que es su peor día es mentira.
    const aMedias = [
      { etiqueta: 'L', valor: 200 }, { etiqueta: 'M', valor: 300, hoy: true },
      { etiqueta: 'M', valor: 0 }, { etiqueta: 'J', valor: 0 },
    ]
    expect(miSemana(aMedias, pesos).frase).toContain('mejor día')
  })

  it('si hoy no es el mejor, no se lo dice', () => {
    const r = miSemana([
      { etiqueta: 'L', valor: 900 }, { etiqueta: 'M', valor: 100, hoy: true },
    ], pesos)
    expect(r.frase).not.toContain('mejor')
    expect(r.frase).toContain('$1.000')
  })

  it('una semana vacía no rompe', () => {
    expect(miSemana([], pesos)).toEqual({ barras: [], frase: null, total: '$0' })
  })
})

describe('T09-03 · crear cobrador', () => {
  it('«registrar cobros» NO es un interruptor', () => {
    // No existe el permiso: cobrar es lo que un cobrador ES. Pintarlo como
    // interruptor encendido prometería que se puede apagar.
    expect(api).not.toMatch(/puedeRegistrarCobros/)
    expect(cuerpo).toMatch(/Registrar cobros/)
    expect(cuerpo).toMatch(/Siempre/)
  })

  it('los permisos que ofrece existen todos en el API', () => {
    // Un interruptor que el backend ignora es peor que no tenerlo: el dueño
    // cree que apagó algo.
    const claves = [...comp.matchAll(/\{ clave: '(\w+)'/g)].map((m) => m[1])
    expect(claves.length).toBeGreaterThan(0)
    for (const c of claves) expect(api, c).toMatch(new RegExp(`permisos\\?\\.${c}`))
  })

  it('recargos y descuentos van separados', () => {
    // La lámina los junta. En el código son dos permisos con riesgo distinto:
    // el recargo SUBE la deuda, el descuento la BAJA. Juntarlos le daría a
    // alguien de confianza para poner moras el poder de perdonar saldo.
    expect(comp).toMatch(/clave: 'gestionarPrestamos'/)
    expect(comp).toMatch(/clave: 'aplicarDescuentos'/)
  })

  it('pide el correo, que la lámina no dibuja pero el API exige', () => {
    expect(cuerpo).toMatch(/rotulo="Correo"/)
    expect(api).toMatch(/El email es requerido/)
  })

  it('avisa de que sin ruta no va a poder cobrar', () => {
    // Mientras se puede arreglar, no tres semanas después en la lista.
    expect(cuerpo).toMatch(/Sin ruta no va a poder cobrar nada/)
  })
})

describe('reglas globales', () => {
  it('no hay emojis', () => {
    expect(comp).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u)
  })

  it('las filas de contenido no se encogen', () => {
    expect(cuerpo).toMatch(/flex: 'none'/)
  })
})
