// lib/__tests__/historial-palabras-dias-gastos.test.js
//
// Los tres fallos del Historial (`/actividad`) que reportó QA el 19 oct 2026 con
// el dueño mirando el negocio de demostración:
//
//   5. textos del sistema («inyeccion entrada $500.000 - …», «0 cliente(s)…»)
//   6. lo de anoche después de las 7 salía bajo «HOY» (días en UTC)
//   7. un gasto rechazado seguía saliendo «−$25.000»
//
// Los textos de entrada son los que hay de verdad en el espejo para el negocio de
// demostración (`zzvideodemo000000000000org`), copiados de la base.

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import {
  leerSuceso, agruparRepetidos, textoDeFila, resumenDelDia,
  diaDelNegocio, etiquetaDelDia, agruparPorDia,
} from '@/lib/adaptadores/actividad'
import { ACCIONES } from '@/lib/activity-log-types'

const leer = (p) => fs.readFileSync(p, 'utf8')
const BOGOTA = -5

const suceso = (accion, detalle, createdAt = '2026-10-19T15:00:00.000Z', extra = {}) => ({
  id: `${accion}-${createdAt}`, accion, detalle, createdAt,
  user: { nombre: 'Sofía Restrepo', rol: 'owner' }, ...extra,
})

// Lo que se lee en la fila: nombre + frase, y el renglón de abajo.
const fila = (it) => {
  const [f] = agruparRepetidos([it], undefined, { offsetHoras: BOGOTA })
  return { ...f, linea: `${f.usuario} ${textoDeFila(f, ACCIONES[f.accion]?.label)}` }
}

