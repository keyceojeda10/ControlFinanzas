// lib/reporte-cliente.js — EL REPORTE DE UNA CÉDULA: ¿LE PRESTO O NO?
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El mejor cliente del dueño, 2 nov 2026: tiene nueve rutas y lo que quiere es
// que sus propios cobradores no le presten a gente que paga mal. Lo de los
// otros negocios es el extra: «el plus es que sea como una base de datos
// grande de todo nuestro sistema».
//
// Antes había un «score» que SOLO miraba otros negocios. De sus 1.657 clientes
// solo 1 aparece en otro negocio, así que en 1.656 fichas no salía nada, y el
// 5 ago se quitó también la pastilla gris: la función parecía borrada.
//
// ══ LA REGLA ═══════════════════════════════════════════════════════════════
//
// Se juntan dos preguntas y gana la peor:
//   · en TU negocio: la estrella de `lib/calificacion.js` (cómo terminó lo
//     anterior, con lo que el dueño corrigió a mano), los clavos que siguen
//     abiertos y cuánto va atrasado HOY;
//   · en OTROS negocios (plan Estándar o más): clavos y atrasos, sin decir
//     quién le prestó.
//
// Los umbrales son los de la estrella (7 y 30 días), no unos nuevos: un
// préstamo diario va uno o dos días atrás todo el tiempo y eso no es pagar
// mal. Con el «score» viejo bastaba UN día de mora en otro negocio para salir
// «Alto riesgo».
//
// ⚠ NO TIENE HISTORIAL ≠ PAGA BIEN. Sin préstamos terminados ni reportes el
// nivel es `nuevo`, nunca `verde`: decir «sin riesgo» de alguien de quien no
// se sabe nada es mentirle al cobrador.

import { TARDE_ACEPTABLE, TARDE_FEO, TEXTO, PORQUE } from '@/lib/calificacion'

export const NIVELES_REPORTE = ['rojo', 'ambar', 'verde', 'nuevo']

/** La pastilla y la frase grande de cada nivel. */
export const CABECERA = {
  rojo:  { pastilla: 'Alto riesgo',   titulo: 'Este cliente paga mal' },
  ambar: { pastilla: 'Riesgo medio',  titulo: 'Este cliente se atrasa' },
  verde: { pastilla: 'Buen historial', titulo: 'Este cliente paga bien' },
  nuevo: { pastilla: 'Sin historial', titulo: 'Todavía no tiene historial' },
}

const PESO = { rojo: 3, ambar: 2, verde: 1, nuevo: 0 }
const peor = (a, b) => (PESO[b] > PESO[a] ? b : a)

const minuscula = (t) => t.charAt(0).toLowerCase() + t.slice(1)
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
const tonoAtraso = (d) => (d > TARDE_FEO ? 'rojo' : d > TARDE_ACEPTABLE ? 'ambar' : null)

/**
 * @param {object} p
 * @param {null|{calificacion:object|null, calificacionPor?:string|null,
 *   clavosAbiertos:number, activos:number, peorAtrasoHoy:number}} p.propio
 *   Lo de este negocio, o `null` si la cédula no está en él.
 * @param {null|{negocios:number, pagados:number, alDia:number,
 *   atrasados:number, peorAtrasoHoy:number, clavos:number}} p.otros
 *   Lo de los demás negocios; `null` si el plan no lo incluye.
 * @returns {{nivel:string, pastilla:string, titulo:string,
 *   propio:Array<{tono:string|null, texto:string}>,
 *   otros:Array<{tono:string|null, texto:string}>}}
 */
export function reporteDe({ propio = null, otros = null } = {}) {
  let nivel = 'nuevo'
  const lineasPropio = []
  const lineasOtros = []

  if (propio) {
    const clavos = Number(propio.clavosAbiertos) || 0
    const atraso = Number(propio.peorAtrasoHoy) || 0
    const activos = Number(propio.activos) || 0
    const c = propio.calificacion

    if (clavos > 0) {
      nivel = peor(nivel, 'rojo')
      lineasPropio.push({ tono: 'rojo', texto: `Tiene ${plural(clavos, 'préstamo marcado', 'préstamos marcados')} como clavo` })
    }
    const ta = tonoAtraso(atraso)
    if (ta) {
      nivel = peor(nivel, ta)
      lineasPropio.push({ tono: ta, texto: `Hoy va ${plural(atraso, 'día', 'días')} atrasado` })
    }
    if (c) {
      nivel = peor(nivel, c.nivel)
      /* «Buen cliente: terminó lo que debía sin atrasarse · 4 préstamos
         terminados». Si lo corrigieron a mano se dice quién y qué decía el
         sistema, pero en una frase que se lea de corrido. */
      const porque = c.aMano
        ? `según ${propio.calificacionPor ?? 'el administrador'}${c.automatico ? ` (el sistema decía «${TEXTO[c.automatico]}»)` : ''}`
        : minuscula(PORQUE[c.nivel])
      lineasPropio.push({
        tono: c.nivel,
        texto: `${TEXTO[c.nivel]}: ${porque}${c.numero ? ` · ${plural(c.numero, 'préstamo terminado', 'préstamos terminados')}` : ''}`,
      })
    }
    if (activos > 0 && !ta && !clavos) {
      lineasPropio.push({ tono: null, texto: `${plural(activos, 'préstamo activo', 'préstamos activos')}, sin atrasos que preocupen` })
    }
  }

  if (otros) {
    const n = Number(otros.negocios) || 0
    if (n > 0) {
      const clavos = Number(otros.clavos) || 0
      const atraso = Number(otros.peorAtrasoHoy) || 0
      const atrasados = Number(otros.atrasados) || 0
      const pagados = Number(otros.pagados) || 0
      const alDia = Number(otros.alDia) || 0
      if (clavos > 0) {
        nivel = peor(nivel, 'rojo')
        lineasOtros.push({ tono: 'rojo', texto: `${plural(clavos, 'préstamo marcado', 'préstamos marcados')} como clavo` })
      }
      const ta = tonoAtraso(atraso)
      if (ta && atrasados > 0) {
        nivel = peor(nivel, ta)
        lineasOtros.push({ tono: ta, texto: `${plural(atrasados, 'préstamo atrasado', 'préstamos atrasados')}, el peor con ${plural(atraso, 'día', 'días')}` })
      }
      if (pagados > 0) {
        nivel = peor(nivel, 'verde')
        lineasOtros.push({ tono: 'verde', texto: `${plural(pagados, 'préstamo pagado', 'préstamos pagados')} completo${pagados === 1 ? '' : 's'}` })
      }
      if (alDia > 0) lineasOtros.push({ tono: null, texto: `${plural(alDia, 'préstamo activo', 'préstamos activos')} al día` })
    }
  }

  return { nivel, ...CABECERA[nivel], propio: lineasPropio, otros: lineasOtros }
}

/** Los tramos de un atraso que el reporte cuenta, para resumir otros negocios. */
export const cuentaComoAtraso = (dias) => Number(dias) > TARDE_ACEPTABLE
