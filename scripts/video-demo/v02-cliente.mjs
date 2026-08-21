// scripts/video-demo/v02-cliente.mjs
//
// VÍDEO 2 · Crear un cliente
//
// ── LAS REGLAS QUE SALIERON DE REHACERLO DOS VECES ─────────────────────────
//
// 1. NUNCA se entra por URL a una pantalla que el vídeo va a explicar. Se llega
//    tocando, y se enseña dónde se toca. («No pulsas el botón de donde la gente
//    encuentra el crear el cliente.»)
// 2. Una sección de pantalla, una parada.
// 3. LAS PAUSAS SON LARGAS A PROPÓSITO, y no es estética: la voz se graba
//    encima. «Si es muy rápido, después la voz toca ponerla o muy rápido o va a
//    salir audio desfasado del vídeo.» Cada parada se calcula contra el texto
//    que hay que decir, a ~2,4 palabras por segundo, más aire.
// 4. Un acercamiento por parada. Dos seguidos se ven como un tirón.
//
// ── LOS TIEMPOS NO SE CALCULAN A MANO ──────────────────────────────────────
//
// `decir()` y `mirar()` anotan el instante REAL en que ocurren. Antes los
// escribía yo en el guion y bastaba tocar una espera para que la voz quedara
// desfasada del rótulo.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { conectar, IDS } from './montar-demo.mjs'


const CLIENTE = {
  nombre: 'Luis Fernando Ocampo',
  cedula: '71458203',
  celular: '3012223344',
  direccion: 'Calle 24 · Barrio La Palma',
  referencia: 'Frente a la panadería',
}

