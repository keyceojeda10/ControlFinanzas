// lib/documento.js — cómo se llama el documento de identidad en cada país.
//
// ══ POR QUÉ EXISTE ══════════════════════════════════════════════════════════
//
// `lib/countries.js` define `documentLabel` y `documentAbbr` para los dieciocho
// países desde siempre —«DNI» en Argentina, «RUT» en Chile, «CI» en Bolivia—,
// pero NADIE los usaba: había un «CC» escrito a fuego en diez tarjetas, listas y
// recibos. Un argentino veía «CC 12345678» donde debería leer «DNI 12345678».
//
// Lo destapó una pregunta del dueño: «¿de verdad funciona cambiar de país, la
// terminología y demás?». La moneda sí funcionaba; esto no.
//
// ══ POR QUÉ AQUÍ Y NO CON `useCountry` ══════════════════════════════════════
//
// Los diez sitios son tarjetas y listas puras que no llaman a ningún hook, y
// varios ni siquiera son componentes de React: el recibo impreso arma HTML a
// mano y la firma digital dibuja sobre un lienzo. Un ayudante que recibe el
// país por parámetro sirve en los tres casos; un hook, en uno.
import { getCountryConfig } from '@/lib/countries'

/**
 * La abreviatura del documento, la que va delante del número en las fichas:
 * «CC 1.034.887», «DNI 12345678», «RUT 12345678-9».
 */
export function abreviaturaDocumento(country) {
  return getCountryConfig(country).documentAbbr
}

/** El nombre largo, para rótulos de formulario: «Cédula», «DNI», «RUT». */
export function nombreDocumento(country) {
  return getCountryConfig(country).documentLabel
}

/**
 * El documento listo para pintar, o `null` si no hay.
 *
 * ⚠ LOS «SIN-» NO SON DOCUMENTOS. Cuando se carga un cliente sin cédula, el
 * sistema le pone un `SIN-…` para no dejar el campo vacío. Cada uno de los diez
 * sitios lo comprobaba por su cuenta —`!cedula.startsWith('SIN-')`— y basta que
 * uno se olvide para que un cobrador lea «CC SIN-a3f9b2» en la ficha.
 */
export function documentoParaMostrar(cedula, country) {
  const v = String(cedula ?? '').trim()
  if (!v || v.startsWith('SIN-')) return null
  return `${abreviaturaDocumento(country)} ${v}`
}
