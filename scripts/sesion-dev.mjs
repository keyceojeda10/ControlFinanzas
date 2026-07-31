// scripts/sesion-dev.mjs — emite una cookie de sesión para revisar la app en local.
//
// PARA QUÉ: auditar el rediseño pantalla por pantalla necesita ver la app
// LOGUEADA. Verificar componentes sueltos en un banco de pruebas no detecta lo
// que falla al integrarlos — así se colaron tres barras de navegación a la vez
// en escritorio, que en un marco de 390px son invisibles.
//
// QUÉ HACE: firma un JWT de NextAuth con el mismo secreto y los mismos campos
// que produce el callback `jwt` de lib/auth.js, para un usuario que YA existe
// en la base local. No crea cuentas, no usa contraseñas, no toca la base.
//
// SOLO LOCAL. Aborta si DATABASE_URL no apunta a localhost.

import fs from 'node:fs'
import path from 'node:path'

for (const linea of fs.readFileSync('.env', 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const url = new URL(process.env.DATABASE_URL)
if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
  console.error(`ABORTADO: DATABASE_URL apunta a ${url.hostname}, no a local.`)
  process.exit(1)
}

const { default: mariadb } = await import('mariadb')
const { encode } = await import('next-auth/jwt')

const con = await mariadb.createConnection({
  host: '127.0.0.1',
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
  // MySQL 8 usa `caching_sha2_password`, y el driver de MariaDB necesita
  // permiso explícito para pedirle al servidor su clave pública. Sin esto:
  // «RSA public key is not available client side» y el script no arranca.
  //
  // Es seguro AQUÍ y solo aquí: este script aborta si `DATABASE_URL` no apunta
  // a localhost (ver arriba), así que la clave nunca viaja por una red.
  allowPublicKeyRetrieval: true,
})

const [usuario] = await con.query(
  `SELECT u.id, u.email, u.nombre, u.rol, u.organizationId,
          o.plan, o.country, o.nombre AS orgNombre
     FROM User u LEFT JOIN Organization o ON o.id = u.organizationId
    WHERE u.activo = 1 ORDER BY u.createdAt ASC LIMIT 1`
)
await con.end()

if (!usuario) {
  console.error('ABORTADO: no hay ningún usuario en la base local. Regístrate en /registro.')
  process.exit(1)
}

const token = await encode({
  secret: process.env.NEXTAUTH_SECRET,
  maxAge: 8 * 60 * 60,
  token: {
    sub: usuario.id,
    id: usuario.id,
    email: usuario.email,
    name: usuario.nombre,
    nombre: usuario.nombre,
    rol: usuario.rol,
    organizationId: usuario.organizationId,
    plan: usuario.plan ?? 'starter',
    rutaId: null,
    rutaIds: [],
    permisos: null,
    suscripcionVencimiento: null,
    // El onboarding tapa el panel mientras la cartera esté vacía. Para auditar
    // las pantallas hay que pasarlo, y se pasa EN EL TOKEN — sin tocar la base.
    onboardingCompletado: true,
    emailVerificado: true,
    avatarId: null,
    country: usuario.country ?? 'co',
    timezone: null,
    orgNombre: usuario.orgNombre ?? null,
    modoAbreviado: false,
    ocultarSaldoWA: false,
    camposRecibo: null,
    lastRefresh: Date.now(),
  },
})

const salida = path.join('.auditoria', 'sesion.json')
fs.mkdirSync('.auditoria', { recursive: true })
fs.writeFileSync(salida, JSON.stringify({
  cookie: { name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/' },
  usuario: { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
}, null, 2))

console.log(`sesión emitida para ${usuario.email} (${usuario.rol}) → ${salida}`)
