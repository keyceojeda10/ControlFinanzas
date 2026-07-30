// lib/__tests__/tabla-cotejo.test.js — T12-01 y T12-02, contra las cifras del
// archivo de la lámina.
//
// La lámina trae los valores literales, así que esto no es «se parece»: es número
// contra número. Los datos del caso son los de T12-01 —$1.000.000, 20%, 6 meses,
// decreciente dinámico— y están también en `scripts/sembrar-demo.mjs`, que antes
// no sembraba NI UN préstamo con tabla: los 4 modos con calendario (el 6,2% de la
// cartera) no se podían ver en local, así que esta pantalla nunca se había podido
// cotejar contra nada.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { adaptarTabla, adaptarComparacion } from '@/lib/adaptadores/tabla'
import { tieneTablaAmortizacion, calcularPrestamo } from '@/lib/calculos'

const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const pantalla = leer('components/pantallas/TablaAmortizacion.jsx')

/** El préstamo tal como lo devuelve /api/prestamos/[id], con el include de
    `cuotasAmortizacion`. Las cifras son las de la lámina. */
function prestamoDeLaLamina() {
  const cuotas = []
  let saldo = 1000000
  for (let n = 1; n <= 6; n++) {
    const capital = 166667
    const interes = Math.round(saldo * 0.20)
    cuotas.push({
      numeroPeriodo: n, capital, interes, cuotaTotal: capital + interes,
      saldoRestante: Math.max(0, saldo - capital), pagado: 0, interesPagado: 0,
      fechaEsperada: `2026-0${n + 2}-21T05:00:00.000Z`.replace('-010', '-10'),
    })
    saldo -= capital
  }
  return {
    id: 'pr_lamina', modoInteres: 'lineal_dinamico', frecuencia: 'mensual',
    montoPrestado: 1000000, totalAPagar: 1699999, tasaInteres: 20, diasPlazo: 180,
    fechaInicio: '2026-07-21T05:00:00.000Z',
    cliente: { nombre: 'Carlos Prueba 1' },
    cuotasAmortizacion: cuotas,
  }
}