describe('#5 · el Historial habla como el dueño, no como la base', () => {
  it('«movimiento de capital · inyeccion entrada» → «metió plata al capital»', () => {
    const f = fila(suceso('movimiento_capital', 'inyeccion entrada $500.000 - Plata para prestar esta semana'))
    expect(f.linea).toBe('Sofía Restrepo metió plata al capital')
    expect(f.detalleTexto).toBe('$500.000 · Plata para prestar esta semana')
    // La cifra de la columna no se mueve: sale del texto original.
    expect(f).toMatchObject({ monto: 500000, sentido: 'entra' })
  })

  it('cada tipo de movimiento de capital tiene su frase', () => {
    expect(leerSuceso(suceso('movimiento_capital', 'retiro salida $200.000 - Para el arriendo')))
      .toMatchObject({ frase: 'sacó plata del capital', detalle: '$200.000 · Para el arriendo' })
    expect(leerSuceso(suceso('movimiento_capital', 'capital_inicial entrada $2.000.000')))
      .toMatchObject({ frase: 'puso el capital inicial', detalle: '$2.000.000' })
    // En un ajuste el tipo no dice la dirección: la dice la cifra.
    expect(leerSuceso(suceso('movimiento_capital', 'ajuste salida $30.000 - Se contó mal')))
      .toMatchObject({ frase: 'ajustó el capital', detalle: 'Restó $30.000 · Se contó mal' })
    expect(leerSuceso(suceso('movimiento_capital', 'ajuste entrada $30.000')).detalle).toBe('Sumó $30.000')
  })

  it('las filas viejas sin dirección también se leen, y con su signo', () => {
    const f = fila(suceso('movimiento_capital', 'capital_inicial $1.000.000'))
    expect(f.linea).toBe('Sofía Restrepo puso el capital inicial')
    expect(f.sentido).toBe('entra')
  })

  it('el movimiento hecho desde la caja dice de qué día era la caja', () => {
    expect(leerSuceso(suceso('movimiento_caja_manual', 'ajuste entrada $282.000 (2026-10-18) - Se contó mal')))
      .toMatchObject({ frase: 'corrigió la caja', detalle: 'Sumó $282.000 · caja del 18 de oct · Se contó mal' })
    expect(leerSuceso(suceso('movimiento_caja_manual', 'inyeccion entrada $50.000 (2026-10-18)')))
      .toMatchObject({ frase: 'metió plata al capital desde la caja', detalle: '$50.000 · caja del 18 de oct' })
    // La del mismo día de la fila no se repite: la fila ya está debajo de su día.
    expect(leerSuceso(suceso('movimiento_caja_manual', 'inyeccion entrada $50.000 (2026-10-19)'), { offsetHoras: BOGOTA }).detalle)
      .toBe('$50.000')
  })

  it('«Plata para prestar hoy» dice las dos cifras', () => {
    expect(leerSuceso(suceso('movimiento_capital', 'Plata para prestar hoy: $300.000 (la caja estaba en $250.000)')))
      .toMatchObject({ frase: 'anotó la plata que tiene hoy para prestar', detalle: '$300.000 · la caja estaba en $250.000' })
  })

  it('«Pago abono capital $100.000» → «Abono a capital de $100.000»', () => {
    const f = fila(suceso('registrar_pago', 'Pago abono capital $100.000'))
    expect(f.linea).toBe('Sofía Restrepo registró pago')
    expect(f.detalleTexto).toBe('Abono a capital de $100.000')
    expect(leerSuceso(suceso('registrar_pago', 'Pago completo $14.500')).detalle).toBe('Pago completo de $14.500')
    expect(leerSuceso(suceso('registrar_pago', 'Pago liquidacion $222.667')).detalle).toBe('Liquidación del préstamo por $222.667')
  })

  it('la ruta eliminada: sin comillas ni «cliente(s)»', () => {
    const r = (n, nombre = 'Ruta Sur') => leerSuceso(suceso('eliminar_ruta', `Ruta "${nombre}" eliminada; ${n} cliente(s) quedaron sin ruta`)).detalle
    expect(r(0)).toBe('Ruta Sur eliminada. Ningún cliente quedó sin ruta')
    expect(r(1)).toBe('Ruta Sur eliminada. 1 cliente quedó sin ruta')
    expect(r(7)).toBe('Ruta Sur eliminada. 7 clientes quedaron sin ruta')
    // «Floresta» no dice que es una ruta: se le pone.
    expect(r(2, 'Floresta')).toBe('Ruta Floresta eliminada. 2 clientes quedaron sin ruta')
  })

  it('«creó cobrador · Cobrador X creado» → «creó el cobrador X», sin renglón repetido', () => {
    const f = fila(suceso('crear_cobrador', 'Cobrador Jhon Jairo Pérez creado'))
    // Con sus mayúsculas: la frase lleva un nombre y no se pasa a minúsculas.
    expect(f.linea).toBe('Sofía Restrepo creó el cobrador Jhon Jairo Pérez')
    expect(f.detalleTexto).toBe(null)
  })

  it('las otras rutas y el «ver como» tampoco repiten ni llevan comillas', () => {
    expect(fila(suceso('crear_ruta', 'Ruta "Ruta Sur" creada')).linea).toBe('Sofía Restrepo creó la Ruta Sur')
    expect(leerSuceso(suceso('crear_ruta', 'Ruta "Floresta" creada con capital $500.000')))
      .toMatchObject({ frase: 'creó la Ruta Floresta', detalle: 'Con capital de $500.000' })
    expect(leerSuceso(suceso('asignar_cobrador_ruta', 'Ruta "Zona Norte": ahora la cobra Camilo Ortiz')).detalle)
      .toBe('Ruta Zona Norte: ahora la cobra Camilo Ortiz')
    const f = fila(suceso('ver_como_cobrador', 'Vio la app como Andrés Vargas'))
    expect(f.linea).toBe('Sofía Restrepo vio la app como Andrés Vargas')
    expect(f.detalleTexto).toBe(null)
  })

  it('la anulación: el importe con formato y sin el id del préstamo', () => {
    const d = leerSuceso(suceso('anular_pago', 'Anuló pago de 87000 (parcial) del préstamo cmve1etw500126oe2v96gyp1w')).detalle
    expect(d).toBe('Pago parcial de $87.000')
    expect(leerSuceso(suceso('anular_pago', 'Anuló pago de 100000 (capital) del préstamo cmvc3uq6x005z94e2b9ortgjf')).detalle)
      .toBe('Abono a capital de $100.000')
  })

  it('editar y borrar un movimiento de capital nombran el tipo en palabras', () => {
    expect(leerSuceso(suceso('editar_movimiento_capital', 'Movimiento capital_inicial corregido: $1.000.000 -> $1.200.000')).detalle)
      .toBe('Capital inicial: de $1.000.000 a $1.200.000')
    expect(leerSuceso(suceso('eliminar_movimiento_capital', 'Movimiento inyeccion $500.000 eliminado (Aporte de socio)')).detalle)
      .toBe('Plata metida: $500.000 · Aporte de socio')
  })

  it('un formato que nadie enseñó a leer sale como siempre, nunca vacío', () => {
    expect(leerSuceso(suceso('movimiento_capital', 'algo nuevo $5.000'))).toMatchObject({ frase: null, detalle: 'algo nuevo $5.000' })
    expect(leerSuceso(suceso('crear_cliente', 'Cliente Marleny Ríos (1000000025)'))).toMatchObject({ frase: null, detalle: 'Cliente Marleny Ríos (1000000025)' })
  })

  it('la tanda de movimientos de capital se lee en plural de verdad', () => {
    const filas = agruparRepetidos([
      suceso('movimiento_capital', 'inyeccion entrada $100.000', '2026-10-19T15:01:00.000Z'),
      suceso('movimiento_capital', 'inyeccion entrada $200.000', '2026-10-19T15:00:00.000Z'),
    ], undefined, { offsetHoras: BOGOTA })
    expect(filas).toHaveLength(1)
    expect(textoDeFila(filas[0], ACCIONES.movimiento_capital.label)).toBe('hizo 2 movimientos de capital en un minuto')
    expect(filas[0]).toMatchObject({ monto: 300000, sentido: 'entra' })
  })

  it('el recargo y el descuento no son plata cobrada: sin signo y fuera de «Suman»', () => {
    const recargo = suceso('registrar_pago', 'Pago recargo $5.000', '2026-10-19T15:01:00.000Z')
    const cobro = suceso('registrar_pago', 'Pago completo $20.000', '2026-10-19T15:00:00.000Z')
    expect(leerSuceso(recargo)).toMatchObject({ frase: 'le puso un recargo a un préstamo', noEsPlata: true })
    const filas = agruparRepetidos([recargo, cobro], undefined, { offsetHoras: BOGOTA })
    expect(filas).toHaveLength(2)
    expect(filas[0]).toMatchObject({ monto: 5000, sentido: 'neutro' })
    expect(filas[1]).toMatchObject({ monto: 20000, sentido: 'entra' })
    expect(resumenDelDia([recargo, cobro, suceso('registrar_pago', 'Pago descuento $9.000')]).entro).toBe(20000)
  })
})

