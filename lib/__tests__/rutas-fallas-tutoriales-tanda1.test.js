/* Rutas, tanda 1 de lo que encontró el agente de los videos (DETALLES-RUTAS.md,
 * 17 oct 2026). Lo urgente que no cambia cómo se cuenta la plata: el cierre de
 * una ruta sin cobrador, el capital con que nace una ruta, las hojas dentro del
 * recorrido, el «Cancelar» que no cancelaba, el respaldo, «Sigue: X», el cobro
 * sin señal, los permisos y reabrir una visita de noche.
 * Ancladas en el código, no en los comentarios. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const leer = (f) => readFileSync(f, 'utf8')
const apiRuta = leer('app/api/rutas/[id]/route.js')
const ruta = leer('app/(dashboard)/rutas/[id]/page.jsx')
const capital = leer('lib/capital.js')

describe('#2 · una ruta sin cobrador no enseña el cierre de otro', () => {
  it('el cierre y la actividad se filtran por quien la cobra', () => {
    expect(apiRuta).toMatch(/const quienCobra = ruta\.cobradorId \?\? session\.user\.id/)
    expect(apiRuta).toMatch(/cobradorId: quienCobra,\n\s+fecha:\s+\{ gte: hoy\(\), lt: manana\(\) \}/)
    expect(apiRuta).toMatch(/userId: quienCobra \}/)
    expect(apiRuta).not.toMatch(/cobradorId \?\? undefined/)
  })
})

describe('#3 · el capital con que nace la ruta le ENTRA, también al recalcular', () => {
  it('el recálculo no lo voltea a egreso', () => {
    expect(capital).toMatch(/const ENTRA_A_LA_RUTA_AL_NACER = new Set\(\['inyeccion', 'capital_inicial'\]\)/)
    expect(capital).toMatch(/const ingresoRuta = mov\.ajusteArranqueRuta \? ENTRA_A_LA_RUTA_AL_NACER\.has\(mov\.tipo\) : esIngreso/)
  })
  it('«Capital por ruta» lo enseña como Agregado, no como descuento', () => {
    expect(capital).toMatch(/if \(m\.ajusteArranqueRuta && !ENTRA_A_LA_RUTA_AL_NACER\.has\(m\.tipo\)\) \{\s*if \(!puestasEnCero\.has\(m\.rutaId\)\) acc\.arranqueAbsorbido \+= v\s*continue\s*\}/)
  })
  it('y no cuenta como «préstamos ya descontados»', () => {
    expect(leer('app/api/capital/route.js')).toMatch(/ajusteArranqueRuta: true,\n[^\n]*\n\s+tipo: \{ notIn: \['inyeccion', 'capital_inicial'\] \},/)
  })
})

describe('#6 #7 · dentro del recorrido se abre lo que se toca', () => {
  it('la hoja de WhatsApp, el «Deshacer» y el cierre se montan en las tres vistas', () => {
    expect((ruta.match(/\{hojaWhatsApp\}\{avisoDeshacer\}\{ventanaCierre\}/g) || []).length).toBe(2)
    expect(ruta).toMatch(/\{hojaWhatsApp\}\n\s+\{avisoDeshacer\}\n\s+\{ventanaCierre\}/)
    expect((ruta.match(/open=\{modalCaja\}/g) || []).length).toBe(1)
  })
  it('el WhatsApp del recibo abre ENCIMA del recibo y en modo pago', () => {
    const recibo = ruta.slice(ruta.indexOf('const pantallaRecibo = reciboCobro'), ruta.indexOf('const hojaCobro = ('))
    expect(recibo).toMatch(/if \(c\) setWaDelRecibo\(true\)/)
    expect(recibo).toMatch(/<HojaWhatsApp\n\s+open=\{waDelRecibo\}/)
    expect(recibo).toMatch(/pago=\{\{ id: reciboCobro\.pagoId \?\? null, montoPagado: reciboCobro\.monto, fechaPago: reciboCobro\.fechaPago, tipo: reciboCobro\.tipo \}\}/)
    expect(ruta).toMatch(/useEffect\(\(\) => \{ if \(!reciboCobro\) setWaDelRecibo\(false\) \}, \[reciboCobro\]\)/)
  })
})

describe('#8 · «Cancelar» no agrega a nadie', () => {
  it('tres respuestas, y Cancelar sale sin llamar al servidor', () => {
    expect(ruta).not.toMatch(/descontarCapitalRuta = confirm\(/)
    expect(ruta).toMatch(/const respuesta = await preguntarReserva\(\{ cuantos: delNegocio\.length, saldoTotal, nombres \}\)\n\s+if \(respuesta === null\) return\n\s+descontarCapitalRuta = respuesta === 'reservar'/)
    expect(ruta).toMatch(/onClick=\{\(\) => responderReserva\(null\)\}>Cancelar<\/Button>/)
    expect(ruta).toMatch(/onClick=\{\(\) => responderReserva\('no'\)\}>Agregar sin reservar<\/Button>/)
    expect(ruta).toMatch(/onClick=\{\(\) => responderReserva\('reservar'\)\}>Agregar y reservar<\/Button>/)
  })
})

describe('#9 · restaurar el respaldo solo toca a los del archivo', () => {
  const backup = leer('app/api/rutas/backup/route.js')
  it('ya no saca primero a todos de todas las rutas', () => {
    expect(backup).not.toMatch(/where: \{ organizationId, estado: \{ not: 'eliminado' \} \},\n\s+data: \{ rutaId: null, ordenRuta: null \}/)
  })
  it('los que llegaron después se quedan en su ruta, al final', () => {
    expect(backup).toMatch(/const queLlegaronDespues = await tx\.cliente\.findMany\(/)
    expect(backup).toMatch(/data: \{ ordenRuta: \+\+ultimo \}/)
  })
})

describe('#18 · «Sigue: X» es el siguiente que falta por visitar', () => {
  it('salta las visitas cerradas y sigue el orden de la ruta', () => {
    expect(ruta).toMatch(/const porVisitar = \(c\) => c\.cobroPendienteHoy && !c\.visitaCerradaHoy && c\.id !== reciboCobro\.clienteId/)
    expect(ruta).toMatch(/return lista\.slice\(aqui \+ 1\)\.find\(porVisitar\) \?\? lista\.slice\(0, Math\.max\(0, aqui\)\)\.find\(porVisitar\) \?\? null/)
    expect(ruta).toMatch(/siguienteNombre=\{siguienteDelRecibo\?\.nombre \?\? null\}/)
  })
})

describe('#19 · el cobro sin señal se dice', () => {
  it('aviso y cola, como en Cobros de hoy', () => {
    const rama = ruta.slice(ruta.indexOf('const ejecutarPagoRapido = async ('), ruta.indexOf('const deshacerPago = async'))
    expect(rama).toMatch(/window\.dispatchEvent\(new Event\('paymentQueued'\)\)\n\s+try \{ sessionStorage\.setItem\('cf-toast', `Cobro de \$\{nombre\} guardado en el teléfono\. Se sube al volver la señal\.`\) \} catch \{\}/)
  })
})

describe('#20 · lo que se ofrece coincide con lo que el servidor deja', () => {
  it('sin permiso no sale «Sacar de la ruta»; ordenar sí', () => {
    expect(ruta).toMatch(/contexto=\{!puedeGestionarRutas && fila\.contexto\?\.zona === 'inactivo' \? \{ \.\.\.fila\.contexto, accion: null \} : fila\.contexto\}/)
    const ordenar = ruta.slice(ruta.indexOf("{ id: 'ruta-ordenar'"), ruta.indexOf("{ id: 'ruta-optimizar'"))
    expect(ordenar).not.toMatch(/disponible: puedeGestionarRutas/)
  })
})

describe('#26 · el atajo de ordenar dice lo que hay', () => {
  it('no hay flechas: se arrastra o se escribe el número', () => {
    expect(ruta).toMatch(/label: 'Cambiar el orden del recorrido', pista: 'Arrastrando o escribiendo el número'/)
  })
})

describe('#30 · reabrir una visita usa el día de Bogotá', () => {
  it('no la medianoche de Greenwich', () => {
    const visitas = leer('app/api/visitas/route.js')
    expect(visitas).toMatch(/const inicio = inicioDelDiaLocal\(session\.user\.country \?\? 'co'\)/)
    expect(visitas).not.toMatch(/ahora\.getUTCFullYear\(\), ahora\.getUTCMonth\(\), ahora\.getUTCDate\(\), 0, 0, 0, 0/)
  })
})
