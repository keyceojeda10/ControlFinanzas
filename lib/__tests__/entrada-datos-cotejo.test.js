import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  FAMILIAS, PLANTILLAS, rellena, comoTexto, huecosVacios,
  enlaceWhatsApp, preparaPlantilla,
} from '../adaptadores/plantillas.js'

const lee = (p) => readFileSync(join(process.cwd(), p), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const recibo = lee('components/pantallas/Recibo.jsx')
const cliente = lee('components/pantallas/ClienteNuevo.jsx')
const historial = lee('components/pantallas/MiHistorial.jsx')
const plantillas = lee('components/pantallas/Plantillas.jsx')
const schema = lee('prisma/schema.prisma')
const whatsapp = lee('lib/whatsapp.js')

describe('T11-01 · el mensaje se lee antes de mandarlo', () => {
  it('lo rellenado viene marcado, no mezclado en una cadena', () => {
    // Una cadena ya rellenada no sabe qué parte vino de dónde, y ese es justo
    // el dato que hay que enseñar.
    const t = rellena('Hola {nombre}, tu cuota es {cuota}.', { nombre: 'Steven', cuota: '$14.500' })
    expect(t.filter((x) => x.dato).map((x) => x.texto)).toEqual(['Steven', '$14.500'])
    expect(t.filter((x) => !x.dato).map((x) => x.texto)).toEqual(['Hola ', ', tu cuota es ', '.'])
  })

  it('un hueco sin valor NO sale crudo delante del cliente', () => {
    // «Hola {nombre}» es peor que una frase coja.
    const t = rellena('Hola {nombre}, debes {saldo}.', { saldo: '$100' })
    expect(comoTexto(t)).not.toContain('{')
    expect(comoTexto(t)).toBe('Hola , debes $100.')
  })

  it('avisa de los huecos que quedaron vacíos', () => {
    // Antes de abrir WhatsApp, no después: el mensaje sale igual y el cobrador
    // no se entera.
    expect(huecosVacios('Hola {nombre}, {cuota} y {medio}', { nombre: 'X', medio: '' }))
      .toEqual(['cuota', 'medio'])
  })

  it('el texto plano no arrastra los espacios del hueco caído', () => {
    expect(comoTexto(rellena('  Hola   {x}  ', {}))).toBe('Hola')
  })

  it('sin teléfono no hay enlace, para poder apagar el botón', () => {
    // Abrir un wa.me roto es peor que el botón apagado: parece que se mandó.
    expect(enlaceWhatsApp('', 'hola')).toBeNull()
    expect(enlaceWhatsApp('123', 'hola')).toBeNull()
  })

  it('no le pone dos veces el indicativo', () => {
    // Un 5757… no le llega a nadie.
    expect(enlaceWhatsApp('3200000000', 'hola')).toContain('wa.me/573200000000')
    expect(enlaceWhatsApp('573200000000', 'hola')).toContain('wa.me/573200000000')
  })

  it('escapa el mensaje', () => {
    expect(enlaceWhatsApp('3200000000', 'a b&c')).toContain('text=a%20b%26c')
  })

  it('la plantilla libre no lleva texto ni huecos que avisar', () => {
    const libre = PLANTILLAS.cobro.find((p) => p.libre)
    const p = preparaPlantilla(libre, {})
    expect(p.texto).toBe('')
    expect(p.faltan).toEqual([])
  })

  it('las cuatro familias son el orden del día', () => {
    // Primero se cobra, luego se reclama, luego se negocia, y solo al final se
    // ofrece más plata.
    expect(FAMILIAS.map((f) => f.id)).toEqual(['cobro', 'atraso', 'acuerdo', 'renovar'])
    for (const f of FAMILIAS) expect(PLANTILLAS[f.id]?.length, f.id).toBeGreaterThan(0)
  })

  it('todas las familias dejan escribir a mano', () => {
    for (const f of FAMILIAS) {
      expect(PLANTILLAS[f.id].some((p) => p.libre), f.id).toBe(true)
    }
  })

  it('ninguna plantilla amenaza', () => {
    // No es delicadeza: un mensaje amenazante por escrito es prueba en contra
    // del prestamista, y además funciona peor.
    const todo = Object.values(PLANTILLAS).flat().map((p) => p.texto).join(' ').toLowerCase()
    for (const palabra of ['abogado', 'denuncia', 'demanda', 'policía', 'cárcel', 'embargo']) {
      expect(todo, palabra).not.toContain(palabra)
    }
  })

  it('de las cuatro que la lámina pide, tres ya existían', () => {
    // La lámina afirma que hoy no hay nada «para cobrar, reclamar un atraso,
    // cerrar un acuerdo ni ofrecer una renovación». Tres de las cuatro están.
    // La única que de verdad falta es ACUERDO.
    expect(whatsapp).toMatch(/export function generarTextoRecordatorio/)
    expect(whatsapp).toMatch(/export function generarEnlaceMora/)
    expect(whatsapp).toMatch(/export function generarTextoRenovacion/)
    expect(whatsapp).not.toMatch(/generarTextoAcuerdo/)
  })

  it('estas plantillas no traen emojis; las de hoy sí', () => {
    // Es el problema real de las que ya existen: emojis que la app no usa en
    // ninguna otra parte, y una renovación de cinco párrafos con viñetas.
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u
    const todo = Object.values(PLANTILLAS).flat().map((p) => p.texto).join(' ')
    expect(todo).not.toMatch(emoji)
    expect(whatsapp).toMatch(emoji)
  })

  it('caben en una burbuja', () => {
    // Con el cliente delante, un folleto no se lee.
    for (const p of Object.values(PLANTILLAS).flat()) {
      expect(p.texto.length, p.id).toBeLessThan(220)
    }
  })

  it('el verde de WhatsApp solo en el botón de envío', () => {
    // Si la burbuja, el icono y el botón fueran verdes, la pantalla dejaría de
    // ser de Control Finanzas.
    expect(plantillas.match(/#25D366/g) ?? []).toHaveLength(1)
  })
})

describe('T07-04 · el recibo', () => {
  it('el número de recibo NO EXISTE en el esquema', () => {
    // PENDIENTE-BACKEND. Esta prueba se muere el día que el campo aparezca, que
    // es cuando hay que quitar el condicional del componente.
    const pago = schema.match(/model Pago \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(pago).not.toMatch(/numeroRecibo|codigoRecibo|consecutivo/)
  })

  it('sin número, la fila no se pinta', () => {
    // Ni el cuid —que nadie puede leer en voz alta— ni un número inventado, que
    // no se puede verificar.
    expect(sinComentarios(recibo)).toMatch(/\{numero && \(/)
  })

  it('dice quién lo recibió', () => {
    // Un comprobante sin nombre de quien lo dio no zanja ninguna discusión.
    expect(sinComentarios(recibo)).toMatch(/Recibido por \$\{recibidoPor\}/)
  })

  it('el troquelado es punteado, que es lo que dice «se corta y se guarda»', () => {
    expect(recibo.match(/1px dashed/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('sin teléfono el botón de WhatsApp no promete un envío', () => {
    expect(sinComentarios(recibo)).toMatch(/Sin teléfono para enviarlo/)
    expect(sinComentarios(recibo)).toMatch(/disabled=\{!telefono\}/)
  })

  it('el único dorado es seguir la ruta', () => {
    // El visto es verde: es un hecho consumado, no la acción que sigue.
    expect(recibo.match(/var\(--cf-gold\)/g) ?? []).toHaveLength(1)
  })
})

describe('T07-03 · crear cliente a mano', () => {
  it('solo el nombre es obligatorio', () => {
    // El 75% de los negocios se atasca en ≤5 clientes; todo lo que frene la
    // carga en la calle sale caro.
    expect(sinComentarios(cliente)).toMatch(/const listo = String\(nombre\)\.trim\(\)\.length > 0/)
  })

  it('la cédula dice «opcional» EN EL CAMPO', () => {
    // La ayuda de abajo la lee quien ya dudó; el placeholder lo lee todo el mundo.
    expect(cliente).toMatch(/rotulo="Cédula"[\s\S]{0,220}placeholder="opcional"/)
  })

  it('ningún campo es type=number', () => {
    // `type=number` rechaza el separador que no coincide con el locale del
    // teléfono, y son doce países.
    expect(sinComentarios(cliente)).not.toMatch(/type="number"/)
    expect(sinComentarios(cliente)).toMatch(/type="text"/)
  })

  it('los campos van a 17px, no a 15', () => {
    // Por debajo de 16px iOS hace zoom al enfocar y la pantalla se descoloca.
    expect(sinComentarios(cliente)).toMatch(/fontSize: 17/)
  })

  it('las dos salidas encadenan, ninguna vuelve a la lista', () => {
    expect(sinComentarios(cliente)).toMatch(/Guardar y prestarle/)
    expect(sinComentarios(cliente)).toMatch(/Guardar y crear otro/)
  })
})

describe('T36-02 · el historial del cliente', () => {
  it('la cifra grande es lo pagado, en verde; lo que falta va más pequeño', () => {
    // Es su portal: viene a comprobar que sus pagos están, no a que le recuerden
    // la deuda. Abrir con la deuda es innecesariamente hostil.
    expect(historial).toMatch(/fontSize: 30[^}]*color: '#2FBE6A'[\s\S]{0,120}\{pagado\}/)
    expect(historial).toMatch(/fontSize: 19[^}]*color: '#F3F3F6'[\s\S]{0,120}\{falta\}/)
  })

  it('no usa el vocabulario del prestamista', () => {
    // Es la única pantalla escrita para alguien que no confía del todo en quien
    // se la muestra.
    for (const palabra of ['cartera', 'ganancia', 'recaudado', 'utilidad', 'mora']) {
      expect(historial.toLowerCase(), palabra).not.toContain(palabra)
    }
  })

  it('reclamar es a la persona, no a un formulario', () => {
    // No hay soporte al que escribir, y prometer uno sería peor.
    expect(sinComentarios(historial)).toMatch(/muéstrale tu recibo/)
    expect(sinComentarios(historial)).not.toMatch(/soporte|formulario/i)
  })

  it('es oscura siempre: los literales van en crudo, no en tokens', () => {
    // Dentro no manda el tema de la app, manda que el fondo es negro.
    expect(historial).toMatch(/background: '#15161A'/)
    expect(historial).not.toMatch(/var\(--cf-ink\)/)
  })
})

describe('reglas globales', () => {
  it('no hay emojis', () => {
    for (const [n, s] of Object.entries({ recibo, cliente, historial, plantillas })) {
      expect(s, n).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u)
    }
  })
})
