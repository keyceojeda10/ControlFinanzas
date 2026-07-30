// lib/__tests__/pago-cotejo.test.js — T02-04 y T08-01, la pantalla que mueve plata.
//
// Es la pantalla MÁS USADA del sistema y la única que se opera de pie, con una
// mano y sol de frente. Y es la única del rediseño donde un número equivocado no
// es un número feo: es un cobro mal registrado.
//
// Por eso la proyección se prueba por casos, incluidos los que NO deben decir
// nada: preferir el silencio a una frase inventada es la mitad del diseño de este
// adaptador.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  adaptarDespuesDelPago, estadoDespues, atajosDeMonto,
  efectoSobreLaDeuda, entraPlata,
  mediosParaHoja, medioAGuardar, montoCrudo, montoParaMostrar,
} from '@/lib/adaptadores/pago'

const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')

/** El caso de T02-04: Carlos Chaparro, 36d de mora, saldo $160.000, cuota
    $12.000, cuota 13 de 24, diario. */
const CARLOS = {
  saldoPendiente: 160000,
  cuotaDiaria: 12000,
  frecuencia: 'diario',
  diasMora: 36,
  montoEnMora: 432000,
  montoParaPonerseAlDia: 444000,
}

describe('T02-04 · el saldo de después', () => {
  it('la fila lleva el antes TACHADO y el después al lado', () => {
    // La lámina: «$160.000» tachado y «$148.000» grande. Sin el antes, el dueño ve
    // un número y no sabe si mejoró.
    const { filas } = adaptarDespuesDelPago(CARLOS, { monto: 12000, tipo: 'completo' })
    const saldo = filas.find((f) => f.clave === 'saldo')
    expect(saldo.antes).toBe('$160.000')
    expect(saldo.valor).toBe('$148.000')
  })

  it('un RECARGO sube la deuda, no la baja', () => {
    // El 75% de los ajustes son recargos. Tratarlo como un pago pondría el signo al
    // revés justo en el caso más común.
    expect(efectoSobreLaDeuda('recargo', 20000)).toBe(20000)
    expect(efectoSobreLaDeuda('completo', 20000)).toBe(-20000)
    const { filas } = adaptarDespuesDelPago(CARLOS, { monto: 20000, tipo: 'recargo' })
    expect(filas.find((f) => f.clave === 'saldo').valor).toBe('$180.000')
  })

  it('un DESCUENTO baja la deuda sin que entre plata', () => {
    expect(entraPlata('descuento')).toBe(false)
    expect(entraPlata('recargo')).toBe(false)
    expect(entraPlata('completo')).toBe(true)
    expect(entraPlata('capital')).toBe(true)
    const { filas } = adaptarDespuesDelPago(CARLOS, { monto: 10000, tipo: 'descuento' })
    expect(filas.find((f) => f.clave === 'saldo').valor).toBe('$150.000')
    // Y NO aparece «entra a caja como»: no entra nada a ninguna caja.
    expect(filas.find((f) => f.clave === 'caja')).toBeUndefined()
  })

  it('el saldo nunca queda en negativo, y cuando llega a cero lo dice', () => {
    const { filas } = adaptarDespuesDelPago(CARLOS, { monto: 200000, tipo: 'completo' })
    const saldo = filas.find((f) => f.clave === 'saldo')
    expect(saldo.valor).toBe('$0')
    expect(saldo.nota).toBe('Queda saldado')
  })

  it('sin saldo en la respuesta, la fila NO se inventa', () => {
    const { filas } = adaptarDespuesDelPago({}, { monto: 12000 })
    expect(filas.find((f) => f.clave === 'saldo')).toBeUndefined()
  })
})

