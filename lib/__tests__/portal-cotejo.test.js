import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  loQueDebe, proximaCuota, misPagos, avisoDePago,
  respuestaDeRecuperacion, PROMESA_DE_PRIVACIDAD, pinCompleto, soloDigitos,
} from '../adaptadores/portal.js'

const RAIZ = process.cwd()
const fmt = (n) => `$${Number(n).toLocaleString('es-CO')}`
const portal = readFileSync(join(RAIZ, 'components/pantallas/PortalCliente.jsx'), 'utf8')

/* ══════════════════════════════════════════════════════════════════════════
   El portal es la única cara pública del producto: un prestamista lo ve una
   vez, sus treinta clientes lo ven todos los días. Estas pruebas defienden
   las tres cosas que no son de diseño.
   ══════════════════════════════════════════════════════════════════════════ */

describe('lo pagado es el logro, no la deuda', () => {
  const deuda = loQueDebe({
    totalAPagar: 435_000, pagado: 304_500, cuotasPagadas: 22, cuotasTotales: 30, diasMora: 36,
  }, fmt)

  it('la barra mide LO PAGADO, no lo que falta', () => {
    // Con la barra midiendo la deuda, quien ha pagado el 70% vería una barra casi
    // vacía por un logro casi completo. Es el mismo número que el dueño ve como
    // «cobrado», leído desde el otro lado.
    expect(deuda.progreso).toBe(70)
  })

  it('la cifra grande es lo que falta, dicho en segunda persona', () => {
    expect(deuda.etiqueta).toBe('Te falta pagar')
    expect(deuda.falta).toBe('$130.500')
  })

  it('lo pagado más lo que falta es el total', () => {
    expect(deuda.numeros.pagado + deuda.numeros.falta).toBe(deuda.numeros.total)
  })

  it('pagar de más no deja la barra por encima de 100 ni la deuda en negativo', () => {
    const d = loQueDebe({ totalAPagar: 100_000, pagado: 150_000 }, fmt)
    expect(d.progreso).toBe(100)
    expect(d.numeros.falta).toBe(0)
  })

  it('sin mora no se enseña una pastilla vacía', () => {
    expect(loQueDebe({ totalAPagar: 100, pagado: 50, diasMora: 0 }, fmt).mora).toBeNull()
  })

  it('sin total no se divide por cero', () => {
    const d = loQueDebe({}, fmt)
    expect(d.progreso).toBe(0)
    expect(d.numeros.total).toBe(0)
  })

  it('el componente pinta esa barra en verde', () => {
    expect(portal).toMatch(/borderRadius: 999, background: 'var\(--cf-green\)'/)
  })
})

describe('la próxima cuota', () => {
  it('el día relativo va delante del absoluto', () => {
    // «Mañana» contesta la pregunta; «martes 29 de julio» la confirma.
    const p = proximaCuota({ monto: 14_500, relativo: 'mañana', fecha: 'martes 29 de julio' }, fmt)
    expect(p.cuando).toBe('mañana, martes 29 de julio')
    expect(p.monto).toBe('$14.500')
  })

  it('sin cuota que cobrar no se enseña la tarjeta', () => {
    expect(proximaCuota({}, fmt)).toBeNull()
  })
})

describe('sus pagos', () => {
  it('el abono se distingue de la cuota completa sin hacer la resta', () => {
    const [completa, abono] = misPagos([
      { id: 1, fecha: '19 de julio', monto: 14_500 },
      { id: 2, fecha: '12 de julio', monto: 8_000, tipo: 'abono' },
    ], fmt)
    expect(completa.color).toBe('verde')
    expect(abono.color).toBe('oro')
    expect(abono.fecha).toBe('12 de julio · abono')
  })
})

describe('«avisar» no registra el pago', () => {
  it('devuelve un texto, no manda nada', () => {
    // Quien pulsa enviar es el cliente, en su propio WhatsApp. Y el pago lo
    // registra quien cobra: si esta pantalla diera a entender que ya quedó
    // registrado, el cliente dejaría de insistir y el cobro se perdería.
    const t = avisoDePago({ nombre: 'Steven Olmos', monto: 14_500, cuando: 'hoy' }, fmt)
    expect(t).toContain('Steven Olmos')
    expect(t).toContain('$14.500')
    expect(typeof t).toBe('string')
  })

  it('sin monto sigue diciendo algo con sentido', () => {
    expect(avisoDePago({ nombre: 'Ana' }, fmt)).toBe('Hola, soy Ana. Ya hice el pago. Gracias.')
  })
})