describe('#5 · los lectores siguen el formato que escribe cada endpoint', () => {
  // Si alguien cambia el texto que se anota, esto se pone rojo en vez de dejar
  // la fila cayendo al texto crudo sin que nadie se entere.
  it('capital, caja, pagos, rutas, cobradores y gastos escriben lo que se lee', () => {
    expect(leer('app/api/capital/route.js')).toContain("detalle: `${tipo} ${resultado.direccion === 'ingreso' ? 'entrada' : 'salida'} $${montoNum.toLocaleString('es-CO')}${descripcion ? ` - ${descripcion}` : ''}`")
    expect(leer('app/api/caja/ajustes/route.js')).toContain("detalle: `${tipoMovimiento} ${resultado.direccion === 'ingreso' ? 'entrada' : 'salida'} $${Math.round(monto).toLocaleString('es-CO')} (${fechaSolicitada})${descripcion ? ` - ${descripcion}` : ''}`")
    expect(leer('app/api/prestamos/[id]/pagos/route.js')).toContain("detalle: `Pago ${tipoLabel[tipo] || tipo} $${montoFinal.toLocaleString('es-CO')}`")
    expect(leer('app/api/rutas/[id]/route.js')).toContain('detalle: `Ruta "${ruta.nombre}" eliminada; ${ruta._count.clientes} cliente(s) quedaron sin ruta`')
    expect(leer('app/api/cobradores/route.js')).toContain('detalle: `Cobrador ${cobrador.nombre} creado`')
    expect(leer('app/api/pagos/[id]/route.js')).toContain('detalle: `Anuló pago de ${pago.montoPagado} (${pago.tipo}) del préstamo ${pago.prestamoId}`')
    expect(leer('app/api/gastos/route.js')).toContain("detalle: `Gasto $${gasto.monto.toLocaleString('es-CO')} - ${gasto.description}`")
    expect(leer('app/api/rutas/route.js')).toContain('detalle: `Ruta "${ruta.nombre}" creada${capitalInicialNum > 0 ?')
    expect(leer('app/api/ver-como/route.js')).toContain('detalle: `Vio la app como ${cobrador.nombre}`')
  })

  it('la caja escribe lo que se lee (cierre, ajuste, deshacer, cuadre, reabrir, aviso)', () => {
    const caja = leer('app/api/caja/route.js')
    expect(caja).toContain("detalle: `Cierre de caja ${cobrador.nombre} - recogido $${Math.round(totalRecogido).toLocaleString('es-CO')}`")
    expect(caja).toContain("detalle: `Ajuste cierre ${cobrador.nombre} (${fmtFechaLocal(fechaColombia)})${quienEdita} - recogido $${recogidoAntes.toLocaleString('es-CO')} -> $${Math.round(totalRecogido).toLocaleString('es-CO')}`")
    expect(caja).toContain("const quienEdita = rol === 'owner' && cobradorId !== userId ? ' (editado por admin)' : ''")
    expect(caja).toContain("detalle: `Deshizo el cierre de caja de ${cierre.cobrador?.nombre ?? 'hoy'} - tenía recogido $${Math.round(cierre.totalRecogido || 0).toLocaleString('es-CO')}`")
    // El `entidadId` de la fila del cierre es el id del cierre: por ahí lo busca la API.
    expect(caja).toMatch(/accion: 'cierre_caja', entidadTipo: 'caja', entidadId: cierre\.id,/)
    expect(caja).toMatch(/accion: 'ajuste_cierre_caja',\s*entidadTipo: 'caja',\s*entidadId: cierreActualizado\.id,/)
    expect(leer('app/api/caja/cuadre/route.js')).toContain("detalle: `${cierreExistente ? 'Cuadre' : 'Cerró la caja y cuadró a'} ${cobrador.nombre} (${fecha}): recibido $${efectivoRecibido.toLocaleString('es-CO')} vs sistema $${recaudadoSistema.toLocaleString('es-CO')} = ${diferenciaRecibido >= 0 ? '+' : ''}$${diferenciaRecibido.toLocaleString('es-CO')}`")
    expect(leer('app/api/caja/reabrir/route.js')).toContain("detalle: `Solicitud de reapertura de caja ${cobrador?.nombre ?? ''} (${fechaLocal})`")
    expect(leer('app/api/caja/reabrir/route.js')).toContain("detalle: `Reapertura de caja ${cobrador?.nombre ?? ''} (${fechaLocal})`")
    expect(leer('app/api/caja/reabrir/aprobar/route.js')).toContain("detalle: `Reapertura de caja aprobada para ${cierre.cobrador?.nombre ?? ''}`")
    expect(leer('app/api/caja/reabrir/rechazar/route.js')).toContain("detalle: `Reapertura de caja rechazada para ${cierre.cobrador?.nombre ?? ''}`")
    expect(leer('app/api/caja/ajustes/route.js')).toContain("detalle: `Deshecho ajuste de $${Math.round(resultado.original.monto).toLocaleString('es-CO')}: ${resultado.original.descripcion ?? ''}`")
    expect(leer('app/api/cron/cierre-recordatorios/route.js')).toContain("detalle: `Push recordatorio de cierre (${pendingType}) para ${pendingDate}. Monto sugerido: ${Math.round(pendingAmount).toLocaleString('es-CO')}`")
  })

  it('la pantalla pinta el renglón traducido, no el texto crudo', () => {
    const src = leer('app/(dashboard)/actividad/page.jsx')
    expect(src).toMatch(/\{fila\.detalleTexto\}\s*<\/p>/)
    expect(src).not.toMatch(/\{item\.detalle\}/)
  })
})

