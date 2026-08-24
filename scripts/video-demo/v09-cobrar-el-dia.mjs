// scripts/video-demo/v09-cobrar-el-dia.mjs
//
// VÍDEO 9 · Cobrar el día
//
//     node scripts/video-demo/v09-cobrar-el-dia.mjs
//     node scripts/video-demo/v09-cobrar-el-dia.mjs --toma 5
//     node scripts/video-demo/v09-cobrar-el-dia.mjs --pegar
//
// La pantalla que el cobrador abre CADA MAÑANA, y por eso este vídeo se graba
// entero con su sesión, no con la del dueño: lo que se enseña es su teléfono.
//
// ── LO QUE TIENE QUE QUEDAR CLARO ──────────────────────────────────────────
//
// Una idea, y es la que más confusión causa en soporte:
//
//     ABONAR NO ES CUBRIR LA CUOTA DEL DÍA
//
// Wilmer viene con atraso. Al cobrarle una cuota, la pantalla no lo tacha: lo
// deja con «Ya abonó $21.800 hoy · sigue pendiente», la pastilla baja de 5d a
// 4d y el contador de arriba sigue diciendo «0 de 8 cobrados» aunque el dinero
// ya subió a $21.800. Eso no es un fallo y hay que explicarlo, o el cobrador
// cree que su cobro no se guardó.
//
// ── LO QUE NO SE ENSEÑA, Y POR QUÉ ─────────────────────────────────────────
//
//  · **La caja del cobrador.** Se menciona y se deja para su propio vídeo. Hoy
//    además saldría con «Te queda en la mano −$3.628.200», porque `poblar-demo`
//    desembolsa los trece préstamos con fecha de HOY: en un día de verdad nadie
//    presta 3,6 millones. Hay que arreglar el decorado ANTES del vídeo de caja.
//  · **«No pagó»** no está en la hoja de cobro rápido de esta pantalla; vive en
//    la hoja de la ruta y en la ficha del cliente. Se cuenta de palabra.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { conectar, IDS } from './montar-demo.mjs'

/* El día arranca LIMPIO en cada toma: el cobro se graba en vivo, que es de lo
   que va el vídeo, y una toma no puede empezar con lo que hizo la anterior. */
/* ⚠ LA BARRA DE ABAJO SE APUNTA POR EL `nav`, NO POR EL `href` A SECAS.
   Reportado por el dueño viendo el vídeo 15: «no está señalando bien el icono;
   señala un texto y no el icono de los préstamos en el menú».
   En el panel hay DOS enlaces visibles a `/prestamos`: el «Ver todos →» de una
   tarjeta (y=1874) y el icono de la barra (y=890). `.first()` coge el de la
   tarjeta porque va antes en el DOM, y `:visible` no ayuda: los dos lo están.
   Hoy solo pasa con préstamos, pero cualquier «Ver todos» que se añada mañana
   rompe el de al lado, así que se acota a la barra en todos. */
const MENU = 'nav[aria-label="Navegación principal"]'

const limpiar = async () => {
  const cx = await conectar()
  const [p] = await cx.query(
    `SELECT p.id FROM Prestamo p JOIN Cliente c ON c.id = p.clienteId
     WHERE c.organizationId = ?`, [IDS.org])
  const ids = p.map((x) => x.id)
  if (ids.length) {
    await cx.query('DELETE FROM Pago WHERE prestamoId IN (?)', [ids])
    await cx.query("UPDATE Prestamo SET totalPagado = 0, estado = 'activo' WHERE id IN (?)", [ids])
  }
  await cx.end()
}

/**
 * Del panel del cobrador a su día: Rutas → «Salir a cobrar».
 *
 * ⚠ NO HAY ATAJO EN LA PASTILLA, y es a propósito: `/cobros-hoy` está en
 * `SIN_PASTILLA` (lib/armazon.js) porque es «una lista sobre la que se actúa».
 * El único enlace con la palabra «Cobrar hoy» es el del menú de ESCRITORIO, que
 * a 540px está oculto: buscarlo por texto esperaba diez segundos a un elemento
 * invisible. En el móvil se entra por el botón dorado de Rutas, y eso es
 * justamente lo que hay que enseñar en el vídeo.
 */
const hastaElDia = async ({ ir, tocarSel, tocar, esperar }) => {
  await ir('/dashboard', /Buenas|Recaudado/i)
  await tocarSel(`${MENU} a[href="/rutas"]`)
  await esperar(3000)
  await tocar('Salir a cobrar')
  await esperar(3400)
}

/** Y con el primer cobro ya hecho, para las tomas que hablan del después. */
const conUnCobro = async (u) => {
  await hastaElDia(u)
  await u.tocar('Cobrar')
  await u.esperar(2600)
  await u.tocar('Efectivo')
  await u.esperar(3000)
}

