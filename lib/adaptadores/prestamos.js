// lib/adaptadores/prestamos.js — entre /api/prestamos y <TarjetaCliente>.
//
// LA TARJETA ES LA MISMA QUE LA DE UN CLIENTE. La adenda es explícita: un
// préstamo en lista no estrena tarjeta. Inventar una segunda obligaría al
// usuario a aprender dos objetos que se leen igual y significan lo mismo:
// alguien que te debe.
//
// Lo único propio del préstamo es qué dice la línea de contexto: en vez de la
// dirección, la cuota y cada cuánto se cobra.

import { abreviarMillones } from '@/lib/adaptadores/ruta'
import { formatMoney } from '@/lib/i18n'
import { DIAS_MORA, etiquetaDe, iniciales, esNuevo, cifraProximoCobro } from '@/lib/adaptadores/clientes'
import { etiquetaModo } from '@/lib/dinero/modos'

/** A partir de acá, un préstamo ya es candidato a renovar. */
export const RENOVAR_DESDE = 80

/**
 * El umbral de mora RELATIVO A LA FRECUENCIA.
 *
 * Lo pide el pie de T42-02: «3 días de atraso es ámbar, no rojo […] en un
 * préstamo quincenal tres días no es mora grave; el color tiene que decir eso».
 *
 * Y tiene razón aritmética: tres días de atraso en un préstamo DIARIO son tres
 * cuotas perdidas; en uno QUINCENAL son la quinta parte de una. El umbral plano
 * de 7 días trataba los dos igual, así que pintaba de rojo a un cliente
 * quincenal que va con un día de retraso sobre su propio ciclo.
 *
 * La regla: es mora grave cuando el atraso pasa de UN PERÍODO completo. En
 * diario y semanal eso son los 7 días de siempre —no cambia nada para el 65% de
 * la cartera— y en quincenal son 15.
 *
 * OJO: esto es para el COLOR de la ficha. El umbral del resto del sistema
 * (`DIAS_MORA`, que usan las listas y el panel) NO se toca: cambiarlo movería
 * conteos que hoy cuadran entre pantallas, y eso es otra tarea con su medición.
 */
export function diasParaMoraGrave(frecuencia) {
  const porPeriodo = { diario: 7, semanal: 7, quincenal: 15, mensual: 30 }
  return porPeriodo[frecuencia] ?? 7
}

/** ¿El atraso es grave, o va corto sobre su propio ciclo? */
export function moraEsGrave(p) {
  return Number(p?.diasMora ?? 0) > diasParaMoraGrave(p?.frecuencia)
}

/**
 * Mismo umbral de mora que la lista de clientes, más los dos estados que solo
 * existen en esta pantalla:
 *
 *   `pagado`  — terminado. Se apaga en gris al 60%, NO se tiñe de verde: el pie
 *               de T02-06 lo dice literal, y es la diferencia entre «va bien» y
 *               «esto ya cerró». En verde, un préstamo cerrado compite por la
 *               atención con uno al día que sí hay que seguir cobrando.
 *   `renovar` — al día y por encima del 80% pagado. Es el mejor momento para
 *               prestar de nuevo, y de ahí sale el crecimiento; la lámina le da
 *               su propia pastilla verde.
 */
export function estadoDe(p) {
  if (p?.estado === 'completado' || Number(p?.saldoPendiente ?? 0) <= 0) return 'pagado'
  const dias = p?.diasMora ?? 0
  if (dias > DIAS_MORA) return 'mora'
  if (dias > 0) return 'atraso'
  if (Number(p?.porcentajePagado ?? 0) >= RENOVAR_DESDE) return 'renovar'
  return 'aldia'
}

/**
 * Qué dice la pastilla. `renovar` y `pagado` NO llevan días: uno es una
 * oportunidad y el otro un cierre, y en ninguno de los dos «0d» significa algo.
 */
export function etiquetaPrestamo(estado, dias) {
  if (estado === 'pagado') return 'Pagado'
  if (estado === 'renovar') return 'Renovar'
  return etiquetaDe(estado, dias)
}

/** «Semanal», «Diario»… con mayúscula, como los escribe la lámina. */
const FRECUENCIA = {
  diario: 'Diario',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}

