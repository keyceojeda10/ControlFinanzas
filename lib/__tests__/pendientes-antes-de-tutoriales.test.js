// Lo que había que cerrar antes de montar los tutoriales
// (para-agente-cf/PENDIENTES-ANTES-DE-LOS-TUTORIALES.md, 18 oct 2026).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { filaDeCobro } from '@/lib/adaptadores/cobros'
import { adaptarRecorrido } from '@/lib/adaptadores/ruta'
import { opcionesDeMonto } from '@/lib/adaptadores/atajos-cobro'
import { nombresDeRutas } from '@/lib/adaptadores/cobradores'
import { personaOcupada, QUIETO_MS } from '@/lib/resumen-del-dia'
import { normalizarEmail, formasDelEmail, buscarUsuarioPorEmail } from '@/lib/normalizar-email'
import { interesPerdonadoPorElAbono } from '@/lib/dinero/saldo-tras-cada-pago'

const leer = (f) => readFileSync(f, 'utf8')

describe('R69 · el atrasado que paga la cuota de hoy deja la visita hecha', () => {
  it('las tres APIs cierran la visita cuando la parada ya no le pide nada hoy', () => {
    expect(leer('app/api/rutas/[id]/route.js')).toMatch(/if \(pendienteEste\) pideHoyCliente \+= faltaDeHoy\(\{ cuota, pagadoHoy: montoPagadoHoy, alDia: montoAlDiaPrestamo \}\)/)
    expect(leer('app/api/rutas/[id]/route.js')).toMatch(/cobroPendienteHoy = pideHoyCliente > 0/)
    expect(leer('app/api/cobros-hoy/route.js')).toMatch(/if \(pendienteEste\) pideHoyCliente \+= faltaDeHoy\(\{ cuota: cuotaReal, pagadoHoy: montoPagadoHoy, alDia \}\)/)
    expect(leer('app/api/cobros-hoy/route.js')).toMatch(/cobroPendienteHoy = pideHoyCliente > 0/)
    expect(leer('app/api/rutas/route.js')).toMatch(/if \(pendienteEste && faltaDeHoy\(\{\s*cuota: cuotaDelPeriodo\(prestamo\),/)
  })
  const hernan = { id: 'h', nombre: 'Hernán Zapata', cuota: 24200, pagoHoy: true, cobroPendienteHoy: false, montoParaPonerseAlDia: 24200, diasMora: 0, montoCobradoHoy: 24200 }
  it('la tarjeta dice «Cobrado» y que queda atraso, no «Debe hoy»', () => {
    const f = filaDeCobro(hernan, { pais: 'CO' })
    expect(f.cobrada).toBe(true)
    expect(f.quedaAtraso).toBe('$24.200')
    const atraso = f.cifras.find((x) => x.clave === 'atraso')
    expect(atraso).toMatchObject({ etiqueta: 'Atraso', valor: '$24.200', tono: 'contra' })
  })
  it('quien pagó menos de la cuota sigue con «Debe hoy» y «sigue pendiente»', () => {
    const f = filaDeCobro({ ...hernan, cobroPendienteHoy: true, montoCobradoHoy: 10000 }, { pais: 'CO' })
    expect(f.cobrada).toBe(false)
    expect(f.quedaAtraso).toBeNull()
    expect(f.cifras.find((x) => x.clave === 'atraso').etiqueta).toBe('Debe hoy')
  })
  it('en el recorrido, la parada hecha dice que queda atraso', () => {
    const [r] = adaptarRecorrido([{ nombre: 'Hernán', cobradoHoy: true, montoCobrado: 24200, atraso: 24200 }], (n) => `$${n}`)
    expect(r.detalle).toMatch(/queda con atraso de \$24200/)
  })
  it('con varios préstamos, «Ponerse al día» dice que es de este', () => {
    const o = opcionesDeMonto({ cuota: 7000, saldoPendiente: 200000, alDia: 29000 }, { varios: true })
    expect(o.find((x) => x.id === 'alDia').significa).toBe('pone al día este préstamo')
    expect(opcionesDeMonto({ cuota: 7000, saldoPendiente: 200000, alDia: 29000 }).find((x) => x.id === 'alDia').significa).toBe('se pone al día')
  })
  it('después de cobrar, la pantalla no lo da por hecho si el pago no cubre lo de hoy', () => {
    expect(leer('app/(dashboard)/rutas/[id]/page.jsx')).toMatch(/return \{ \.\.\.c, pagoHoy: true, montoPagadoHoy: \(Number\(c\.montoPagadoHoy\) \|\| 0\) \+ cuota, pideHoy: pide, cobroPendienteHoy: pide > 0 \}/)
    expect(leer('app/(dashboard)/cobros-hoy/page.jsx')).toMatch(/pideHoy: pide, cobroPendienteHoy: pide > 0/)
  })
})

describe('R14 · un cobrador con varias rutas', () => {
  it('se nombran todas', () => {
    expect(nombresDeRutas({ rutas: [{ nombre: 'Ruta Centro' }, { nombre: 'Zona Norte' }] })).toBe('Ruta Centro y Zona Norte')
    expect(nombresDeRutas({ rutas: [{ nombre: 'A' }, { nombre: 'B' }, { nombre: 'C' }] })).toBe('A, B y C')
    expect(nombresDeRutas({ ruta: { nombre: 'Sola' } })).toBe('Sola')
    expect(nombresDeRutas({})).toBe('')
  })
  it('la lista suma los clientes de todas, la ficha los trae todos y el reporte las nombra', () => {
    expect(leer('app/api/cobradores/route.js')).toMatch(/cantidadClientes: c\.rutas\.reduce\(\(n, r\) => n \+ \(r\.clientes\?\.length \?\? 0\), 0\)/)
    expect(leer('app/api/cobradores/[id]/route.js')).toMatch(/const clientesDeTodas = cobrador\.rutas\.flatMap/)
    expect(leer('app/api/reportes/exportar/route.js')).toMatch(/c\.rutas\.map\(\(r\) => r\.nombre\)\.join\(', '\)/)
    expect(leer('app/api/reportes/exportar/route.js')).not.toMatch(/rutas: \{ where: \{ activo: true \}, take: 1/)
  })
})

describe('R53 · «Últ. pago» en el día del país', () => {
  it('un pago de las 8 p. m. del 17 en Bogotá dice 17, no 18', () => {
    const f = filaDeCobro({ id: 'x', nombre: 'X', cuota: 1000, ultimoPagoAt: '2026-10-18T01:00:00.000Z' }, { pais: 'CO' })
    expect(f.cifras.find((x) => x.etiqueta === 'Últ. pago').valor).toBe('17 oct')
  })
  it('una fecha de calendario (05:00Z) se lee tal cual', () => {
    const f = filaDeCobro({ id: 'x', nombre: 'X', cuota: 1000, ultimoPagoAt: '2026-09-10T05:00:00.000Z' }, { pais: 'CO' })
    expect(f.cifras.find((x) => x.etiqueta === 'Últ. pago').valor).toBe('10 sept')
  })
})

describe('R54 · «Optimizar ruta» con la distancia de verdad', () => {
  it('la propuesta usa la distancia que devuelve `optimizeRoute`, no la suma de un objeto', () => {
    const p = leer('app/(dashboard)/rutas/[id]/page.jsx')
    expect(p).toMatch(/const propuesta = optimizeRoute\(conCoords\)\.distanciaDespues/)
    expect(p).not.toMatch(/totalDistance\(optimizeRoute\(/)
  })
})

describe('R57 · el «hoy» de /cobradores y de la ubicación es el del país', () => {
  it('ya no hace `setHours(0)` en la hora del servidor', () => {
    const c = leer('app/api/cobradores/route.js')
    expect(c).not.toMatch(/setHours\(0, 0, 0, 0\)/)
    expect(c).toMatch(/fechaPago: \{ gte: hoy\(session\.user\.country\), lt: manana\(session\.user\.country\) \}/)
    expect(leer('app/api/ubicacion/[id]/route.js')).toMatch(/const hoy = getLocalDayRange\(getLocalDateStr\(session\.user\.country\), session\.user\.country\)\.inicio/)
  })
})

describe('R49 y R48 · la ruta nueva va al final y la nota de «Solo lectura» se refresca', () => {
  it('al crearla, su orden es el último', () => {
    expect(leer('app/api/rutas/route.js')).toMatch(/orden: \(ultima\._max\.orden \?\? -1\) \+ 1,/)
    expect(leer('lib/importar-cartera.js')).toMatch(/orden: \(ultima\._max\.orden \?\? -1\) \+ 1/)
  })
  it('después de crear, se vuelven a pedir las rutas permitidas', () => {
    const p = leer('app/(dashboard)/rutas/page.jsx')
    expect(p).toMatch(/setRutas\(\(prev\) => \[\.\.\.prev, \{ \.\.\.data, cantidadClientes: 0, esperadoHoy: 0, recaudadoHoy: 0 \}\]\)\s*cargarPermitidas\(\)/)
    expect(p).toMatch(/onSuccess=\{\(\) => \{ fetchRutas\(\{ soft: true \}\); fetchRecomendaciones\(\); cargarPermitidas\(\) \}\}/)
  })
})

describe('R50 · el resumen del día espera a que la persona no esté haciendo nada', () => {
  const ahora = 1_000_000
  it('no sale con un campo enfocado, con una ventana abierta ni recién tocado', () => {
    expect(personaOcupada({ enfocado: { tagName: 'INPUT' }, ultimaInteraccion: 0, ahora })).toBe(true)
    expect(personaOcupada({ hayVentana: true, ultimaInteraccion: 0, ahora })).toBe(true)
    expect(personaOcupada({ ultimaInteraccion: ahora - 5000, ahora })).toBe(true)
  })
  it('sí sale cuando lleva un rato quieta', () => {
    expect(personaOcupada({ enfocado: { tagName: 'BODY' }, ultimaInteraccion: ahora - QUIETO_MS - 1, ahora })).toBe(false)
  })
})

describe('R39 · unir con una ruta que nunca tuvo capital propio', () => {
  it('la pantalla dice que la destino empieza con capital propio', () => {
    expect(leer('components/pantallas/Gestion.jsx')).toMatch(/vista\.origen\.llevabaCapital && vista\.destino\.llevabaCapital === false\s*\? \[\{ etiqueta: vista\.destino\.nombre, valor: 'empieza con capital propio', texto: true \}\]/)
  })
})

describe('C21 · el punto del correo solo se quita en Gmail', () => {
  it('Gmail sin puntos; Hotmail y los demás, como se escribió', () => {
    expect(normalizarEmail(' Carlos.Garcia@Gmail.com ')).toBe('carlosgarcia@gmail.com')
    expect(normalizarEmail('a.b@googlemail.com')).toBe('ab@googlemail.com')
    expect(normalizarEmail('andres.vargas@ejemplo.com')).toBe('andres.vargas@ejemplo.com')
    expect(normalizarEmail('Juan.Perez@hotmail.com')).toBe('juan.perez@hotmail.com')
    expect(normalizarEmail('')).toBe('')
  })
  it('para buscar, también la forma vieja (sin puntos en todos los dominios)', () => {
    expect(formasDelEmail('juan.perez@hotmail.com')).toEqual(['juan.perez@hotmail.com', 'juanperez@hotmail.com'])
    expect(formasDelEmail('juan.perez@gmail.com')).toEqual(['juanperez@gmail.com'])
    expect(formasDelEmail('')).toEqual([])
  })
  const db = (filas) => ({ user: { findUnique: async ({ where }) => filas.find((f) => f.email === where.email) ?? null } })
  it('encuentra la cuenta vieja, y prefiere la que coincide tal cual', async () => {
    expect((await buscarUsuarioPorEmail(db([{ id: 'viejo', email: 'juanperez@hotmail.com' }]), 'Juan.Perez@hotmail.com')).id).toBe('viejo')
    const dos = db([{ id: 'viejo', email: 'juanperez@hotmail.com' }, { id: 'nuevo', email: 'juan.perez@hotmail.com' }])
    expect((await buscarUsuarioPorEmail(dos, 'juan.perez@hotmail.com')).id).toBe('nuevo')
    expect((await buscarUsuarioPorEmail(dos, 'juanperez@hotmail.com')).id).toBe('viejo')
    expect(await buscarUsuarioPorEmail(dos, 'otro@hotmail.com')).toBeNull()
  })
  it('todas las entradas buscan con las dos formas; lo que se envía va al correo GUARDADO', () => {
    expect(leer('lib/auth.js')).toMatch(/user = await buscarUsuarioPorEmail\(prisma, rawInput, \{ include: INCLUDE_USUARIO_SESION \}\)/)
    expect(leer('app/api/auth/forgot-password/route.js')).toMatch(/const user = await buscarUsuarioPorEmail\(prisma, email, \{/)
    expect(leer('app/api/auth/forgot-password/route.js')).toMatch(/await enviarEmail\(\{ to: user\.email, subject, html \}\)/)
    expect(leer('app/api/auth/verificar-email/route.js')).toMatch(/const user = await buscarUsuarioPorEmail\(prisma, email\)/)
    const re = leer('app/api/auth/reenviar-verificacion/route.js')
    expect(re).toMatch(/const user = await buscarUsuarioPorEmail\(prisma, email\)/)
    expect(re).toMatch(/await enviarEmail\(\{ to: user\.email, subject, html \}\)/)
    expect(leer('app/api/auth/registro/route.js')).toMatch(/const vieja = emailComoSeGuardabaAntes\(email\)/)
    expect(leer('app/api/cobradores/route.js')).toMatch(/const existeEmail = await buscarUsuarioPorEmail\(prisma, email, \{ select: \{ id: true \} \}\)/)
    expect(leer('app/api/cobradores/[id]/route.js')).toMatch(/email: \{ in: formasDelEmail\(body\.email\) \}, id: \{ not: id \}/)
    expect(leer('app/api/admin/organizaciones/[id]/route.js')).toMatch(/const email = normalizarEmail\(body\.email\)/)
  })
})

describe('C22 · «Pagos del día» se parte con los mismos pagos que suma', () => {
  it('el desglose ya no deja fuera la liquidación ni el abono a capital', () => {
    const p = leer('app/(dashboard)/caja/page.jsx')
    expect(p).not.toMatch(/if \(!\['completo', 'parcial'\]\.includes\(p\.tipo\)\) return/)
    expect(p).toMatch(/if \(p\.tipo === 'recargo' \|\| p\.tipo === 'descuento'\) return\s*if \(p\.metodoPago === 'transferencia'\) \{/)
  })
})

describe('C23 · «Por ruta» no cuenta el préstamo migrado como prestado hoy', () => {
  it('salta los migrados, como «Lo que prestaste»', () => {
    const r = leer('app/api/caja/route.js')
    expect(r).toMatch(/const migrados = await prestamosMigrados\(prisma, prestamos\.map\(\(p\) => p\.id\)\)/)
    expect(r).toMatch(/for \(const p of prestamos\) \{\s*if \(migrados\.has\(p\.id\)\) continue/)
  })
})

describe('C24 · «Capital en las rutas» suma solo las rutas con capital propio', () => {
  it('ni el total ni el aviso de rutas en negativo cuentan la cuenta interna de las otras', () => {
    const r = leer('app/api/caja/route.js')
    expect(r).toMatch(/const conCapital = porRuta\.filter\(\(r\) => r\.capitalHabilitado\)\s*const enRutas = conCapital\.reduce/)
    expect(r).toMatch(/negativas: conCapital\.filter\(\(r\) => r\.saldoCapital < 0\)\.length,/)
  })
})

describe('C25 · cancelar deja la ventana de capital limpia', () => {
  it('«Cancelar» y el guardado pasan por la misma limpieza, monto incluido', () => {
    const t = leer('components/capital/CapitalTab.jsx')
    expect(t).toMatch(/const cerrarModal = \(\) => \{\s*setShowModal\(false\)\s*setModalMonto\(''\)\s*setModalDesc\(''\)/)
    expect(t).toMatch(/<button type="button" onClick=\{cerrarModal\}/)
    expect(t.indexOf('const cerrarModal = ')).toBeLessThan(t.indexOf('const handleSubmit = '))
  })
})

describe('P71 · la pastilla del abono dice el interés que se perdonó', () => {
  const oscar = { modoInteres: 'fijo', tasaInteres: 20, diasPlazo: 30, fechaInicio: '2026-10-10T05:00:00.000Z' }
  const abono = { tipo: 'capital', montoPagado: 100000, fechaPago: '2026-10-18T20:00:00.000Z' }
  it('lo que descontó el servidor, no monto × tasa', () => {
    expect(interesPerdonadoPorElAbono(oscar, abono)).toBe(14667)
  })
  it('con tabla, o si no es abono a capital, sin cifra', () => {
    expect(interesPerdonadoPorElAbono({ ...oscar, modoInteres: 'lineal', cuotasAmortizacion: [{ numeroPeriodo: 1 }] }, abono)).toBeNull()
    expect(interesPerdonadoPorElAbono({ ...oscar, modoInteres: 'saldo' }, abono)).toBeNull()
    expect(interesPerdonadoPorElAbono(oscar, { ...abono, tipo: 'completo' })).toBeNull()
  })
  it('la ficha ya no multiplica el monto por la tasa', () => {
    const p = leer('app/(dashboard)/prestamos/[id]/page.jsx')
    expect(p).not.toMatch(/pago\.montoPagado \* tasaInteres \/ 100/)
    expect(p).toMatch(/const perdonado = interesPerdonadoPorElAbono\(prestamo, pago, \{ offsetHoras: getUtcOffset\(country\) \}\)/)
  })
})

describe('#8 y #10 (cf-v1172) · las vías que cambian la plata de una ruta', () => {
  it('las tres vías que mueven a un cliente pasan su préstamo de bolsa', () => {
    const lote = leer('app/api/rutas/[id]/clientes/route.js')
    expect(lote).toMatch(/await pasarPrestamosDeRuta\(tx, \{\s*organizationId,\s*destino: \{ id: ruta\.id, nombre: ruta\.nombre, capitalHabilitado: !!ruta\.capitalHabilitado \},/)
    expect(lote).toMatch(/reservar: !!descontarCapitalRuta,/)
    expect(lote).toMatch(/await pasarPrestamosDeRuta\(tx, \{\s*organizationId, destino: null,/)
    expect(lote).not.toMatch(/registrarMovimientoCapital/)
    expect(leer('app/api/clientes/[id]/route.js')).toMatch(/await pasarPrestamosDeRuta\(tx, \{\s*organizationId: session\.user\.organizationId, destino: bolsaNueva,/)
  })
  it('Capital: la ruta que empieza su capital arranca en cero, y sin capital solo se le mete plata', () => {
    const c = leer('app/api/capital/route.js')
    expect(c).toMatch(/if \(!ahora\.capitalHabilitado\) await empezarCapitalPropio\(tx, \{ organizationId, ruta: ahora, usuarioId: userId \}\)/)
    expect(c.indexOf('await empezarCapitalPropio(tx')).toBeLessThan(c.indexOf('const r = await registrarMovimientoManualCapital(tx'))
    expect(c).toMatch(/if \(empiezaSuCapital && tipo !== 'inyeccion' && tipo !== 'capital_inicial'\) \{/)
    expect(leer('components/capital/CapitalTab.jsx')).toMatch(/if \(!r \|\| \(r\.capitalHabilitado && \(r\.arranqueAbsorbido \|\| 0\) > 0\)\) return null/)
  })
  it('la pantalla de la ruta solo pregunta por reservar si la ruta lleva capital', () => {
    const p = leer('app/(dashboard)/rutas/[id]/page.jsx')
    expect(p).toMatch(/if \(ruta\?\.capitalHabilitado && delNegocio\.length > 0\) \{/)
    expect(leer('app/api/clientes/route.js')).toMatch(/rutaCapitalPropio: !!c\.ruta\?\.capitalHabilitado,/)
  })
})