describe('#6 · el día es el del negocio (Bogotá), no el de UTC', () => {
  it('las 11:42 p. m. del 18 son del 18, aunque en UTC ya sea el 19', () => {
    expect(diaDelNegocio('2026-10-19T04:42:06.151Z', BOGOTA)).toBe('2026-10-18')
    expect(diaDelNegocio('2026-10-19T05:20:02.214Z', BOGOTA)).toBe('2026-10-19')
  })

  it('«Hoy» y «Ayer» parten a medianoche de Bogotá', () => {
    // 19 oct, 2:30 p. m. en Bogotá.
    const ahora = Date.parse('2026-10-19T19:30:00.000Z')
    const grupos = agruparPorDia([
      { id: 'a', createdAt: '2026-10-19T19:21:14.885Z' }, // 2:21 p. m. del 19
      { id: 'b', createdAt: '2026-10-19T05:20:02.214Z' }, // 12:20 a. m. del 19
      { id: 'c', createdAt: '2026-10-19T04:42:06.151Z' }, // 11:42 p. m. del 18 ← salía bajo «Hoy»
      { id: 'd', createdAt: '2026-10-18T21:26:02.083Z' }, // 4:26 p. m. del 18
      { id: 'e', createdAt: '2026-10-17T10:00:00.000Z' }, // 5:00 a. m. del 17
    ], { offsetHoras: BOGOTA, ahora })
    expect(grupos.map((g) => [g.label, g.items.map((i) => i.id).join('')])).toEqual([
      ['Hoy', 'ab'],
      ['Ayer', 'cd'],
      [etiquetaDelDia('2026-10-17', { offsetHoras: BOGOTA, ahora }), 'e'],
    ])
    expect(grupos[2].label).toMatch(/17/)
    expect(grupos[2].label).toMatch(/oct/)
  })

  it('a las 10 de la noche todavía es hoy (en UTC ya sería mañana)', () => {
    const ahora = Date.parse('2026-10-20T03:00:00.000Z') // 19 oct, 10:00 p. m. en Bogotá
    expect(etiquetaDelDia('2026-10-19', { offsetHoras: BOGOTA, ahora })).toBe('Hoy')
    expect(etiquetaDelDia('2026-10-18', { offsetHoras: BOGOTA, ahora })).toBe('Ayer')
  })

  it('la hora es la del reloj del negocio, sea cual sea la zona de quien mira', () => {
    const [f] = agruparRepetidos([suceso('cierre_caja', 'Cierre', '2026-10-19T04:42:06.151Z')], undefined, { offsetHoras: BOGOTA })
    expect(f.horaTexto).toMatch(/^11:42\s*p\.\s*m\.$/u)
  })

  it('la pantalla agrupa con el desfase del país y ya no con toISOString', () => {
    const src = leer('app/(dashboard)/actividad/page.jsx')
    expect(src).toMatch(/const offsetHoras = getUtcOffset\(country\)/)
    expect(src).toMatch(/agruparPorDia\(items, \{ offsetHoras \}\)/)
    expect(src).toMatch(/agruparRepetidos\(grupo\.items, undefined, \{ offsetHoras \}\)/)
    expect(src).not.toMatch(/new Date\(item\.createdAt\)\.toISOString\(\)\.slice\(0, 10\)/)
  })

  it('los filtros «desde» y «hasta» de la API también van por día del negocio', () => {
    const src = leer('app/api/actividad/route.js')
    expect(src).toMatch(/createdAtFilter\.gte = getLocalDayRange\(desde, country\)\.inicio/)
    expect(src).toMatch(/createdAtFilter\.lte = getLocalDayRange\(hasta, country\)\.fin/)
    expect(src).not.toMatch(/setHours\(23, 59, 59, 999\)/)
  })
})

