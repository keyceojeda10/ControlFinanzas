// scripts/video-demo/montar-demo.mjs
//
// ══ EL NEGOCIO DE MENTIRA QUE SALE EN EL VÍDEO ═════════════════════════════
//
// La gente pide ver cómo funciona el sistema ANTES de comprarlo: 52 leads en
// 45 días, y son los que mejor convierten (23,1% contra 7,5%). Este guion monta
// un negocio inventado para poder grabar la aplicación de verdad sin que salga
// ni un dato de un cliente real.
//
// ⚠ ESCRIBE EN LA BASE. Las guardas de abajo son lo único que lo separa de
//   escribir en producción. No quitarlas ni «un momentito».
//
// La mesa se pone por SQL —no hay endpoint de registro alcanzable desde otra
// organización— y a partir de ahí TODO va por los endpoints reales, para que
// lo que se graba sea el sistema y no una maqueta.

import mysql from 'mysql2/promise'
import { pathToFileURL } from 'url'

export const MARCA = 'Créditos del Valle'
const BASE_ESPERADA = 'prestamos_espejo'

export const IDS = {
  org:      'zzvideodemo000000000000org',
  capital:  'zzvideodemo00000000capital',
  owner:    'zzvideodemo0000000000owner',
  cobrador: 'zzvideodemo00000000cobrador',
  ruta:     'zzvideodemo000000000ruta01',
  cuenta:   'zzvideodemo00000000cuenta1',
  cliente:  (n) => `zzvideodemo00000000cliente${n}`,
}

/* Nombres inventados a propósito: ninguno sale de la base. Direcciones
   genéricas de barrio, sin número real. */
export const CLIENTES = [
  { nombre: 'Marta Elena Ospina',   cedula: '41203877', tel: '3001234501', dir: 'Calle 12 · Barrio El Prado' },
  { nombre: 'Jairo Antonio Peña',   cedula: '79114522', tel: '3001234502', dir: 'Carrera 8 · La Esperanza' },
  { nombre: 'Yaneth Cardona',       cedula: '52830199', tel: '3001234503', dir: 'Calle 30 · San Nicolás' },
  { nombre: 'Óscar Hincapié',       cedula: '10877344', tel: '3001234504', dir: 'Diagonal 4 · El Recreo' },
  { nombre: 'Luz Dary Montoya',     cedula: '43655012', tel: '3001234505', dir: 'Calle 19 · Villa Rosa' },
  { nombre: 'Fabián Quintero',      cedula: '98455170', tel: '3001234506', dir: 'Carrera 15 · Centro' },
  { nombre: 'Rosalba Jiménez',      cedula: '32977641', tel: '3001234507', dir: 'Calle 7 · Los Almendros' },
  { nombre: 'Wilmer Andrés Salas',  cedula: '80122459', tel: '3001234508', dir: 'Carrera 22 · El Bosque' },
]

export async function conectar() {
  const cx = await mysql.createConnection({
    host: '127.0.0.1', port: 3341, user: 'cf_test', password: 'cfTest2026_x7Qm',
    database: BASE_ESPERADA, timezone: 'Z',
  })
  const [[r]] = await cx.query('SELECT DATABASE() db')
  if (r.db !== BASE_ESPERADA) {
    throw new Error(`GUARDA: conectado a "${r.db}" y esto SOLO puede correr en ${BASE_ESPERADA}`)
  }
  return cx
}

