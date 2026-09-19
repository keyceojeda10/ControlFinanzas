// «Números claros, grandes, con sus sumas» (el dueño, 19 sep 2026). Las fichas
// del préstamo y del cliente, el inicio y la caja pasan al patrón de «préstamo
// entregado»: el nombre encima, la cifra grande debajo y, en un chip o en el
// pie, lo que la separa de la otra. NO cambia ninguna cuenta: aquí se ancla lo
// que, roto, volvería a confundir o a mentir con el color.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

const leer = (f) => readFileSync(path.join(process.cwd(), f), 'utf8')
const sinComentarios = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const LINEA = sinComentarios(leer('components/cf/LineaCifra.jsx'))
const FICHA = sinComentarios(leer('components/pantallas/FichaPrestamo.jsx'))
const PAGINA = sinComentarios(leer('app/(dashboard)/prestamos/[id]/page.jsx'))
// ⚠ SIN quitarle los comentarios: tiene `accept="image/*"`, que abre un
// comentario falso y se lleva media ficha. Se ancla en JSX y en expresiones.
const HERO = leer('components/clientes/ClienteHeroCard.jsx')
const PANEL = sinComentarios(leer('components/pantallas/PanelDinero.jsx'))
const CAJA = sinComentarios(leer('app/(dashboard)/caja/page.jsx'))

describe('la línea de cifra', () => {
  it('una cifra no se parte en dos renglones', () => {
    expect(LINEA).toMatch(/whiteSpace: 'nowrap',/)
  })

  it('la raya de arriba sobrevive cuando la línea es un botón', () => {
    // `border: 0` detrás del `style` se comía el `borderTop`.
    expect(LINEA).toMatch(/border: 0, padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left', \.\.\.style,/)
  })
})

describe('la ficha del préstamo', () => {
  it('«tu plata» y lo que falta para la deuda se ven sumar', () => {
    expect(FICHA).toMatch(/rotulo="De eso es tu plata"\s+cifra=\{capitalPendiente\}\s+chip=\{restoSobreCapital \? `\+\$\{restoSobreCapital\}` : null\}/)
    // La resta la hace la página, y si hay un recargo lo dice.
    expect(PAGINA).toMatch(/const resto = Math\.round\(\(saldoPendiente \|\| 0\) - prestamo\.capitalRestante\)/)
    expect(PAGINA).toMatch(/de interés\$\{conRecargo \? ' y recargos' : ''\}/)
  })

  it('⚠ lo que se le perdona NO va en verde: es plata que el dueño deja de ganar', () => {
    expect(FICHA).toMatch(/rotulo="Si lo cancela hoy"\s+cifra=\{cierreHoy\}\s+chip=\{cierrePerdona\}\s+tonoChip="neutro"/)
  })
})

describe('el perfil del cliente', () => {
  it('llama a la deuda igual que la ficha del préstamo', () => {
    expect(HERO).toMatch(/Le falta pagar\{prestamosActivos\.length > 1/)
    expect(HERO).not.toMatch(/>\s*Saldo total pendiente\s*</)
  })

  it('la tira no repite la cifra grande ni llama «cómo paga» al porcentaje pagado', () => {
    expect(HERO).not.toMatch(/rotulo: 'Le debe'/)
    expect(HERO).not.toMatch(/rotulo: 'Cómo paga'/)
    expect(HERO).toMatch(/pagó \{formatMoney\(Math\.max\(0, totalAPagar - saldoTotal\)\)\} de \{formatMoney\(totalAPagar\)\}/)
  })
})

describe('el inicio', () => {
  it('las seis cifras siguen abriendo su explicación', () => {
    // Un rediseño pierde funciones en silencio: cada fila era tocable.
    for (const id of ['puesto.ids.miPlata', 'puesto.ids.conIntereses', 'puesto.ids.porGanar', 'ganando.ids.interes', 'ganando.ids.gastos', 'ganando.ids.ganancia']) {
      expect(PANEL, id).toContain(`onTocar={abrir(${id})}`)
    }
  })

  it('el resultado dice de qué resta sale', () => {
    expect(PANEL).toMatch(/pie=\{`\$\{fmt\(puesto\.conIntereses\)\} − \$\{fmt\(puesto\.miPlata\)\}: tu ganancia cuando terminen`\}/)
  })
})

describe('la caja del cobrador', () => {
  it('«Te queda en la mano» es LA cifra de la tarjeta, como en la del administrador', () => {
    const i = CAJA.indexOf('>Te queda en la mano</span>')
    expect(i).toBeGreaterThan(0)
    const bloque = CAJA.slice(i, i + 320)
    expect(bloque).toMatch(/text-\[26px\] whitespace-nowrap/)
    expect(bloque).toMatch(/formatMoney\(enLaMano\)/)
  })
})

describe('el inicio: las dos tarjetas blancas', () => {
  const PANEL_INICIO = leer('components/pantallas/Panel.jsx')
  it('una caja en negativo no dice «para prestar ahora»', () => {
    expect(PANEL_INICIO).toMatch(/pie=\{cajaNegativa \? 'Hay más prestado que capital anotado' : 'Para prestar ahora'\}/)
    expect(leer('lib/adaptadores/panel.js')).toMatch(/cajaNegativa: f \? Number\(f\.cajaDisponible\) < 0 : false/)
  })
  it('la mora dice lo que DEBEN, no lo «expuesto»', () => {
    expect(PANEL_INICIO).toMatch(/pie=\{mora\.expuesto \? `deben \$\{mora\.expuesto\}` : null\}/)
  })
})

