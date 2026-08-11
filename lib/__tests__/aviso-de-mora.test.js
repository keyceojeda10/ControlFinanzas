// lib/__tests__/aviso-de-mora.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// `mora-alertas` llevaba meses escrito y **nunca estuvo en el crontab**: cero
// avisos enviados. El dueño: «tenemos un apartado de notificaciones y no
// estamos mandando notificaciones de ninguna clase».
//
// Encenderlo tal cual habría sido peor. Medía `ultimoPagoAt < hace 3 días`, que
// no es mora sino «hace tres días que no me paga»: en una cartera mensual eso
// marcaba **4.095 de 5.449 préstamos activos**. Un aviso que suena para el 75%
// de la cartera se apaga el primer día.
//
// La regla, en palabras del dueño: «vence el 10, si ya es el día 11, pues tiene
// un día de atraso, literalmente». Eso ya lo devuelve `calcularDiasMora` — lo
// que faltaba era usarla.
//
// Y se avisa **al cruzar**, no todos los días: el 63% de la cartera lleva un día
// o más de mora, así que un aviso diario por cada uno serían 3.442 el primer
// día (789 a un solo negocio). Los que cruzan hoy son 190 en 38 negocios, con
// mediana de 2 por negocio.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const cron = readFileSync(join(process.cwd(), 'app/api/cron/mora-alertas/route.js'), 'utf8')
const centro = readFileSync(join(process.cwd(), 'components/layout/NotificationsCenter.jsx'), 'utf8')

/* Los comentarios de este repo citan el código que describen: una prueba que
   busque texto plano se acusa a sí misma. Ya pasó con `guias-donde-estas`. */
const sinNotas = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const codigo = sinNotas(cron)

describe('el aviso mide MORA, no «hace días que no paga»', () => {
  it('usa calcularDiasMora', () => {
    expect(codigo).toMatch(/calcularDiasMora/)
  })

  it('el umbral es UN día: vence el 10, el 11 ya avisa', () => {
    expect(codigo).toMatch(/dias < 1/)
  })

  it('⚠ y hay VENTANA: la primera corrida no puede avisar de la mora vieja', () => {
    /* Sin ventana, «avisar lo que no se ha avisado» hace que la primera corrida
       avise de TODA la mora viva. Probado en el espejo antes de subirlo: dijo
       «4.258 préstamos se atrasaron» y llevaban meses. El aviso habría nacido
       mintiendo. Tres días, no uno, para aguantar que el guion no corra un día. */
    expect(codigo).toMatch(/VENTANA_DIAS/)
    expect(codigo).toMatch(/dias > VENTANA_DIAS/)
  })

  it('el resumen no dice «hoy» de algo que puede ser de anteayer', () => {
    expect(codigo).not.toMatch(/Hoy se atrasaron/)
  })

  it('ya NO consulta ultimoPagoAt ni «hace 3 días»', () => {
    /* Ese era el criterio viejo. Si vuelve, el aviso vuelve a sonar para tres
       cuartas partes de la cartera. */
    expect(codigo).not.toMatch(/ultimoPagoAt/)
    expect(codigo).not.toMatch(/tresDiasAtras/)
  })

  it('pide `estado` en el select aunque ya lo filtre', () => {
    // Un campo que no entra en el select vale `undefined`, y `calcularDiasMora`
    // lo lee. Así nació el «0 en mora» de Analíticas.
    expect(codigo).toMatch(/estado:\s*true/)
  })

  it('pasa el PRÉSTAMO como cuarto argumento de obtenerDiasSinCobro', () => {
    // Sin él, los días sin cobro propios del préstamo no ganan y este aviso
    // daría una mora distinta a la de la ficha.
    expect(codigo).toMatch(/obtenerDiasSinCobro\(p\.cliente,\s*p\.cliente\?\.ruta,\s*org,\s*p\)/)
  })
})

describe('se avisa una vez, al cruzar', () => {
  it('la llave lleva la CUOTA, no solo el préstamo', () => {
    /* Con `prestamoId` a secas, el cliente que se pone al día y vuelve a
       atrasarse un mes después no volvería a avisar nunca. */
    expect(codigo).toMatch(/const llave = `\$\{p\.id\}:/)
    expect(codigo).toMatch(/calcularProximoCobro/)
  })

  it('no repite lo ya avisado', () => {
    expect(codigo).toMatch(/yaAvisado\.has\(llave\)/)
    expect(codigo).toMatch(/tipo:\s*'mora'/)
  })

  it('la fila de resumen NO lleva llave', () => {
    // Si la llevara, bloquearía el aviso individual del día siguiente.
    const resumen = codigo.slice(codigo.indexOf('resumen: true') - 400, codigo.indexOf('resumen: true') + 60)
    expect(resumen).toMatch(/href:/)
    expect(resumen).not.toMatch(/llave:/)
  })
})

describe('el aviso se GUARDA, no solo suena', () => {
  it('escribe en Notificacion, que es lo que lee la campana', () => {
    expect(codigo).toMatch(/notificacion\.createMany/)
  })

  it('lleva clienteId para poder abrirse', () => {
    expect(codigo).toMatch(/clienteId:/)
  })

  it('la campana sabe abrir un aviso sin cliente (el resumen)', () => {
    expect(sinNotas(centro)).toMatch(/d\.href \|\| \(d\.clienteId/)
  })

  it('la campana pinta la mora distinta del resto', () => {
    expect(sinNotas(centro)).toMatch(/n\.tipo === 'mora'/)
  })
})

describe('el tope no se calla', () => {
  it('lo que no cabe se dice, y lleva a la lista entera', () => {
    /* Un tope silencioso se lee como «no había más», que es peor que no
       tenerlo. */
    expect(codigo).toMatch(/MAX_FILAS_POR_ORG/)
    expect(codigo).toMatch(/otros \$\{sobran\} clientes/)
    expect(codigo).toMatch(/\/clientes\?filtro=mora/)
  })
})
