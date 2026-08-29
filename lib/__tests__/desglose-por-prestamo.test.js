import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { cifrasDe, fichaDe, desgloseDe, fechaCorta } from '@/lib/adaptadores/prestamos'
import { proximoCobroTexto } from '@/lib/adaptadores/clientes'

// ── CADA PRÉSTAMO CON SU ESTADO, SIN ENTRAR AL CLIENTE ──────────────────────
//
// Dos quejas del dueño con la misma raíz:
//
//   «hay clientes que su tarjeta dice tres préstamos, pero no hay ningún
//    dropdown que les saque estadísticas específicas de cuál es el estado de
//    esos tres sin necesidad de meterse dentro del cliente»
//
//   «dice qué día cobra, y si un cliente tiene tres préstamos, no se cobran
//    todos el mismo día, porque es dependiendo al préstamo»
//
// La tira de cuatro columnas es un TITULAR, y debajo del titular no había nada.

const hoy = new Date()
const enDias = (n) => new Date(hoy.getTime() + n * 864e5).toISOString()

const base = {
  id: 'p1',
  estado: 'activo',
  frecuencia: 'diario',
  modoInteres: 'fijo',
  tasaInteres: 20,
  cuotaDiaria: 6200,
  montoPrestado: 150000,
  totalAPagar: 186000,
  saldoPendiente: 176000,
  porcentajePagado: 5,
  capitalRestante: 142000,
  diasMora: 0,
  montoEnMora: 0,
  totalCuotas: 30,
  cuotasPendientes: 28,
  fechaInicio: '2026-07-30T05:00:00.000Z',
  fechaFin: '2026-08-29T05:00:00.000Z',
  proximoCobro: enDias(3),
  ultimoPagoAt: '2026-08-02T15:00:00.000Z',
}

const rotulos = (cs) => (cs ?? []).map((c) => c.etiqueta)

describe('la tira del préstamo dice CUÁNDO SE COBRA, no cuándo vence', () => {
  it('«Cobra el» está, y era la que faltaba', () => {
    expect(cifrasDe(base, 'CO').some((c) => c.clave === 'cobro')).toBe(true)
  })

  it('⚠ y «Vence» se va, porque las cuatro NO CABEN', () => {
    /* Medido en el espejo con las dos puestas: la tira del desplegable queda a
       74px por columna y «$140.000» pide 76 — la CUOTA salía recortada en las
       cuatro fichas a la vez. No es una preferencia: es que no entra.

       Y coincide con lo que pidió el dueño, que es lo que decide cuál se cae:
       «qué día vence puede que sea un dato relevante, pero no lo es tanto como
       qué día hay que cobrar a ese préstamo en específico». */
    const cs = rotulos(cifrasDe(base, 'CO'))
    expect(cs).not.toContain('Vence')
    expect(cs.length).toBeLessThanOrEqual(3)
  })

  it('⚠ y tampoco sale junto a «Venció el»', () => {
    /* Salieron las dos en un clavo —«VENCIÓ EL 6 ago» al lado de «VENCE 4 ago»—
       y eso se lee como una contradicción: dos palabras casi iguales con dos
       fechas distintas. Son ciertas las dos, pero juntas nadie las distingue. */
    const cs = rotulos(cifrasDe({ ...base, proximoCobro: enDias(-5) }, 'CO'))
    expect(cs).toContain('Venció el')
    expect(cs).not.toContain('Vence')
  })

  it('pero si NO hay día de cobro, «Vence» ocupa la columna libre', () => {
    // Un préstamo cerrado o sin calendario. La tira nunca se queda en dos.
    const cs = rotulos(cifrasDe({ ...base, proximoCobro: null }, 'CO'))
    expect(cs).toContain('Vence')
  })

  it('«hoy» se pinta en oro y lo vencido en rojo, con su fecha', () => {
    /* ⚠ Se busca por CLAVE porque el rótulo ya no es fijo: «COBRA / hoy»,
       «VENCIÓ EL / 14 jul», «COBRA EL / 19 ago». Buscar por «Cobra el» aquí
       habría dejado de encontrarla en los dos primeros casos. */
    const dame = (p) => cifrasDe(p, 'CO').find((c) => c.clave === 'cobro')
    const hoy = dame({ ...base, proximoCobro: new Date().toISOString() })
    expect(hoy.etiqueta).toBe('Cobra')
    expect(hoy.valor).toBe('hoy')
    expect(hoy.tono).toBe('oro')

    const vencido = dame({ ...base, proximoCobro: enDias(-4) })
    expect(vencido.etiqueta).toBe('Venció el')
    expect(vencido.tono).toBe('contra')

    expect(dame({ ...base, proximoCobro: enDias(6) }).etiqueta).toBe('Cobra el')
    expect(dame({ ...base, proximoCobro: enDias(6) }).tono).toBeUndefined()
  })
})

