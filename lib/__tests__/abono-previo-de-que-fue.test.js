// lib/__tests__/abono-previo-de-que-fue.test.js
//
// ══ «NO ESTÁ PREGUNTANDO SI ESOS ABONOS SON A INTERESES O A CAPITAL» ═══════
//
// 26 ago 2026, el dueño:
//
//   «Al momento de crear un préstamo con abonos anteriores, o sea, migrar un
//    préstamo, el sistema no está preguntando si esos abonos son a intereses,
//    si son a capital o qué tipo de abonos es… el sistema tiene que reaccionar
//    inmediatamente con que si ese préstamo se crea en mora o si se crea paz y
//    salvo, o si viene con cuotas más bajas porque el abono fue a capital.»
//
// Se guardaba SIEMPRE como 'completo'. Medido en el espejo: 1.272 préstamos,
// 64 negocios, $435.946.278 desde el 11 abr 2026, todos del mismo tipo.
//
// ⚠ Y SOLO SE PREGUNTA EN EL ABIERTO. Medido con las funciones reales, mismo
// préstamo de $1.000.000 al 20 % mensual desde el 26 de junio con $400.000:
//
//     modo      capital vivo        próximo cobro     mora
//     unico     666.667 → 600.000   25-sep → 25-OCT   0 → 0
//     saldo     950.000 → 600.000   26-ago → 26-JUL   0 → 31 d
//     ABIERTO 1.000.000 → 600.000   igual             0 → 0
//
// En `unico` marcar «capital» le REGALA UN MES; en `saldo` lo mete en 31 días
// de mora. La causa es `periodosCubiertos`, que cuenta lo pagado entre la
// cuota, y la cuota baja al bajar el capital. El abierto es el único limpio.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  esAbonoPrevio, abonoPrevioDe, sePreguntaElTipo,
  TIPOS_ABONO_PREVIO, PREFIJO_ABONO_PREVIO,
  NOTA_ABONO_PREVIO_MANUAL, NOTA_ABONO_PREVIO_MASIVA,
} from '@/lib/dinero/abono-previo'
import { devengosPendientes, calcularCapitalRestante } from '@/lib/calculos'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

describe('reconocer el abono previo', () => {
  it('lo reconoce lo escriba quien lo escriba', () => {
    // Tres vías lo crean y dos notas distintas existen en producción.
    expect(esAbonoPrevio({ nota: NOTA_ABONO_PREVIO_MANUAL })).toBe(true)
    expect(esAbonoPrevio({ nota: NOTA_ABONO_PREVIO_MASIVA })).toBe(true)
    expect(NOTA_ABONO_PREVIO_MANUAL.startsWith(PREFIJO_ABONO_PREVIO)).toBe(true)
    expect(NOTA_ABONO_PREVIO_MASIVA.startsWith(PREFIJO_ABONO_PREVIO)).toBe(true)
  })

  it('y no confunde un cobro normal con él', () => {
    expect(esAbonoPrevio({ tipo: 'completo', montoPagado: 50_000 })).toBe(false)
    expect(esAbonoPrevio({ nota: 'Pago del martes' })).toBe(false)
    expect(esAbonoPrevio(null)).toBe(false)
  })

  it('lo encuentra aunque el préstamo tenga cobros por delante', () => {
    /* Buscarlo por `tipo === 'completo'` —como hacía `aprobar`— cogía el primer
       cobro normal. Y dejaría de encontrarlo en cuanto el abono se pueda
       marcar como capital o interés, que es justo lo que se acaba de añadir. */
    const p = { pagos: [
      { id: 'a', tipo: 'completo', montoPagado: 50_000, nota: 'Pago del martes' },
      { id: 'b', tipo: 'capital', montoPagado: 400_000, nota: NOTA_ABONO_PREVIO_MANUAL },
    ] }
    expect(abonoPrevioDe(p).id).toBe('b')
  })
})

describe('dónde se pregunta y dónde no', () => {
  it('solo en el préstamo abierto', () => {
    expect(sePreguntaElTipo({ modoInteres: 'solo_interes', sinPlazo: true })).toBe(true)
    expect(sePreguntaElTipo({ modoInteres: 'solo_interes', sinPlazo: false })).toBe(false)
  })

  it('en NINGÚN otro modo, y un modo nuevo nace en el lado silencioso', () => {
    // Los siete que el API admite crear hoy. Si mañana entra uno más, esta
    // prueba no lo cubre: se cubre sola en el sentido seguro —no se pregunta—
    // y hay que venir aquí a decidirlo a propósito.
    const MODOS = ['fijo', 'unico', 'saldo', 'manual', 'lineal', 'lineal_dinamico', 'proporcional']
    for (const m of MODOS) {
      expect(sePreguntaElTipo({ modoInteres: m, sinPlazo: false })).toBe(false)
      // Ni siquiera con la bandera puesta: `sinPlazo` solo significa algo en Globo.
      expect(sePreguntaElTipo({ modoInteres: m, sinPlazo: true })).toBe(false)
    }
  })

  it('los tres tipos son los que la hoja de pago ya usa', () => {
    expect(TIPOS_ABONO_PREVIO).toEqual(['completo', 'capital', 'intereses'])
  })
})