describe('T02-04 · el estado de después', () => {
  it('«Sigue con 35d de atraso» — la cuenta de la lámina', () => {
    // 36d de mora, una cuota de $12.000 pagada, préstamo DIARIO: una cuota quita un
    // día. Es exactamente lo que dibuja la lámina.
    expect(estadoDespues(CARLOS, 12000).texto).toBe('Sigue con 35d de atraso')
  })

  it('en quincenal una cuota quita QUINCE días, no uno', () => {
    // Tres días de atraso en un préstamo diario son tres cuotas perdidas; en uno
    // quincenal son la quinta parte de una. El mismo razonamiento que el umbral de
    // mora grave de T42-02.
    const q = { ...CARLOS, frecuencia: 'quincenal', diasMora: 40 }
    expect(estadoDespues(q, 12000).texto).toBe('Sigue con 25d de atraso')
  })

  it('con el monto para ponerse al día, queda AL DÍA', () => {
    const e = estadoDespues(CARLOS, 444000)
    expect(e.texto).toBe('Queda al día')
    expect(e.tono).toBe('aldia')
  })

  it('cubriendo la mora pero no la cuota de hoy, lo dice sin mentir', () => {
    // $432.000 tapa lo vencido pero no lo de hoy. Decir «al día» ahí sería falso, y
    // decir «sigue atrasado» también.
    expect(estadoDespues(CARLOS, 432000).texto).toBe('Cubre la mora, falta la cuota de hoy')
  })

  it('sin mora no hay fila de estado: no hay nada que avisar', () => {
    expect(estadoDespues({ ...CARLOS, diasMora: 0 }, 12000)).toBeNull()
    const { filas } = adaptarDespuesDelPago({ ...CARLOS, diasMora: 0 }, { monto: 12000 })
    expect(filas.find((f) => f.clave === 'estado')).toBeUndefined()
  })

  it('sin las cifras de mora, NO se inventa el estado', () => {
    // La API puede no mandarlas. Una frase inventada aquí es la que el cobrador lee
    // para decidir si insiste o se va.
    const sinCifras = { saldoPendiente: 160000, cuotaDiaria: 0, diasMora: 36 }
    expect(estadoDespues(sinCifras, 12000)).toBeNull()
  })

  it('más de 7 días de atraso restante va en ROJO, menos en ámbar', () => {
    expect(estadoDespues({ ...CARLOS, diasMora: 36 }, 12000).tono).toBe('mora')
    expect(estadoDespues({ ...CARLOS, diasMora: 8 }, 12000).tono).toBe('atraso')
  })

  it('un recargo NO toca la mora: mueve la deuda, no el atraso', () => {
    expect(estadoDespues(CARLOS, 20000, 'recargo').texto).toBe('Sigue con 36d de atraso')
  })
})

describe('T08-01 · «entra a caja como»', () => {
  it('en efectivo dice efectivo y el cobrador, sin avisos', () => {
    const { filas } = adaptarDespuesDelPago(CARLOS,
      { monto: 12000, tipo: 'completo', metodoPago: 'efectivo', cobrador: 'Pepito' })
    const caja = filas.find((f) => f.clave === 'caja')
    expect(caja.valor).toBe('Efectivo · Pepito')
    expect(caja.nota).toBeNull()
  })

  it('en digital AVISA que no suma al efectivo que entregas', () => {
    // Es la fila que evita el descuadre: un pago por Nequi no suma al efectivo que
    // el cobrador tiene que entregar, y sin esto se entera al cerrar caja.
    const { filas } = adaptarDespuesDelPago(CARLOS,
      { monto: 12000, tipo: 'completo', metodoPago: 'transferencia', nombreCuenta: 'Nequi', cobrador: 'Pepito' })
    const caja = filas.find((f) => f.clave === 'caja')
    expect(caja.valor).toBe('Nequi · Pepito')
    expect(caja.nota).toBe('No suma al efectivo que entregas')
  })

  it('sin nombre de cuenta no queda en blanco', () => {
    const { filas } = adaptarDespuesDelPago(CARLOS, { monto: 12000, metodoPago: 'transferencia' })
    expect(filas.find((f) => f.clave === 'caja').valor).toBe('Transferencia')
  })
})

