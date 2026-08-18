import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { cuentaDelDia } from '@/lib/dinero/conciliacion'

/* ══════════════════════════════════════════════════════════════════════════
   «QUE SOLAMENTE CAMBIE SI YO LLEGO Y LE SACO O LE INYECTO»
   PRESTA MIL, en video, 18 de agosto de 2026.

   Su RUTA #2: el cuadre decía que el cobrador tenía que entregar $794.000 y
   «Capital por ruta» decía $468.000. La diferencia, $326.000, era EXACTAMENTE
   un retiro que él había hecho esa mañana a las 07:54.

   La cuenta del día reconstruía el día hacia adelante sumando solo cobros,
   préstamos y gastos. Los retiros, las inyecciones y las correcciones se
   restaban del capital para hallar la apertura y no se volvían a poner nunca:
   se contaban una vez, en contra, y desaparecían.

   Medido en sus diez rutas: el 17 fallaban 2 y el 15 —el día de su ronda de
   retiros— fallaban LAS DIEZ.
   ══════════════════════════════════════════════════════════════════════════ */

const api = fs.readFileSync('app/api/caja/cobrador/[id]/route.js', 'utf8')

/** La cuenta, tal como la arma el API. */
function cuentaComoElApi({ apertura, cobradoEfectivo = 0, cobradoDigital = 0,
  prestadoEfectivo = 0, gastos = 0, inyecciones = 0, retiros = 0, ajustes = 0 }) {
  return cuentaDelDia({
    apertura,
    entradas: [
      { id: 'recaudoEfectivo', rotulo: 'Cobró en efectivo', monto: cobradoEfectivo },
      { id: 'recaudoDigital', rotulo: 'Cobró por transferencia', monto: cobradoDigital },
      { id: 'inyecciones', rotulo: 'Le metiste a esta ruta', monto: inyecciones },
      { id: 'correccionesMas', rotulo: 'Correcciones a favor', monto: ajustes > 0 ? ajustes : 0 },
    ],
    salidas: [
      { id: 'desembolsos', rotulo: 'Prestó en efectivo', monto: prestadoEfectivo },
      { id: 'gastos', rotulo: 'Gastó', monto: gastos },
      { id: 'retiros', rotulo: 'Le sacaste a esta ruta', monto: retiros },
      { id: 'correccionesMenos', rotulo: 'Correcciones en contra', monto: ajustes < 0 ? -ajustes : 0 },
      { id: 'aLaCuenta', rotulo: 'Entró a la cuenta de la oficina', monto: cobradoDigital },
    ],
  })
}

describe('la RUTA #2 de PRESTA MIL, con sus cifras del 17 de agosto', () => {
  /* Del libro de producción, comprobado: apertura $448.000, cobró $386.000 en
     efectivo, gastó $40.000 y él retiró $326.000 a las 07:54.
     `Ruta.saldoCapital` = $468.000. */
  const caso = { apertura: 448_000, cobradoEfectivo: 386_000, gastos: 40_000, retiros: 326_000 }

  it('«Tiene que entregar» da los $468.000 del capital, no los $794.000', () => {
    expect(cuentaComoElApi(caso).suma).toBe(468_000)
  })

  it('sin contar el retiro daba los $794.000 que él vio, y por eso no cuadraba', () => {
    /* La prueba de que el caso está bien montado: quitando el retiro sale
       EXACTAMENTE la cifra que enseñaba la pantalla. Si esto dejara de dar
       794.000, el caso ya no reproduce lo que él reportó. */
    expect(cuentaComoElApi({ ...caso, retiros: 0 }).suma).toBe(794_000)
  })

  it('y el retiro sale escrito, no solo restado', () => {
    /* «Yo no entiendo este resultado de dónde sale.» Un número que cambia
       solo, aunque cambie bien, es el mismo problema con otra cifra. */
    const linea = cuentaComoElApi(caso).lineas.find((l) => l.id === 'retiros')
    expect(linea, 'el retiro no aparece en la cuenta').toBeTruthy()
    expect(linea.monto).toBe(326_000)
    expect(linea.signo).toBe(-1)
    expect(linea.rotulo).toMatch(/sacaste/i)
  })
})

describe('la invariante: la cuenta del día ES el capital de la ruta', () => {
  /* Un día cualquiera con las seis clases de movimiento a la vez. Si la cuenta
     y el libro pueden separarse, se separan aquí. */
  const dia = {
    apertura: 1_000_000, cobradoEfectivo: 380_000, cobradoDigital: 120_000,
    prestadoEfectivo: 250_000, gastos: 35_000, inyecciones: 200_000, retiros: 460_000, ajustes: -15_000,
  }

  it('cuadra al peso con el libro', () => {
    const libro = dia.apertura + dia.cobradoEfectivo + dia.cobradoDigital
      - dia.prestadoEfectivo - dia.gastos + dia.inyecciones - dia.retiros + dia.ajustes
    /* La cuenta enseña el EFECTIVO, así que lo digital entra y vuelve a salir
       («Entró a la cuenta de la oficina»): se cancela y las dos coinciden. */
    expect(cuentaComoElApi(dia).suma).toBe(libro - dia.cobradoDigital)
    expect(libro).toBe(940_000)
  })

  it('las correcciones van del lado que les toca según su signo', () => {
    const enContra = cuentaComoElApi({ apertura: 0, ajustes: -50_000 })
    expect(enContra.suma).toBe(-50_000)
    expect(enContra.lineas.find((l) => l.id === 'correccionesMenos').signo).toBe(-1)
    const aFavor = cuentaComoElApi({ apertura: 0, ajustes: 50_000 })
    expect(aFavor.suma).toBe(50_000)
    expect(aFavor.lineas.find((l) => l.id === 'correccionesMas').signo).toBe(1)
  })

  it('un día sin retiros ni inyecciones no cambia: no salen líneas de más', () => {
    /* Es lo que hacía invisible el fallo. En dos rutas del 3 de agosto la
       cifra daba exacta y se dio por buena la fórmula entera; en cuanto el
       dueño hizo su ronda de retiros, fallaron las diez. */
    const c = cuentaComoElApi({ apertura: 500_000, cobradoEfectivo: 100_000, gastos: 10_000 })
    expect(c.suma).toBe(590_000)
    expect(c.lineas.some((l) => ['retiros', 'inyecciones'].includes(l.id))).toBe(false)
  })
})

describe('las dos cifras del API llevan la corrección', () => {
  it('«lo que queda en la ruta» suma inyecciones y resta retiros', () => {
    expect(api).toMatch(/\+ inyeccionesDia - retirosDia \+ ajustesDia/)
  })

  it('y «lo que debería tener en la mano» también, con la parte en billetes', () => {
    /* Si una contara los retiros y la otra no, la pantalla se contradiría sola
       — que es de donde salió el enredo la primera vez. */
    expect(api).toMatch(/\+ inyeccionesEfectivo - retirosEfectivo \+ ajustesEfectivo/)
  })

  it('un retiro por transferencia no baja el fajo que lleva encima', () => {
    /* Hoy no hay ni uno así en producción (los 261 con ruta son efectivo o sin
       método), pero el día que lo haya la cuenta no se puede torcer. */
    expect(api).toMatch(/const esEfectivo = \(m\) => m\.metodoPago !== 'transferencia'/)
  })
})
