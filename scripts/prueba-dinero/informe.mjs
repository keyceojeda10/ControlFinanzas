// El formato de salida. Cuando algo no cuadra, esto es lo único que se lee.
//
// Tres decisiones de forma, todas por lo mismo — que se pueda señalar la
// operación culpable sin leer prosa:
//   · tabla de tres columnas, no párrafos
//   · la flecha marca UN renglón, no todos los que difieren de cero
//   · los movimientos son los DE ESE PASO, filtrados por marca de tiempo

const pesos = (n) => (n ?? 0).toLocaleString('es-CO')
const col = (s, ancho) => String(s).padStart(ancho)

export function pintarDescuadre({ paso, modo, comparacion, peticion, respuesta, movimientos, pagos, vistas, organizationId }) {
  const L = []
  L.push('')
  L.push('═'.repeat(72))
  L.push(`DESCUADRE EN  ${paso.id} · ${paso.titulo}   (modo: ${modo})`)
  L.push('═'.repeat(72))
  L.push('')
  L.push('                    ESPERADO       OBTENIDO     DIFERENCIA')

  // El peor renglón lleva la flecha: el de mayor diferencia absoluta.
  const peor = comparacion.descuadres
    .slice().sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))[0]

  for (const f of comparacion.filas) {
    const marca = f === peor || (peor && f.nombre === peor.nombre) ? '  ←── AQUÍ' : ''
    L.push(`${f.nombre.padEnd(16)}${col(pesos(f.esperado), 12)}${col(pesos(f.obtenido), 15)}${col(f.diferencia ? pesos(f.diferencia) : '0', 15)}${marca}`)
  }

  if (peticion) {
    L.push('')
    L.push('EL PASO PIDIÓ:')
    L.push(`  ${peticion.metodo} ${peticion.ruta}`)
    if (peticion.cuerpo) L.push(`  ${JSON.stringify(peticion.cuerpo)}`)
  }

  if (respuesta) {
    L.push('')
    L.push(`EL SERVIDOR CONTESTÓ:  ${respuesta.estado}`)
    const d = respuesta.datos ?? {}
    const interesante = {}
    for (const k of ['montoPagado', 'saldoLiquidado', 'diferenciaEntregada', 'totalAPagar', 'error']) {
      if (d[k] !== undefined) interesante[k] = d[k]
      if (d.prestamo?.[k] !== undefined) interesante[k] = d.prestamo[k]
    }
    L.push(`  ${JSON.stringify(interesante)}`)
  }

  if (paso.esperadoDetalle) {
    L.push('')
    L.push('EL LIBRO ESPERABA:')
    for (const [k, v] of Object.entries(paso.esperadoDetalle)) {
      L.push(`  ${k.padEnd(16)} ${pesos(v)}`)
    }
  }

  L.push('')
  L.push('MOVIMIENTOS DE CAPITAL DE ESTE PASO:')
  if (!movimientos?.length) L.push('  (ninguno)')
  for (const m of movimientos ?? []) {
    L.push(`  ${String(m.tipo).padEnd(14)} ${col(pesos(m.monto), 12)}  ${pesos(m.saldoAnterior)} → ${pesos(m.saldoNuevo)}  «${(m.descripcion ?? '').slice(0, 46)}»`)
  }

  L.push('')
  L.push('PAGOS DE ESTE PASO:')
  if (!pagos?.length) L.push('  (ninguno)')
  for (const p of pagos ?? []) {
    L.push(`  ${String(p.tipo).padEnd(12)} ${col(pesos(p.montoPagado), 12)}  método: ${p.metodoPago ?? 'null (cuenta como efectivo)'}`)
  }

  if (vistas) L.push(...pintarLasTresVistas(vistas))

  L.push('')
  L.push('La organización de prueba SE CONSERVA para que la puedas mirar:')
  L.push(`  ${organizationId}   (barrer con --limpiar)`)
  L.push('')
  return L.join('\n')
}

/* Sale SIEMPRE, cuadre o no: que las tres vistas difieran es un hallazgo del
   encargo aunque el total esté bien. */
export function pintarLasTresVistas(v) {
  const L = ['', 'LOS TRES SITIOS QUE MIRAN AL MISMO COBRADOR:']
  const filas = [
    ['(A) /api/caja?cobradorId', v.A?.recogida, v.A?.gastos, v.A?.desembolsadoDia],
    ['(B) cobradores[] del dueño', v.B?.recaudadoDia, v.B?.gastosDia, v.B?.prestadoDia],
    ['(C) /api/caja/cobrador/[id]', v.C?.resumen?.cobradoDia, v.C?.resumen?.gastosDia, v.C?.resumen?.prestadoDia],
  ]
  L.push('                              cobrado      gastos     prestado')
  for (const [nombre, cob, gas, pre] of filas) {
    L.push(`  ${nombre.padEnd(28)}${col(pesos(cob), 9)}${col(pesos(gas), 12)}${col(pesos(pre), 13)}`)
  }

  const distintos = (a, b, c) => !(a === b && b === c)
  const cobrados = filas.map((f) => Math.round(f[1] ?? 0))
  const gastados = filas.map((f) => Math.round(f[2] ?? 0))
  const prestados = filas.map((f) => Math.round(f[3] ?? 0))

  const avisos = []
  if (distintos(...cobrados)) avisos.push('el COBRADO no coincide entre las tres')
  if (distintos(...gastados)) avisos.push('los GASTOS no coinciden entre las tres')
  if (distintos(...prestados)) avisos.push('lo PRESTADO no coincide entre las tres')

  if (avisos.length) {
    L.push('')
    L.push('  ⚠ DIVERGENCIA ENTRE VISTAS: ' + avisos.join(' · '))
    L.push('    (no es un descuadre de la caja: son tres consultas que cuentan distinto)')
  } else {
    L.push('  → las tres coinciden ✓')
  }
  return L
}

export function pintarPasoOk(paso, comparacion) {
  const t = comparacion.filas.find((f) => f.nombre === 'saldoRealCaja')
  return `  ✓ ${paso.id.padEnd(4)} ${paso.titulo.padEnd(46)} caja: ${pesos(t?.obtenido)}`
}
