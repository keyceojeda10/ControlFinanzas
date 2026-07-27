import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { calcularProximoCobro } from '@/lib/calculos'

// El servidor de produccion corre en UTC; los equipos de desarrollo, en Bogota.
// aplicarDiaAncla comparaba una candidata creada como medianoche LOCAL contra
// una fechaBase que lleva las 05:00Z (el convenio "medianoche de Bogota" que usa
// todo el sistema). En UTC la medianoche cae ANTES de las 05:00, asi que la
// comparacion `>=` daba false siendo el MISMO dia y empujaba el cobro al mes
// siguiente: en produccion, 59 prestamos con dia de cobro fijo mostraban su
// proximo cobro un mes tarde. En Bogota las dos fechas coinciden al milisegundo
// y el bug no se ve — por eso hay que fijar la zona horaria en el test.

const enBogota = (d) => d.toLocaleDateString('es-CO', {
  timeZone: 'America/Bogota', day: 'numeric', month: 'numeric', year: 'numeric',
})

// Caso real: presta el 20 de abril, mensual, cobra los 20. El primer cobro es
// el 20 de MAYO. Produccion mostraba el 20 de junio.
const prestamoConAncla = {
  estado: 'activo',
  frecuencia: 'mensual',
  fechaInicio: new Date('2026-04-20T05:00:00.000Z'),
  cuotaDiaria: 1200000,
  totalAPagar: 1200000,
  diasPlazo: 30,
  diaCobroMes: 20,
  totalPagado: 0,
}

// Quincenal con dos dias ancla: mismo riesgo, la fecha la sigue resolviendo
// aplicarDiaAncla (mensual ya no pasa por ahi).
const prestamoQuincenal = {
  estado: 'activo',
  frecuencia: 'quincenal',
  fechaInicio: new Date('2026-04-05T05:00:00.000Z'),
  cuotaDiaria: 500000,
  totalAPagar: 2000000,
  diasPlazo: 60,
  diaCobroMes: 5,
  diaCobroMes2: 20,
  totalPagado: 0,
}

for (const tz of ['UTC', 'America/Bogota', 'America/Mexico_City']) {
  describe(`dia de cobro fijo con el server en ${tz}`, () => {
    let tzOriginal
    beforeAll(() => { tzOriginal = process.env.TZ; process.env.TZ = tz })
    afterAll(() => { process.env.TZ = tzOriginal })

    it('mensual: el primer cobro es al mes, no a los dos meses', () => {
      const px = calcularProximoCobro(prestamoConAncla, [], [])
      expect(enBogota(px)).toBe('20/5/2026')
    })

    it('quincenal con dos anclas: cae en el siguiente dia ancla, no un mes despues', () => {
      const px = calcularProximoCobro(prestamoQuincenal, [], [])
      expect(enBogota(px)).toBe('20/4/2026')
    })
  })
}
