import { describe, it, expect } from 'vitest'
import { PLANTILLAS } from '@/lib/whatsapp-plantillas'
import { familiasConPlantillas, plantillasDeFamilia, contextoMotor } from '@/lib/adaptadores/plantillas-wa'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// «Personalizar» estaba atado a que la plantilla tuviera secciones. Parece
// razonable —sin secciones no hay panel que enseñar— pero deja fuera al editor
// de texto, que funciona siempre. Resultado: se abría la hoja en la familia
// COBRO, que es la que más se usa, y no había forma de tocar el mensaje.
//
// No lo vio ninguna prueba porque el botón SÍ existe en el componente: lo que
// no llegaba era su manejador. Salió de mirar la captura del espejo y contar
// qué plantillas traen `getSecciones`.

const ctx = () => contextoMotor({
  cliente: { id: '1', nombre: 'ESTEFANIA SUAREZ', telefono: '3001234567' },
  prestamo: {
    id: 'p', totalAPagar: 500000, totalPagado: 100000, cuota: 20000,
    saldoPendiente: 162000, diasMora: 2, estado: 'activo',
  },
  orgNombre: 'PRESTA MIL',
})

describe('personalizar el mensaje', () => {
  it('la mitad de las plantillas no tiene secciones: es a propósito', () => {
    // Si algún día TODAS las tuvieran, este test sobra y hay que borrarlo.
    // Mientras haya alguna sin ellas, el botón no puede depender de eso.
    const sin = PLANTILLAS.filter((t) => !t.getSecciones)
    expect(sin.length, 'ya todas tienen secciones: revisa si este test sigue haciendo falta').toBeGreaterThan(0)
  })

  it('«visita», la primera de COBRO, es una de las que no tiene', () => {
    // Es la que sale al abrir la hoja desde la ruta o desde cobrar hoy: el
    // camino más transitado de la función.
    const primera = plantillasDeFamilia('cobro', ctx(), 'org')[0]
    expect(primera?.id).toBe('visita')
    expect(PLANTILLAS.find((t) => t.id === 'visita')?.getSecciones).toBeFalsy()
  })

  it('el botón no depende de las secciones', () => {
    const src = readFileSync(resolve(process.cwd(), 'components/whatsapp/HojaWhatsApp.jsx'), 'utf8')
    expect(src, '`onPersonalizar` vuelve a estar atado a `secciones`')
      .not.toMatch(/onPersonalizar=\{secciones\s*\?/)
    expect(src).toContain('onPersonalizar={() => setPersonalizando((v) => !v)}')
    // El panel SÍ debe seguir atado: sin secciones no hay nada que pintar.
    expect(src, 'el panel de secciones ya no comprueba que existan')
      .toMatch(/panelSecciones=\{secciones && personalizando/)
  })

  it('las familias que se enseñan llevan a algo', () => {
    // `familiasConPlantillas` es la que decide qué pestañas se pintan: si
    // devolviera una sin plantillas, sería una pestaña que no lleva a nada.
    const familias = familiasConPlantillas(ctx(), 'org')
    expect(familias.length, 'ninguna familia para un préstamo activo con mora').toBeGreaterThan(0)
    for (const f of familias) {
      expect(plantillasDeFamilia(f.id, ctx(), 'org').length, `la familia «${f.id}» salió vacía`).toBeGreaterThan(0)
      expect(f.etiqueta, `la familia «${f.id}» no tiene etiqueta que pintar`).toBeTruthy()
    }
  })
})

describe('al personalizar, el mensaje no se evapora', () => {
  const hoja = readFileSync(resolve(process.cwd(), 'components/whatsapp/HojaWhatsApp.jsx'), 'utf8')
  const tarjeta = readFileSync(resolve(process.cwd(), 'components/pantallas/Plantillas.jsx'), 'utf8')

  it('la hoja tiene un texto que ofrecer aunque no haya secciones', () => {
    // `textoConSecciones` es null sin `getSecciones`. Sin un tercer respaldo,
    // `textoEditable` llega nulo y no hay nada que editar.
    expect(hoja, 'falta el respaldo al texto de la plantilla')
      .toContain('textoEditado ?? textoConSecciones ?? textoDePlantilla')
    expect(hoja, '`textoDePlantilla` no está definido').toMatch(/const textoDePlantilla = useMemo/)
  })

  it('`textoDePlantilla` no se mira a sí mismo', () => {
    // Si lo sacara de `lista` —que ya lleva el texto vivo— sería un ciclo.
    const i = hoja.indexOf('const textoDePlantilla = useMemo')
    const j = hoja.indexOf('const lista = useMemo')
    expect(i, 'no encuentro `textoDePlantilla`').toBeGreaterThan(-1)
    expect(j, 'no encuentro `lista`').toBeGreaterThan(i)
    const cuerpo = hoja.slice(i, j)
    expect(cuerpo, '`textoDePlantilla` se alimenta de `lista`: es un ciclo').not.toMatch(/\blista\b/)
    expect(cuerpo).not.toMatch(/textoConSecciones|textoEditado/)
  })

  it('la burbuja solo se va si el editor ocupa su sitio', () => {
    // Escondía el mensaje con solo `personalizando`. Con el texto nulo se iba
    // la burbuja, no venía el editor, y quedaba un hueco.
    expect(tarjeta, 'la burbuja vuelve a esconderse sin comprobar que hay editor')
      .toContain('{!(personalizando && textoEditable != null) && (')
  })
})
