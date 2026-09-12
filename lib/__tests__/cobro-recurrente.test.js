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
import { MAX_FALLOS } from '@/lib/cobro-automatico'

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
const activar  = quitarComentarios(readFileSync(resolve(raiz, 'lib/activar-suscripcion.js'), 'utf8'))
const intento  = quitarComentarios(readFileSync(resolve(raiz, 'lib/cobro-intento.js'), 'utf8'))

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

  it('cobra lo que vence en las próximas 48 h, no solo lo que ya venció', () => {
    /* Era «solo lo que YA venció», y un plan que vencía a las 13:10 no se cobraba
       a las 13:00: el cliente quedaba fuera con el cobro puesto (12 sep 2026).
       «Un día antes, por ejemplo» — el dueño. Con 48 h hay dos pasadas antes del
       corte; la constante está en lib/cobro-automatico.js. */
    expect(cron).toMatch(/const hastaVence = new Date\(ahora\.getTime\(\) \+ HORAS_DE_ANTICIPO \* 3600000\)/)
    expect(cron).toMatch(/fechaVencimiento: \{ lte: hastaVence, gte: desdeVence \}/)
    expect(cron).not.toMatch(/fechaVencimiento: \{ lte: ahora \}/)
  })

  it('⚠ y cobrar antes NO le quita días: el webhook extiende desde el vencimiento', () => {
    /* Si esto cambiara a «desde ahora», cada cobro anticipado le robaría las
       horas que le quedaban. */
    expect(activar).toMatch(/const baseDate = sub\.estado === 'activa' && new Date\(sub\.fechaVencimiento\) > ahora\s*\?\s*new Date\(sub\.fechaVencimiento\)/)
  })

  it('⚠ la ventana se vuelve a mirar en la suscripción más reciente', () => {
    /* El `some` casa con cualquiera: una vieja dentro de la ventana metería al
       negocio aunque la vigente ya esté pagada. */
    const bucle = cron.indexOf('for (let org of orgs)')
    const guarda = cron.indexOf('if (vence > hastaVence || vence < desdeVence)')
    const llamada = cron.indexOf('lanzarCobro({')
    expect(bucle).toBeGreaterThan(-1)
    expect(guarda).toBeGreaterThan(bucle)
    expect(llamada).toBeGreaterThan(guarda)
    expect(cron).toMatch(/orderBy: \{ fechaVencimiento: 'desc' \},\s*take: 1/)
  })

  it('un intento al día como mucho', () => {
    /* Sin esto, dos ejecuciones del cron el mismo día cobran dos veces. */
    expect(cron).toMatch(/HORAS_ENTRE_INTENTOS/)
    expect(cron).toMatch(/cobroUltimoIntento: \{ lt: desdeIntento \}/)
  })

  it('el cron no llama a Wompi por su cuenta: pasa por el candado de lib/cobro-intento.js', () => {
    /* Cobran tres sitios (cron, guardar el medio, «Reintentar»). Si uno se
       saltara el candado, el botón y el cron a la vez cobrarían dos veces. */
    expect(cron).not.toMatch(/cobrarConFuente/)
    expect(cron).toMatch(/import \{ lanzarCobro, reconciliar \} from '@\/lib\/cobro-intento'/)
  })

  it('el intento y el candado se apuntan ANTES de llamar a Wompi', () => {
    /* Al revés, un proceso que se cae a mitad deja el cobro hecho y sin marcar:
       mañana vuelve a cobrar. Apuntándolo antes, el peor caso es no reintentar
       hasta saber cómo acabó — que es infinitamente más barato. */
    const candado = intento.indexOf('where: { id: org.id, cobroRefPendiente: null }')
    const marca = intento.indexOf('cobroUltimoIntento: ahora')
    const salida = intento.indexOf("if (candado.count === 0) return { resultado: 'pendiente' }")
    const llamada = intento.indexOf('cobrarConFuente({')
    expect(candado).toBeGreaterThan(-1)
    expect(marca).toBeGreaterThan(candado)
    expect(salida).toBeGreaterThan(marca)
    expect(llamada).toBeGreaterThan(salida)
    expect(intento.match(/cobrarConFuente\(\{/g)?.length, 'una sola llamada a Wompi').toBe(1)
  })

  it('un cobro en el aire se averigua antes de mandar otro', () => {
    const averigua = cron.indexOf('const estado = await reconciliar(org)')
    const llamada = cron.indexOf('lanzarCobro({')
    expect(averigua).toBeGreaterThan(-1)
    expect(llamada).toBeGreaterThan(averigua)
    expect(cron).toMatch(/if \(estado !== 'libre'\) \{ res\.enCurso\+\+; continue \}/)
  })

  it('se para a los tres rechazos del MISMO periodo', () => {
    /* El límite vive en lib/cobro-automatico.js. Solo frena al cron: el dueño
       puede reintentar desde la pantalla cuando recargue. */
    expect(MAX_FALLOS).toBe(3)
    const tope = cron.indexOf('if (vigente && org.cobroFallos >= MAX_FALLOS) { res.agotados++; continue }')
    expect(tope).toBeGreaterThan(-1)
    expect(cron.indexOf('lanzarCobro({')).toBeGreaterThan(tope)
    expect(cron).not.toMatch(/const MAX_FALLOS/)
    /* Un rechazo de un periodo ya pagado no gasta intentos de éste. */
    expect(cron).toMatch(/reiniciarFallos: !vigente,/)
  })
})

