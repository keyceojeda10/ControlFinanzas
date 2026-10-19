/* Préstamos, los urgentes (1-11) del agente de los tutoriales
 * (`DETALLES-PRESTAMOS.md`, 17 oct 2026), con las decisiones del dueño:
 * extender = financiar sin interés, el % del abierto es por cada cobro, cerrar
 * anticipado nunca por menos del capital, y aplazar no perdona el atraso.
 * Ancladas en el código o en el cálculo, no en los comentarios. */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { calcularDiasMora } from '@/lib/calculos'
import { motivoParaNoDeshacerLiquidacion } from '@/lib/dinero/deshacer-abono'
import { resumenCerrar } from '@/lib/adaptadores/gestion'
import { vistaFinanciar } from '@/lib/financiar'

const ficha = readFileSync('app/(dashboard)/prestamos/[id]/page.jsx', 'utf8')
const api = readFileSync('app/api/prestamos/[id]/route.js', 'utf8')
const apiPagos = readFileSync('app/api/prestamos/[id]/pagos/route.js', 'utf8')
const anular = readFileSync('app/api/pagos/[id]/route.js', 'utf8')
const rp = readFileSync('components/prestamos/RegistrarPago.jsx', 'utf8')
const plazo = readFileSync('components/prestamos/ModificarPlazo.jsx', 'utf8')
const nuevo = readFileSync('app/(dashboard)/prestamos/nuevo/page.jsx', 'utf8')

describe('#1 · «Cancelar hoy» cierra el préstamo, y solo con permiso de descuentos', () => {
  it('el atajo abre la hoja de cerrar anticipado en vez de poner una cifra', () => {
    expect(rp).toMatch(/if \(a\.id === 'cancelar' && onCancelarHoy\) \{ onCancelarHoy\(\); return \}/)
    // Sin la función (sin permiso) el atajo ni sale: «Todo lo que debe» ocupa su sitio.
    expect(rp).toMatch(/cancelarHoy: onCancelarHoy \? cancelarHoy : 0/)
    expect(ficha).toMatch(/onCancelarHoy=\{puedeAplicarDescuentos \? \(\) => \{ setModalPago\(false\); abrirLiquidacion\(\) \} : null\}/)
  })
})

