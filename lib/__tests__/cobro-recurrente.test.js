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
const pantalla = quitarComentarios(readFileSync(resolve(raiz, 'app/(dashboard)/configuracion/plan/page.jsx'), 'utf8'))
const hoja     = quitarComentarios(readFileSync(resolve(raiz, 'components/pagos/HojaSuscripcion.jsx'), 'utf8'))
const receptor = quitarComentarios(readFileSync(resolve(raiz, 'app/api/pagos/wompi/token/route.js'), 'utf8'))
const crear    = quitarComentarios(readFileSync(resolve(raiz, 'app/api/pagos/wompi/crear/route.js'), 'utf8'))

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

describe('⚠ la pantalla del plan: suscribirse es lo predeterminado', () => {
  it('nace en «suscripción», no en «pago único»', () => {
    /* «que el pago recurrente sea lo predeterminado, supongo» — el dueño, 1 sep
       2026. Lo que la mayoría debería elegir tiene que venir elegido: quien
       tiene que acordarse cada mes de entrar a pagar, deja de pagar. */
    expect(pantalla).toMatch(/useState\('suscripcion'\)/)
  })

  it('⚠ pagar es lo PRIMERO de la pantalla, y nada hay que desplegar', () => {
    /* «El pago es lo primordial, lo que más se tiene que ver, que la gente no
       batalle para pagar el plan» — el dueño, 1 sep 2026. Estaba debajo del uso
       y detrás de un «Cambiar de plan» que había que abrir. */
    const pagar  = pantalla.indexOf('Pagar mi plan')
    const planes = pantalla.indexOf('Cambiar de plan')
    const uso    = pantalla.indexOf('Uso actual')
    expect(pagar).toBeGreaterThan(-1)
    expect(pagar).toBeLessThan(planes)
    expect(pagar).toBeLessThan(uso)
    /* Y ya no hay nada colapsado que abrir para ver los planes ni el pago. */
    expect(pantalla).not.toMatch(/showPlanes/)
  })

  it('el período decide el precio del botón, y vive en su misma tarjeta', () => {
    /* Estaba abajo, entre los planes: cambiaba la cifra del botón de arriba
       desde un sitio que no se veía. Y sigue escondido en suscripción, que es
       siempre mensual. */
    const pagar   = pantalla.indexOf('Pagar mi plan')
    const periodo = pantalla.indexOf('setPeriodo(p.key)')
    const planes  = pantalla.indexOf('Cambiar de plan')
    expect(periodo).toBeGreaterThan(pagar)
    expect(periodo).toBeLessThan(planes)
    expect(pantalla).toMatch(/\{!esSuscripcion && \(/)
  })

  it('y el período existe aunque no haya Wompi', () => {
    /* En los países de MercadoPago y en los de cobro a mano no hay suscripción,
       pero el trimestral y el anual sí. Meterlo dentro del bloque de Wompi los
       dejaba sin poder pagar más de un mes. */
    const wompi = pantalla.indexOf("{gateway === 'wompi' && (")
    const cierre = pantalla.indexOf('</>\n        )}', wompi)
    const periodo = pantalla.indexOf('setPeriodo(p.key)')
    expect(cierre).toBeGreaterThan(-1)
    expect(periodo).toBeGreaterThan(cierre)
  })

  it('⚠ los botones que cambian de rótulo no componen capa ni se reciclan', () => {
    /* Con capturas desde un iPhone, 1 sep 2026: al cambiar de modo salía
       «Suscribirme in · $259.000» y «S Pagar mi pla $259.000/mes» — los dos
       rótulos pintados uno encima del otro. `active:scale` obliga a WebKit a
       componer el botón en su propia capa y al cambiar el texto no la
       invalida. El `key` es el cierre: React tira el elemento y lo crea nuevo.

       ⚠ Esto NO se pudo comprobar en un WebKit de verdad (no arranca en la
       máquina de desarrollo), así que la prueba guarda la decisión, no el
       resultado. */
    const btn = (marca) => {
      const i = pantalla.indexOf(marca)
      expect(i, `no encontré ${marca}`).toBeGreaterThan(-1)
      return pantalla.slice(i, i + 700)
    }
    for (const marca of ['key={`pagar-', 'key={`plan-']) {
      const trozo = btn(marca)
      expect(trozo, `${marca} no debe llevar transition-all`).not.toMatch(/transition-all/)
      expect(trozo, `${marca} no debe llevar active:scale`).not.toMatch(/active:scale/)
    }
    /* Y el key tiene que cambiar con lo que cambia el rótulo. */
    expect(pantalla).toMatch(/key=\{`pagar-\$\{modoPago\}-\$\{periodoEfectivo\}`\}/)
    expect(pantalla).toMatch(/key=\{`plan-\$\{p\.key\}-\$\{modoPago\}-\$\{periodoEfectivo\}`\}/)
  })

  it('el interruptor no dice «pago único», que se entendía al revés', () => {
    /* «Esa opción parece como si solamente pagara una vez y no tuviera que
       pagar más nada.» Los rótulos dicen QUIÉN paga, no cuántas veces. */
    expect(pantalla).toMatch(/label: 'Se cobra solo'/)
    expect(pantalla).toMatch(/label: 'Pago yo'/)
    expect(pantalla).not.toMatch(/'Pago único'/)
    /* Y el texto de apoyo desmiente el malentendido en su propia frase. */
    expect(pantalla).toMatch(/El plan se sigue venciendo cada mes/)
  })

  it('y solo se ofrece donde hay con qué cobrarla', () => {
    /* MercadoPago y el cobro a mano por WhatsApp no guardan medio de pago.
       Ofrecer allí una suscripción sería prometer algo que no ocurre. */
    expect(pantalla).toMatch(/esSuscripcion = gateway === 'wompi' && modoPago === 'suscripcion'/)
  })

  it('⚠ la suscripción SIEMPRE cobra el precio mensual', () => {
    /* Éste es el fallo de dinero que acecha aquí: si quedara puesto «anual» del
       selector de período y la suscripción cobrara ese total, el webhook leería
       «mensual» en la referencia y activaría UN mes por un año de plata. El
       precio, el mensaje y el checkout tienen que hablar del período EFECTIVO,
       que en suscripción es siempre mensual. */
    expect(pantalla).toMatch(/const periodoEfectivo = esSuscripcion \? 'mensual' : periodo/)
    expect(pantalla).not.toMatch(/plan: planKey, periodo \}/)
    const calculo = pantalla.slice(pantalla.indexOf('const calcularPrecio'), pantalla.indexOf('const activarPlanWA'))
    expect(calculo).not.toMatch(/periodo ===/)
    expect(calculo).toMatch(/periodoEfectivo ===/)
  })

  it('el botón dice lo que va a pasar', () => {
    /* «Pagar» a secas no distingue un cobro que se repite de uno que no, y esa
       confusión se paga en devoluciones. */
    expect(pantalla).toMatch(/esSuscripcion \? 'Suscribirme'/)
    expect(pantalla).toMatch(/'Pagar un mes'/)
  })
})

describe('⚠ la hoja de suscripción', () => {
  it('abre el widget en modo tokenización, no de cobro', () => {
    /* Tokenizar guarda el medio de pago SIN cobrar. Si esto se abriera en modo
       cobro, el cliente pagaría dos veces: aquí y en el checkout. */
    expect(hoja).toMatch(/data-widget-operation', 'tokenize'/)
  })

  it('el <script> se cuelga a mano, porque React no ejecuta los del JSX', () => {
    expect(hoja).toMatch(/document\.createElement\('script'\)/)
    expect(hoja).toMatch(/form\.appendChild\(s\)/)
  })

  it('lleva el plan en el formulario que va al receptor', () => {
    expect(hoja).toMatch(/action="\/api\/pagos\/wompi\/token"/)
    expect(hoja).toMatch(/name="plan"/)
  })

  it('el precio que enseña es el que se va a cobrar', () => {
    /* El primer cobro lo calcula el servidor aplicando el descuento de la
       organización. Enseñar aquí el precio de lista sería prometer un número y
       cobrar otro. */
    expect(pantalla).toMatch(/precioMensual=\{Math\.round\(info\.precio \* \(1 - descuentoOrg \/ 100\)\)\}/)
    expect(receptor).toMatch(/monto = Math\.round\(precio \* \(1 - \(org\.descuento \?\? 0\) \/ 100\)\)/)
  })

  it('se puede cerrar tocando fuera', () => {
    /* El clic afuera no cerraba NINGUNO de los 47 modales del sistema hasta que
       se arregló. No volver a dejar uno sin salida. */
    expect(hoja).toMatch(/onClick=\{onCerrar\}/)
    expect(hoja).toMatch(/e\.stopPropagation\(\)/)
  })

  it('ni la hoja ni la pantalla tocan datos de tarjeta', () => {
    for (const src of [hoja, pantalla]) {
      for (const prohibido of [/\bcvc\b/, /exp_month/, /card_holder/]) {
        expect(src).not.toMatch(prohibido)
      }
    }
  })
})


describe('⚠ el primer cobro al suscribirse', () => {
  it('NO cobra a quien ya tiene un plan de pago vigente', () => {
    /* Ése ya pagó: cobrarle otra vez por guardar su tarjeta sería cobrarle dos
       veces el mismo mes. El cron toma el relevo cuando le venza. */
    expect(receptor).toMatch(/fechaVencimiento: \{ gt: ahora \}/)
    const consulta = receptor.indexOf('fechaVencimiento: { gt: ahora }')
    const salida   = receptor.indexOf('if (org.suscripciones.length > 0) return null')
    expect(salida).toBeGreaterThan(consulta)
  })

  it('sí cobra a quien no lo tiene, o la suscripción sería mentira', () => {
    /* El cron solo mira a quien YA tiene suscripción de pago activa. Quien está
       en prueba o en el plan gratis no tiene ninguna: sin este cobro se
       «suscribiría», no se le cobraría nunca, y se quedaría fuera el día que la
       prueba venza creyendo que estaba al día. */
    expect(receptor).toMatch(/cobrarConFuente\(\{ fuenteId, montoCOP: monto, email, referencia \}\)/)
  })

  it('un intento cada 20 horas, igual que el cron', () => {
    /* El doble clic y el que guarda su medio dos veces caen aquí. */
    expect(receptor).toMatch(/HORAS_ENTRE_INTENTOS = 20/)
    expect(receptor).toMatch(/org\.cobroUltimoIntento > desde/)
  })

  it('el intento se apunta ANTES de llamar a Wompi', () => {
    const marca   = receptor.indexOf('cobroUltimoIntento: ahora')
    const llamada = receptor.indexOf('cobrarConFuente({')
    expect(marca).toBeGreaterThan(-1)
    expect(llamada).toBeGreaterThan(marca)
  })

  it('cobra el MES, nunca un trimestre ni un año', () => {
    /* La referencia diría «mensual» y el webhook activaría un mes: cobrar otro
       período por aquí es regalar once meses. */
    expect(receptor).toMatch(/referenciaDeCobro\(orgId, plan, 'mensual'\)/)
    expect(receptor).not.toMatch(/trimestral|anual/)
  })

  it('tampoco activa nada: eso es del webhook', () => {
    expect(receptor).not.toMatch(/activarPlanPagado/)
  })

  it('si el cobro se cae, el medio guardado NO se borra', () => {
    /* Deshacerlo dejaría al cliente sin suscripción por un banco caído. */
    expect(receptor).not.toMatch(/wompiFuentePagoId: null/)
    /* Y el cobro va DESPUÉS de guardar, no en su lugar. */
    const llamada = receptor.lastIndexOf('primerCobroSiHaceFalta({')
    expect(llamada).toBeGreaterThan(receptor.indexOf('wompiFuentePagoId: fuente.id'))
    expect(receptor).toMatch(/return volver\('guardado-sin-cobro'/)
  })

  it('el checkout manual también escribe la referencia con el par unificado', () => {
    expect(crear).toMatch(/referenciaDeCobro\(orgId, plan, periodo\)/)
    expect(crear).not.toMatch(/`cf-\$\{orgId\}/)
  })
})
