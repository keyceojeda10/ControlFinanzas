// scripts/video-demo/v10-ajustes.mjs
//
// VÍDEO 10 · Ajustes: cómo se configura el sistema
//
//     node scripts/video-demo/v10-ajustes.mjs
//     node scripts/video-demo/v10-ajustes.mjs --toma 6
//     node scripts/video-demo/v10-ajustes.mjs --pegar
//
// El dueño lo pidió así: «ese es bastante extenso y detallado». Lo es: ocho
// secciones, y dentro de «Cómo prestas» hay seis bloques que cambian cómo
// cuadra la caja y cuánto gana el negocio.
//
// ── LO QUE DE VERDAD IMPORTA DE ESTA PANTALLA ──────────────────────────────
//
// No son las preferencias de aspecto. Son cuatro interruptores que mueven
// dinero, y ninguno se explica solo:
//
//   · **Medios de transferencia** — de cada cuenta se dice si «le llega al
//     cobrador» o «entra directo a tu cuenta». Es lo que decide si un pago por
//     transferencia entra o no en lo que el cobrador tiene que entregar de
//     noche. De confundir esto salió que una pantalla dijera $66.000 y otra
//     $119.000.
//   · **Capital en ruta = efectivo en mano** — cambia el cuadre de caja.
//   · **Contar renovaciones en el cobrado** — el efectivo del día es el MISMO
//     en los dos casos; solo cambia si ese movimiento se ve.
//   · **Intereses moratorios** — tasa y días de gracia.
//
// ── LO QUE NO SE PULSA EN CÁMARA ───────────────────────────────────────────
//
//  · «Reiniciar» borra clientes, préstamos, pagos, rutas, socios y cobradores.
//  · «Ver a quién le tocaría» dice «y aplicarlo de una vez»: podría cobrar
//    moratorios de verdad.
//  · «Descargar respaldo» y «Compartir por WhatsApp» sacan del vídeo (descarga
//    y `window.open`).
//  · «Marcar hoy como festivo» escribe una fecha que después habría que quitar.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { conectar, IDS } from './montar-demo.mjs'

/* Los interruptores que SÍ se pulsan en cámara dejan rastro en la organización.
   Se devuelven a su sitio antes de cada toma para que todas empiecen igual —y
   para que el negocio de la demostración no quede configurado de una manera
   rara para los otros vídeos. */
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
  await cx.execute(
    `UPDATE Organization SET modoAbreviado = 0, renovacionesEnCobrado = 0,
       ocultarSaldoWA = 0, portalDatosCompletos = 0, requiereAprobacionPrestamos = 0,
       ocultarCapitalCobradores = 0, capitalEsEfectivo = 0,
       tasaMoratorio = 0, diasGraciaMoratorio = 5
     WHERE id = ?`, [IDS.org])
  await cx.end()
}

/** Del panel a Ajustes: vive en «Más». */
const hastaAjustes = async ({ ir, tocarSel, esperar }) => {
  await ir('/dashboard', /Buenos|Recaudado/i)
  await tocarSel(`${MENU} a[href="/mas"]`)
  await esperar(2600)
  await tocarSel('button:has-text("Configuración"):visible, a:has-text("Configuración"):visible')
  await esperar(3000)
}

/** Y de ahí, dentro de una de las ocho tarjetas. */
const seccion = async (u, nombre) => {
  await hastaAjustes(u)
  await u.tocar(nombre)
  await u.esperar(3200)
}