describe('la fecha corta no lleva «de»', () => {
  /* El `es-CO` de las versiones nuevas de ICU mete la preposición donde antes
     no estaba: «29 de ago» en vez de «29 ago». Cuesta 12px, y en una columna de
     74px eso es que la fecha ya no cabe — salía «29 de agc». No lo cambió nadie
     aquí; cambió debajo, y la app se enteró en la pantalla. */
  it('en la tarjeta de préstamo', () => {
    expect(fechaCorta('2026-08-29T05:00:00.000Z')).toBe('29 ago')
  })
  it('y en la de cliente, que escribe la misma columna', () => {
    /* ⚠ LA FECHA SE CALCULA, NO SE QUEMA. Estaba fija al 29 de agosto, y
       `proximoCobroTexto` dice «hoy» cuando la fecha ES hoy: la prueba pasaba
       364 días al año y caía el 29 de agosto. Un mes por delante nunca es hoy,
       ni mañana, ni esta semana.

       Se compara contra lo que escribe `fechaCorta` —la otra mitad de esta
       misma pareja— en vez de contra un literal: lo que se fija aquí es que las
       DOS columnas escriban igual, que es el fallo que originó la prueba. */
    const dentroDeUnMes = new Date(Date.now() + 30 * 86400000)
    const iso = `${dentroDeUnMes.toISOString().slice(0, 10)}T05:00:00.000Z`
    expect(proximoCobroTexto({ proximoCobro: iso })).toBe(fechaCorta(iso))
    expect(proximoCobroTexto({ proximoCobro: iso })).not.toMatch(/ de /)
  })
})

describe('la ficha de un préstamo', () => {
  it('dice LO QUE FALTA, y lo dice con esa palabra', () => {
    /* Arriba, en la tarjeta, va lo PAGADO —un préstamo recién creado que dijera
       «$1.800.000 de $1.800.000» se lee como saldado, y el dueño lo reportó con
       esas palabras—. Abierto el desplegable la pregunta es la contraria, así
       que la cifra cambia de sentido y la etiqueta tiene que decirlo. */
    const f = fichaDe(base, 'CO')
    expect(f.falta).toBe('$176.000')
    expect(f.total).toMatch(/de \$186\.000/)
  })

  it('el título dice cómo se pactó, que es lo que distingue dos préstamos iguales', () => {
    expect(fichaDe(base, 'CO').titulo).toBe('Diario 20% Clásico')
  })

  it('y desde cuándo: sin eso, tres préstamos del mismo cliente son tres copias', () => {
    expect(fichaDe(base, 'CO').desde).toBe('30 jul')
  })

  it('el pago único no lleva barra: marcaría 0% durante todo el plazo', () => {
    const f = fichaDe({ ...base, cuotaDiaria: 0 }, 'CO')
    expect(f.sinProgreso).toBe(true)
    expect(f.avance).toBe('pago único')
  })
})

