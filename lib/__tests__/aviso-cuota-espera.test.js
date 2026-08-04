import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// El aviso «Con esa cuota la deuda nunca baja» saltaba desde la PRIMERA tecla:
// quien va a escribir «300.000» pasa por «3», «30», «300»... y con todos ellos
// la cuota no cubre el interes. Un dueño lo grabo en video con «$ 3» en el
// campo, y a mi me hizo diagnosticar mal el caso entero.
const src = readFileSync(resolve(process.cwd(), 'app/(dashboard)/prestamos/nuevo/page.jsx'), 'utf8')

describe('el aviso de cuota insuficiente', () => {
  it('espera antes de pintarse', () => {
    expect(src).toContain('const [avisoCuotaVisible, setAvisoCuotaVisible] = useState(false)')
    expect(src, 'sin temporizador volveria a saltar en cada tecla').toMatch(/setTimeout\(\(\) => setAvisoCuotaVisible\(true\), \d{3,4}\)/)
  })

  it('se apaga en cuanto la cuota deja de ser insuficiente', () => {
    // Sin esto, el aviso se quedaria pegado despues de corregir la cifra.
    expect(src).toMatch(/if \(!cuotaInsuficiente\) \{ setAvisoCuotaVisible\(false\); return \}/)
  })

  it('limpia el temporizador al desmontar', () => {
    // Un timeout vivo que llama a setState en un componente desmontado.
    expect(src).toMatch(/return \(\) => clearTimeout\(t\)/)
  })

  it('⚠ EL BLOQUEO NO SE RETRASA: sigue leyendo la bandera cruda', () => {
    // Lo unico que espera es el rojo en pantalla. Si el boton de avanzar
    // tambien esperara, habria una ventana en la que se puede crear un
    // prestamo que no amortiza nunca.
    expect(src).toMatch(/const puedeAvanzarPaso = \(\) => \{\s*\n\s*if \(cuotaInsuficiente\) return false/)
    expect(src, 'el bloqueo NO puede depender del aviso visible')
      .not.toMatch(/if \(avisoCuotaVisible\) return false/)
  })

  it('los dos sitios que PINTAN usan la version retrasada', () => {
    // Si uno se queda con la bandera cruda, el aviso sigue saltando ahi.
    expect(src.match(/\{avisoCuotaVisible && \(/g) ?? []).toHaveLength(2)
    expect(src.match(/\{cuotaInsuficiente && \(/g) ?? []).toHaveLength(0)
  })
})
