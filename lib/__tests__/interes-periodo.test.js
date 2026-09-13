// El interés que compra un período (13 sep 2026).
//
// Es la cifra que la hoja de cobro va a SUGERIR, y en esta pantalla una cifra
// sugerida termina cobrada. Las esperadas salen del caso que el prestamista
// contó al peso —$500.000 al 20% quincenal son $50.000— y de lo medido contra
// el espejo, no de volver a correr la fórmula aquí.
import { interesQueCompraUnPeriodo } from '@/lib/dinero/interes-periodo'

// Un préstamo clásico: sin tabla, así que el interés sube la deuda.
const clasico = (extra = {}) => ({
  id: 1,
  modoInteres: 'fijo',
  tasaInteres: 20,
  frecuencia: 'quincenal',
  montoPrestado: 500000,
  capitalRestante: 500000,
  ...extra,
})

describe('la cifra', () => {
  it('el caso del prestamista: $500.000 al 20% quincenal son $50.000', () => {
    expect(interesQueCompraUnPeriodo(clasico())).toEqual({
      monto: 50000,
      periodo: 'una quincena',
      etiqueta: 'Interés de una quincena',
    })
  })

  it('la tasa es mensual: la misma tasa da cifras distintas por frecuencia', () => {
    const de = (frecuencia, capitalRestante) =>
      interesQueCompraUnPeriodo(clasico({ frecuencia, capitalRestante })).monto
    // Medido contra el espejo, en préstamos sin recargos ni abonos.
    expect(de('mensual', 500000)).toBe(100000)
    expect(de('quincenal', 500000)).toBe(50000)
    // 4 semanas = 1 mes es la convención del gremio, no 30/7.
    expect(de('semanal', 600000)).toBe(30000)
    expect(de('diario', 450000)).toBe(3000)
  })

  it('cobra sobre el capital VIVO, no sobre lo que se prestó', () => {
    // Abonó $200.000 a capital: el período siguiente genera menos interés.
    const p = clasico({ capitalRestante: 300000 })
    expect(interesQueCompraUnPeriodo(p).monto).toBe(30000)
  })

  it('el modo legacy prorratea por días, no por bloques de frecuencia', () => {
    // `proporcional` es monto × tasa% × días/30: una semana son 7/30 de mes,
    // no 1/4. Con la fórmula de «fijo» saldrían $30.000.
    const p = clasico({ modoInteres: 'proporcional', frecuencia: 'semanal', capitalRestante: 600000 })
    expect(interesQueCompraUnPeriodo(p).monto).toBe(28000)
  })
})

describe('cuándo NO hay cifra', () => {
  it('sin el capital pendiente no se cae a lo prestado', () => {
    // `montoPrestado` es siempre MAYOR: sugerirlo cobra de más.
    const p = clasico({ capitalRestante: undefined })
    expect(p.montoPrestado).toBe(500000)
    expect(interesQueCompraUnPeriodo(p)).toBeNull()
  })

  it('en «de una vez» la tasa es plana: partirla sería inventarla', () => {
    expect(interesQueCompraUnPeriodo(clasico({ modoInteres: 'unico' }))).toBeNull()
  })

  it('en «manual» no hay tasa que repartir', () => {
    expect(interesQueCompraUnPeriodo(clasico({ modoInteres: 'manual' }))).toBeNull()
  })

  it('con tabla de amortización el interés ya está pactado', () => {
    const conTabla = clasico({ modoInteres: 'saldo', cuotasAmortizacion: [] })
    expect(interesQueCompraUnPeriodo(conTabla)).toBeNull()
  })

  it('un préstamo con tabla sin el include revienta, no adivina', () => {
    // Misma regla que `elInteresSubeLaDeuda`: un `include` olvidado no puede
    // resolverse eligiendo entre dos comportamientos que mueven plata distinta.
    expect(() => interesQueCompraUnPeriodo(clasico({ modoInteres: 'saldo' }))).toThrow(/cuotasAmortizacion/)
  })

  it('sin tasa, sin frecuencia conocida o sin préstamo, nada', () => {
    expect(interesQueCompraUnPeriodo(clasico({ tasaInteres: 0 }))).toBeNull()
    expect(interesQueCompraUnPeriodo(clasico({ tasaInteres: null }))).toBeNull()
    expect(interesQueCompraUnPeriodo(clasico({ frecuencia: 'bimestral' }))).toBeNull()
    expect(interesQueCompraUnPeriodo(null)).toBeNull()
  })

  it('un interés que redondea a cero no es un atajo', () => {
    // Diario, capital pequeño: $1.000 al 20% mensual son $6,67 al día.
    const p = clasico({ frecuencia: 'diario', capitalRestante: 60 })
    expect(interesQueCompraUnPeriodo(p)).toBeNull()
  })
})

// ── EL CABLEADO ──────────────────────────────────────────────────────────────
// Vitest corre sin DOM: lo que se puede anclar aquí es que la hoja pida la
// cifra a la única función que la sabe, y que NO rellene el campo sola.
// Anclado en el JSX, no en la prosa: este repo cita sus propias reglas en los
// comentarios y una prueba que las busque en texto pasa con el fallo puesto.
import { readFileSync } from 'fs'
import path from 'path'

const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const HOJA = sinComentarios(readFileSync(path.join(process.cwd(), 'components/prestamos/RegistrarPago.jsx'), 'utf8'))

describe('la hoja de «Interés»', () => {
  it('pide la cifra a la función única, y solo donde compra tiempo', () => {
    expect(HOJA).toMatch(/import \{ interesQueCompraUnPeriodo \}/)
    expect(HOJA).toMatch(/const interesDelPeriodo = subeLaDeuda \? interesQueCompraUnPeriodo\(prestamo\) : null/)
    // Nadie más puede volver a calcularlo por su cuenta.
    expect(HOJA).not.toMatch(/PERIODOS_POR_MES/)
  })

  it('el campo sigue vaciándose al entrar: la cifra se ofrece, no se pone', () => {
    // Heredar un monto en «Solo interés» subía la deuda de un toque. El atajo
    // hay que tocarlo; entrar en la pestaña no escribe nada.
    expect(HOJA).toMatch(/if \(subeLaDeuda\) fijarMonto\(''\)/)
    expect(HOJA).not.toMatch(/fijarMonto\(String\(interesDelPeriodo/)
  })

  it('el atajo sale solo en «Interés», con su nombre y su cifra', () => {
    const bloque = HOJA.match(/const atajos = conAtajos[\s\S]*?\n {8}: \[\]/)
    expect(bloque).not.toBeNull()
    expect(bloque[0]).toMatch(/tipo === 'intereses' && interesDelPeriodo/)
    expect(bloque[0]).toMatch(/etiqueta: `\$\{interesDelPeriodo\.etiqueta\} \$\{formatMoney\(interesDelPeriodo\.monto\)\}`/)
    expect(bloque[0]).toMatch(/monto: interesDelPeriodo\.monto/)
    // Los de la cuota siguen fuera de capital e interés.
    expect(HOJA).toMatch(/const conAtajos = tipo === 'completo' \|\| tipo === 'parcial'/)
  })
})
