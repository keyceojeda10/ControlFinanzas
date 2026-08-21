// scripts/video-demo/v01-registro.mjs
//
// VÍDEO 1 · Cómo registrarse en el sistema
//
//     node scripts/video-demo/v01-registro.mjs            # todas y pega
//     node scripts/video-demo/v01-registro.mjs --toma 3   # solo la 3
//     node scripts/video-demo/v01-registro.mjs --pegar
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
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaPaso(u, 1)
      empezar()
      await decir('Crear tu cuenta son cuatro pasos', 4.0)
      await esperar(4400)
      await mirar('text=Paso 1 de 4', { escala: 1.8, ms: 3800 })
      await decir('Arriba te va diciendo por cuál vas', 3.8)
      await esperar(4000)
      await reposo()
    },
  },
  {
    id: 'nombre',
    titulo: 'Paso 1 · tu nombre',
    async grabar(u) {
      const { esperar, escribir, tocar, empezar, decir, mirar, reposo } = u
      await hastaPaso(u, 1)
      empezar()
      await mirar('input[type="text"]', { escala: 1.9, ms: 3800 })
      await decir('Lo primero, tu nombre', 3.4)
      await esperar(3800)
      await escribir('input[type="text"]', D.nombre)
      await decir('Es el que verás dentro de la aplicación', 4.0)
      await esperar(4200)
      // Se pulsa y se VE pasar al siguiente paso.
      await tocar('Continuar')
      await reposo()
    },
  },
  {
    id: 'negocio',
    titulo: 'Paso 2 · el negocio',
    async grabar(u) {
      const { esperar, escribir, tocar, empezar, decir, reposo } = u
      await hastaPaso(u, 2)
      empezar()
      await decir('Ahora el nombre de tu negocio', 3.6)
      await esperar(4000)
      await escribir('input[type="text"]', D.negocio)
      await decir('Este sí importa: es el que ven tus clientes y tus cobradores', 4.8)
      await esperar(5000)
      await tocar('Continuar')
      await reposo()
    },
  },
  {
    id: 'whatsapp',
    titulo: 'Paso 3 · país y WhatsApp',
    async grabar(u) {
      const { esperar, escribir, tocar, empezar, decir, mirar, reposo } = u
      await hastaPaso(u, 3)
      empezar()
      await mirar('select', { escala: 1.7, ms: 4200 })
      await decir('Eliges tu país: el sistema trabaja en doce', 4.2)
      await esperar(4600)
      await escribir('input[type="tel"]', D.telefono)
      await decir('Y tu WhatsApp: por ahí te llega el código para verificar', 4.8)
      await esperar(5000)
      await tocar('Continuar')
      await reposo()
    },
  },
  {
    id: 'cuenta',
    titulo: 'Paso 4 · correo y contraseña',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, reposo } = u
      await hastaPaso(u, 4)
      empezar()
      await decir('El último paso son tus datos de entrada', 4.0)
      await esperar(4200)
      await escribir('input[type="email"]', CORREO)
      await decir('El correo va a ser tu usuario: pon uno al que entres de verdad', 4.8)
      await esperar(4600)
      await escribir('input[type="password"]', D.clave)
      await decir('Y una contraseña de mínimo ocho caracteres', 4.0)
      await esperar(4400)
      await reposo()
    },
  },
  {
    id: 'terminos',
    titulo: 'La casilla de los términos',
    async grabar(u) {
      const { p, esperar, escribir, empezar, decir, mirar, reposo } = u
      await hastaPaso(u, 4)
      await escribir('input[type="email"]', CORREO)
      await escribir('input[type="password"]', D.clave)
      empezar()
      /* Es donde más gente se traba: el botón no hace nada hasta marcarla, y no
         lo dice. Merece su propia parada. */
      await mirar('input[type="checkbox"]', { escala: 2.2, ms: 4600 })
      await decir('Ojo con este cuadrito: hay que aceptar los términos', 4.4)
      await esperar(4800)
      await p.locator('input[type="checkbox"]').first().check().catch(() => {})
      await decir('Si no lo marcas, el botón de abajo no te deja seguir', 4.6)
      await esperar(4800)
      await reposo()
    },
  },
  {
    id: 'crear',
    titulo: 'Crear la cuenta',
    async grabar(u) {
      const { p, esperar, escribir, tocar, empezar, decir, mirar, reposo } = u
      await hastaPaso(u, 4)
      await escribir('input[type="email"]', CORREO)
      await escribir('input[type="password"]', D.clave)
      await p.locator('input[type="checkbox"]').first().check().catch(() => {})
      empezar()
      await mirar('button:has-text("Crear cuenta gratis")', { escala: 1.7, ms: 4000 })
      await decir('Y ya está: «Crear cuenta gratis»', 3.8)
      await esperar(4200)
      await tocar('Crear cuenta gratis', { espera: 3200 })
      await decir('Catorce días completos, sin poner ninguna tarjeta', 4.4)
      await esperar(4600)
      await reposo()
    },
  },
  {
    id: 'verificar',
    titulo: 'La verificación',
    async grabar(u) {
      const { p, esperar, escribir, tocar, empezar, decir, mirar, reposo } = u
      await hastaPaso(u, 4)
      await escribir('input[type="email"]', CORREO)
      await escribir('input[type="password"]', D.clave)
      await p.locator('input[type="checkbox"]').first().check().catch(() => {})
      await tocar('Crear cuenta gratis', { espera: 3400 })
      empezar()
      await decir('Al terminar te llega un código de seis dígitos por WhatsApp', 4.8)
      await esperar(5000)
      try {
        await mirar('button:has-text("Verificar por correo")', { escala: 1.8, ms: 4000 })
        await decir('Si no te llega, puedes pedirlo al correo', 4.0)
        await esperar(4400)
      } catch { /* si cambia el rótulo, la toma sigue sin ese acercamiento */ }
      await reposo()
    },
  },
  {
    id: 'cierre',
    titulo: 'Dónde te deja',
    async grabar(u) {
      const { p, esperar, escribir, tocar, empezar, decir, mirar, reposo } = u
      await hastaPaso(u, 4)
      await escribir('input[type="email"]', CORREO)
      await escribir('input[type="password"]', D.clave)
      await p.locator('input[type="checkbox"]').first().check().catch(() => {})
      await tocar('Crear cuenta gratis', { espera: 3400 })
      empezar()
      await mirar('button:has-text("Saltar por ahora")', { escala: 1.8, ms: 4000 })
      await decir('Y si tienes prisa, entras ya y verificas después', 4.4)
      await esperar(4600)
      /* ⚠ AQUÍ TERMINA EL PROCESO. El vídeo se cortaba en la verificación y no
         se veía a dónde llega uno. Ahora se entra y se enseña la guía de
         primeros pasos, que es el vídeo siguiente. */
      await tocar('Saltar por ahora', { espera: 4200 })
      await decir('Ya estás dentro, y el sistema te recibe con una guía', 4.8)
      await esperar(5000)
      await decir('Eso es lo que vemos en el siguiente vídeo', 4.2)
      await esperar(4400)
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
  dir: '/tmp/videos/01-registro',
  final: '/tmp/videos/01-registro.mp4',
  tomas: TOMAS,
  antesDeToma: borrarCuenta,
})
await borrarCuenta()