describe('lo que cambia según la respuesta, en un abierto', () => {
  const BASE = {
    modoInteres: 'solo_interes', sinPlazo: true,
    montoPrestado: 1_000_000, tasaInteres: 20, frecuencia: 'mensual',
    fechaInicio: '2026-06-26', totalAPagar: 1_000_000, devengos: [], cuotasAmortizacion: [],
  }
  const HOY = new Date('2026-08-26T17:00:00Z').getTime()
  const conAbono = (tipo) => ({
    ...BASE, pagos: [{ tipo, montoPagado: 400_000, fechaPago: '2026-06-26' }],
  })

  it('«capital» baja el interés de TODOS los meses ya corridos', () => {
    const d = devengosPendientes(conAbono('capital'), HOY)
    expect(d).toHaveLength(2)                       // 26-jul y 26-ago
    // Sobre $600.000 vivos al 20 %, no sobre el millón prestado.
    expect(d.map((x) => x.interes)).toEqual([120_000, 120_000])
    expect(d.map((x) => x.capitalBase)).toEqual([600_000, 600_000])
  })

  it('«interés» y «cuotas» los dejan sobre el capital entero', () => {
    for (const tipo of ['intereses', 'completo']) {
      const d = devengosPendientes(conAbono(tipo), HOY)
      expect(d.map((x) => x.interes)).toEqual([200_000, 200_000])
    }
  })

  it('y el capital vivo dice lo mismo que el devengo', () => {
    // Las dos lecturas del mismo hecho no pueden discrepar: es de donde salen
    // las dos pantallas con cifras distintas.
    const conDevengos = (tipo) => ({
      ...conAbono(tipo), totalAPagar: 1_400_000,
      devengos: [
        { periodo: '2026-07-26', interes: 200_000, capitalBase: 1_000_000 },
        { periodo: '2026-08-26', interes: 200_000, capitalBase: 1_000_000 },
      ],
    })
    expect(calcularCapitalRestante(conDevengos('capital'))).toBe(600_000)
    expect(calcularCapitalRestante(conDevengos('intereses'))).toBe(1_000_000)
    expect(calcularCapitalRestante(conDevengos('completo'))).toBe(1_000_000)
  })
})

describe('las guardas del servidor', () => {
  const api = leer('app/api/prestamos/route.js')

  it('rechaza el tipo fuera del abierto en vez de degradarlo callado', () => {
    expect(api).toContain("if (tipoAbono !== 'completo' && !sePreguntaElTipo(")
    expect(api).toContain('Tipo de abono previo no válido')
  })

  it('no se puede abonar más capital del que se prestó', () => {
    expect(api).toContain("if (tipoAbono === 'capital' && abono > capital)")
  })

  it('ni más interés del que ha corrido, medido con la misma función que devenga', () => {
    expect(api).toContain('const corridos = devengosPendientes({')
    expect(api).toContain('if (abono > techo)')
  })

  it('un cobrador sin permiso no puede subir la deuda por esta puerta', () => {
    expect(api).toContain("tipoAbono === 'intereses' && rol === 'cobrador'")
    expect(api).toContain('puedeGestionarPrestamos: true')
  })

  it('el pago se guarda con el tipo elegido, en las dos ramas de creación', () => {
    expect(api.split('tipo:           tipoAbono,').length - 1).toBe(2)
  })
})

describe('la plata del abono previo cae en su cuenta', () => {
  it('la creación le pasa la misma cuenta que al desembolso', () => {
    /* Sin `metodoPago` el movimiento va al cubo «Sin registrar»: medido en el
       espejo, 1.269 movimientos y $450.724.723, todos con la cuenta en NULL,
       mientras el desembolso de esa misma creación sí llevaba la suya. */
    const api = leer('app/api/prestamos/route.js')
    expect(api.split('metodoPago: cuentaDesembolso,').length - 1).toBe(2)
  })

  it('la carga masiva también, en sus dos movimientos', () => {
    const masiva = leer('app/api/carga-masiva/importar/route.js')
    expect(masiva.split('metodoPago: CUENTA_CARGA_MASIVA,').length - 1).toBe(2)
  })

  it('y al aprobar, donde no llevaba ninguno de los dos', () => {
    const aprobar = leer('app/api/prestamos/[id]/aprobar/route.js')
    expect(aprobar.split('metodoPago: CUENTA_AL_APROBAR,').length - 1).toBe(2)
    // Y busca el abono por la nota, no por el tipo.
    expect(aprobar).toContain('abonoPrevioDe(prestamo)')
  })
})

describe('la pantalla', () => {
  const jsx = leer('app/(dashboard)/prestamos/nuevo/page.jsx')

  it('solo enseña la pregunta en un abierto y con un abono puesto', () => {
    expect(jsx).toContain('{esAbierto && Number(yaAbonado) > 0 && (() => {')
    expect(jsx).toContain('>¿A qué se abonó?</label>')
  })

  it('manda la respuesta solo cuando el servidor la admite', () => {
    // Mandarla siempre daría un 400 en los otros siete modos.
    expect(jsx.split('esAbierto && { tipoAbonoPrevio }').length - 1).toBe(2)
  })

  it('la olvida si el préstamo deja de ser abierto', () => {
    expect(jsx).toContain("if (!esAbierto) setTipoAbonoPrevio('completo')")
  })

  it('cada opción dice su consecuencia con cifras, no con teoría', () => {
    expect(jsx).toContain('Bajó lo que te debe a ${formatMoney(cap - ab)}')
    expect(jsx).toContain('El mes pasa de ${formatMoney(mes)} a ${formatMoney(mesNuevo)}')
  })
})
