// scripts/video-demo/cuenta-nueva.mjs
//
// Una cuenta RECIÉN CREADA, con el onboarding sin empezar.
//
// ── POR QUÉ NO SE REGISTRA DE VERDAD ───────────────────────────────────────
//
// El vídeo del registro (`v01`) sí se registra, porque el registro ES lo que
// enseña. Pero los vídeos del onboarding necesitan una cuenta nueva EN CADA
// TOMA, y el registro admite tres por hora y por IP: a la cuarta toma la
// pantalla dice «Demasiados intentos» y se graba una toma equivocada.
//
// Así que la cuenta se pone por SQL, con lo justo para que el sistema la trate
// como recién nacida:
//
//   · `onboardingStep = 0` y `onboardingFlujo = null` — el asistente arranca
//     desde la primera pregunta.
//   · `onboardingCompletado = false` en el usuario.
//   · `emailVerificado = 1` — si no, el vídeo sale con la banda roja «Falta
//     verificar tu correo» encima de todas las pantallas.
//   · SIN Capital y SIN clientes: el onboarding pide justo eso.

import { conectar } from './montar-demo.mjs'

export const CUENTA = {
  org: 'zzonboarding0000000000org',
  owner: 'zzonboarding00000000owner',
  correo: 'ana.bedoya@ejemplo.com',
  nombre: 'Ana Lucía Bedoya',
  negocio: 'Créditos El Roble',
}

export async function crearCuentaNueva() {
  const cx = await conectar()
  await borrar(cx)

  await cx.execute(
    `INSERT INTO Organization (id, nombre, plan, activo, country, onboardingStep, onboardingFlujo, createdAt)
     VALUES (?, ?, 'professional', 1, 'co', 0, NULL, NOW())`,
    [CUENTA.org, CUENTA.negocio])

  const HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
  await cx.execute(
    `INSERT INTO User (id, email, password, nombre, rol, organizationId, activo,
        emailVerificado, telefono, onboardingCompletado, terminosAceptados, createdAt)
     VALUES (?, ?, ?, ?, 'owner', ?, 1, 1, '3005556677', 0, 1, NOW())`,
    [CUENTA.owner, CUENTA.correo, HASH, CUENTA.nombre, CUENTA.org])

  /* La suscripción de prueba: sin ella el panel no pinta nada. Ver la nota en
     `montar-demo.mjs` — costó un rato descubrirlo porque no falla, solo sale
     una pantalla en blanco. */
  await cx.execute(
    `INSERT INTO Suscripcion (id, organizationId, plan, estado, fechaInicio, fechaVencimiento, montoCOP, createdAt)
     VALUES (?, ?, 'professional', 'activa', NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY), 0, NOW())`,
    ['zzonboarding000000000susc', CUENTA.org])

  await cx.end()
}

export async function borrarCuentaNueva() {
  const cx = await conectar()
  await borrar(cx)
  await cx.end()
}

async function borrar(cx) {
  const tablas = [
    'ActividadLog', 'AdminLog', 'Notificacion', 'SesionActiva', 'UbicacionLog',
    'PushSubscription', 'PushLog', 'NotaSeguimiento', 'Evento', 'VisitaReagendada',
    'Suscripcion', 'MovimientoCapital', 'Pago', 'Prestamo', 'Cliente',
    'CierreCaja', 'GastoMenor', 'MetodoPago', 'Ruta', 'Capital', 'User', 'Organization',
  ]
  for (const t of tablas) {
    const col = t === 'Organization' ? 'id' : 'organizationId'
    await cx.execute(`DELETE FROM ${t} WHERE ${col} = ?`, [CUENTA.org]).catch(() => {})
  }
}
