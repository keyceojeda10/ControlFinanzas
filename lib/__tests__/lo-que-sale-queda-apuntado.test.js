/* Todo lo que sale por WhatsApp queda apuntado.
 *
 * ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
 *
 * El 28 de agosto quedó la duda de si un envío a 36 organizaciones había
 * salido. No había forma de saberlo desde ningún sitio —ni el panel, ni la
 * base, ni los registros de la aplicación—. Hicieron falta una hora, el syslog
 * del servidor y la analítica de Meta por medias horas para concluir que NO
 * había salido.
 *
 * Ahora se apunta en `postMessage`, que es el cuello por donde pasan TODOS los
 * envíos: plantillas y texto libre. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const wa = readFileSync('lib/bot/whatsapp-cloud.js', 'utf8')
const esquema = readFileSync('prisma/schema.prisma', 'utf8')

describe('lo que sale por WhatsApp queda apuntado', () => {
  it('⚠ se apunta en `postMessage`, no en `sendTemplate`', () => {
    /* Por `postMessage` pasa todo. Si el registro se mueve a `sendTemplate`,
       el texto libre deja de quedar apuntado y vuelve el agujero. */
    const cuerpo = wa.slice(wa.indexOf('async function postMessage'), wa.indexOf('async function apuntar'))
    expect(cuerpo).toMatch(/await apuntar\(/)
  })

  it('se apuntan los tres finales: éxito, error de Meta y corte temprano', () => {
    // Tres llamadas: sin configurar, teléfono inválido, respuesta de Meta (ok y no ok).
    const llamadas = wa.match(/await apuntar\(/g) ?? []
    expect(llamadas.length).toBeGreaterThanOrEqual(4)
  })

  it('⚠ apuntar NUNCA puede romper el envío', () => {
    /* Si la base no responde, el mensaje tiene que salir igual. Apuntar
       importa; mandar importa más. */
    const fn = wa.slice(wa.indexOf('async function apuntar'))
    expect(fn).toMatch(/catch\s*\{\s*\/\*[^*]*\*\/\s*\}/)
  })

  it('⚠ el import de prisma es dinámico', () => {
    /* Los guiones sueltos del servidor corren con node a secas, donde el
       cliente de Prisma no resuelve. Con un import estático dejarían de poder
       enviar por no poder apuntar. */
    const fn = wa.slice(wa.indexOf('async function apuntar'))
    expect(fn).toMatch(/await import\('@\/lib\/prisma'\)/)
    expect(wa).not.toMatch(/^import .*from '@\/lib\/prisma'/m)
  })

  it('guarda el wamid, que es con lo que se cruzan los acuses de entrega', () => {
    expect(wa).toMatch(/wamid,/)
    expect(esquema).toMatch(/model EnvioWhatsapp/)
    expect(esquema).toMatch(/wamid\s+String\?/)
  })

  it('la tabla se busca por teléfono y por fecha, que es como se pregunta', () => {
    expect(esquema).toMatch(/@@index\(\[telefono, createdAt\]\)/)
  })
})
