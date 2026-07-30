// lib/adaptadores/pago.js — el bloque «después de este pago» de T02-04 y T08-01.
//
// LO NUEVO DE LA PANTALLA. El pie de T02-04 lo dice así:
//
//   «Lo nuevo es el bloque "después de este pago": el usuario ve el saldo y el
//    estado resultante antes de confirmar.»
//
// Y el de T08-01, sobre la fila del medio:
//
//   «Al elegir Nequi o Daviplata el pago se marca como digital y no suma al
//    efectivo que el cobrador tiene que entregar. La línea "entra a caja como" lo
//    confirma antes de guardar.»
//
// ── DOS REGLAS QUE NO SE ROMPEN ─────────────────────────────────────────────
//
// 1 · NO SE RECALCULA EL CALENDARIO. La fecha del próximo cobro viene tal cual de
//     la API, que la saca de `calcularProximoCobro`. Volver a derivarla aquí sería
//     la CUARTA función que responde a esa pregunta —ya hay tres que se
//     contradicen entre la tarjeta, el agrupador y el KPI— y encima en la pantalla
//     donde una fecha equivocada se convierte en un cobro perdido.
//
// 2 · ES UNA PROYECCIÓN, Y SE ESCRIBE COMO TAL. Lo que de verdad pasa lo decide
//     el servidor cuando entra el pago: la cascada de reparto, el recálculo de la
//     tabla en decreciente dinámico, la mora efectiva con festivos y días
//     excluidos. Aquí sólo se resta sobre las cifras que la API YA calculó
//     (`saldoPendiente`, `montoEnMora`, `montoParaPonerseAlDia`, `diasMora`), y
//     ninguna fila se enseña si su dato de partida no llegó. Un «quedará al día»
//     inventado es peor que no decir nada.

import { formatMoney } from '@/lib/i18n'

/** Días de calendario que cubre UNA cuota, según la frecuencia. En un préstamo
    diario pagar una cuota quita un día de atraso; en uno quincenal, quince. */
const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

/**
 * Cuánto BAJA la deuda con este pago, que no siempre es el monto recibido.
 *
 * - `completo` / `parcial` / `intereses`: entra plata y el saldo baja lo pagado.
 * - `capital`: entra plata y baja capital. El saldo total baja igual, pero el
 *   reparto por dentro es otro — y ese reparto lo hace el servidor, no esto.
 * - `descuento`: NO entra plata y la deuda baja. Es un perdón, no un cobro.
 * - `recargo`: NO entra plata y la deuda SUBE. Es el 75% de los ajustes, así que
 *   tratarlo como los demás pondría el signo al revés justo en el caso más común.
 */
export function efectoSobreLaDeuda(tipo, monto) {
  const m = Math.max(0, Number(monto) || 0)
  if (tipo === 'recargo') return +m
  return -m
}

/** ¿Este tipo mete plata en la caja? Un recargo y un descuento no: mueven la
    deuda en los papeles y nadie entrega ni recibe un billete. */
export function entraPlata(tipo) {
  return !['recargo', 'descuento'].includes(tipo)
}

/**
 * El bloque «después de este pago».
 *
 * @param p        el préstamo tal como lo devuelve /api/prestamos/[id]
 * @param entrada  { monto, tipo, metodoPago, nombreCuenta, cobrador }
 * @param pais     para `formatMoney`
 * @returns { filas: [{ etiqueta, antes?, valor, tono? }], hayAlgo }
 */
