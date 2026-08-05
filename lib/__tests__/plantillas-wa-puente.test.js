import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  contextoMotor, plantillasDeFamilia, familiasConPlantillas, PLANTILLA_LIBRE,
} from '@/lib/adaptadores/plantillas-wa'

const alDia = () => contextoMotor({
  cliente: { nombre: 'Carlos Prueba 1', telefono: '3134973979' },
  prestamo: {
    estado: 'activo', diasMora: 0, cuotaDiaria: 366667,
    saldoPendiente: 1583334, totalAPagar: 1950001, totalPagado: 366667,
    montoPrestado: 1000000, frecuencia: 'mensual', diasPlazo: 150,
    fechaInicio: '2026-07-04T05:00:00.000Z', tasaInteres: 20,
  },
  orgNombre: 'Carlos prestamos', ocultarSaldo: false,
})

const conMora = (dias) => contextoMotor({
  cliente: { nombre: 'Ana', telefono: '3134973979' },
  prestamo: {
    estado: 'activo', diasMora: dias, cuotaDiaria: 20000,
    saldoPendiente: 400000, totalAPagar: 500000, totalPagado: 100000,
    montoPrestado: 400000, frecuencia: 'diario', diasPlazo: 30,
    fechaInicio: '2026-07-01T05:00:00.000Z', tasaInteres: 20,
  },
  orgNombre: 'Mi negocio', ocultarSaldo: false,
})

describe('el mensaje trae la información que los clientes echaban de menos', () => {
  it('el recordatorio lleva saldo, cuotas pendientes y fecha del próximo pago', () => {
    // Lo reportado: «son mensajes bastante vacíos, sin ninguna información».
    // La plantilla NUEVA decía sólo: «Hola X, hoy vence tu cuota de $366.667.
    // Puedes pagar en efectivo o por transferencia».
    const p = plantillasDeFamilia('cobro', alDia(), 'org1')
    const rec = p.find((x) => x.id === 'recordatorio')
    expect(rec, 'no está el recordatorio').toBeTruthy()
    expect(rec.texto).toContain('$1.583.334')        // el saldo
    expect(rec.texto).toContain('Cuotas pendientes')  // cuántas quedan
    expect(rec.texto).toMatch(/Próximo pago:.+\w/)    // CON fecha, no en blanco
    expect(rec.texto).toContain('Carlos prestamos')   // la firma del negocio
  })

  it('el mensaje es sustancialmente más largo que el de una línea', () => {
    // Medida burda a propósito: lo que se perdió era volumen de información.
    const rec = plantillasDeFamilia('cobro', alDia(), 'org1').find((x) => x.id === 'recordatorio')
    expect(rec.texto.length).toBeGreaterThan(200)
  })

  it('nunca deja un hueco sin llenar delante del cliente', () => {
    for (const fam of ['cobro', 'atraso', 'renovar', 'pago']) {
      for (const p of plantillasDeFamilia(fam, alDia(), 'org1')) {
        expect(p.texto, `${p.id} deja un hueco`).not.toMatch(/\{\w+\}/)
        expect(p.texto, `${p.id} sale vacío`).not.toBe('')
      }
    }
  })
})

describe('cada plantilla se ofrece solo cuando pega', () => {
  it('a un cliente AL DÍA no se le ofrece la familia de atraso', () => {
    const fams = familiasConPlantillas(alDia(), 'org1').map((f) => f.id)
    expect(fams).toContain('cobro')
    expect(fams, 'le ofrece avisos de mora a quien está al día').not.toContain('atraso')
  })

  it('a un cliente con mora leve le toca el aviso suave, no el crítico', () => {
    const p = plantillasDeFamilia('atraso', conMora(2), 'org1').map((x) => x.id)
    expect(p).toContain('mora_suave')
    expect(p).not.toContain('mora_critica')
  })

  it('con mora larga sí aparece el crítico', () => {
    const p = plantillasDeFamilia('atraso', conMora(40), 'org1').map((x) => x.id)
    expect(p).toContain('mora_critica')
    expect(p).not.toContain('mora_suave')
  })

  it('no se ofrece una familia sin ninguna plantilla', () => {
    // Una pestaña que al abrirse no enseña nada es peor que una que no está: se
    // pulsa, se ve el vacío y no se sabe si es un fallo.
    for (const f of familiasConPlantillas(conMora(10), 'org1')) {
      expect(plantillasDeFamilia(f.id, conMora(10), 'org1').length,
        `la familia ${f.id} se ofrece vacía`).toBeGreaterThan(0)
    }
  })
})

