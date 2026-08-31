// lib/__tests__/primer-cobro-aviso.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Medido en producción el 31 ago 2026, con 14 días de margen para que les
// diera tiempo de cobrar: **83 negocios prestaron y NUNCA registraron un
// cobro**. El 80 % no volvió después del primer día, tienen 2,6 clientes de
// media —los que sobreviven, 41,9— y el 75 % creó un solo préstamo.
//
// A ninguno le había hablado nadie: `activacion-whatsapp` filtra por
// `prestamos: { none: {} }`, así que quien ya creó un préstamo queda fuera POR
// DISEÑO, y el siguiente aviso que existe salta cuando se le vence la prueba,
// semanas después.
//
// El sistema toma «creó un préstamo» por «ya arrancó». Los datos dicen que no.
//
// ⚠ ESTE AVISO PUEDE HACER DAÑO SI SE EQUIVOCA: es un WhatsApp a un cliente
// real, uno solo por negocio, y una vez quemado no vuelve. Lo que se comprueba
// aquí son las tres formas de quemarlo mal.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const raiz = resolve(__dirname, '../..')
const quitarComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1 ')

const cron = quitarComentarios(readFileSync(resolve(raiz, 'app/api/cron/primer-cobro-whatsapp/route.js'), 'utf8'))
const esquema = readFileSync(resolve(raiz, 'prisma/schema.prisma'), 'utf8')

describe('⚠ nace apagado, y apagado no toca nada', () => {
  it('sin plantilla no manda ni marca', () => {
    /* Las plantillas aprobadas están escritas para quien NO ha prestado, así
       que ésta necesita una nueva de Meta. Comprobado contra el espejo: sin la
       variable contesta `apagado: true` y ninguna organización quedó marcada. */
    const i = cron.indexOf('if (!TEMPLATE)')
    expect(i).toBeGreaterThan(-1)

    /* ⚠ Y VA ANTES DE TOCAR LA BASE. Marcar el aviso sin haberlo mandado
       quemaría el único que tiene cada negocio. */
    const consulta = cron.indexOf('prisma.organization.findMany')
    expect(consulta).toBeGreaterThan(i)
    expect(cron.slice(i, consulta)).toMatch(/apagado: true/)
  })

  it('y tampoco manda si WhatsApp no está configurado', () => {
    expect(cron).toMatch(/wa\.configurado\(\)/)
    const i = cron.indexOf('wa.configurado()')
    expect(cron.indexOf('prisma.organization.findMany')).toBeGreaterThan(i)
  })
})

describe('⚠ la marca se pone DESPUÉS de mandar', () => {
  it('primero el envío, luego el update', () => {
    /* Si se marcara antes y el envío fallara, ese negocio se quedaría sin su
       único aviso para siempre y nadie se enteraría. */
    const envio = cron.indexOf('wa.sendTemplate')
    const marca = cron.indexOf('waPrimerCobroSent: true')
    expect(envio).toBeGreaterThan(-1)
    expect(marca).toBeGreaterThan(envio)
  })

  it('una sola vez por negocio', () => {
    expect(cron).toMatch(/waPrimerCobroSent: false/)
    expect(esquema).toMatch(/waPrimerCobroSent Boolean\s+@default\(false\)/)
  })
})

describe('⚠ a quién NO se le escribe', () => {
  it('el «cero cobros» mira TODOS sus préstamos, no el nuevo', () => {
    /* Quien ya cobró en otro préstamo sabe hacerlo; avisarle sería tratarlo de
       novato. El filtro no cabe en el `where` junto al `some` de la ventana
       —Prisma aplicaría las dos condiciones al MISMO préstamo y dejaría pasar a
       quien tiene uno nuevo sin cobros y otro viejo cobrado—, así que se cuenta
       por organización dentro del bucle. */
    expect(cron).toMatch(/prisma\.pago\.count\(\{ where: \{ prestamo: \{ organizationId: org\.id \} \} \}\)/)
    const i = cron.indexOf('prisma.pago.count')
    expect(cron.slice(i, i + 160)).toMatch(/if \(cobros > 0\) continue/)
  })

  it('la ventana es de 2 a 6 días, no «alguna vez»', () => {
    /* Menos de 2 días no da tiempo ni a un cobro diario. Más de 6 y el mensaje
       llega a quien ya se olvidó de que abrió la cuenta — el 80 % muere el
       primer día. La ventana además evita que el día que se encienda salgan de
       golpe los 83 acumulados. */
    expect(cron).toMatch(/hace48h = new Date\(ahora\.getTime\(\) - 48 \* 3600000\)/)
    expect(cron).toMatch(/hace6d = new Date\(ahora\.getTime\(\) - 6 \* 24 \* 3600000\)/)
    expect(cron).toMatch(/createdAt: \{ gte: hace6d, lte: hace48h \}/)
  })

  it('ni a las cuentas de casa, ni a las desactivadas', () => {
    expect(cron).toMatch(/activo: true/)
    expect(cron).toMatch(/users: \{ none: \{ email: \{ in: EMAILS_INTERNOS \} \} \}/)
  })

  it('y el préstamo tiene que seguir vivo', () => {
    /* A quien canceló su préstamo de prueba no hay que recordárselo. */
    expect(cron).toMatch(/estado: 'activo'/)
  })
})

describe('⚠ la puerta de entrada', () => {
  it('exige el secreto del cron, como los demás', () => {
    expect(cron).toMatch(/x-cron-secret/)
    expect(cron).toMatch(/secret !== CRON_SECRET/)
    const i = cron.indexOf('secret !== CRON_SECRET')
    expect(cron.indexOf('prisma.organization.findMany')).toBeGreaterThan(i)
  })
})
