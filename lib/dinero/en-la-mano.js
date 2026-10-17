// lib/dinero/en-la-mano.js — Los billetes que el cobrador tiene al final del día.
//
// Es la cifra del botón «Usar» de la caja del COBRADOR, que es la referencia
// (ver [[dos_cajas_mismo_numero]]): lo cobrado en efectivo, menos lo prestado
// en efectivo, menos los gastos (pendientes y aprobados: el billete ya salió),
// más lo que el dueño le metió o le sacó en efectivo. SIN la base con la que
// salió: la base se queda en la ruta (decisión del dueño, 17 oct 2026, caja #13).
//
// Vivía escrita dentro de `caja/page.jsx`. Ahora la usan también el cierre —que
// la guarda como `enLaManoSistema`— y el cuadre, que compara lo contado contra
// ella: antes lo comparaba contra lo cobrado BRUTO, con las transferencias y sin
// restar lo prestado ni los gastos, y asentaba faltantes que no existían.
//
// `dia` es `stats.dia` de /api/caja (lo que devuelve `getStatsDia`). Las cifras
// de respaldo son las mismas que tenía la página, en el mismo orden.
export function enLaManoDelDia(dia = {}) {
  const cobrado = Math.round(dia.cobradoHoy ?? dia.recogida ?? 0)
  const cobradoEfectivo = Math.round(dia.recogidaEfectivo ?? cobrado)
  const prestado = Math.round(dia.prestadoHoy ?? (dia.desembolsadoDia || 0))
  const prestadoEfectivo = Math.round(dia.efectivoPrestadoDia ?? prestado)
  const gastos = Math.round(dia.gastos || 0)
  const delDueno = Math.round(dia.movidoPorElDuenoEfectivo ?? 0)
  return cobradoEfectivo - prestadoEfectivo - gastos + delDueno
}