/**
 * «Semanal 20% · cuota 13 de 24 · Ruta #1».
 *
 * ESTO ERA «$20.000 diarios · Ruta 2», y la diferencia importa: la cuota ya está
 * en la tarjeta —es el monto de la derecha— así que repetirla en la línea de
 * contexto gastaba el sitio dos veces. Lo que NO estaba en ningún lado es la
 * TASA y POR DÓNDE VA: un préstamo al 20% en la cuota 13 de 24 y otro al 15% en
 * la 2 de 24 se veían idénticos.
 *
 * `terminado 12 de jul` en vez de la cuota cuando ya está pagado: decir «cuota 24
 * de 24» de algo cerrado es cierto y no sirve; la fecha sí.
 */
export function contextoDe(p, pais, { pagado = false } = {}) {
  const partes = []

  // EL MODO VA PEGADO A LA TASA, y no es capricho de sitio: el mismo «20%»
  // significa cosas distintas según el modo —mensual, plano o por cobro, hasta
  // 6,6 veces de diferencia— así que una tasa sin su modo al lado es una cifra
  // que no se puede interpretar. El dueño lo pidió con otras palabras: «aparte
  // de decir también en qué modo de interés está creado».
  const frec = FRECUENCIA[p?.frecuencia] || null
  const tasa = Number(p?.tasaInteres ?? 0)
  const modo = p?.modoInteres ? etiquetaModo(p.modoInteres) : null
  if (frec || tasa > 0 || modo) {
    partes.push([frec, tasa > 0 ? `${formatearTasa(tasa)}%` : null, modo]
      .filter(Boolean).join(' '))
  }

  if (pagado) {
    const fin = p?.fechaFin ? fechaCorta(p.fechaFin) : null
    if (fin) partes.push(`terminado ${fin}`)
  }
  // LA CUOTA YA NO VA AQUÍ. Estaba en esta línea cuando el turno 02 no tenía
  // dónde más ponerla; T03-04 la baja al lado de la barra —«cuota 13/24 · 54%»—
  // porque ahí queda junto al avance, que es lo que responde. Ver `avanceDe`.
  // Aquí se queda lo que NO cambia con los pagos: cómo se pactó y dónde se cobra.

  const ruta = p?.cliente?.ruta?.nombre ?? p?.rutaNombre
  if (ruta) partes.push(ruta)

  // QUIÉN LO CREÓ, al final de la línea. Es lo último porque es lo que menos se
  // mira a diario, pero cuando hace falta no hay sustituto: con varios
  // cobradores dando de alta préstamos, «¿quién metió éste?» hoy solo se puede
  // contestar entrando a la ficha. `/api/prestamos` ya lo manda resuelto a
  // nombre (`creadoPorNombre`), así que esto no cuesta una consulta más.
  //
  // Solo el nombre de pila: la línea ya lleva dos cosas y un «creó María
  // Fernanda Gutiérrez» la parte en dos renglones.
  // El `replace` no es cosmético: en la cartera real hay nombres guardados como
  // «JHOAN. PEREZ» y salía «creó JHOAN.», con el punto pegado y en medio de una
  // línea separada por puntos medios. Se ve al mirarlo, no al leer el código.
  const autor = (p?.creadoPorNombre || '').trim().split(/\s+/)[0].replace(/[.,;:]+$/, '')
  if (autor) partes.push(`creó ${autor}`)

  return partes.join(' · ') || null
}

/**
 * LO MISMO, PERO EN PIEZAS. Para pintarlo con icono en vez de puntos medios.
 *
 * `contextoDe` devuelve «Diario 22% Clásico · RUTA. #. 5 · creó JHOAN»: cuatro
 * datos distintos pegados en una cadena, mismo color y mismo peso. El dueño lo
 * dijo: «está muy apretada, le podríamos dar un poco de aire y definirlas mejor».
 * Una cadena ya unida no se puede separar sin volver a partirla por los puntos,
 * y hay rutas guardadas como «RUTA. #. 5» que llevan puntos DENTRO.
 *
 * Así que se compone en piezas desde el origen. La cadena se queda —la usan el
 * buscador y las pantallas que aún no se han migrado— y esto va al lado.
 */