describe('el desglose largo, solo en la tarjeta de préstamo', () => {
  const largo = fichaDe(base, 'CO', { largo: true })
  const rot = largo.lineas.map((l) => l.rotulo)

  it('sin `largo` no hay renglones: en la lista de clientes serían seis por crédito', () => {
    expect(fichaDe(base, 'CO').lineas).toBeUndefined()
  })

  it('cuenta la plata entera: prestado, total, pagado y lo que falta', () => {
    expect(rot).toEqual(expect.arrayContaining(['Prestado', 'Total a pagar', 'Ya pagó', 'Le falta']))
    expect(largo.lineas.find((l) => l.rotulo === 'Ya pagó').valor).toBe('$10.000')
  })

  it('y aquí SÍ está «Vence», que es a donde bajó', () => {
    expect(rot).toContain('Vence')
    expect(largo.lineas.find((l) => l.rotulo === 'Vence').valor).toBe('29 ago')
  })

  it('⚠ «Capital afuera» sí; «Ganancia» NO', () => {
    /* La lámina pide una columna de ganancia y sigue sin estar. La ganancia de
       un préstamo es el INTERÉS COBRADO, no lo recaudado, y ese número no viene
       medido en la fila: derivarlo a ojo aquí es exactamente el error que infló
       las analíticas 7,9 veces.

       `calcularCapitalRestante` sí está medido, y contesta la pregunta de al
       lado: si me pagan todo hoy, cuánto recupero de lo que puse. */
    expect(rot).toContain('Capital afuera')
    expect(rot.join(' ')).not.toMatch(/[Gg]anancia/)
  })

  it('⚠ y NO repite la cabecera, que ya está en la tarjeta', () => {
    /* Medido abriéndolo en el espejo: el desplegable repetía el título («Diario
       22% Clásico»), la pastilla («3d») y la tira entera (CUOTA · ATRASO ·
       COBRA EL) que estaban dos centímetros más arriba. Tres copias del mismo
       dato en la misma pantalla.

       Lo que la cabecera sí aportaba —la fecha de inicio— baja como un renglón. */
    expect(largo.sinCabecera).toBe(true)
    expect(rot[0]).toBe('Empezó')
    // Y en la de CLIENTE se queda: allí arriba no hay nada de ese préstamo.
    expect(fichaDe(base, 'CO').sinCabecera).toBeUndefined()
  })

  it('«sin pagos aún» va apagado, no en rojo', () => {
    /* El mismo dato pintado en rojo en 203 filas ya fue un fallo real: la
       relación `pagos` llevaba un `where` de HOY y «último pago» salía `null`
       siempre, así que la tira escribía «nunca» en rojo en toda la lista. */
    const sin = fichaDe({ ...base, ultimoPagoAt: null }, 'CO', { largo: true })
    const l = sin.lineas.find((x) => x.rotulo === 'Último pago')
    expect(l.valor).toBe('sin pagos aún')
    expect(l.apagado).toBe(true)
    expect(l.tono).toBeUndefined()
  })
})

describe('el desplegable de la tarjeta de cliente', () => {
  it('sin préstamos no se dibuja: un desplegable vacío es un toque para nada', () => {
    expect(desgloseDe([], 'CO')).toBeNull()
    expect(desgloseDe(null, 'CO')).toBeNull()
  })

  it('el rótulo dice cuántos son, en singular y en plural', () => {
    expect(desgloseDe([base], 'CO').rotulo).toBe('Ver el préstamo')
    expect(desgloseDe([base, { ...base, id: 'p2' }], 'CO').rotulo).toBe('Ver los 2 préstamos')
  })

  it('respeta el orden en que llegan, que es el que manda la API', () => {
    // La API los ordena por el que se cobra ANTES: abierto, lo primero que se
    // lee tiene que ser a cuál hay que ir hoy.
    const d = desgloseDe([{ ...base, id: 'a' }, { ...base, id: 'b' }], 'CO')
    expect(d.prestamos.map((f) => f.id)).toEqual(['a', 'b'])
  })
})

describe('la API manda el desglose, y sin una consulta de más', () => {
  const api = readFileSync(resolve(process.cwd(), 'app/api/clientes/route.js'), 'utf8')

  it('cada cliente lleva sus préstamos', () => {
    expect(api).toMatch(/prestamos: desglose/)
  })

  it('salen del bucle que YA existía, no de un `findMany` nuevo', () => {
    /* Este bucle ya calculaba el saldo, la mora, el próximo cobro y las cuotas
       de cada préstamo para poder sumarlos. Lo único que faltaba era no tirar
       las piezas después de sumarlas. Si alguien mete aquí una consulta por
       cliente, son 50 consultas por página. */
    const cuerpo = api.slice(api.indexOf('const desglose = []'), api.indexOf('prestamos: desglose'))
    expect(cuerpo).not.toMatch(/await prisma\./)
  })

  it('ordenados por el que se cobra antes', () => {
    expect(api).toMatch(/prestamos: desglose\.slice\(\)\.sort/)
  })
})

