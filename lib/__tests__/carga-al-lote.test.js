import { describe, it, expect } from 'vitest'
import { filaParaLote, filasParaLote, baseDesdeNegocio, problemasPorArchivo, unirFilasDelLote, MOTIVO_CLARO } from '@/lib/carga-asesor/al-lote'

describe('filaParaLote', () => {
  it('pasa monto, tasa, cuotas y abonado al formato del lote', () => {
    const f = filaParaLote({ _id: 'a1-0', _archivo: 1, nombre: 'Ana', montoPrestado: 500000, tasaInteres: 20, numeroCuotas: 24, frecuencia: 'diario', abonadoHasta: 100000, valorCuota: 25000 })
    expect(f).toMatchObject({ _id: 'a1-0', _archivo: 1, nombre: 'Ana', monto: 500000, tasa: 20, plazoUnidades: '24', frecuencia: 'diario', yaAbonado: 100000, cuotaLeida: 25000 })
  })
  it('sin cuotas pero con días y frecuencia, saca los cobros', () => {
    expect(filaParaLote({ montoPrestado: 1, diasPlazo: 56, frecuencia: 'semanal' }).plazoUnidades).toBe('8')
  })
  it('las dudas de texto pasan a { campo, texto }', () => {
    expect(filaParaLote({ _dudas: ['Monto muy bajo (900): ¿faltan ceros?'] })._dudas).toEqual([{ campo: 'monto', texto: 'Monto muy bajo (900): ¿faltan ceros?' }])
  })
  it('«Repetida con la fila 3» queda en _repetidaDe y sale de las dudas', () => {
    const f = filaParaLote({ _dudas: ['Repetida con la fila 3'] })
    expect(f._repetidaDe).toBe('3')
    expect(f._dudas).toEqual([])
  })
  it('debe un saldo pero no dice lo abonado: se pregunta, no se inventa', () => {
    const f = filaParaLote({ montoPrestado: 300000, saldoActual: 120000 })
    expect(f.yaAbonado).toBe('')
    expect(f._dudas).toContainEqual({ campo: 'yaAbonado', texto: 'Dice que debe $120.000: ¿cuánto te ha abonado?' })
  })
  it('vacío es vacío, no cero', () => {
    const f = filaParaLote({ nombre: 'X', montoPrestado: '', tasaInteres: '' })
    expect(f.monto).toBe(''); expect(f.tasa).toBe('')
  })
})

