// lib/__tests__/cobro-recurrente.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Estamos bajando demasiado el MRR […] prácticamente en la ruina, y te hablo
//  en serio, no por exagerar. […] en Wompi no tenemos pagos recurrentes
//  activados.»                                          — el dueño, 1 sep 2026
//
// Medido en producción ese día:
//
//   · de los que pagaron en junio, volvió en julio el 86 %
//   · de los que pagaron en julio, volvió en agosto el 64 %
//   · 25 de los 59 negocios que han pagado alguna vez pagaron UNA sola vez
//   · de 653 suscripciones, 648 eran `pago_unico`; UNA sola recurrente
//   · 83 de los 117 pagos entraron marcados como `manual`
//
// ⚠ ESTO COBRA DINERO DE CLIENTES REALES SIN QUE ESTÉN DELANTE. Lo que se
// comprueba aquí no es que funcione: es que **no pueda cobrar de más, ni cobrar
// antes de tiempo, ni cobrar dos veces**. Un fallo aquí no es una pantalla fea,
// es plata de alguien.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { referenciaDeCobro, leerReferencia } from '@/lib/wompi'

const raiz = resolve(__dirname, '../..')
const quitarComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1 ')

const cron    = quitarComentarios(readFileSync(resolve(raiz, 'app/api/cron/cobro-recurrente/route.js'), 'utf8'))
const wompi   = quitarComentarios(readFileSync(resolve(raiz, 'lib/wompi.js'), 'utf8'))
const webhook = quitarComentarios(readFileSync(resolve(raiz, 'app/api/pagos/wompi/webhook/route.js'), 'utf8'))
const fuente  = quitarComentarios(readFileSync(resolve(raiz, 'app/api/pagos/wompi/fuente/route.js'), 'utf8'))

describe('⚠ la referencia: lo único que une el cobro con quien lo paga', () => {
  it('lo que se escribe se puede volver a leer', () => {
    /* Si el constructor y el lector se separan, entra plata APROBADA que no se
       puede aplicar a nadie — y solo se descubre cuando el cliente reclama que
       pagó y sigue bloqueado. Por eso viven en el mismo fichero y por eso esta
       prueba los hace pasar por el mismo aro. */
    const ref = referenciaDeCobro('cmm7iigyr00011t2rwyg9luph', 'professional', 'mensual')
    const leido = leerReferencia(ref)
    expect(leido).not.toBeNull()
    expect(leido.orgId).toBe('cmm7iigyr00011t2rwyg9luph')
    expect(leido.plan).toBe('professional')
    expect(leido.periodo).toBe('mensual')
  })

  it('y aguanta un id con guiones', () => {
    /* Los cuid no llevan guiones hoy. El lector cuenta las piezas desde el
       final justamente por si algún día los llevaran. */
    const ref = referenciaDeCobro('org-con-guiones', 'basic', 'anual')
    expect(leerReferencia(ref)).toMatchObject({ orgId: 'org-con-guiones', plan: 'basic', periodo: 'anual' })
  })

  it('no se traga cualquier cosa', () => {
    expect(leerReferencia('')).toBeNull()
    expect(leerReferencia('pago-normal-123')).toBeNull()
    expect(leerReferencia('cf-solo')).toBeNull()
  })

  it('el webhook usa el lector del lib, no una copia suya', () => {
    expect(webhook).toMatch(/leerReferencia/)
    expect(webhook).not.toMatch(/function parseReferencia/)
  })
})