describe('recuperar la clave no filtra quién es cliente de quién', () => {
  it('la respuesta es condicional, nunca confirma que el número exista', () => {
    // Si dijera «ese número no está registrado», cualquiera podría probar
    // teléfonos hasta averiguar quién le debe a quién — y en este negocio eso
    // pone en riesgo al deudor, no al negocio.
    const r = respuestaDeRecuperacion({ prestamista: 'Don Carlos' })
    expect(r.nota).toMatch(/^Si el número está registrado/)
    expect(r.nota).not.toMatch(/no (está|existe|aparece)/i)
  })

  it('la función ni siquiera recibe si el número existe', () => {
    // No puede filtrarlo aunque alguien lo intente más adelante: el dato no entra.
    expect(respuestaDeRecuperacion.length).toBeLessThanOrEqual(1)
    const conExiste = respuestaDeRecuperacion({ prestamista: 'X', existe: true })
    const sinExiste = respuestaDeRecuperacion({ prestamista: 'X', existe: false })
    expect(conExiste.nota).toBe(sinExiste.nota)
  })

  it('la salida humana lleva el nombre de la persona, no el de la app', () => {
    // El cliente no conoce «Control Finanzas»: conoce a quien le prestó.
    expect(respuestaDeRecuperacion({ prestamista: 'Don Carlos' }).humana)
      .toBe('Escribirle a Don Carlos')
  })

  it('sin prestamista no se inventa un nombre', () => {
    const r = respuestaDeRecuperacion({})
    expect(r.humana).toBeNull()
    expect(r.nota).not.toMatch(/undefined|null/)
  })

  it('la defensa contra la estafa está siempre', () => {
    // Si alguien clona esta página para cobrar, la original ya dijo que aquí
    // nunca se pide plata.
    for (const args of [{}, { prestamista: 'X' }]) {
      expect(respuestaDeRecuperacion(args).seguridad)
        .toBe('Esta página es solo para consultar. Aquí no se paga ni se pide plata.')
    }
  })
})

describe('el PIN', () => {
  it('son cuatro dígitos y nada más', () => {
    expect(pinCompleto(['1', '2', '3', '4'])).toBe(true)
    expect(pinCompleto(['1', '2', '3'])).toBe(false)
    expect(pinCompleto(['1', '2', '3', 'a'])).toBe(false)
    expect(pinCompleto([])).toBe(false)
  })

  it('lo pegado se limpia y se recorta', () => {
    expect(soloDigitos('7-2 4 9 5')).toEqual(['7', '2', '4', '9'])
    expect(soloDigitos('abc')).toEqual([])
  })

  it('el acierto NO se decide en el cliente', () => {
    // Comparar el PIN aquí sería regalarlo a quien mire el código del navegador.
    const cuerpo = portal.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(cuerpo).not.toMatch(/pin\s*===\s*['"]/i)
    expect(cuerpo).not.toMatch(/pinCorrecto|pinEsperado/)
  })

  it('el navegador no guarda ni la cédula ni el PIN', () => {
    // Un PIN de cuatro cifras que abre la deuda de una persona no tiene por qué
    // quedarse en el gestor de contraseñas de un teléfono que se presta.
    const acceso = portal.slice(portal.indexOf('export function PortalAcceso'), portal.indexOf('export function PortalPrestamo'))
    const campos = acceso.match(/autoComplete="[^"]*"/g) ?? []
    expect(campos.length).toBeGreaterThanOrEqual(2)
    expect(campos.every((c) => c === 'autoComplete="off"')).toBe(true)
  })

  it('el error de entrar no dice cuál de los dos falló', () => {
    // Decir «esa cédula no existe» confirmaría que la otra sí, y eso es lo que no
    // puede saberse desde fuera.
    expect(portal).toMatch(/no dice si falló la cédula o el PIN/)
  })
})

describe('lo que el portal promete y limita', () => {
  it('la puerta dice qué se puede ver y qué no', () => {
    // El deudor desconfía por defecto, y con razón: le están pidiendo la cédula.
    expect(PROMESA_DE_PRIVACIDAD).toMatch(/tu propio préstamo/)
    expect(PROMESA_DE_PRIVACIDAD).toMatch(/No se muestra información de otras personas/)
  })

  it('no hay nada del negocio en la pantalla del cliente', () => {
    // Ni totales, ni cartera, ni ganancia, ni otros clientes. Si una de estas
    // palabras aparece, alguien acaba de filtrar el negocio en la cara pública.
    const prestamo = portal.slice(
      portal.indexOf('export function PortalPrestamo'),
      portal.indexOf('export function PortalRecuperar'),
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    for (const prohibida of ['cartera', 'ganancia', 'recaudado', 'utilidad', 'interés cobrado']) {
      expect(prestamo.toLowerCase()).not.toContain(prohibida)
    }
  })
})