export function piezasDe(p, pais, { pagado = false } = {}) {
  const frec = FRECUENCIA[p?.frecuencia] || null
  const tasa = Number(p?.tasaInteres ?? 0)
  const autor = (p?.creadoPorNombre || '').trim().split(/\s+/)[0].replace(/[.,;:]+$/, '')
  const fin = pagado && p?.fechaFin ? fechaCorta(p.fechaFin) : null

  return {
    // El modo va junto con su frecuencia y su tasa, y NO se separa: el mismo
    // «20%» significa cosas distintas según el modo —hasta 6,6 veces— así que
    // una tasa sin su modo al lado es una cifra que no se puede interpretar.
    modo: (frec || tasa > 0 || p?.modoInteres)
      ? { modo: p?.modoInteres, frecuencia: frec, tasa: tasa > 0 ? `${formatearTasa(tasa)}%` : null }
      : null,
    ruta: p?.cliente?.ruta?.nombre ?? p?.rutaNombre ?? null,
    autor: autor || null,
    terminado: fin,
  }
}

/** «20» y no «20.00»; «7,5» con coma, que es como se escribe en Colombia. */
export function formatearTasa(tasa) {
  const n = Number(tasa)
  if (!Number.isFinite(n)) return ''
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',')
}

/** «12 de jul». Corta a propósito: la línea ya lleva dos cosas más. */
export function fechaCorta(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  // El «de» que mete el ICU nuevo. Ver la nota larga en `clientes.js`.
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
    .replace('.', '').replace(' de ', ' ')
}

/**
 * Lo que va a la derecha del monto: «de $1.200.000 · 54% pagado».
 *
 * Sin el total, el saldo no significa nada: $160.000 pendientes puede ser un
 * préstamo de $1.200.000 casi saldado o uno de $200.000 recién entregado, y son
 * dos decisiones opuestas sobre si vale la pena ir hoy.
 *
 * Si no hay total —no debería, pero el pago único y los legacy dan sorpresas— se
 * cae al porcentaje solo en vez de escribir «de $0».
 */
export function detalleDe(p, pais) {
  const total = Number(p?.totalAPagar ?? 0)
  const pct = Math.min(100, Math.max(0, Math.round(p?.porcentajePagado ?? 0)))
  if (!(total > 0)) return `${pct}% pagado`
  return `de ${formatMoney(total, pais)} · ${pct}% pagado`
}

/** Solo el total: «de $1.200.000». Sin él, un saldo no significa nada. */
export function totalDe(p, pais) {
  const total = Number(p?.totalAPagar ?? 0)
  return total > 0 ? `de ${formatMoney(total, pais)}` : null
}

/**
 * «cuota 13/24 · 54%», al lado de la barra.
 *
 * Con barra 13/24 y 54% dicen cosas distintas y las dos hacen falta: por dónde
 * va el CALENDARIO y por dónde va la PLATA. Un préstamo en la cuota 20 de 24 con
 * el 60% pagado va tarde aunque la barra parezca avanzada.
 */
export function avanceDe(p) {
  const pct = Math.min(100, Math.max(0, Math.round(p?.porcentajePagado ?? 0)))
  const total = Number(p?.totalCuotas ?? 0)
  const pend = Number(p?.cuotasPendientes ?? 0)
  if (!(total > 0) || !(pend >= 0)) return `${pct}%`
  const actual = Math.min(total, Math.max(1, total - pend + 1))
  return `cuota ${actual}/${total} · ${pct}%`
}

/**
 * La tira de cuatro columnas de T03-04: CUOTA · ATRASO · GANANCIA · VENCE.
 *
 * ⚠ GANANCIA NO ESTÁ, Y ES A PROPÓSITO. La lámina la pide y es la columna que su
 * pie llama «la razón de ser del préstamo», pero la ganancia de un préstamo es
 * el INTERÉS COBRADO —no lo recaudado— y ese número no viene hoy en la fila que
 * manda `/api/prestamos`. Derivarlo aquí a ojo es exactamente el error que ya
 * infló las analíticas 7,9 veces. Sale en cuanto la API lo mande medido.
 *
 * Las tres que sí están son ciertas: la cuota es columna, el atraso lo calcula
 * `calcularMontoEnMora` en el servidor con los festivos de la organización, y el
 * vencimiento es `fechaFin`.
 */
