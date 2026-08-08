import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  normalizarCliente, semaforo, limiteDelDia, parsearRespuesta,
  LIMITE_ACTIVACION, PROMPT_LOTE, PROMPT_UNO,
} from '@/lib/cartulina'

// ── PASAR EL CUADERNO EN DIEZ MINUTOS, NO EN DOS SEMANAS ────────────────────
//
// Medido en producción: de 429 negocios, 226 cargaron su cartera A MANO a uno o
// dos clientes por minuto, y el 73% se quedó en cinco clientes o menos. De los
// que pasan de 21 clientes paga la mitad; de los que se quedan en cinco, el 1%.
//
// El OCR que había acepta 5 fotos pero las FUSIONA en un solo cliente: nunca
// podía devolver más de uno. Esto es lo que lo convierte en un lote.

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const lib = leer('lib/cartulina.js')
/* ⚠ SIN COMENTARIOS. Las notas de estos archivos NOMBRAN lo que se prohíbe
   —hace falta para explicar el fallo— así que una prueba que mire el texto
   entero se acusa a sí misma. Es la tercera vez que muerde hoy. */
const sinNotas = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')
const libCodigo = sinNotas(lib)
const lote = leer('app/api/herramientas/leer-cartulinas-lote/route.js')
const uno = leer('app/api/herramientas/leer-cartulina/route.js')

