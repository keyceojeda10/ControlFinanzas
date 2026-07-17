import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-secret')
const COOKIE_NAME = 'portal-token'
const MAX_AGE = 24 * 60 * 60 // 24 horas

export { COOKIE_NAME }

export async function createPortalToken(cliente) {
  return new SignJWT({
    clienteId: cliente.id,
    organizationId: cliente.organizationId,
    nombre: cliente.nombre,
    tipo: 'portal',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(SECRET)
}

export async function verifyPortalToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    if (payload.tipo !== 'portal') return null
    return payload
  } catch {
    return null
  }
}

export function portalCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  }
}

export async function getPortalSession(request) {
  const cookie = request.cookies?.get?.(COOKIE_NAME)
  if (!cookie?.value) return null
  return verifyPortalToken(cookie.value)
}

export async function getPortalSessionFromHeaders(cookieHeader) {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  if (!match) return null
  return verifyPortalToken(match[1])
}