export function cifrasDe(p, pais) {
  const cifras = []

  const cuota = Number(p?.cuotaDiaria ?? 0)
  if (cuota > 0) cifras.push({ etiqueta: 'Cuota', valor: formatMoney(cuota, pais) })

  // Se enseña SIEMPRE que el préstamo esté vivo, aunque sea $0: una columna que
  // aparece y desaparece obliga a releer la tira en cada tarjeta, y un «$0» es
  // justo lo que se quiere ver de un cliente al día.
  const mora = Number(p?.montoEnMora ?? 0)
  if (p?.montoEnMora != null) {
    cifras.push({ etiqueta: 'Atraso', valor: formatMoney(mora, pais), tono: mora > 0 ? 'contra' : undefined })
  }

  /* ── «COBRA EL», QUE ERA LA QUE FALTABA ──
     La tira decía CUOTA · ATRASO · VENCE, y el dueño lo puso en palabras: el
     vencimiento «puede que sea un dato relevante, pero no lo es tanto como qué
     día hay que cobrar a ese préstamo en específico».

     Tiene razón, y además era asimétrico: la tarjeta de CLIENTE sí decía
     «cobra el» —ahí es el mínimo de varios préstamos, o sea justo donde peor se
     interpreta— y la de préstamo, donde el dato es exacto y accionable, no lo
     decía. El día de cobro es de cada préstamo, no de la persona.

     `proximoCobroTexto` es la misma función que usa la lista de clientes: «hoy»,
     «vencido» o «12 ago». No se duplica para que las dos pantallas no acaben
     diciendo días distintos del mismo préstamo.

     VENCE NO SE PIERDE: baja al desplegable. Sigue diciendo cuándo se acaba el
     calendario pactado, pero deja de competir por la tira con el que se mira
     cada día. */
  /* El rótulo lo decide `cifraProximoCobro`: «COBRA hoy», «VENCIÓ EL 14 jul» o
     «COBRA EL 19 ago». Con uno fijo salía «COBRA EL vencido», que ni se dice ni
     informa — esconde el día en que venció. */
  const prox = cifraProximoCobro(p)
  if (prox) cifras.push(prox)

  const fin = p?.fechaFin ? fechaCorta(p.fechaFin) : null
  /* ── «VENCE» SOLO CUANDO NO HAY DÍA DE COBRO ────────────────────────────
     Es lo que pidió el dueño —«qué día vence puede que sea un dato relevante,
     pero no lo es tanto como qué día hay que cobrar»— y además NO CABEN LAS
     CUATRO. Medido en el espejo con las dos puestas: la tira quedaba a 74px
     por columna y «$140.000» pedía 76, así que la cuota salía recortada en las
     cuatro fichas a la vez. Con tres columnas quedan ~100px y entra todo.

     El vencimiento no se pierde: baja al desglose largo del desplegable, junto
     con lo prestado, lo pagado y el capital que sigue afuera. Y cuando NO hay
     próximo cobro —un préstamo cerrado, o uno sin calendario— la tercera
     columna queda libre y «Vence» la ocupa: la tira nunca se queda en dos. */
  /* ⚠ Y NUNCA JUNTO A «VENCIÓ EL». Salieron las dos en un clavo —«VENCIÓ EL
     6 ago» al lado de «VENCE 4 ago»— y eso se lee como una contradicción: dos
     palabras casi iguales con dos fechas distintas. Son ciertas las dos (una es
     el cobro que se pasó, la otra el fin del plazo) pero puestas juntas nadie
     las distingue. Cuando ya venció, el calendario pactado no aporta nada: está
     en el desglose. */
  const yaVencio = prox?.etiqueta === 'Venció el'
  if (fin && !yaVencio && cifras.length < 3) cifras.push({ etiqueta: 'Vence', valor: fin })

  return cifras.length ? cifras : undefined
}