describe('#2 · «Días sin cobro» del préstamo guarda', () => {
  it('la API tiene su operación y la ficha la pide por nombre', () => {
    expect(api).toMatch(/if \(modo === 'diasSinCobro'\) \{/)
    expect(api).toMatch(/valor = lista && lista\.length > 0 \? validarDiasSinCobro\(lista\) : null/)
    expect(ficha).toMatch(/body: JSON\.stringify\(\{ modo: 'diasSinCobro', diasSinCobro: dscDias \}\)/)
  })
})

describe('#3 · «Corregir fin» manda el modo que la API conoce', () => {
  it("la intención es 'corregir'", () => {
    expect(plazo).toMatch(/\{ id: 'corregir', etiqueta: 'Corregir fin' \}/)
    expect(plazo).not.toMatch(/'corregirFin'/)
  })
})

describe('#4 · extender = financiar sin interés, desde hoy', () => {
  it('sin interés la deuda queda exacta: $500.000 en 30 cuotas no pasa a $501.000', () => {
    const v = vistaFinanciar({ deuda: 500000, interes: 0, periodos: 30, frecuencia: 'diario', fechaInicio: '2026-10-17' })
    expect(v.total).toBe(500000)
    expect(v.cuota * 30).toBeGreaterThanOrEqual(500000)
    expect(readFileSync('app/api/prestamos/[id]/renovar/route.js', 'utf8'))
      .toMatch(/const totalAPagar = financiar && interesFinanciado === 0 \? Math\.round\(montoFinal\) : calc\.totalAPagar/)
  })
  it('la hoja va a /renovar con financiar e interés 0, y la rama vieja ya no guarda', () => {
    expect(plazo).toMatch(/body: JSON\.stringify\(\{ \.\.\.\(confirmado \? \{ confirmarClienteEnPerdidos: true \} : \{\}\), financiar: true, interes: 0, diasPlazo: diasPlazoNuevo, frecuencia \}\)/)
    expect(plazo).toMatch(/onAceptar=\{\(\) => extender\(diasPlazoNuevo\)\}/)
    expect(api).toMatch(/if \(modo === 'extender'\) \{\s*return Response\.json\(\{/)
  })
  it('«Modificar el plazo» no sale en abiertos ni con tabla', () => {
    expect(ficha).toMatch(/if \(puedeGestionarPrestamos && !esAbierto && !tieneTablaAmortizacion\(prestamo\)\) \{\s*cobra\.push\(\{\s*id: 'plazo'/)
  })
})

describe('#5 · el abierto dice cada cuánto cobra el %', () => {
  it('el rótulo y la línea siguen a la frecuencia, y el diario avisa', () => {
    // (tanda 3, #50) Fuera del abierto, el rótulo dice lo que significa el % en el modo.
    expect(nuevo).toMatch(/\{pesos\.enPesos \|\| esAbierto \? rotuloCuotaEnPesos\(frecuencia, esAbierto\) : \(sufijoTasa\(modoInteres\)/)
    expect(nuevo).toMatch(/de interés \{esAbierto \? `cada \$\{PERIODO_ABIERTO\[frecuencia\] \?\? 'mes'\}` : 'por mes'\}/)
    expect(nuevo).toMatch(/\{esAbierto && frecuencia === 'diario' && Number\(monto\) > 0 && Number\(tasa\) > 0 && \(/)
  })
})

describe('#6 · anular un «solo interés» sin tabla deshace la subida de la deuda', () => {
  it('con la misma pregunta que el cobro', () => {
    expect(anular).toMatch(/if \(pago\.tipo === 'intereses' && elInteresSubeLaDeuda\(prestamo\)\) \{\s*await tx\.prestamo\.update\(\{\s*where: \{ id: prestamo\.id \},\s*data: \{ totalAPagar: \{ decrement: pago\.montoPagado \} \},/)
    expect(apiPagos).toMatch(/if \(tipo === 'intereses' && elInteresSubeLaDeuda\(prestamoActualizado\)\) \{\s*await tx\.prestamo\.update\(\{\s*where: \{ id: prestamoId \},\s*data: \{ totalAPagar: \{ increment: montoFinal \} \},/)
  })
})

describe('#7 · anular una liquidación devuelve la deuda y deshace el perdón', () => {
  it('la liquidación guarda su foto y anular la usa', () => {
    expect(apiPagos).toMatch(/data: \{ tablaAntes: \{ totalAPagar: totalAntesDeLiquidar, devengo: devengoDeLaLiquidacion, interesPerdonado \} \}/)
    expect(anular).toMatch(/await tx\.prestamo\.update\(\{ where: \{ id: prestamo\.id \}, data: \{ totalAPagar: pago\.tablaAntes\.totalAPagar \} \}\)/)
    expect(anular).toMatch(/await tx\.devengoInteres\.deleteMany\(\{ where: \{ prestamoId: prestamo\.id, periodo: pago\.tablaAntes\.devengo \} \}\)/)
    expect(anular).toMatch(/descripcion: 'Reverso interés perdonado \(cierre anulado\) - préstamo'/)
  })
  it('una liquidación sin foto no se anula a ciegas', () => {
    expect(motivoParaNoDeshacerLiquidacion({ tablaAntes: null })).toMatch(/escríbanos/)
    expect(motivoParaNoDeshacerLiquidacion({ tablaAntes: { totalAPagar: 600000, devengo: null, interesPerdonado: 50000 } })).toBeNull()
  })
})

describe('#8 · cerrar anticipado: nunca por menos del capital, con medio y con la cifra tecleada', () => {
  it('el servidor pone el piso del capital', () => {
    expect(apiPagos).toMatch(/if \(montoFinal < pisoCapital\) throw new Error\(`LIQUIDACION_BAJO_CAPITAL:\$\{pisoCapital\}`\)/)
    expect(apiPagos).toMatch(/if \(tipo === 'liquidacion' \? saldoLocked <= 0 : montoFinal <= 0\) \{/)
  })
  it('la hoja manda el medio, abre con la cifra del menú y no deja bajar del capital', () => {
    expect(ficha).toMatch(/metodoPago: liqMetodo\?\.metodoPago \?\? 'efectivo',/)
    expect(ficha).toMatch(/const inicial = data\.proporcional \? 'proporcional' : 'mesCompleto'/)
    expect(ficha).toMatch(/deshabilitado=\{liqMonto < 0 \|\| bajoElPiso \|\| !liqNota\.trim\(\)\}/)
  })
  it('«recibes» y «dejas de ganar» siguen al monto de la hoja', () => {
    const liq = {
      saldoActual: 500000, interesTotalPactado: 100000,
      proporcional: { restanteHoy: 450000, interesPerdonado: 50000, interesDevengado: 50000 },
    }
    const r = resumenCerrar(liq, 'proporcional', 'co', 470000)
    expect(r.recibes).toBe('$470.000')
    expect(r.dejasDeGanar).toBe('$30.000')
    expect(r.gananciaTotal).toBe('$70.000')
    // Sin monto tecleado, como antes.
    expect(resumenCerrar(liq, 'proporcional', 'co').recibes).toBe('$450.000')
  })
})

describe('#9 · si falla una acción, la ficha no desaparece', () => {
  it('el error de una acción va aparte y se enseña con el motivo', () => {
    expect(ficha).toMatch(/const \[errorAccion,\s+setErrorAccion\]\s+= useState\(''\)/)
    expect(ficha).toMatch(/setErrorAccion\(d\.error \|\| 'No se pudo anular el pago\.'\)/)
    expect(ficha).toMatch(/setErrorAccion\(err\.message \|\| 'No se pudo anular el préstamo\.'\)/)
    expect(ficha).toMatch(/setErrorAccion\(err\.message \|\| 'No se pudo eliminar el préstamo\.'\)/)
    // `setError` queda solo para la carga.
    expect((ficha.match(/setError\('No se pudo/g) || []).length).toBe(1)
    // Y la carga lo limpia: «Reintentar» ya recupera la ficha.
    expect(ficha).toMatch(/if \(!shouldUseSoftRefresh\) \{ setLoading\(true\); setError\(''\) \}/)
  })
})

describe('#10 · aplazar no perdona el atraso; el interés pagado sí compra el tiempo', () => {
  const DIA = 86400000
  const ahora = new Date('2026-10-17T17:00:00Z').getTime()
  const base = {
    estado: 'activo', modoInteres: 'fijo', frecuencia: 'diario',
    fechaInicio: new Date(ahora - 20 * DIA).toISOString(),
    cuotaDiaria: 20000, diasPlazo: 30, totalAPagar: 600000, totalPagado: 100000,
    pagos: [{ tipo: 'completo', montoPagado: 100000, fechaPago: new Date(ahora - 20 * DIA).toISOString() }],
    cuotasAmortizacion: [],
    proximoCobroManual: new Date(ahora + 5 * DIA).toISOString(),
  }
  it('aplazado sin plata: los días de atraso siguen ahí', () => {
    expect(calcularDiasMora({ ...base, proximoCobroPorInteres: false }, [], [], ahora)).toBe(14)
  })
  it('comprado con un pago de interés: al día hasta la fecha', () => {
    expect(calcularDiasMora({ ...base, proximoCobroPorInteres: true }, [], [], ahora)).toBe(0)
  })
  it('cada lado marca lo suyo, y cada select que pide la fecha pide también la marca', () => {
    expect(apiPagos).toMatch(/data: \{ proximoCobroManual: nueva, proximoCobroPorInteres: true \}/)
    expect(api).toMatch(/data: \{ proximoCobroManual: fecha, proximoCobroPorInteres: false \}/)
    const sinMarca = []
    const recorrer = (dir) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f)
        if (statSync(p).isDirectory()) { if (f !== '__tests__' && f !== 'node_modules') recorrer(p); continue }
        if (!/\.(js|jsx)$/.test(f)) continue
        const src = readFileSync(p, 'utf8')
        const n1 = (src.match(/proximoCobroManual: true/g) || []).length
        const n2 = (src.match(/proximoCobroPorInteres: true/g) || []).length
        if (n1 > n2) sinMarca.push(p)
      }
    }
    recorrer('app'); recorrer('lib')
    expect(sinMarca).toEqual([])
  })
})

describe('#11 · «Rechazar» pregunta y manda el motivo', () => {
  it('abre la confirmación y envía el motivo', () => {
    expect(ficha).toMatch(/onClick=\{\(\) => \{ setMotivoRechazo\(''\); setConfirmRechazo\(true\) \}\}/)
    expect(ficha).toMatch(/body: JSON\.stringify\(\{ motivo: motivoRechazo\.trim\(\) \|\| undefined \}\)/)
  })
})

describe('de paso, en la ficha', () => {
  it('la liquidación solo se le calcula a un cobrador en sus rutas', () => {
    const liq = readFileSync('app/api/prestamos/[id]/liquidacion/route.js', 'utf8')
    expect(liq).toMatch(/session\.user\.rol === 'cobrador' && !\(session\.user\.rutaIds \?\? \[\]\)\.includes\(prestamo\.cliente\?\.rutaId\)/)
  })
  it('#12 en un préstamo que ya no está vivo solo queda Eliminar', () => {
    expect(ficha).toMatch(/if \(!\(estaActivo && !completado\)\) \{\s*return g\s*\.map\(\(gr\) => \(\{ \.\.\.gr, acciones: gr\.acciones\.filter\(\(a\) => a\.id === 'eliminar'\) \}\)\)/)
  })
  it('#13 perdidos es del dueño, y sacar de perdidos dice por qué falla', () => {
    expect(ficha).toMatch(/if \(esOwner\) \{\s*cierra\.push\(esClavo/)
    expect(ficha).toMatch(/setErrorAccion\(d\.error \|\| 'No se pudo quitar de clavos\.'\)/)
  })
  it('#14 y tras cobrar: la ficha se vuelve a pedir entera', () => {
    expect(ficha).not.toMatch(/if \(data\?\.prestamo\) \{/)
    expect(ficha).toMatch(/mezclarRespuestaDelCobro\(prestamoActualizado\)\s*fetchPrestamo\(\{ soft: true \}\)/)
  })
  it('#20 «editar el mismo día» con el día del país', () => {
    expect(ficha).toMatch(/const esDeHoy = esDelDiaAbierto\(prestamo\?\.createdAt, country\)/)
  })
})
