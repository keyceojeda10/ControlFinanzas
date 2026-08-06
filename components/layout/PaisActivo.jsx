'use client'

// components/layout/PaisActivo.jsx — le dice a `lib/i18n` en qué país estamos.
//
// ══ POR QUÉ HACE FALTA ══════════════════════════════════════════════════════
//
// Las funciones de `lib/i18n` reciben el país por parámetro, y 465 llamadas a
// `formatMoney` en 49 ficheros lo omiten: caían a Colombia. Para Argentina,
// Chile o Uruguay no se nota —comparten el símbolo `$`— pero un paraguayo veía
// «$500.000» donde su moneda escribe «₲500.000».
//
// ══ POR QUÉ AQUÍ Y NO EN EL LAYOUT ══════════════════════════════════════════
//
// El layout del panel es un componente de SERVIDOR, y ahí un valor de módulo se
// comparte entre peticiones: la de un negocio argentino y la de uno colombiano
// pasan por el mismo proceso, así que fijarlo allí haría que el segundo viera
// pesos argentinos. En el navegador no existe ese riesgo — cada pestaña es de
// una sola organización.
//
// Se fija en el render y no en un `useEffect` para que la PRIMERA pintura ya
// salga con la moneda correcta: con el efecto, el usuario vería un parpadeo de
// cifras en pesos colombianos.
import { fijarPaisActivo } from '@/lib/i18n'

export default function PaisActivo({ country }) {
  if (typeof window !== 'undefined') fijarPaisActivo(country)
  return null
}