describe('T12-01 · la tabla en móvil', () => {
  const p = prestamoDeLaLamina()

  it('el préstamo de la lámina PASA la guardia de la ficha', () => {
    // Sin esto la tabla no se monta y no hay nada que cotejar. Lo compruebo
    // explícito porque la ficha decide con esta misma función si la enseña.
    expect(tieneTablaAmortizacion(p)).toBe(true)
  })

  it('la cabecera dice «Carlos Prueba 1 · $1.000.000 · 20% · 6 meses»', () => {
    const t = adaptarTabla(p)
    expect(t.subtitulo).toBe('Carlos Prueba 1 · $1.000.000 · 20% · 6 meses')
  })

  it('«6 meses», no «6 mess»', () => {
    // El plural era `singular + s`. Con «Mes» daba «6 mess», y salió en la captura,
    // no en una prueba. En español el plural no es añadir una letra.
    expect(adaptarTabla(p).subtitulo).not.toMatch(/mess/)
    expect(adaptarTabla({ ...p, frecuencia: 'diario' }).subtitulo).toMatch(/180 días|\d+ días/)
    // Una sola cuota va en SINGULAR.
    const uno = { ...p, cuotasAmortizacion: p.cuotasAmortizacion.slice(0, 1) }
    expect(adaptarTabla(uno).subtitulo).toMatch(/1 mes$/)
  })

  it('el modo se dice en cristiano, no con el nombre del enum', () => {
    expect(adaptarTabla(p).modo).toBe('Decreciente dinámico')
    expect(adaptarTabla({ ...p, modoInteres: 'solo_interes' }).modo).toBe('Solo interés (globo)')
  })

  it('el reparto del préstamo entero: capital $1.000.000 · ganancia $699.999', () => {
    const t = adaptarTabla(p)
    expect(t.capital).toBe('$1.000.000')
    expect(t.ganancia).toBe('$699.999')
    expect(t.total).toBe('$1.699.999')
    expect(t.totalCuotas).toBe(6)
  })

  it('la cuota 1 coincide con la lámina, cifra por cifra', () => {
    const [c1] = adaptarTabla(p).cuotas
    expect(c1.cuando).toMatch(/^Mes 1 · /)
    expect(c1.cuota).toBe('$366.667')
    expect(c1.capital).toBe('$166.667')
    expect(c1.ganancia).toBe('$200.000')
    expect(c1.siguiente).toBe(true)
  })

  it('la parte dorada SE ENCOGE mes a mes, que es todo el punto de la pantalla', () => {
    // «En decreciente dinámico la parte dorada se encoge mes a mes y eso se ve sin
    // leer un número», dice el pie. Si la ganancia no bajara, la barra partida no
    // estaría contando nada.
    const g = adaptarTabla(p).cuotas.map((c) => c.gananciaNum)
    for (let i = 1; i < g.length; i++) expect(g[i]).toBeLessThan(g[i - 1])
    // Y el capital NO se mueve: eso es lo que lo distingue de «Sobre saldo».
    const cap = new Set(adaptarTabla(p).cuotas.map((c) => c.capitalNum))
    expect(cap.size).toBe(1)
  })

  it('«siguiente» es UNA sola cuota, y es la primera sin cubrir', () => {
    const conDosPagadas = {
      ...p,
      cuotasAmortizacion: p.cuotasAmortizacion.map((c, i) =>
        i < 2 ? { ...c, pagado: c.cuotaTotal, interesPagado: c.interes } : c),
    }
    const cs = adaptarTabla(conDosPagadas).cuotas
    expect(cs.filter((c) => c.siguiente).length).toBe(1)
    expect(cs[2].siguiente).toBe(true)
    expect(cs[0].pagada).toBe(true)
    expect(cs[1].pagada).toBe(true)
  })

  it('en un globo, una cuota de solo interés cuenta como cubierta', () => {
    // En `solo_interes` un pago de tipo 'intereses' escribe `interesPagado` y deja
    // `pagado` en 0. Mirando solo `pagado`, la cuota 1 seguiría siendo «siguiente»
    // para siempre y la tabla se contradiría con el conteo de la ficha.
    const globo = {
      ...p, modoInteres: 'solo_interes',
      cuotasAmortizacion: [
        { numeroPeriodo: 1, capital: 0, interes: 100000, cuotaTotal: 100000, pagado: 0, interesPagado: 100000, fechaEsperada: '2026-08-21T05:00:00.000Z' },
        { numeroPeriodo: 2, capital: 0, interes: 100000, cuotaTotal: 100000, pagado: 0, interesPagado: 0, fechaEsperada: '2026-09-21T05:00:00.000Z' },
      ],
    }
    const cs = adaptarTabla(globo).cuotas
    expect(cs[0].siguiente).toBe(false)
    expect(cs[1].siguiente).toBe(true)
  })

  it('`faltanteNum` es lo que precarga el modal de pago', () => {
    // Sin él, tocar la fila abría el modal en cero. Va en número crudo porque quien
    // lo consume es el modal, no la pantalla.
    const medio = { ...p, cuotasAmortizacion: [{ ...p.cuotasAmortizacion[0], pagado: 100000 }] }
    expect(adaptarTabla(medio).cuotas[0].faltanteNum).toBe(266667)
  })

  it('los nombres son los que LEE el componente', () => {
    // El adaptador decía `titulo`/`monto` y el componente lee `cuando`/`cuota`: las
    // filas salían sin fecha y sin cifra. Mismo desajuste que la fila del historial.
    const [c1] = adaptarTabla(p).cuotas
    for (const campo of ['cuando', 'cuota', 'capital', 'ganancia', 'capitalNum', 'gananciaNum', 'siguiente', 'pagada', 'faltanteNum']) {
      expect(c1, `falta ${campo}`).toHaveProperty(campo)
    }
    expect(pantalla).toMatch(/\{c\.cuando\}/)
    expect(pantalla).toMatch(/\{c\.cuota\}/)
  })

  it('el texto para compartir lleva el nombre, las cuotas y el total', () => {
    const t = adaptarTabla(p)
    expect(t.textoParaCompartir).toMatch(/Carlos Prueba 1/)
    expect(t.textoParaCompartir).toMatch(/Mes 1 · .+ — \$366\.667/)
    expect(t.textoParaCompartir).toMatch(/Total: \$1\.699\.999/)
  })
})

