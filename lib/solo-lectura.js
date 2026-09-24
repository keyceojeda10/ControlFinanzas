/* «VER COMO ESTE COBRADOR» ES DE SOLO LECTURA, Y SE DECIDE AQUÍ — 24 sep 2026.
   El dueño entra a ver la caja y la ruta de su cobrador tal como él las ve. Los
   botones siguen en pantalla para que sea idéntica; lo que no pasa es nada que
   escriba. Una regla, en el portero de todas las /api/, para que ninguna
   pantalla nueva se la salte. Sin imports: corre en el Edge (middleware.js). */
const LECTURA = ['GET', 'HEAD', 'OPTIONS']
// Solo el callback de NextAuth necesita prefijo (/api/auth/callback/<proveedor>).
// El resto es una ruta EXACTA: por prefijo, `/api/auth/signout-foo` o
// `/api/errores-clientes` colaban sin bloquear — un nombre parecido abría en
// silencio cualquier ruta futura.
const SIEMPRE_ABIERTAS_PREFIJO = ['/api/auth/callback/']
const SIEMPRE_ABIERTAS_EXACTA = [
  '/api/auth/signout', '/api/auth/session', '/api/auth/csrf', '/api/auth/_log',
  '/api/ver-como/volver', '/api/errores-cliente',
]

function siempreAbierta(pathname) {
  if (SIEMPRE_ABIERTAS_PREFIJO.some((p) => pathname.startsWith(p))) return true
  return SIEMPRE_ABIERTAS_EXACTA.some((p) => pathname === p || pathname === `${p}/`)
}

export function bloqueaSoloLectura({ soloLectura, pathname, method }) {
  if (!soloLectura || !String(pathname).startsWith('/api/')) return false
  if (LECTURA.includes(String(method).toUpperCase())) return false
  return !siempreAbierta(String(pathname))
}

export function mensajeSoloLectura(nombre) {
  return `Estás viendo como ${nombre}: desde aquí no se registra nada. Vuelve a tu cuenta.`
}