describe('filaParaLote: el resto de la forma del lote', () => {
  it('trae todas las llaves del lote, con los vacíos en su sitio', () => {
    expect(filaParaLote({})).toEqual({
      _id: undefined, nombre: '', cedula: '', telefono: '', direccion: '',
      monto: '', tasa: '', frecuencia: '', plazoUnidades: '', fechaInicio: '',
      yaAbonado: '', cuotaLeida: '', saldoPendiente: '', diaCobro: '',
      _dudas: [], _avisos: [], _archivo: null, _hoja: null, _repetidaDe: null, _ia: null,
    })
  })
  it('las cifras de un Excel (texto con puntos, signo o %) salen como número', () => {
    const f = filaParaLote({ montoPrestado: '$ 1.500.000', tasaInteres: '20%', numeroCuotas: '30', abonadoHasta: '100.000', valorCuota: '60.000', saldoActual: '1.400.000' })
    expect(f).toMatchObject({ monto: 1500000, tasa: 20, plazoUnidades: '30', yaAbonado: 100000, cuotaLeida: 60000, saldoPendiente: 1400000 })
  })
  it('texto sin cifra no se vuelve cero', () => {
    const f = filaParaLote({ montoPrestado: 'n/a', tasaInteres: '-' })
    expect(f.monto).toBe(''); expect(f.tasa).toBe('')
  })
  it('la frecuencia del Excel se pasa a la del sistema', () => {
    expect(filaParaLote({ frecuencia: 'Semanal' }).frecuencia).toBe('semanal')
    expect(filaParaLote({ frecuencia: 'Q' }).frecuencia).toBe('quincenal')
    expect(filaParaLote({ diasPlazo: 60, frecuencia: 'mes' }).plazoUnidades).toBe('2')
  })
  it('una frecuencia que no se entiende queda vacía y se pregunta', () => {
    const f = filaParaLote({ frecuencia: 'cada rato' })
    expect(f.frecuencia).toBe('')
    expect(f._dudas).toContainEqual({ campo: 'frecuencia', texto: 'No se entiende la frecuencia «cada rato»: elígela tú.' })
  })
  it('la fecha del Excel sale como AAAA-MM-DD; la que no se entiende se pregunta', () => {
    expect(filaParaLote({ fechaInicio: '15/03/2026' }).fechaInicio).toBe('2026-03-15')
    expect(filaParaLote({ fechaInicio: '2026-03-15' }).fechaInicio).toBe('2026-03-15')
    const f = filaParaLote({ fechaInicio: 'el mes pasado' })
    expect(f.fechaInicio).toBe('')
    expect(f._dudas).toContainEqual({ campo: 'fechaInicio', texto: 'No se entiende la fecha «el mes pasado»: ponla tú.' })
  })
  it('el plazo en días mínimo es un cobro', () => {
    expect(filaParaLote({ diasPlazo: 3, frecuencia: 'mensual' }).plazoUnidades).toBe('1')
  })
  it('los campos de la duda se adivinan por la palabra', () => {
    const campos = (t) => filaParaLote({ _dudas: [t] })._dudas[0].campo
    expect(campos('Sin monto')).toBe('monto')
    expect(campos('La tasa no cuadra')).toBe('tasa')
    expect(campos('Este lo abonado no está escrito en el papel')).toBe('yaAbonado')
    expect(campos('En el papel solo está el día 5, no la fecha')).toBe('fechaInicio')
    expect(campos('Sin nombre')).toBe('')
  })
  it('una duda que ya es { campo, texto } se respeta', () => {
    expect(filaParaLote({ _dudas: [{ campo: 'tasa', texto: 'Mírala' }] })._dudas).toEqual([{ campo: 'tasa', texto: 'Mírala' }])
  })
  it('con el abonado dicho, o sin saldo, no se pregunta nada', () => {
    expect(filaParaLote({ saldoActual: 120000, abonadoHasta: 50000 })._dudas).toEqual([])
    expect(filaParaLote({ montoPrestado: 300000 })._dudas).toEqual([])
  })
  it('los avisos del importador pasan tal cual', () => {
    expect(filaParaLote({ _avisos: ['Sin cédula: se le pone un identificador automático'] })._avisos).toEqual(['Sin cédula: se le pone un identificador automático'])
  })
  it('el nombre, la cédula, el teléfono y la dirección no se recortan', () => {
    const f = filaParaLote({ nombre: 'María del Pilar Gómez Hernández', cedula: '1.023.456.789', telefono: '3001234567', direccion: 'Calle 45 # 12-34 Barrio Los Alcázares' })
    expect(f).toMatchObject({ nombre: 'María del Pilar Gómez Hernández', cedula: '1.023.456.789', telefono: '3001234567', direccion: 'Calle 45 # 12-34 Barrio Los Alcázares' })
  })
})

describe('filasParaLote', () => {
  it('convierte cada fila y conserva el orden', () => {
    expect(filasParaLote([{ _id: 'a' }, { _id: 'b' }]).map((f) => f._id)).toEqual(['a', 'b'])
  })
  it('sin filas, lista vacía', () => {
    expect(filasParaLote()).toEqual([])
    expect(filasParaLote(null)).toEqual([])
  })
})

