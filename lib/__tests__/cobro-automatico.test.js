// lib/__tests__/cobro-automatico.test.js
//
// «Yo coloco automáticamente el pago y ahí sale que está automático el cobro
//  con Nequi, pero no ha cobrado nada, y cada rato me sale un anuncio ahí, que
//  debo pagar, que debo pagar, pero yo tengo ya automático eso»
//                                                   — un cliente, 12 sep 2026
//
// Cada pantalla y cada cron decidía a su manera si a un negocio se le cobra
// solo, y ninguno sabía del Nequi o la tarjeta guardados en Wompi. Lo que se
// protege aquí es que la respuesta salga de UN sitio y que todos la pregunten.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  MAX_FALLOS, HORAS_DE_GRACIA, HORAS_DE_ANTICIPO,
  whereCobroVivo, selectCobro, cobroVivo, vencimientoEfectivo,
} from '@/lib/cobro-automatico'

const raiz = resolve(__dirname, '../..')
const quitarComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1 ')
const leer = (ruta) => quitarComentarios(readFileSync(resolve(raiz, ruta), 'utf8'))

const H = 3600000
const conNequi = { cobroAutomatico: true, wompiFuentePagoId: 'fuente-1', cobroFallos: 0 }

describe('¿se le cobra solo?', () => {
  it('con el medio guardado, el cobro encendido y menos de tres rechazos, sí', () => {
    expect(cobroVivo(conNequi)).toBe(true)
    expect(cobroVivo({ ...conNequi, cobroFallos: 2 })).toBe(true)
  })

  it('al tercer rechazo, no: vuelve a recibir los avisos como cualquiera', () => {
    expect(cobroVivo({ ...conNequi, cobroFallos: MAX_FALLOS })).toBe(false)
  })

  it('sin medio guardado o con el cobro apagado, no', () => {
    expect(cobroVivo({ ...conNequi, wompiFuentePagoId: null })).toBe(false)
    expect(cobroVivo({ ...conNequi, cobroAutomatico: false })).toBe(false)
    expect(cobroVivo(null)).toBe(false)
  })

  it('⚠ un select que no pidió los campos dice «no», nunca «sí»', () => {
    /* Equivocarse hacia «no» es enseñar un aviso de más; hacia «sí» sería
       dejar entrar gratis a quien no tiene con qué cobrarle. */
    expect(cobroVivo({ id: 'org' })).toBe(false)
    expect(Object.keys(selectCobro).sort()).toEqual(['cobroAutomatico', 'cobroFallos', 'wompiFuentePagoId'])
  })

  it('el filtro de Prisma dice lo mismo que la función', () => {
    expect(whereCobroVivo).toEqual({
      cobroAutomatico: true,
      wompiFuentePagoId: { not: null },
      cobroFallos: { lt: MAX_FALLOS },
    })
  })
})

describe('la gracia de acceso', () => {
  const vence = new Date('2026-09-13T13:10:00.000Z')   // el suyo: 08:10 en Colombia

  it('con el cobro vivo se corta 72 h después, no a la hora de vencer', () => {
    const efectiva = vencimientoEfectivo(vence, conNequi)
    expect(efectiva.getTime() - vence.getTime()).toBe(72 * H)
    expect(HORAS_DE_GRACIA).toBe(72)
  })

  it('sin cobro vivo, la fecha no se toca', () => {
    expect(vencimientoEfectivo(vence, { ...conNequi, cobroFallos: 3 })).toBe(vence)
    expect(vencimientoEfectivo(vence, null)).toBe(vence)
  })

  it('devuelve el mismo tipo que recibe: el JWT guarda texto', () => {
    const iso = vencimientoEfectivo(vence.toISOString(), conNequi)
    expect(typeof iso).toBe('string')
    expect(iso).toBe('2026-09-16T13:10:00.000Z')
    expect(vencimientoEfectivo(null, conNequi)).toBeNull()
  })

  it('⚠ la gracia cubre los tres intentos del cron, uno al día', () => {
    /* Primer intento como tarde en la pasada anterior al vencimiento; el
       tercero, dos días después. Si la gracia fuera menor, el cliente quedaría
       fuera antes de que el cobro terminara de intentarse. */
    const ultimoIntento = (MAX_FALLOS - 1) * 24
    expect(HORAS_DE_GRACIA).toBeGreaterThanOrEqual(ultimoIntento)
  })
})