describe('#7 · un gasto rechazado no es plata que salió', () => {
  const pinchazo = (gastoEstado, createdAt = '2026-10-19T18:44:21.622Z') => suceso(
    'registrar_gasto', 'Gasto $25.000 - Pinchazo/Llanta', createdAt,
    { user: { nombre: 'Camilo Ortiz', rol: 'cobrador' }, entidadId: 'cmvfb2sbu0039jwe2msbflrnq', gastoEstado },
  )

  it('rechazado: sin signo, marcado, y fuera de lo que salió', () => {
    const f = fila(pinchazo('rechazado'))
    expect(f).toMatchObject({ estado: 'rechazado', sentido: 'neutro', monto: 25000 })
    expect(f.detalleTexto).toBe('Gasto de $25.000 · Pinchazo/Llanta')
    expect(resumenDelDia([pinchazo('rechazado')]).salio).toBe(0)
  })

  it('borrado: igual que rechazado; aprobado y pendiente sí salen', () => {
    expect(fila(pinchazo('eliminado'))).toMatchObject({ estado: 'eliminado', sentido: 'neutro' })
    expect(fila(pinchazo('aprobado'))).toMatchObject({ estado: null, sentido: 'sale' })
    expect(fila(pinchazo('pendiente'))).toMatchObject({ estado: 'pendiente', sentido: 'sale' })
    // Sin el dato (caché viejo sin conexión): como antes.
    expect(fila(pinchazo(undefined))).toMatchObject({ estado: null, sentido: 'sale' })
  })

  it('el rechazado no se suma en la tanda de los que sí salieron', () => {
    const filas = agruparRepetidos([
      pinchazo('rechazado', '2026-10-19T18:44:21.622Z'),
      { ...pinchazo('aprobado', '2026-10-19T18:43:00.000Z'), detalle: 'Gasto $15.000 - Gasolina' },
    ], undefined, { offsetHoras: BOGOTA })
    expect(filas).toHaveLength(2)
    expect(filas[1]).toMatchObject({ monto: 15000, sentido: 'sale', estado: null })
  })

  it('«Sofía rechazó el gasto de Camilo Ortiz»', () => {
    // El texto exacto que escribe ahora `/api/gastos/[id]`.
    const detalle = `Gasto de Camilo Ortiz: $${(25000).toLocaleString('es-CO')} - Pinchazo/Llanta`
    const f = fila(suceso('rechazar_gasto', detalle))
    expect(f.linea).toBe('Sofía Restrepo rechazó el gasto de Camilo Ortiz')
    expect(f.detalleTexto).toBe('$25.000 · Pinchazo/Llanta')
    expect(f.sentido).toBe('neutro')
    expect(fila(suceso('aprobar_gasto', 'Gasto: $20.000 - Recarga del celular')).linea).toBe('Sofía Restrepo aprobó un gasto')
  })

  it('el endpoint anota quién lo aprobó o lo rechazó, con el nombre del cobrador', () => {
    const src = leer('app/api/gastos/[id]/route.js')
    // Y «Volver a pendiente» con su propia acción (antes daba 400).
    expect(src).toMatch(/accion: loDevolvio \? 'gasto_a_pendiente' : loRechazo \? 'rechazar_gasto' : 'aprobar_gasto'/)
    expect(src).toContain("if (!['aprobado', 'rechazado', 'pendiente'].includes(estado)) {")
    expect(src).toContain("const debeDevolverAlRechazar = estado === 'rechazado' || estado === 'pendiente'")
    expect(ACCIONES.gasto_a_pendiente.label).toBe('Devolvió gasto a pendiente')
    expect(src).toContain("detalle: `Gasto${gastoExistente.cobrador?.nombre ? ` de ${gastoExistente.cobrador.nombre}` : ''}: $${gastoExistente.monto.toLocaleString('es-CO')} - ${gastoExistente.description}`")
    expect(src).toMatch(/include: \{ cobrador: \{ select: \{ nombre: true \} \} \}/)
    expect(ACCIONES.rechazar_gasto.label).toBe('Rechazó gasto')
  })

  it('la API le pregunta al gasto cómo quedó; la pantalla lo tacha y le pone pastilla', () => {
    const api = leer('app/api/actividad/route.js')
    expect(api).toMatch(/gastoEstado: estadoDeGasto\.get\(a\.entidadId\) \?\? 'eliminado'/)
    expect(api).toMatch(/where: \{ id: \{ in: idsGasto \}, organizationId: session\.user\.organizationId \}/)
    const src = leer('app/(dashboard)/actividad/page.jsx')
    expect(src).toMatch(/textDecoration: NO_CUENTA\.includes\(fila\.estado\) \? 'line-through' : 'none'/)
    expect(src).toMatch(/<Pastilla tono=\{PASTILLA_DE_ESTADO\[fila\.estado\]\.tono\}>/)
  })
})

