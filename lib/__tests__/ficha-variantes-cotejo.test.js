// lib/__tests__/ficha-variantes-cotejo.test.js
//
// Las TRES variantes sin tabla de amortizacion, cada una con su lamina:
//
//   T41-02 `unico`         18,6%   no tiene cuotas: se paga al final
//   T42-01 `manual`        10,6%   la cuota la puso el dueño a mano
//   T42-02 `proporcional`   9,8%   el unico donde el % si se muestra
//
// Con `fijo` (54,7%) son el 93,7% de la cartera. La ficha CON tabla cubre el
// 6,2% y es la variante, no la norma.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { diasParaMoraGrave, moraEsGrave } from '@/lib/adaptadores/prestamos'

const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const ficha = leer('components/pantallas/FichaPrestamo.jsx')
const pagina = leer('app/(dashboard)/prestamos/[id]/page.jsx')

describe('T41-02 · `unico` (18,6%)', () => {
  it('NO lleva barra de progreso: la reemplaza una fecha', () => {
    // Una barra al 0% durante 29 dias no informa, alarma. El bloque oscuro deja
    // de contar plata pagada y cuenta DIAS que faltan.
    const unico = ficha.slice(ficha.indexOf('{esUnico ? ('), ficha.indexOf('        ) : ('))
    expect(unico).not.toMatch(/BarraProgreso/)
    expect(unico).toMatch(/fechaVencimiento/)
  })

  it('el heroe dice «Te va a pagar», en FUTURO', () => {
    // No «le falta pagar»: aca no hay nada atrasado, hay algo que va a llegar.
    expect(ficha).toMatch(/etiqueta="Te va a pagar"/)
  })

  it('el boton dice «Registrar abono», no «Registrar pago»', () => {
    // Un pago parcial aca es VOLUNTARIO, no una cuota.
    expect(ficha).toMatch(/esUnico \? 'Registrar abono' : 'Registrar pago'/)
  })

  it('dice que NO TIENE CUOTAS, con todas las letras', () => {
    expect(ficha).toMatch(/no tiene cuotas<\/strong>: se paga/)
  })

  it('el historial vacio TRANQUILIZA en vez de alarmar', () => {
    // Sin esta frase, un dueño con 882 prestamos asi ve 882 fichas que parecen
    // impagas. Y son ABONOS, no pagos: no hay cuotas que pagar.
    expect(ficha).toMatch(/Es normal: en este tipo de préstamo se paga al final/)
    expect(ficha).toMatch(/esUnico \? 'Abonos que ha hecho' : 'Cada pago que ha hecho'/)
  })

  it('la cabecera dice «un solo pago · faltan N dias»', () => {
    // Sin cuota ni frecuencia que contar, el subtitulo se quedaba VACIO: la
    // cabecera solo decia el nombre.
    expect(pagina).toMatch(/'un solo pago'/)
    expect(pagina).toMatch(/faltan \$\{d\} día/)
  })

  it('«Empezo el» esta, porque nada mas cuenta el tiempo', () => {
    // Sin cuotas que marquen el paso de los dias, no hay forma de saber si el
    // trato es de la semana pasada o de hace tres meses — y eso cambia cuanto se
    // puede insistir.
    expect(ficha).toMatch(/\{empezoEl && \(/)
    expect(pagina).toMatch(/empezoEl=\{empezoElTexto\}/)
  })
})

describe('T42-01 · `manual` (10,6%)', () => {
  it('la pastilla ambar dice LA CIFRA que puso el dueño', () => {
    // El verbo reconoce que esa cifra la eligio el, no el sistema; y con el
    // numero se lee sin tener que subir a la tira.
    expect(ficha).toMatch(/Cuota que le pusiste: \{cuotaQuePusiste\}/)
    expect(pagina).toMatch(/modoInteres === 'manual' && cuotaDiaria > 0/)
  })

  it('«le faltan N cuotas» sale de DIVIDIR, no de una tabla', () => {
    // «Sale de dividir $585.000 entre $25.000, no de una tabla», dice el pie.
    expect(pagina).toMatch(/Math\.ceil\(saldoPendiente \/ cuotaDiaria\)/)
  })
})

describe('T42-02 · `proporcional` (9,8%)', () => {
  it('es el UNICO modo sin tabla donde se muestra el porcentaje', () => {
    // En `fijo` y `unico` el dueño pacto un total redondo, y traducirlo a tasa le
    // diria algo que nunca penso. Aca el total NO es redondo —salio de una regla
    // de tres— y sin ver el % sobre los dias esa cifra parece arbitraria.
    expect(pagina).toMatch(/modoInteres === 'proporcional' && tasaInteres > 0/)
    expect(pagina).toMatch(/al mes, repartido sobre/)
    expect(ficha).toMatch(/\{tasaTexto && \(/)
  })

  it('el atraso CORTO es ambar, no rojo: depende de la frecuencia', () => {
    // Tres dias de atraso en un prestamo DIARIO son tres cuotas perdidas; en uno
    // QUINCENAL son la quinta parte de una. El umbral plano de 7 dias trataba los
    // dos igual, asi que pintaba de rojo a un cliente quincenal que va con un dia
    // de retraso sobre su propio ciclo.
    expect(diasParaMoraGrave('diario')).toBe(7)
    expect(diasParaMoraGrave('semanal')).toBe(7)
    expect(diasParaMoraGrave('quincenal')).toBe(15)
    expect(diasParaMoraGrave('mensual')).toBe(30)

    expect(moraEsGrave({ diasMora: 3, frecuencia: 'quincenal' })).toBe(false)
    expect(moraEsGrave({ diasMora: 10, frecuencia: 'quincenal' })).toBe(false)
    expect(moraEsGrave({ diasMora: 16, frecuencia: 'quincenal' })).toBe(true)
    // En diario NO cambia nada: sigue siendo 7, como el resto del sistema.
    expect(moraEsGrave({ diasMora: 7, frecuencia: 'diario' })).toBe(false)
    expect(moraEsGrave({ diasMora: 8, frecuencia: 'diario' })).toBe(true)
  })

  it('el pie del historial dice el atraso EN PALABRAS', () => {
    // «Le vence una cuota hace 3 dias» en vez de dejar el numero solo. Y SOLO
    // cuando el atraso es corto: si ya es mora grave, el rojo de arriba lo dice
    // de sobra y esta frase lo suavizaria.
    expect(pagina).toMatch(/Le vence una cuota hace \$\{diasMora\} día/)
    expect(pagina).toMatch(/!moraEsGrave\(\{ diasMora, frecuencia \}\)/)
  })
})

describe('la fila del historial lee `detalle`', () => {
  it('una sola cadena ya compuesta, no dos campos sueltos', () => {
    // Leia `p.medio` y `p.saldo` por separado y quien la monta pasa `detalle`:
    // la segunda linea salia VACIA. Lo cazo el cotejo de cierre, no una prueba.
    expect(ficha).toMatch(/\{p\.detalle \?\?/)
    expect(pagina).toMatch(/quedó en \$\{formatMoney\(saldo\)\}/)
  })
})
