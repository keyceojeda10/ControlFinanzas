import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Créditos pete, 18 nov 2026 (Marlon Yesica): «el señor pagó 240 de intereses y
// abonó 200 al capital». Lo registró como «Cuota» y los 200 se fueron, sin
// preguntar, a adelantar el interés del 30 nov: el capital no bajó. El dueño:
// que la hoja PREGUNTE adónde va lo que sobra del interés vencido, con capital
// marcado; y que anular un pago quite el interés que ese pago adelantó.

const hoja = readFileSync('components/prestamos/RegistrarPago.jsx', 'utf8')
const cobro = readFileSync('app/api/prestamos/[id]/pagos/route.js', 'utf8')
const anular = readFileSync('app/api/pagos/[id]/route.js', 'utf8')
const calc = readFileSync('lib/calculos.js', 'utf8')

describe('lo que sobra del interés vencido, en un abierto', () => {
  it('la regla separa lo vencido del período que corre', () => {
    expect(calc).toMatch(/return \{ tope: Math\.max\(0, Math\.round\(interesCobrableAhora\(prestamo\) \|\| 0\)\), separar: false, vencido: debido \}/)
  })
  it('la hoja pregunta, con capital marcado', () => {
    expect(hoja).toMatch(/const \[sobranteA, setSobranteA\] = useState\('capital'\)/)
    expect(hoja).toMatch(/const preguntaSobrante = manual == null && !separar && total > vencido && topeDeInteres > vencido/)
    expect(hoja).toMatch(/const interes = manual \?\? \(sobranteACapital \? Math\.min\(total, vencido\) : tope\)/)
    expect(hoja).toMatch(/aria-label="A dónde va lo que sobra"/)
  })
  it('con «A capital» se guarda en dos pagos y no se adelanta el período', () => {
    expect(hoja).toMatch(/if \(repartoAbierto\?\.aMano \|\| separarAlCorte \|\| repartoAbierto\?\.sobranteACapital\) \{/)
    expect(hoja).toMatch(/if \(tipo === 'completo' && interesManual == null && sobranteA === 'capital'\) return 0/)
  })
  it('se vuelve a «A capital» cada vez que se abre la hoja', () => {
    expect((hoja.match(/setSobranteA\('capital'\)/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('anular el pago quita el interés que adelantó', () => {
  it('el cobro anota qué período adelantó', () => {
    expect(cobro).toMatch(/else devengoAdelantado = \{ periodo: enCurso\.periodo, interes: aAsentar \}/)
    expect(cobro).toMatch(/data: \{ tablaAntes: \{ devengoAdelantado \} \}/)
  })
  it('la anulación lo quita si el período no ha cerrado y era el último pago', () => {
    expect(anular).toMatch(/if \(adelantado\.periodo > hoyBogota && otroDespues === 0\) \{/)
    expect(anular).toMatch(/totalAPagar: \{ decrement: Number\(dev\.interes\) \|\| 0 \}/)
  })
})