describe('⚠ la ventana del cron, con el caso del cliente', () => {
  /* Réplica exacta de las dos líneas del cron; la prueba de abajo comprueba
     que el cron las sigue escribiendo así. */
  const entra = (ahora, vence) =>
    vence.getTime() <= ahora.getTime() + HORAS_DE_ANTICIPO * H &&
    vence.getTime() >= ahora.getTime() - HORAS_DE_GRACIA * H

  /* La base y el VPS van en UTC: el cron corre a las 13:00 UTC (08:00 en
     Colombia) y su plan vence a las 13:10 UTC. */
  const vence = new Date('2026-09-13T13:10:00.000Z')
  const pasada = (dia) => new Date(`2026-09-${dia}T13:00:00.000Z`)

  it('su plan vence a las 13:10 y se cobra en la pasada de las 13:00 de ese día', () => {
    expect(entra(pasada(12), vence)).toBe(false)   // 25 h antes: todavía no
    expect(entra(pasada(13), vence)).toBe(true)
  })

  it('si se rechaza, los dos días siguientes siguen dentro', () => {
    expect(entra(pasada(14), vence)).toBe(true)
    expect(entra(pasada(15), vence)).toBe(true)
    expect(entra(pasada(17), vence)).toBe(false)
  })

  it('el cron escribe la ventana con las mismas constantes', () => {
    const cron = leer('app/api/cron/cobro-recurrente/route.js')
    expect(cron).toMatch(/const hastaVence = new Date\(ahora\.getTime\(\) \+ HORAS_DE_ANTICIPO \* 3600000\)/)
    expect(cron).toMatch(/const desdeVence = new Date\(ahora\.getTime\(\) - HORAS_DE_GRACIA \* 3600000\)/)
    /* Y lo `vencida` entra: el cron de las 08:00 marca así lo que venció ayer. */
    expect(cron).toMatch(/estado: \{ in: \['activa', 'vencida'\] \},\s*montoCOP: \{ gt: 0 \},\s*fechaVencimiento: \{ lte: hastaVence, gte: desdeVence \}/)
  })
})

describe('⚠ todos preguntan al mismo sitio', () => {
  it('el acceso: login, refresco del token, API y layout', () => {
    const auth = leer('lib/auth.js')
    expect(auth.match(/vencimientoEfectivo\(/g)?.length, 'login y refresco').toBe(2)
    expect(auth.match(/\.\.\.selectCobro/g)?.length, 'los dos select de login y el de refresco').toBe(3)

    const api = leer('lib/suscripcion.js')
    expect(api).toMatch(/organization: \{ select: selectCobro \}/)
    expect(api).toMatch(/new Date\(vencimientoEfectivo\(sub\.fechaVencimiento, sub\.organization\)\) < new Date\(\)/)

    const layout = leer('app/(dashboard)/layout.jsx')
    expect(layout).toMatch(/organization: \{ select: selectCobro \}/)
    expect(layout).toMatch(/vencimientoEfectivo\(/)
  })

  it('el estado que leen las pantallas trae el cobro', () => {
    const estado = leer('app/api/pagos/estado/route.js')
    expect(estado).toMatch(/\.\.\.selectCobro/)
    expect(estado).toMatch(/activo: cobroVivo\(org\)/)
    expect(estado.match(/cobroAutomatico,/g)?.length, 'las dos respuestas').toBe(2)
  })

  it('el aviso de arriba se calla, y solo habla si la pasarela rechazó', () => {
    const banner = leer('components/layout/SuscripcionBanner.jsx')
    expect(banner).toMatch(/estado\.cobroAutomatico\?\.activo === true/)
    const calla = banner.indexOf('if (!cobro.fallos) return null')
    const vencida = banner.indexOf('if (vencida) {')
    const modal = banner.indexOf('if (!countdown || modalCerrado) return null')
    expect(calla).toBeGreaterThan(-1)
    expect(calla, 'se calla antes del banner de vencida').toBeLessThan(vencida)
    expect(calla, 'y antes del modal de las 24 h').toBeLessThan(modal)
    expect(banner).toMatch(/>\s*No pudimos cobrar a \{cobro\.rotulo \|\| 'tu medio de pago'\}/)
  })

  it('la banda del inicio no pide renovar', () => {
    const inicio = leer('app/(dashboard)/dashboard/page.jsx')
    expect(inicio).toMatch(/<BandaSuscripcion dias=\{susInfo\.diasRestantes\} cobro=\{susInfo\.cobroAutomatico\} \/>/)
    expect(inicio).toMatch(/const urgente = !automatico && dias <= 7/)
    expect(inicio).toMatch(/\{automatico \? 'Automático' : 'Renovar'\}/)
  })

  it('ni correo, ni push, ni WhatsApp de «tu plan vence»', () => {
    const churn = leer('app/api/cron/churn-whatsapp/route.js')
    expect(churn.match(/NOT: whereCobroVivo,/g)?.length, 'antes y después de vencer').toBe(2)

    const recovery = leer('app/api/cron/recovery-whatsapp/route.js')
    expect(recovery).toMatch(/NOT: whereCobroVivo,/)

    const subs = leer('app/api/cron/suscripciones/route.js')
    expect(subs).toMatch(/organization: \{ is: \{ NOT: whereCobroVivo \} \},\s*NOT: \{/)
    /* Marcar vencida: fuera mientras dura la gracia, dentro al acabarse aunque
       el cron de cobro no haya pasado. */
    expect(subs).toMatch(/const finDeGracia = new Date\(ahora\.getTime\(\) - HORAS_DE_GRACIA \* 3600000\)/)
    expect(subs).toMatch(/OR: \[\s*\{ organization: \{ is: \{ NOT: whereCobroVivo \} \} \},\s*\{ fechaVencimiento: \{ lt: finDeGracia \} \},\s*\]/)
  })
})