/* ══ EL DESPLEGABLE ═════════════════════════════════════════
 *
 * Dos quejas distintas con la misma raíz, y por eso una sola pieza:
 *
 *   · en la tarjeta de CLIENTE — «dice tres préstamos, pero no hay ningún
 *     desplegable que saque estadísticas de cuál es el estado de esos tres sin
 *     necesidad de meterse dentro del cliente»
 *   · en la de PRÉSTAMO — «un desplegable que tenga un desglose mucho más
 *     bonito sin necesidad de entrar al préstamo»
 *
 * La raíz es que la tira de cuatro columnas es un TITULAR, y debajo del titular
 * no había nada: para saber por qué un cliente está en mora había que abrir su
 * ficha, y para ver cómo se reparte la plata de un préstamo, la suya.
 *
 * `fichaDe` compone UN préstamo. La tarjeta de cliente pinta una por cada uno;
 * la de préstamo pinta la del suyo, con el desglose largo. Misma pieza y mismos
 * números: si fueran dos, el «saldo» de una y el de la otra se separarían sin
 * que nadie lo notara — que es justo lo que pasó con el comprobante. */

/** El título de la ficha: «Diario 20% Clásico». Lo que se pactó, en una línea. */
export function tituloDe(p) {
  const frec = FRECUENCIA[p?.frecuencia] || null
  const tasa = Number(p?.tasaInteres ?? 0)
  const modo = p?.modoInteres ? etiquetaModo(p.modoInteres) : null
  return [frec, tasa > 0 ? `${formatearTasa(tasa)}%` : null, modo].filter(Boolean).join(' ') || 'Préstamo'
}

/**
 * UN préstamo, listo para pintar dentro del desplegable.
 *
 * `largo` añade el desglose de la plata —prestado, total, pagado, capital
 * afuera, último pago—. Va en la tarjeta de PRÉSTAMO, donde el desplegable
 * habla de uno solo y hay sitio; en la de cliente serían seis renglones por cada
 * crédito y el desplegable dejaría de leerse de una pasada.
 */
export function fichaDe(p, pais, { largo = false } = {}) {
  const estado = estadoDe(p)
  const total = Number(p?.totalAPagar ?? 0)
  const saldo = Math.max(0, Number(p?.saldoPendiente ?? 0))
  const pagado = Math.max(0, total - saldo)
  const sinCuotas = !(p?.cuotaDiaria > 0)

  const ficha = {
    id: p?.id,
    titulo: tituloDe(p),
    // «desde 5 feb». Sin esto, tres préstamos del mismo cliente con la misma
    // frecuencia y la misma tasa se leen como tres copias del mismo.
    desde: p?.fechaInicio ? fechaCorta(p.fechaInicio) : null,
    estado,
    etiqueta: etiquetaPrestamo(estado, p?.diasMora),
    clavo: !!p?.esClavo,
    // LO QUE FALTA, no lo pagado. Arriba, en la tarjeta, va lo pagado —para que
    // un préstamo recién creado no se lea como saldado— y aquí, con el
    // desplegable abierto, la pregunta es la contraria: cuánto queda por cobrar.
    falta: formatMoney(saldo, pais),
    total: total > 0 ? `de ${formatMoney(total, pais)}` : null,
    porcentaje: Math.min(100, Math.max(0, Math.round(p?.porcentajePagado ?? 0))),
    avance: sinCuotas ? 'pago único' : avanceDe(p),
    sinProgreso: sinCuotas,
    cifras: cifrasDe(p, pais),
  }

  if (!largo) return ficha

  /* ── ⚠ EN LA TARJETA DE PRÉSTAMO, LA CABECERA SOBRA ──
     Medido abriéndolo en el espejo: el desplegable repetía el título («Diario
     22% Clásico»), la pastilla («3d») y la tira entera (CUOTA · ATRASO · COBRA
     EL) que estaban dos centímetros más arriba, en la propia tarjeta. Tres
     copias del mismo dato en la misma pantalla.

     Ahí el desplegable existe para lo que NO está arriba: cómo se reparte la
     plata. Así que se queda solo con eso, y lo que la cabecera sí aportaba —la
     fecha de inicio— baja como un renglón más.

     En la tarjeta de CLIENTE es al revés: allí arriba no hay nada de ese
     préstamo, así que la cabecera es la información. */
  const lineas = []
  if (ficha.desde) lineas.push({ rotulo: 'Empezó', valor: ficha.desde })
  const prestado = Number(p?.montoPrestado ?? 0)
  if (prestado > 0) lineas.push({ rotulo: 'Prestado', valor: formatMoney(prestado, pais) })
  if (total > 0) lineas.push({ rotulo: 'Total a pagar', valor: formatMoney(total, pais) })
  lineas.push({ rotulo: 'Ya pagó', valor: formatMoney(pagado, pais), tono: pagado > 0 ? 'favor' : undefined })
  lineas.push({ rotulo: 'Le falta', valor: formatMoney(saldo, pais), fuerte: true })
  /* ── CAPITAL AFUERA, Y NO «GANANCIA» ──
     La lámina pide una columna de ganancia y sigue sin estar, por lo mismo que
     ya explica `cifrasDe`: la ganancia de un préstamo es el INTERÉS COBRADO, no
     lo recaudado, y ese número no viene medido en la fila. Derivarlo a ojo aquí
     es el error que infló las analíticas 7,9 veces.

     Lo que SÍ está medido es `calcularCapitalRestante`: cuánto de MI plata sigue
     afuera. Contesta la pregunta de al lado —«si me pagan todo hoy, cuánto
     recupero de lo que puse»— y esa sí es cierta. */
  if (p?.capitalRestante != null) {
    lineas.push({ rotulo: 'Capital afuera', valor: formatMoney(Number(p.capitalRestante), pais) })
  }
  const fin = p?.fechaFin ? fechaCorta(p.fechaFin) : null
  if (fin) lineas.push({ rotulo: 'Vence', valor: fin })
  const ult = p?.ultimoPagoAt ? fechaCorta(p.ultimoPagoAt) : null
  /* «Sin pagos aún» EN GRIS, no en rojo. El mismo dato pintado en rojo en 203
     filas fue un fallo real: la relación `pagos` llevaba un `where` de HOY y
     «último pago» salía `null` siempre. */
  lineas.push({ rotulo: 'Último pago', valor: ult || 'sin pagos aún', apagado: !ult })

  return { ...ficha, lineas, sinCabecera: true }
}

