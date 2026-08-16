import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// app/api/errores-cliente/route.js — que los errores del navegador dejen rastro.
//
// ══ POR QUE EXISTE ═════════════════════════════════════════════════════════
//
// «Cannot access 'O' before initialization» lleva semanas reventando pantallas
// en produccion y NO SE PUEDE DIAGNOSTICAR. Comprobado el 1 de agosto:
//
//   · Los dos logs de PM2 (`cf-error-11`, `cf-error-12`) tienen CERO
//     ocurrencias. Normal: es un error del navegador, y PM2 solo ve el servidor.
//   · No hay Sentry, ni `window.onerror`, ni endpoint, ni tabla de errores.
//
// O sea: la pantalla se cae, el cliente lo sufre, y no queda rastro en ninguna
// parte. Sin el archivo y la linea no hay forma de arreglarlo — solo adivinar.
//
// Esto es lo minimo que convierte un fantasma en un fallo arreglable. NO crea
// tabla ni migracion a proposito: escribe en el log de PM2, que es donde ya
// miramos y donde no hay que mantener nada.
//
// El marcador es fijo para poder buscarlo:
//
//     ssh root@... "grep '\\[ERROR-CLIENTE\\]' /root/.pm2/logs/cf-error-*.log"

export async function POST(req) {
  // Sin sesion no se guarda nada: este endpoint no puede ser un buzon abierto
  // para que cualquiera llene el disco del servidor.
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ ok: false }, { status: 401 })

  // Cuerpo roto o vacio devuelve 400, no 500. Es el mismo fallo que ya tumbo el
  // desembolso de una linea de credito.
  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'Cuerpo invalido' }, { status: 400 })

  const corta = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null)

  // Se recorta todo: un stack sin limite en cada error de cada cliente llena el
  // disco, y con dos mil caracteres sobra para saber donde fue.
  const datos = {
    mensaje: corta(body.mensaje, 300),
    ruta: corta(body.ruta, 200),
    digest: corta(body.digest, 60),
    navegador: corta(body.navegador, 200),
    stack: corta(body.stack, 2000),
    /* ⚠ ESTE ES EL QUE DICE QUIÉN FALLÓ. `stack` viene minificado y son las
       tripas de React —`at l7`, `at o_`—: ni un nombre nuestro. El árbol de
       componentes lo pone React y lo manda `CazadorDeErrores`. Sin él, los 25
       «error #300» de hoy no se pueden atribuir a ninguna pantalla. */
    componentStack: corta(body.componentStack, 1200),
    origen: corta(body.origen, 20),
    org: session.user?.organizationId ?? null,
    usuario: session.user?.id ?? null,
  }

  // `console.error` y no `.log`: asi cae en `cf-error-*.log`, que es el que se
  // lee cuando algo va mal.
  console.error('[ERROR-CLIENTE]', JSON.stringify(datos))

  return Response.json({ ok: true })
}
