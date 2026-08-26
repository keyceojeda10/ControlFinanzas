// Tests del sanitizador: la última línea de defensa antes de enviar.
// Foco: la alucinación de "recordatorios automáticos a los clientes" que SÍ
// llegó a leads reales, sin borrar funciones que sí existen.
import { describe, it, expect } from 'vitest'
import { sanitizar, detectarViolaciones } from './sanitizador.js'

describe('sanitizador — bloquea que el sistema "contacte al deudor"', () => {
  it('borra "le envía recordatorios automáticos a sus clientes" (con tilde)', () => {
    const out = sanitizar('Con el sistema organiza todo desde el celular. Además le envía recordatorios automáticos a sus clientes para que paguen a tiempo.')
    expect(out.toLowerCase()).not.toContain('recordatorios automáticos')
    expect(out).toContain('Con el sistema organiza todo desde el celular')
  })

  it('borra "le avisa automáticamente cuando un cliente está por vencer"', () => {
    const out = sanitizar('El sistema le avisa automáticamente cuando un cliente está por vencer.')
    expect(out.toLowerCase()).not.toContain('avisa automáticamente')
  })

  it('detectarViolaciones marca el recordatorio inventado', () => {
    const v = detectarViolaciones('le avisa automáticamente cuando un cliente esta por vencer')
    expect(v).toContain('recordatorio_inventado')
  })
})

describe('sanitizador — NO borra funciones reales', () => {
  it('conserva "calcula la mora automáticamente de cada cliente"', () => {
    const out = sanitizar('El sistema le calcula la mora automáticamente de cada cliente.')
    expect(out.toLowerCase()).toContain('calcula la mora automáticamente')
  })

  it('conserva "calcula las cuotas automáticamente"', () => {
    const out = sanitizar('El sistema calcula las cuotas automáticamente y usted no suma nada.')
    expect(out.toLowerCase()).toContain('calcula las cuotas automáticamente')
  })
})

describe('sanitizador — regresiones básicas siguen bien', () => {
  it('corrige 15 días -> 14 días', () => {
    expect(sanitizar('Son 15 dias gratis').toLowerCase()).toContain('14 días')
  })

  it('mensaje vacío devuelve fallback', () => {
    expect(sanitizar('')).toBe('Quedo atento si necesita algo.')
  })
})

describe('⚠ precios: el caso Felipe (20-ago) y la lista de todos los países', () => {
  /* Felipe habló de préstamos de $500.000 y el sanitizador reescribió el monto
     a $39.000 fijo — cotización falsa para su negocio. El bug tenía dos partes:
     sustituir por un monto que el bot no dijo, y no saber que $500.000 era el
     negocio del lead, no un precio del producto. */

  it('repite el monto del lead y NO lo reescribe a $39.000', () => {
    const lead = 'yo presto $500.000 por cliente, me sirve?'
    const out = sanitizar('Si, para prestamos de $500.000 le sirve perfecto.', lead)
    expect(out).toContain('$500.000')
    expect(out).not.toContain('$39.000')
  })

  it('un monto inventado se borra, no se sustituye por otro', () => {
    const out = sanitizar('El plan cuesta $999.999 al mes, oferta especial.')
    expect(out).not.toContain('$999.999')
    expect(out).not.toContain('$39.000')
  })

  it('los precios reales de otros países NO se tocan', () => {
    // Argentina starter $12.000, Chile starter $8.500, Paraguay professional $470.000
    expect(sanitizar('El plan Inicial en Argentina cuesta $12.000 al mes.')).toContain('$12.000')
    expect(sanitizar('El plan Empresarial en Paraguay cuesta $470.000 al mes.')).toContain('$470.000')
  })

  it('detectarViolaciones no marca el monto del lead', () => {
    const v = detectarViolaciones('Si, maneja prestamos de $500.000 sin problema.', 'yo presto $500.000 por cliente')
    expect(v).not.toContain('precio_inventado')
  })

  it('detectarViolaciones sigue marcando un precio que el bot inventó', () => {
    const v = detectarViolaciones('El plan cuesta $999.999 y tiene de todo.', 'yo tengo 20 clientes')
    expect(v).toContain('precio_inventado')
  })
})

describe('⚠ el link prometido se ENTREGA (lección 26-ago, caso Luis)', () => {
  /* «Perfecto Luis, ya esta en camino. Mire la bandeja de entrada, ahi
     encontrara el link» — el modelo prometió un link que nunca escribió. El
     sanitizador es la última línea: si promete y no lleva URL, agrega el link. */

  it('agrega el link de registro cuando promete enviarlo sin escribirlo', () => {
    const out = sanitizar('Perfecto Luis, ya esta en camino. Mire la bandeja de entrada, ahi encontrara el link para registrarse en los 14 dias gratis.')
    expect(out).toContain('https://app.control-finanzas.com/registro')
  })

  it('no duplica el link si ya lo incluyó', () => {
    const out = sanitizar('Aqui esta su link: https://app.control-finanzas.com/registro?r=2. Ya lo tiene en el chat.')
    expect(out).toContain('app.control-finanzas.com/registro')
    expect(out).not.toContain('Aqui esta el link: https://app.control-finanzas.com/registro')
  })

  it('un mensaje normal sin promesa de envío no se toca', () => {
    const out = sanitizar('Con el sistema pasa de la libreta al celular en 5 minutos.')
    expect(out).not.toContain('app.control-finanzas.com/registro')
  })
})

describe('⚠ tuteo: el bot no cambia de «usted» a «tú» solo (lección 26-ago, Wasson)', () => {
  it('marca tuteo si el bot tutea y el lead usa «usted»', () => {
    const v = detectarViolaciones('Despues de los 14 dias, elige el plan que se ajuste a tus clientes y pagos.', 'yo quiero saber cuanto vale')
    expect(v).toContain('tuteo')
  })

  it('NO marca tuteo si el lead tutea primero', () => {
    const v = detectarViolaciones('Si, puedes probarlo tu mismo sin costo.', 'tu me dices como hago para probarlo')
    expect(v).not.toContain('tuteo')
  })

  it('NO marca tuteo si el bot mantiene el «usted»', () => {
    const v = detectarViolaciones('Despues de los 14 dias, elija el plan que se ajuste a sus clientes y pagos.', 'yo quiero saber cuanto vale')
    expect(v).not.toContain('tuteo')
  })
})
