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
  montoCrudoConModo, montoParaMostrarConModo,
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
  it('«Cuota» y «Todo lo que debe» — sin «Mitad», y esto SE APARTA DE LA LAMINA', () => {
    // T02-04 dibuja «Cuota $12.000 · Mitad · Todo lo que debe». «Mitad» se cae
    // a peticion del usuario, que es quien cobra: era la mitad del SALDO, y en
    // un prestamo de $553.658 escribia $276.829 — una cifra que no se cobra en
    // ninguna visita de gota a gota.
    const a = atajosDeMonto(CARLOS)
    expect(a.map((x) => x.id)).toEqual(['cuota', 'todo'])
    expect(a.map((x) => x.monto)).toEqual([12000, 160000])
    expect(a.map((x) => x.etiqueta)).toEqual(['Cuota', 'Todo lo que debe'])
  })

  it('«Al día» sale solo si debe MAS que la cuota de hoy', () => {
    // Si no, seria el mismo boton que «Cuota» con otro nombre.
    const alCorriente = atajosDeMonto({ ...CARLOS, montoAlDia: 12000 })
    expect(alCorriente.some((x) => x.id === 'aldia')).toBe(false)

    const atrasado = atajosDeMonto({ ...CARLOS, montoAlDia: 36000 })
    const aldia = atrasado.find((x) => x.id === 'aldia')
    expect(aldia.monto).toBe(36000)
    expect(aldia.etiqueta).toBe('Al día')
  })

  it('con liquidacion, el boton COBRA MENOS y CAMBIA DE NOMBRE', () => {
    // Poner «todo lo que debe» sobre una cifra MENOR que el saldo seria mentir
    // en el sitio donde mas caro sale. Y al reves: el saldo entero lleva dentro
    // todo el interes futuro, asi que ofrecerlo a quien quiere cancelar le
    // cobra de mas.
    const con = atajosDeMonto({ ...CARLOS, cancelarHoy: 140000 })
    const cerrar = con.find((x) => x.id === 'cancelar')
    expect(cerrar.monto).toBe(140000)
    expect(cerrar.etiqueta).toBe('Cancelar hoy')
    // Y entonces NO sale ademas «Todo lo que debe»: son la misma decision.
    expect(con.some((x) => x.id === 'todo')).toBe(false)
  })

  it('sin dato de liquidacion NO se inventa: vuelve «Todo lo que debe»', () => {
    // El endpoint puede fallar o el prestamo no estar activo. Es plata: se cae
    // al saldo, que es cierto, en vez de a un numero calculado a ojo.
    const sin = atajosDeMonto({ ...CARLOS, cancelarHoy: 0 })
    expect(sin.find((x) => x.id === 'todo').monto).toBe(160000)
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
    // El campo pasa por `verMonto`/`leerMonto`, que son
    // `montoParaMostrarConModo`/`montoCrudoConModo` con el modo abreviado del
    // negocio. Antes llamaban directo a las versiones sin modo, y por eso la
    // hoja nueva se saltaba el abreviado en silencio.
    expect(modal).toMatch(/monto=\{verMonto\(monto\)\}/)
    expect(modal).toMatch(/setMonto\(leerMonto\(v\)\)/)
    expect(modal).toMatch(/montoParaMostrarConModo\(v, modoAbreviado/)
    // La conversión vive dentro de `leerMonto`, que además recuerda lo
    // TECLEADO: guardar el valor ya multiplicado montaba un bucle que
    // multiplicaba en cada tecla («40500» -> $40.500.000) y tumbaba el pago.
    expect(modal).toMatch(/montoCrudoConModo\(crudo, modoAbreviado\)/)
    expect(modal).toMatch(/const \[montoTecleado, setMontoTecleado\]/)
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
    //
    // Va con `overflowWrap` y no con `wordBreak`: el segundo parte por LETRAS y
    // dejaba «Bancolomb / ia», que se lee peor que el recorte que esto evitaba.
    // Lo que la prueba defiende es que NO haya elipsis, no una propiedad concreta.
    expect(hoja).toMatch(/overflowWrap: 'break-word'/)
    expect(hoja).not.toMatch(/textOverflow: 'ellipsis'[^}]*\}\)\}>\{nombre\}/)
  })

  it('el botón de confirmar dice EL MONTO, y no se puede confirmar $0', () => {
    // «Confirmar» a secas obliga a subir a comprobar qué se escribió, y ésta es la
    // pantalla que se opera con una mano.
    // El verbo cambia con el tipo —«Confirmar abono $50.000» en capital— pero el
    // monto va SIEMPRE, que es lo que esta prueba defiende.
    expect(modal).toMatch(/\$\{verbo\} \$\{formatMoney\(montoNum\)\}/)
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
    // se veía nunca. Lo cacé abriéndola en la app. Volvió a pasar con capital e
    // intereses: entrar por «Abono a capital» abría el formulario viejo.
    expect(modal).toMatch(/setVerFormularioCompleto\(!\['pago', 'recargo', 'descuento', 'capital', 'intereses'\]\.includes\(tabInicial\)\)/)
  })

  it('CAPITAL E INTERÉS se resuelven EN la hoja, no saltando al modal viejo', () => {
    // El dueño lo reportó así: «cuando se le da a pago de interés o a pago capital,
    // cambia por el modal viejo». Eran botones de primera fila de la propia hoja, y
    // pulsarlos la desmontaba debajo del dedo.
    expect(modal).toMatch(/tipo === 'capital' \|\| tipo === 'intereses'/)
    // Cambiar de aplicación NO puede volver a mandar al formulario.
    expect(modal).toMatch(/onAplicacion=\{\(a\) => setTipo\(a\.id\)\}/)
    // Y lo que el formulario viejo sí sabía hacer baja con la hoja: explicar a
    // dónde va la plata y dejar apuntar el motivo.
    expect(modal).toMatch(/explicacion=\{explicacionAplicacion\}/)
    expect(modal).toMatch(/onNota=\{explicacionAplicacion \? setNota : undefined\}/)
  })

  it('los atajos de monto NO salen en capital ni interés', () => {
    // «Cuota», «Al día» y «Cancelar hoy» responden a la pregunta de la cuota. En un
    // abono a capital la gracia es que el dueño elige cuánto, y sugerir una cifra
    // en la pantalla que registra la plata termina en un cobro que no era.
    expect(modal).toMatch(/const conAtajos = tipo === 'completo' \|\| tipo === 'parcial'/)
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

// ── EL MODO ABREVIADO ──────────────────────────────────────────────────────
//
// Con `modoAbreviado` se escribe en MILES: «40» son $40.000. Lo reportó un
// cobrador diciendo que «se le había desactivado»: seguía ENCENDIDO en
// configuración, pero la hoja de cobro del rediseño no lo aplicaba. `MoneyInput`
// —el campo viejo— sí lo hacía; el campo nuevo de 38px se lo saltó en silencio.
//
// Aquí se vigila lo único que importa: que lo que se ESCRIBE y lo que se GUARDA
// no se separen nunca. Si se separan, el cobro queda por otra plata.
describe('modo abreviado: se escribe en miles', () => {
  it('«40» se guardan como 40.000', () => {
    expect(montoCrudoConModo('40', true)).toBe('40000')
  })

  it('apagado, «40» son 40 y no se toca nada', () => {
    expect(montoCrudoConModo('40', false)).toBe('40')
    expect(montoCrudoConModo('40000', false)).toBe('40000')
  })

  it('40.000 guardados se VEN como «40»', () => {
    expect(montoParaMostrarConModo('40000', true)).toBe('40')
  })

  it('ida y vuelta: lo que se ve vuelve a ser lo mismo que se guardó', () => {
    // Es la propiedad que impide que el cobro quede por otra plata.
    for (const guardado of ['1000', '40000', '250000', '1250000']) {
      const visto = montoParaMostrarConModo(guardado, true)
      expect(montoCrudoConModo(visto, true)).toBe(guardado)
    }
  })

  it('lo que NO es múltiplo de mil se deja tal cual', () => {
    // 40.500 en abreviado se vería «41» (redondeando) y al guardar volvería
    // 41.000: le cambiaría la plata a espaldas de quien la escribió. Mejor
    // enseñar la cifra completa.
    expect(montoParaMostrarConModo('40500', true)).toBe('40.500')
  })

  it('el campo vacío se queda vacío, no en cero', () => {
    expect(montoCrudoConModo('', true)).toBe('')
    expect(montoParaMostrarConModo('', true)).toBe('')
  })

  it('apagado se comporta igual que antes', () => {
    expect(montoParaMostrarConModo('40000', false)).toBe(montoParaMostrar('40000'))
  })
})

// ── EL BUCLE QUE ROMPIÓ LOS PAGOS ──────────────────────────────────────────
//
// Al añadir el modo abreviado guardé en el estado el valor YA multiplicado y lo
// volvía a dividir para pintarlo. Eso monta un bucle: cada tecla multiplica
// otra vez sobre lo anterior.
//
// Un cliente lo reportó en vivo: «le pone el valor, le da a pagar y se le
// devuelve, no le acepta el pago». Tecleando «40500» el campo enviaba
// **$40.500.000**, que no pasa la validación del saldo.
//
// No saltó en las pruebas porque yo probaba las funciones SUELTAS —y sueltas
// están bien— en vez de la secuencia de teclas. Esto prueba la secuencia.
describe('escribir dígito a dígito en modo abreviado', () => {
  // Réplica del ciclo del campo: se ve lo tecleado, se guarda en pesos reales.
  const teclear = (teclas, abreviado) => {
    let tecleado = ''
    let guardado = ''
    for (const t of teclas) {
      tecleado = montoCrudo(tecleado + t)
      guardado = montoCrudoConModo(tecleado, abreviado)
    }
    return { tecleado, guardado: Number(guardado) }
  }

  it('«40500» son $40.500.000 en abreviado, no cuarenta millones más', () => {
    // 40.500 tecleado × 1000 = 40.500.000 — CORRECTO en abreviado (son miles).
    // Lo que NO puede pasar es que cada tecla vuelva a multiplicar.
    expect(teclear(['4','0','5','0','0'], true).guardado).toBe(40500000)
  })

  it('«40» son $40.000, no $40.000.000', () => {
    // El caso de todos los días: se teclea 40 para cobrar cuarenta mil.
    expect(teclear(['4','0'], true).guardado).toBe(40000)
  })

  it('cada tecla NO vuelve a multiplicar lo anterior', () => {
    // El fallo: 4 -> 4.000, luego 40 -> 40.000, luego 405 -> 405.000...
    // pero leyendo del ESTADO ya multiplicado daba 4.050.000 y 40.500.000.
    const pasos = ['4','0','5'].map((_, i) =>
      teclear(['4','0','5'].slice(0, i + 1), true).guardado)
    expect(pasos).toEqual([4000, 40000, 405000])
  })

  it('apagado, lo tecleado es lo que se guarda', () => {
    expect(teclear(['4','0','5','0','0'], false).guardado).toBe(40500)
  })
})