/**
 * El desplegable de la tarjeta de CLIENTE: una ficha por préstamo.
 *
 * Va en el orden que manda la API —el que se cobra antes, primero— porque
 * abierto, lo primero que se lee tiene que ser a cuál hay que ir hoy.
 */
export function desgloseDe(prestamos = [], pais) {
  const lista = (prestamos || []).filter(Boolean)
  if (!lista.length) return null
  return {
    rotulo: lista.length === 1 ? 'Ver el préstamo' : `Ver los ${lista.length} préstamos`,
    prestamos: lista.map((p) => fichaDe(p, pais)),
  }
}

export function adaptarPrestamos(prestamos = [], pais) {
  return (prestamos || []).map((p) => {
    const estado = estadoDe(p)
    // El pago único no tiene cuotas: marcaría 0% durante todo el plazo, y una
    // lista llena de barras vacías es una alarma falsa. Se le quita la barra.
    const sinCuotas = !(p.cuotaDiaria > 0)
    return {
      id: p.id,
      nombre: p.cliente?.nombre ?? 'Sin cliente',
      iniciales: iniciales(p.cliente?.nombre),
      // T02-06 dibuja esta tarjeta SIN avatar y SIN rótulo sobre el monto: el
      // dueño ya sabe de quién es, y ese ancho se lo lleva la línea de
      // condiciones, que es más larga que la de un cliente. Las iniciales
      // siguen viajando por si la consume otra pantalla que sí las use.
      variante: 'prestamo',
      estado,
      etiquetaEstado: etiquetaPrestamo(estado, p.diasMora),
      // CUÁL de los préstamos es el perdido. Sin esto, la lista de préstamos y
      // la ficha del cliente enseñaban dos filas idénticas y había que abrir
      // las dos para saberlo.
      clavo: !!p.esClavo,
      // NUEVO: creado en las últimas 24 horas. Los clientes ya lo tenían y los
      // préstamos no, así que un préstamo recién metido no se distinguía en la
      // lista de los mil que llevan meses. Es la misma función, para que las dos
      // pantallas no acaben con dos definiciones de «nuevo».
      nuevo: esNuevo(p),
      contexto: contextoDe(p, pais, { pagado: estado === 'pagado' }),
      // Lo mismo en piezas, para pintarlo con icono. La cadena se queda porque
      // la usa el buscador y las pantallas sin migrar.
      piezas: piezasDe(p, pais, { pagado: estado === 'pagado' }),
      // ⚠ LO PAGADO, NO LO PENDIENTE.
      //
      // Aquí iba `saldoPendiente`, así que un préstamo RECIÉN CREADO salía como
      // «$1.800.000 de $1.800.000». Es cierto —debe 1,8 de 1,8— pero se lee al
      // revés: como que ya pagó todo. El dueño lo reportó con esas palabras:
      // «se entiende como que ya pagó… y no es así, es un préstamo nuevo y no
      // ha pagado nada; debería salir cero de un millón ochocientos».
      //
      // Con lo pagado arriba, el par se lee solo y en la misma dirección que la
      // barra de abajo: «$0 de $1.800.000», 0%. Antes la cifra decía una cosa y
      // la barra la contraria.
      monto: formatMoney(Math.max(0, (Number(p.totalAPagar) || 0) - (Number(p.saldoPendiente) || 0)), pais),
      // Solo «de $1.200.000». El porcentaje se fue de aquí: T03-04 lo baja
      // junto a la barra, con la cuota exacta al lado.
      detalle: totalDe(p, pais),
      cifras: cifrasDe(p, pais),
      porcentaje: Math.min(100, Math.max(0, Math.round(p.porcentajePagado ?? 0))),
      avance: avanceDe(p),
      sinProgreso: sinCuotas,
      nota: sinCuotas ? 'pago único' : undefined,
    }
  })
}

