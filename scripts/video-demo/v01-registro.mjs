// scripts/video-demo/v01-registro.mjs
//
// VÍDEO 1 · Cómo registrarse en el sistema
//
//     node scripts/video-demo/voz.mjs 01-registro --solo-audio
//     BASE_VIDEO=http://localhost:3105 SIN_ROTULOS=1 LOCUCION=01-registro \
//       node scripts/video-demo/v01-registro.mjs
//
//     ... --toma 3    solo la 3        ... --pegar   solo volver a pegar
//
// ⚠ EL AUDIO VA PRIMERO. `narrar` mide la duración de cada mp3 para saber
//   cuánto dura cada frase; sin los mp3 usa 4,2 s estimados y el ritmo vuelve
//   a quedar largo, que es de lo que se quejó el dueño («el ritmo está muy
//   lento»: 3:57 de vídeo con 2:26 de voz, 76 segundos de silencio).
//
// ⚠ SE REESCRIBIÓ A `narrar()` el 25 ago 2026. Antes era `decir()` + `esperar()`
//   con los tiempos a mano, que es lo que dejaba los huecos.
//
// ⚠ Se registra una cuenta DE VERDAD, en el espejo, con un correo de
//   `ejemplo.com` (reservado por norma para documentación). Se borra antes y
//   después de cada toma.
//
// ⚠ El registro admite 3 cuentas por hora y por IP, y cada toma crea la suya:
//   hay que REINICIAR EL ESPEJO antes de grabar entero.
//       bash .auditoria/arrancar-espejo.sh

import { correr } from './grabador.mjs'
import { conectar } from './montar-demo.mjs'

const CORREO = 'carlos.mejia@ejemplo.com'
const D = {
  nombre: 'Carlos Andrés Mejía',
  negocio: 'Créditos La Cosecha',
  telefono: '3009998877',
  clave: 'MiClaveSegura2026',
}

/** Rellena los pasos previos sin grabarlos (se recortan con `empezar`). */
const hastaPaso = async ({ ir, escribir, tocar }, n) => {
  await ir('/registro', /Paso 1 de 4/)
  if (n > 1) { await escribir('input[type="text"]', D.nombre); await tocar('Continuar') }
  if (n > 2) { await escribir('input[type="text"]', D.negocio); await tocar('Continuar') }
  if (n > 3) { await escribir('input[type="tel"]', D.telefono); await tocar('Continuar') }
}

