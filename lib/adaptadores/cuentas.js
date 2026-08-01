// lib/adaptadores/cuentas.js — T20-01 «Cuentas».
//
// «Si todo entra como efectivo, el conteo físico nunca cuadra»: solo el efectivo
// se cuenta con la mano. Esta pantalla separa lo que entró por cada cuenta para
// que el dueño sepa cuánto DEBERÍA haber en el fajo, y cuánto está en Nequi.
//
// El endpoint devuelve `{ key, nombre, tipoCuenta, entradas, salidas, neto }` por
// cuenta. Aquí se convierte en lo que dibuja el componente, y se toman tres
// decisiones que no son de estilo:
//
//   1. LO QUE SE ENSEÑA ES EL NETO, no las entradas. «Entró $500.000 por Nequi»
//      no dice cuánto hay: si salieron $480.000 desembolsando, quedan $20.000.
//   2. LAS CUENTAS SIN MOVIMIENTO NO SE LISTAN. Una lista de ocho cuentas de las
//      que seis están en cero es una lista donde no se ve la que importa.
//   3. EL EFECTIVO VA PRIMERO Y SIEMPRE, aunque esté en cero. Es la única que se
//      cuenta con la mano, y su ausencia se leería como «no hay efectivo» en vez
//      de «hoy no entró efectivo».

/* Colores de los tramos de la barra. Por posición, no por cuenta: así la barra y
   la leyenda no pueden discrepar. El efectivo siempre es el primero, y por eso
   siempre es el oro — el color más reconocible para lo que se toca. */
const COLORES = ['#F5B824', '#2FBE6A', '#7A6CF0', '#F0575C', '#A3A8B2']

function aNumero(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/* «$1.2M» para la leyenda de la barra, donde no cabe la cifra entera. */
function corto(n, formatear) {
  const v = Math.abs(n)
  if (v >= 1_000_000) {
    const m = n / 1_000_000
    return `$${(Math.round(m * 10) / 10).toString().replace('.', ',')}M`
  }
  return formatear(Math.round(n))
}

export function adaptarCuentas(cuentas = [], formatear = String) {
  const filas = cuentas.filter(Boolean).map((c) => ({
    id: c.key ?? c.id,
    nombre: c.nombre,
    esEfectivo: (c.key ?? c.id) === 'efectivo',
    neto: aNumero(c.neto),
    entradas: aNumero(c.entradas),
    salidas: aNumero(c.salidas),
  }))

  // El efectivo primero y siempre; el resto solo si se movió, de mayor a menor.
  const efectivo = filas.filter((f) => f.esEfectivo)
  const resto = filas
    .filter((f) => !f.esEfectivo && (f.entradas !== 0 || f.salidas !== 0))
    .sort((a, b) => b.neto - a.neto)

  const visibles = [...efectivo, ...resto]
  const total = visibles.reduce((t, f) => t + f.neto, 0)

  // La barra solo reparte lo POSITIVO: una cuenta en negativo no ocupa ancho, y
  // repartir sobre un total con negativos daría tramos que suman más de 100.
  const positivo = visibles.filter((f) => f.neto > 0)
  const sumaPositiva = positivo.reduce((t, f) => t + f.neto, 0)

  return {
    total: formatear(Math.round(total)),
    tramos: sumaPositiva > 0
      ? positivo.map((f, i) => ({
        id: f.id,
        porcentaje: (f.neto / sumaPositiva) * 100,
        color: COLORES[i % COLORES.length],
        etiqueta: f.nombre,
        corto: corto(f.neto, formatear),
      }))
      : [],
    cuentas: visibles.map((f, i) => ({
      id: f.id,
      nombre: f.nombre,
      inicial: String(f.nombre ?? '?').trim()[0]?.toUpperCase() ?? '?',
      color: positivo.includes(f) ? COLORES[positivo.indexOf(f) % COLORES.length] : 'var(--cf-border-strong)',
      fondoIcono: f.esEfectivo ? 'var(--cf-gold-tint)' : 'var(--cf-fill)',
      colorIcono: f.esEfectivo ? 'var(--cf-gold-dark)' : 'var(--cf-ink-2)',
      // Entró y salió, en pequeño: es lo que explica por qué el neto es ese.
      detalle: (f.entradas !== 0 || f.salidas !== 0)
        ? `entró ${formatear(Math.round(f.entradas))} · salió ${formatear(Math.round(f.salidas))}`
        : 'sin movimientos',
      saldo: formatear(Math.round(f.neto)),
    })),
    numeros: { total: Math.round(total) },
  }
}
