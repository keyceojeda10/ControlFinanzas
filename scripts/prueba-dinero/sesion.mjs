// Las dos sesiones de la prueba: el dueño y su cobrador.
//
// Se firma el mismo JWT que emitiría NextAuth al entrar por la pantalla de
// acceso, con el secreto del espejo. Es el molde de
// `.auditoria/sembrar-socios-espejo.mjs`, que ya funciona.
//
// ⚠ EL TOKEN DEL COBRADOR NECESITA `rutaIds` Y `permisos`.
// `pagos/route.js:96` y `renovar/route.js:80` comprueban
// `session.user.rutaIds.includes(...)`. Un token de cobrador sin eso da 403 en
// cada cobro, y desde fuera parecería un fallo de la aplicación cuando es de la
// prueba. La forma de `permisos` está copiada de `lib/auth.js:111-124`.

import { IDS } from './montar.mjs'

const SECRETO = 'prueba-rediseno-2026-no-usar-en-produccion-8f3a1c'

const PERMISOS_COBRADOR = {
  crearPrestamos: true,
  gestionarPrestamos: true,
  crearClientes: true,
  editarClientes: true,
  reportarGastos: true,
  verCapital: true,
  verCapitalRuta: true,
  verSaldoCaja: true,
  gestionarRutas: true,
  aplicarDescuentos: true,
  desembolsarLinea: true,
  reabrirCajaSinAprobacion: true,
}

export async function firmarSesiones() {
  const { encode } = await import('next-auth/jwt')
  const comun = {
    organizationId: IDS.org, plan: 'professional', country: 'co',
    telefono: '3001234567', email: 'x@test.invalid',
  }

  const owner = await encode({
    token: { ...comun, id: IDS.owner, nombre: 'Dueño de prueba', rol: 'owner' },
    secret: SECRETO,
  })

  const cobrador = await encode({
    token: {
      ...comun, id: IDS.cobrador, nombre: 'Cobrador de prueba', rol: 'cobrador',
      rutaIds: [IDS.ruta], rutaId: IDS.ruta, permisos: PERMISOS_COBRADOR,
    },
    secret: SECRETO,
  })

  return { owner, cobrador }
}

/** La cookie tal como la espera el navegador del espejo. */
export function cookieDe(token) {
  return {
    name: 'next-auth.session-token', value: token,
    domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax',
    expires: Math.floor(Date.now() / 1000) + 3600,
  }
}
