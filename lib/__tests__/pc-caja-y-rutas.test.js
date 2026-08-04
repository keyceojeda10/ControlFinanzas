import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { lineasDeLaBanda } from '@/lib/dinero/conciliacion'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('la caja de ESCRITORIO tambien agrupa', () => {
  const jsx = leer('components/pantallas/CajaEscritorio.jsx')

  it('tiene los grupos «Entra» y «Sale» con subtotal', () => {
    // El movil ya estaba asi; esta es la que abre el dueño desde el computador
    // y se habia quedado con los renglones sueltos y un «+» o «−» por linea.
    expect(jsx).toMatch(/function Grupo\(/)
    expect(jsx).toMatch(/titulo="Entra"/)
    expect(jsx).toMatch(/titulo="Sale"/)
    expect(jsx).toMatch(/Total que \{titulo\.toLowerCase\(\)\}/)
  })

  it('el transferido es un RENGLON, no una nota al pie', () => {
    // Decia «de eso, por transferencia» en minusculas, como aclaracion.
    expect(jsx).toContain('De eso, por transferencia')
  })

  it('los subtotales cuadran con la suma del adaptador', () => {
    // La apertura tiene `signo: 0` y CUENTA como entrada: es plata con la que
    // se cuenta. Si se dejara fuera, «entra − sale» no daria el saldo.
    const c = { libro: { apertura: 352000, recaudo: 428000, desembolsos: 485215, gastos: 40000, inyecciones: 0, retiros: 0, ajustes: 0 } }
    const b = lineasDeLaBanda(c)
    const entra = b.lineas.filter((l) => l.signo >= 0).reduce((a, l) => a + l.monto, 0)
    const sale = b.lineas.filter((l) => l.signo < 0).reduce((a, l) => a + l.monto, 0)
    expect(entra).toBe(780000)
    expect(sale).toBe(525215)
    expect(entra - sale).toBe(b.suma)
  })

  it('el formateador viene de fuera: la pantalla no inventa formato', () => {
    // Es un componente tonto a proposito —recibe todo ya escrito— y los
    // subtotales son lo unico que calcula. Tienen que salir escritos igual.
    expect(jsx).toMatch(/formatear = \(n\) =>/)
    expect(leer('app/(dashboard)/caja/page.jsx')).toMatch(/formatear=\{\(n\) => formatMoney/)
  })
})

describe('quitar un cliente de la ruta, desde el PC', () => {
  const tabla = leer('components/pantallas/RutaEscritorio.jsx')
  const pagina = leer('app/(dashboard)/rutas/[id]/page.jsx')

  it('la tabla ofrece la accion', () => {
    // `quitarCliente` existia desde siempre pero SOLO la ofrecia el movil,
    // dentro del modo «Ordenar». Desde el computador no habia forma.
    expect(tabla).toMatch(/onQuitar,/)
    expect(tabla).toMatch(/onQuitar\(f\)/)
    expect(tabla).toContain('Quitar de la ruta')
  })

  it('la pagina la conecta con su confirmacion', () => {
    // Es destructivo: no puede ejecutarse de un clic sin preguntar.
    expect(pagina).toMatch(/onQuitar=\{\(f\) => setConfirmQuitar/)
    expect(pagina).toMatch(/onAceptar=\{\(\) => confirmQuitar && quitarCliente/)
  })

  it('sin `onQuitar` el boton no se pinta', () => {
    // La misma tabla se usa en el catalogo de estilos, sin handlers.
    expect(tabla).toMatch(/\{onQuitar && \(/)
  })
})

describe('la hoja de abono por dias conserva lo del modal viejo', () => {
  const hoja = leer('components/pantallas/AbonoPorDias.jsx')

  it('el deslizador, sus marcas y los dos bloques siguen ahi', () => {
    expect(hoja).toMatch(/min=\{1\}/)
    expect(hoja).toMatch(/max=\{30\}/)
    for (const d of [7, 15, 30]) expect(hoja).toContain(`dias: ${d}`)
    expect(hoja).toContain('Próximas cuotas pendientes')
    expect(hoja).toMatch(/atajos\.map/)
  })

  it('el titulo dice cuantos dias, en singular y plural', () => {
    expect(hoja).toMatch(/\{dias\} \{dias === 1 \? 'día' : 'días'\} de cuota/)
  })
})
