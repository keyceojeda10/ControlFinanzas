// ── DE LO QUE DEVUELVE /api/buscar A LO QUE PINTA `BusquedaGlobal` ──
//
// La API devuelve tres listas sueltas —clientes, prestamos, rutas— con los
// campos de la base de datos. `BusquedaGlobal` pinta UNA lista de filas con la
// forma { id, nombre, detalle, iniciales|tipo, estado, href }.
//
// El buscador viejo enseñaba las tres por separado, cada una con su rotulo, y
// con dos resultados por grupo eso son tres titulos para cinco filas. T34-03
// las junta: al que busca «Steven» le da igual si Steven es un cliente o un
// prestamo — quiere llegar a Steven.
//
// El orden es cliente → prestamo → ruta a proposito: se busca a una PERSONA
// muchas mas veces que a una ruta.
import { iniciales } from '@/lib/recientes'

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`

/** El aro del avatar. Es el estado del cliente, no un adorno. */
function aro(estado) {
  if (estado === 'mora' || estado === 'atrasado') return 'rojo'
  if (estado === 'activo' || estado === 'aldia') return 'verde'
  return undefined
}

/**
 * @param resultados  lo que devuelve `/api/buscar`: { clientes, prestamos, rutas }
 * @returns filas para la `Lista` de `BusquedaGlobal`, ya ordenadas
 */
export function aFilasBusqueda(resultados) {
  if (!resultados) return []
  const filas = []
  const prestamos = resultados.prestamos ?? []

  // ── EL MISMO NOMBRE DOS VECES NO SON DOS RESULTADOS ──
  //
  // La API busca por separado en clientes y en prestamos, asi que quien busca
  // «Carlos» recibia DOS filas identicas —«Carlos · 811769507» y «Carlos ·
  // debe $1.700.001»— y tenia que adivinar cual abrir. Justo el ruido que
  // T34-03 queria quitar al juntar las listas.
  //
  // Cuando el prestamo es de un cliente que ya sale, no se añade una fila: se
  // le pone la DEUDA a la suya, que es lo que la lamina enseña debajo del
  // nombre. Y se enlaza al prestamo, que es donde se va a cobrar.
  // Por `clienteId` y no por nombre: dos clientes pueden llamarse igual.
  // Todos los prestamos de cada cliente, no solo uno: si tiene dos y solo se
  // absorbe el mayor, el otro vuelve a salir con su propia fila y el nombre
  // sigue repitiendose. Lo encontro la prueba.
  const prestamosDe = new Map()
  for (const p of prestamos) {
    if (p.clienteId == null) continue
    const suyos = prestamosDe.get(p.clienteId) ?? []
    suyos.push(p)
    prestamosDe.set(p.clienteId, suyos)
  }

  const yaJuntados = new Set()

  for (const c of resultados.clientes ?? []) {
    const suyos = prestamosDe.get(c.id) ?? []
    // Con varios manda el de mas saldo: es el que preocupa.
    const suPrestamo = suyos.reduce(
      (may, p) => (!may || (Number(p.saldoPendiente) || 0) > (Number(may.saldoPendiente) || 0) ? p : may),
      null,
    )
    for (const p of suyos) yaJuntados.add(p.id)

    // La cedula de relleno no es un dato: los clientes importados sin cedula
    // llevan «SIN-xxxx» y enseñarlo debajo del nombre es ruido con formato de
    // documento. Si no hay cedula, manda el telefono.
    const cedula = c.cedula && !String(c.cedula).startsWith('SIN-') ? c.cedula : ''
    const saldo = Number(suPrestamo?.saldoPendiente) || 0
    filas.push({
      id: `cliente-${c.id}`,
      tipo: 'cliente',
      nombre: c.nombre,
      // La deuda manda sobre la cedula: se busca a alguien para saber como va.
      detalle: saldo > 0 ? `debe ${money(saldo)}` : [cedula, c.telefono].filter(Boolean).join(' · '),
      iniciales: iniciales(c.nombre),
      estado: aro(suPrestamo?.estado ?? c.estado),
      href: suPrestamo ? `/prestamos/${suPrestamo.id}` : `/clientes/${c.id}`,
    })
  }

  for (const p of prestamos) {
    if (yaJuntados.has(p.id)) continue
    // El saldo es lo que se quiere saber de un prestamo. Si ya esta saldado se
    // dice, en vez de un «$0 pendiente» que se lee como un error.
    const saldo = Number(p.saldoPendiente) || 0
    filas.push({
      id: `prestamo-${p.id}`,
      tipo: 'prestamo',
      nombre: p.clienteNombre,
      detalle: saldo > 0 ? `debe ${money(saldo)}` : 'préstamo saldado',
      iniciales: iniciales(p.clienteNombre),
      estado: aro(p.estado),
      href: `/prestamos/${p.id}`,
    })
  }

  for (const r of resultados.rutas ?? []) {
    const cuantos = r._count?.clientes ?? 0
    filas.push({
      id: `ruta-${r.id}`,
      tipo: 'ruta',
      nombre: r.nombre,
      // Singular y plural. «1 clientes» en la cara del dueño resta credibilidad
      // a todo lo demas que diga la pantalla.
      detalle: cuantos === 1 ? '1 cliente' : `${cuantos} clientes`,
      href: `/rutas/${r.id}`,
    })
  }

  return filas
}