/**
 * Las tres cifras de arriba en T02-06: EN LA CALLE · EN MORA · COBRADO MES.
 *
 * Responden lo que la lista NO puede: recorriendo 68 tarjetas no se sabe cuánto
 * hay en total en la calle ni cuánto está atascado.
 *
 * SE SUMA SOBRE LA PÁGINA QUE SE ESTÁ VIENDO cuando no hay totales del servidor,
 * y en ese caso hay que decirlo — un «$38.4M» que en realidad es la suma de 50
 * de 68 préstamos es exactamente la clase de cifra que hace desconfiar de la app
 * entera. Por eso `parcial`.
 *
 * `cobradoMes` no se puede derivar de la lista: es del resumen del dashboard. Se
 * omite si no llega, en vez de poner un $0 que se leería como «no cobré nada».
 */
export function tresCifras(prestamos = [], pais, { totales = null, cobradoMes = null } = {}) {
  const lista = prestamos || []
  const enLaCalle = totales?.saldoPorCobrar
    ?? lista.reduce((s, p) => s + Number(p.saldoPendiente ?? 0), 0)
  const enMora = totales?.saldoEnMora
    ?? lista.filter((p) => Number(p.diasMora ?? 0) > 0)
            .reduce((s, p) => s + Number(p.saldoPendiente ?? 0), 0)

  // ── SE SALIAN DE LA CAJA, Y LO DIGO MEDIDO ──
  //
  // Tres tarjetas en 390px son 110px cada una, y con su relleno quedan 82 de
  // hueco util. «$8.573.659» a cuerpo 19 necesita 100: se salia 18px por la
  // derecha, y las TRES a la vez. El usuario lo vio antes que yo.
  //
  // Se abrevia por encima del millon, igual que en reportes y por la misma
  // razon: ocho millones se leen igual de bien como «$8,6M», y la cifra exacta
  // esta en la tarjeta de cada prestamo, debajo. Recortar con puntos suspensivos
  // no vale — una cifra de plata a medias es peor que una redondeada.
  const cifra = (n) => abreviarMillones(n, (v) => formatMoney(v, pais))

  return {
    enLaCalle: cifra(enLaCalle),
    enMora: cifra(enMora > 0 ? enMora : 0),
    cobradoMes: cobradoMes != null ? cifra(cobradoMes) : null,
    parcial: !totales,
  }
}
