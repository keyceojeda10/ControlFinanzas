import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { numeroCuotaDe, porcentajeDe, cuotasRestantesDe } from '@/lib/recibo-derivados'

// ── EL MISMO FALLO, DOS DÍAS SEGUIDOS, POR ARREGLAR SOLO UNA VÍA ────────────
//
// El 4 de agosto un cliente reportó que su comprobante salía con guiones. Lo
// corregí en `whatsapp-plantillas.js`… con funciones PRIVADAS de ese fichero.
//
// El 5 volvió con otra captura: «me sigue saliendo lo mismo». Era la IMAGEN del
// comprobante, que se genera en `BotonImprimirRecibo` y no podía importar
// aquellas funciones, así que seguía con `prestamo.numeroCuota ?? '-'`:
//
//     Cuota            $150.000
//     Cuota actual     -          ← debía decir «1 de 4»
//     Cuotas restantes -          ← debía decir «3»
//
// Arreglar una vía y dejar la otra es peor que no arreglar nada: el cliente
// cree que está resuelto y se lo encuentra otra vez.
//
// Datos reales de JAIME VILORIA (asford), del recibo que mandó.
const JAIME = {
  montoPrestado: 500000,
  totalAPagar: 600000,
  cuotaDiaria: 150000,
  frecuencia: 'semanal',
  diasPlazo: 28,
  modoInteres: 'fijo',
  totalPagado: 150000,
  saldoPendiente: 450000,
  estado: 'activo',
  cuotasAmortizacion: [],
}

describe('el recibo de JAIME, el de la captura', () => {
  it('dice en qué cuota va', () => {
    expect(numeroCuotaDe(JAIME)).toBe('1 de 4')
  })

  it('dice cuántas faltan', () => {
    expect(cuotasRestantesDe(JAIME)).toBe(3)
  })

  it('y el progreso real: pagó 150.000 de 600.000', () => {
    expect(porcentajeDe(JAIME)).toBe(25)
  })
})

describe('los tres viven en UN solo sitio', () => {
  const derivados = readFileSync(resolve(process.cwd(), 'lib/recibo-derivados.js'), 'utf8')
  const imagen = readFileSync(resolve(process.cwd(), 'components/ui/BotonImprimirRecibo.jsx'), 'utf8')
  const wa = readFileSync(resolve(process.cwd(), 'lib/whatsapp-plantillas.js'), 'utf8')

  it('se exportan, no son privados de un fichero', () => {
    // Ser privados es lo que hizo que el fallo volviera.
    for (const f of ['numeroCuotaDe', 'porcentajeDe', 'cuotasRestantesDe']) {
      expect(derivados, `${f} dejó de exportarse`).toMatch(new RegExp(`export function ${f}\\(`))
    }
  })

  it('la IMAGEN del comprobante los usa', () => {
    expect(imagen).toMatch(/import \{ numeroCuotaDe, porcentajeDe, cuotasRestantesDe \} from '@\/lib\/recibo-derivados'/)
    expect(imagen, 'volvió a leer el campo crudo sin derivarlo')
      .not.toMatch(/numeroCuota:\s*prestamo\.numeroCuota \?\? '-'/)
    expect(imagen).toMatch(/numeroCuota:\s*prestamo\.numeroCuota \?\? numeroCuotaDe\(prestamo\)/)
  })

  it('«Cuotas restantes» existe en la imagen, no cae al guion por defecto', () => {
    // No estaba en el mapa: cualquier campo desconocido devuelve '-'.
    expect(imagen).toMatch(/cuotasRestantes:/)
  })

  it('el progreso no se queda en 0%', () => {
    expect(imagen, 'volvió el «0%» a quien acaba de pagar')
      .not.toMatch(/progreso:\s*`\$\{prestamo\.porcentajePagado \?\? 0\}%`/)
    expect(imagen).toMatch(/progreso:\s*`\$\{porcentajeDe\(prestamo\)\}%`/)
  })

  it('y el recibo de WhatsApp los toma del mismo sitio', () => {
    expect(wa).toMatch(/from '@\/lib\/recibo-derivados'/)
  })
})

describe('el otro camino de comprobante también queda cubierto', () => {
  it('BotonCompartirRecibo reutiliza resolverCampo', () => {
    // Si algún día se copiara el mapa en vez de reusarlo, volveríamos a tener
    // dos verdades. Esta prueba lo vigila.
    const compartir = readFileSync(resolve(process.cwd(), 'components/ui/BotonCompartirRecibo.jsx'), 'utf8')
    expect(compartir).toMatch(/import \{ resolverCampo \} from '@\/components\/ui\/BotonImprimirRecibo'/)
  })
})
