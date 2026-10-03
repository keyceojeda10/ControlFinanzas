/* ENTRAR CON HUELLA O CARA (3 oct 2026).
 *
 * WebAuthn («llaves de acceso»): el teléfono revisa la huella o la cara —o su
 * patrón, si no tiene lector— y firma un reto. Aquí solo se guarda la llave
 * PÚBLICA de cada teléfono (`LlaveAcceso`); la huella nunca sale de él.
 *
 * Sin estado en el servidor: el reto viaja SELLADO con el mismo pase firmado de
 * «Ver como» (lib/pase-de-vista.js), y al entrar se devuelve un pase de 60 s que
 * canjea el proveedor `huella` de NextAuth, con las mismas revisiones que la
 * contraseña (lib/auth-sesion.js).
 *
 * Un reto sirve UNA vez por llave (`ultimoReto`): muchos teléfonos no suben el
 * contador, así que el contador solo no impide repetir una firma vieja.
 */
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import { prisma } from '@/lib/prisma'
import { firmarPase, leerPase } from '@/lib/pase-de-vista'

const SECRETO = () => process.env.NEXTAUTH_SECRET
const VIDA_RETO_MS = 3 * 60 * 1000 // lo que tarda alguien en poner el dedo, con margen
const aTexto = (bytes) => Buffer.from(bytes).toString('base64url')
const aBytes = (texto) => new Uint8Array(Buffer.from(String(texto), 'base64url'))

/** El sitio que ve el teléfono: el dominio de NEXTAUTH_URL (en el espejo, localhost). */
export function sitio() {
  const url = new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000')
  return { rpID: url.hostname, origin: url.origin, rpName: 'Control Finanzas' }
}

/** Paso 1 de activar: lo que el teléfono necesita para crear la llave. */
export async function opcionesActivar(usuario) {
  const { rpID, rpName } = sitio()
  const ya = await prisma.llaveAcceso.findMany({ where: { userId: usuario.id }, select: { credencialId: true, transportes: true } })
  const opciones = await generateRegistrationOptions({
    rpName, rpID,
    userName: usuario.email || usuario.id,
    userDisplayName: usuario.nombre || usuario.email || 'Usuario',
    userID: new TextEncoder().encode(usuario.id),
    attestationType: 'none',
    // Un teléfono que ya la tiene no la crea dos veces.
    excludeCredentials: ya.map((l) => ({ id: l.credencialId, transports: l.transportes ? l.transportes.split(',') : undefined })),
    // `platform`: la del propio teléfono (huella, cara, patrón), no una llave USB.
    // `residentKey`: para entrar sin escribir el correo.
    authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'required', userVerification: 'required' },
  })
  const sello = firmarPase({ tipo: 'reto-activar', reto: opciones.challenge, userId: usuario.id }, SECRETO(), Date.now(), VIDA_RETO_MS)
  return { opciones, sello }
}

/** Paso 2 de activar: revisa la firma del teléfono y guarda su llave pública. */
export async function guardarActivacion({ userId, sello, respuesta, dispositivo }) {
  const s = leerPase(sello, SECRETO())
  if (!s || s.tipo !== 'reto-activar' || s.userId !== userId) return { error: 'Se venció. Vuelve a tocar «Activar».' }
  const { rpID, origin } = sitio()
  let r
  try {
    r = await verifyRegistrationResponse({
      response: respuesta, expectedChallenge: s.reto, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
    })
  } catch { return { error: 'El teléfono no confirmó la huella. Vuelve a intentarlo.' } }
  if (!r.verified || !r.registrationInfo) return { error: 'El teléfono no confirmó la huella. Vuelve a intentarlo.' }
  const c = r.registrationInfo.credential
  await prisma.llaveAcceso.create({
    data: {
      userId,
      credencialId: c.id,
      llavePublica: aTexto(c.publicKey),
      contador: c.counter ?? 0,
      transportes: c.transports?.length ? c.transports.join(',') : null,
      dispositivo: dispositivo ? String(dispositivo).slice(0, 120) : null,
    },
  })
  return { ok: true }
}

/** Paso 1 de entrar: un reto para cualquier llave de este sitio (sin correo). */
export async function opcionesEntrar() {
  const { rpID } = sitio()
  const opciones = await generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: [] })
  const sello = firmarPase({ tipo: 'reto-entrar', reto: opciones.challenge }, SECRETO(), Date.now(), VIDA_RETO_MS)
  return { opciones, sello }
}

/** Paso 2 de entrar: revisa la firma y devuelve el pase de 60 s para NextAuth. */
export async function verificarEntrada({ sello, respuesta }) {
  const s = leerPase(sello, SECRETO())
  if (!s || s.tipo !== 'reto-entrar') return { error: 'Se venció. Vuelve a tocar «Entrar con huella».' }
  const llave = await prisma.llaveAcceso.findUnique({ where: { credencialId: String(respuesta?.id ?? '') } })
  if (!llave) return { error: 'Este teléfono no tiene la huella activada. Entra con tu correo y contraseña, y actívala en tu perfil.' }
  const { rpID, origin } = sitio()
  let r
  try {
    r = await verifyAuthenticationResponse({
      response: respuesta, expectedChallenge: s.reto, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
      credential: {
        id: llave.credencialId, publicKey: aBytes(llave.llavePublica), counter: llave.contador,
        transports: llave.transportes ? llave.transportes.split(',') : undefined,
      },
    })
  } catch { return { error: 'No se pudo confirmar la huella. Vuelve a intentarlo.' } }
  if (!r.verified) return { error: 'No se pudo confirmar la huella. Vuelve a intentarlo.' }
  // El reto, una sola vez: si dos peticiones traen la misma firma, gana una.
  const usado = await prisma.llaveAcceso.updateMany({
    where: { id: llave.id, OR: [{ ultimoReto: null }, { ultimoReto: { not: s.reto } }] },
    data: { ultimoReto: s.reto, contador: r.authenticationInfo.newCounter, usadaEn: new Date() },
  })
  if (usado.count !== 1) return { error: 'Esa confirmación ya se usó. Vuelve a intentarlo.' }
  // De quién es, para que el teléfono sepa DE QUÉ CUENTA es su huella y la use
  // al tocar esa tarjeta guardada (que también guarda el `userId`), no otra.
  return { pase: firmarPase({ tipo: 'huella', userId: llave.userId }, SECRETO()), userId: llave.userId }
}