export function adaptarDespuesDelPago(p, entrada = {}, pais) {
  const monto = Math.max(0, Number(entrada.monto) || 0)
  const tipo = entrada.tipo || 'completo'
  const saldoAntes = Number(p?.saldoPendiente ?? NaN)
  const filas = []

  // ── Saldo pendiente: la cifra vieja tachada y la nueva al lado ──
  // Sin el «antes» tachado, el dueño ve un número y no sabe si mejoró.
  if (Number.isFinite(saldoAntes)) {
    const saldoDespues = Math.max(0, saldoAntes + efectoSobreLaDeuda(tipo, monto))
    filas.push({
      clave: 'saldo',
      etiqueta: 'Saldo pendiente',
      antes: formatMoney(Math.round(saldoAntes), pais),
      valor: formatMoney(Math.round(saldoDespues), pais),
      // Cuando queda en cero el préstamo se salda, y eso merece decirse: es la
      // diferencia entre «cobré» y «terminé con este cliente».
      nota: saldoDespues === 0 && monto > 0 ? 'Queda saldado' : null,
    })
  }

  // ── Entra a caja como (T08-01) ──
  // Es la fila que evita el descuadre del cobrador: un pago por Nequi NO suma al
  // efectivo que tiene que entregar, y sin decirlo aquí se entera al cerrar caja.
  if (entraPlata(tipo)) {
    const digital = entrada.metodoPago === 'transferencia'
    filas.push({
      clave: 'caja',
      etiqueta: 'Entra a caja como',
      valor: [
        digital ? (entrada.nombreCuenta || 'Transferencia') : 'Efectivo',
        entrada.cobrador,
      ].filter(Boolean).join(' · '),
      // El aviso solo en digital: en efectivo no hay nada que aclarar.
      nota: digital ? 'No suma al efectivo que entregas' : null,
    })
  }

  // ── Próximo cobro: TAL CUAL viene de la API, y solo si es FUTURO ──
  //
  // La fecha viene ya formateada de fuera; aquí no se recalcula. Pero sí se calla
  // cuando ya pasó: en un préstamo con 58 días de mora, `proximoCobro` apunta al
  // primer cobro impagado, y la fila salía diciendo «Próximo cobro: lun, 1 de jun»
  // en pleno julio. Este bloque proyecta el DESPUÉS, y una fecha que ya pasó no es
  // el después de nada. El atraso ya lo cuenta la fila de estado.
  if (entrada.proximoCobroTexto && entrada.proximoCobroFuturo !== false) {
    filas.push({ clave: 'proximo', etiqueta: 'Próximo cobro', valor: entrada.proximoCobroTexto })
  }

  // ── Estado ──
  const estado = estadoDespues(p, monto, tipo)
  if (estado) filas.push({ clave: 'estado', etiqueta: 'Estado', valor: estado.texto, tono: estado.tono })

  return { filas, hayAlgo: filas.length > 0 }
}

/**
 * El estado en que queda el préstamo. Se decide por PLATA, no por días: los días
 * se derivan solo para redactar la frase.
 *
 *   monto ≥ montoParaPonerseAlDia  →  al día
 *   monto ≥ montoEnMora            →  la mora se cubre, pero falta la cuota de hoy
 *   si no                          →  sigue atrasado, y se dice cuánto
 *
 * Devuelve `null` si la API no mandó las cifras de mora: sin ellas cualquier
 * frase sería inventada, y ésta es la línea que el cobrador lee para decidir si
 * insiste o se va.
 */
export function estadoDespues(p, monto, tipo = 'completo') {
  const diasMora = Number(p?.diasMora ?? 0)
  if (!(diasMora > 0)) return null
  // Un recargo o un descuento no toca la mora: mueven la deuda, no el atraso.
  if (!entraPlata(tipo)) return { texto: `Sigue con ${diasMora}d de atraso`, tono: 'atraso' }

  const alDia = Number(p?.montoParaPonerseAlDia ?? NaN)
  const enMora = Number(p?.montoEnMora ?? NaN)
  if (!Number.isFinite(alDia) && !Number.isFinite(enMora)) return null

  if (Number.isFinite(alDia) && monto >= alDia && alDia > 0) {
    return { texto: 'Queda al día', tono: 'aldia' }
  }
  if (Number.isFinite(enMora) && monto >= enMora && enMora > 0) {
    return { texto: 'Cubre la mora, falta la cuota de hoy', tono: 'atraso' }
  }

  // Cuántos días de atraso quedan. La cuenta es la de la lámina: pagar una cuota
  // en un préstamo diario quita un día («36d mora» + cuota de $12.000 →«Sigue con
  // 35d de atraso»). Se ordena por lo alto para no prometer de menos.
  const cuota = Number(p?.cuotaDiaria ?? 0)
  const porPeriodo = DIAS_POR_PERIODO[p?.frecuencia] ?? 1
  const cubiertas = cuota > 0 ? Math.floor(monto / cuota) : 0
  const quedan = Math.max(0, diasMora - cubiertas * porPeriodo)
  if (quedan === 0) return { texto: 'Queda al día', tono: 'aldia' }
  return {
    texto: `Sigue con ${quedan}d de atraso`,
    // Más de una semana de atraso es mora grave y va en rojo; menos, ámbar. Es el
    // mismo umbral que el resto del sistema, no uno nuevo para esta pantalla.
    tono: quedan > 7 ? 'mora' : 'atraso',
  }
}

/**
 * Los tres atajos de monto: «Cuota», «Mitad», «Todo».
 *
 * NINGUNO PASA DEL SALDO. Ofrecer «cuota $12.000» en un préstamo al que le quedan
 * $4.000 invita a cobrar de más, y la app tendría que rechazarlo después de que el
 * cliente ya entregó la plata.
 */
