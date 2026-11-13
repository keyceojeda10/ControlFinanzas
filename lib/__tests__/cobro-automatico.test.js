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
  DIAS_DE_REINTENTO, NOCHES_DE_REINTENTO, tocaIntentar, esNocheDeQuincena, quePasaEnLaPasada,
  whereCobroSinRechazo, whereConCobroAutomatico, whereReintentandoCobro, reintentandoCobro,
  selectCobro, selectResumenCobro,
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
    // Termina en punto: detrás va «Si no se paga…».
    expect(motivoLegible('La transacción fue rechazada (Sandbox)')).toBe('El pago fue rechazado: La transacción fue rechazada (Sandbox).')
    expect(motivoLegible('Tarjeta bloqueada.')).toBe('El pago fue rechazado: Tarjeta bloqueada.')
    expect(motivoLegible('{"reason":["La fuente de pago no existe"]}')).toMatch(/Vuelve a guardar/)
  })
})

describe('⚠ la ventana del cron, con el caso del cliente', () => {
  /* Réplica exacta de las dos líneas del cron; la prueba de abajo comprueba
     que el cron las sigue escribiendo así. */
  const entra = (ahora, v) =>
    v.getTime() <= ahora.getTime() + HORAS_DE_ANTICIPO * H &&
    v.getTime() >= ahora.getTime() - HORAS_DE_REINTENTO * H

  /* La base y el VPS van en UTC: el cobro normal corre a las 13:00 UTC (08:00
     en Colombia), como siempre. Los reintentos, a las 03:00 UTC (22:00). */
  const pasada = (dia) => new Date(`2026-09-${dia}T13:00:00.000Z`)
  const nocheDe = (dia) => new Date(`2026-09-${dia + 1}T03:00:00.000Z`)

  it('«un día antes»: el primer cobro sale el 12, no el 13 a diez minutos de cerrar', () => {
    expect(entra(pasada(11), vence)).toBe(false)   // 48 h y 10 min antes
    expect(entra(pasada(12), vence)).toBe(true)
  })

  it('⚠ si el primero se rechaza, esa misma noche se reintenta, ANTES de la hora de corte', () => {
    /* Es lo que el dueño pidió: que un Nequi sin saldo tenga un día para
       recargar sin perder ni una hora de acceso. Y desde el 13 nov: «si a
       las 8 de la mañana ese mismo día no se pudo cobrar, reintentar a las 10». */
    expect(entra(nocheDe(12), vence)).toBe(true)
    expect(tocaIntentar(vence, nocheDe(12))).toBe(true)
    expect(nocheDe(12).getTime()).toBeLessThan(vence.getTime())
  })

  it('después de vencer se sigue intentando 15 días, ya con la puerta cerrada', () => {
    expect(DIAS_DE_REINTENTO).toBe(15)
    expect(entra(nocheDe(13), vence)).toBe(true)
    expect(entra(nocheDe(27), vence)).toBe(true)    // noche 14
    expect(entra(nocheDe(29), vence)).toBe(false)   // noche 16
  })

  it('⚠ el tope de rechazos cabe en las noches del calendario', () => {
    /* Antes de vencer caben dos noches; después, las del calendario. */
    expect(2 + NOCHES_DE_REINTENTO.length).toBeLessThanOrEqual(MAX_FALLOS)
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
    // Desde la tarea 2, el login pasa por lib/auth-sesion.js (revisarCuenta +
    // armarSesion); ahí vive su `...selectCobro` y su `vencimientoEfectivo(`.
    // El refresco del token sigue en lib/auth.js.
    const auth = leer('lib/auth.js')
    const sesion = leer('lib/auth-sesion.js')
    expect(auth.match(/vencimientoEfectivo\(/g)?.length, 'refresco').toBe(1)
    expect(sesion.match(/vencimientoEfectivo\(/g)?.length, 'login').toBe(1)
    expect(auth.match(/\.\.\.selectCobro/g)?.length, 'el select del refresco').toBe(1)
    expect(sesion.match(/\.\.\.selectCobro/g)?.length, 'el select compartido del login (INCLUDE_USUARIO_SESION)').toBe(1)
    // Las dos búsquedas de authorize() (teléfono y correo) usan ESE mismo
    // include, no uno cada una — por eso el select de login aparece una sola
    // vez en la fuente y dos en su uso.
    expect(auth.match(/include: INCLUDE_USUARIO_SESION/g)?.length, 'las dos búsquedas del login').toBe(2)

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

  it('el aviso de arriba se calla con el cobro puesto, AUNQUE lo hayan rechazado', () => {
    /* 13 nov 2026: «que no sea tan alarmante ni obvio». Antes, con rechazo,
       franja roja con la hora del cierre: lo ponía en guardia para quitar el
       medio. Ahora el cron insiste de noche; al vencer se cierra igual. */
    const banner = leer('components/layout/SuscripcionBanner.jsx')
    expect(banner).toMatch(/estado\.cobroAutomatico\?\.activo === true \|\|\s*estado\.cobroAutomatico\?\.conFuente === true/)
    const calla = banner.indexOf('if (cobro?.activo) return null')
    const conRechazo = banner.indexOf('if (cobro?.conFuente && !vencida) return null')
    const vencida = banner.indexOf('if (vencida) {')
    const modal = banner.indexOf('if (!countdown || modalCerrado) return null')
    expect(calla).toBeGreaterThan(-1)
    expect(conRechazo).toBeGreaterThan(calla)
    expect(conRechazo, 'antes del banner de vencida').toBeLessThan(vencida)
    expect(conRechazo, 'y antes del modal de las 24 h').toBeLessThan(modal)
    expect(banner).not.toMatch(/No pudimos cobrar/)
  })

  it('la banda del inicio no pide renovar con el cobro puesto, ni con rechazo', () => {
    const inicio = leer('app/(dashboard)/dashboard/page.jsx')
    expect(inicio).toMatch(/<BandaSuscripcion dias=\{susInfo\.diasRestantes\} cobro=\{susInfo\.cobroAutomatico\} \/>/)
    expect(inicio).toMatch(/const automatico = cobro\?\.activo === true \|\| cobro\?\.conFuente === true/)
    expect(inicio).toMatch(/const urgente = !automatico && dias <= 7/)
    expect(inicio).toMatch(/\{automatico \? 'Automático' : 'Renovar'\}/)
    expect(inicio).not.toMatch(/No pudimos cobrar a/)
  })

  it('ni correo, ni push, ni WhatsApp de «tu plan vence» mientras se le cobra, ni con rechazo', () => {
    const churn = leer('app/api/cron/churn-whatsapp/route.js')
    expect(churn.match(/NOT: whereReintentandoCobro\(ahora\),/g)?.length, 'antes y después de vencer').toBe(2)

    const recovery = leer('app/api/cron/recovery-whatsapp/route.js')
    expect(recovery).toMatch(/NOT: whereReintentandoCobro\(ahora\),/)

    const motor = leer('lib/seguimiento/motor.js')
    expect(motor).toMatch(/NOT: whereReintentandoCobro\(ahora\),/)

    const subs = leer('app/api/cron/suscripciones/route.js')
    expect(subs).toMatch(/organization: \{ is: \{ NOT: whereReintentandoCobro\(ahora\) \} \},\s*NOT: \{/)
    /* Marcar vencida: fuera mientras dura la gracia, dentro al acabarse aunque
       el cron de cobro no haya pasado. */
    expect(subs).toMatch(/const finDeGracia = new Date\(ahora\.getTime\(\) - HORAS_DE_GRACIA \* 3600000\)/)
    expect(subs).toMatch(/OR: \[\s*\{ organization: \{ is: \{ NOT: whereCobroSinRechazo \} \} \},\s*\{ fechaVencimiento: \{ lt: finDeGracia \} \},\s*\]/)
    /* …pero el correo y el push de «se venció» no salen mientras se le cobra. */
    const marca = subs.indexOf("data: { estado: 'vencida' },")
    const calla = subs.indexOf('if (reintentandoCobro(sub.organization, sub.fechaVencimiento, ahora)) continue')
    const correo = subs.indexOf('emailSuscripcionVencida({')
    expect(calla).toBeGreaterThan(marca)
    expect(correo).toBeGreaterThan(calla)

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

describe('⚠ insistir como Netflix, de noche y sin hacer ruido (13 nov 2026)', () => {
  /* «Netflix te insiste el cobro si tú tienes un pago automático autorizado
      hasta que te cobre» · «puede cobrarse en la noche» · «que no sea tan
      alarmante ni obvio» — el dueño.

     El caso de E.P: rechazos el 5, 6 y 7 de noviembre, y el cron se rindió.
     Su plan vencía el 9 nov a las 13:00 UTC (08:00 en Colombia). */
  const venceEP = new Date('2026-11-09T13:00:00.000Z')
  /* La pasada de la noche del día `d` en Bogotá: 22:00 = 03:00 UTC del día siguiente. */
  const noche = (d) => new Date(Date.UTC(2026, 10, d + 1, 3, 0, 0))
  const noches = (desde, hasta) => {
    const r = []
    for (let d = desde; d <= hasta; d++) if (tocaIntentar(venceEP, noche(d))) r.push(d)
    return r
  }

  it('antes de vencer, las dos noches de la ventana', () => {
    expect(noches(1, 8)).toEqual([7, 8])
  })

  it('después: tres seguidas, luego espaciadas, más las noches de quincena, hasta 15 días', () => {
    /* noche 0 = la del 9 (vence a las 08:00): 9, 10, 11, 13, 15, 18, 21, 24
       por el calendario; el 16 por quincena; y se acaba en la noche 15 (el
       24), antes del fin de mes. */
    expect(noches(9, 40)).toEqual([9, 10, 11, 13, 15, 16, 18, 21, 24])
  })

  it('el tope no corta el calendario: el cobro de la mañana más todas las noches', () => {
    expect(1 + noches(1, 40).length).toBeLessThanOrEqual(MAX_FALLOS)
    /* El peor mes: vence el 13 y la ventana pisa el 15, 16, 30, 31 y 1. */
    const v = new Date('2026-10-17T13:00:00.000Z')
    let n = 1
    for (let d = 10; d <= 50; d++) if (tocaIntentar(v, new Date(Date.UTC(2026, 9, d + 1, 3)))) n++
    expect(n).toBeLessThanOrEqual(MAX_FALLOS)
  })

  it('las noches de quincena son las del calendario de Bogotá', () => {
    /* La pasada del 15 en Bogotá es a las 03:00 UTC del 16. */
    expect(esNocheDeQuincena(new Date('2026-11-16T03:00:00.000Z'))).toBe(true)
    expect(esNocheDeQuincena(new Date('2026-11-17T03:00:00.000Z'))).toBe(true)   // 16
    expect(esNocheDeQuincena(new Date('2026-11-18T03:00:00.000Z'))).toBe(false)  // 17
    expect(esNocheDeQuincena(new Date('2026-03-01T03:00:00.000Z'))).toBe(true)   // 28 feb, último
    expect(esNocheDeQuincena(new Date('2026-11-01T03:00:00.000Z'))).toBe(true)   // 31 oct, último
    expect(esNocheDeQuincena(new Date('2026-11-21T03:00:00.000Z'))).toBe(false)  // 20
  })

  it('⚠ la mañana cobra como siempre; la noche, solo los reintentos', () => {
    const ahora = new Date('2026-11-08T13:00:00.000Z')
    /* «mantener el cobro que se estaba haciendo normal, que es el primero» */
    expect(quePasaEnLaPasada({ pasada: 'manana', vigente: false, vence: venceEP, ahora })).toBe('cobrar')
    expect(quePasaEnLaPasada({ pasada: 'manana', vigente: true, fallos: 1, vence: venceEP, ahora })).toBe('no-es-suyo')
    /* «y los reintentos sí a las 10 de la noche» */
    expect(quePasaEnLaPasada({ pasada: 'noche', vigente: false, vence: venceEP, ahora: noche(7) })).toBe('no-es-suyo')
    expect(quePasaEnLaPasada({ pasada: 'noche', vigente: true, fallos: 1, vence: venceEP, ahora: noche(7) })).toBe('cobrar')
    expect(quePasaEnLaPasada({ pasada: 'noche', vigente: true, fallos: 4, vence: venceEP, ahora: noche(12) })).toBe('hoy-no')
    expect(quePasaEnLaPasada({ pasada: 'noche', vigente: true, fallos: MAX_FALLOS, vence: venceEP, ahora: noche(13) })).toBe('agotado')
    /* Sin parámetro es la mañana: la línea del crontab de siempre no cambia. */
    expect(quePasaEnLaPasada({ vigente: false, vence: venceEP, ahora })).toBe('cobrar')
  })

  it('el cron pregunta a `quePasaEnLaPasada` antes de cobrar, y la noche va por parámetro', () => {
    const cron = leer('app/api/cron/cobro-recurrente/route.js')
    expect(cron).toMatch(/const pasada = new URL\(req\.url\)\.searchParams\.get\('pasada'\) === 'noche' \? 'noche' : 'manana'/)
    const toca = cron.indexOf('const toca = quePasaEnLaPasada({ pasada, vigente, fallos: org.cobroFallos, vence, ahora })')
    expect(toca).toBeGreaterThan(-1)
    expect(cron.indexOf("if (toca !== 'cobrar') { res.otraPasada++; continue }")).toBeGreaterThan(toca)
    expect(cron.indexOf('lanzarCobro({')).toBeGreaterThan(toca)
    /* El reintento de las 22:00 sale 14 h después del cobro de las 08:00. */
    expect(cron).toMatch(/const HORAS_ENTRE_INTENTOS = 12\b/)
  })

  it('mientras se le cobra no sale ningún aviso, ni con rechazo', () => {
    const ahora = new Date('2026-11-12T03:00:00.000Z')
    expect(whereConCobroAutomatico).toEqual({ cobroAutomatico: true, wompiFuentePagoId: { not: null } })
    const w = whereReintentandoCobro(ahora)
    expect(w.cobroRechazoVence).toBeUndefined()
    expect(w.suscripciones.some.fechaVencimiento.gte.toISOString()).toBe('2026-10-28T03:00:00.000Z')
    expect(reintentandoCobro(rechazado, venceEP, ahora)).toBe(true)
    expect(reintentandoCobro(rechazado, new Date('2026-10-20T00:00:00Z'), ahora)).toBe(false)
    expect(reintentandoCobro({ cobroAutomatico: true, wompiFuentePagoId: null }, venceEP, ahora)).toBe(false)
  })
})