describe('el próximo cobro NO se recalcula aquí', () => {
  it('se pinta tal cual llega, y si no llega no hay fila', () => {
    // Volver a derivarlo sería la CUARTA función que responde a esa pregunta —ya hay
    // tres que se contradicen— y en la pantalla donde una fecha mala es un cobro
    // perdido.
    const { filas } = adaptarDespuesDelPago(CARLOS, { monto: 12000, proximoCobroTexto: 'lun 3 de ago' })
    expect(filas.find((f) => f.clave === 'proximo').valor).toBe('lun 3 de ago')
    const sin = adaptarDespuesDelPago(CARLOS, { monto: 12000 })
    expect(sin.filas.find((f) => f.clave === 'proximo')).toBeUndefined()
  })

  it('el adaptador no importa nada de calculos.js', () => {
    const fuente = leer('lib/adaptadores/pago.js')
    expect(fuente).not.toMatch(/from '@\/lib\/calculos'/)
    // La LLAMADA, con su paréntesis — no el nombre pelado. El comentario de arriba
    // del adaptador explica por qué no se recalcula, y para explicarlo tiene que
    // nombrar la función: un `not.toMatch` sobre el nombre suelto acusa a la prosa
    // que dice justo lo correcto. Van siete veces con este mismo tropiezo.
    expect(fuente).not.toMatch(/calcularProximoCobro\s*\(/)
  })
})

describe('los tres atajos de monto', () => {
  it('«Cuota», «Mitad», «Todo» — los de la lámina', () => {
    const a = atajosDeMonto(CARLOS)
    expect(a.map((x) => x.id)).toEqual(['cuota', 'mitad', 'todo'])
    expect(a.map((x) => x.monto)).toEqual([12000, 80000, 160000])
  })

  it('NINGUNO pasa del saldo', () => {
    // Ofrecer «cuota $12.000» a quien debe $4.000 invita a cobrar de más, y la app
    // tendría que rechazarlo después de que el cliente ya entregó la plata.
    const casi = { ...CARLOS, saldoPendiente: 4000 }
    for (const x of atajosDeMonto(casi)) expect(x.monto).toBeLessThanOrEqual(4000)
  })

  it('si la cuota YA es el saldo entero, no salen dos botones iguales', () => {
    const ultima = { ...CARLOS, saldoPendiente: 12000 }
    const montos = atajosDeMonto(ultima).map((x) => x.monto)
    expect(new Set(montos).size).toBe(montos.length)
  })

  it('con el préstamo saldado no hay atajos que ofrecer', () => {
    expect(atajosDeMonto({ ...CARLOS, saldoPendiente: 0 })).toEqual([])
  })

  it('la mitad va redondeada a $100, como todo el dinero del sistema', () => {
    const raro = { ...CARLOS, saldoPendiente: 160333 }
    const mitad = atajosDeMonto(raro).find((x) => x.id === 'mitad')
    expect(mitad.monto % 100).toBe(0)
  })
})

describe('T02-04 / T08-01 · la forma, contra los estilos de las láminas', () => {
  const hoja = leer('components/pantallas/RegistrarCobro.jsx')
  const modal = leer('components/prestamos/RegistrarPago.jsx')

  it('es una HOJA: no trae cabecera ni barra propias', () => {
    // Las dos láminas la dibujan como hoja sobre la ficha oscurecida al 42%.
    // `HojaInferior` ya pone el asa de 38×4, el título, la X y la ranura de acción
    // con las medidas de la lámina; repetirlo aquí daría dos títulos y dos X, que es
    // lo que ya pasó en la ficha con la barra de acción duplicada.
    expect(hoja).not.toMatch(/aria-label="Cerrar"/)
    expect(hoja).not.toMatch(/<BarraAccion/)
    expect(modal).toMatch(/<HojaInferior/)
    expect(modal).toMatch(/<PieRegistrarCobro/)
  })

  it('el campo de monto lleva el anillo dorado', () => {
    // Regla 4: un solo dorado por pantalla. El anillo va en el monto porque es lo
    // único que hay que teclear. El de la casilla de medio es el MISMO patrón
    // aplicado a la elección ya hecha, no un segundo foco.
    expect(hoja).toMatch(/border: `1\.5px solid \$\{ORO\}`/)
    expect(hoja).toMatch(/0 0 0 3px rgba\(231,164,0,\.13\)/)
  })

  it('el input es CONTROLADO y de texto, no de número', () => {
    // `defaultValue` en la versión vieja: los atajos no podían escribir en él, así
    // que tocar «Todo» no cambiaba nada. Y `type=number` rechaza el separador
    // decimal que no coincide con el locale del teléfono — 12 países.
    expect(hoja).toMatch(/value=\{monto\}/)
    // El ATRIBUTO con su `=`, no el nombre pelado: el comentario del componente
    // explica por qué se quitó `defaultValue` y para explicarlo tiene que nombrarlo.
    expect(hoja).not.toMatch(/defaultValue=/)
    expect(hoja).toMatch(/inputMode="decimal"/)
    expect(hoja).not.toMatch(/type="number"/)
  })

  it('se VE agrupado y se GUARDA crudo', () => {
    // El campo enseñaba «20000». Con seis cifras seguidas nadie distingue un millón
    // doscientos cincuenta mil de ciento veinticinco mil. Y el estado sigue crudo:
    // quien lo envía hace `Number(monto)`, y con puntos dentro eso da NaN.
    expect(montoParaMostrar('20000', 'CO')).toBe('20.000')
    expect(montoCrudo('20.000')).toBe('20000')
    expect(montoCrudo('$1.250.000')).toBe('1250000')
    expect(montoParaMostrar('', 'CO')).toBe('')
    expect(modal).toMatch(/monto=\{montoParaMostrar\(monto/)
    expect(modal).toMatch(/setMonto\(montoCrudo\(v\)\)/)
  })

  it('los atajos marcan en dorado suave y «a qué se aplica» en negro', () => {
    // La diferencia no es decorativa: los atajos son una ayuda para escribir, y «a
    // qué se aplica» es una decisión que cambia dónde entra la plata.
    expect(hoja).toMatch(/background: 'var\(--cf-gold-tint\)'/)
    expect(hoja).toMatch(/background: 'var\(--cf-ink\)', color: 'var\(--cf-surface\)'/)
    // `--cf-bg` no existe: escribí un nombre plausible y el CSS lo resolvía a nada.
    expect(hoja).not.toMatch(/var\(--cf-bg\)/)
  })

  it('el nombre de la cuenta cabe ENTERO, aunque sea en dos líneas', () => {
    // «Bancolombia» salía «Bancolo…», y así no se distingue de «Banco Bogotá». Los
    // nombres de la lámina son cortos porque son de mentira.
    expect(hoja).toMatch(/wordBreak: 'break-word'/)
  })

  it('el botón de confirmar dice EL MONTO, y no se puede confirmar $0', () => {
    // «Confirmar» a secas obliga a subir a comprobar qué se escribió, y ésta es la
    // pantalla que se opera con una mano.
    expect(modal).toMatch(/Confirmar \$\{formatMoney\(montoNum\)\}/)
    expect(modal).toMatch(/deshabilitado=\{!\(montoNum > 0\)\}/)
  })

  it('el interruptor del recibo HACE algo y se recuerda', () => {
    // Lo había dejado como estado sin que nada lo consumiera: un control que se
    // mueve y no pasa nada. Es la octava aparición de ese patrón en el rediseño.
    expect(modal).toMatch(/abrirWhatsApp\(/)
    expect(modal).toMatch(/cf:recibo-al-confirmar/)
    expect(modal).toMatch(/onRecibo=\{cambiarRecibo\}/)
  })

  it('lo raro va PLEGADO, y al abrirlo cae al formulario de siempre', () => {
    // El motor no se reescribe: la cola offline, el recibo, la foto de evidencia,
    // las coordenadas y el aviso de duplicado siguen donde estaban.
    expect(modal).toMatch(/onLoRaro=\{\(\) => setVerFormularioCompleto\(true\)\}/)
    expect(modal).toMatch(/esPagoNormal && !verFormularioCompleto/)
    // Y el pliegue se reinicia al abrir, o quien lo toca una vez no vuelve a ver la
    // hoja nueva en esa sesión. La lista son los tipos que YA TIENEN hoja: cuando
    // solo la tenía el pago esto era `tabInicial !== 'pago'`, y al darles hoja a
    // recargo y descuento seguía mandándolos al formulario viejo — la hoja nueva no
    // se veía nunca. Lo cacé abriéndola en la app.
    expect(modal).toMatch(/setVerFormularioCompleto\(!\['pago', 'recargo', 'descuento'\]\.includes\(tabInicial\)\)/)
  })

  it('«Interés» solo donde existe', () => {
    // En cuota fija el interés ya viene dentro del total: el botón llevaría a un
    // ajuste que no aplica.
    expect(modal).toMatch(/id: 'intereses', etiqueta: 'Interés'/)
    expect(modal).toMatch(/'solo_interes', 'saldo'\]\.includes\(prestamo\?\.modoInteres\)/)
  })

  it('los medios salen de las cuentas de la ORG, no de una lista de Colombia', () => {
    const medios = mediosParaHoja(
      [{ id: 'a', nombre: 'Yape' }, { id: 'b', nombre: 'Mercado Pago' }],
      (n) => (n === 'Yape' ? '#7A1FA2' : null),
    )
    expect(medios[0]).toMatchObject({ id: 'efectivo', efectivo: true })
    expect(medios[1]).toMatchObject({ id: 'a', nombre: 'Yape', inicial: 'Y', color: '#7A1FA2' })
    expect(medios[2]).toMatchObject({ id: 'b', nombre: 'Mercado Pago', inicial: 'M' })
    // Ni una plataforma colombiana escrita a mano COMO DATO dentro del componente.
    // Se busca la forma de un valor —entre comillas o como texto de una etiqueta—, no
    // el nombre suelto: el comentario de cabecera del componente explica justo que
    // esa lista NO se escribe a mano, y para explicarlo tiene que nombrarla. Van ocho
    // veces que un aserto negativo acusa a la prosa que dice lo correcto.
    expect(hoja).not.toMatch(/['"`>]\s*(Nequi|Daviplata)\s*['"`<]/)
  })

  it('no caben más de cuatro casillas en 390px', () => {
    const muchas = Array.from({ length: 9 }, (_, i) => ({ id: `c${i}`, nombre: `Cuenta ${i}` }))
    expect(mediosParaHoja(muchas).length).toBe(4)
  })

  it('el medio se guarda en DOS campos, no en uno', () => {
    // `metodoPago` dice efectivo/transferencia y `metodoPagoId` apunta a la cuenta.
    // Confundirlos descuadra la caja por cuenta.
    const medios = mediosParaHoja([{ id: 'n1', nombre: 'Nequi' }])
    expect(medioAGuardar(medios, 'efectivo')).toEqual({ metodoPago: 'efectivo', metodoPagoId: null, nombreCuenta: null })
    expect(medioAGuardar(medios, 'n1')).toEqual({ metodoPago: 'transferencia', metodoPagoId: 'n1', nombreCuenta: 'Nequi' })
    // Un id que no existe NO se guarda como transferencia sin cuenta.
    expect(medioAGuardar(medios, 'fantasma').metodoPago).toBe('efectivo')
  })

  it('un próximo cobro que YA PASÓ no se promete', () => {
    // Con 58 días de mora, `proximoCobro` apunta al primer cobro impagado y la fila
    // salía «Próximo cobro: lun, 1 de jun» en pleno julio, dentro del bloque que
    // proyecta el futuro. Lo cazó la captura, no una prueba.
    const conPasada = adaptarDespuesDelPago(CARLOS,
      { monto: 12000, proximoCobroTexto: 'lun, 1 de jun', proximoCobroFuturo: false })
    expect(conPasada.filas.find((f) => f.clave === 'proximo')).toBeUndefined()
    const conFutura = adaptarDespuesDelPago(CARLOS,
      { monto: 12000, proximoCobroTexto: 'mié, 19 de ago', proximoCobroFuturo: true })
    expect(conFutura.filas.find((f) => f.clave === 'proximo').valor).toBe('mié, 19 de ago')
  })
})
