// lib/__tests__/gestion-cotejo.test.js — T13 y T19, las ocho hojas de gestión.
//
// Son las pantallas que cambian plata sobre un préstamo ya en marcha: recargo,
// plazo, descuento, perdidos, cierre anticipado, aplazar, día de cobro y corregir.
//
// Todas comparten patrón —qué cambia arriba, el control en medio, antes → después
// abajo— y todas terminan en un botón que dice la acción CON SU CIFRA. Estas
// pruebas fijan las decisiones que se pueden perder en un refactor: la regla del
// color, la excepción del dorado, y las dos cosas que las láminas piden y el
// backend no modela.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const gestion = leer('components/pantallas/Gestion.jsx')
const primitivos = leer('components/cf/primitivos.jsx')
const banco = leer('app/estilo/page.jsx')

describe('las ocho hojas existen y están en el banco', () => {
  const HOJAS = [
    ['T13-01 recargo', 'Recargo', 'ges-recargo'],
    ['T13-02 plazo', 'ModificarPlazo', 'ges-plazo'],
    ['T13-03 perdidos', 'MoverAPerdidos', 'ges-perdidos'],
    ['T19-01 aplazar', 'AplazarCobro', 'ges-aplazar'],
    ['T19-02 día de cobro', 'DiaDeCobro', 'ges-dia'],
    ['T19-03 descuento', 'Descuento', 'ges-descuento'],
    ['T19-04 cerrar', 'CerrarAnticipado', 'ges-cerrar'],
    ['T19-05 corregir', 'CorregirPrestamo', 'ges-corregir'],
  ]

  for (const [lamina, nombre, ancla] of HOJAS) {
    it(`${lamina} → ${nombre}`, () => {
      expect(gestion, `falta export ${nombre}`).toMatch(new RegExp(`export function ${nombre}\\b`))
      // En el banco, o no se puede cotejar contra la lámina.
      expect(banco, `${nombre} no está en el banco`).toMatch(new RegExp(`id="${ancla}"`))
      expect(banco).toMatch(new RegExp(`<${nombre}\\b`))
    })
  }
})

describe('el patrón compartido', () => {
  it('todas terminan en un botón con LA CIFRA, no en «Aplicar»', () => {
    // «Aplicar» no es una decisión; «Aplicar $15.000» sí.
    for (const texto of ['Aplicar $15.000', 'Guardar 14 cuotas', 'Perdonar $48.000', 'Cerrar por $980.000']) {
      expect(banco, `falta «${texto}»`).toMatch(new RegExp(texto.replace(/[$.]/g, '\\$&')))
    }
  })

  it('el pie es UNA pieza, no ocho barras copiadas', () => {
    expect(gestion).toMatch(/export function PieGestion/)
    // Ocho copias de una barra de acción se desincronizan en el primer cambio.
    expect((banco.match(/<PieGestion/g) ?? []).length).toBeGreaterThanOrEqual(8)
  })

  it('la acción pesa más que Cancelar, salvo en perdidos', () => {
    expect(gestion).toMatch(/flex: peligro \? 1 : 1\.7/)
    expect(gestion).toMatch(/flex: peligro \? 1\.2 : 1/)
  })
})

describe('T13-03 · la excepción del dorado', () => {
  it('«dar por perdido» va en ROJO DE CONTORNO, no en dorado', () => {
    // «La única pantalla del sistema donde el dorado no va en la acción principal»,
    // dice el pie. Aquí la acción destacada es seguir cobrando.
    expect(banco).toMatch(/<PieGestion peligro textoCancelar="Seguir cobrando"/)
    expect(gestion).toMatch(/color: 'var\(--cf-red-dark\)'/)
  })

  it('el aviso rojo lleva LA CIFRA dentro', () => {
    // «Se registra como pérdida» sin el número no asusta a nadie, y esta decisión
    // hay que tomarla asustado.
    expect(gestion).toMatch(/\{montoEnJuego\}<\/strong> de tu cartera/)
  })

  it('ofrece el acuerdo de pago ANTES de dejar dar por perdido', () => {
    // «A veces la respuesta es que nadie fue».
    expect(gestion).toMatch(/Probar primero con un acuerdo de pago/)
    expect(gestion).toMatch(/\{contactoLinea\}/)
  })
})