const TOMAS = [
  {
    id: 'donde',
    titulo: 'Dónde están los ajustes',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaAjustes(u)
      empezar()
      await decir('Los ajustes están en «más», abajo del todo', 4.2)
      await esperar(4400)
      await mirar('text=Cómo prestas', { escala: 1.6, ms: 4600 })
      await esperar(2600)
      await decir('Y no es una pantalla de adornos: aquí se decide cómo trabaja el sistema', 5.6)
      await esperar(5800)
      await decir('Ocho apartados. Vamos por todos, que hay cosas que mueven plata', 5.2)
      await esperar(5400)
      await reposo(3400)
    },
  },
  {
    id: 'negocio',
    titulo: 'Tu negocio',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Tu negocio')
      empezar()
      await decir('El primero son los datos del negocio', 3.8)
      await esperar(4000)
      await mirar('text=NOMBRE DEL NEGOCIO', { escala: 1.8, ms: 4400 })
      await esperar(2200)
      await decir('El nombre es el que sale en los comprobantes que reciben tus clientes', 5.4)
      await esperar(5600)
      await mirar('text=PAÍS Y MONEDA', { escala: 1.8, ms: 4400 })
      await esperar(2200)
      await decir('Y el país fija la moneda y el formato de las fechas', 4.6)
      await esperar(4800)
      await reposo(3400)
    },
  },
  {
    id: 'formato',
    titulo: 'Cómo se ven los montos',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await seccion(u, 'Tu negocio')
      empezar()
      await decir('Debajo, cómo quieres ver los montos escritos', 4.4)
      await esperar(4600)
      await mirar('text=FORMATO DE LOS MONTOS', { escala: 1.8, ms: 4400 })
      await esperar(2200)
      await decir('Y el tema: claro, oscuro, o que siga al teléfono', 4.6)
      await esperar(1600)
      await tocar('Oscuro')
      await esperar(2800)
      await decir('Esto es de cada aparato, no del negocio', 4.0)
      await esperar(1400)
      await tocar('Claro')
      await esperar(2600)
      await reposo(3400)
    },
  },
  {
    id: 'dias_sin_cobro',
    titulo: 'Los días que no se cobra',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Tu negocio')
      empezar()
      await decir('Este de aquí evita muchos problemas', 3.8)
      await esperar(4000)
      await mirar('text=DÍAS SIN COBRO', { escala: 1.8, ms: 4600 })
      await esperar(2600)
      await decir('Los días que marques no generan mora para nadie', 4.6)
      await esperar(4800)
      await decir('Si tú no cobras los domingos, el domingo no puede contarle atraso a nadie', 5.8)
      await esperar(6000)
      await decir('Y se puede afinar después por ruta o por cliente', 4.4)
      await esperar(4600)
      await reposo(3400)
    },
  },
  {
    id: 'abreviado',
    titulo: 'Escribir montos sin los ceros',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Tu negocio')
      empezar()
      await decir('Y este te ahorra tiempo todo el día', 4.0)
      await esperar(4200)
      await mirar('text=MODO ABREVIADO DE MONTOS', { escala: 1.8, ms: 4600 })
      await esperar(2600)
      await decir('Con esto escribes cien y el sistema entiende cien mil', 4.8)
      await esperar(5000)
      await decir('Mil quinientos son un millón y medio. Menos ceros, menos errores', 5.2)
      await esperar(5400)
      await reposo(3400)
    },
  },
  {
    id: 'medios',
    titulo: 'De quién es la cuenta que recibe',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Tu negocio')
      empezar()
      await decir('Y ahora lo más importante de esta pantalla', 4.2)
      await esperar(4400)
      await mirar('text=Medios de transferencia', { escala: 1.7, ms: 4600 })
      await esperar(2600)
      await decir('Aquí pones tus cuentas: Nequi, Daviplata, el banco', 4.8)
      await esperar(5000)
      await decir('Y de cada una dices de quién es. Eso es lo que hay que entender', 5.2)
      await esperar(5400)
      await mirar('text=Le llega al cobrador', { escala: 1.9, ms: 4800 })
      await esperar(2800)
      await decir('Si la cuenta es del cobrador, esa plata te la tiene que entregar', 5.2)
      await esperar(5400)
      await decir('Si entra directo a la tuya, él no la toca y no se la pedimos de noche', 5.6)
      await esperar(5800)
      await reposo(3600)
    },
  },
  {
    id: 'defecto',
    titulo: 'Cómo prestas por defecto',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Cómo prestas')
      empezar()
      await decir('El segundo apartado es «cómo prestas», y es el más largo', 4.8)
      await esperar(5000)
      await mirar('text=CÓMO PRESTAS POR DEFECTO', { escala: 1.7, ms: 4600 })
      await esperar(2600)
      await decir('Si casi siempre prestas igual, lo dejas puesto aquí una vez', 5.0)
      await esperar(5200)
      await decir('Y el formulario de préstamo nuevo ya nace lleno', 4.4)
      await esperar(4600)
      await decir('Ojo: cambiar esto no toca los préstamos que ya tienes', 4.8)
      await esperar(5000)
      await reposo(3400)
    },
  },
  {
    id: 'capital_ruta',
    titulo: 'Si le entregas la plata en la mano',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Cómo prestas')
      empezar()
      await decir('Y aquí empiezan los que cambian las cuentas', 4.4)
      await esperar(4600)
      await mirar('text=CAPITAL EN RUTA', { escala: 1.8, ms: 4800 })
      await esperar(2800)
      await decir('Actívalo si al cobrador le entregas el capital en billetes', 5.0)
      await esperar(5200)
      await decir('El sistema lo usa para saber cuánto debería tener en la mano al cerrar', 5.6)
      await esperar(5800)
      await reposo(3400)
    },
  },
  {
    id: 'renovaciones',
    titulo: 'Las renovaciones en el cobrado',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Cómo prestas')
      empezar()
      await decir('Este confunde, así que despacio', 4.0)
      await esperar(4200)
      await mirar('text=CONTAR RENOVACIONES', { escala: 1.8, ms: 4800 })
      await esperar(2800)
      await decir('Cuando renuevas, lo que el cliente ya debía pasa al préstamo nuevo', 5.4)
      await esperar(5600)
      await decir('Con esto encendido lo ves sumado en cobrado y en prestado a la vez', 5.4)
      await esperar(5600)
      await decir('El efectivo del día es el mismo. Solo cambia si ese paso se ve o no', 5.6)
      await esperar(6200)
      await reposo(7000)
    },
  },
  {
    id: 'aprobar',
    titulo: 'Aprobar lo que presta el cobrador',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Cómo prestas')
      empezar()
      await decir('Si tu cobrador puede prestar, este te deja la última palabra', 5.2)
      await esperar(5400)
      await mirar('text=APROBAR PRESTAMOS', { escala: 1.8, ms: 4800 })
      await esperar(2800)
      await decir('Con esto, lo que él crea queda esperando hasta que tú lo apruebes', 5.4)
      await esperar(5600)
      await decir('Sin esto, el préstamo arranca solo. Tú decides', 4.4)
      await esperar(4600)
      await reposo(3400)
    },
  },
  {
    id: 'moratorios',
    titulo: 'El interés por atraso',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Cómo prestas')
      empezar()
      await decir('Y si cobras algo extra cuando alguien se atrasa, va aquí', 5.0)
      await esperar(5200)
      await mirar('text=Intereses moratorios', { escala: 1.8, ms: 4800 })
      await esperar(2800)
      await decir('Pones el porcentaje al mes, y los días de gracia antes de aplicarlo', 5.4)
      await esperar(5600)
      await decir('En cero, no se cobra nada. Y aunque esté puesto, tú lo aplicas o no', 5.6)
      await esperar(5800)
      await decir('«Ver a quién le tocaría» te enseña la lista antes de decidir', 5.0)
      await esperar(5200)
      await reposo(3600)
    },
  },
  {
    id: 'festivos',
    titulo: 'Los festivos',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Cómo prestas')
      empezar()
      await decir('Y el último de este apartado son los festivos', 4.2)
      await esperar(4400)
      await mirar('text=Festivos y días sin cobro', { escala: 1.8, ms: 4800 })
      await esperar(2800)
      await decir('Fechas sueltas en las que no sales a cobrar: no generan mora ese día', 5.6)
      await esperar(5800)
      await decir('Y si hoy amaneció festivo, lo marcas de un toque', 4.6)
      await esperar(4800)
      await reposo(3400)
    },
  },
  {
    id: 'plan',
    titulo: 'Tu plan y los referidos',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Plan y pagos')
      empezar()
      await decir('En «plan y pagos» está tu suscripción', 4.0)
      await esperar(4200)
      await mirar('text=Clientes usados', { escala: 1.8, ms: 4600 })
      await esperar(2600)
      await decir('Qué plan tienes, cuántos clientes llevas y cuándo se renueva', 5.0)
      await esperar(5200)
      await mirar('text=TU LINK DE REFERIDO', { escala: 1.8, ms: 4800 })
      await esperar(2800)
      await decir('Y abajo tu enlace de referido: por cada uno que pague, un mes gratis', 5.4)
      await esperar(5600)
      await reposo(3400)
    },
  },
  {
    id: 'portal',
    titulo: 'Qué ve el cliente',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Portal del cliente')
      empezar()
      await decir('Tus clientes pueden entrar a ver su crédito', 4.2)
      await esperar(4400)
      await mirar('text=MOSTRAR DATOS COMPLETOS', { escala: 1.7, ms: 4800 })
      await esperar(2800)
      await decir('Y aquí decides cuánto le enseñas', 3.6)
      await esperar(3800)
      await decir('Encendido ve todo: monto, total e interés. Apagado, solo lo que debe', 5.6)
      await esperar(5800)
      await reposo(3400)
    },
  },
  {
    id: 'whatsapp',
    titulo: 'Los avisos',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Avisos por WhatsApp')
      empezar()
      await decir('Aquí van los avisos que te llegan a ti y los que salen al cliente', 5.4)
      await esperar(5600)
      await mirar('text=Notificaciones push', { escala: 1.8, ms: 4600 })
      await esperar(2600)
      await decir('A ti: cuando un cobrador registra un pago o alguien entra en mora', 5.4)
      await esperar(5600)
      await mirar('text=Ocultar saldo pendiente', { escala: 1.8, ms: 4600 })
      await esperar(2600)
      await decir('Y al cliente le puedes esconder el saldo en los mensajes', 4.8)
      await esperar(5000)
      await reposo(3400)
    },
  },
  {
    id: 'seguridad',
    titulo: 'Respaldo, y la zona de peligro',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Seguridad')
      empezar()
      await decir('Esta pantalla se llama «zona de peligro», y con razón', 4.8)
      await esperar(5000)
      await mirar('text=Descargar respaldo', { escala: 1.8, ms: 4600 })
      await esperar(2600)
      await decir('Arriba te bajas una copia de todo lo tuyo en un archivo', 5.0)
      await esperar(5200)
      await mirar('text=Reiniciar mi cuenta', { escala: 1.8, ms: 4800 })
      await esperar(2800)
      await decir('Y abajo, borrar todo para empezar de cero. Clientes, préstamos, pagos', 5.6)
      await esperar(5800)
      await decir('Baja la copia antes. Eso no se deshace', 4.2)
      await esperar(4400)
      await reposo(3600)
    },
  },
  {
    id: 'datos',
    titulo: 'Tus datos y tu clave',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await seccion(u, 'Tus datos')
      empezar()
      await decir('El último apartado eres tú', 3.6)
      await esperar(3800)
      await mirar('text=Número de WhatsApp', { escala: 1.8, ms: 4800 })
      await esperar(2800)
      await decir('Ojo con el WhatsApp: por ahí te llegan los códigos para entrar', 5.2)
      await esperar(5400)
      await decir('Si lo cambias, tienes que entrar con el número nuevo', 4.8)
      await esperar(5000)
      await mirar('text=CAMBIAR CONTRASEÑA', { escala: 1.8, ms: 4600 })
      await esperar(2600)
      await decir('Y aquí abajo cambias tu contraseña cuando quieras', 4.6)
      await esperar(4800)
      await reposo(3400)
    },
  },
  {
    id: 'instalar',
    titulo: 'Dejarla instalada en el teléfono',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaAjustes(u)
      empezar()
      await decir('Y una última cosa, abajo del todo, que casi nadie usa', 5.0)
      await esperar(5200)
      await mirar('text=Instalar la app', { escala: 1.7, ms: 4800 })
      await esperar(2800)
      await decir('Instálala en el teléfono y se abre como cualquier otra aplicación', 5.4)
      await esperar(5600)
      await decir('Sin buscar el enlace, y funcionando aunque te quedes sin señal', 5.2)
      await esperar(5400)
      await decir('Díselo a tus cobradores el primer día: se nota', 4.4)
      await esperar(4600)
      await reposo(4200)
    },
  },
]

const cookie = await encode({
  token: {
    sub: IDS.owner, id: IDS.owner, email: 'demo@ejemplo.com', name: 'Sofía Restrepo', rol: 'owner',
    organizationId: IDS.org, plan: 'professional', country: 'co',
    orgNombre: 'Créditos del Valle', rutaIds: [],
  },
  secret: SECRETO,
})

await correr({
  nombre: 'ajustes',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-10',
  final: '/home/keyce/Desktop/videos-tutoriales/10-ajustes.mp4',
  tomas: TOMAS,
  cookie,
  antesDeToma: limpiar,
})