describe('el puente respeta lo que ya existía', () => {
  it('todos los ids que reparte existen en el motor', () => {
    // Un id inventado no rompe nada: la plantilla simplemente no aparece, en
    // silencio. Así se pierde una plantilla sin que nadie se entere.
    const motor = readFileSync(join(process.cwd(), 'lib', 'whatsapp-plantillas.js'), 'utf8')
    const reales = [...motor.matchAll(/^\s+id: '([a-z_]+)',/gm)].map((m) => m[1])
    // Se leen SOLO los arrays `ids:` de las familias. Coger todas las cadenas
    // del archivo pillaba también los ids de FAMILIA ('cobro', 'pago'…), que
    // no son plantillas y no tienen por qué estar en el motor.
    const puente = readFileSync(join(process.cwd(), 'lib', 'adaptadores', 'plantillas-wa.js'), 'utf8')
    const usados = [...puente.matchAll(/ids:\s*\[([^\]]*)\]/g)]
      .flatMap((m) => [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]))
    expect(usados.length, 'no encuentro ninguna familia con ids').toBeGreaterThan(8)
    for (const id of usados) {
      expect(reales, `«${id}» no existe en el motor`).toContain(id)
    }
  })

  it('reparte TODAS las plantillas del motor, sin dejarse ninguna', () => {
    // Si una se queda fuera de las cuatro familias, deja de existir para el
    // usuario aunque siga en el código. `libre` va aparte a propósito.
    const motor = readFileSync(join(process.cwd(), 'lib', 'whatsapp-plantillas.js'), 'utf8')
    const reales = [...motor.matchAll(/^\s+id: '([a-z_]+)',/gm)].map((m) => m[1])
      .filter((id) => id !== 'libre')
    const puente = readFileSync(join(process.cwd(), 'lib', 'adaptadores', 'plantillas-wa.js'), 'utf8')
    for (const id of reales) {
      expect(puente, `«${id}» se quedó fuera de las familias`).toContain(`'${id}'`)
    }
  })

  it('«mensaje libre» sigue estando', () => {
    expect(PLANTILLA_LIBRE.libre).toBe(true)
  })

  it('la hoja usa el motor, no las plantillas de una línea', () => {
    const hoja = readFileSync(join(process.cwd(), 'components', 'whatsapp', 'HojaWhatsApp.jsx'), 'utf8')
    expect(hoja).toContain('plantillasDeFamilia')
    // Las de una línea vivían en `PLANTILLAS` de `adaptadores/plantillas`.
    expect(hoja).not.toMatch(/import \{[^}]*\bPLANTILLAS\b[^}]*\} from '@\/lib\/adaptadores\/plantillas'/)
  })

  it('el modal viejo sigue existiendo como red de seguridad', () => {
    // No se borra todavia: es la referencia contra la que comparar que la hoja
    // hace TODO lo que hacia el. El dueño lo dijo — «esta bien que no lo hayas
    // eliminado porque asi me doy cuenta si el nuevo no esta correcto».
    const wrapper = readFileSync(join(process.cwd(), 'components', 'whatsapp', 'HojaWhatsApp.jsx'), 'utf8')
    expect(wrapper).toContain('ModalWhatsAppTemplates')
  })
})