describe('⚠ el cron no puede cobrar de más', () => {
  it('nace apagado, y apagado no consulta ni cobra', () => {
    /* Un cron que cobra no se estrena a ciegas. */
    const i = cron.indexOf('if (!ENCENDIDO)')
    const consulta = cron.indexOf('prisma.organization.findMany')
    expect(i).toBeGreaterThan(-1)
    expect(consulta).toBeGreaterThan(i)
    expect(cron).toMatch(/COBRO_RECURRENTE_ACTIVO === '1'/)
  })

  it('solo cobra a quien YA venció', () => {
    /* Cobrar antes de tiempo es cobrarle un mes que todavía no usó. */
    expect(cron).toMatch(/fechaVencimiento: \{ lte: ahora \}/)
  })

  it('un intento al día como mucho', () => {
    /* Sin esto, dos ejecuciones del cron el mismo día cobran dos veces. */
    expect(cron).toMatch(/HORAS_ENTRE_INTENTOS/)
    expect(cron).toMatch(/cobroUltimoIntento: \{ lt: desdeIntento \}/)
  })

  it('el intento se apunta ANTES de llamar a Wompi', () => {
    /* Al revés, un proceso que se cae a mitad deja el cobro hecho y sin marcar:
       mañana vuelve a cobrar. Apuntándolo antes, el peor caso es no reintentar
       hoy — que es infinitamente más barato. */
    const marca = cron.indexOf('cobroUltimoIntento: ahora')
    const llamada = cron.indexOf('cobrarConFuente({')
    expect(marca).toBeGreaterThan(-1)
    expect(llamada).toBeGreaterThan(marca)
  })

  it('se para a los tres rechazos', () => {
    expect(cron).toMatch(/MAX_FALLOS = 3/)
    expect(cron).toMatch(/cobroFallos: \{ lt: MAX_FALLOS \}/)
  })
})

describe('⚠ un solo camino para activar el plan', () => {
  it('el cron NO activa nada', () => {
    /* Si activara aquí Y en el webhook, un cobro aprobado sumaría dos meses.
       El cron dispara y se calla. */
    expect(cron).not.toMatch(/activarPlanPagado/)
  })

  it('el contador de fallos se reinicia en el webhook, no en el cron', () => {
    /* «Wompi aceptó la petición» no es «el dinero entró»: la transacción nace
       PENDING y puede acabar DECLINED. Reiniciar al enviarla haría que tres
       cobros que luego se caen contaran como tres éxitos. */
    expect(cron).not.toMatch(/cobroFallos: 0/)
    expect(webhook).toMatch(/cobroFallos: 0/)
  })

  it('y solo después de saber que está APROBADO', () => {
    const aprobado = webhook.indexOf("estado !== 'APPROVED'")
    const reinicio = webhook.indexOf('cobroFallos: 0')
    expect(aprobado).toBeGreaterThan(-1)
    expect(reinicio).toBeGreaterThan(aprobado)
  })
})

describe('⚠ el medio de pago es del cliente, no nuestro', () => {
  it('se puede quitar tan fácil como poner', () => {
    /* Es lo que separa un cobro autorizado de uno que el cliente no puede
       parar. */
    expect(fuente).toMatch(/export async function DELETE/)
    expect(fuente).toMatch(/wompiFuentePagoId: null/)
  })

  it('solo el dueño lo toca', () => {
    const veces = (fuente.match(/rol !== 'owner'/g) ?? []).length
    expect(veces).toBe(2)   // guardar y quitar
  })

  it('se piden los DOS permisos que exige Wompi', () => {
    /* La política de privacidad y la autorización de datos personales. Sin
       ellos el cobro posterior no está autorizado por el titular. */
    expect(wompi).toMatch(/acceptance_token: aceptacion\.politica/)
    expect(wompi).toMatch(/accept_personal_auth: aceptacion\.datos/)
  })

  it('el cobro va marcado como recurrente', () => {
    /* `recurrent: true` le dice a la franquicia que está autorizado de
       antemano. Sin él, el banco puede rechazarlo por venir sin titular. */
    expect(wompi).toMatch(/recurrent: true/)
  })
})

describe('⚠ los datos de tarjeta no pasan por el servidor', () => {
  it('el endpoint recibe un token, nunca un número', () => {
    /* El widget de Wompi tokeniza dentro de su iframe. Si algún día esto
       aceptara un PAN, el fallo no sería de código: sería de diseño, y nos
       metería en una obligación legal que hoy no tenemos. */
    for (const prohibido of [/\bnumber\b/, /\bcvc\b/, /exp_month/, /card_holder/]) {
      expect(fuente, `el endpoint no debe conocer ${prohibido}`).not.toMatch(prohibido)
    }
    expect(fuente).toMatch(/const \{ token, tipo \} = await req\.json\(\)/)
  })
})
