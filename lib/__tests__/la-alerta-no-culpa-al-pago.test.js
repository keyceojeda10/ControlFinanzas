/* LA ALERTA MANDÓ AL DUEÑO AL SITIO EQUIVOCADO.
 *
 * ══ LO QUE PASÓ ═══════════════════════════════════════════════════════════
 *
 * El 29 ago 2026 saltó dos veces con el código 130472 —«el número está en un
 * experimento de Meta»— y el texto decía, como decía SIEMPRE:
 *
 *   «⚠️ Si el error es 131042 (payment issue), revisar la forma de pago…»
 *
 * El dueño se pasó la mañana buscando un problema de facturación que no
 * existía: «parece que el bot se cayó por pago a Meta». No había ninguno: la
 * cuenta estaba LIVE, el número CONNECTED y la calidad GREEN.
 *
 * Una alerta que nombra una causa ajena es peor que no avisar. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { explicarCodigo, codigoDe, esCorte } from '@/lib/bot/codigos-wa'

const raiz = join(import.meta.dirname, '..', '..')
const leer = (p) => readFileSync(join(raiz, p), 'utf8')

describe('cada código dice lo suyo', () => {
  it('el 130472 NO habla de pago', () => {
    const e = explicarCodigo("130472: User's number is part of an experiment")
    expect(e.que).toMatch(/experimento/i)
    expect(`${e.que} ${e.hacer}`).not.toMatch(/pago|factura/i)
  })

  it('el 131049 tampoco, y dice qué sube el límite', () => {
    const e = explicarCodigo('131049: This message was not delivered to maintain healthy ecosystem engagement.')
    expect(`${e.que} ${e.hacer}`).not.toMatch(/pago|factura/i)
    expect(e.hacer).toMatch(/verificaci[oó]n de negocio/i)
  })

  it('⚠ y el 131042 SÍ, porque ése sí es el pago', () => {
    const e = explicarCodigo('131042')
    expect(e.hacer).toMatch(/forma de pago/i)
    expect(e.hacer).toContain('business.facebook.com')
  })

  it('distingue lo que nos toca de lo que no', () => {
    /* Si no se dice, se busca un arreglo que no existe. */
    expect(explicarCodigo(130472).nuestro).toBe(false)
    expect(explicarCodigo(131049).nuestro).toBe(false)
    expect(explicarCodigo(131042).nuestro).toBe(true)
    expect(explicarCodigo(131009).nuestro).toBe(true)
  })

  it('un código desconocido NO se inventa una explicación', () => {
    /* Lo peligroso no es no saber: es contar la causa de otro código. */
    const e = explicarCodigo('999999: algo nuevo')
    expect(e.que).toMatch(/no tenemos fichado/i)
    expect(`${e.que} ${e.hacer}`).not.toMatch(/pago|factura/i)
    expect(e.codigo).toBe(999999)
  })

  it('saca el código del texto entero de Meta, y aguanta basura', () => {
    expect(codigoDe('131049: This message was not delivered')).toBe(131049)
    expect(codigoDe(131042)).toBe(131042)
    expect(codigoDe(null)).toBeNull()
    expect(codigoDe('sin numeros')).toBeNull()
  })

  it('separa «el bot está mudo» de «pierde algunos»', () => {
    expect(esCorte(131042)).toBe(true)      // facturación: mudo
    expect(esCorte(131031)).toBe(true)      // restringida: mudo
    expect(esCorte('130472: experiment')).toBe(false)  // pierde algunos
    expect(esCorte(131049)).toBe(false)
  })
})

describe('el texto que sale por Telegram', () => {
  const src = leer('lib/bot/alertas.js')
  /* ⚠ SE MIRA EL TEXTO QUE SALE, NO EL FICHERO ENTERO. La primera versión de
     esta prueba buscaba la frase vieja en todo el archivo y cazaba MI PROPIO
     comentario, que la cita para explicar por qué se quitó. Es la trampa de
     siempre en este repo: aquí los comentarios repiten literalmente lo que se
     corrigió, así que una prueba de texto tiene que acotarse a la plantilla. */
  const cuerpo = src.slice(src.indexOf('export async function alertarFallosEntrega'),
                           src.indexOf("enviar(texto, 'alerta-entrega')"))
  const plantilla = cuerpo.slice(cuerpo.indexOf('`⚠️'), cuerpo.lastIndexOf('`'))

  it('⚠ ya NO lleva la frase del pago pegada a cualquier error', () => {
    expect(plantilla).not.toContain('131042')
    expect(plantilla).not.toMatch(/forma de pago/i)
  })

  it('⚠ ni dice que los leads no reciben NADA, que era falso', () => {
    /* Con un 20 % de fallo, cuatro de cada cinco sí llegaban. La diferencia
       entre «se cayó» y «pierde uno de cada cinco» es la diferencia entre
       dejarlo todo y mirarlo el lunes. */
    expect(plantilla).not.toContain('NO están recibiendo')
    expect(plantilla).toContain('Los otros ${llegaron} sí llegaron')
  })

  it('la explicación sale del código real', () => {
    expect(src).toContain("explicarCodigo")
    expect(src).toMatch(/Qué pasa[\s\S]{0,80}e\.que/)
    expect(src).toMatch(/Qué hacer[\s\S]{0,80}e\.hacer/)
  })

  it('el reporte diario tampoco culpa al pago de entrada', () => {
    expect(src).not.toContain('revisar pago en Meta Business')
  })
})

describe('no se avisa dos veces de lo mismo', () => {
  const src = leer('app/api/webhook/whatsapp-cloud/route.js')

  it('⚠ la marca va en DISCO, no en memoria: hay dos instancias', () => {
    /* Cada proceso de pm2 tenía su propia variable, así que la segunda mandaba
       el mismo aviso ocho minutos después. Mismo patrón que el
       `connection_limit`: lo que se cuenta por proceso se multiplica por
       instancias. */
    expect(src).not.toMatch(/let ultimaAlertaFallos\s*=/)
    expect(src).not.toMatch(/let ultimaAlertaCorte\s*=/)
    expect(src).toContain("ultimaVez('fallos')")
    expect(src).toContain("apuntarVez('fallos')")
  })

  it('y si no hay disco, avisa de más y no revienta', () => {
    expect(src).toMatch(/catch \{ \/\* sin disco/)
  })
})

describe('a quién se le insiste tras un rebote', () => {
  const ruta = leer('app/api/webhook/whatsapp-cloud/route.js')

  it('⚠ el 131026 entra en la lista de freno, y no estaba', () => {
    /* «Message undeliverable»: el número no tiene WhatsApp. Al quedarse fuera
       de la lista NO se le aplicaba ningún freno y el lead recibía la secuencia
       entera: 105 reintentos en 30 días para acertar 15, y 90 rebotes que
       degradan la reputación del número para todos los demás. */
    const linea = ruta.slice(ruta.indexOf('const CODIGOS_THROTTLE'))
    expect(linea.slice(0, 90)).toContain('131026')
  })

  it('el código llega a la decisión, no solo el contador de rebotes', () => {
    /* Sin el código, «este no se recupera nunca» no se puede distinguir de
       «este acierta la mitad de las veces». */
    expect(ruta).toContain('accionTrasThrottle(rebotes, codigo)')
  })
})