const TOMAS = [
  {
    id: 'entrada',
    titulo: 'La pantalla de registro',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo } = u
      await hastaPaso(u, 1)
      empezar()
      await esperar(600)
      await narrar(0)
      await narrar(1, { mirar: 'text=Paso 1 de 4', escala: 1.8 })
      await reposo(1400)
    },
  },
  {
    id: 'nombre',
    titulo: 'Paso 1 · tu nombre',
    async grabar(u) {
      const { esperar, escribir, tocar, empezar, narrar, reposo } = u
      await hastaPaso(u, 1)
      empezar()
      await esperar(500)
      await narrar(0, { mirar: 'input[type="text"]', escala: 1.9 })
      await narrar(1, { hacer: async () => { await escribir('input[type="text"]', D.nombre) } })
      // Se pulsa y se VE pasar al siguiente paso.
      await tocar('Continuar')
      await reposo(1400)
    },
  },
  {
    id: 'negocio',
    titulo: 'Paso 2 · el negocio',
    async grabar(u) {
      const { esperar, escribir, tocar, empezar, narrar, reposo } = u
      await hastaPaso(u, 2)
      empezar()
      await esperar(500)
      await narrar(0, { hacer: async () => { await escribir('input[type="text"]', D.negocio) } })
      await narrar(1)
      await tocar('Continuar')
      await reposo(1400)
    },
  },
  {
    id: 'whatsapp',
    titulo: 'Paso 3 · país y WhatsApp',
    async grabar(u) {
      const { esperar, escribir, tocar, empezar, narrar, reposo } = u
      await hastaPaso(u, 3)
      empezar()
      await esperar(500)
      await narrar(0, { mirar: 'select', escala: 1.7 })
      await narrar(1, { hacer: async () => { await escribir('input[type="tel"]', D.telefono) } })
      await tocar('Continuar')
      await reposo(1400)
    },
  },
  {
    id: 'cuenta',
    titulo: 'Paso 4 · correo y contraseña',
    async grabar(u) {
      const { esperar, escribir, empezar, narrar, reposo } = u
      await hastaPaso(u, 4)
      empezar()
      await esperar(500)
      await narrar(0)
      await narrar(1, { hacer: async () => { await escribir('input[type="email"]', CORREO) } })
      await narrar(2, { hacer: async () => { await escribir('input[type="password"]', D.clave) } })
      await reposo(1500)
    },
  },
  {
    id: 'terminos',
    titulo: 'La casilla de los términos',
    async grabar(u) {
      const { p, esperar, escribir, empezar, narrar, reposo } = u
      await hastaPaso(u, 4)
      await escribir('input[type="email"]', CORREO)
      await escribir('input[type="password"]', D.clave)
      empezar()
      await esperar(500)
      /* Es donde más gente se traba: el botón no hace nada hasta marcarla, y no
         lo dice. Merece su propia parada. */
      await narrar(0, { mirar: 'input[type="checkbox"]', escala: 2.2 })
      await narrar(1, {
        hacer: async () => { await p.locator('input[type="checkbox"]').first().check().catch(() => {}) },
      })
      await reposo(1600)
    },
  },
  {
    id: 'crear',
    titulo: 'Crear la cuenta',
    async grabar(u) {
      const { p, esperar, escribir, tocar, empezar, narrar, reposo } = u
      await hastaPaso(u, 4)
      await escribir('input[type="email"]', CORREO)
      await escribir('input[type="password"]', D.clave)
      await p.locator('input[type="checkbox"]').first().check().catch(() => {})
      empezar()
      await esperar(500)
      await narrar(0, {
        mirar: 'button:has-text("Crear cuenta gratis")', escala: 1.7,
        hacer: async () => { await tocar('Crear cuenta gratis', { espera: 3200 }) },
      })
      await narrar(1)
      await reposo(1600)
    },
  },
  {
    id: 'verificar',
    titulo: 'La verificación',
    async grabar(u) {
      const { p, esperar, escribir, tocar, empezar, narrar, mirar, reposo } = u
      await hastaPaso(u, 4)
      await escribir('input[type="email"]', CORREO)
      await escribir('input[type="password"]', D.clave)
      await p.locator('input[type="checkbox"]').first().check().catch(() => {})
      await tocar('Crear cuenta gratis', { espera: 3400 })
      empezar()
      await esperar(500)
      await narrar(0)
      /* ⚠ EL ACERCAMIENTO VA DENTRO DE `hacer` Y CON `.catch`, no en `mirar`:
         si el rótulo cambia, `narrar` no lo perdona y se cae la toma entera.
         Antes esto era un `try/catch` alrededor del `decir`. */
      await narrar(1, {
        hacer: async () => {
          await mirar('button:has-text("Verificar por correo")', { escala: 1.8, ms: 3000 })
            .catch(() => {})
        },
      })
      await reposo(1600)
    },
  },
  {
    id: 'cierre',
    titulo: 'Dónde te deja',
    async grabar(u) {
      const { p, esperar, escribir, tocar, empezar, narrar, reposo } = u
      await hastaPaso(u, 4)
      await escribir('input[type="email"]', CORREO)
      await escribir('input[type="password"]', D.clave)
      await p.locator('input[type="checkbox"]').first().check().catch(() => {})
      await tocar('Crear cuenta gratis', { espera: 3400 })
      empezar()
      await esperar(500)
      /* ⚠ AQUÍ TERMINA EL PROCESO. El vídeo se cortaba en la verificación y no
         se veía a dónde llega uno. Ahora se entra y se enseña la guía de
         primeros pasos, que es el vídeo siguiente. */
      await narrar(0, {
        mirar: 'button:has-text("Saltar por ahora")', escala: 1.8,
        hacer: async () => { await tocar('Saltar por ahora', { espera: 4200 }) },
      })
      await narrar(1)
      await narrar(2)
      await reposo(3200)
    },
  },
]

const borrarCuenta = async () => {
  const cx = await conectar()
  const [[u]] = await cx.query('SELECT organizationId FROM User WHERE email = ?', [CORREO])
  if (u) {
    for (const t of ['ActividadLog', 'Notificacion', 'SesionActiva', 'Capital', 'Ruta', 'User', 'Organization']) {
      const col = t === 'Organization' ? 'id' : 'organizationId'
      await cx.execute(`DELETE FROM ${t} WHERE ${col} = ?`, [u.organizationId]).catch(() => {})
    }
  }
  await cx.end()
}

await correr({
  nombre: 'registro',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-01',
  final: '/home/keyce/Desktop/videos-tutoriales/01-registro.mp4',
  tomas: TOMAS,
  antesDeToma: borrarCuenta,
})
await borrarCuenta()
