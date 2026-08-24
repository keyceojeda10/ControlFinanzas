// scripts/video-demo/v08-cobradores.mjs
//
// VÍDEO 8 · Los cobradores: qué son, cómo se crean y cómo encajan
//
//     node scripts/video-demo/v08-cobradores.mjs
//     node scripts/video-demo/v08-cobradores.mjs --toma 6
//     node scripts/video-demo/v08-cobradores.mjs --pegar
//
// El dueño lo pidió con una condición: «no es tanto mostrar cómo se hace sino
// explicar el porqué y para qué sirve, e integrarlo». Así que el vídeo va sobre
// la IDEA —una cuenta con acceso recortado, que ve solo su ruta y responde por
// una plata— y los clics son el ejemplo, no el tema.
//
// La cadena que hay que dejar clara, y en este orden:
//
//     cuenta  →  permisos  →  credenciales  →  RUTA  →  caja
//
// Sin el cuarto eslabón no cobra nada, y es el que más se rompe.
//
// ── LO QUE HUBO QUE ARREGLAR ANTES ─────────────────────────────────────────
//
// «Asígnale una ruta» llevaba a una pantalla donde no se podía asignar: la
// lista de cobradores avisa y ofrece «Asignar», el botón trae a la ficha, y la
// ficha solo ponía «Sin ruta asignada». La ficha de la RUTA tampoco —su
// «Cambiar el cobrador» devuelve a /cobradores—, así que el círculo estaba
// cerrado y la única salida era crear una ruta nueva. En producción hay 6
// cobradores activos sin ninguna ruta, tres de ellos del MISMO negocio, que
// tiene 9 rutas y 2 esperando. Se arregló antes de grabar la toma 10.
//
// ── LO QUE NO SE TOCA EN CÁMARA ────────────────────────────────────────────
//
//  · El botón de WhatsApp de las credenciales hace `window.open`. Se enseña y
//    se explica; lo que se pulsa es «Copiar», que sí se queda en la pantalla.
//  · Todo selector lleva `:visible`: hay copia de escritorio en el DOM.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { conectar, IDS } from './montar-demo.mjs'

/* ⚠ LA BARRA DE ABAJO SE APUNTA POR EL `nav`, NO POR EL `href` A SECAS.
   Reportado por el dueño viendo el vídeo 15: «no está señalando bien el icono;
   señala un texto y no el icono de los préstamos en el menú».
   En el panel hay DOS enlaces visibles a `/prestamos`: el «Ver todos →» de una
   tarjeta (y=1874) y el icono de la barra (y=890). `.first()` coge el de la
   tarjeta porque va antes en el DOM, y `:visible` no ayuda: los dos lo están.
   Hoy solo pasa con préstamos, pero cualquier «Ver todos» que se añada mañana
   rompe el de al lado, así que se acota a la barra en todos. */
const MENU = 'nav[aria-label="Navegación principal"]'

const NUEVO = { nombre: 'Pedro Ramírez', tel: '3009876543', correo: 'pedro@ejemplo.com', clave: 'ruta2026' }

/* El cobrador que crea la grabación se borra ANTES de cada toma: cada toma se
   lleva sola desde el principio y el correo es único en todo el sistema, así
   que la segunda toma chocaría con «ya existe». */
const RUTA_LIBRE = { id: 'zzvideodemo000000000ruta02', nombre: 'Ruta La Floresta' }

const limpiar = async () => {
  const cx = await conectar()
  await cx.execute('UPDATE Ruta SET cobradorId = ? WHERE id = ?', [IDS.cobrador, IDS.ruta])
  const [u] = await cx.query(
    'SELECT id FROM User WHERE organizationId = ? AND email = ?', [IDS.org, NUEVO.correo])
  for (const x of u) {
    await cx.execute('UPDATE Ruta SET cobradorId = NULL WHERE cobradorId = ?', [x.id])
    await cx.execute('DELETE FROM User WHERE id = ?', [x.id])
  }
  /* ⚠ TIENE QUE HABER UNA RUTA LIBRE. Con una sola ruta en el negocio, el
     cobrador nuevo se quedaba con la de Andrés: el vídeo enseñaba a robarle el
     recorrido a otro en vez de a darle el suyo, y de paso dejaba a Andrés sin
     ruta. Con dos, el desplegable enseña además la diferencia —«la lleva Andrés
     Vargas» contra «sin cobrador»—, que es justo lo que hay que entender. */
  const [hay] = await cx.query('SELECT id FROM Ruta WHERE id = ?', [RUTA_LIBRE.id])
  if (!hay.length) {
    await cx.execute(
      `INSERT INTO Ruta (id, nombre, organizationId, cobradorId, activo, orden, saldoCapital, createdAt)
       VALUES (?, ?, ?, NULL, 1, 1, 0, NOW())`, [RUTA_LIBRE.id, RUTA_LIBRE.nombre, IDS.org])
  }
  await cx.execute('UPDATE Ruta SET cobradorId = NULL WHERE id = ?', [RUTA_LIBRE.id])
  await cx.execute(
    `UPDATE Cliente SET rutaId = ? WHERE organizationId = ? AND rutaId IS NULL`,
    [RUTA_LIBRE.id, IDS.org])
  await cx.end()
}

