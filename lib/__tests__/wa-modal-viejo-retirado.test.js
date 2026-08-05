import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { familiaDe, plantillasDeFamilia, contextoMotor } from '@/lib/adaptadores/plantillas-wa'

// ── «SIGUE SALIENDO EL MODAL VIEJO» ─────────────────────────────────────────
//
// El dueño lo reportó con captura, y era el caso de «crédito aprobado» al crear
// un préstamo: `preselectedTemplateId` encendía el modo avanzado, o sea la
// pantalla que él quiere retirar —«el modal anterior no debería de existir ya».
//
// El motivo era entendible: la hoja no sabía abrirse en una plantilla concreta,
// y el modal viejo sí. Ahora `familiaDe` dice en qué pestaña vive, así que la
// hoja se posiciona sola y el modal deja de hacer falta por ese camino.

const hoja = readFileSync(resolve(process.cwd(), 'components/whatsapp/HojaWhatsApp.jsx'), 'utf8')

const ctx = () => contextoMotor({
  cliente: { id: '1', nombre: 'CARLOS PRUEBA', telefono: '3001234567' },
  prestamo: {
    id: 'p', montoPrestado: 1000000, totalAPagar: 1950001, cuota: 366667,
    totalPagado: 0, saldoPendiente: 1950001, diasMora: 0, estado: 'activo',
  },
  orgNombre: 'PRESTA MIL',
})

describe('la plantilla pedida abre la hoja, no el modal viejo', () => {
  it('nadie enciende el modo avanzado al abrir', () => {
    // Con `useState(Boolean(preselectedTemplateId))` o un efecto que lo ponga a
    // `true`, se vuelve al modal viejo por la puerta de atrás.
    expect(hoja, '`avanzado` vuelve a arrancar encendido')
      .toContain('const [avanzado, setAvanzado] = useState(false)')
    expect(hoja, 'hay un efecto que enciende el modal viejo')
      .not.toMatch(/if \(preselectedTemplateId\) setAvanzado\(true\)/)
    expect(hoja, '`pago` vuelve a mandar al modal viejo')
      .not.toMatch(/setAvanzado\(Boolean\(pago/)
  })

  it('la hoja se coloca en la familia de esa plantilla', () => {
    expect(hoja, 'no usa `familiaDe` para posicionarse').toContain('const f = familiaDe(preselectedTemplateId)')
    expect(hoja, 'no marca la plantilla pedida').toMatch(/setElegida\(preselectedTemplateId\)/)
  })

  it('va en un efecto, no en el valor inicial', () => {
    // La hoja se monta con la ficha —`open` decide si se VE, no si existe— así
    // que el primer render ocurre con `preselectedTemplateId` en null. Con
    // `useState` se quedaba con eso: el cliente veía «recordatorio de pago»
    // donde esperaba «crédito aprobado».
    const i = hoja.indexOf('const f = familiaDe(preselectedTemplateId)')
    const antes = hoja.slice(Math.max(0, i - 220), i)
    expect(antes, 'la colocación no está dentro de un efecto').toContain('useEffect(')
  })

  it('el modal viejo solo se alcanza por «Editar las plantillas»', () => {
    // Sigue existiendo —tiene las 14 plantillas y la sincronización— pero deja
    // de ser el destino por defecto de ningún camino.
    const usos = hoja.split('setAvanzado(true)').length - 1
    expect(usos, 'hay más de una forma de llegar al modal viejo').toBeLessThanOrEqual(1)
  })
})

describe('«crédito aprobado» está donde se busca', () => {
  it('vive en «Renovar», no en «Pago»', () => {
    // «Pago» es acusar recibo. Anunciar un crédito aprobado no es eso, y ahí
    // quedaba escondido dos pestañas más allá de donde se abre la hoja.
    expect(familiaDe('credito_aprobado')).toBe('renovar')
    expect(familiaDe('pago_confirmacion')).toBe('pago')
    expect(familiaDe('recordatorio')).toBe('cobro')
    expect(familiaDe('mora_firme')).toBe('atraso')
  })

  it('`familiaDe` no revienta con lo que no conoce', () => {
    expect(familiaDe('libre')).toBe(null)
    expect(familiaDe(null)).toBe(null)
    expect(familiaDe(undefined)).toBe(null)
    expect(familiaDe('no_existe')).toBe(null)
  })

  it('la familia donde vive la ofrece de verdad', () => {
    // Colocar la hoja en una pestaña que no la trae sería peor que no colocarla.
    const ids = plantillasDeFamilia('renovar', ctx(), 'org').map((t) => t.id)
    expect(ids, '«Renovar» no ofrece la plantilla que se le pide').toContain('credito_aprobado')
  })

  it('sale la PRIMERA de su familia', () => {
    // Al crear un préstamo es lo que se quiere mandar: si sale tercera, hay que
    // buscarla igual.
    const ids = plantillasDeFamilia('renovar', ctx(), 'org').map((t) => t.id)
    expect(ids[0]).toBe('credito_aprobado')
  })
})
