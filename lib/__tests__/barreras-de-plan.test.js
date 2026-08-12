// lib/__tests__/barreras-de-plan.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Un endpoint de reportes sin barrera de plan **no falla**: contesta con los
// datos. Nadie lo reporta, no lo ve ninguna prueba, y el negocio regala lo que
// vende.
//
// Estaba pasando en tres: Analíticas, su PDF y el ranking de cobradores. Los
// tres devolvían todo a cualquier sesión, incluido el plan **Inicial**, que en
// la tabla de planes tiene `reportesNivel: 0`. Medido en producción el 8 ago
// 2026: **322 de 431 negocios** están en Inicial.
//
// ⚠ Y no se descubrió leyendo el código. La primera pasada con `grep` **dio
// mal**: buscaba `nivelReportes(session.user.plan)` y `reportes/dia` usa
// `nivelReportes(orgData?.plan)`, así que salió como «sin barrera» teniéndola.
// Por eso esto no es un `grep`: es una lista cerrada, endpoint por endpoint,
// donde cada uno tiene que estar decidido a mano.
//
// Si añades un endpoint de reportes, esta prueba te obliga a decir qué plan lo
// alcanza. Es la idea.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { PLANES_CONFIG, nivelReportes } from '../planes.js'

const RAIZ = process.cwd()

/* El nivel que exige cada endpoint. `null` = abierto A PROPÓSITO, con el
   motivo al lado; cualquier otro caso es un olvido. */
const BARRERAS = {
  'reportes/resumen': 1,
  'reportes/resumen-pdf': 1,
  'reportes/ingresos': 1,
  'reportes/cobros-mes': 1,
  'reportes/dia': 1,
  'reportes/scorecard': 1,
  'dashboard/analiticas': 1,
  'dashboard/analiticas/reporte-pdf': 1,
  'reportes/cartera': 2,
  'reportes/cobradores': 2,
  'reportes/seguros': 2,
  /* ⚠ BAJÓ DE 3 A 1 (ago 2026, decisión del dueño). En 3 —Empresarial— lo
     alcanzaban CINCO negocios de 457, y a los otros 452 la pantalla les
     ofrecía el botón para que el servidor les contestara 403. En 1 lo alcanzan
     108. Ver la nota en el propio endpoint. */
  'reportes/exportar': 1,

  /* ⚠ ABIERTO A PROPÓSITO. Es la hoja con la que el cobrador sale a la calle,
     no un reporte de gestión: quitársela a los 322 negocios en Inicial sería
     quitarles la herramienta del día. Decisión del dueño, 8 ago 2026. */
  'reportes/listado-cobros': null,
}

const ruta = (clave) => path.join(RAIZ, 'app', 'api', clave, 'route.js')

describe('barreras de plan en los reportes', () => {
  it('la lista cubre TODOS los endpoints de reportes que existen', () => {
    /* Sin esto, añadir un endpoint nuevo y olvidarse de la lista dejaría la
       prueba pasando en verde sobre un endpoint que nadie miró: exactamente lo
       que pasó con Analíticas. */
    const hallados = []
    const barrer = (dir, prefijo) => {
      if (!existsSync(dir)) return
      for (const entrada of readdirSync(dir)) {
        const p = path.join(dir, entrada)
        if (statSync(p).isDirectory()) barrer(p, `${prefijo}/${entrada}`)
        else if (entrada === 'route.js') hallados.push(prefijo)
      }
    }
    barrer(path.join(RAIZ, 'app', 'api', 'reportes'), 'reportes')
    barrer(path.join(RAIZ, 'app', 'api', 'dashboard', 'analiticas'), 'dashboard/analiticas')

    const faltan = hallados.filter((h) => !(h in BARRERAS))
    expect(faltan, `sin decidir: ${faltan.join(', ')}`).toEqual([])
  })

  for (const [clave, nivel] of Object.entries(BARRERAS)) {
    it(`${clave} → ${nivel === null ? 'abierto a propósito' : `nivel ${nivel}`}`, () => {
      const fuente = readFileSync(ruta(clave), 'utf8')

      if (nivel === null) {
        expect(fuente).not.toMatch(/exigeNivelReportes\(/)
        // Abierto sin explicar es indistinguible de abierto por olvido.
        expect(fuente).toMatch(/A PROPOSITO|A PROPÓSITO/)
        return
      }

      /* Una sola barrera y con el nivel exacto. Dos llamadas con niveles
         distintos en el mismo archivo son un merge mal resuelto. */
      const llamadas = [...fuente.matchAll(/exigeNivelReportes\(\s*session\s*,\s*(\d)\s*\)/g)]
      expect(llamadas.length, 'llamadas a exigeNivelReportes').toBe(1)
      expect(Number(llamadas[0][1])).toBe(nivel)
      expect(fuente).toMatch(/from '@\/lib\/plan-servidor'/)
    })
  }

  it('Inicial no alcanza ningún reporte y Básico alcanza el nivel 1', () => {
    // Las barreras de arriba no significan nada si la tabla cambia debajo.
    expect(nivelReportes('starter')).toBe(0)
    expect(nivelReportes('test')).toBe(0)
    expect(nivelReportes('basic')).toBe(1)
    expect(PLANES_CONFIG.basic.reportesNivel).toBe(1)
  })

  it('el 403 dice que es del plan, para que la pantalla no culpe a la conexión', () => {
    const helper = readFileSync(path.join(RAIZ, 'lib', 'plan-servidor.js'), 'utf8')
    expect(helper).toMatch(/motivo: 'plan'/)
    expect(helper).toMatch(/status: 403/)
    /* Y consulta la base cuando el token no alcanza: el plan del JWT no se
       refresca sin volver a entrar, así que quien acaba de pagar seguía
       viendo que su plan no llega. */
    expect(helper).toMatch(/organization\.findUnique/)
  })
})