describe('en PC es un modal, no una hoja en la esquina', () => {
  const hoja = readFileSync(join(process.cwd(), 'components', 'whatsapp', 'HojaWhatsApp.jsx'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

  it('se centra y tiene ancho de modal en escritorio', () => {
    const div = hoja.match(/className="relative flex[^"]*"/)
    expect(div, 'no encuentro el contenedor de la hoja').toBeTruthy()
    expect(div[0]).toContain('sm:m-auto')
    expect(div[0]).toMatch(/sm:max-w-\[\d+px\]/)
  })

  it('en móvil sigue anclada abajo y a todo el ancho', () => {
    const div = hoja.match(/className="relative flex[^"]*"/)[0]
    expect(div).toContain('mt-auto')
    expect(div).toMatch(/(^|\s)w-full/)
  })

  it('el centrado NO va en un style en línea', () => {
    // Un `margin` inline gana a la clase, así que `sm:m-auto` no haría nada y
    // se vería idéntico al fallo.
    // Se corta desde el `className` hasta el `>` de ESA etiqueta. Antes traía
    // `relative flex mt-auto` clavado y dejó de encontrarlo en cuanto se le
    // añadió `w-full` en medio: fallaba por el orden de las clases, con el div
    // correcto delante. Es la tercera prueba de esta sesión que se cae por
    // llevar dentro un valor que luego cambia.
    const i = hoja.indexOf('className="relative flex')
    expect(i, 'no encuentro el contenedor de la hoja').toBeGreaterThan(-1)
    const etiqueta = hoja.slice(i, hoja.indexOf('>', i))
    expect(etiqueta).not.toMatch(/style=\{\{/)
  })
})

/* ══ LO QUE ROMPÍ Y NO COMPROBÉ ═══════════════════════════════════════════════
   Di por bueno el TEXTO generado y no miré la PANTALLA. El dueño lo vio en dos
   minutos: pestañas sin texto, el mensaje como un ladrillo, sin «personalizar»,
   el nombre ilegible y el modal descuadrado con «mensaje libre».
   Estas pruebas atan cada uno de esos cinco. */
describe('el contrato con la hoja, campo por campo', () => {
  const hoja = readFileSync(join(process.cwd(), 'components', 'pantallas', 'Plantillas.jsx'), 'utf8')

  it('las familias traen el campo que la hoja PINTA', () => {
    // La hoja lee `f.etiqueta`; el puente mandaba `f.nombre`. Resultado: tres
    // pastillas vacías. El build no lo ve —no hay TS— y el texto generado
    // estaba bien, así que mis pruebas de contenido pasaban igual.
    expect(hoja).toContain('f.etiqueta')
    const fams = familiasConPlantillas(alDia(), 'org1')
    expect(fams.length).toBeGreaterThan(0)
    for (const f of fams) {
      expect(f.etiqueta, `la familia ${f.id} no trae etiqueta`).toBeTruthy()
    }
  })

  it('las plantillas traen el campo del resumen', () => {
    // Igual: la hoja lee `p.resumen` y el puente mandaba `p.nota`.
    expect(hoja).toContain('p.resumen')
    for (const p of plantillasDeFamilia('cobro', alDia(), 'org1')) {
      expect(p.titulo, `${p.id} sin título`).toBeTruthy()
      expect(p.resumen, `${p.id} sin resumen`).toBeTruthy()
    }
  })

  it('NINGÚN campo que la hoja lee se queda sin mandar', () => {
    // La red de verdad: se extrae del componente TODO lo que lee de una
    // plantilla y se comprueba que el puente lo produce. Así no hace falta
    // acordarse de mirar el contrato a mano — que es lo que fallé.
    const leidos = [...hoja.matchAll(/\bp\.([a-zA-Z]+)/g)].map((m) => m[1])
    const propios = new Set(['libre'])  // los que solo tiene el mensaje libre
    const una = plantillasDeFamilia('cobro', alDia(), 'org1')[0]
    for (const campo of new Set(leidos)) {
      if (propios.has(campo)) continue
      expect(una, `la hoja lee p.${campo} y el puente no lo manda`).toHaveProperty(campo)
    }
  })
})

describe('el mensaje se lee', () => {
  const hoja = readFileSync(join(process.cwd(), 'components', 'pantallas', 'Plantillas.jsx'), 'utf8')

  it('la burbuja respeta los saltos de línea', () => {
    // Las plantillas del motor estructuran con saltos: «📋 Resumen:» y debajo
    // una línea por cifra. Sin `pre-wrap` el navegador los colapsa y sale un
    // párrafo corrido ilegible. Medido en el navegador: 21 saltos.
    expect(hoja).toMatch(/whiteSpace: 'pre-wrap'/)
  })

  it('el texto de verdad TRAE saltos, o el pre-wrap no serviría de nada', () => {
    const rec = plantillasDeFamilia('cobro', alDia(), 'org1').find((x) => x.id === 'recordatorio')
    expect((rec.texto.match(/\n/g) || []).length).toBeGreaterThan(3)
  })

  it('el textarea del mensaje libre no desborda su tarjeta', () => {
    // Un `<textarea>` NO hereda el `box-sizing` del reset: con `width:100%` y
    // relleno de 13px acaba midiendo 100%+28px. Medido en el navegador: 277px
    // dentro de 287px sin el arreglo, 249px con él.
    const ta = hoja.match(/<textarea[\s\S]*?\/>/)[0]
    expect(ta).toContain("boxSizing: 'border-box'")
  })
})

describe('personalizar está a la vista', () => {
  const hoja = readFileSync(join(process.cwd(), 'components', 'pantallas', 'Plantillas.jsx'), 'utf8')

  it('las acciones van DENTRO de la tarjeta del mensaje', () => {
    // Estaban al FINAL de la lista, despues de todas las plantillas: habia que
    // bajar buscandolas. El dueño: «mucha gente no va a encontrar esa opcion».
    // Ahora viven bajo la burbuja del mensaje elegido, que es donde se mira.
    const tp = readFileSync(join(process.cwd(), 'components', 'pantallas', 'Plantillas.jsx'), 'utf8')
    const iBurbuja = tp.indexOf('Lo resaltado se llena solo')
    const iAcciones = tp.indexOf('{(onPersonalizar || onCopiar) && (')
    expect(iBurbuja).toBeGreaterThan(-1)
    expect(iAcciones, 'las acciones no estan junto a la burbuja').toBeGreaterThan(iBurbuja)
    // Y dentro del `map` de plantillas, no sueltas al final.
    const iMap = tp.indexOf('{plantillas.map((p) => {')
    const iCierre = tp.indexOf('})}', iAcciones)
    expect(iAcciones).toBeGreaterThan(iMap)
    expect(iCierre).toBeGreaterThan(iAcciones)
  })

  it('se puede COPIAR sin abrir WhatsApp', () => {
    // No todo el mundo quiere abrir WhatsApp: hay quien pega el mensaje en otro
    // chat o se lo manda a si mismo. Antes solo existia dentro del panel.
    const tp = readFileSync(join(process.cwd(), 'components', 'pantallas', 'Plantillas.jsx'), 'utf8')
    expect(tp).toMatch(/texto=\{copiado \? 'Copiado' : 'Copiar'\}/)
  })

  it('el boton viejo del final ya no esta', () => {
    // Ocupaba el ancho de la hoja al final del scroll. Se sustituyo por las dos
    // acciones pequeñas dentro de la tarjeta.
    const tp = readFileSync(join(process.cwd(), 'components', 'pantallas', 'Plantillas.jsx'), 'utf8')
    expect(tp).not.toContain('Personalizar este mensaje')
  })

  it('el panel se abre sobre la plantilla que se está mirando', () => {
    const hj = readFileSync(join(process.cwd(), 'components', 'whatsapp', 'HojaWhatsApp.jsx'), 'utf8')
    // ⚠ Aquí HABÍA una segunda comprobación —`onPersonalizar={secciones ?`—
    // que resultó estar fijando un FALLO: atar el botón a las secciones dejaba
    // sin editor a las 7 plantillas que no las tienen, entre ellas las dos de
    // COBRO. Es la quinta prueba de esta serie que se cae por llevar dentro un
    // detalle de implementación en vez de la intención. Lo que importa —que el
    // panel se dibuje sobre la plantilla viva— se comprueba abajo, y que el
    // botón salga siempre lo cubre `whatsapp-personalizar-siempre`.
    expect(hj).toMatch(/secciones && personalizando/)
    expect(hj, 'el panel ya no se ata a la plantilla que se está mirando')
      .toMatch(/idMirando/)
  })
})

describe('el nombre del cliente se lee', () => {
  const hoja = readFileSync(join(process.cwd(), 'components', 'pantallas', 'Plantillas.jsx'), 'utf8')

  it('va DENTRO de la hoja, no encima del velo', () => {
    // Estaba fuera, sobre el velo gris con desenfoque, heredando tinta oscura:
    // en la captura «Pepito · Debe $1.408.000 · 10 días de atraso» no se leía.
    // Medido en el navegador: ahora #15161A sobre #F4F4F1.
    // Ancla al título de la hoja: es el bloque que va sobre fondo claro.
    const i = hoja.indexOf('fontSize: 20, fontWeight: 600')
    expect(i, 'no encuentro el título de la hoja').toBeGreaterThan(-1)
    const cabecera = hoja.slice(i, i + 700)
    expect(cabecera).toContain('{cliente}')
    expect(cabecera).toMatch(/\{detalle \|\|/)
  })
})

/* ══ LA PERSONALIZACION, DENTRO DE LA HOJA ═══════════════════════════════════
   «Personalizar este mensaje» mandaba al modal viejo. El dueño: «esa no es la
   idea; todas esas opciones deben estar en el nuevo modal, el viejo no deberia
   existir ya». */
describe('personalizar sin salir de la hoja', () => {
  const hoja  = readFileSync(join(process.cwd(), 'components', 'whatsapp', 'HojaWhatsApp.jsx'), 'utf8')
  const tpl   = readFileSync(join(process.cwd(), 'components', 'pantallas', 'Plantillas.jsx'), 'utf8')
  const viejo = readFileSync(join(process.cwd(), 'components', 'ui', 'ModalWhatsAppTemplates.jsx'), 'utf8')

  it('el panel de secciones es UNA sola pieza compartida', () => {
    // Estaba definido dentro del modal viejo, y por eso la hoja no podia
    // ofrecerlo. Se extrajo TAL CUAL en vez de reescribirlo: rehacer lo que ya
    // existe es el error que empezo todo esto.
    expect(viejo).not.toMatch(/^function PanelSecciones\(/m)
    expect(viejo).toContain("from '@/components/whatsapp/PanelSecciones'")
    expect(hoja).toContain("from '@/components/whatsapp/PanelSecciones'")
  })

  it('la accion de personalizar NO manda al modal viejo', () => {
    const i = tpl.indexOf('onClick={onPersonalizar}')
    expect(i, 'no encuentro la accion de personalizar').toBeGreaterThan(-1)
    const bloque = tpl.slice(i - 200, i + 300)
    expect(bloque).not.toContain('onEditarPlantillas')
  })

  it('la hoja monta el panel, el texto editable y el copiar', () => {
    expect(hoja).toContain('<PanelSecciones')
    expect(tpl).toContain('panelSecciones')
    expect(tpl).toMatch(/textoEditable/)
    expect(tpl).toMatch(/onCopiar/)
  })

  it('las secciones se alternan con un MANEJADOR, no con el setter', () => {
    // `PanelSecciones` llama `onChange(clave)`. Pasarle `setSeccionesActivas`
    // guardaria la cadena donde debe haber un Set: el estado quedaria roto EN
    // SILENCIO y ninguna seccion responderia.
    expect(hoja).toContain('onChange={alternarSeccion}')
    expect(hoja).toMatch(/const alternarSeccion = \(clave\) =>/)
    expect(hoja).toMatch(/new Set\(prev\)/)
  })

  it('SE MANDA lo que se esta viendo, no el original', () => {
    // Con `actual?.texto` a secas se enviaria el mensaje completo aunque se
    // hubieran apagado secciones: la personalizacion seria decorativa.
    expect(tpl).toMatch(/texto: esLibre \? libre\.trim\(\) : \(textoEditable \?\? actual\?\.texto\)/)
  })

  it('se guarda la configuracion del dueño', () => {
    expect(hoja).toContain('guardarConfigPlantillas')
    expect(hoja).toContain('sincronizarPlantillasDesdeDB')
  })

  it('la plantilla que se mira es la que se pinta marcada', () => {
    // `elegida` arranca en null y la hoja marca la PRIMERA. Mirando solo
    // `elegida` no habia plantilla del motor y no salia el boton de
    // personalizar: la hoja enseñaba una marcada y por dentro creia que no.
    expect(hoja).toMatch(/const idMirando = useMemo/)
    expect(hoja).toMatch(/if \(elegida\) return elegida/)
  })

  it('el id NO se deriva de `lista` (seria un ciclo)', () => {
    // `lista` usa el texto vivo, que sale de estas secciones. Derivarlo de ahi
    // es «Cannot access before initialization», y el build lo cazo al
    // prerenderizar /estilo.
    const bloque = hoja.match(/const idMirando = useMemo\([\s\S]{0,320}/)[0]
    expect(bloque).not.toMatch(/\blista\b/)
  })
})

describe('la hoja no se encoge con su contenido', () => {
  const tpl = readFileSync(join(process.cwd(), 'components', 'pantallas', 'Plantillas.jsx'), 'utf8')
  const hoja = readFileSync(join(process.cwd(), 'components', 'whatsapp', 'HojaWhatsApp.jsx'), 'utf8')

  it('la raiz declara su ancho', () => {
    // Es hija de un contenedor `flex` y sin ancho su tamaño lo decidia el
    // contenido: con «mensaje libre» pasaba de 393px a 294 en movil y de 424 a
    // 293 en PC. Medido en el navegador; reportado DOS veces.
    const raiz = tpl.match(/return \([\s\S]{0,900}?<div style=\{\{[\s\S]{0,220}?\}\}>/)[0]
    expect(raiz).toMatch(/width: '100%'/)
  })

  it('el envoltorio tambien, y en movil', () => {
    // Estaba como `sm:w-full`: bien en escritorio, SIN ancho en el telefono.
    const env = hoja.match(/className="relative flex[^"]*"/)[0]
    expect(env).toMatch(/(^|\s)w-full/)
  })
})