const TOMAS = [
  {
    id: 'panel',
    titulo: 'El panel y el botón Crear',
    async grabar({ ir, esperar, empezar, decir, mirar, reposo }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      empezar()
      await decir('Este es tu panel. Es lo primero que ves al entrar', 4.2)
      await esperar(4400)
      await mirar('button[aria-label="Crear"]', { escala: 2.2, ms: 3600 })
      await decir('Abajo a la derecha, el botón del más', 3.8)
      await esperar(4000)
      await reposo()
    },
  },
  {
    id: 'menu',
    titulo: 'El menú: ¿qué vas a hacer?',
    async grabar({ ir, esperar, tocar, empezar, decir, mirar, reposo }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      await esperar(1200)
      empezar()
      await decir('Al tocarlo se abre todo lo que puedes hacer', 4.0)
      await tocar('Crear')
      await esperar(4200)
      await decir('Arriba lo que hace entrar plata, abajo lo que la hace salir', 4.6)
      await esperar(4800)
      await mirar('text=Un cliente nuevo', { escala: 1.9, ms: 4000 })
      await decir('Y aquí, para meter un cliente nuevo', 3.8)
      await esperar(4000)
      await tocar('Un cliente nuevo')
      await reposo()
    },
  },
  {
    id: 'como',
    titulo: 'Dos formas de crearlo',
    async grabar({ ir, esperar, tocar, empezar, decir, mirar, reposo }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      await tocar('Crear')
      await esperar(1500)
      await tocar('Un cliente nuevo')
      empezar()
      await decir('Hay dos maneras de meterlo', 3.4)
      await esperar(3800)
      await mirar('text=Escribe los datos del cliente', { escala: 1.8, ms: 3800 })
      await decir('Escribir tú los datos, uno por uno', 3.8)
      await esperar(4200)
      await mirar('text=La IA lee la cartulina', { escala: 1.8, ms: 4200 })
      await decir('O tomarle foto a la cartulina y que el sistema la lea', 4.6)
      await esperar(4800)
      await tocar('Crear manual')
      await reposo()
    },
  },
  {
    id: 'quien',
    titulo: 'Quién es tu cliente',
    async grabar({ ir, esperar, tocar, escribir, empezar, decir, mirar, reposo }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      empezar()
      await decir('Lo primero es quién es', 3.2)
      await esperar(3600)
      await mirar('text=Solo el nombre es obligatorio', { escala: 1.8, ms: 4400 })
      await decir('Con el nombre basta: es lo único obligatorio', 4.2)
      await esperar(4600)
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      await decir('Lo escribes y ya tienes cliente', 3.6)
      await esperar(3800)
      await reposo()
    },
  },
  {
    id: 'contacto',
    titulo: 'Cédula y celular',
    async grabar({ ir, esperar, tocar, escribir, empezar, decir, reposo }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      empezar()
      await decir('La cédula no hace falta, pero sirve para encontrarlo rápido', 4.6)
      await escribir('input[placeholder*="1023456789"]', CLIENTE.cedula)
      await esperar(3400)
      await decir('Y con el celular le mandas el recibo por WhatsApp', 4.4)
      await escribir('input[placeholder*="3001234567"]', CLIENTE.celular)
      await esperar(3800)
      await reposo()
    },
  },
  {
    id: 'donde',
    titulo: 'Dónde lo ubicamos',
    async grabar({ ir, esperar, tocar, escribir, empezar, decir, mirar, reposo }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      empezar()
      await decir('Ahora dónde vive, para poder visitarlo', 4.0)
      await escribir('input[placeholder*="Calle, barrio"]', CLIENTE.direccion)
      await esperar(3200)
      await decir('La referencia ayuda al cobrador a dar con la casa', 4.4)
      await escribir('input[placeholder*="frente al colegio"]', CLIENTE.referencia)
      await esperar(3600)
      await mirar('text=UBICACIÓN EN EL MAPA', { escala: 1.7, ms: 4000 })
      await decir('Y si quieres, le marcas el punto en el mapa', 4.0)
      await esperar(4200)
      await reposo()
    },
  },
  {
    id: 'ruta',
    titulo: 'A qué ruta pertenece',
    async grabar({ p, ir, esperar, tocar, escribir, empezar, decir, mirar, reposo }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      empezar()
      await mirar('text=¿Lo asignamos a una ruta?', { escala: 1.7, ms: 4200 })
      await decir('Puedes ponerlo en una ruta desde ya', 4.0)
      await esperar(4400)
      await p.locator('select').first().selectOption({ label: 'Ruta Centro' }).catch(() => {})
      await decir('También es opcional: se la asignas después cuando quieras', 4.6)
      await esperar(4800)
      await reposo()
    },
  },
  {
    id: 'crear',
    titulo: 'Crear el cliente',
    async grabar({ p, ir, esperar, tocar, escribir, empezar, decir, mirar, reposo }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      await escribir('input[placeholder*="1023456789"]', CLIENTE.cedula)
      await escribir('input[placeholder*="3001234567"]', CLIENTE.celular)
      await escribir('input[placeholder*="Calle, barrio"]', CLIENTE.direccion)
      await p.locator('select').first().selectOption({ label: 'Ruta Centro' }).catch(() => {})
      empezar()
      await mirar('button:has-text("Crear cliente")', { escala: 1.7, ms: 3800 })
      await decir('Cuando esté listo, «Crear cliente»', 3.8)
      await esperar(4000)
      /* ⚠ AQUÍ TERMINA EL PROCESO. El vídeo se cortaba al pulsar el botón y no
         se veía el resultado: dónde queda el cliente ni qué sale después. */
      await tocar('Crear cliente', { espera: 4200 })
      await decir('Y ya está creado', 3.4)
      await esperar(3800)
      /* ⚠ LO QUE SALE NO ES LA FICHA, ES UN DIÁLOGO con tres caminos. El primer
         montaje rotulaba «esta es su ficha» encima de otra cosa: exactamente el
         error de explicar algo distinto de lo que se ve. */
      await mirar('button:has-text("Crear préstamo ahora")', { escala: 1.7, ms: 4400 })
      await decir('Y te ofrece hacerle el préstamo de una vez', 4.4)
      await esperar(4600)
      await decir('O cargar otro cliente, o ver su ficha', 4.2)
      await esperar(4400)
      await decir('Hacerle el préstamo es el siguiente vídeo', 4.2)
      await esperar(4400)
      await reposo(3200)
    },
  },
]

const borrarCliente = async () => {
  const cx = await conectar()
  const [filas] = await cx.query(
    'SELECT id FROM Cliente WHERE organizationId = ? AND nombre = ?', [IDS.org, CLIENTE.nombre])
  for (const f of filas) {
    await cx.execute('DELETE FROM Pago WHERE prestamoId IN (SELECT id FROM Prestamo WHERE clienteId = ?)', [f.id]).catch(() => {})
    await cx.execute('DELETE FROM MovimientoCapital WHERE referenciaId IN (SELECT id FROM Prestamo WHERE clienteId = ?)', [f.id]).catch(() => {})
    await cx.execute('DELETE FROM Prestamo WHERE clienteId = ?', [f.id]).catch(() => {})
    await cx.execute('DELETE FROM Cliente WHERE id = ?', [f.id]).catch(() => {})
  }
  await cx.end()
  return filas.length
}

const token = await encode({
  token: {
    sub: IDS.owner, id: IDS.owner, email: 'demo@ejemplo.com', name: 'Sofía Restrepo',
    rol: 'owner', organizationId: IDS.org, plan: 'professional', country: 'co',
    orgNombre: 'Créditos del Valle', rutaIds: [],
  },
  secret: SECRETO,
})

await correr({
  nombre: 'cliente',
  dir: '/tmp/videos/02-cliente',
  final: '/tmp/videos/02-cliente.mp4',
  tomas: TOMAS,
  cookie: token,
  antesDeToma: borrarCliente,
})
await borrarCliente()
