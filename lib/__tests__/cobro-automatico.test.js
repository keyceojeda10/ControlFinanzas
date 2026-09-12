// lib/__tests__/cobro-automatico.test.js
//
// «Yo coloco automáticamente el pago y ahí sale que está automático el cobro
//  con Nequi, pero no ha cobrado nada, y cada rato me sale un anuncio ahí, que
//  debo pagar, que debo pagar, pero yo tengo ya automático eso»
//                                                   — un cliente, 12 sep 2026
//
// «si Nequi no encuentra dinero y rechaza, el sistema debería de cerrarse […]
//  porque si no, lo que van a hacer es colocar la X, como no cobra nada, no se
//  hace el pago y ellos siguen dentro de la plataforma, y eso no se puede
//  permitir»                                        — el dueño, el mismo día
//
// Lo que se protege aquí: que la respuesta a «¿se le cobra solo y lo dejamos
// entrar?» salga de UN sitio, que todos la pregunten, y que un rechazo cierre.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  MAX_FALLOS, HORAS_DE_GRACIA, HORAS_DE_ANTICIPO, HORAS_DE_REINTENTO,
  whereCobroSinRechazo, selectCobro, selectResumenCobro,
  conCobroAutomatico, rechazoVigente, cobroSinRechazo, vencimientoEfectivo,
  motivoLegible, resumenCobro,
} from '@/lib/cobro-automatico'

const raiz = resolve(__dirname, '../..')
const quitarComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1 ')
const leer = (ruta) => quitarComentarios(readFileSync(resolve(raiz, ruta), 'utf8'))

const H = 3600000
/* El suyo: vence a las 13:10 UTC, las 08:10 en Colombia. */
const vence = new Date('2026-09-13T13:10:00.000Z')
const conNequi = { cobroAutomatico: true, wompiFuentePagoId: 'fuente-1', cobroRechazoVence: null }
const rechazado = { ...conNequi, cobroRechazoVence: vence, cobroRechazoMotivo: 'Saldo insuficiente', cobroFallos: 1 }

describe('¿se le cobra solo, sin que la pasarela haya dicho que no?', () => {
  it('con el medio guardado, el cobro encendido y sin rechazo, sí', () => {
    expect(cobroSinRechazo(conNequi, vence)).toBe(true)
  })

  it('⚠ con un rechazo del periodo que vence, NO', () => {
    expect(rechazoVigente(rechazado, vence)).toBe(true)
    expect(cobroSinRechazo(rechazado, vence)).toBe(false)
  })

  it('el rechazo no cuenta más allá de los fallos: uno solo ya cierra', () => {
    /* Antes hacían falta tres rechazos para dejar de callar los avisos, y la
       gracia de 72 h los cubría todos: tres días dentro sin pagar. */
    expect(cobroSinRechazo({ ...rechazado, cobroFallos: 0 }, vence)).toBe(false)
  })

  it('cualquier pago que mueva la fecha deja el rechazo atrás', () => {
    /* Wompi, MercadoPago, el administrador o un referido: todos extienden la
       suscripción y ninguno tiene que acordarse de borrar el rechazo. */
    const pagado = new Date(vence.getTime() + 30 * 24 * H)
    expect(rechazoVigente(rechazado, pagado)).toBe(false)
    expect(cobroSinRechazo(rechazado, pagado)).toBe(true)
  })

  it('sin suscripción que mirar, un rechazo apuntado manda', () => {
    expect(rechazoVigente(rechazado, null)).toBe(true)
  })

  it('sin medio guardado o con el cobro apagado, ni cobro ni rechazo', () => {
    for (const org of [{ ...rechazado, wompiFuentePagoId: null }, { ...rechazado, cobroAutomatico: false }, null]) {
      expect(conCobroAutomatico(org)).toBe(false)
      expect(rechazoVigente(org, vence)).toBe(false)
      expect(cobroSinRechazo(org, vence)).toBe(false)
    }
  })

  it('⚠ un select que no pidió el rechazo dice «no», nunca «sí»', () => {
    /* Equivocarse hacia «no» es enseñar un aviso de más; hacia «sí» sería
       dejar entrar 24 h gratis a quien la pasarela ya rechazó. */
    const { cobroRechazoVence: _, ...sinCampo } = conNequi
    expect(cobroSinRechazo(sinCampo, vence)).toBe(false)
    expect(Object.keys(selectCobro).sort()).toEqual(['cobroAutomatico', 'cobroRechazoVence', 'wompiFuentePagoId'])
  })

  it('el filtro de Prisma dice lo mismo que la función', () => {
    expect(whereCobroSinRechazo).toEqual({
      cobroAutomatico: true,
      wompiFuentePagoId: { not: null },
      cobroRechazoVence: null,
    })
  })
})