/** Del panel a la lista de cobradores, tocando: vive en «Más». */
const hastaCobradores = async ({ ir, tocarSel, esperar }) => {
  await ir('/dashboard', /Buenos|Recaudado/i)
  await tocarSel(`${MENU} a[href="/mas"]`)
  await esperar(2600)
  await tocarSel('button:has-text("Cobradores"):visible')
  await esperar(2800)
}

/** Y de ahí al formulario de uno nuevo. */
const hastaFormulario = async (u) => {
  await hastaCobradores(u)
  await u.tocar('Crear cobrador')
  await u.esperar(3000)
}

/** El formulario relleno, para las tomas que siguen desde ahí. */
const rellenar = async ({ escribir, esperar }) => {
  await escribir('input[placeholder="Ej: Pedro Ramírez"]', NUEVO.nombre)
  await escribir('input[placeholder="Ej: 3001234567"]', NUEVO.tel)
  await escribir('input[placeholder="cobrador@ejemplo.com"]', NUEVO.correo)
  await escribir('input[placeholder="Mínimo 6 caracteres"]', NUEVO.clave)
  await esperar(1200)
}

const TOMAS = [
  {
    id: 'por_que',
    titulo: 'Qué es un cobrador y para qué sirve',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaCobradores(u)
      empezar()
      await decir('Los cobradores son lo que convierte esto en un negocio con gente', 5.4)
      await esperar(5600)
      await decir('Un cobrador no es un contacto: es una cuenta para entrar', 5.0)
      await esperar(5200)
      await decir('Entra con su propio correo y ve solo lo suyo', 4.6)
      await esperar(1600)
      await mirar('[role="button"]:has-text("Andrés Vargas"):visible, button:has-text("Andrés Vargas"):visible',
        { escala: 1.5, ms: 4800 })
      await esperar(3600)
      await reposo(3800)
    },
  },
  {
    id: 'la_lista',
    titulo: 'Lo que te dice la lista',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaCobradores(u)
      empezar()
      await decir('Y esta lista es tu control de la mañana', 4.2)
      await esperar(4400)
      await mirar('text=DEBE ENTREGAR', { escala: 2.0, ms: 4600 })
      await esperar(2600)
      await decir('Lo importante es esto: cuánta plata tuya lleva encima ahora mismo', 5.4)
      await esperar(5600)
      await decir('Eso es lo que tiene que entregarte esta noche', 4.4)
      await esperar(4600)
      await reposo(3400)
    },
  },
  {
    id: 'datos',
    titulo: 'Crear uno: quién es',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, escribir, reposo } = u
      await hastaFormulario(u)
      empezar()
      await decir('Para crear uno, «crear cobrador»', 3.8)
      await esperar(4000)
      await escribir('input[placeholder="Ej: Pedro Ramírez"]', NUEVO.nombre)
      await esperar(1800)
      await decir('El nombre, y el teléfono, que no es opcional de verdad', 4.8)
      await esperar(1600)
      await escribir('input[placeholder="Ej: 3001234567"]', NUEVO.tel)
      await esperar(1600)
      await mirar('text=podrás enviarle las credenciales', { escala: 1.8, ms: 4600 })
      await esperar(2600)
      await decir('Con el teléfono le mandas las claves por WhatsApp de un toque', 5.2)
      await esperar(5400)
      await reposo(3400)
    },
  },
  {
    id: 'acceso',
    titulo: 'Su llave para entrar',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, escribir, reposo } = u
      await hastaFormulario(u)
      await escribir('input[placeholder="Ej: Pedro Ramírez"]', NUEVO.nombre)
      await escribir('input[placeholder="Ej: 3001234567"]', NUEVO.tel)
      empezar()
      await decir('Ahora su llave: el correo es el usuario con el que entra', 5.0)
      await esperar(1600)
      await escribir('input[placeholder="cobrador@ejemplo.com"]', NUEVO.correo)
      await esperar(1600)
      await mirar('text=ACCESO AL SISTEMA', { escala: 1.7, ms: 4400 })
      await esperar(2200)
      await decir('Y una contraseña temporal, que él puede cambiar después', 4.8)
      await esperar(1600)
      await escribir('input[placeholder="Mínimo 6 caracteres"]', NUEVO.clave)
      await esperar(2000)
      await decir('No le pongas la misma a todos: cada uno la suya', 4.6)
      await esperar(5400)
      await decir('Si mañana sacas a uno, no quieres que sepa la de los demás', 5.2)
      await esperar(5400)
      await reposo(3600)
    },
  },
  {
    id: 'permisos',
    titulo: 'Los permisos: la idea',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaFormulario(u)
      await rellenar(u)
      empezar()
      await decir('Y aquí está lo que de verdad importa de esta pantalla', 4.8)
      await esperar(5000)
      await mirar('text=PERMISOS DEL COBRADOR', { escala: 1.7, ms: 4600 })
      await esperar(2600)
      await decir('De entrada, un cobrador solo cobra. Nada más', 4.4)
      await esperar(4600)
      await decir('Todo lo demás lo enciendes tú, uno por uno', 4.4)
      await esperar(4600)
      await decir('No le das funciones: decides qué puede hacer con tu plata', 5.2)
      await esperar(5400)
      await reposo(3600)
    },
  },
  {
    id: 'permisos_dia',
    titulo: 'Los del día a día',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaFormulario(u)
      await rellenar(u)
      empezar()
      await decir('Los normales son estos', 3.6)
      await esperar(3800)
      await mirar('text=Crear clientes', { escala: 1.9, ms: 4400 })
      await esperar(2200)
      await decir('Si le dejas crear clientes, se los mete a su ruta él mismo', 5.0)
      await esperar(5200)
      await mirar('text=Reportar gastos menores', { escala: 1.9, ms: 4400 })
      await esperar(2200)
      await decir('Y si le dejas reportar gastos, el pasaje y el almuerzo entran en su caja', 5.8)
      await esperar(6000)
      await reposo(3400)
    },
  },
  {
    id: 'permisos_riesgo',
    titulo: 'Los que hay que pensar dos veces',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaFormulario(u)
      await rellenar(u)
      empezar()
      await decir('Y hay tres que conviene pensar dos veces', 4.2)
      await esperar(4400)
      await mirar('text=Aplicar descuentos y liquidaciones', { escala: 1.8, ms: 4600 })
      await esperar(2600)
      await decir('Este baja la deuda de un cliente. El sistema mismo te avisa', 5.0)
      await esperar(5200)
      await mirar('text=Ver capital de TODA la organización', { escala: 1.8, ms: 4600 })
      await esperar(2600)
      await decir('Y este le enseña el patrimonio entero, no solo su ruta', 5.0)
      await esperar(5200)
      await reposo(3400)
    },
  },
  {
    id: 'crear',
    titulo: 'Crearlo',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaFormulario(u)
      await rellenar(u)
      empezar()
      await decir('Todo esto se puede cambiar después, así que no te trabes', 5.0)
      await esperar(5200)
      await tocar('Crear cobrador')
      await esperar(4000)
      await mirar('text=Cobrador creado', { escala: 1.7, ms: 4600 })
      await esperar(2600)
      await decir('Ya está creado, y te enseña sus datos de entrada', 4.6)
      await esperar(4800)
      await reposo(3600)
    },
  },
  {
    id: 'credenciales',
    titulo: 'Mandarle las claves',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaFormulario(u)
      await rellenar(u)
      await tocar('Crear cobrador'); await esperar(3800)
      empezar()
      await decir('Y ahora se las mandas, sin escribir nada', 4.2)
      await esperar(4400)
      await mirar('text=Enviar credenciales al cobrador', { escala: 1.7, ms: 4600 })
      await esperar(2600)
      await decir('El mensaje ya viene escrito: el enlace, su correo y su clave', 5.2)
      await esperar(5400)
      await decir('Y le explica cómo dejarse la aplicación instalada en el teléfono', 5.4)
      await esperar(5600)
      await reposo(3600)
    },
  },
  {
    id: 'ruta',
    titulo: 'Sin ruta no cobra nada',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, tocarSel, reposo, p } = u
      await hastaFormulario(u)
      await rellenar(u)
      await tocar('Crear cobrador'); await esperar(3800)
      await tocar('Ir a cobradores')
      // La lista tarda en montarse; sin este aire la toma abría sobre el
      // esqueleto de carga mientras el rótulo ya explicaba.
      await esperar(6500)
      empezar()
      await decir('Y falta el paso que más se olvida', 4.0)
      await esperar(4200)
      await mirar('text=sin ruta no puede cobrar', { escala: 1.8, ms: 4600 })
      await esperar(2600)
      await decir('Una cuenta sin ruta entra al sistema, pero no tiene a quién cobrarle', 5.6)
      await esperar(5800)
      await tocar('Asignar')
      await esperar(3200)
      await decir('Le das a «asignar» y eliges cuál de tus rutas lleva', 4.8)
      await esperar(2600)
      await mirar('select:visible', { escala: 1.8, ms: 4400 })
      await esperar(1800)
      // Por ETIQUETA, no por índice: la primera opción es la ruta que ya lleva
      // Andrés, y elegirla sería quitársela a él delante de la cámara.
      await p.selectOption('select:visible', { label: /Floresta/ }).catch(() => {})
      await esperar(4000)
      await decir('Y ya tiene su recorrido: esa es la que va a ver mañana', 5.0)
      await esperar(5200)
      await reposo(3800)
    },
  },
  {
    id: 'que_ve',
    titulo: 'Lo que ve él cuando entra',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo, p } = u
      await u.ir('/dashboard', /Buenas|Recaudado/i)
      /* ⚠ EL BANNER DE LA CAMPAÑA FUERA DE CUADRO. «¿Qué le cambiarías a la
         app?» ocupa un tercio de la pantalla del cobrador, no tiene nada que ver
         con lo que se explica, y además fecha el vídeo: cuando la campaña se
         apague, el tutorial enseñará algo que ya no existe. */
      await p.locator('text=RECAUDADO HOY').first().scrollIntoViewIfNeeded().catch(() => {})
      await esperar(1400)
      empezar()
      await decir('Y esto es lo que ve él al entrar con su clave', 4.4)
      await esperar(4600)
      await mirar('text=RECAUDADO HOY', { escala: 1.6, ms: 4600 })
      await esperar(2600)
      await decir('Sus cobros, su mora, su día. Nada de otras rutas', 4.8)
      await esperar(5000)
      await decir('Y ni una cifra del capital, salvo que tú se lo permitas', 5.0)
      await esperar(5200)
      await decir('Justo la pantalla que necesita para trabajar, y nada más', 5.0)
      await esperar(5200)
      await reposo(3800)
    },
  },
  {
    id: 'ficha',
    titulo: 'Su ficha, para el día a día',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaCobradores(u)
      await tocar('Andrés Vargas')
      await esperar(3200)
      empezar()
      await decir('Entrando en su ficha tienes lo del día', 4.2)
      await esperar(4400)
      await mirar('text=Enviar credenciales', { escala: 1.7, ms: 4600 })
      await esperar(2600)
      await decir('Si pierde la clave, se la reseteas y se la reenvías desde aquí', 5.2)
      await esperar(5400)
      await mirar('button:has-text("Activo"):visible', { escala: 2.0, ms: 4400 })
      await esperar(2200)
      await decir('Y si se va, lo desactivas: deja de entrar y no se borra nada', 5.2)
      await esperar(5400)
      await reposo(3600)
    },
  },
  {
    id: 'cierre',
    titulo: 'Cómo encaja todo',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaCobradores(u)
      empezar()
      await decir('Y así queda la cadena completa', 3.8)
      await esperar(4000)
      await decir('Le creas la cuenta, le das permisos, le mandas la clave y le pones ruta', 5.8)
      await esperar(6000)
      await mirar('button:has-text("Ver el ranking"):visible', { escala: 1.9, ms: 4400 })
      await esperar(1400)
      await tocar('Ver el ranking')
      await esperar(3200)
      await decir('Y a partir de ahí el sistema te los compara solo', 4.6)
      await esperar(4800)
      await decir('Quién recauda más, quién deja más mora, quién cumple', 5.0)
      await esperar(5200)
      await reposo(4200)
    },
  },
]

const galleta = (rol) => encode({
  token: {
    sub: rol === 'owner' ? IDS.owner : IDS.cobrador,
    id: rol === 'owner' ? IDS.owner : IDS.cobrador,
    email: 'demo@ejemplo.com',
    name: rol === 'owner' ? 'Sofía Restrepo' : 'Andrés Vargas',
    rol, organizationId: IDS.org, plan: 'professional', country: 'co',
    orgNombre: 'Créditos del Valle', rutaIds: rol === 'owner' ? [] : [IDS.ruta],
  },
  secret: SECRETO,
})

const cookie = await galleta('owner')
// La toma 11 entra COMO EL COBRADOR: es la mitad de la explicación.
TOMAS.find((t) => t.id === 'que_ve').cookie = await galleta('cobrador')

await correr({
  nombre: 'cobradores',
  dir: '/tmp/videos/08-cobradores',
  final: '/tmp/videos/08-cobradores.mp4',
  tomas: TOMAS,
  cookie,
  antesDeToma: limpiar,
})