export function atajosDeMonto(p, pais) {
  const saldo = Math.max(0, Math.round(Number(p?.saldoPendiente ?? 0)))
  const cuota = Math.max(0, Math.round(Number(p?.cuotaDiaria ?? 0)))
  const atajos = []
  if (cuota > 0 && saldo > 0) {
    atajos.push({ id: 'cuota', etiqueta: 'Cuota', monto: Math.min(cuota, saldo) })
  }
  if (saldo > 1) {
    // La mitad redondeada a $100, como todo el dinero de este sistema.
    atajos.push({ id: 'mitad', etiqueta: 'Mitad', monto: Math.round(saldo / 2 / 100) * 100 })
  }
  if (saldo > 0) {
    atajos.push({ id: 'todo', etiqueta: 'Todo', monto: saldo })
  }
  // Si la cuota YA es el saldo entero, «Cuota» y «Todo» son el mismo botón con dos
  // nombres: se queda uno. Dos atajos idénticos hacen dudar de cuál es el bueno.
  const vistos = new Set()
  return atajos.filter((a) => {
    if (vistos.has(a.monto)) return false
    vistos.add(a.monto)
    return true
  }).map((a) => ({ ...a, texto: formatMoney(a.monto, pais) }))
}

/**
 * Las casillas de «¿Cómo te pagó?» (T08-01).
 *
 * NO SON NEQUI Y DAVIPLATA. La lámina dibuja «Efectivo · Nequi · Daviplata ·
 * Banco», que es Colombia; en el modelo real `MetodoPago` es una lista POR
 * ORGANIZACIÓN y el sistema atiende 12 países. Con la lista fija, un negocio de
 * Perú vería dos cuentas que no tiene y ninguna de las suyas.
 *
 * Efectivo va SIEMPRE primero y es el que viene marcado: «el 90% de los casos»,
 * dice el pie. Del resto se saca la inicial para el círculo, y el color de marca
 * de `getPlataformaInfo` cuando la cuenta se llama como una plataforma conocida —
 * la misma función que ya colorea el desglose de la caja, para que Nequi sea del
 * mismo violeta en las dos pantallas.
 *
 * @param metodosPago  las cuentas de la org: [{ id, nombre }]
 * @param colorDe      (nombre) => color de marca, o null. Se inyecta para que este
 *                     archivo no importe un componente de UI.
 * @param limite       cuántas caben en la fila. La lámina dibuja cuatro de 60px en
 *                     390 de ancho; con seis, cada nombre se corta.
 */
export function mediosParaHoja(metodosPago = [], colorDe, limite = 4) {
  const cuentas = (Array.isArray(metodosPago) ? metodosPago : [])
    .filter((m) => m?.id && m?.nombre)
    .slice(0, Math.max(0, limite - 1))
    .map((m) => ({
      id: m.id,
      nombre: m.nombre,
      // La inicial, en mayúscula y sin acentos raros. Es lo que hace que esto
      // funcione con «Bancolombia», «Yape» o «Mercado Pago» sin una lista fija.
      inicial: String(m.nombre).trim().charAt(0).toUpperCase(),
      color: colorDe?.(m.nombre) || null,
      transferencia: true,
    }))

  return [{ id: 'efectivo', nombre: 'Efectivo', efectivo: true, transferencia: false }, ...cuentas]
}

/** El medio elegido, traducido a lo que guarda la DB: `metodoPago` es
    `'efectivo' | 'transferencia'` y `metodoPagoId` apunta a la cuenta. Son dos
    campos, no uno, y confundirlos descuadra la caja por cuenta. */
export function medioAGuardar(medios, idElegido) {
  const m = medios.find((x) => x.id === idElegido)
  if (!m || m.efectivo) return { metodoPago: 'efectivo', metodoPagoId: null, nombreCuenta: null }
  return { metodoPago: 'transferencia', metodoPagoId: m.id, nombreCuenta: m.nombre }
}

/* ── El monto MIENTRAS SE ESCRIBE ────────────────────────────────────────────
   El campo enseñaba «20000». La lámina dice «27.500», y con seis cifras seguidas
   —«1250000»— nadie distingue un millón doscientos cincuenta mil de ciento
   veinticinco mil, que es un factor de diez en la pantalla que registra la plata.

   Van DOS funciones y no una porque el estado guarda el número CRUDO: quien lo
   envía hace `Number(monto)`, y con puntos dentro eso da `NaN`. Así que se formatea
   para verlo y se limpia para guardarlo. */

/** Los dígitos, y nada más. Es lo que va al estado y al servidor. */
export function montoCrudo(texto) {
  return String(texto ?? '').replace(/\D/g, '')
}

/** Con separador de miles del país. `toLocaleString` en vez de una expresión
    regular a mano: en Colombia el separador es el punto, en Perú también, y en
    Estados Unidos la coma. Escribirlo a mano lo dejaría en punto para los 12. */
export function montoParaMostrar(texto, pais) {
  const crudo = montoCrudo(texto)
  if (!crudo) return ''
  const n = Number(crudo)
  if (!Number.isFinite(n)) return crudo
  // Se pasa por `formatMoney` y se le quita el símbolo: así el agrupado es
  // EXACTAMENTE el de las cifras de al lado, en vez de un locale parecido.
  return formatMoney(n, pais).replace(/[^\d.,\s]/g, '').trim()
}