const TOMAS = [
  {
    id: 'el_dia',
    titulo: 'Qué es esta pantalla',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo, ir } = u
      await ir('/dashboard', /Buenas|Recaudado/i)
      empezar()
      await decir('El día del cobrador empieza en «rutas»', 3.8)
      await esperar(4000)
      await u.tocarSel(`${MENU} a[href="/rutas"]`)
      await esperar(3000)
      await mirar('button:has-text("Salir a cobrar"):visible', { escala: 1.8, ms: 4400 })
      await esperar(1600)
      await decir('Y en el botón de abajo: «salir a cobrar»', 4.0)
      await esperar(4200)
      await u.tocar('Salir a cobrar')
      await esperar(3600)
      await decir('Esta es su pantalla, y la abre cada mañana', 4.4)
      await esperar(4600)
      await mirar('text=de $177.500', { escala: 1.7, ms: 4600 })
      await esperar(2600)
      await decir('Arriba, el día entero en una línea: cuánto llevas de cuánto', 5.2)
      await esperar(5400)
      await decir('Y cuántos clientes te faltan por visitar', 4.2)
      await esperar(4400)
      await reposo(3400)
    },
  },
  {
    id: 'la_parada',
    titulo: 'Cómo se lee una parada',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaElDia(u)
      empezar()
      await decir('Debajo van los clientes, en el orden en que los recorres', 5.0)
      await esperar(5200)
      await mirar('text=CUOTA DIARIA', { escala: 1.9, ms: 4600 })
      await esperar(2600)
      await decir('De cada uno: lo que te tiene que dar hoy y lo que debe en total', 5.4)
      await esperar(5600)
      await mirar('text=ÚLT. PAGO', { escala: 1.9, ms: 4600 })
      await esperar(2600)
      await decir('Cuánto lleva de atraso, por qué cuota va y cuándo pagó la última vez', 5.6)
      await esperar(5800)
      await reposo(3400)
    },
  },
  {
    id: 'atajos',
    titulo: 'Los atajos de cada cliente',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocarSel, reposo } = u
      await hastaElDia(u)
      empezar()
      await decir('Cada parada trae cuatro atajos', 3.8)
      await esperar(4000)
      await mirar('[aria-label="Más opciones"]:visible', { escala: 1.9, ms: 4400 })
      await esperar(2200)
      await decir('Llamarlo, escribirle por WhatsApp, y abrir el mapa a su casa', 5.2)
      await esperar(5400)
      await tocarSel('[aria-label="Más opciones"]:visible')
      await esperar(3400)
      await decir('Y el último abre su ficha, con todo lo suyo', 4.4)
      await esperar(4600)
      await reposo(3600)
    },
  },
  {
    id: 'cobrar',
    titulo: 'Cobrar, en dos toques',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaElDia(u)
      empezar()
      await decir('Y cobrar es lo más rápido que hace el sistema', 4.4)
      await esperar(4600)
      await tocar('Cobrar')
      await esperar(3000)
      await decir('Te dice a quién y cuánto, y solo preguntas cómo te pagó', 5.2)
      await esperar(5400)
      await mirar('button:has-text("Efectivo"):visible', { escala: 1.7, ms: 4400 })
      await esperar(1600)
      await tocar('Efectivo')
      await esperar(4200)
      await decir('Un toque en «efectivo» y la cuota queda registrada', 4.6)
      await esperar(4800)
      await reposo(3600)
    },
  },
  {
    id: 'lo_que_cambia',
    titulo: 'Abonar no es cubrir la cuota',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await conUnCobro(u)
      empezar()
      await decir('Mira lo que cambió, porque esto confunde a todo el mundo', 5.2)
      await esperar(5400)
      await mirar('text=sigue pendiente', { escala: 1.8, ms: 4800 })
      await esperar(2800)
      await decir('Este cliente venía atrasado, así que una cuota no lo pone al día', 5.4)
      await esperar(5600)
      await decir('El dinero ya entró, y su atraso bajó de cinco días a cuatro', 5.0)
      await esperar(5200)
      await decir('Pero sigue pendiente, y por eso arriba aún no lo cuenta como cobrado', 5.6)
      await esperar(5800)
      await reposo(3600)
    },
  },
  {
    id: 'deshacer',
    titulo: 'Si te equivocaste',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaElDia(u)
      await tocar('Cobrar'); await esperar(2600)
      await tocar('Efectivo')
      /* El aviso NO sale al instante: aparece sobre los 8 segundos, cuando la
         lista termina de recargarse. Medido, no supuesto — con 3 y con 5 la toma
         abortaba buscando un botón que aún no existía. */
      await esperar(8600)
      empezar()
      /* ⚠ AQUÍ EL RÓTULO VA DESPUÉS, y es la excepción a la regla del formato.
         El aviso de «Deshacer» dura DIEZ SEGUNDOS (lo dice
         `app/api/cobros-hoy/route.js`). Diciendo primero la frase y subrayando
         después, para cuando llegaba el subrayado el aviso ya se había ido y la
         toma abortaba esperando a un elemento que no existe. Lo efímero se
         enseña en cuanto aparece. */
      await mirar('button:has-text("Deshacer"):visible', { escala: 2.0, ms: 4600 })
      await decir('Y si te equivocaste de cliente o de monto, no pasa nada', 5.0)
      await esperar(5200)
      await decir('Abajo aparece «deshacer» un rato, y lo devuelve todo como estaba', 5.4)
      await esperar(5600)
      await decir('Si ya se fue, se corrige desde la ficha del préstamo', 4.6)
      await esperar(4800)
      await reposo(3600)
    },
  },
  {
    id: 'otro_monto',
    titulo: 'Cuando no paga la cuota justa',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaElDia(u)
      await tocar('Cobrar')
      await esperar(2800)
      empezar()
      await decir('Casi nunca pagan la cuota exacta, así que hay salida', 4.8)
      await esperar(5000)
      await mirar('text=Cobrar otro monto', { escala: 2.0, ms: 4600 })
      await esperar(2600)
      await decir('«Cobrar otro monto» es para el abono: le pones lo que te dio', 5.2)
      await esperar(5400)
      await decir('Y si no te dio nada, lo dejas sin tocar y sigues. No hay que inventar', 5.6)
      await esperar(5800)
      await reposo(3600)
    },
  },
  {
    id: 'recorrido',
    titulo: 'Que te lleve él',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaElDia(u)
      empezar()
      await decir('Y esto es lo que de verdad ahorra la mañana', 4.6)
      await esperar(4800)
      await mirar('button:has-text("Empezar ruta"):visible', { escala: 1.8, ms: 4400 })
      await esperar(1600)
      await tocar('Empezar ruta')
      await esperar(3600)
      await decir('«Empezar ruta» te abre el primero, tú cobras, y te abre el siguiente', 5.6)
      await esperar(5800)
      await decir('No hay que buscar a nadie en la lista: va solo, en orden', 5.0)
      await esperar(5200)
      await reposo(3800)
    },
  },
  {
    id: 'filtro',
    titulo: 'Cuando la lista es larga',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocarSel, reposo } = u
      await hastaElDia(u)
      empezar()
      await decir('Si llevas muchos clientes, el embudo de arriba la recorta', 5.0)
      await esperar(5200)
      // El embudo NO lleva texto en móvil: la palabra «Filtros» se esconde y
      // queda solo el icono. Va por `aria-label`.
      await mirar('[aria-label="Más filtros"]:visible', { escala: 2.0, ms: 4400 })
      await esperar(1400)
      await tocarSel('[aria-label="Más filtros"]:visible')
      await esperar(3200)
      await decir('Puedes dejar solo los atrasados, o los de una ruta', 4.8)
      await esperar(5000)
      await mirar('text=Ordenar por', { escala: 1.8, ms: 4400 })
      await esperar(2200)
      await decir('O cambiar el orden, y esconder a los que ya cobraste', 4.8)
      await esperar(5000)
      await reposo(3600)
    },
  },
  {
    id: 'cierre',
    titulo: 'Cómo va el día, y qué toca al final',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await conUnCobro(u)
      empezar()
      await decir('Y mientras cobras, la barra de arriba te va llevando la cuenta', 5.0)
      await esperar(1600)
      await mirar('text=de $177.500', { escala: 1.7, ms: 4800 })
      await esperar(2800)
      await decir('Sabes en todo momento cuánto llevas y cuánto te falta', 4.8)
      await esperar(5000)
      await decir('Y al terminar el día, entregas la caja. Eso es el siguiente vídeo', 5.2)
      await esperar(5400)
      await reposo(4200)
    },
  },
]

const cookie = await encode({
  token: {
    sub: IDS.cobrador, id: IDS.cobrador, email: 'cobrador@ejemplo.com', name: 'Andrés Vargas',
    rol: 'cobrador', organizationId: IDS.org, plan: 'professional', country: 'co',
    orgNombre: 'Créditos del Valle', rutaIds: [IDS.ruta],
  },
  secret: SECRETO,
})

await correr({
  nombre: 'cobrar el día',
  dir: '/tmp/videos/09-cobrar-el-dia',
  final: '/tmp/videos/09-cobrar-el-dia.mp4',
  tomas: TOMAS,
  cookie,
  antesDeToma: limpiar,
})