describe('⚠ la puerta: a qué hora se cierra', () => {
  it('sin rechazo, 24 h de gracia: un cron que no pasó o un cobro PENDING', () => {
    expect(HORAS_DE_GRACIA).toBe(24)
    const efectiva = vencimientoEfectivo(vence, conNequi)
    expect(efectiva.getTime() - vence.getTime()).toBe(24 * H)
  })

  it('⚠ con rechazo, a la hora exacta del vencimiento: ni un minuto más', () => {
    expect(vencimientoEfectivo(vence, rechazado)).toBe(vence)
  })

  it('sin cobro automático, la fecha no se toca', () => {
    expect(vencimientoEfectivo(vence, null)).toBe(vence)
    expect(vencimientoEfectivo(vence, { ...conNequi, cobroAutomatico: false })).toBe(vence)
  })

  it('devuelve el mismo tipo que recibe: el JWT guarda texto', () => {
    const iso = vencimientoEfectivo(vence.toISOString(), conNequi)
    expect(typeof iso).toBe('string')
    expect(iso).toBe('2026-09-14T13:10:00.000Z')
    expect(vencimientoEfectivo(vence.toISOString(), { ...rechazado, cobroRechazoVence: vence.toISOString() })).toBe(vence.toISOString())
    expect(vencimientoEfectivo(null, conNequi)).toBeNull()
  })
})

describe('lo que leen las pantallas', () => {
  it('con rechazo: el motivo dicho para una persona, y no está activo', () => {
    const r = resumenCobro({ ...rechazado, wompiFuenteRotulo: 'Nequi ···1234' }, vence)
    expect(r.activo).toBe(false)
    expect(r.conFuente).toBe(true)
    expect(r.rechazo).toEqual({ motivo: 'No había saldo suficiente.', fallos: 1 })
    expect(r.rotulo).toBe('Nequi ···1234')
  })

  it('sin rechazo: activo, y nada que decir', () => {
    const r = resumenCobro({ ...conNequi, cobroRefPendiente: 'cf-x' }, vence)
    expect(r.activo).toBe(true)
    expect(r.rechazo).toBeNull()
    expect(r.pendiente).toBe(true)
  })

  it('el select del resumen trae todo lo que el resumen lee', () => {
    for (const campo of ['cobroAutomatico', 'wompiFuentePagoId', 'cobroRechazoVence', 'wompiFuenteRotulo', 'cobroFallos', 'cobroRefPendiente', 'cobroRechazoMotivo']) {
      expect(selectResumenCobro[campo], campo).toBe(true)
    }
  })

  it('el motivo de Wompi no sale crudo', () => {
    expect(motivoLegible('Saldo insuficiente')).toBe('No había saldo suficiente.')
    expect(motivoLegible('DECLINED')).toMatch(/rechazado/)
    expect(motivoLegible('')).toMatch(/rechazado/)
    expect(motivoLegible('{"reason":["La fuente de pago no existe"]}')).toMatch(/Vuelve a guardar/)
  })
})