describe('baseDesdeNegocio', () => {
  it('usa «Cómo prestas por defecto»', () => {
    expect(baseDesdeNegocio({ tasaDefault: 15, frecuenciaDefault: 'semanal', modoInteresDefault: 'unico' })).toEqual({ tasa: '15', frecuencia: 'semanal', modoInteres: 'unico', rutaId: '' })
  })
  it('sin nada guardado: vacío, ni diario ni 20', () => {
    expect(baseDesdeNegocio({})).toEqual({ tasa: '', frecuencia: '', modoInteres: 'fijo', rutaId: '' })
  })
  it('sin negocio tampoco revienta', () => {
    expect(baseDesdeNegocio(null)).toEqual({ tasa: '', frecuencia: '', modoInteres: 'fijo', rutaId: '' })
  })
})

describe('problemasPorArchivo', () => {
  it('un Excel sin ninguna fila sale como sinFilas con su nombre', () => {
    const r = problemasPorArchivo([{ n: 1, nombre: 'clientes.xlsx', tipo: 'excel', filas: 0, fallos: ['Fila 2: sin nombre'] }])
    expect(r).toEqual([{ n: 1, nombre: 'clientes.xlsx', tipo: 'excel', sinFilas: true, motivos: ['Fila 2: sin nombre'] }])
  })
  it('un archivo que dio filas y trae avisos no es sinFilas', () => {
    expect(problemasPorArchivo([{ n: 2, nombre: 'f.jpg', tipo: 'imagen', filas: 12, fallos: ['El total no cuadra'] }])[0].sinFilas).toBe(false)
  })
  it('sin nada que decir no sale', () => {
    expect(problemasPorArchivo([{ n: 1, nombre: 'f.jpg', tipo: 'imagen', filas: 3, fallos: [] }])).toEqual([])
  })
  it('un archivo que dio cero filas sin decir por qué también sale', () => {
    expect(problemasPorArchivo([{ n: 3, nombre: 'v.pdf', tipo: 'pdf', filas: 0, fallos: [] }])).toEqual([{ n: 3, nombre: 'v.pdf', tipo: 'pdf', sinFilas: true, motivos: [] }])
  })
  it('un archivo que todavía no se ha leído no sale', () => {
    expect(problemasPorArchivo([{ n: 4, nombre: 'n.jpg', tipo: 'imagen' }])).toEqual([])
  })
  it('sin archivos, nada', () => {
    expect(problemasPorArchivo()).toEqual([])
  })
})

describe('unirFilasDelLote', () => {
  it('suma las nuevas del servidor sin pisar lo corregido ni traer las creadas', () => {
    const locales = [{ _id: 'a', nombre: 'Ana corregida' }]
    const servidor = [{ _id: 'a', nombre: 'Ana' }, { _id: 'b', nombre: 'Beto' }, { _id: 'c', nombre: 'Caro' }]
    expect(unirFilasDelLote(locales, servidor, ['c']).map((f) => f.nombre)).toEqual(['Ana corregida', 'Beto'])
  })
  it('sin creadas ni locales, entra todo lo del servidor', () => {
    expect(unirFilasDelLote(undefined, [{ _id: 'a' }, { _id: 'b' }]).map((f) => f._id)).toEqual(['a', 'b'])
  })
  it('las ya creadas no vuelven aunque el servidor las siga trayendo', () => {
    expect(unirFilasDelLote([], [{ _id: 'a' }], ['a'])).toEqual([])
  })
})

describe('MOTIVO_CLARO', () => {
  it('traduce los mensajes del importador a palabras claras', () => {
    expect(MOTIVO_CLARO['Tasa de interés es requerida y no puede ser negativa']).toBe('Falta la tasa')
    expect(MOTIVO_CLARO['Plazo en días (o número de cuotas) debe ser mayor a 0']).toBe('Falta el plazo o el número de cuotas')
    expect(MOTIVO_CLARO['Fecha de inicio no válida. Usa DD/MM/YYYY o YYYY-MM-DD']).toBe('Falta la fecha en que empezó el préstamo')
    expect(MOTIVO_CLARO['Monto debe ser mayor a 0']).toBe('Falta el monto prestado')
  })
})