describe('⚠ un solo camino para activar el plan', () => {
  it('el cron NO activa nada', () => {
    /* Si activara aquí Y en el webhook, un cobro aprobado sumaría dos meses.
       El cron dispara y se calla. */
    expect(cron).not.toMatch(/activarPlanPagado/)
  })

  it('el rechazo y los fallos se borran al APLICAR el pago, no al mandarlo', () => {
    /* «Wompi aceptó la petición» no es «el dinero entró»: la transacción nace
       PENDING y puede acabar DECLINED. Borrar el rechazo al enviarla dejaría
       dentro a quien la pasarela rechaza unos segundos después. */
    expect(cron).not.toMatch(/cobroFallos: 0|cobroRechazoVence: null/)
    expect(activar).toMatch(/const COBRO_AL_DIA = \{\s*cobroFallos: 0,\s*cobroRechazoVence: null,\s*cobroRechazoMotivo: null,/)
    expect(activar.match(/\.\.\.COBRO_AL_DIA/g)?.length, 'al extender y al crear').toBe(2)
  })

  it('al mandar solo se reinicia si no hay rechazo de este periodo', () => {
    /* Tres rechazos seguidos del mismo mes cuentan tres; uno del mes pasado,
       ya pagado, no. */
    expect(intento).toMatch(/\.\.\.\(reiniciarFallos && \{ cobroFallos: 0, cobroRechazoVence: null, cobroRechazoMotivo: null \}\)/)
    expect(intento).toMatch(/return lanzarCobro\(\{ org, plan, montoCOP: monto, reiniciarFallos: !vigente, origen \}\)/)
  })

  it('⚠ guardar o quitar el medio NO borra el rechazo', () => {
    /* Quitar el Nequi y volver a ponerlo no puede ser la forma de seguir
       dentro sin pagar. */
    const nequi = quitarComentarios(readFileSync(resolve(raiz, 'app/api/pagos/wompi/nequi/route.js'), 'utf8'))
    for (const [nombre, src] of [['token', receptor], ['fuente', fuente], ['nequi', nequi]]) {
      expect(src, nombre).not.toMatch(/cobroRechazoVence/)
    }
  })

  it('el webhook cuenta el rechazo solo si no está APROBADO, y activa solo si lo está', () => {
    const noAprobado = webhook.indexOf("if (estado !== 'APPROVED') {")
    const rechazo = webhook.indexOf('await contarRechazo(p.orgId, referencia,')
    const activa = webhook.indexOf('await activarPlanPagado({')
    expect(noAprobado).toBeGreaterThan(-1)
    expect(rechazo).toBeGreaterThan(noAprobado)
    expect(activa).toBeGreaterThan(rechazo)
    expect(webhook).toMatch(/if \(ESTADOS_RECHAZO\.has\(estado\)\) \{/)
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
    expect(pantalla).toMatch(/useState\(\(\) => searchParams\.get\('modo'\) === 'unico' \? 'unico' : 'suscripcion'\)/)
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
    expect(intento).toMatch(/const precioDe = \(p\) => Math\.round\(getPrecioPlan\(p, org\.country \?\? 'co'\) \* \(1 - \(org\.descuento \?\? 0\) \/ 100\)\)/)
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


describe('⚠ el cobro al guardar el medio', () => {
  /* Guardar el Nequi o la tarjeta cobra solo si toca. Lo decide
     `cobrarAhoraSiToca` (lib/cobro-intento.js), el mismo camino del botón
     «Reintentar». Las pruebas de comportamiento están en cobro-intento.test.js;
     aquí, que los tres caminos de guardar lo usen y no se inventen el suyo. */
  const nequi = quitarComentarios(readFileSync(resolve(raiz, 'app/api/pagos/wompi/nequi/route.js'), 'utf8'))

  it('los tres caminos de guardar pasan por el mismo sitio', () => {
    for (const [nombre, src] of [['token', receptor], ['fuente', fuente], ['nequi', nequi]]) {
      expect(src, nombre).toMatch(/cobrarAhoraSiToca\(\{/)
      expect(src, `${nombre} no llama a Wompi por su cuenta`).not.toMatch(/cobrarConFuente/)
    }
  })

  it('NO cobra a quien ya tiene un plan de pago que dura más que el anticipo', () => {
    /* Ése ya pagó: cobrarle otra vez por guardar su tarjeta sería cobrarle dos
       veces el mismo mes. El cron toma el relevo antes de que venza. */
    expect(intento).toMatch(/ultima\.estado === 'activa' && ultima\.montoCOP > 0 &&\s*new Date\(ultima\.fechaVencimiento\)\.getTime\(\) > ahora\.getTime\(\) \+ HORAS_DE_ANTICIPO \* 3600000/)
    const salida = intento.indexOf("if (!vigente && cubierto) return { resultado: 'no-hace-falta' }")
    expect(salida).toBeGreaterThan(-1)
    expect(intento.indexOf('return lanzarCobro({')).toBeGreaterThan(salida)
  })

  it('y cada pulsación no es un cobro: dos minutos entre intentos', () => {
    /* Un Nequi sin saldo pulsado diez veces son diez rechazos, y eso ensucia
       la reputación del comercio con el banco. */
    expect(intento).toMatch(/export async function cobrarAhoraSiToca\(\{ orgId, planElegido = null, minutosEntreIntentos = 2, origen = 'manual' \}\)/)
    expect(intento).toMatch(/if \(falta > 0\) return \{ resultado: 'espera', segundos: Math\.ceil\(falta \/ 1000\) \}/)
  })

  it('cobra el MES, nunca un trimestre ni un año', () => {
    /* La referencia diría «mensual» y el webhook activaría un mes: cobrar otro
       período por aquí es regalar once meses. */
    expect(intento).toMatch(/const referencia = referenciaDeCobro\(org\.id, plan, 'mensual'\)/)
    expect(intento).not.toMatch(/'trimestral'|'anual'/)
  })

  it('tampoco activa nada al mandar: eso es del pago aprobado', () => {
    expect(receptor).not.toMatch(/activarPlanPagado/)
    const lanzar = intento.slice(intento.indexOf('export async function lanzarCobro'), intento.indexOf('export async function reconciliar'))
    expect(lanzar).not.toMatch(/activarPlanPagado/)
  })

  it('si el cobro se cae, el medio guardado NO se borra', () => {
    /* Deshacerlo dejaría al cliente sin suscripción por un banco caído. */
    expect(receptor).not.toMatch(/wompiFuentePagoId: null/)
    /* Y el cobro va DESPUÉS de guardar, no en su lugar. */
    const llamada = receptor.indexOf('cobrarAhoraSiToca({')
    expect(llamada).toBeGreaterThan(receptor.indexOf('wompiFuentePagoId: fuente.id'))
    expect(receptor).toMatch(/return \['guardado-sin-cobro', motivoLegible\(cobro\.motivo\)\]/)
  })

  it('el checkout manual también escribe la referencia con el par unificado', () => {
    expect(crear).toMatch(/referenciaDeCobro\(orgId, plan, periodo\)/)
    expect(crear).not.toMatch(/`cf-\$\{orgId\}/)
  })
})