describe('⚠ la ventana del cron, con el caso del cliente', () => {
  /* Réplica exacta de las dos líneas del cron; la prueba de abajo comprueba
     que el cron las sigue escribiendo así. */
  const entra = (ahora, v) =>
    v.getTime() <= ahora.getTime() + HORAS_DE_ANTICIPO * H &&
    v.getTime() >= ahora.getTime() - HORAS_DE_REINTENTO * H

  /* La base y el VPS van en UTC: el cron corre a las 13:00 UTC (08:00 en
     Colombia). */
  const pasada = (dia) => new Date(`2026-09-${dia}T13:00:00.000Z`)

  it('«un día antes»: el primer cobro sale el 12, no el 13 a diez minutos de cerrar', () => {
    expect(entra(pasada(11), vence)).toBe(false)   // 48 h y 10 min antes
    expect(entra(pasada(12), vence)).toBe(true)
  })

  it('⚠ si el primero se rechaza, queda otra pasada ANTES de la hora de corte', () => {
    /* Es lo que el dueño pidió: que un Nequi sin saldo tenga un día para
       recargar sin perder ni una hora de acceso. */
    expect(entra(pasada(13), vence)).toBe(true)
    expect(pasada(13).getTime()).toBeLessThan(vence.getTime())
  })

  it('después de vencer se sigue intentando, ya con la puerta cerrada', () => {
    expect(entra(pasada(14), vence)).toBe(true)
    expect(entra(pasada(16), vence)).toBe(true)
    expect(entra(pasada(17), vence)).toBe(false)
  })

  it('⚠ los tres intentos del cron caben en la ventana', () => {
    const pasadasEnVentana = Math.floor((HORAS_DE_ANTICIPO + HORAS_DE_REINTENTO) / 24)
    expect(pasadasEnVentana).toBeGreaterThanOrEqual(MAX_FALLOS)
  })

  it('el cron escribe la ventana con las mismas constantes', () => {
    const cron = leer('app/api/cron/cobro-recurrente/route.js')
    expect(cron).toMatch(/const hastaVence = new Date\(ahora\.getTime\(\) \+ HORAS_DE_ANTICIPO \* 3600000\)/)
    expect(cron).toMatch(/const desdeVence = new Date\(ahora\.getTime\(\) - HORAS_DE_REINTENTO \* 3600000\)/)
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

  it('el estado que leen las pantallas trae el cobro y la hora del cierre', () => {
    const estado = leer('app/api/pagos/estado/route.js')
    expect(estado).toMatch(/\.\.\.selectResumenCobro/)
    expect(estado).toMatch(/\.\.\.resumenCobro\(org, sub\?\.fechaVencimiento \?\? null\)/)
    expect(estado.match(/cobroAutomatico,/g)?.length, 'las dos respuestas').toBe(2)
    /* La misma cuenta que la puerta, contra la misma suscripción. */
    expect(estado).toMatch(/accesoHasta:\s+vencimientoEfectivo\(sub\.fechaVencimiento, org\)/)
  })

  it('el aviso de arriba se calla sin rechazo, y con rechazo avisa del cierre', () => {
    const banner = leer('components/layout/SuscripcionBanner.jsx')
    expect(banner).toMatch(/estado\.cobroAutomatico\?\.activo === true/)
    const calla = banner.indexOf('if (cobro?.activo) return null')
    const rechazo = banner.indexOf('if (cobro?.rechazo && !vencida) {')
    const vencida = banner.indexOf('if (vencida) {')
    const modal = banner.indexOf('if (!countdown || modalCerrado) return null')
    expect(calla).toBeGreaterThan(-1)
    expect(rechazo, 'el rechazo va justo después de callarse').toBeGreaterThan(calla)
    expect(rechazo, 'antes del banner de vencida').toBeLessThan(vencida)
    expect(calla, 'y antes del modal de las 24 h').toBeLessThan(modal)
    expect(banner).toMatch(/>\s*No pudimos cobrar a \{cobro\.rotulo \|\| 'tu medio de pago'\}/)
    expect(banner).toMatch(/onClick=\{reintentar\}/)
    /* Lo viejo: callarse mientras no hubiera tres rechazos. */
    expect(banner).not.toMatch(/if \(!cobro\.fallos\) return null/)
  })

  it('la banda del inicio no pide renovar, salvo que hayan rechazado el cobro', () => {
    const inicio = leer('app/(dashboard)/dashboard/page.jsx')
    expect(inicio).toMatch(/<BandaSuscripcion dias=\{susInfo\.diasRestantes\} cobro=\{susInfo\.cobroAutomatico\} \/>/)
    expect(inicio).toMatch(/const urgente = rechazado \|\| \(!automatico && dias <= 7\)/)
    expect(inicio).toMatch(/\{rechazado \? 'Reintentar' : automatico \? 'Automático' : 'Renovar'\}/)
  })

  it('ni correo, ni push, ni WhatsApp de «tu plan vence», salvo con rechazo', () => {
    const churn = leer('app/api/cron/churn-whatsapp/route.js')
    expect(churn.match(/NOT: whereCobroSinRechazo,/g)?.length, 'antes y después de vencer').toBe(2)

    const recovery = leer('app/api/cron/recovery-whatsapp/route.js')
    expect(recovery).toMatch(/NOT: whereCobroSinRechazo,/)

    const subs = leer('app/api/cron/suscripciones/route.js')
    expect(subs).toMatch(/organization: \{ is: \{ NOT: whereCobroSinRechazo \} \},\s*NOT: \{/)
    /* Marcar vencida: fuera mientras dura la gracia, dentro al acabarse aunque
       el cron de cobro no haya pasado. */
    expect(subs).toMatch(/const finDeGracia = new Date\(ahora\.getTime\(\) - HORAS_DE_GRACIA \* 3600000\)/)
    expect(subs).toMatch(/OR: \[\s*\{ organization: \{ is: \{ NOT: whereCobroSinRechazo \} \} \},\s*\{ fechaVencimiento: \{ lt: finDeGracia \} \},\s*\]/)

    for (const [nombre, src] of [['churn', churn], ['recovery', recovery], ['suscripciones', subs]]) {
      expect(src, `${nombre} sigue con el filtro viejo`).not.toMatch(/whereCobroVivo/)
    }
  })
})

describe('⚠ la pantalla de acceso suspendido no se salta', () => {
  const pantalla = leer('app/suscripcion-vencida/page.jsx')

  it('solo devuelve al panel si la puerta dejaría entrar', () => {
    /* Con rechazo `accesoHasta` es el vencimiento, que ya pasó: se queda aquí.
       Tener el medio guardado ya no sirve para salir. */
    expect(pantalla).toMatch(/if \(data\.accesoHasta && new Date\(data\.accesoHasta\) > new Date\(\)\) \{/)
    expect(pantalla).not.toMatch(/conCobroAutomatico|cobroAutomatico\?\.activo/)
  })

  it('dice que no pudo cobrar, y ofrece reintentar y cambiar el medio', () => {
    expect(pantalla).toMatch(/\{rechazo \? 'No pudimos cobrar tu plan' : 'Tu suscripción venció'\}/)
    expect(pantalla).toMatch(/onClick=\{reintentar\}/)
    expect(pantalla).toMatch(/href="\/configuracion\/plan\?suscribir=1"/)
  })

  it('⚠ pulsar reintentar no abre: abre el pago aprobado', () => {
    /* `entrar` solo lo llama el hook cuando el servidor dice «al día», o la
       carga cuando `accesoHasta` ya es futuro. */
    expect(pantalla).toMatch(/useReintentarCobro\(\{ onPagado: entrar \}\)/)
    const hook = leer('components/pagos/useReintentarCobro.js')
    expect(hook).toMatch(/if \(d\.alDia\) return pagado\(\)/)
    /* Mandado no es cobrado: nace PENDING y a los tres segundos puede ser DECLINED. */
    expect(hook).toMatch(/case 'enviado':\s*case 'pendiente':\s*return esperar\(\)/)
    expect(hook).toMatch(/case 'aprobado':\s*case 'no-hace-falta':\s*return pagado\(\)/)
    expect(hook.match(/return pagado\(\)/g)).toHaveLength(2)
    const ruta = leer('app/api/pagos/wompi/reintentar/route.js')
    expect(ruta).toMatch(/alDia: !cobro\.pendiente && !cobro\.rechazo && Boolean\(hasta && new Date\(hasta\) > new Date\(\)\)/)
    expect(ruta).not.toMatch(/activarPlanPagado|fechaVencimiento:\s*new Date/)
  })
})