describe('el modelo puede devolver muchos clientes', () => {
  it('el prompt del lote pide un array y dice qué está viendo', () => {
    /* Sus clientes llevan los registros de las tres formas —una cartulina por
       persona, un cuaderno con lista de muchos, y mezclado— así que la pantalla
       no puede preguntárselo foto por foto. */
    expect(PROMPT_LOTE).toMatch(/"tipo": "cartulina" \| "lista"/)
    expect(PROMPT_LOTE).toMatch(/"clientes": \[/)
    expect(PROMPT_LOTE).toMatch(/No te saltes ninguno/)
  })

  it('y el de UNO se queda como estaba: lo usan cuatro pantallas', () => {
    expect(PROMPT_UNO).not.toMatch(/"clientes"/)
  })

  it('acepta el array pelado, que es lo que el modelo devuelve a veces', () => {
    expect(parsearRespuesta('```json\n[{"nombre":"Ana"}]\n```')).toEqual([{ nombre: 'Ana' }])
    expect(parsearRespuesta('{"tipo":"lista","clientes":[]}')).toEqual({ tipo: 'lista', clientes: [] })
    expect(parsearRespuesta('no hay json aquí')).toBeNull()
  })

  it('⚠ un renglón vacío del cuaderno no es un cliente', () => {
    // Sin nombre NI monto no hay nada que revisar, y colarlo obliga a borrarlo
    // a mano — justo el trabajo que esto viene a quitar.
    expect(lote).toMatch(/\.filter\(\(c\) => c\.nombre \|\| c\.montoPrestado\)/)
  })

  it('⚠ una foto mala no tumba el lote', () => {
    /* Quien sube veinte fotos del cuaderno cuela una borrosa, una del dedo y
       una del techo. Todo-o-nada le haría perder las diecisiete buenas. */
    expect(lote).toMatch(/fallos\.push\(\{ foto: i \+ 1/)
    expect(lote).toMatch(/porFoto\.push/)
  })

  it('las lee de a cuatro, no todas de golpe', () => {
    // Treinta peticiones simultáneas a Gemini se ganan el 429 solas.
    expect(lote).toMatch(/const A_LA_VEZ = 4/)
  })

  it('⚠ y lee los bytes ANTES de repartir el trabajo', () => {
    /* `formData` da objetos perezosos: leídos dentro de las tandas, la petición
       puede haberse cerrado ya y el buffer llegar vacío. */
    const iPrep = lote.indexOf('const preparadas = []')
    const iTanda = lote.indexOf('for (let inicio = 0')
    expect(iPrep).toBeGreaterThan(0)
    expect(iPrep).toBeLessThan(iTanda)
  })

  it('la hoja de cuaderno se lee más grande que la cartulina', () => {
    // A 1600px y 1024 tokens, los números de la última columna se pierden y la
    // respuesta se corta a la mitad.
    expect(lote).toMatch(/lado: 2000, maxTokens: 4096/)
  })
})

describe('lo que llega se normaliza en UN solo sitio', () => {
  it('la tilde de «cédula» deja de ser un problema de cada pantalla', () => {
    /* El prompt pide «cedula» sin tilde y el modelo devuelve «cédula» a menudo.
       Las pantallas hacían `d['cédula'] || d.cedula` campo por campo, y
       `WizardCartulina` solo miraba la versión sin tilde: ahí la cédula se
       perdía en silencio. */
    const c = normalizarCliente({ nombre: 'Ana', 'cédula': '1090512345', 'teléfono': '300 887 5156' })
    expect(c.cedula).toBe('1090512345')
    expect(c.telefono).toBe('3008875156')
  })

  it('los montos con puntos de miles se entienden', () => {
    expect(normalizarCliente({ montoPrestado: '1.500.000' }).montoPrestado).toBe(1500000)
    expect(normalizarCliente({ montoPrestado: '$ 500.000' }).montoPrestado).toBe(500000)
    expect(normalizarCliente({ tasaInteres: '20%' }).tasaInteres).toBe(20)
  })

  it('⚠ y un cero NO se guarda: es «no lo leí», no «vale cero»', () => {
    // Un monto en 0 crearía un préstamo de cero pesos sin que nadie lo note.
    // Ausente, la fila sale en rojo y el usuario lo escribe.
    expect(normalizarCliente({ montoPrestado: 0 }).montoPrestado).toBeUndefined()
    expect(normalizarCliente({ cuotasPagadas: '0' }).cuotasPagadas).toBeUndefined()
  })

  it('una frecuencia inventada se descarta', () => {
    expect(normalizarCliente({ frecuencia: 'cada rato' }).frecuencia).toBeUndefined()
    expect(normalizarCliente({ frecuencia: 'Semanal' }).frecuencia).toBe('semanal')
  })

  it('entiende cómo lo escribe la gente: «debe», «resta», «abonado»', () => {
    expect(normalizarCliente({ debe: '120.000' }).saldoPendiente).toBe(120000)
    expect(normalizarCliente({ abonado: '80.000' }).montoPagadoHasta).toBe(80000)
  })
})

describe('el semáforo se cuenta, no se le pregunta al modelo', () => {
  it('⚠ NO se pide «confianza» a la IA', () => {
    /* Un modelo que se autoevalúa dice que está seguro casi siempre, y encima
       gasta tokens. La regla que sí funciona está en los dos prompts: OMITE lo
       que no puedas leer. Así «campo ausente» ES la señal. */
    expect(libCodigo).not.toMatch(/"confianza"/)
    expect(PROMPT_LOTE).toMatch(/OMÍTELO/)
  })

  it('rojo sin nombre o sin monto: no hay préstamo que crear', () => {
    expect(semaforo({ montoPrestado: 500000 })).toBe('rojo')
    expect(semaforo({ nombre: 'Ana' })).toBe('rojo')
  })

  it('ámbar cuando se puede crear pero falta revisar algo', () => {
    expect(semaforo({ nombre: 'Ana', montoPrestado: 500000 })).toBe('ambar')
    expect(semaforo({ nombre: 'Ana', montoPrestado: 500000, frecuencia: 'diario', tasaInteres: 20 })).toBe('ambar')
  })

  it('verde solo cuando no hay que tocar nada', () => {
    expect(semaforo({ nombre: 'Ana', montoPrestado: 500000, frecuencia: 'diario', tasaInteres: 20, diasPlazo: 30 })).toBe('verde')
  })
})

describe('los frenos', () => {
  it('⚠ la clave de pago va PRIMERA, no en rueda', () => {
    /* Era round-robin puro entre las cinco, y las cinco no son iguales: una se
       pagó y cuatro son de cuota gratis. Con la rueda, la de pago atendía una
       de cada cinco peticiones y las otras cuatro seguían topando. */
    expect(libCodigo).not.toMatch(/geminiKeyIndex/)
    expect(lib).toMatch(/for \(const key of GEMINI_KEYS\)/)
    expect(lib).toMatch(/if \(res\.status === 429\) \{ ultimo429 = true; continue \}/)
  })

  it('el cupo de la activación sube de 60 a 300', () => {
    /* Con la clave de pago primera el freno deja de ser la cuota de Google y
       pasa a ser el costo, que a 2.5-flash son centavos por foto. Un
       prestamista con 200 clientes necesita 200 lecturas, no 60; cortarle a
       mitad de la migración es perderlo entero. */
    expect(LIMITE_ACTIVACION).toBe(300)
    const nueva = limiteDelDia('starter', new Date())
    expect(nueva).toBe(300)
  })

  it('y pasada la activación vuelve el límite del plan', () => {
    const vieja = new Date(Date.now() - 60 * 86400000)
    expect(limiteDelDia('starter', vieja)).toBe(15)
    expect(limiteDelDia('professional', vieja)).toBe(80)
  })

  it('el contador cuenta FOTOS, no clientes', () => {
    /* Lo que cuesta dinero es la llamada a Gemini. Una hoja con treinta
       clientes es UNA lectura, y esa es justo la vía que queremos premiar. */
    expect(lote).toMatch(/const leidas = porFoto\.length/)
    expect(lote).toMatch(/cartulinasHoy: usadasHoy \+ leidas/)
  })
})

describe('el endpoint de siempre no cambia de contrato', () => {
  it('sigue fusionando en UN cliente', () => {
    // Lo usan `/migrador`, `/clientes/nuevo`, `ImportarCartulina` y el wizard.
    expect(uno).toMatch(/function fusionar\(resultados\)/)
    expect(uno).toMatch(/datos = resultados\.length === 1 \? resultados\[0\] : fusionar/)
  })

  it('y avisa cuando dos cartulinas dicen montos distintos', () => {
    // Ese número decide toda la deuda: elegir uno en silencio es de las cosas
    // que no se descubren hasta que el cliente reclama.
    expect(uno).toMatch(/_advertencia/)
  })
})