describe('#8 · la caja y su cierre, en palabras (DETALLES-COBRADORES #8)', () => {
  // Filas reales del negocio de demostración (texto, hora UTC y su CierreCaja
  // tal como están en el espejo el 19 oct 2026).
  const SOFIA = { nombre: 'Sofía Restrepo', rol: 'owner' }
  const CAMILO = { nombre: 'Camilo Ortiz', rol: 'cobrador' }
  const ANDRES = { nombre: 'Andrés Vargas', rol: 'cobrador' }
  const de = (user, accion, detalle, createdAt, extra = {}) => suceso(accion, detalle, createdAt, { user, ...extra })
  const cierreCamilo = { totalRecogido: 60000, enLaManoSistema: 67800, editadoEn: null }
  const camiloEntrega = (cierre) => de(CAMILO, 'cierre_caja', 'Cierre de caja Camilo Ortiz - recogido $60.000', '2026-10-19T16:54:27.215Z', cierre ? { cierre } : {})

  it('«cerró caja · Cierre de caja Sofía Restrepo - recogido $14.500» → «cerró su caja · contó $14.500»', () => {
    const f = fila(de(SOFIA, 'cierre_caja', 'Cierre de caja Sofía Restrepo - recogido $14.500', '2026-10-19T17:20:55.689Z'))
    expect(f.linea).toBe('Sofía Restrepo cerró su caja')
    expect(f.detalleTexto).toBe('contó $14.500')
  })

  it('el ajuste del cierre: «de $14.500 a $14.000», sin flecha ni fecha repetida', () => {
    const f = fila(de(SOFIA, 'ajuste_cierre_caja', 'Ajuste cierre Sofía Restrepo (19 de oct de 2026) - recogido $14.500 -> $14.000', '2026-10-19T17:16:12.374Z'))
    expect(f.linea).toBe('Sofía Restrepo ajustó su cierre')
    expect(f.detalleTexto).toBe('de $14.500 a $14.000')
    // Las filas más viejas no traían el «antes».
    expect(leerSuceso(de(SOFIA, 'ajuste_cierre_caja', 'Ajuste cierre Sofía Restrepo (19 de oct de 2026) - recogido $14.000', '2026-10-19T17:16:12.374Z')).detalle)
      .toBe('quedó en $14.000')
  })

  it('el dueño que ajusta el cierre de AYER de un cobrador: se nombra el cobrador y el día', () => {
    const f = fila(de(SOFIA, 'ajuste_cierre_caja', 'Ajuste cierre Camilo Ortiz (18 de oct de 2026) (editado por admin) - recogido $249.000 -> $162.000', '2026-10-19T15:00:00.000Z'))
    expect(f.linea).toBe('Sofía Restrepo ajustó el cierre de Camilo Ortiz del 18 de oct')
    expect(f.detalleTexto).toBe('de $249.000 a $162.000')
  })

  it('«Deshizo el cierre de caja de Sofía Restrepo - tenía recogido $14.000» → «deshizo su cierre ($14.000)»', () => {
    const f = fila(de(SOFIA, 'deshacer_cierre_caja', 'Deshizo el cierre de caja de Sofía Restrepo - tenía recogido $14.000', '2026-10-19T17:20:34.309Z'))
    expect(f.linea).toBe('Sofía Restrepo deshizo su cierre ($14.000)')
    expect(f.detalleTexto).toBe(null)
  })

  it('el cobrador ENTREGA su caja, y se dice cuánto faltó contra lo que esperaba la app', () => {
    const f = fila(camiloEntrega(cierreCamilo))
    expect(f.linea).toBe('Camilo Ortiz entregó su caja')
    expect(f.detalleTexto).toBe('$60.000 (faltaron $7.800)')
    expect(leerSuceso(camiloEntrega({ ...cierreCamilo, enLaManoSistema: 50000 })).detalle).toBe('$60.000 (sobraron $10.000)')
    // El cero es un dato.
    expect(leerSuceso(camiloEntrega({ ...cierreCamilo, enLaManoSistema: 60000 })).detalle).toBe('$60.000 (cuadró con la app)')
  })

  it('sin la cifra de la app, o si el cierre ya no es el de esta fila, NO se inventa', () => {
    expect(leerSuceso(camiloEntrega(null)).detalle).toBe('$60.000')
    // Cierre de antes del 17 oct: no guardaba lo que tenía en la mano.
    expect(leerSuceso(camiloEntrega({ ...cierreCamilo, enLaManoSistema: null })).detalle).toBe('$60.000')
    // Lo ajustaron después: las dos cifras ya son las del ajuste.
    expect(leerSuceso(camiloEntrega({ ...cierreCamilo, editadoEn: '2026-10-19T17:00:00.000Z' })).detalle).toBe('$60.000')
    expect(leerSuceso(camiloEntrega({ ...cierreCamilo, totalRecogido: 55000 })).detalle).toBe('$60.000')
  })

  it('el cierre de $249.000 que Camilo ajustó a $162.000: la cuenta va en el AJUSTE, no en el cierre viejo', () => {
    const cierre = { totalRecogido: 162000, enLaManoSistema: 162000, editadoEn: '2026-10-19T00:25:57.104Z' }
    expect(leerSuceso(de(CAMILO, 'cierre_caja', 'Cierre de caja Camilo Ortiz - recogido $249.000', '2026-10-19T00:20:02.214Z', { cierre })).detalle)
      .toBe('$249.000')
    const ajuste = fila(de(CAMILO, 'ajuste_cierre_caja', 'Ajuste cierre Camilo Ortiz (18 de oct de 2026) - recogido $249.000 -> $162.000', '2026-10-19T00:25:58.284Z', { cierre }))
    // 7:25 p. m. del 18 en Bogotá: la fecha es la de la fila y no se repite.
    expect(ajuste.linea).toBe('Camilo Ortiz ajustó su cierre')
    expect(ajuste.detalleTexto).toBe('de $249.000 a $162.000 (cuadró con la app)')
  })

  it('el faltante sale de lo que la app esperaba en la mano, nunca de `diferencia`', () => {
    // `diferencia` es lo recogido contra lo que TOCABA cobrar: no es un faltante.
    const src = leer('lib/adaptadores/actividad.js')
    const cuerpo = src.slice(src.indexOf('function faltoOSobro('), src.indexOf('function leerCierre('))
    expect(cuerpo).toMatch(/const diferencia = entregado - Math\.round\(Number\(c\.enLaManoSistema\)\)/)
    expect(cuerpo).not.toMatch(/c\.diferencia/)
  })

  it('el dueño que cierra la caja de un cobrador la nombra', () => {
    const f = fila(de(SOFIA, 'cierre_caja', 'Cierre de caja Camilo Ortiz - recogido $60.000', '2026-10-19T16:54:27.215Z', { cierre: cierreCamilo }))
    expect(f.linea).toBe('Sofía Restrepo cerró la caja de Camilo Ortiz')
    expect(f.detalleTexto).toBe('entregó $60.000 (faltaron $7.800)')
  })

  it('el cuadre: lo recibido contra lo que decía la app, sin «vs», «=» ni fecha ISO', () => {
    const cuadre = (texto, createdAt = '2026-10-17T08:11:20.813Z') => fila(de(SOFIA, 'confirmar_cuadre', texto, createdAt))
    const f = cuadre('Cuadre Andrés Vargas (2026-10-17): recibido $79.400 vs sistema $84.400 = $-5.000')
    expect(f.linea).toBe('Sofía Restrepo contó la caja de Andrés Vargas')
    expect(f.detalleTexto).toBe('recibió $79.400, la app decía $84.400 · faltaron $5.000')
    expect(cuadre('Cuadre Andrés Vargas (2026-10-17): recibido $90.000 vs sistema $84.400 = +$5.600').detalleTexto)
      .toBe('recibió $90.000, la app decía $84.400 · sobraron $5.600')
    expect(cuadre('Cuadre Andrés Vargas (2026-10-17): recibido $84.400 vs sistema $84.400 = +$0').detalleTexto)
      .toBe('recibió $84.400, la app decía $84.400 · cuadró exacto')
    expect(cuadre('Cerró la caja y cuadró a Andrés Vargas (2026-10-16): recibido $84.400 vs sistema $84.400 = +$0').linea)
      .toBe('Sofía Restrepo cerró y contó la caja de Andrés Vargas del 16 de oct')
  })

  it('reabrir: quién lo pidió, quién lo aprobó, y el día solo si es otro', () => {
    expect(fila(de(CAMILO, 'solicitud_reapertura_cierre_caja', 'Solicitud de reapertura de caja Camilo Ortiz (2026-10-18)', '2026-10-19T00:22:52.243Z')).linea)
      .toBe('Camilo Ortiz pidió reabrir su caja')
    expect(fila(de(ANDRES, 'solicitud_reapertura_cierre_caja', 'Solicitud de reapertura de caja Andrés Vargas (2026-10-17)', '2026-10-19T16:55:55.666Z')).linea)
      .toBe('Andrés Vargas pidió reabrir su caja del 17 de oct')
    expect(fila(de(SOFIA, 'aprobacion_reapertura_cierre_caja', 'Reapertura de caja aprobada para Andrés Vargas', '2026-10-19T16:59:55.025Z')).linea)
      .toBe('Sofía Restrepo aprobó reabrir la caja de Andrés Vargas')
    expect(fila(de(SOFIA, 'rechazo_reapertura_cierre_caja', 'Reapertura de caja rechazada para Andrés Vargas', '2026-10-19T16:59:55.025Z')).linea)
      .toBe('Sofía Restrepo rechazó reabrir la caja de Andrés Vargas')
    expect(fila(de(SOFIA, 'reapertura_cierre_caja', 'Reapertura de caja Camilo Ortiz (2026-10-18)', '2026-10-19T15:00:00.000Z')).linea)
      .toBe('Sofía Restrepo reabrió la caja de Camilo Ortiz del 18 de oct')
  })

  it('la corrección deshecha y el aviso de cerrar dicen quién hizo qué', () => {
    const d = fila(de(SOFIA, 'movimiento_caja_deshecho', 'Deshecho ajuste de $282.000: Inyección manual desde caja'))
    expect(d.linea).toBe('Sofía Restrepo deshizo una corrección de la caja')
    expect(d.detalleTexto).toBe('$282.000 · Inyección manual desde caja')
    // La fila del aviso va a nombre del cobrador: él lo RECIBIÓ, la app lo mandó.
    const aviso = fila(de(CAMILO, 'push_recordatorio_cierre', 'Push recordatorio de cierre (pendiente_hoy) para 2026-10-19. Monto sugerido: 84.400', '2026-10-19T23:00:00.000Z'))
    expect(aviso.linea).toBe('Camilo Ortiz recibió el aviso de cerrar su caja')
    expect(aviso.detalleTexto).toBe('La app sugería $84.400')
    expect(fila(de(CAMILO, 'push_recordatorio_cierre', 'Push recordatorio de cierre (ajuste_ayer) para 2026-10-18. Monto sugerido: 84.400', '2026-10-19T23:00:00.000Z')).linea)
      .toBe('Camilo Ortiz recibió el aviso de ajustar su cierre del 18 de oct')
    expect(ACCIONES.push_recordatorio_cierre.label).toBe('Recibió aviso de cerrar la caja')
  })

  it('ninguna fila de caja deja «->», una fecha ISO o un id', () => {
    const filas = [
      de(SOFIA, 'cierre_caja', 'Cierre de caja Sofía Restrepo - recogido $14.500', '2026-10-19T17:20:55.689Z'),
      de(SOFIA, 'ajuste_cierre_caja', 'Ajuste cierre Sofía Restrepo (19 de oct de 2026) - recogido $14.500 -> $14.000', '2026-10-19T17:16:12.374Z'),
      de(SOFIA, 'deshacer_cierre_caja', 'Deshizo el cierre de caja de Sofía Restrepo - tenía recogido $14.000', '2026-10-19T17:20:34.309Z'),
      camiloEntrega(cierreCamilo),
      de(SOFIA, 'confirmar_cuadre', 'Cuadre Andrés Vargas (2026-10-17): recibido $79.400 vs sistema $84.400 = $-5.000', '2026-10-17T08:11:20.813Z'),
      de(CAMILO, 'solicitud_reapertura_cierre_caja', 'Solicitud de reapertura de caja Camilo Ortiz (2026-10-18)', '2026-10-19T00:22:52.243Z'),
      de(SOFIA, 'reapertura_cierre_caja', 'Reapertura de caja Camilo Ortiz (2026-10-18)', '2026-10-19T15:00:00.000Z'),
      de(SOFIA, 'aprobacion_reapertura_cierre_caja', 'Reapertura de caja aprobada para Andrés Vargas', '2026-10-19T16:59:55.025Z'),
      de(CAMILO, 'push_recordatorio_cierre', 'Push recordatorio de cierre (ajuste_ayer) para 2026-10-18. Monto sugerido: 84.400', '2026-10-19T23:00:00.000Z'),
      de(SOFIA, 'movimiento_caja_deshecho', 'Deshecho ajuste de $282.000: Inyección manual desde caja'),
    ]
    for (const it of filas) {
      const f = fila(it)
      const visto = `${f.linea} ${f.detalleTexto ?? ''}`
      expect(visto, it.detalle).not.toMatch(/->|\d{4}-\d{2}-\d{2}|\bcm[a-z0-9]{20,}\b|pendiente_hoy|ajuste_ayer|recogido|vs sistema/)
    }
  })

  it('la API trae del cierre lo que la app esperaba, buscando por el id de la fila', () => {
    const api = leer('app/api/actividad/route.js')
    expect(api).toMatch(/const CON_CIERRE = \['cierre_caja', 'ajuste_cierre_caja'\]/)
    expect(api).toMatch(/prisma\.cierreCaja\.findMany\(\{\s*where: \{ id: \{ in: idsCierre \}, organizationId: session\.user\.organizationId \},\s*select: \{ id: true, totalRecogido: true, enLaManoSistema: true, editadoEn: true \},/)
    expect(api).toMatch(/cierre: \{ totalRecogido: c\.totalRecogido, enLaManoSistema: c\.enLaManoSistema, editadoEn: c\.editadoEn \}/)
  })

  it('fuera de la caja tampoco quedan fechas ISO ni ids (pago y préstamo)', () => {
    // La fecha de un pago es un instante: las 8 p. m. del 17 en Bogotá ya son el 18 en UTC.
    expect(leerSuceso(de(SOFIA, 'editar_pago', 'Fecha de pago cambiada de 2026-10-18T01:00:00.000Z a 2026-10-16T15:00:00.000Z (préstamo cmvc3uq6x005z94e2b9ortgjf)'), { offsetHoras: BOGOTA }).detalle)
      .toBe('Del 17 de oct al 16 de oct')
    expect(leerSuceso(de(SOFIA, 'editar_pago', 'Fecha de pago cambiada de 2026-10-17T15:00:00.000Z a 2026-10-17T20:30:00.000Z (préstamo cmvc3uq6x005z94e2b9ortgjf)'), { offsetHoras: BOGOTA }).detalle)
      .toMatch(/^El 17 de oct, de 10:00\s*a\.\s*m\. a 3:30\s*p\.\s*m\.$/u)
    expect(leerSuceso(de(SOFIA, 'editar_prestamo', 'Fecha de inicio corregida: 2026-10-01→2026-10-02 (fin: 2026-10-31→2026-11-01)')).detalle)
      .toBe('Fecha de inicio corregida: 1 de oct→2 de oct (fin: 31 de oct→1 de nov)')
    expect(leerSuceso(de(SOFIA, 'editar_prestamo', 'Próximo cobro cambiado manualmente a 2026-10-18')).detalle)
      .toBe('Próximo cobro cambiado manualmente a 18 de oct')
    expect(leerSuceso(de(SOFIA, 'eliminar_prestamo', 'Préstamo de Toño eliminado — era una renovación: al anterior (cmtg12jsp34f5c6l7mczosd8t) se le devolvió su saldo de $50.000')).detalle)
      .toBe('Préstamo de Toño eliminado — era una renovación: al anterior se le devolvió su saldo de $50.000')
  })

  it('«Volver a pendiente» de un gasto también se lee', () => {
    expect(fila(de(SOFIA, 'gasto_a_pendiente', 'Gasto de Camilo Ortiz: $25.000 - Pinchazo/Llanta')).linea)
      .toBe('Sofía Restrepo devolvió a pendiente el gasto de Camilo Ortiz')
  })
})