export async function limpiar(cx, { silencioso = false } = {}) {
  const [[r]] = await cx.query('SELECT DATABASE() db')
  if (r.db !== BASE_ESPERADA) throw new Error('GUARDA: no es el espejo')

  /* En orden inverso a las dependencias.
  
     ⚠ `ActividadLog` y compañía NO son opcionales: apuntan a `User` y a
     `Organization` con clave foránea, así que sin borrarlos antes el DELETE de
     la organización falla con `ER_ROW_IS_REFERENCED_2`. Estaba tapado por un
     `.catch(() => {})` y el guion decía «montado» sin haber montado nada: el
     segundo intento reventaba con «Duplicate entry».
  
     `CuotaAmortizacion` no tiene `organizationId` — cuelga del préstamo—, así
     que se borra por su relación. */
  await cx.execute(
    `DELETE ca FROM CuotaAmortizacion ca
       JOIN Prestamo p ON p.id = ca.prestamoId
     WHERE p.organizationId = ?`, [IDS.org])

  const tablas = [
    'ActividadLog', 'AdminLog', 'Notificacion', 'SesionActiva', 'UbicacionLog',
    'PushSubscription', 'PushLog', 'NotaSeguimiento', 'Evento', 'VisitaReagendada',
    'Suscripcion', 'MovimientoCapital', 'Pago', 'Prestamo', 'Cliente',
    'CierreCaja', 'GastoMenor', 'MetodoPago', 'Ruta', 'Capital', 'User', 'Organization',
  ]
  const fallos = []
  for (const t of tablas) {
    const col = t === 'Organization' ? 'id' : 'organizationId'
    try {
      await cx.execute(`DELETE FROM ${t} WHERE ${col} = ?`, [IDS.org])
    } catch (e) {
      // Una tabla que no existe o no tiene la columna se salta; lo demás grita.
      if (!['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(e.code)) fallos.push(`${t}: ${e.code}`)
    }
  }
  if (fallos.length) throw new Error(`no se pudo limpiar la demo → ${fallos.join(' · ')}`)
  if (!silencioso) console.log('· demo anterior borrada')
}

export async function montar(cx) {
  await limpiar(cx, { silencioso: true })

  await cx.execute(
    `INSERT INTO Organization (id, nombre, plan, activo, country, createdAt)
     VALUES (?, ?, 'professional', 1, 'co', NOW())`, [IDS.org, MARCA])

  // Hash de relleno: no se usa, se entra por JWT firmado del espejo.
  const HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

  await cx.execute(
    `INSERT INTO User (id, email, password, nombre, rol, organizationId, activo, createdAt)
     VALUES (?, 'demo-owner@ejemplo.invalid', ?, 'Sofía Restrepo', 'owner', ?, 1, NOW())`,
    [IDS.owner, HASH, IDS.org])

  await cx.execute(
    `INSERT INTO User (id, email, password, nombre, rol, organizationId, activo,
        puedeGestionarPrestamos, puedeCrearPrestamos, puedeVerSaldoCaja, puedeReportarGastos, createdAt)
     VALUES (?, 'demo-cobrador@ejemplo.invalid', ?, 'Andrés Vargas', 'cobrador', ?, 1, 1, 1, 1, 1, NOW())`,
    [IDS.cobrador, HASH, IDS.org])

  await cx.execute(
    `INSERT INTO Ruta (id, nombre, organizationId, cobradorId, activo, orden, saldoCapital, createdAt)
     VALUES (?, 'Ruta Centro', ?, ?, 1, 1, 0, NOW())`, [IDS.ruta, IDS.org, IDS.cobrador])

  await cx.execute(
    `INSERT INTO MetodoPago (id, organizationId, nombre, orden, activo, esPredeterminado, esDelCobrador, createdAt)
     VALUES (?, ?, 'Nequi', 0, 1, 1, 0, NOW())`, [IDS.cuenta, IDS.org])

  /* ⚠ SIN SUSCRIPCIÓN EL PANEL SE QUEDA EN BLANCO. Y no falla nada: los datos
     llegan (todas las llamadas responden 200) pero `main` se queda con tres
     nodos y cero texto. Se vio comparando con un negocio real del espejo, que
     sí la tiene. Grabar así habría producido un vídeo con el rótulo «Este es tu
     panel, todo empieza aquí» sobre una pantalla gris. */
  await cx.execute(
    `INSERT INTO Suscripcion (id, organizationId, plan, estado, fechaInicio, fechaVencimiento, montoCOP, createdAt)
     VALUES (?, ?, 'professional', 'activa', NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), 149000, NOW())`,
    ['zzvideodemo00000000000susc', IDS.org])

  // Capital con el que arranca el negocio en el vídeo.
  await cx.execute(
    `INSERT INTO Capital (id, organizationId, saldo, createdAt, updatedAt)
     VALUES (?, ?, 4000000, NOW(), NOW())`, [IDS.capital, IDS.org])
  await cx.execute(`UPDATE Ruta SET saldoCapital = 4000000 WHERE id = ?`, [IDS.ruta])

  /* ⚠ SIN ESTO EL VÍDEO SALE CON DOS BANDERAS ROJAS ENCIMA: «Falta verificar tu
     correo» y «Agrega tu número de celular» acompañan al usuario por todas las
     pantallas hasta resolverlas. En una demostración se leen como un sistema a
     medio configurar. */
  await cx.execute(
    `UPDATE User SET emailVerificado = 1, telefono = '3001234500',
        onboardingCompletado = 1, terminosAceptados = 1, fechaAceptacionTerminos = NOW()
     WHERE organizationId = ?`, [IDS.org])

  /* ⚠ Y EL ONBOARDING, TERMINADO. Sin esto el PANEL SALE EN BLANCO: no falla
     nada —todas las llamadas responden 200— pero el `main` se queda con tres
     nodos y un `<div class="wizard-step-enter">` vacío, porque el sistema cree
     que el negocio aún está configurándose.

     Se ve comparando el HTML con el de un negocio real del espejo. Costó un
     rato precisamente porque no hay ningún error: la pantalla simplemente está
     vacía, y el vídeo salía con el rótulo «Este es tu panel» sobre un gris.

     ⚠ El negocio se monta por SQL, así que le faltan las marcas que el registro
     de verdad va poniendo. El vídeo DEL ONBOARDING no puede usar este atajo:
     tiene que registrarse de verdad, como hace `v01-registro.mjs`. */
  await cx.execute(
    `UPDATE Organization SET onboardingStep = 99 WHERE id = ?`, [IDS.org])

  console.log(`· «${MARCA}» montado — Sofía Restrepo (dueña) · Andrés Vargas (Ruta Centro)`)
  return IDS
}

/* ⚠ `file://${process.argv[1]}` NO vale aquí: la carpeta del proyecto lleva un
   espacio («Control Finanzas») y `import.meta.url` lo trae como %20, así que la
   comparación fallaba en silencio y el guion salía con código 0 sin hacer nada.
   `pathToFileURL` codifica igual que Node. */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cx = await conectar()
  if (process.argv.includes('--limpiar')) await limpiar(cx)
  else await montar(cx)
  await cx.end()
}