describe('la pieza es UNA sola para las dos pantallas', () => {
  const cmp = readFileSync(resolve(process.cwd(), 'components/cf/DesglosePrestamos.jsx'), 'utf8')
  const tarjeta = readFileSync(resolve(process.cwd(), 'components/cf/TarjetaCliente.jsx'), 'utf8')
  const listaClientes = readFileSync(resolve(process.cwd(), 'app/(dashboard)/clientes/page.jsx'), 'utf8')
  const listaPrestamos = readFileSync(resolve(process.cwd(), 'app/(dashboard)/prestamos/page.jsx'), 'utf8')

  it('las dos listas montan el MISMO componente', () => {
    /* Si fueran dos, el «saldo» de una y el de la otra se separarían sin que
       nadie lo notara — que es justo lo que pasó con el comprobante: el mismo
       fallo reportado dos días seguidos porque se arregló un camino y no el
       otro. */
    expect(tarjeta).toMatch(/import DesglosePrestamos from '\.\/DesglosePrestamos'/)
    expect(listaClientes).toMatch(/desglose=\{desgloseDe\(c\.prestamos, country\)\}/)
    expect(listaPrestamos).toMatch(/fichaDe\(p, country, \{ largo: true \}\)/)
  })

  it('⚠ los clics no suben a la tarjeta', () => {
    /* Las dos tarjetas son `onClick` enteras —tocarlas entra a la ficha— así que
       sin cortar la propagación, abrir el desplegable NAVEGARÍA a otra pantalla.
       Que es exactamente lo contrario de «sin necesidad de meterse dentro». */
    expect(cmp).toMatch(/onClick=\{\(e\) => e\.stopPropagation\(\)\}/)
    expect((cmp.match(/stopPropagation/g) ?? []).length).toBeGreaterThanOrEqual(5)
  })

  it('arranca cerrado', () => {
    // Abierto por defecto convierte una lista de treinta tarjetas en scroll
    // infinito. El titular es lo que se lee recorriendo; el desglose es para
    // cuando hay que decidir algo.
    expect(cmp).toMatch(/abiertoInicial = false/)
  })

  it('el plegador se anuncia (`aria-expanded`), que además es como lo mide la prueba de pantalla', () => {
    expect(cmp).toMatch(/aria-expanded=\{abierto\}/)
    expect(cmp).toMatch(/aria-controls=\{id\}/)
  })

  it('⚠ COBRAR EN DORADO, nunca en verde', () => {
    /* En este sistema el verde significa «al día, pagado». Usarlo como color de
       acción rompe esa lectura justo en la pantalla donde se decide si alguien
       pagó. El único verde de aquí es el logo de WhatsApp, que es una marca. */
    const boton = cmp.slice(cmp.indexOf('onClick={(e) => { e.stopPropagation(); onCobrar() }}'))
    expect(boton).toMatch(/background: 'var\(--cf-gold\)'/)
    expect(boton.slice(0, 400)).not.toMatch(/--cf-green/)
  })

  it('un préstamo pagado no enseña «Cobrar»', () => {
    // Un botón gris que no hace nada obliga a probarlo para saberlo.
    expect(cmp).toMatch(/ficha\.estado !== 'pagado' && !!onCobrar/)
  })

  it('el cobro rápido es el MISMO modal de la ficha, no uno nuevo', () => {
    /* Escribir aquí un cobro propio sería un segundo sitio donde se registra
       plata, y el primero ya tiene el comprobante, el modo abreviado, el aviso
       de duplicado y los métodos de pago. */
    expect(listaClientes).toMatch(/import RegistrarPago from '@\/components\/prestamos\/RegistrarPago'/)
    expect(listaPrestamos).toMatch(/import RegistrarPago +from '@\/components\/prestamos\/RegistrarPago'/)
  })

  it('y al cobrar se recarga la lista', () => {
    // Sin esto la tarjeta seguiría diciendo el saldo de antes del pago que se
    // acaba de registrar, que es la forma más rápida de que alguien cobre dos
    // veces.
    expect(listaClientes).toMatch(/setCobroRapido\(null\)\s*\n\s*fetchClientes\(/)
    expect(listaPrestamos).toMatch(/setCobroRapido\(null\)\s*\n\s*fetchPrestamos\(/)
  })

  it('la hoja de WhatsApp recibe el préstamo del que se habla', () => {
    /* Se abría con `prestamo={null}`: las plantillas que hablan de cuota, saldo
       o días de atraso quedaban fuera y el cobrador veía solo las genéricas.
       Desde el desplegable sí se sabe de cuál de los tres se está hablando. */
    const hoja = listaClientes.slice(listaClientes.indexOf('<HojaWhatsApp'))
    expect(hoja).toMatch(/prestamo=\{waPrestamo\}/)
    expect(hoja).not.toMatch(/prestamo=\{null\}/)
  })

  it('el desplegable va entre la tira y el avance', () => {
    /* La tira es el titular y esto es el detalle del titular. Arriba separaría
       el nombre de sus cifras; al final, después de la barra, quedaría colgando
       bajo el borde de color que cierra la tarjeta. */
    const iTira = tarjeta.indexOf('<TiraCifras columnas={cifras} enTarjeta />')
    const iDesg = tarjeta.indexOf('<DesglosePrestamos')
    const iBarra = tarjeta.indexOf('LA BARRA A SANGRE')
    expect(iTira).toBeGreaterThan(0)
    expect(iDesg).toBeGreaterThan(iTira)
    expect(iBarra).toBeGreaterThan(iDesg)
  })
})