describe('T12-01 · la forma, contra los estilos literales de la lámina', () => {
  it('cada cuota es SU PROPIA tarjeta, no una fila con filete', () => {
    // `background:#fff; border:1px; border-radius:18px; padding:15px 17px`, con
    // hueco de 10 entre tarjetas. Yo lo había hecho con filas dentro de una tarjeta
    // plana, y así la cuota que toca no se puede destacar sin romper la caja.
    expect(pantalla).toMatch(/padding: '15px 17px'/)
    expect(pantalla).toMatch(/borderRadius: 'var\(--cf-r-card\)'/)
    expect(pantalla).not.toMatch(/Tarjeta plana/)
    expect(pantalla).not.toMatch(/borderTop: '1px solid var\(--cf-hairline\)'/)
  })

  it('la cuota que viene lleva ANILLO dorado, borde 1,5px más halo de 3px', () => {
    expect(pantalla).toMatch(/1\.5px solid \$\{ORO\}/)
    expect(pantalla).toMatch(/0 0 0 3px rgba\(231,164,0,\.13\)/)
  })

  it('UN SOLO DORADO: el anillo. Ni el botón de comparar ni el de compartir', () => {
    // Regla 4 del índice. Yo tenía tres dorados y ningún anillo: «Comparar» en
    // texto dorado, el primario de la barra, y la cuota sin marcar.
    expect(pantalla).not.toMatch(/BotonPrimario/)
    // La pastilla de comparar es GRIS.
    expect(pantalla).toMatch(/background: 'var\(--cf-fill\)', border: '1px solid var\(--cf-border\)'/)
  })

  it('el encabezado del grupo va sobre el fondo, con filete que estira', () => {
    expect(pantalla).toMatch(/Las \{totalCuotas\} cuotas/)
    expect(pantalla).toMatch(/flex: 1, height: 1, background: 'var\(--cf-hairline\)'/)
  })

  it('el pie de cada cuota va a los dos extremos, sin puntos de color', () => {
    expect(pantalla).toMatch(/justifyContent: 'space-between'/)
    expect(pantalla).toMatch(/color: 'var\(--cf-gold-dark\)', flex: 'none' \}\}>\s*ganancia/)
  })

  it('NADIE pone el relleno lateral dos veces', () => {
    // El armazón ya da `--cf-pad-screen`. Ponerlo otra vez dejaba las tarjetas en
    // x40 con 310px cuando la lámina las quiere en x20 con 350. Van tres veces con
    // este fallo: el panel, cobrar hoy y esta.
    expect(pantalla).not.toMatch(/padding: '6px var\(--cf-pad-screen\)/)
    expect(pantalla).not.toMatch(/0 var\(--cf-pad-screen\) \$\{/)
  })

  it('el alto lo decide el montaje: `height:100%` SOLO con barra de acción', () => {
    // La pantalla propia es dueña del viewport y su zona de cuotas scrollea sola;
    // dentro de la ficha la tabla es un bloque de flujo y su alto lo pone su
    // contenido. Hoy los dos funcionan —medido: 649px dentro de la ficha—, pero el
    // día que ese padre reciba un alto, un `height:100%` heredado recortaría la
    // tabla sin que nada avise.
    expect(pantalla).toMatch(/const dueñaDelAlto = conBarra/)
    expect(pantalla).toMatch(/dueñaDelAlto \? \{ height: '100%' \} : \{\}/)
    expect(pantalla).toMatch(/dueñaDelAlto\s*\?\s*\{ flex: 1, minHeight: 0, overflowY: 'auto' \}/)
  })

  it('todo control va detrás de su handler', () => {
    for (const control of ['onComparar', 'onCompartir', 'onImprimir', 'onVerTodas']) {
      expect(pantalla, `${control} se dibuja siempre`).toMatch(
        new RegExp(`\\{${control} (&&|\\?)`)
      )
    }
    // Y la barra entera solo si hay algo que hacer en ella.
    expect(pantalla).toMatch(/\{conBarra && \(/)
  })

  it('la cuota es pulsable SOLO si se puede pagar', () => {
    expect(pantalla).toMatch(/const pulsable = Boolean\(onTocarCuota\) && !c\.pagada/)
  })
})

describe('T12-02 · comparar calendarios', () => {
  const p = prestamoDeLaLamina()

  it('CUOTA FIJA entra en la comparación, aunque no tenga tabla', () => {
    // El pie de la lámina lo dice sin rodeos: «la diferencia entre el modo actual y
    // cuota fija son $500.001». `fijo` es el modo por defecto y el 54,7% de la
    // cartera. Yo había puesto solo los 4 que tienen calendario, y sin el modo por
    // defecto la comparación no tiene contra qué compararse.
    const { opciones } = adaptarComparacion(p, calcularPrestamo)
    expect(opciones.map((o) => o.id)).toContain('fijo')
    expect(opciones.map((o) => o.id).sort())
      .toEqual(['fijo', 'lineal', 'lineal_dinamico', 'saldo', 'solo_interes'])
  })

  it('el actual va PRIMERO, y el resto de menos a más caro', () => {
    // Ordenado solo por precio, el dueño no sabe cuál es el suyo hasta que encuentra
    // el marcado — y el actual es el «desde dónde» de toda la comparación.
    const { opciones } = adaptarComparacion(p, calcularPrestamo)
    expect(opciones[0].id).toBe('lineal_dinamico')
    expect(opciones[0].esActual).toBe(true)
    const resto = opciones.slice(1).map((o) => o.totalNum)
    expect([...resto].sort((a, b) => a - b)).toEqual(resto)
  })

  it('cada fila dice la DIFERENCIA contra el actual, ya restada', () => {
    // «$500.001 más que ahora». Sin eso son cinco cifras que hay que restar de
    // cabeza, que es justo lo que la lámina saca a mano en su pie.
    const { opciones } = adaptarComparacion(p, calcularPrestamo)
    const fijo = opciones.find((o) => o.id === 'fijo')
    expect(fijo.explicacion).toMatch(/(más|menos) que ahora\./)
    // El actual NO se compara consigo mismo.
    expect(opciones[0].explicacion).not.toMatch(/que ahora/)
    expect(opciones[0].explicacion).toMatch(/^El que tiene este préstamo\./)
  })

  it('la frase trae LAS CIFRAS de este préstamo, no una definición', () => {
    const { opciones } = adaptarComparacion(p, calcularPrestamo)
    const din = opciones.find((o) => o.id === 'lineal_dinamico')
    // Decreciente dinámico: la cuota se mueve, así que va «de X a Y».
    expect(din.explicacion).toMatch(/La cuota va de \$[\d.]+ a \$[\d.]+\./)
    const fijo = opciones.find((o) => o.id === 'fijo')
    // Cuota fija: no se mueve, así que lo dice de la otra forma.
    expect(fijo.explicacion).toMatch(/Misma cuota siempre: \$[\d.]+\./)
    for (const o of opciones) expect(o.explicacion).toMatch(/Ganancia \$[\d.]+\./)
  })

  it('los nombres son los del paso 5, no los del enum', () => {
    const { opciones, nombreActual } = adaptarComparacion(p, calcularPrestamo)
    const por = (id) => opciones.find((o) => o.id === id).nombre
    expect(por('fijo')).toBe('Cuota fija')
    expect(por('saldo')).toBe('Sobre lo que falta')
    // Sin el paréntesis: «Solo interés (globo)» explicaba con jerga en el título
    // cuando la frase de abajo ya lo explica en cristiano.
    expect(por('solo_interes')).toBe('Solo interés')
    // El botón de abajo dice el nombre, no «el de ahora».
    expect(nombreActual).toBe('Decreciente dinámico')
  })

  it('la aritmética sale de `calcularPrestamo`, no de una fórmula copiada', () => {
    // Si se reescribiera aquí, la comparación diría un número y el cambio real
    // haría otro. Se comprueba llamando a la misma función y exigiendo el mismo
    // total, no comparando contra una constante que yo elija.
    const { opciones } = adaptarComparacion(p, calcularPrestamo)
    for (const o of opciones) {
      const propio = calcularPrestamo({
        montoPrestado: 1000000, tasaInteres: 20, diasPlazo: 180,
        fechaInicio: p.fechaInicio, frecuencia: 'mensual', modoInteres: o.id,
      })
      expect(o.totalNum).toBe(propio.totalAPagar)
    }
  })

  it('el resumen dice el plazo en PERÍODOS, no en días crudos', () => {
    // «$1.000.000 al 20% · 6 meses». Nadie piensa un préstamo mensual en 180 días.
    const c = adaptarComparacion(p, calcularPrestamo)
    expect(c.actual).toBe('lineal_dinamico')
    expect(c.resumen).toBe('$1.000.000 al 20% · 6 meses')
    // En diario sí son días, porque el período ES el día.
    const diario = adaptarComparacion({ ...p, frecuencia: 'diario', diasPlazo: 30 }, calcularPrestamo)
    expect(diario.resumen).toMatch(/30 días$/)
  })

  it('cada opción explica QUÉ LE PASA AL CLIENTE, no la fórmula', () => {
    const { opciones } = adaptarComparacion(p, calcularPrestamo)
    for (const o of opciones) {
      expect(o.explicacion, `${o.id} sin explicación`).toBeTruthy()
      expect(o.explicacion.length).toBeGreaterThan(40)
      // Ni una fórmula ni el nombre del enum en la cara del dueño.
      expect(o.explicacion).not.toMatch(/lineal|solo_interes|modoInteres/)
    }
  })

  it('un modo que revienta se cae de la lista, no tumba la hoja', () => {
    const revienta = (opciones) => {
      if (opciones.modoInteres === 'saldo') throw new Error('boom')
      return { totalAPagar: 1200000 }
    }
    const { opciones } = adaptarComparacion(p, revienta)
    expect(opciones.map((o) => o.id)).not.toContain('saldo')
    expect(opciones.length).toBe(4)
  })

  it('elegir un calendario lleva a donde se confirman los cambios de plata', () => {
    // NO a `/prestamos/[id]/editar`, que era la ruta que yo había escrito y que NO
    // EXISTE — el mismo enlace muerto de `?diasMoraMin=30`. Va por parámetro a la
    // ficha, que es donde vive el modal de editar.
    const ruta = leer('app/(dashboard)/prestamos/[id]/tabla/page.jsx')
    expect(ruta).toMatch(/\/prestamos\/\$\{id\}\?editar=\$\{o\.id\}/)
    expect(ruta).not.toMatch(/\/editar\?/)

    const ficha = leer('app/(dashboard)/prestamos/[id]/page.jsx')
    expect(ficha).toMatch(/parametros\.get\('editar'\)/)
    expect(ficha).toMatch(/modoInicial=\{modoPedido \|\| undefined\}/)
    // Y el parámetro se limpia al cerrar, o el modal se reabre al volver atrás.
    expect(ficha).toMatch(/if \(modoPedido\) router\.replace/)

    const editar = leer('components/prestamos/EditarPrestamo.jsx')
    expect(editar).toMatch(/useState\(modoInicial \|\| p\.modoInteres \|\| 'fijo'\)/)
  })
})

describe('la siembra local trae los modos con tabla', () => {
  it('sin un préstamo con calendario, esta pantalla no se puede cotejar', () => {
    // La siembra solo hacía `fijo` y `unico`. Los 4 modos con tabla —el 6,2%— no
    // existían en local, así que T12-01 nunca se había podido comparar con nada.
    const seed = leer('scripts/sembrar-demo.mjs')
    expect(seed).toMatch(/lineal_dinamico/)
    expect(seed).toMatch(/solo_interes/)
    expect(seed).toMatch(/INSERT INTO CuotaAmortizacion/)
    // Y al borrar se borran: sin esto quedan huérfanas, porque el cascade lo aplica
    // Prisma y la siembra escribe por SQL directo.
    expect(seed).toMatch(/DELETE q FROM CuotaAmortizacion q/)
  })
})