describe('lo que el backend NO modela va anotado y NO dibujado', () => {
  it('«¿cuándo lo cobra?» de T13-01 no se dibuja', () => {
    // Hoy un recargo hace `totalAPagar += monto` y la cuota no se toca. Un selector
    // que se mueve y no cambia nada es el patrón que ya lleva ocho apariciones.
    expect(gestion).toMatch(/PENDIENTE-BACKEND/)
    expect(gestion).not.toMatch(/En la próxima cuota/)
    expect(gestion).not.toMatch(/Repartido en las que faltan/)
  })

  it('«¿de dónde sale?» de T19-03 no se dibuja', () => {
    expect(gestion).not.toMatch(/De tu ganancia/)
    expect(gestion).not.toMatch(/Del capital<\//)
  })

  it('el recargo dice la verdad: la cuota NO cambia', () => {
    // Con la cuota de titular salía «$14.500 tachado → ahora $14.500»: el mismo
    // número a los dos lados, uno tachado, que se lee como una avería.
    expect(gestion).toMatch(/concepto="Saldo total"/)
    expect(banco).toMatch(/cuotaIgual="sigue en \$14\.500"/)
    expect(banco).toMatch(/cobrosDeMas="2 cobros más"/)
  })
})

describe('el bloque negro usa la palette OSCURA, no los tokens del tema', () => {
  it('la flecha es #F5B824 y no `var(--cf-gold)`', () => {
    // El token del tema claro daría el dorado equivocado sobre negro. Es el error
    // que ya cometí dos veces, con el dorado y con el verde.
    const bloque = primitivos.slice(
      primitivos.indexOf('export function AntesDespues'),
      primitivos.indexOf('/* ══ 4 · Pastilla'),
    )
    expect(bloque).toMatch(/stroke="#F5B824"/)
    expect(bloque).not.toMatch(/stroke="var\(--cf-gold\)"/)
    expect(bloque).toMatch(/'#2FBE6A'/)
    expect(bloque).toMatch(/'#F0575C'/)
  })

  it('«si cierra hoy» de T19-04 también', () => {
    const bloque = gestion.slice(gestion.indexOf('export function CerrarAnticipado'))
    expect(bloque).toMatch(/color: '#F5B824'/)
    expect(bloque).toMatch(/color: '#A3A8B2'/)
    expect(bloque).not.toMatch(/var\(--cf-gold\)/)
  })
})

describe('el bloque acepta TEXTO cuando lo que cambia no es plata', () => {
  it('T19-01 y T19-02 pasan `texto`', () => {
    // «hoy, martes 28» → «viernes 31». Alinear en columna «viernes» contra
    // «martes» no sirve de nada, y a 20px con la fuente de las cifras una fecha
    // larga se sale.
    expect(primitivos).toMatch(/texto = false/)
    expect(primitivos).toMatch(/fontSize: texto \? 15 : 17/)
    expect(primitivos).toMatch(/fontSize: texto \? 16 : 20/)
    const aplazar = gestion.slice(gestion.indexOf('export function AplazarCobro'))
    // Con `/\n\s+texto\n/` fallaba por el `\r` de los finales de línea Windows: `\s`
    // se comía el retorno y luego exigía un `\n` que ya no estaba. Con `^...$` y la
    // bandera multilínea da igual el final de línea del fichero.
    expect(aplazar).toMatch(/^\s+texto\s*$/m)
  })

  it('se decide POR FILA, no por bloque', () => {
    // T19-01 tiene una fila de plata —«$145.000 → $107.000»— y otra de texto
    // —«no se mueven»— en el mismo resumen.
    expect(primitivos).toMatch(/r\.texto \? undefined : 'cf-fig'/)
    expect(gestion).toMatch(/valor: avisoCuotas, texto: true/)
  })
})

describe('T19-02 · el día apagado se ve apagado, no desaparece', () => {
  it('un día sin cobro sale deshabilitado y con su motivo', () => {
    // Si falta un día en la fila, el dueño se pregunta si la app está rota;
    // apagado, entiende que él lo apagó y dónde cambiarlo.
    expect(gestion).toMatch(/disabled=\{d\.apagado\}/)
    expect(gestion).toMatch(/Apagado en tu configuración/)
    expect(banco).toMatch(/etiqueta: 'D', apagado: true/)
  })

  it('avisa de que es PARA SIEMPRE', () => {
    // Es lo que la separa de aplazar. Quien quiere mover un cobro entra aquí por
    // error y le cambia el calendario al cliente para siempre.
    expect(banco).toMatch(/subtitulo="Para siempre, no solo esta vez"/)
  })
})

describe('T19-01 · aplazar no perdona el atraso', () => {
  it('lo dice con todas las letras', () => {
    // Sin esa frase, aplazar parece un indulto y se usaría para tapar mora — y la
    // mora tapada es la que se convierte en pérdida.
    expect(gestion).toMatch(/Aplazar no perdona el atraso/)
    expect(gestion).toMatch(/Solo lo saca de tu lista de hoy/)
  })

  it('y que las demás cuotas no se mueven', () => {
    // Aplazar no es estirar el plazo: para eso está T13-02, y confundirlos cambia
    // lo que el cliente acaba pagando.
    expect(gestion).toMatch(/Las demás cuotas/)
    expect(gestion).toMatch(/avisoCuotas = 'no se mueven'/)
  })

  it('deja anotado que `proximoCobroManual` pisa el día ancla', () => {
    // Mientras ese campo esté puesto, cambiar la frecuencia o el día de cobro no
    // mueve la fecha. Es el bug que ya costó una sesión.
    expect(gestion).toMatch(/proximoCobroManual/)
  })
})

describe('T19-05 · la pantalla más peligrosa se parte en dos', () => {
  it('cada campo peligroso lleva SU consecuencia, no un aviso genérico', () => {
    // Un aviso genérico se lee una vez y se olvida; la pastilla está al lado del
    // campo que se va a tocar.
    expect(gestion).toMatch(/\{c\.consecuencia\}/)
    expect(banco).toMatch(/consecuencia: 'Recalcula 22 pagos'/)
    expect(banco).toMatch(/consecuencia: 'Mueve las fechas'/)
  })

  it('y los seguros van aparte, con su rótulo', () => {
    expect(gestion).toMatch(/Se puede cambiar sin riesgo/)
    expect(banco).toMatch(/seguros=\{\[/)
  })

  it('dice para qué SÍ es: arreglar digitación, no renegociar', () => {
    expect(banco).toMatch(/arreglar un error de digitación<\/strong>, no para renegociar/)
  })

  it('cada cambio queda firmado', () => {
    // No es un adorno legal: es lo que permite que dos personas se repartan el
    // trabajo sin desconfiar.
    expect(gestion).toMatch(/queda firmado con tu nombre y la hora/)
  })
})

describe('las piezas compartidas no están duplicadas', () => {
  it('las etiquetas de motivo son UNA pieza', () => {
    // Estaban escritas a mano dentro de `MoverAPerdidos`, y en cuanto la segunda
    // pantalla las necesitó habría habido dos copias divergiendo.
    expect(gestion).toMatch(/function Etiquetas\(/)
    expect((gestion.match(/<Etiquetas/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('el campo de monto también', () => {
    expect(gestion).toMatch(/function CampoMonto\(/)
    expect((gestion.match(/<CampoMonto/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('el contador es de 48 con radio 14, no círculos de 44', () => {
    // La lámina lo quiere cuadrado, y el «+» en dorado suave: en «extender plazo»
    // sumar es lo que se viene a hacer.
    expect(gestion).toMatch(/width: 48, height: 48, borderRadius: 14/)
    expect(gestion).not.toMatch(/width: 44, minWidth: 44, height: 44/)
  })
})
