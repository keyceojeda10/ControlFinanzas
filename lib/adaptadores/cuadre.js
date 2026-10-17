// lib/adaptadores/cuadre.js — T33. Cuadrar el efectivo de un cobrador.
//
// El administrador cuenta el fajo que le entrega el cobrador y lo compara con lo
// que dice el sistema. Es el momento del día en que una persona le entrega dinero
// a otra, así que la pantalla tiene dos trabajos: que la diferencia se vea, y que
// no se registre sin motivo.
//
// ══ SOBRAR TAMBIÉN ES UN DESCUADRE, PERO NO ES UNA PÉRDIDA ══════════════════
//
// Falta → rojo. Sobra → ámbar. Las dos hay que explicarlas —si sobra, hay un cobro
// sin anotar—, pero pintar un sobrante en rojo hace que se registre a la ligera
// para quitarlo de en medio, y ese cobro sin anotar nunca aparece.

function aNumero(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/* La diferencia, con su proporción y su pista.
   «No cuadra» es un callejón; «es el 4% de lo recaudado» dice si hay que buscar un
   error de conteo o un billete perdido. */
export function diferenciaDeCuadre({ sistema, contado } = {}, formatear = String) {
  const esperado = aNumero(sistema)
  const real = aNumero(contado)
  const dif = real - esperado
  if (dif === 0) return null

  const sobra = dif > 0
  const proporcion = esperado > 0
    ? `${Math.round((Math.abs(dif) / esperado) * 100)}% de lo recaudado`
    : null

  return {
    etiqueta: sobra ? 'Sobra' : 'Falta',
    // Sin signo: la etiqueta ya dice de qué lado está, y un «−$5.000» debajo de
    // la palabra «Falta» se lee dos veces.
    monto: formatear(Math.abs(Math.round(dif))),
    tono: sobra ? 'sobra' : 'falta',
    proporcion,
    numeros: { diferencia: Math.round(dif) },
  }
}

/* LAS CAUSAS TÍPICAS, como botones y no como un campo vacío.
   Un «motivo (opcional)» en blanco se deja en blanco: el administrador tiene ocho
   cobradores esperando. Con las cuatro causas reales a un toque, la diferencia
   queda explicada — y una diferencia explicada es la que después se puede buscar.
;
   Cambian según el lado: un faltante y un sobrante no se explican igual. */
export function causasDeDescuadre(tono) {
  /* ⚠ UN SOLO NOMBRE DE CAMPO: `titulo`. Esto devolvía `texto` y la pantalla
     pinta `titulo`, así que los botones salían con el puro número «1 2 3 4»
     (DETALLES-CAJA-Y-CAPITAL #11). Tocar uno escribe ese título en el motivo. */
  const comunes = [
    { id: 'conteo', titulo: 'Error al contar' },
    { id: 'otro', titulo: 'Otro motivo' },
  ]
  if (tono === 'sobra') {
    return [
      { id: 'sin_anotar', titulo: 'Un cobro que no se anotó' },
      { id: 'anticipo', titulo: 'Le pagaron por adelantado' },
      ...comunes,
    ]
  }
  return [
    { id: 'gasto', titulo: 'Un gasto que no se registró' },
    { id: 'presto', titulo: 'Prestó y no lo anotó' },
    ...comunes,
  ]
}
