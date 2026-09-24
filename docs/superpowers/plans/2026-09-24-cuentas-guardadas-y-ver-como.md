# Cuentas guardadas y «Ver como este cobrador» — Plan de implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** cambiar la casilla muerta «Mantener la sesión en este teléfono» por cuentas guardadas de un toque (PIN para dueño y superadmin), y darle al dueño una vista de solo lectura como su cobrador.

**Arquitectura:**
- **Cuentas guardadas.** Una tabla `CuentaGuardada` guarda la huella de una llave aleatoria por aparato. La llave vive en `localStorage` y se canjea con un proveedor nuevo de NextAuth.
- **«Ver como» y «volver».** Usan un pase firmado de 60 s: lo emite una ruta del API que sí ve la sesión y lo canjea un proveedor de NextAuth.
- **Solo lectura.** Es una regla pura aplicada en `middleware.js` a toda `/api/*`.
- **Revisiones al entrar.** Las que hoy viven dentro del `authorize` de contraseña se sacan a `lib/auth-sesion.js`, y las cuatro entradas las comparten.

**Tecnología:** Next.js 15 (App Router, JS/JSX, **sin TypeScript**), Prisma 7.8 + MariaDB, NextAuth v4 (JWT), bcryptjs, `crypto` de Node, vitest 4.

**Spec:** `docs/superpowers/specs/2026-09-24-cuentas-guardadas-y-ver-como-design.md`

**Desvíos del spec, a propósito:**
- «Ver como» y «volver» no leen el token con `getToken(req)` dentro de `authorize`, porque en NextAuth v4 ese `req` no trae las cookies de forma fiable. En su lugar hay un pase firmado de 60 s que emite una ruta del API.
- En el teléfono, la llave se llama `llave`, no `token`, y la tarjeta guarda también `userId`, para no duplicar a la misma persona.
- La vuelta sola a la hora tiene dos partes:
  - el servidor la hace en el callback `jwt`;
  - la franja la dispara en el navegador, porque `components/providers/SessionProvider.jsx` arranca con la sesión guardada en `localStorage['cf-session-cache']` y nunca vuelve a pedirla sola.

## Restricciones globales

- JS y JSX sin TypeScript: una función inexistente pasa el build y revienta en producción. Cada nombre usado en una tarea está definido en su bloque «Produce».
- DESIGN.md es ley:
  - radios 8/10/12/16/20;
  - colores solo por tokens (`var(--cf-…)`);
  - nada de emojis en la interfaz (SVG en línea);
  - no tocar la barra de navegación (la pill);
  - nunca recortar el nombre de una persona;
  - inputs a 16px o más (iOS hace zoom si son más pequeños);
  - el dorado solo en tres cosas: el monto principal, la acción primaria y el foco del campo activo. Las tarjetas de cuentas, sus iniciales, los enlaces y la franja de la vista van en tinta y gris.
- Textos al usuario en español de Colombia y con la palabra común. Mensajes exactos:
  - `CUENTA_NO_VALE` = «Esta cuenta guardada ya no vale en este teléfono. Entra con tu correo y contraseña.»
  - `PIN_AGOTADO` = «Demasiados PIN errados: quitamos esta cuenta del teléfono. Entra con tu correo y contraseña.»
  - solo lectura = «Estás viendo como {nombre}: desde aquí no se registra nada. Vuelve a tu cuenta.»
- Números fijos:
  - la llave: 32 bytes base64url, guardada en el servidor como SHA-256 hex;
  - el PIN: 4 dígitos, guardado con bcrypt costo 10;
  - 5 intentos de PIN;
  - 60 días de vigencia sin uso;
  - pase de 60 s;
  - vista de 1 hora;
  - la sesión sigue en 8 h.
- Pide PIN el rol `owner` y el `superadmin`. El `cobrador` entra con un toque.
- Producción se lee, no se escribe: el `CREATE TABLE` en producción es parte del despliegue (tarea 10), con orden del dueño ya dada para esta tanda.
- Espejo: arrancar siempre con `bash .auditoria/arrancar-espejo.sh`, con el túnel `ssh -f -N -L 3341:127.0.0.1:3306 root@69.62.87.141`. Escribir solo en la cuenta de prueba: org `cmm7iigyr00011t2rwyg9luph`, dueño `cmm7iigz600031t2rqrfksymp`, cobrador `cmns7uq37000tr7skx1pksedh`.
- Verificación de cada tarea: `npx vitest run <prueba>`. Antes de desplegar: `npx vitest run`, `npx next build` y `npx eslint app components`, cuya línea base es 53 problemas y 9 errores; no se admiten errores nuevos.
- Los commits terminan con `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Las pruebas se anclan en código, no en comentarios: este repo cita a los clientes en los comentarios.

## Foco de revisión

Estos casos no los cubre la prueba natural de ninguna tarea. Cada uno tiene su prueba añadida en la tarea dueña:

1. **`localStorage` bloqueado** (modo privado, Safari con almacenamiento lleno). La pantalla de entrada debe ser el formulario de siempre, sin romperse. Prueba en la tarea 5 (`leerCuentasGuardadas` con `localStorage` que lanza devuelve `[]`).
2. **Dos cuentas en el mismo teléfono** (dueño y su cobrador, o la misma persona guardada dos veces). Guardar otra vez la misma persona reemplaza su tarjeta, no la duplica. Prueba en la tarea 5.
3. **Cobros pendientes del dueño sin subir al entrar en «ver como».** No se pueden sincronizar con la sesión del cobrador. El portero los rechazaría con 403 y `sincronizarPagos` los marcaría como fallidos. Prueba en la tarea 9: las cuatro sincronizaciones (`sincronizarPagos`, `sincronizarOrdenes`, `sincronizarCreaciones` y `sincronizarMutaciones`) devuelven `{ synced: 0, failed: 0 }` con `estaEnSoloLectura()`.
4. **La hora de vista se cumple sin red, o el dueño ya no existe.** La sesión sigue en solo lectura: nunca vuelve a una cuenta con permiso de escribir sin haber podido revisarla. Prueba en la tarea 8 (`volverSiVencio` sin dueño deja el token igual). La franja no entra en bucle de recargas: solo navega si la sesión nueva ya no está en solo lectura (tarea 9).
5. **Un pase de vista reutilizado o vencido.** Se rechaza. Prueba en la tarea 7 (`leerPase` con `exp` pasado da `null`, igual que con la firma alterada).

---

## Mapa de ficheros

| Fichero | Responsabilidad |
|---|---|
| `prisma/schema.prisma` | modelo `CuentaGuardada` + relación en `User` |
| `lib/cuentas-guardadas-textos.js` (nuevo) | los dos mensajes que el cliente también reconoce |
| `lib/cuentas-guardadas.js` (nuevo, servidor) | llave, huella, PIN, vigencia; crear, abrir, quitar, cortar |
| `lib/cuentas-guardadas-cliente.js` (nuevo, navegador) | lista de cuentas en `localStorage` |
| `lib/dispositivo.js` (nuevo) | «iPhone · Safari» desde el user-agent (se saca de `api/sesiones`) |
| `lib/auth-sesion.js` (nuevo) | revisiones de cuenta y armado de la sesión, compartidos |
| `lib/pase-de-vista.js` (nuevo) | pase firmado HMAC de 60 s |
| `lib/solo-lectura.js` (nuevo, edge) | regla pura del middleware |
| `lib/cambio-de-cuenta.js` (nuevo, navegador) | vaciar lecturas en caché (y la sesión guardada) al cambiar de identidad |
| `lib/modo-vista.js` (nuevo, navegador) | la marca de solo lectura del teléfono: `marcarSoloLectura`, `estaEnSoloLectura` |
| `lib/token-de-sesion.js` (nuevo) | `copiarAlToken` y `volverSiVencio`, que usa el callback `jwt` |
| `lib/auth.js` | proveedores `cuenta-guardada` y `pase`; callbacks `jwt`/`session` |
| `middleware.js` | aplica `bloqueaSoloLectura` |
| `lib/offline.js` | `borrarCacheDeLecturas`; nada se guarda ni se sincroniza en vista |
| `lib/push-cliente.js` | no suscribe en vista |
| `app/(dashboard)/actividad/page.jsx` | icono `eye` para el Historial |
| `app/api/cuentas-guardadas/route.js` (nuevo) | GET, POST y DELETE de las propias |
| `app/api/cuentas-guardadas/[id]/route.js` (nuevo) | DELETE con la llave (la «x», sin sesión) |
| `app/api/cobradores/[id]/cuentas-guardadas/route.js` (nuevo) | GET y DELETE del dueño sobre su cobrador |
| `app/api/ver-como/route.js` (nuevo) | emite el pase «ver-como» |
| `app/api/ver-como/volver/route.js` (nuevo) | emite el pase «volver» |
| 4 rutas que cambian contraseña | cortan las cuentas guardadas |
| `app/login/page.jsx` + `components/auth/CuentasGuardadas.jsx` + `components/auth/PinDeCuatro.jsx` | la pantalla de entrada |
| `components/cuentas/TelefonosGuardados.jsx` | lista de aparatos con «Quitar» (Configuración y ficha del cobrador) |
| `components/cobradores/BotonVerComo.jsx`, `components/armazon/FranjaVerComo.jsx` | entrar y salir de la vista |
| `components/providers/SesionTracker.jsx` | no registrar en vista; sincronizar la marca de solo lectura |
| `lib/activity-log-types.js` | `ver_como_cobrador` |

---

### Tarea 1: la tabla y la lógica de la llave (servidor)

**Ficheros:**
- Modificar: `prisma/schema.prisma` (modelo nuevo; relación en `model User`)
- Crear: `lib/cuentas-guardadas-textos.js`, `lib/cuentas-guardadas.js`
- Prueba: `lib/__tests__/cuentas-guardadas.test.js`

**Interfaces:**
- Consume: nada.
- Produce:
  - `lib/cuentas-guardadas-textos.js`:
    - `CUENTA_NO_VALE: string`, `PIN_AGOTADO: string`
    - `esMensajeDeCuentaMuerta(msg) → boolean`
  - `lib/cuentas-guardadas.js`:
    - `DIAS_VIGENCIA = 60`, `MAX_INTENTOS_PIN = 5`
    - `llevaPin(rol) → boolean`, `pinValido(pin) → boolean`
    - `generarLlave() → string`, `huellaDeLlave(llave) → string(hex)`
    - `llaveCoincide(llave, tokenHash) → boolean`, `vencida(lastUsedAt, ahora?) → boolean`
    - `crearCuentaGuardada({ userId, rol, pin, dispositivo }) → Promise<{ id, llave }>`
    - `abrirCuentaGuardada({ id, llave, pin }, ahora?) → Promise<userId>`; lanza `Error` con mensaje para la persona
    - `quitarConLlave({ id, llave }) → Promise<boolean>`
    - `cortarCuentasGuardadas(userId) → Promise<void>`

- [ ] **Paso 1: el modelo en el esquema**

En `prisma/schema.prisma`, dentro de `model User { … }`, junto a las demás relaciones, añadir la línea:

```prisma
  cuentasGuardadas CuentaGuardada[]
```

Y al final del fichero:

```prisma
// Una cuenta guardada en UN teléfono: la llave aleatoria vive en el aparato
// (localStorage) y aquí solo su huella SHA-256. El PIN (dueño y superadmin)
// va con bcrypt. Revocar = borrar la fila. Ver lib/cuentas-guardadas.js.
model CuentaGuardada {
  id          String   @id @default(cuid())
  userId      String
  tokenHash   String   @unique
  pinHash     String?
  intentosPin Int      @default(0)
  dispositivo String?
  createdAt   DateTime @default(now())
  lastUsedAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

- [ ] **Paso 2: generar el cliente y crear la tabla en el espejo**

```bash
npx prisma generate
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > .auditoria/_diff-cuentaguardada.sql
grep -n 'CuentaGuardada' .auditoria/_diff-cuentaguardada.sql
```

Leer el SQL completo. Copiar a `.auditoria/_create-cuentaguardada.sql` (`.auditoria/` no va a git), sin tocar nada más, estas dos sentencias:
- el `CREATE TABLE \`CuentaGuardada\``, con el índice único `CuentaGuardada_tokenHash_key`, el índice `CuentaGuardada_userId_idx` y la clave primaria;
- el `ALTER TABLE \`CuentaGuardada\` ADD CONSTRAINT \`CuentaGuardada_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`User\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`. Prisma saca la clave foránea aparte, al final del diff.

Si el diff trae otras diferencias (el espejo puede ir desfasado), **no** se copian: son de otro asunto. Aplicarlo en el espejo con el túnel abierto y `ESPEJO_DB_PASS` en el entorno, como el resto de guiones del espejo:

```bash
node .auditoria/_sql-espejo.mjs "$(cat .auditoria/_create-cuentaguardada.sql)"
node .auditoria/_sql-espejo.mjs "SHOW CREATE TABLE CuentaGuardada"
```

Esperado: el `SHOW CREATE TABLE` devuelve la tabla con los dos índices y la clave foránea `ON DELETE CASCADE`. La tarea 10 aplica en producción el mismo fichero.

- [ ] **Paso 3: la prueba, que falla**

`lib/__tests__/cuentas-guardadas.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'

const fila = vi.hoisted(() => ({ current: null }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    cuentaGuardada: {
      create: vi.fn(async ({ data }) => { fila.current = { id: 'cg1', intentosPin: 0, lastUsedAt: new Date(), ...data }; return { id: 'cg1' } }),
      findUnique: vi.fn(async () => fila.current),
      update: vi.fn(async ({ data }) => { fila.current = { ...fila.current, ...data }; return fila.current }),
      delete: vi.fn(async () => { fila.current = null }),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
  },
}))

import {
  llevaPin, pinValido, generarLlave, huellaDeLlave, llaveCoincide, vencida,
  crearCuentaGuardada, abrirCuentaGuardada, quitarConLlave, MAX_INTENTOS_PIN,
} from '@/lib/cuentas-guardadas'
import { CUENTA_NO_VALE, PIN_AGOTADO, esMensajeDeCuentaMuerta } from '@/lib/cuentas-guardadas-textos'

beforeEach(() => { fila.current = null })

describe('la llave', () => {
  it('es larga y aleatoria, y el servidor solo guarda su huella', () => {
    const a = generarLlave(), b = generarLlave()
    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(43) // 32 bytes en base64url
    expect(huellaDeLlave(a)).toMatch(/^[0-9a-f]{64}$/)
    expect(llaveCoincide(a, huellaDeLlave(a))).toBe(true)
    expect(llaveCoincide(b, huellaDeLlave(a))).toBe(false)
    expect(llaveCoincide(a, 'basura')).toBe(false)
  })
})

describe('quién lleva PIN', () => {
  it('dueño y superadmin sí; cobrador no', () => {
    expect(llevaPin('owner')).toBe(true)
    expect(llevaPin('superadmin')).toBe(true)
    expect(llevaPin('cobrador')).toBe(false)
    expect(pinValido('0427')).toBe(true)
    expect(pinValido('427')).toBe(false)
    expect(pinValido('12a4')).toBe(false)
  })
})

describe('vigencia', () => {
  it('60 días sin uso y deja de valer', () => {
    const ahora = Date.parse('2026-09-24T12:00:00Z')
    expect(vencida(new Date(ahora - 59 * 86400000), ahora)).toBe(false)
    expect(vencida(new Date(ahora - 61 * 86400000), ahora)).toBe(true)
  })
})

describe('abrir una cuenta guardada', () => {
  it('cobrador: con la llave basta', async () => {
    const { id, llave } = await crearCuentaGuardada({ userId: 'u1', rol: 'cobrador', dispositivo: 'Android · Chrome' })
    expect(fila.current.pinHash).toBeNull()
    expect(await abrirCuentaGuardada({ id, llave })).toBe('u1')
  })

  it('dueño sin PIN no se puede guardar', async () => {
    await expect(crearCuentaGuardada({ userId: 'u2', rol: 'owner' })).rejects.toThrow('PIN_REQUERIDO')
  })

  it('dueño: PIN correcto entra y deja el contador en cero', async () => {
    const { id, llave } = await crearCuentaGuardada({ userId: 'u2', rol: 'owner', pin: '0427' })
    expect(await bcrypt.compare('0427', fila.current.pinHash)).toBe(true)
    await expect(abrirCuentaGuardada({ id, llave, pin: '1111' })).rejects.toThrow(/Te quedan 4 intentos/)
    expect(await abrirCuentaGuardada({ id, llave, pin: '0427' })).toBe('u2')
    expect(fila.current.intentosPin).toBe(0)
  })

  it(`al ${MAX_INTENTOS_PIN}.º PIN errado la cuenta se borra`, async () => {
    const { id, llave } = await crearCuentaGuardada({ userId: 'u2', rol: 'owner', pin: '0427' })
    for (let i = 1; i < MAX_INTENTOS_PIN; i++) {
      await expect(abrirCuentaGuardada({ id, llave, pin: '9999' })).rejects.toThrow(/PIN incorrecto/)
    }
    await expect(abrirCuentaGuardada({ id, llave, pin: '9999' })).rejects.toThrow(PIN_AGOTADO)
    expect(fila.current).toBeNull()
  })

  it('llave equivocada o cuenta vencida: el mismo mensaje, y la vencida se borra', async () => {
    const { id, llave } = await crearCuentaGuardada({ userId: 'u1', rol: 'cobrador' })
    await expect(abrirCuentaGuardada({ id, llave: 'otra' })).rejects.toThrow(CUENTA_NO_VALE)
    fila.current.lastUsedAt = new Date(Date.now() - 61 * 86400000)
    await expect(abrirCuentaGuardada({ id, llave })).rejects.toThrow(CUENTA_NO_VALE)
    expect(fila.current).toBeNull()
  })

  it('quitar con la llave solo borra si la llave es la suya', async () => {
    const { id, llave } = await crearCuentaGuardada({ userId: 'u1', rol: 'cobrador' })
    expect(await quitarConLlave({ id, llave: 'otra' })).toBe(false)
    expect(await quitarConLlave({ id, llave })).toBe(true)
  })

  it('el navegador reconoce los dos mensajes que obligan a quitar la tarjeta', () => {
    expect(esMensajeDeCuentaMuerta(CUENTA_NO_VALE)).toBe(true)
    expect(esMensajeDeCuentaMuerta(PIN_AGOTADO)).toBe(true)
    expect(esMensajeDeCuentaMuerta('PIN incorrecto. Te quedan 2 intentos.')).toBe(false)
  })
})
```

- [ ] **Paso 4: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/cuentas-guardadas.test.js`
Esperado: FALLA con «Failed to resolve import "@/lib/cuentas-guardadas"».

- [ ] **Paso 5: los textos compartidos**

`lib/cuentas-guardadas-textos.js`:

```js
/* Los dos mensajes que obligan a quitar la tarjeta del teléfono. Viven aparte
   porque los lee el servidor (al rechazar) y el navegador (para quitarla), y
   lib/cuentas-guardadas.js no se puede importar en el navegador: usa crypto,
   bcrypt y Prisma. */
export const CUENTA_NO_VALE = 'Esta cuenta guardada ya no vale en este teléfono. Entra con tu correo y contraseña.'
export const PIN_AGOTADO = 'Demasiados PIN errados: quitamos esta cuenta del teléfono. Entra con tu correo y contraseña.'

export function esMensajeDeCuentaMuerta(msg) {
  return msg === CUENTA_NO_VALE || msg === PIN_AGOTADO
}
```

- [ ] **Paso 6: la lógica del servidor**

`lib/cuentas-guardadas.js`:

```js
/* CUENTAS GUARDADAS EN EL TELÉFONO — 24 sep 2026.
 *
 * La casilla «Mantener la sesión en este teléfono» no hacía NADA: la pantalla
 * guardaba `recordar` y nunca lo mandaba. El dueño pidió cambiarla por algo que
 * sirva: guardar una o varias cuentas y entrar con un toque, también en la app
 * instalada, donde muchos teléfonos no sugieren contraseñas.
 *
 * El teléfono NO guarda la contraseña: guarda una llave aleatoria de 32 bytes.
 * Aquí solo va su huella SHA-256 (con esa entropía un hash rápido basta) y, para
 * dueño y superadmin, un PIN de 4 números con bcrypt (poca entropía: hash lento
 * y 5 intentos). Revocar = borrar la fila.
 * Spec: docs/superpowers/specs/2026-09-24-cuentas-guardadas-y-ver-como-design.md
 */
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { CUENTA_NO_VALE, PIN_AGOTADO } from '@/lib/cuentas-guardadas-textos'

export const DIAS_VIGENCIA = 60
export const MAX_INTENTOS_PIN = 5
const ROLES_CON_PIN = ['owner', 'superadmin']

export const llevaPin = (rol) => ROLES_CON_PIN.includes(rol)
export const pinValido = (pin) => /^\d{4}$/.test(String(pin ?? ''))

export function generarLlave() {
  return crypto.randomBytes(32).toString('base64url')
}

export function huellaDeLlave(llave) {
  return crypto.createHash('sha256').update(String(llave ?? '')).digest('hex')
}

export function llaveCoincide(llave, tokenHash) {
  const a = Buffer.from(huellaDeLlave(llave), 'hex')
  const b = Buffer.from(String(tokenHash ?? ''), 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export function vencida(lastUsedAt, ahora = Date.now()) {
  return ahora - new Date(lastUsedAt).getTime() > DIAS_VIGENCIA * 24 * 60 * 60 * 1000
}

export async function crearCuentaGuardada({ userId, rol, pin, dispositivo = null }) {
  if (llevaPin(rol) && !pinValido(pin)) throw new Error('PIN_REQUERIDO')
  const llave = generarLlave()
  const fila = await prisma.cuentaGuardada.create({
    data: {
      userId,
      tokenHash: huellaDeLlave(llave),
      pinHash: llevaPin(rol) ? await bcrypt.hash(String(pin), 10) : null,
      dispositivo,
    },
    select: { id: true },
  })
  return { id: fila.id, llave }
}

/** El userId si la llave (y el PIN, si lleva) valen. Si no, lanza con un mensaje para la persona. */
export async function abrirCuentaGuardada({ id, llave, pin }, ahora = Date.now()) {
  const fila = await prisma.cuentaGuardada.findUnique({
    where: { id: String(id ?? '') },
    select: { id: true, userId: true, tokenHash: true, pinHash: true, intentosPin: true, lastUsedAt: true },
  })
  if (!fila || !llaveCoincide(llave, fila.tokenHash)) throw new Error(CUENTA_NO_VALE)
  if (vencida(fila.lastUsedAt, ahora)) {
    await prisma.cuentaGuardada.delete({ where: { id: fila.id } }).catch(() => {})
    throw new Error(CUENTA_NO_VALE)
  }
  if (fila.pinHash) {
    const ok = pinValido(pin) && await bcrypt.compare(String(pin), fila.pinHash)
    if (!ok) {
      const intentos = fila.intentosPin + 1
      if (intentos >= MAX_INTENTOS_PIN) {
        await prisma.cuentaGuardada.delete({ where: { id: fila.id } }).catch(() => {})
        throw new Error(PIN_AGOTADO)
      }
      await prisma.cuentaGuardada.update({ where: { id: fila.id }, data: { intentosPin: intentos } })
      const quedan = MAX_INTENTOS_PIN - intentos
      throw new Error(`PIN incorrecto. Te ${quedan === 1 ? 'queda 1 intento' : `quedan ${quedan} intentos`}.`)
    }
  }
  await prisma.cuentaGuardada.update({ where: { id: fila.id }, data: { intentosPin: 0, lastUsedAt: new Date(ahora) } })
  return fila.userId
}

/** La «x» de la tarjeta: sin sesión, la llave es la prueba de que es suya. */
export async function quitarConLlave({ id, llave }) {
  const fila = await prisma.cuentaGuardada.findUnique({ where: { id: String(id ?? '') }, select: { id: true, tokenHash: true } })
  if (!fila || !llaveCoincide(llave, fila.tokenHash)) return false
  await prisma.cuentaGuardada.delete({ where: { id: fila.id } })
  return true
}

/** Al cambiar la contraseña: ningún teléfono entra con la llave vieja. */
export async function cortarCuentasGuardadas(userId) {
  if (!userId) return
  await prisma.cuentaGuardada.deleteMany({ where: { userId } })
}
```

Nota: la prueba «Te quedan 4 intentos» espera el plural. Con 1 restante el texto es «Te queda 1 intento».

- [ ] **Paso 7: ejecutarla, tiene que pasar**

Ejecutar: `npx vitest run lib/__tests__/cuentas-guardadas.test.js`
Esperado: PASA (9 pruebas).

- [ ] **Paso 8: commit**

```bash
git add prisma/schema.prisma lib/cuentas-guardadas.js lib/cuentas-guardadas-textos.js lib/__tests__/cuentas-guardadas.test.js
git commit -m "Cuentas guardadas: la tabla y la llave del teléfono (huella, PIN, 60 días)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 2: una sola forma de armar la sesión

**Ficheros:**
- Crear: `lib/auth-sesion.js`
- Modificar: `lib/auth.js:20-168` (el `authorize` de contraseña pasa a usarla)
- Prueba: `lib/__tests__/auth-sesion.test.js`

**Interfaces:**
- Consume: nada de tareas anteriores.
- Produce (`lib/auth-sesion.js`):
  - `INCLUDE_USUARIO_SESION`: objeto `include` de Prisma
  - `usuarioParaSesion(userId) → Promise<User|null>`
  - `revisarCuenta(user)`: síncrona; lanza `Error` si la cuenta está desactivada, sin verificar o suspendida
  - `armarSesion(user) → Promise<objetoDeSesion>`: el mismo objeto que hoy devuelve `authorize`; lanza si el cobrador excede el plan
  - `sesionDeUsuario(user) → Promise<objetoDeSesion>` = `revisarCuenta` + `armarSesion`

- [ ] **Paso 1: la prueba, que falla**

`lib/__tests__/auth-sesion.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ruta: { findMany: vi.fn(async () => [{ id: 'r1' }, { id: 'r2' }]) },
    suscripcion: { findFirst: vi.fn(async () => null) },
    user: { findUnique: vi.fn(async () => null) },
  },
}))
vi.mock('@/lib/limites-plan', () => ({ usuarioPermitido: vi.fn(async () => true) }))

import { revisarCuenta, armarSesion, sesionDeUsuario } from '@/lib/auth-sesion'

const base = {
  id: 'u1', nombre: 'Juan', email: 'j@x.co', rol: 'cobrador', activo: true, emailVerificado: true,
  createdAt: new Date(), organizationId: 'o1', avatarId: null, onboardingCompletado: true,
  puedeCrearPrestamos: true, puedeCrearClientes: false, puedeEditarClientes: false,
  organization: { plan: 'starter', activo: true, country: 'co', timezone: null, nombre: 'Negocio', modoAbreviado: false, ocultarSaldoWA: false, camposRecibo: null },
}

describe('revisarCuenta', () => {
  it('desactivada, sin verificar (más de 7 días) o suspendida: no entra', () => {
    expect(() => revisarCuenta({ ...base, activo: false })).toThrow(/desactivada/)
    expect(() => revisarCuenta({ ...base, emailVerificado: false, createdAt: new Date(Date.now() - 8 * 86400000) })).toThrow('VERIFY_EMAIL')
    expect(() => revisarCuenta({ ...base, organization: { ...base.organization, activo: false } })).toThrow(/suspendida/)
    expect(() => revisarCuenta(base)).not.toThrow()
  })
})

describe('armarSesion', () => {
  it('cobrador: con sus rutas y sus permisos', async () => {
    const s = await armarSesion(base)
    expect(s).toMatchObject({ id: 'u1', rol: 'cobrador', rutaId: 'r1', rutaIds: ['r1', 'r2'], orgNombre: 'Negocio' })
    expect(s.permisos).toMatchObject({ crearPrestamos: true, crearClientes: false })
  })
})

describe('las entradas comparten la misma función', () => {
  const auth = readFileSync(resolve(process.cwd(), 'lib/auth.js'), 'utf8')
  it('el login con contraseña revisa ANTES de la clave y arma DESPUÉS', () => {
    expect(auth.indexOf('revisarCuenta(user)')).toBeGreaterThan(-1)
    expect(auth.indexOf('revisarCuenta(user)')).toBeLessThan(auth.indexOf('bcrypt.compare(credentials.password'))
    expect(auth).toMatch(/return armarSesion\(user\)/)
  })
  it('sesionDeUsuario = revisar + armar', async () => {
    await expect(sesionDeUsuario({ ...base, activo: false })).rejects.toThrow(/desactivada/)
  })
})
```

- [ ] **Paso 2: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/auth-sesion.test.js`
Esperado: FALLA al resolver `@/lib/auth-sesion`.

- [ ] **Paso 3: crear `lib/auth-sesion.js` moviendo el código tal cual**

Mover a este fichero, **sin cambiar la lógica**, el código que hoy está en `lib/auth.js`:
- `revisarCuenta(user)`: las tres comprobaciones (`!user.activo`, correo sin verificar a más de 168 h, `user.organization && !user.organization.activo`) con sus mismos mensajes, hoy entre la búsqueda del usuario y `bcrypt.compare`.
- `armarSesion(user)`: la comprobación de `usuarioPermitido`, la carga de rutas, los permisos, la suscripción y el `return { … }`, hoy entre `bcrypt.compare` y el final de `authorize`. La actualización de `lastLoginAt` **no** entra aquí: se queda en cada entrada que sea un inicio de sesión de verdad.

```js
/* LA SESIÓN SE ARMA EN UN SOLO SITIO — 24 sep 2026.
 * Hoy entra por cuatro puertas: contraseña, cuenta guardada, «ver como» y
 * «volver». Si cada una revisara por su cuenta, una acabaría dejando pasar a un
 * cobrador desactivado o fuera del plan. Todo lo que el login con contraseña
 * revisaba vive aquí, igual, y las cuatro lo llaman. */
import { prisma } from '@/lib/prisma'
import { usuarioPermitido } from '@/lib/limites-plan'
import { selectCobro, vencimientoEfectivo } from '@/lib/cobro-automatico'

export const INCLUDE_USUARIO_SESION = {
  organization: { select: { plan: true, activo: true, country: true, timezone: true, nombre: true, modoAbreviado: true, ocultarSaldoWA: true, camposRecibo: true, ...selectCobro } },
}

export function usuarioParaSesion(userId) {
  if (!userId) return Promise.resolve(null)
  return prisma.user.findUnique({ where: { id: String(userId) }, include: INCLUDE_USUARIO_SESION })
}

export function revisarCuenta(user) {
  if (!user.activo) {
    throw new Error('Tu cuenta está desactivada. Contacta al administrador.')
  }
  if (user.rol !== 'superadmin' && !user.emailVerificado) {
    const horasDesdeRegistro = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60)
    if (horasDesdeRegistro > 168) throw new Error('VERIFY_EMAIL')
  }
  if (user.organization && !user.organization.activo) {
    throw new Error('Tu cuenta está suspendida. Escríbenos a soporte@control-finanzas.com')
  }
}

// Movido SIN CAMBIOS desde el authorize de lib/auth.js (líneas 92–167 hoy).
export async function armarSesion(user) {
  // Cobradores: verificar que el usuario esta dentro del limite del plan
  if (user.rol === 'cobrador' && user.organizationId) {
    const permitido = await usuarioPermitido(user.organizationId, user.id)
    if (!permitido) {
      throw new Error('Tu cuenta de cobrador excede el limite del plan actual. Contacta al administrador.')
    }
  }

  // Para cobradores: obtener las rutas asignadas y permisos
  let rutaId = null
  let rutaIds = []
  let permisos = null
  if (user.rol === 'cobrador') {
    const rutas = await prisma.ruta.findMany({
      where:  { cobradorId: user.id, activo: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })
    rutaIds = rutas.map(r => r.id)
    rutaId = rutaIds[0] ?? null
    permisos = {
      crearPrestamos: user.puedeCrearPrestamos,
      gestionarPrestamos: user.puedeGestionarPrestamos ?? user.puedeCrearPrestamos,
      crearClientes:  user.puedeCrearClientes,
      editarClientes: user.puedeEditarClientes,
      reportarGastos: user.puedeReportarGastos ?? true,
      verCapital:     user.puedeVerCapital ?? false,
      verCapitalRuta: user.puedeVerCapitalRuta ?? false,
      verSaldoCaja:   user.puedeVerSaldoCaja ?? false,
      gestionarRutas: user.puedeGestionarRutas ?? false,
      aplicarDescuentos: user.puedeAplicarDescuentos ?? false,
      desembolsarLinea: user.puedeDesembolsarLinea ?? false,
      reabrirCajaSinAprobacion: user.puedeReabrirCajaSinAprobacion ?? false,
    }
  }

  // Obtener fecha de vencimiento de suscripción
  // Ignorar suscripciones pending (creadas al iniciar pago en MP pero nunca completadas)
  let suscripcionVencimiento = null
  if (user.organizationId) {
    const sub = await prisma.suscripcion.findFirst({
      where: {
        organizationId: user.organizationId,
        // Excluir solo pending. NULL (trials) debe contar.
        // Prisma `not: 'pending'` excluye NULL en MySQL — usar OR explicito.
        OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
      },
      orderBy: { fechaVencimiento: 'desc' },
      select: { fechaVencimiento: true },
    })
    /* Con el cobro automático vivo, la fecha que corta el acceso lleva la
       gracia: el middleware echa con ESTE dato. Ver lib/cobro-automatico.js. */
    suscripcionVencimiento = vencimientoEfectivo(sub?.fechaVencimiento?.toISOString() ?? null, user.organization)
  }

  return {
    id:                    user.id,
    nombre:                user.nombre,
    email:                 user.email,
    rol:                   user.rol,
    organizationId:        user.organizationId,
    plan:                  user.organization?.plan ?? null,
    rutaId,
    rutaIds,
    permisos,
    suscripcionVencimiento,
    onboardingCompletado:  user.onboardingCompletado ?? false,
    emailVerificado:       user.emailVerificado,
    avatarId:              user.avatarId ?? null,
    country:               user.organization?.country ?? 'co',
    timezone:              user.organization?.timezone ?? null,
    orgNombre:             user.organization?.nombre ?? null,
    modoAbreviado:         user.organization?.modoAbreviado ?? false,
    ocultarSaldoWA:        user.organization?.ocultarSaldoWA ?? false,
    camposRecibo:          user.organization?.camposRecibo ?? null,
  }
}

export async function sesionDeUsuario(user) {
  revisarCuenta(user)
  return armarSesion(user)
}
```

El cuerpo de `armarSesion` es el bloque indicado, copiado literalmente desde `lib/auth.js`: la llamada a `usuarioPermitido`, `rutaId`/`rutaIds`/`permisos` con sus doce permisos, `suscripcionVencimiento` con `vencimientoEfectivo(…)` y el `return` con sus veinte campos.

- [ ] **Paso 4: `authorize` pasa a usarla**

En `lib/auth.js`:
- sustituir los dos `include: { organization: { select: {…} } }` de las búsquedas por teléfono y por correo por `include: INCLUDE_USUARIO_SESION`;
- sustituir las tres comprobaciones por `revisarCuenta(user)`;
- sustituir todo lo que sigue al `lastLoginAt` por `return armarSesion(user)`.

Queda así:

```js
        if (!user) return null

        revisarCuenta(user)

        const passwordOk = await bcrypt.compare(credentials.password, user.password)
        if (!passwordOk) return null

        prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date(), lastActivityAt: new Date() },
        }).catch((err) => console.error('[auth] lastLoginAt update fail:', err.message))

        return armarSesion(user)
      },
```

Imports en `lib/auth.js`: añadir `import { INCLUDE_USUARIO_SESION, revisarCuenta, armarSesion } from '@/lib/auth-sesion'` y quitar `usuarioPermitido`, que ya no se usa ahí. **`selectCobro` y `vencimientoEfectivo` se quedan**: el callback `jwt` los sigue usando.

- [ ] **Paso 5: ejecutar la prueba nueva y las del login**

Ejecutar: `npx vitest run lib/__tests__/auth-sesion.test.js lib/__tests__/login-mensajes-de-error.test.js lib/__tests__/login-resiliente.test.js lib/__tests__/pago-desbloquea-sin-cerrar-sesion.test.js`
Esperado: PASAN todas. Si una prueba vieja ancla un texto que se movió de fichero, se reapunta al fichero nuevo sin cambiar lo que comprueba.

- [ ] **Paso 6: commit**

```bash
git add lib/auth-sesion.js lib/auth.js lib/__tests__/auth-sesion.test.js
git commit -m "La sesión se arma en un solo sitio (lib/auth-sesion.js), sin cambiar el login

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 3: entrar con la cuenta guardada, y su API

**Ficheros:**
- Crear: `lib/dispositivo.js`, `app/api/cuentas-guardadas/route.js`, `app/api/cuentas-guardadas/[id]/route.js`, `app/api/cobradores/[id]/cuentas-guardadas/route.js`
- Modificar: `lib/auth.js` (proveedor `cuenta-guardada`), `app/api/sesiones/route.js` (usa `lib/dispositivo.js`)
- Prueba: `lib/__tests__/cuentas-guardadas-api.test.js`

**Interfaces:**
- Consume: tarea 1 (`crearCuentaGuardada`, `abrirCuentaGuardada`, `quitarConLlave`, `llevaPin`, `pinValido`) y tarea 2 (`usuarioParaSesion`, `sesionDeUsuario`).
- Produce:
  - `etiquetaDispositivo(userAgent) → string`, en `lib/dispositivo.js`
  - el proveedor NextAuth `id: 'cuenta-guardada'` con credenciales `{ id, llave, pin }`
  - `POST /api/cuentas-guardadas` con `{ pin? }` → `201 { id, llave, userId, nombre, rol, orgNombre, conPin }`
  - `GET /api/cuentas-guardadas` → `{ aparatos: [{ id, dispositivo, createdAt, lastUsedAt }] }`
  - `DELETE /api/cuentas-guardadas?id=` → `{ ok: true }`
  - `DELETE /api/cuentas-guardadas/[id]` con `{ llave }` → `{ ok: boolean }`
  - `GET` y `DELETE /api/cobradores/[id]/cuentas-guardadas[?id=]`, con la misma forma

- [ ] **Paso 1: la prueba, que falla**

`lib/__tests__/cuentas-guardadas-api.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { etiquetaDispositivo } from '@/lib/dispositivo'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

describe('el aparato', () => {
  it('iPhone con Safari y Android con Chrome', () => {
    expect(etiquetaDispositivo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')).toBe('iPhone · Safari')
    expect(etiquetaDispositivo('Mozilla/5.0 (Linux; Android 13; SM-A135M) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36')).toBe('Android · Chrome')
    expect(etiquetaDispositivo('')).toBe('Desconocido')
  })
})

describe('el proveedor de la cuenta guardada', () => {
  const auth = src('lib/auth.js')
  it('existe, limita intentos y arma la sesión con la función compartida', () => {
    expect(auth).toMatch(/id: 'cuenta-guardada'/)
    expect(auth).toMatch(/loginLimiter\(`cg:\$\{credentials\?\.id\}`\)/)
    expect(auth).toMatch(/const userId = await abrirCuentaGuardada\(\{ id: credentials\?\.id, llave: credentials\?\.llave, pin: credentials\?\.pin \}\)/)
    expect(auth).toMatch(/return sesionDeUsuario\(usuario\)/)
  })
})

describe('las rutas', () => {
  it('guardar exige sesión y el PIN cuando el rol lo lleva', () => {
    const r = src('app/api/cuentas-guardadas/route.js')
    expect(r).toMatch(/if \(llevaPin\(session\.user\.rol\) && !pinValido\(body\?\.pin\)\)/)
    expect(r).toMatch(/crearCuentaGuardada\(\{ userId: session\.user\.id, rol: session\.user\.rol, pin: body\?\.pin, dispositivo: etiquetaDispositivo\(/)
  })
  it('la «x» sin sesión exige la llave', () => {
    expect(src('app/api/cuentas-guardadas/[id]/route.js')).toMatch(/quitarConLlave\(\{ id, llave: body\?\.llave \}\)/)
  })
  it('el dueño solo ve y corta los aparatos de SUS cobradores', () => {
    const r = src('app/api/cobradores/[id]/cuentas-guardadas/route.js')
    expect(r).toMatch(/session\.user\.rol !== 'owner'/)
    expect(r).toMatch(/where: \{ id, organizationId: session\.user\.organizationId, rol: 'cobrador' \}/)
  })
})
```

- [ ] **Paso 2: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/cuentas-guardadas-api.test.js`
Esperado: FALLA al resolver `@/lib/dispositivo`.

- [ ] **Paso 3: `lib/dispositivo.js`**

Mover `parseDispositivo` y `parseBrowser` desde `app/api/sesiones/route.js` (líneas 8–31), sin cambios, y añadir:

```js
/** «iPhone · Safari», «Android · Chrome»: lo que se enseña en la lista de aparatos. */
export function etiquetaDispositivo(ua) {
  const d = parseDispositivo(ua)
  const b = parseBrowser(ua)
  return b ? `${d} · ${b}` : d
}
```

En `app/api/sesiones/route.js`: borrar las dos funciones locales y usar `import { etiquetaDispositivo } from '@/lib/dispositivo'` con `const label = etiquetaDispositivo(userAgent)`.

- [ ] **Paso 4: el proveedor en `lib/auth.js`**

Añadir al array `providers`, después del de contraseña:

```js
    /* CUENTA GUARDADA EN ESTE TELÉFONO: la llave del aparato (y el PIN si es
       dueño) en vez de correo y contraseña. Las MISMAS revisiones que el login
       con clave: ver lib/auth-sesion.js. */
    CredentialsProvider({
      id: 'cuenta-guardada',
      name: 'cuenta-guardada',
      credentials: { id: {}, llave: {}, pin: {} },
      async authorize(credentials) {
        const rl = loginLimiter(`cg:${credentials?.id}`)
        if (!rl.ok) throw new Error('Demasiados intentos. Intenta en 15 minutos.')
        const userId = await abrirCuentaGuardada({ id: credentials?.id, llave: credentials?.llave, pin: credentials?.pin })
        const usuario = await usuarioParaSesion(userId)
        if (!usuario) throw new Error(CUENTA_NO_VALE)
        prisma.user.update({
          where: { id: usuario.id },
          data: { lastLoginAt: new Date(), lastActivityAt: new Date() },
        }).catch((err) => console.error('[auth] lastLoginAt (cuenta guardada):', err.message))
        return sesionDeUsuario(usuario)
      },
    }),
```

Imports: `import { abrirCuentaGuardada } from '@/lib/cuentas-guardadas'`, `import { CUENTA_NO_VALE } from '@/lib/cuentas-guardadas-textos'`, y añadir `usuarioParaSesion, sesionDeUsuario` al import de `@/lib/auth-sesion`.

- [ ] **Paso 5: `app/api/cuentas-guardadas/route.js`**

```js
// Las cuentas guardadas de la persona que tiene la sesión: guardar, ver sus aparatos, quitar uno.
import { getServerSession } from 'next-auth'
import { headers } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { crearCuentaGuardada, llevaPin, pinValido } from '@/lib/cuentas-guardadas'
import { etiquetaDispositivo } from '@/lib/dispositivo'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (llevaPin(session.user.rol) && !pinValido(body?.pin)) {
    return Response.json({ error: 'El PIN son 4 números.' }, { status: 400 })
  }
  const ua = (await headers()).get('user-agent') || ''
  const { id, llave } = await crearCuentaGuardada({ userId: session.user.id, rol: session.user.rol, pin: body?.pin, dispositivo: etiquetaDispositivo(ua) })
  return Response.json({
    id, llave,
    userId: session.user.id, nombre: session.user.nombre, rol: session.user.rol,
    orgNombre: session.user.orgNombre ?? null, conPin: llevaPin(session.user.rol),
  }, { status: 201 })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const aparatos = await prisma.cuentaGuardada.findMany({
    where: { userId: session.user.id },
    select: { id: true, dispositivo: true, createdAt: true, lastUsedAt: true },
    orderBy: { lastUsedAt: 'desc' },
  })
  return Response.json({ aparatos })
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  await prisma.cuentaGuardada.deleteMany({ where: { id: String(id ?? ''), userId: session.user.id } })
  return Response.json({ ok: true })
}
```

- [ ] **Paso 6: `app/api/cuentas-guardadas/[id]/route.js`**

```js
// La «x» de la tarjeta en la pantalla de entrada: sin sesión, la llave prueba que es suya.
import { quitarConLlave } from '@/lib/cuentas-guardadas'

export async function DELETE(request, { params }) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const ok = await quitarConLlave({ id, llave: body?.llave })
  return Response.json({ ok })
}
```

- [ ] **Paso 7: `app/api/cobradores/[id]/cuentas-guardadas/route.js`**

```js
// Los aparatos donde un cobrador tiene su cuenta guardada. Solo el dueño, solo los suyos.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function cobradorDelDueno(params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.rol !== 'owner') return { error: Response.json({ error: 'No autorizado' }, { status: 403 }) }
  const { id } = await params
  const cobrador = await prisma.user.findFirst({
    where: { id, organizationId: session.user.organizationId, rol: 'cobrador' },
    select: { id: true },
  })
  if (!cobrador) return { error: Response.json({ error: 'Cobrador no encontrado' }, { status: 404 }) }
  return { cobrador }
}

export async function GET(request, { params }) {
  const { error, cobrador } = await cobradorDelDueno(params)
  if (error) return error
  const aparatos = await prisma.cuentaGuardada.findMany({
    where: { userId: cobrador.id },
    select: { id: true, dispositivo: true, createdAt: true, lastUsedAt: true },
    orderBy: { lastUsedAt: 'desc' },
  })
  return Response.json({ aparatos })
}

export async function DELETE(request, { params }) {
  const { error, cobrador } = await cobradorDelDueno(params)
  if (error) return error
  const aparato = new URL(request.url).searchParams.get('id')
  await prisma.cuentaGuardada.deleteMany({ where: { id: String(aparato ?? ''), userId: cobrador.id } })
  return Response.json({ ok: true })
}
```

- [ ] **Paso 8: ejecutar la prueba y la de sesiones**

Ejecutar: `npx vitest run lib/__tests__/cuentas-guardadas-api.test.js lib/__tests__/cuentas-guardadas.test.js`
Esperado: PASAN.

- [ ] **Paso 9: commit**

```bash
git add lib/dispositivo.js lib/auth.js app/api/sesiones/route.js app/api/cuentas-guardadas app/api/cobradores/\[id\]/cuentas-guardadas lib/__tests__/cuentas-guardadas-api.test.js
git commit -m "Entrar con la cuenta guardada del teléfono, y su API

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 4: cambiar la contraseña corta las cuentas guardadas

**Ficheros:**
- Modificar:
  - `app/api/auth/reset-password/route.js` (junto a `data: { password: hash }`)
  - `app/api/configuracion/perfil/route.js` (tras el `prisma.user.update` final)
  - `app/api/cobradores/[id]/route.js` (tras `const actualizado = await prisma.user.update`)
  - `app/api/admin/organizaciones/[id]/route.js` (tras el `update` con `password: hash`, ~línea 317)
- Prueba: `lib/__tests__/clave-nueva-corta-cuentas.test.js`

**Interfaces:**
- Consume: `cortarCuentasGuardadas(userId)` de la tarea 1.
- Produce: nada nuevo.

- [ ] **Paso 1: la prueba, que falla**

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

/* Una llave que sobrevive al cambio de contraseña es una puerta que el dueño
   cree cerrada. Las CUATRO vías que cambian una clave cortan los teléfonos. */
describe('cambiar la contraseña corta las cuentas guardadas', () => {
  it('olvidé mi clave', () => {
    expect(src('app/api/auth/reset-password/route.js')).toMatch(/await cortarCuentasGuardadas\(data\.userId\)/)
  })
  it('mi perfil, solo si cambió la clave', () => {
    expect(src('app/api/configuracion/perfil/route.js')).toMatch(/if \(updates\.password\) await cortarCuentasGuardadas\(session\.user\.id\)/)
  })
  it('el dueño le cambia la clave a un cobrador', () => {
    expect(src('app/api/cobradores/[id]/route.js')).toMatch(/if \(data\.password\) await cortarCuentasGuardadas\(id\)/)
  })
  it('el superadmin', () => {
    expect(src('app/api/admin/organizaciones/[id]/route.js')).toMatch(/await cortarCuentasGuardadas\(body\.userId\)/)
  })
})
```

- [ ] **Paso 2: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/clave-nueva-corta-cuentas.test.js`
Esperado: FALLA en las 4.

- [ ] **Paso 3: las cuatro líneas**

En cada fichero, `import { cortarCuentasGuardadas } from '@/lib/cuentas-guardadas'` y:

- `reset-password`, después del `await prisma.user.update({ where: { id: data.userId }, data: { password: hash } })`:
  ```js
  // Una clave nueva no deja entrar a ningún teléfono con la llave de la vieja.
  await cortarCuentasGuardadas(data.userId)
  ```
- `configuracion/perfil`, después de `await prisma.user.update({ where: { id: session.user.id }, data: updates })`:
  ```js
  if (updates.password) await cortarCuentasGuardadas(session.user.id)
  ```
- `cobradores/[id]`, después de `const actualizado = await prisma.user.update({ … })`:
  ```js
  if (data.password) await cortarCuentasGuardadas(id)
  ```
- `admin/organizaciones/[id]`, después del `update` con `data: { password: hash }`:
  ```js
  await cortarCuentasGuardadas(body.userId)
  ```

- [ ] **Paso 4: ejecutarla, tiene que pasar**

Ejecutar: `npx vitest run lib/__tests__/clave-nueva-corta-cuentas.test.js`
Esperado: PASA.

- [ ] **Paso 5: commit**

```bash
git add app/api/auth/reset-password/route.js app/api/configuracion/perfil/route.js "app/api/cobradores/[id]/route.js" "app/api/admin/organizaciones/[id]/route.js" lib/__tests__/clave-nueva-corta-cuentas.test.js
git commit -m "Cambiar la contraseña corta las cuentas guardadas en las cuatro vías

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 5: la pantalla de entrada

**Ficheros:**
- Crear: `lib/cuentas-guardadas-cliente.js`, `components/auth/CuentasGuardadas.jsx`, `components/auth/PinDeCuatro.jsx`
- Modificar: `app/login/page.jsx` (estado, `handleSubmit` y el JSX del formulario)
- Prueba: `lib/__tests__/cuentas-guardadas-cliente.test.js`

**Interfaces:**
- Consume:
  - `POST /api/cuentas-guardadas` (tarea 3)
  - el proveedor `cuenta-guardada` (tarea 3)
  - `DELETE /api/cuentas-guardadas/[id]` (tarea 3)
  - `esMensajeDeCuentaMuerta` (tarea 1)
- Produce (`lib/cuentas-guardadas-cliente.js`):
  - `CLAVE_CUENTAS = 'cf-cuentas-guardadas'`
  - `leerCuentasGuardadas() → Array<{ id, llave, userId, nombre, rol, orgNombre, conPin }>`
  - `guardarCuentaEnTelefono(cuenta) → void`: reemplaza la del mismo `userId`
  - `quitarCuentaDelTelefono(id) → void`
- Produce (componentes):
  - `<CuentasGuardadas cuentas onEntrar(cuenta) onQuitar(cuenta) onOtra() />`
  - `<PinDeCuatro titulo onCompleto(pin) error cargando />`

- [ ] **Paso 1: la prueba, que falla**

`lib/__tests__/cuentas-guardadas-cliente.test.js`:

```js
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import * as c from '@/lib/cuentas-guardadas-cliente'

// El módulo lee `localStorage` en cada llamada, no al cargarse: basta con cambiar el global.
function almacen() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}
afterEach(() => vi.unstubAllGlobals())

describe('las cuentas guardadas en el teléfono', () => {
  it('guardar, leer y quitar', () => {
    vi.stubGlobal('localStorage', almacen())
    c.guardarCuentaEnTelefono({ id: 'a', llave: 'k', userId: 'u1', nombre: 'Juan', rol: 'cobrador', orgNombre: 'N', conPin: false })
    expect(c.leerCuentasGuardadas()).toHaveLength(1)
    c.quitarCuentaDelTelefono('a')
    expect(c.leerCuentasGuardadas()).toEqual([])
  })

  it('la misma persona guardada otra vez reemplaza su tarjeta, no la duplica', () => {
    vi.stubGlobal('localStorage', almacen())
    c.guardarCuentaEnTelefono({ id: 'a', llave: 'k1', userId: 'u1', nombre: 'Juan', rol: 'cobrador' })
    c.guardarCuentaEnTelefono({ id: 'b', llave: 'k2', userId: 'u2', nombre: 'Carlos', rol: 'owner', conPin: true })
    c.guardarCuentaEnTelefono({ id: 'c', llave: 'k3', userId: 'u1', nombre: 'Juan', rol: 'cobrador' })
    expect(c.leerCuentasGuardadas().map((x) => x.id).sort()).toEqual(['b', 'c'])
  })

  it('sin almacenamiento (modo privado) no rompe: lista vacía', () => {
    const lanza = () => { throw new Error('bloqueado') }
    vi.stubGlobal('localStorage', { getItem: lanza, setItem: lanza, removeItem: lanza })
    expect(c.leerCuentasGuardadas()).toEqual([])
    expect(() => c.guardarCuentaEnTelefono({ id: 'a', userId: 'u1' })).not.toThrow()
  })

  it('basura en el almacén no rompe', () => {
    const a = almacen(); a.setItem('cf-cuentas-guardadas', '{no es json')
    vi.stubGlobal('localStorage', a)
    expect(c.leerCuentasGuardadas()).toEqual([])
  })
})

describe('la pantalla de entrada', () => {
  const login = readFileSync(resolve(process.cwd(), 'app/login/page.jsx'), 'utf8')
  it('la casilla dice lo que hace y SÍ se usa', () => {
    expect(login).toMatch(/>\s*Guardar esta cuenta en este teléfono\s*</)
    expect(login).toMatch(/if \(recordar\)/)
  })
  it('entra con la cuenta guardada y quita la tarjeta si ya no vale', () => {
    expect(login).toMatch(/signIn\('cuenta-guardada', \{ id: cuenta\.id, llave: cuenta\.llave, pin, redirect: false \}\)/)
    expect(login).toMatch(/if \(esMensajeDeCuentaMuerta\(msg\)\) \{/)
  })
  it('el PIN nuevo se escribe dos veces y tienen que coincidir', () => {
    expect(login).toMatch(/if \(pin !== pinNuevo\) \{/)
  })
})
```

- [ ] **Paso 2: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/cuentas-guardadas-cliente.test.js`
Esperado: FALLA al resolver `@/lib/cuentas-guardadas-cliente`.

- [ ] **Paso 3: `lib/cuentas-guardadas-cliente.js`**

```js
/* Las cuentas guardadas EN ESTE TELÉFONO. Todo va en try/catch: en modo privado,
   o con el almacenamiento lleno, `localStorage` lanza. Entonces no hay tarjetas
   y la pantalla es el formulario de siempre. */
export const CLAVE_CUENTAS = 'cf-cuentas-guardadas'

export function leerCuentasGuardadas() {
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE_CUENTAS) || '[]')
    return Array.isArray(lista) ? lista.filter((c) => c && c.id && c.userId) : []
  } catch { return [] }
}

function escribir(lista) {
  try { localStorage.setItem(CLAVE_CUENTAS, JSON.stringify(lista)) } catch { /* sin almacenamiento: no se guarda */ }
}

export function guardarCuentaEnTelefono(cuenta) {
  const resto = leerCuentasGuardadas().filter((c) => c.userId !== cuenta.userId)
  escribir([cuenta, ...resto])
}

export function quitarCuentaDelTelefono(id) {
  escribir(leerCuentasGuardadas().filter((c) => c.id !== id))
}
```

- [ ] **Paso 4: `components/auth/PinDeCuatro.jsx`**

```jsx
'use client'
/* Cuatro números. Un solo input (no cuatro cajitas: con cuatro, iOS pierde el foco
   entre una y otra), teclado numérico, 20px para que iOS no haga zoom, y se envía
   solo al completar el cuarto número. */
import { useState, useEffect, useRef } from 'react'

export default function PinDeCuatro({ titulo, onCompleto, error, cargando = false }) {
  const [pin, setPin] = useState('')
  const ref = useRef(null)
  useEffect(() => { ref.current?.focus() }, [])
  useEffect(() => { if (error) setPin('') }, [error])

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] font-semibold" style={{ color: 'var(--cf-ink)' }}>{titulo}</p>
      <input
        ref={ref}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        maxLength={4}
        disabled={cargando}
        value={pin}
        aria-label={titulo}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 4)
          setPin(v)
          if (v.length === 4) onCompleto(v)
        }}
        style={{
          height: 56, borderRadius: 'var(--cf-r-control)', border: '1px solid var(--cf-border-strong)',
          background: 'var(--cf-card)', color: 'var(--cf-ink)', fontSize: 28, letterSpacing: '.6em',
          textAlign: 'center', fontFamily: 'var(--font-space-grotesk)',
        }}
      />
      {error && <p className="text-[13px]" style={{ color: 'var(--cf-red-darker)' }}>{error}</p>}
    </div>
  )
}
```

- [ ] **Paso 5: `components/auth/CuentasGuardadas.jsx`**

```jsx
'use client'
/* Las cuentas guardadas en este teléfono: una tarjeta por cuenta, un toque para
   entrar. El nombre NO se recorta: baja de renglón (es lo que identifica).
   Sin dorado: aquí no hay monto ni acción primaria (DESIGN.md, «La plata es lo
   único que brilla»). */
const ROL = { owner: 'Dueño', cobrador: 'Cobrador', superadmin: 'Administrador' }

export default function CuentasGuardadas({ cuentas, onEntrar, onQuitar, onOtra, cargandoId = null }) {
  return (
    <div className="flex flex-col gap-3">
      {cuentas.map((c) => (
        <div key={c.id} className="flex items-center gap-3 rounded-[16px] px-4 py-3"
          style={{ background: 'var(--cf-card)', border: '1px solid var(--cf-border)' }}>
          <button type="button" onClick={() => onEntrar(c)} disabled={!!cargandoId}
            className="flex items-center gap-3 flex-1 min-w-0 text-left"
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: 'inherit' }}>
            <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[15px] font-bold"
              style={{ background: 'var(--cf-fill)', color: 'var(--cf-ink-2)' }}>
              {(c.nombre || '?').charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold break-words" style={{ color: 'var(--cf-ink)' }}>
                {cargandoId === c.id ? 'Entrando…' : c.nombre}
              </span>
              <span className="block text-[12.5px]" style={{ color: 'var(--cf-ink-3)' }}>
                {[ROL[c.rol] ?? c.rol, c.orgNombre].filter(Boolean).join(' · ')}
              </span>
            </span>
          </button>
          <button type="button" onClick={() => onQuitar(c)} aria-label={`Quitar la cuenta de ${c.nombre} de este teléfono`}
            className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
            style={{ background: 'none', border: 0, color: 'var(--cf-ink-3)', cursor: 'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      ))}
      <button type="button" onClick={onOtra} className="text-[14px] font-semibold mt-1 underline underline-offset-4"
        style={{ background: 'none', border: 0, color: 'var(--cf-ink)', cursor: 'pointer' }}>
        Entrar con otra cuenta
      </button>
    </div>
  )
}
```

- [ ] **Paso 6: conectar en `app/login/page.jsx`**

Imports (el fichero ya importa `useState` de `react`: añadir `useEffect` a ese mismo import):

```js
import CuentasGuardadas from '@/components/auth/CuentasGuardadas'
import PinDeCuatro from '@/components/auth/PinDeCuatro'
import { leerCuentasGuardadas, guardarCuentaEnTelefono, quitarCuentaDelTelefono } from '@/lib/cuentas-guardadas-cliente'
import { esMensajeDeCuentaMuerta } from '@/lib/cuentas-guardadas-textos'
```

Estado nuevo, junto a `recordar`:

```js
  const [cuentas, setCuentas] = useState([])
  // 'cuentas' (tarjetas) · 'formulario' · 'pin' (entrar con PIN) · 'crear-pin' (tras entrar con clave)
  const [modo, setModo] = useState('formulario')
  const [cuentaPin, setCuentaPin] = useState(null)
  const [cargandoId, setCargandoId] = useState(null)
  const [destino, setDestino] = useState('/dashboard')
  const [pinNuevo, setPinNuevo] = useState('')   // crear-pin: el primero, esperando la confirmación

  useEffect(() => {
    const lista = leerCuentasGuardadas()
    setCuentas(lista)
    if (lista.length) setModo('cuentas')
  }, [])

  const irAlPanel = (url) => { window.location.href = url }

  async function entrarConCuenta(cuenta, pin) {
    setError('')
    setCargandoId(cuenta.id)
    try {
      const r = await signIn('cuenta-guardada', { id: cuenta.id, llave: cuenta.llave, pin, redirect: false })
      if (r?.error) {
        const msg = r.error
        if (esMensajeDeCuentaMuerta(msg)) {
          quitarCuentaDelTelefono(cuenta.id)
          const lista = leerCuentasGuardadas()
          setCuentas(lista)
          setModo(lista.length ? 'cuentas' : 'formulario')
        }
        setError(msg)
        return
      }
      irAlPanel(cuenta.rol === 'superadmin' ? '/admin/inicio' : '/dashboard')
    } catch {
      setError('Sin conexión. Intenta de nuevo.')
    } finally {
      setCargandoId(null)
    }
  }

  function tocarCuenta(cuenta) {
    if (cuenta.conPin) { setCuentaPin(cuenta); setError(''); setModo('pin'); return }
    entrarConCuenta(cuenta)
  }

  function quitarCuenta(cuenta) {
    fetch(`/api/cuentas-guardadas/${cuenta.id}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ llave: cuenta.llave }),
    }).catch(() => {})
    quitarCuentaDelTelefono(cuenta.id)
    const lista = leerCuentasGuardadas()
    setCuentas(lista)
    if (!lista.length) setModo('formulario')
  }

  async function guardarEsteTelefono(pin) {
    try {
      const res = await fetch('/api/cuentas-guardadas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pin ? { pin } : {}),
      })
      if (res.ok) guardarCuentaEnTelefono(await res.json())
    } catch { /* guardar es un extra: si falla, igual entra */ }
  }

  // Crear el PIN: se escribe dos veces. Si no coinciden, se vuelve a empezar.
  async function alEscribirPinNuevo(pin) {
    if (!pinNuevo) { setPinNuevo(pin); setError(''); return }
    if (pin !== pinNuevo) {
      setPinNuevo('')
      setError('Los dos PIN no coinciden. Escríbelo otra vez.')
      return
    }
    setLoading(true)
    await guardarEsteTelefono(pin)
    irAlPanel(destino)
  }
```

En `handleSubmit`, sustituir la última línea (`window.location.href = esSuperadmin ? '/admin/inicio' : '/dashboard'`) por:

```js
      const url = esSuperadmin ? '/admin/inicio' : '/dashboard'
      // «Guardar esta cuenta en este teléfono». Al dueño y al superadmin se les
      // pide antes un PIN; al cobrador no.
      if (recordar) {
        if (rolDeSesion === 'owner' || rolDeSesion === 'superadmin') {
          setDestino(url)
          setModo('crear-pin')
          return
        }
        await guardarEsteTelefono()
      }
      irAlPanel(url)
```

Y en el bloque `try` que lee `/api/auth/session`, guardar también el rol: declarar `let rolDeSesion = null` junto a `let esSuperadmin = false` y, dentro, `rolDeSesion = session?.user?.rol ?? null`.

En el JSX, envolver el `<form>` actual en `{modo === 'formulario' && (…)}` y añadir antes, en el mismo contenedor:

```jsx
          {modo === 'cuentas' && (
            <>
              {error && <p className="text-[13px] mb-3" style={{ color: 'var(--cf-red-darker)' }}>{error}</p>}
              <CuentasGuardadas cuentas={cuentas} cargandoId={cargandoId}
                onEntrar={tocarCuenta} onQuitar={quitarCuenta} onOtra={() => { setError(''); setModo('formulario') }} />
            </>
          )}

          {modo === 'pin' && cuentaPin && (
            <div className="flex flex-col gap-4">
              <PinDeCuatro titulo={`PIN de ${cuentaPin.nombre}`} error={error} cargando={cargandoId === cuentaPin.id}
                onCompleto={(pin) => entrarConCuenta(cuentaPin, pin)} />
              <button type="button" onClick={() => { setError(''); setModo('cuentas') }} className="text-[14px] font-semibold"
                style={{ background: 'none', border: 0, color: 'var(--cf-ink-2)', cursor: 'pointer' }}>
                Volver
              </button>
            </div>
          )}

          {modo === 'crear-pin' && (
            <div className="flex flex-col gap-4">
              {/* `key` remonta el campo entre el primer PIN y la confirmación: vacío y con el foco. */}
              <PinDeCuatro key={pinNuevo ? 'confirmar' : 'crear'} error={error} cargando={loading}
                titulo={pinNuevo ? 'Escríbelo otra vez para confirmarlo' : 'Crea un PIN de 4 números para entrar con un toque'}
                onCompleto={alEscribirPinNuevo} />
              <button type="button" onClick={() => irAlPanel(destino)} className="text-[14px] font-semibold"
                style={{ background: 'none', border: 0, color: 'var(--cf-ink-2)', cursor: 'pointer' }}>
                Ahora no
              </button>
            </div>
          )}
```

«Ahora no» entra sin guardar la cuenta: la sesión ya está abierta y no se puede dejar a nadie atascado en este paso.

Por último, cambiar el texto de la casilla, en el `<span>` junto al checkbox: `Mantener la sesión en este teléfono` → `Guardar esta cuenta en este teléfono`. La casilla ya empieza marcada (`useState(true)`), como pide el diseño.

- [ ] **Paso 7: ejecutar las pruebas**

Ejecutar: `npx vitest run lib/__tests__/cuentas-guardadas-cliente.test.js lib/__tests__/login-mensajes-de-error.test.js lib/__tests__/login-resiliente.test.js`
Esperado: PASAN. `npx eslint app/login components/auth lib/cuentas-guardadas-cliente.js`: sin errores.

- [ ] **Paso 8: commit**

```bash
git add lib/cuentas-guardadas-cliente.js components/auth/CuentasGuardadas.jsx components/auth/PinDeCuatro.jsx app/login/page.jsx lib/__tests__/cuentas-guardadas-cliente.test.js
git commit -m "La pantalla de entrada: cuentas guardadas de un toque, PIN para el dueño

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 6: administrar los teléfonos (Configuración y ficha del cobrador)

**Ficheros:**
- Crear: `components/cuentas/TelefonosGuardados.jsx`
- Modificar:
  - `app/(dashboard)/configuracion/page.jsx`: `case 'seguridad'`, hoy en ~1535
  - `app/(dashboard)/cobradores/[id]/page.jsx`: una `<Card>` más antes de la última
- Prueba: `lib/__tests__/telefonos-guardados.test.js`

**Interfaces:**
- Consume: `GET`/`DELETE /api/cuentas-guardadas` y `/api/cobradores/[id]/cuentas-guardadas` (tarea 3).
- Produce: `<TelefonosGuardados cobradorId? />` (sin `cobradorId`, las propias).

- [ ] **Paso 1: la prueba, que falla**

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

describe('los teléfonos con la cuenta guardada', () => {
  it('el componente pide los propios o los del cobrador', () => {
    const c = src('components/cuentas/TelefonosGuardados.jsx')
    expect(c).toMatch(/const base = cobradorId \? `\/api\/cobradores\/\$\{cobradorId\}\/cuentas-guardadas` : '\/api\/cuentas-guardadas'/)
    expect(c).toMatch(/method: 'DELETE'/)
  })
  it('sale en Seguridad (para todos) y en la ficha del cobrador', () => {
    expect(src('app/(dashboard)/configuracion/page.jsx')).toMatch(/<TelefonosGuardados \/>/)
    expect(src('app/(dashboard)/cobradores/[id]/page.jsx')).toMatch(/<TelefonosGuardados cobradorId=\{id\} \/>/)
  })
})
```

- [ ] **Paso 2: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/telefonos-guardados.test.js`
Esperado: FALLA (el fichero no existe).

- [ ] **Paso 3: el componente**

```jsx
'use client'
/* Los teléfonos donde está guardada una cuenta: el aparato, cuándo se guardó,
   cuándo se usó por última vez, y «Quitar». Con `cobradorId`, los de ese
   cobrador (solo el dueño); sin él, los propios. El cero es un dato: sin
   teléfonos se dice, no se esconde la sección. */
import { useCallback, useEffect, useState } from 'react'

const fecha = (f) => {
  const d = new Date(f)
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${d.getDate()} ${MESES[d.getMonth()]}`
}

export default function TelefonosGuardados({ cobradorId = null }) {
  const base = cobradorId ? `/api/cobradores/${cobradorId}/cuentas-guardadas` : '/api/cuentas-guardadas'
  const [aparatos, setAparatos] = useState(null)

  const cargar = useCallback(() => {
    fetch(base).then((r) => r.json()).then((d) => setAparatos(d.aparatos ?? [])).catch(() => setAparatos([]))
  }, [base])
  useEffect(() => { cargar() }, [cargar])

  const quitar = async (id) => {
    await fetch(`${base}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
    cargar()
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] font-semibold" style={{ color: 'var(--cf-ink)' }}>
        {cobradorId ? 'Teléfonos con su cuenta guardada' : 'Teléfonos con tu cuenta guardada'}
      </p>
      {aparatos === null ? null : aparatos.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--cf-ink-3)' }}>Ningún teléfono la tiene guardada.</p>
      ) : aparatos.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-3 py-2" style={{ borderBottom: '1px solid var(--cf-hairline)' }}>
          <span className="min-w-0">
            <span className="block text-[14px]" style={{ color: 'var(--cf-ink)' }}>{a.dispositivo || 'Teléfono'}</span>
            <span className="block text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>
              Guardada el {fecha(a.createdAt)} · último uso {fecha(a.lastUsedAt)}
            </span>
          </span>
          <button type="button" onClick={() => quitar(a.id)} className="text-[13px] font-semibold shrink-0"
            style={{ background: 'none', border: 0, color: 'var(--cf-red-dark)', cursor: 'pointer' }}>
            Quitar
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Paso 4: conectarlo**

- `app/(dashboard)/configuracion/page.jsx`: `import TelefonosGuardados from '@/components/cuentas/TelefonosGuardados'`. En `case 'seguridad'` debe salir para todos; el `Remite` del cobrador se conserva debajo:
  ```jsx
      case 'seguridad':
        return (
          <>
            <TelefonosGuardados />
            {esOwner
              ? <TabOrganizacion bloques={['peligro']} />
              : <Remite nombre="Seguridad" nota="Tu contraseña se cambia desde «Tus datos»." destino="/configuracion?s=datos" accion="Ir a Tus datos" />}
          </>
        )
  ```
- `app/(dashboard)/cobradores/[id]/page.jsx`: `import TelefonosGuardados from '@/components/cuentas/TelefonosGuardados'`, y antes de la última `<Card>` del `return` principal (~línea 517):
  ```jsx
      <Card>
        <TelefonosGuardados cobradorId={id} />
      </Card>
  ```
  (`id` es la variable que `CobradorDetalleInner` ya saca con `const { id } = use(params)`.)

- [ ] **Paso 5: ejecutar la prueba**

Ejecutar: `npx vitest run lib/__tests__/telefonos-guardados.test.js`
Esperado: PASA.

- [ ] **Paso 6: commit**

```bash
git add components/cuentas/TelefonosGuardados.jsx "app/(dashboard)/configuracion/page.jsx" "app/(dashboard)/cobradores/[id]/page.jsx" lib/__tests__/telefonos-guardados.test.js
git commit -m "Ver y quitar los teléfonos con la cuenta guardada (propios y de cada cobrador)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 7: la regla de solo lectura y el pase firmado

**Ficheros:**
- Crear: `lib/solo-lectura.js` (sin imports de Node: corre en el Edge), `lib/pase-de-vista.js`
- Modificar: `middleware.js` (al principio del bloque `if (pathname.startsWith('/api/'))`)
- Prueba: `lib/__tests__/solo-lectura.test.js`

**Interfaces:**
- Consume: nada.
- Produce:
  - `bloqueaSoloLectura({ soloLectura, pathname, method }) → boolean`
  - `mensajeSoloLectura(nombre) → string`
  - `VISTA_MS = 3600000`, `VIDA_PASE_MS = 60000`
  - `firmarPase(datos, secreto, ahora?) → string`
  - `leerPase(pase, secreto, ahora?) → datos | null`

- [ ] **Paso 1: la prueba, que falla**

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { bloqueaSoloLectura, mensajeSoloLectura } from '@/lib/solo-lectura'
import { firmarPase, leerPase, VIDA_PASE_MS } from '@/lib/pase-de-vista'

describe('solo lectura', () => {
  const vista = (method, pathname) => bloqueaSoloLectura({ soloLectura: true, pathname, method })
  it('en vista: leer pasa, escribir no', () => {
    expect(vista('GET', '/api/caja')).toBe(false)
    expect(vista('HEAD', '/api/rutas')).toBe(false)
    expect(vista('POST', '/api/prestamos/x/pagos')).toBe(true)
    expect(vista('PATCH', '/api/prestamos/x')).toBe(true)
    expect(vista('DELETE', '/api/pagos/x')).toBe(true)
    expect(vista('PUT', '/api/rutas/x/orden')).toBe(true)
  })
  it('las excepciones: salir, volver, iniciar sesión con el pase y el registro de errores', () => {
    expect(vista('POST', '/api/auth/callback/pase')).toBe(false)
    expect(vista('POST', '/api/auth/signout')).toBe(false)
    expect(vista('POST', '/api/ver-como/volver')).toBe(false)
    expect(vista('POST', '/api/errores-cliente')).toBe(false)
    // y NO el resto de /api/auth/: cambiar una clave con token sigue cerrado
    expect(vista('POST', '/api/auth/reset-password')).toBe(true)
  })
  it('fuera de vista no bloquea nada', () => {
    expect(bloqueaSoloLectura({ soloLectura: false, pathname: '/api/caja', method: 'POST' })).toBe(false)
  })
  it('el mensaje dice a quién está viendo', () => {
    expect(mensajeSoloLectura('Juan')).toBe('Estás viendo como Juan: desde aquí no se registra nada. Vuelve a tu cuenta.')
  })
  it('el middleware la aplica antes que nada en /api/', () => {
    const mw = readFileSync(resolve(process.cwd(), 'middleware.js'), 'utf8')
    const api = mw.indexOf("if (pathname.startsWith('/api/')) {")
    const regla = mw.indexOf('bloqueaSoloLectura({ soloLectura: token?.soloLectura, pathname, method: request.method })')
    expect(regla).toBeGreaterThan(api)
    expect(regla).toBeLessThan(mw.indexOf('const EXENTAS'))
  })
})

describe('el pase', () => {
  const S = 'secreto-de-prueba'
  it('firmado vale; alterado o vencido, no', () => {
    const ahora = 1_700_000_000_000
    const p = firmarPase({ tipo: 'ver-como', ownerId: 'o1', cobradorId: 'c1' }, S, ahora)
    expect(leerPase(p, S, ahora + 1000)).toMatchObject({ tipo: 'ver-como', ownerId: 'o1', cobradorId: 'c1' })
    expect(leerPase(p, S, ahora + VIDA_PASE_MS + 1)).toBeNull()
    expect(leerPase(p, 'otro-secreto', ahora)).toBeNull()
    const [cuerpo, firma] = p.split('.')
    const otro = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(cuerpo, 'base64url').toString()), cobradorId: 'c2' })).toString('base64url')
    expect(leerPase(`${otro}.${firma}`, S, ahora)).toBeNull()
    expect(leerPase('basura', S, ahora)).toBeNull()
  })
})
```

- [ ] **Paso 2: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/solo-lectura.test.js`
Esperado: FALLA al resolver los módulos.

- [ ] **Paso 3: `lib/solo-lectura.js`**

```js
/* «VER COMO ESTE COBRADOR» ES DE SOLO LECTURA, Y SE DECIDE AQUÍ — 24 sep 2026.
   El dueño entra a ver la caja y la ruta de su cobrador tal como él las ve. Los
   botones siguen en pantalla para que sea idéntica; lo que no pasa es nada que
   escriba. Una regla, en el portero de todas las /api/, para que ninguna
   pantalla nueva se la salte. Sin imports: corre en el Edge (middleware.js). */
const LECTURA = ['GET', 'HEAD', 'OPTIONS']
const SIEMPRE_ABIERTAS = [
  '/api/auth/callback/', '/api/auth/signout', '/api/auth/session', '/api/auth/csrf', '/api/auth/_log',
  '/api/ver-como/volver', '/api/errores-cliente',
]

export function bloqueaSoloLectura({ soloLectura, pathname, method }) {
  if (!soloLectura || !String(pathname).startsWith('/api/')) return false
  if (LECTURA.includes(String(method).toUpperCase())) return false
  return !SIEMPRE_ABIERTAS.some((p) => pathname.startsWith(p))
}

export function mensajeSoloLectura(nombre) {
  return `Estás viendo como ${nombre}: desde aquí no se registra nada. Vuelve a tu cuenta.`
}
```

- [ ] **Paso 4: `lib/pase-de-vista.js`**

```js
/* El pase para entrar a «ver como» o volver: lo firma una ruta del API que SÍ ve
   la sesión del dueño, y lo canjea el proveedor `pase` de NextAuth. Dura 60 s.
   HMAC-SHA256 con NEXTAUTH_SECRET: sin el secreto no se fabrica uno. */
import crypto from 'crypto'

export const VIDA_PASE_MS = 60 * 1000
export const VISTA_MS = 60 * 60 * 1000

const firma = (cuerpo, secreto) => crypto.createHmac('sha256', String(secreto)).update(cuerpo).digest('base64url')

export function firmarPase(datos, secreto, ahora = Date.now()) {
  const cuerpo = Buffer.from(JSON.stringify({ ...datos, exp: ahora + VIDA_PASE_MS })).toString('base64url')
  return `${cuerpo}.${firma(cuerpo, secreto)}`
}

export function leerPase(pase, secreto, ahora = Date.now()) {
  try {
    const [cuerpo, f] = String(pase ?? '').split('.')
    if (!cuerpo || !f) return null
    const esperada = Buffer.from(firma(cuerpo, secreto))
    const dada = Buffer.from(f)
    if (esperada.length !== dada.length || !crypto.timingSafeEqual(esperada, dada)) return null
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString())
    if (!(datos?.exp > ahora)) return null
    return datos
  } catch { return null }
}
```

- [ ] **Paso 5: `middleware.js`**

`import { bloqueaSoloLectura, mensajeSoloLectura } from '@/lib/solo-lectura'`. Si el alias `@/` no resuelve en el Edge, usar `./lib/solo-lectura`. Primera instrucción dentro de `if (pathname.startsWith('/api/')) {`:

```js
    // «Ver como este cobrador» es de SOLO LECTURA: nada que escriba pasa. Ver lib/solo-lectura.js.
    if (bloqueaSoloLectura({ soloLectura: token?.soloLectura, pathname, method: request.method })) {
      return NextResponse.json({ error: mensajeSoloLectura(token?.nombre ?? 'el cobrador'), soloLectura: true }, { status: 403 })
    }
```

- [ ] **Paso 6: ejecutar las pruebas, incluida la del middleware**

Ejecutar: `npx vitest run lib/__tests__/solo-lectura.test.js lib/__tests__/middleware-rutas.test.js`
Esperado: PASAN.

- [ ] **Paso 7: commit**

```bash
git add lib/solo-lectura.js lib/pase-de-vista.js middleware.js lib/__tests__/solo-lectura.test.js
git commit -m "Solo lectura en el portero de /api/ y el pase firmado de «ver como»

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 8: entrar a «ver como», volver, y la vuelta sola a la hora

**Ficheros:**
- Crear: `app/api/ver-como/route.js`, `app/api/ver-como/volver/route.js`, `lib/token-de-sesion.js`
- Modificar:
  - `lib/auth.js`: proveedor `pase`; callbacks `jwt` y `session`, que usan `lib/token-de-sesion.js`
  - `lib/activity-log-types.js`: acción `ver_como_cobrador`
  - `app/(dashboard)/actividad/page.jsx`: icono `eye` en `ICONOS`
- Prueba: `lib/__tests__/ver-como.test.js`

**Interfaces:**
- Consume:
  - `firmarPase`, `leerPase`, `VISTA_MS` (tarea 7)
  - `usuarioParaSesion`, `sesionDeUsuario` (tarea 2)
  - `logActividad` (existe)
- Produce:
  - `POST /api/ver-como` con `{ cobradorId }` → `{ pase }`
  - `POST /api/ver-como/volver` → `{ pase, cobradorId }`
  - el proveedor `id: 'pase'` con `{ pase }`
  - en la sesión: `session.user.vistaDe` (`{ id, nombre } | null`), `session.user.soloLectura` (boolean), `session.user.vistaHasta` (`number | null`)
  - `copiarAlToken(token, user) → token`, en `lib/token-de-sesion.js`
  - `volverSiVencio(token, ahora?) → Promise<token>`, en `lib/token-de-sesion.js`

- [ ] **Paso 1: la prueba, que falla**

```js
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const dueno = vi.hoisted(() => ({ id: 'o1', nombre: 'Carlos', rol: 'owner', organizationId: 'org1' }))
vi.mock('@/lib/auth-sesion', () => ({
  usuarioParaSesion: vi.fn(async (id) => (id === 'o1' ? dueno : null)),
  sesionDeUsuario: vi.fn(async (u) => ({ id: u.id, nombre: u.nombre, rol: u.rol, organizationId: u.organizationId })),
}))

import { volverSiVencio } from '@/lib/token-de-sesion'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

describe('la vuelta sola a la hora', () => {
  it('vencida la vista, el token vuelve a ser del dueño', async () => {
    const t = { id: 'c1', rol: 'cobrador', vistaDe: { id: 'o1', nombre: 'Carlos' }, soloLectura: true, vistaHasta: 1000 }
    const r = await volverSiVencio(t, 2000)
    expect(r).toMatchObject({ id: 'o1', rol: 'owner', soloLectura: false, vistaDe: null, vistaHasta: null })
  })
  it('si el dueño ya no existe o no se puede revisar, SIGUE en solo lectura', async () => {
    const t = { id: 'c1', rol: 'cobrador', vistaDe: { id: 'nadie', nombre: 'X' }, soloLectura: true, vistaHasta: 1000 }
    const r = await volverSiVencio(t, 2000)
    expect(r).toMatchObject({ id: 'c1', soloLectura: true })
  })
  it('antes de la hora no toca nada', async () => {
    const t = { id: 'c1', vistaDe: { id: 'o1' }, soloLectura: true, vistaHasta: 5000 }
    expect(await volverSiVencio(t, 2000)).toBe(t)
  })
})

describe('las rutas y el proveedor', () => {
  it('ver-como: solo el dueño, sin estar ya en vista, y solo cobradores activos de su negocio', () => {
    const r = src('app/api/ver-como/route.js')
    expect(r).toMatch(/session\.user\.rol !== 'owner' \|\| session\.user\.soloLectura/)
    expect(r).toMatch(/where: \{ id: cobradorId, organizationId: session\.user\.organizationId, rol: 'cobrador', activo: true \}/)
    expect(r).toMatch(/accion: 'ver_como_cobrador'/)
  })
  it('volver: solo desde una vista', () => {
    expect(src('app/api/ver-como/volver/route.js')).toMatch(/if \(!session\?\.user\?\.vistaDe\?\.id\)/)
  })
  it('el proveedor vuelve a revisar lo mismo que la ruta', () => {
    const a = src('lib/auth.js')
    expect(a).toMatch(/id: 'pase'/)
    expect(a).toMatch(/cobrador\.organizationId !== duenoPase\.organizationId/)
    expect(a).toMatch(/soloLectura: true, vistaHasta: Date\.now\(\) \+ VISTA_MS/)
  })
  it('la acción tiene su nombre en el Historial', () => {
    expect(src('lib/activity-log-types.js')).toMatch(/ver_como_cobrador: \{ label: 'Vio la app como su cobrador'/)
  })
})
```

- [ ] **Paso 2: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/ver-como.test.js`
Esperado: FALLA: `volverSiVencio` no existe.

- [ ] **Paso 3: `app/api/ver-como/route.js`**

```js
// «Ver como este cobrador»: firma el pase para entrar a su vista de SOLO LECTURA.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { firmarPase } from '@/lib/pase-de-vista'
import { logActividad } from '@/lib/activity-log'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || session.user.rol !== 'owner' || session.user.soloLectura) {
    return Response.json({ error: 'Solo el dueño puede ver como un cobrador.' }, { status: 403 })
  }
  const { cobradorId } = await request.json().catch(() => ({}))
  const cobrador = await prisma.user.findFirst({
    where: { id: cobradorId, organizationId: session.user.organizationId, rol: 'cobrador', activo: true },
    select: { id: true, nombre: true },
  })
  if (!cobrador) return Response.json({ error: 'Ese cobrador no está activo en tu negocio.' }, { status: 404 })
  logActividad({
    session, accion: 'ver_como_cobrador', entidadTipo: 'usuario', entidadId: cobrador.id,
    detalle: `Vio la app como ${cobrador.nombre}`,
  })
  const pase = firmarPase({ tipo: 'ver-como', ownerId: session.user.id, cobradorId: cobrador.id }, process.env.NEXTAUTH_SECRET)
  return Response.json({ pase })
}
```

- [ ] **Paso 4: `app/api/ver-como/volver/route.js`**

```js
// «Volver a mi cuenta»: desde la vista, sin contraseña ni PIN, porque ya eras tú.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { firmarPase } from '@/lib/pase-de-vista'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.vistaDe?.id) {
    return Response.json({ error: 'No estás viendo como nadie.' }, { status: 400 })
  }
  const pase = firmarPase({ tipo: 'volver', ownerId: session.user.vistaDe.id }, process.env.NEXTAUTH_SECRET)
  return Response.json({ pase, cobradorId: session.user.id })
}
```

- [ ] **Paso 5: `lib/auth.js` (el proveedor) y `lib/token-de-sesion.js` (`copiarAlToken` y `volverSiVencio`)**

Imports en `lib/auth.js`: `import { leerPase, VISTA_MS } from '@/lib/pase-de-vista'` y `import { copiarAlToken, volverSiVencio } from '@/lib/token-de-sesion'`.

Proveedor, en `providers`:

```js
    /* EL PASE DE «VER COMO» Y DE «VOLVER». Lo firma /api/ver-como (o /volver),
       que sí ve la sesión; aquí se canjea y se REVISA OTRA VEZ lo mismo. */
    CredentialsProvider({
      id: 'pase',
      name: 'pase',
      credentials: { pase: {} },
      async authorize(credentials) {
        const p = leerPase(credentials?.pase, process.env.NEXTAUTH_SECRET)
        if (!p) throw new Error('El pase venció. Vuelve a intentarlo.')
        const duenoPase = await usuarioParaSesion(p.ownerId)
        if (!duenoPase || duenoPase.rol !== 'owner') throw new Error('No se pudo abrir esta vista.')
        if (p.tipo === 'volver') return sesionDeUsuario(duenoPase)
        if (p.tipo !== 'ver-como') throw new Error('No se pudo abrir esta vista.')
        const cobrador = await usuarioParaSesion(p.cobradorId)
        if (!cobrador || cobrador.rol !== 'cobrador' || cobrador.organizationId !== duenoPase.organizationId) {
          throw new Error('Ese cobrador no está en tu negocio.')
        }
        const s = await sesionDeUsuario(cobrador)
        return { ...s, vistaDe: { id: duenoPase.id, nombre: duenoPase.nombre }, soloLectura: true, vistaHasta: Date.now() + VISTA_MS }
      },
    }),
```

`lib/token-de-sesion.js` es un fichero aparte para poder probarlo sin cargar NextAuth. `copiarAlToken` es la lista de asignaciones que hoy está dentro del `if (user) { … }` del callback `jwt`, más los tres campos de la vista:

```js
/* Del objeto de sesión al JWT, y la vuelta sola de «ver como» a la hora. Aparte
   de lib/auth.js para probarlo sin cargar NextAuth. */
import { usuarioParaSesion, sesionDeUsuario } from '@/lib/auth-sesion'

/** Del objeto de sesión (authorize) al JWT. Tres campos de la vista: en un login normal quedan en null. */
export function copiarAlToken(token, user) {
  token.id                    = user.id
  token.nombre                = user.nombre
  token.rol                   = user.rol
  token.organizationId        = user.organizationId
  token.plan                  = user.plan
  token.rutaId                = user.rutaId
  token.rutaIds               = user.rutaIds ?? []
  token.permisos              = user.permisos
  token.suscripcionVencimiento = user.suscripcionVencimiento
  token.onboardingCompletado  = user.onboardingCompletado
  token.emailVerificado       = user.emailVerificado
  token.avatarId              = user.avatarId ?? null
  token.country               = user.country ?? 'co'
  token.timezone              = user.timezone ?? null
  token.orgNombre             = user.orgNombre ?? null
  token.modoAbreviado         = user.modoAbreviado ?? false
  token.ocultarSaldoWA        = user.ocultarSaldoWA ?? false
  token.camposRecibo          = user.camposRecibo ?? null
  token.vistaDe               = user.vistaDe ?? null
  token.soloLectura           = !!user.soloLectura
  token.vistaHasta            = user.vistaHasta ?? null
  token.lastRefresh           = Date.now()
  return token
}

/* A la hora, la vista vuelve sola a la cuenta del dueño. ⚠ Si no se puede
   revisar al dueño (sin red, borrado, desactivado), NO se vuelve: se sigue en
   solo lectura. Nunca se sale de la vista a una cuenta con permiso de escribir
   sin haberla revisado. */
export async function volverSiVencio(token, ahora = Date.now()) {
  if (!token?.vistaDe || !token.vistaHasta || ahora <= token.vistaHasta) return token
  try {
    const dueno = await usuarioParaSesion(token.vistaDe.id)
    if (!dueno) return token
    return copiarAlToken(token, await sesionDeUsuario(dueno))
  } catch {
    return token
  }
}
```

En el callback `jwt`:
- sustituir el cuerpo del `if (user) { … return token }` por `if (user) return copiarAlToken(token, user)`;
- justo después, `token = await volverSiVencio(token)`.

El refresco de 15 minutos no toca `vistaDe`, `soloLectura` ni `vistaHasta`, así que se conservan.

⚠ **La cookie solo se reescribe cuando se llama a `/api/auth/session`.** `getServerSession` en una ruta del API corre el callback, pero no puede guardar la cookie. Pasada la hora, las rutas ya ven al dueño mientras la cookie sigue en vista; el portero sigue bloqueando la escritura, que es lo seguro. Por eso la franja (tarea 9) pide `/api/auth/session` al cumplirse la hora, y así la cookie se reescribe como la del dueño.

En el callback `session`, añadir:

```js
        session.user.vistaDe               = token.vistaDe ?? null
        session.user.soloLectura           = !!token.soloLectura
        session.user.vistaHasta            = token.vistaHasta ?? null
```

- [ ] **Paso 6: el Historial**

En `lib/activity-log-types.js`, junto a `financiar_prestamo`:

```js
  ver_como_cobrador: { label: 'Vio la app como su cobrador', icon: 'eye', color: '#3298d4' },
```

El icono `eye` no existe todavía: sin él, la pantalla de Actividad cae en el lápiz (`ICONOS[config?.icon] || ICONOS.pencil`). Añadirlo a `ICONOS` en `app/(dashboard)/actividad/page.jsx`, con el mismo formato que los demás:

```jsx
  eye: (color) => (
    <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  ),
```

Y en la prueba de este paso (`ver-como.test.js`), dentro de `describe('las rutas y el proveedor')`:

```js
  it('el Historial tiene su icono (si no, sale un lápiz)', () => {
    expect(src('app/(dashboard)/actividad/page.jsx')).toMatch(/^\s+eye: \(color\) => \(/m)
  })
```

- [ ] **Paso 7: ejecutar la prueba y la de tipos del Historial**

Ejecutar: `npx vitest run lib/__tests__/ver-como.test.js lib/__tests__/activity-log.test.js`
Esperado: PASAN. Y `npx vitest run` completo, para detectar pruebas que anclaban el bloque `if (user)` del callback `jwt`. Si alguna lo hacía, se reapunta a `copiarAlToken` en `lib/token-de-sesion.js`, sin cambiar lo que comprueba.

- [ ] **Paso 8: commit**

```bash
git add app/api/ver-como lib/auth.js lib/token-de-sesion.js lib/activity-log-types.js "app/(dashboard)/actividad/page.jsx" lib/__tests__/ver-como.test.js
git commit -m "«Ver como este cobrador» y «volver»: pase firmado, 1 hora, vuelta sola

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 9: los botones, la franja, y que la vista no deje rastro

**Ficheros:**
- Crear: `lib/modo-vista.js`, `lib/cambio-de-cuenta.js`, `components/cobradores/BotonVerComo.jsx`, `components/armazon/FranjaVerComo.jsx`
- Modificar:
  - `lib/offline.js`: `borrarCacheDeLecturas`; en vista no se guarda nada en caché (`guardarEnCache`), las cuatro sincronizaciones no suben nada y `sincronizarTodo` no descarga
  - `lib/push-cliente.js`: `activarPush` no suscribe en vista
  - `components/providers/SesionTracker.jsx`: no hace ping en vista y sincroniza la marca
  - `app/(dashboard)/layout.jsx`: `<FranjaVerComo />` junto a `<AvisoSinSenal />`
  - `app/(dashboard)/cobradores/[id]/page.jsx`: `<BotonVerComo … />`
- Prueba: `lib/__tests__/ver-como-sin-rastro.test.js`

**Interfaces:**
- Consume:
  - `POST /api/ver-como` y `POST /api/ver-como/volver` (tarea 8)
  - el proveedor `pase` (tarea 8)
  - `session.user.soloLectura`, `session.user.vistaDe`, `session.user.vistaHasta` y `session.user.nombre` (tarea 8)
- Produce:
  - `marcarSoloLectura(v)` y `estaEnSoloLectura() → boolean`, en `lib/modo-vista.js`
  - `borrarCacheDeLecturas() → Promise<void>`, en `lib/offline.js`
  - `olvidarLecturasDeOtraCuenta() → Promise<void>`, en `lib/cambio-de-cuenta.js`
  - los componentes `<BotonVerComo cobradorId nombre />` y `<FranjaVerComo />`

**Por qué la marca vive en el teléfono y no solo en la sesión:** las sincronizaciones sin conexión corren solas cada pocos segundos y no leen la sesión. Si en vista subieran los cobros pendientes del dueño, lo harían con la cookie del cobrador; el portero contestaría 403 y `sincronizarPagos` los marcaría como fallidos. La marca va en `localStorage`, no en `sessionStorage`: la app instalada pierde el `sessionStorage` al cerrarse, mientras que la cookie de vista dura hasta una hora.

- [ ] **Paso 1: la prueba, que falla**

`lib/__tests__/ver-como-sin-rastro.test.js`:

```js
import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { marcarSoloLectura, estaEnSoloLectura } from '@/lib/modo-vista'
import { sincronizarPagos, sincronizarOrdenes, sincronizarCreaciones, sincronizarMutaciones } from '@/lib/offline'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')
function almacen() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}
afterEach(() => vi.unstubAllGlobals())

describe('la marca de solo lectura del teléfono', () => {
  it('se enciende y se apaga, y sin almacenamiento dice que no', () => {
    vi.stubGlobal('localStorage', almacen())
    expect(estaEnSoloLectura()).toBe(false)
    marcarSoloLectura(true)
    expect(estaEnSoloLectura()).toBe(true)
    marcarSoloLectura(false)
    expect(estaEnSoloLectura()).toBe(false)
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } })
    expect(estaEnSoloLectura()).toBe(false)
    expect(() => marcarSoloLectura(true)).not.toThrow()
  })

  it('en vista, NINGUNA de las cuatro sincronizaciones sube nada con la sesión del cobrador', async () => {
    vi.stubGlobal('localStorage', almacen())
    vi.stubGlobal('navigator', { onLine: true })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    marcarSoloLectura(true)
    for (const sincronizar of [sincronizarPagos, sincronizarOrdenes, sincronizarCreaciones, sincronizarMutaciones]) {
      expect(await sincronizar()).toEqual({ synced: 0, failed: 0 })
    }
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('sin rastro en el cobrador', () => {
  const offline = src('lib/offline.js')
  it('en vista no se guarda nada para uso sin conexión ni se descarga la cartera', () => {
    expect(offline).toMatch(/export async function guardarEnCache\(key, data\) \{\n\s+if \(estaEnSoloLectura\(\)\) return/)
    expect(offline).toMatch(/export async function sincronizarTodo\(onProgress\) \{\n\s+if \(estaEnSoloLectura\(\)\) return \{ clientes: 0, prestamos: 0, rutas: 0, syncedAt: null \}/)
  })
  it('el ping de sesión y las notificaciones no corren en vista', () => {
    expect(src('components/providers/SesionTracker.jsx')).toMatch(/if \(session\.user\.soloLectura\) return/)
    expect(src('lib/push-cliente.js')).toMatch(/export async function activarPush\(\) \{\n\s+if \(estaEnSoloLectura\(\)\) return 'apagado'/)
  })
  it('al cambiar de identidad se tiran las lecturas y la sesión guardada, NO los cobros pendientes', () => {
    const c = src('lib/cambio-de-cuenta.js')
    expect(c).toMatch(/postMessage\(\{ type: 'CLEAR_API_CACHE' \}\)/)
    expect(c).toMatch(/await borrarCacheDeLecturas\(\)/)
    expect(c).toMatch(/localStorage\.removeItem\(CLAVE_SESION_GUARDADA\)/)
    expect(c).not.toMatch(/limpiarDatosOffline/)
    // La clave tiene que ser la MISMA que usa el SessionProvider.
    const clave = c.match(/const CLAVE_SESION_GUARDADA = '([^']+)'/)[1]
    expect(src('components/providers/SessionProvider.jsx')).toContain(`const STORAGE_KEY = '${clave}'`)
  })
})

describe('la entrada y la salida', () => {
  it('el botón y la franja usan el pase', () => {
    expect(src('components/cobradores/BotonVerComo.jsx')).toMatch(/signIn\('pase', \{ pase: d\.pase, redirect: false \}\)/)
    const franja = src('components/armazon/FranjaVerComo.jsx')
    expect(franja).toMatch(/fetch\('\/api\/ver-como\/volver', \{ method: 'POST' \}\)/)
    expect(src('app/(dashboard)/layout.jsx')).toMatch(/<FranjaVerComo \/>/)
  })
  it('a la hora, la franja reescribe la cookie y solo sale si la sesión nueva ya no es de vista (sin bucles)', () => {
    const franja = src('components/armazon/FranjaVerComo.jsx')
    expect(franja).toMatch(/fetch\('\/api\/auth\/session'\)/)
    expect(franja).toMatch(/if \(nueva\?\.user && !nueva\.user\.soloLectura\) return salir\(cobradorId\)/)
  })
})
```

- [ ] **Paso 2: ejecutarla, tiene que fallar**

Ejecutar: `npx vitest run lib/__tests__/ver-como-sin-rastro.test.js`
Esperado: FALLA al resolver `@/lib/modo-vista`.

- [ ] **Paso 3: `lib/modo-vista.js`**

```js
/* «VER COMO ESTE COBRADOR»: la marca de solo lectura EN ESTE TELÉFONO.
   Las sincronizaciones sin conexión corren solas y no leen la sesión: sin esta
   marca, los cobros pendientes del dueño se subirían con la cookie del
   cobrador, el portero los rechazaría y quedarían como fallidos. En
   localStorage (no sessionStorage): la app instalada pierde el sessionStorage
   al cerrarse y la cookie de vista dura hasta una hora. La encienden el botón
   «Ver como» y la franja; SesionTracker la iguala a la sesión en cada carga. */
const CLAVE = 'cf-solo-lectura'

export function marcarSoloLectura(v) {
  try { v ? localStorage.setItem(CLAVE, '1') : localStorage.removeItem(CLAVE) } catch {}
}

export function estaEnSoloLectura() {
  try { return localStorage.getItem(CLAVE) === '1' } catch { return false }
}
```

- [ ] **Paso 4: `lib/offline.js`**

`import { estaEnSoloLectura } from '@/lib/modo-vista'` y, como **primera línea** de cada función:

| función | primera línea |
|---|---|
| `guardarEnCache(key, data)` | `if (estaEnSoloLectura()) return` |
| `sincronizarPagos(…)` | `if (estaEnSoloLectura()) return { synced: 0, failed: 0 }` |
| `sincronizarOrdenes()` | `if (estaEnSoloLectura()) return { synced: 0, failed: 0 }` |
| `sincronizarCreaciones()` | `if (estaEnSoloLectura()) return { synced: 0, failed: 0 }` |
| `sincronizarMutaciones()` | `if (estaEnSoloLectura()) return { synced: 0, failed: 0 }` |
| `sincronizarTodo(onProgress)` | `if (estaEnSoloLectura()) return { clientes: 0, prestamos: 0, rutas: 0, syncedAt: null }` |

Son las formas que ya devuelven: `OfflineProvider` suma `.synced` y `.failed` de las cuatro y lee `.clientes`, `.prestamos`, `.rutas` y `.syncedAt` de la última.

Y una función nueva, junto a `invalidarCachePorPrefijo`:

```js
/** Tira SOLO las lecturas guardadas (listas, resumen, la cartera para sin
 *  conexión). Las colas de cobros, clientes, préstamos y cambios pendientes no
 *  se tocan. La cartera del dueño vuelve sola en la siguiente sincronización
 *  completa del OfflineProvider. */
export async function borrarCacheDeLecturas() {
  try {
    const db = await openDB()
    await new Promise((resolve) => {
      const tx = db.transaction(STORE_CACHE, 'readwrite')
      tx.objectStore(STORE_CACHE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    })
  } catch {}
}
```

- [ ] **Paso 5: `lib/push-cliente.js`**

`import { estaEnSoloLectura } from '@/lib/modo-vista'` y, como primera línea de `activarPush` (el comentario va encima de la función, no entre las dos):

```js
// En «ver como», este teléfono no se suscribe a los avisos del cobrador.
export async function activarPush() {
  if (estaEnSoloLectura()) return 'apagado'
  try {
```

- [ ] **Paso 6: `lib/cambio-de-cuenta.js`**

```js
/* Al cambiar de identidad en el mismo teléfono (entrar a «ver como», volver)
   se tiran las LECTURAS guardadas de la anterior:
   - las cachés del service worker (`cf-api-*`) y las de pedirCompartido;
   - las lecturas de IndexedDB: si la red falla un momento, la app serviría
     lo del otro;
   - la sesión guardada del SessionProvider: arranca con ella y no la vuelve a
     pedir, así que sin borrarla la pantalla seguiría creyendo que es la cuenta
     anterior.
   Lo mismo que hace «Cerrar sesión» en Armazon.jsx, y por lo mismo NO se llama
   a limpiarDatosOffline(): borraría cobros pendientes sin subir. */
import { olvidarCompartido } from '@/lib/pedir-compartido'
import { borrarCacheDeLecturas } from '@/lib/offline'

// La misma clave que STORAGE_KEY en components/providers/SessionProvider.jsx (lo vigila una prueba).
const CLAVE_SESION_GUARDADA = 'cf-session-cache'

export async function olvidarLecturasDeOtraCuenta() {
  try { navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_API_CACHE' }) } catch {}
  olvidarCompartido()
  try { localStorage.removeItem(CLAVE_SESION_GUARDADA) } catch {}
  await borrarCacheDeLecturas()
}
```

- [ ] **Paso 7: `components/cobradores/BotonVerComo.jsx`**

```jsx
'use client'
/* «Ver como Juan»: abre la app como la ve él, en solo lectura. Ver lib/solo-lectura.js. */
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { marcarSoloLectura } from '@/lib/modo-vista'
import { olvidarLecturasDeOtraCuenta } from '@/lib/cambio-de-cuenta'

export default function BotonVerComo({ cobradorId, nombre }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  async function ver() {
    setCargando(true); setError('')
    try {
      const res = await fetch('/api/ver-como', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cobradorId }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'No se pudo abrir.'); return }
      // La marca ANTES de entrar: desde ya, este teléfono no sube ni guarda nada.
      marcarSoloLectura(true)
      const r = await signIn('pase', { pase: d.pase, redirect: false })
      if (r?.error) { marcarSoloLectura(false); setError(r.error); return }
      await olvidarLecturasDeOtraCuenta()
      window.location.href = '/dashboard'
    } catch {
      marcarSoloLectura(false)
      setError('Sin conexión. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={ver} disabled={cargando}
        className="flex items-center justify-center gap-2 w-full"
        style={{ height: 'var(--cf-h-btn-2)', borderRadius: 'var(--cf-r-control)', background: 'var(--cf-card)',
          border: '1px solid var(--cf-border-strong)', color: 'var(--cf-ink)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
        </svg>
        {cargando ? 'Abriendo…' : `Ver como ${nombre}`}
      </button>
      <p className="text-[12px]" style={{ color: 'var(--cf-ink-3)' }}>
        Ves su caja y su ruta como él las ve. Solo lectura: desde ahí no se registra nada.
      </p>
      {error && <p className="text-[13px]" style={{ color: 'var(--cf-red-darker)' }}>{error}</p>}
    </div>
  )
}
```

En `app/(dashboard)/cobradores/[id]/page.jsx`:
- añadir `import BotonVerComo from '@/components/cobradores/BotonVerComo'`;
- la página guarda al cobrador en `data`, con `data.nombre` y `data.activo`, y la sesión en `const { session } = useAuth()`;
- justo antes de la `<Card>` de «Reenviar credenciales» (~línea 316), añadir:

```jsx
      {session?.user?.rol === 'owner' && data?.activo && (
        <Card>
          <BotonVerComo cobradorId={id} nombre={data.nombre} />
        </Card>
      )}
```

- [ ] **Paso 8: `components/armazon/FranjaVerComo.jsx`**

```jsx
'use client'
/* «Viendo como Juan · solo lectura · Volver a mi cuenta». Fija arriba, en el
   armazón (como AvisoSinSenal): no toca la barra de navegación. Sin dorado: en
   tinta, para que no se confunda con una acción de plata.

   A LA HORA vuelve sola. El servidor ya lo hace en el callback `jwt`, pero la
   cookie solo se reescribe al pedir /api/auth/session, y el SessionProvider no
   la pide nunca por su cuenta (arranca con la sesión guardada). Aquí se pide
   al cumplirse la hora, y SOLO se sale si la sesión nueva ya no está en vista.
   Si el servidor no pudo volver (sin red, dueño desactivado) no se hace nada:
   la franja se queda, y sin bucle de recargas. */
import { useEffect, useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { marcarSoloLectura } from '@/lib/modo-vista'
import { olvidarLecturasDeOtraCuenta } from '@/lib/cambio-de-cuenta'

async function salir(cobradorId) {
  marcarSoloLectura(false)
  await olvidarLecturasDeOtraCuenta()
  window.location.href = `/cobradores/${cobradorId}`
}

// Pedir la sesión reescribe la cookie; pasada la hora, ya es la del dueño.
async function volverSiYaVencio(cobradorId) {
  try {
    const nueva = await fetch('/api/auth/session').then((r) => r.json())
    if (nueva?.user && !nueva.user.soloLectura) return salir(cobradorId)
  } catch {}
  return false
}

export default function FranjaVerComo() {
  const { data: session } = useSession()
  const [volviendo, setVolviendo] = useState(false)
  const [error, setError] = useState('')
  const enVista = !!session?.user?.soloLectura
  const cobradorId = session?.user?.id
  const vistaHasta = session?.user?.vistaHasta

  useEffect(() => {
    if (!enVista || !vistaHasta) return
    const t = setTimeout(() => { volverSiYaVencio(cobradorId) }, Math.max(0, vistaHasta - Date.now()) + 1000)
    return () => clearTimeout(t)
  }, [enVista, vistaHasta, cobradorId])

  if (!enVista) return null

  async function volver() {
    setVolviendo(true); setError('')
    try {
      const res = await fetch('/api/ver-como/volver', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        const r = await signIn('pase', { pase: d.pase, redirect: false })
        if (!r?.error) return salir(d.cobradorId)
      } else if (await volverSiYaVencio(cobradorId) !== false) {
        return // la hora ya había pasado: el servidor volvió solo
      }
    } catch {}
    setVolviendo(false)
    setError('No se pudo volver. Revisa la conexión e intenta otra vez.')
  }

  return (
    <div className="sticky top-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5"
      style={{ zIndex: 60, background: 'var(--cf-ink)', color: 'var(--cf-card)' }}>
      <span className="text-[13px] min-w-0">
        Viendo como <strong className="break-words">{session.user.nombre}</strong> · solo lectura
      </span>
      <button type="button" onClick={volver} disabled={volviendo} className="text-[13px] font-bold shrink-0"
        style={{ background: 'var(--cf-card)', color: 'var(--cf-ink)', border: 0, borderRadius: 10, padding: '6px 12px', cursor: 'pointer' }}>
        {volviendo ? 'Volviendo…' : 'Volver a mi cuenta'}
      </button>
      {error && <span className="w-full text-[12px]">{error}</span>}
    </div>
  )
}
```

En `app/(dashboard)/layout.jsx`: `import FranjaVerComo from '@/components/armazon/FranjaVerComo'` y `<FranjaVerComo />` justo antes de `<AvisoSinSenal />` (~línea 136). En pantalla, comprobar que queda por encima del contenido y por debajo de las hojas (`HojaInferior`). Si no, ajustar `zIndex` a la escala que ya usa el armazón, mirando qué valor lleva `AvisoSinSenal`.

- [ ] **Paso 9: `components/providers/SesionTracker.jsx`**

Imports: `import { marcarSoloLectura, estaEnSoloLectura } from '@/lib/modo-vista'` y `import { olvidarLecturasDeOtraCuenta } from '@/lib/cambio-de-cuenta'`.

- En el efecto que ya existe, después de `if (session.user.rol === 'superadmin') return`, añadir `if (session.user.soloLectura) return` y sumar `session?.user?.soloLectura` a sus dependencias.
- Añadir un segundo efecto:

```js
  // La marca de solo lectura del teléfono sigue a la sesión. Si la vista se
  // cerró sin pasar por la franja (sesión nueva, otra pestaña), se apaga aquí
  // y se tiran las lecturas que quedaron del cobrador.
  useEffect(() => {
    if (status !== 'authenticated') return
    const enVista = !!session?.user?.soloLectura
    if (enVista !== estaEnSoloLectura()) {
      marcarSoloLectura(enVista)
      if (!enVista) olvidarLecturasDeOtraCuenta()
    }
  }, [status, session?.user?.soloLectura])
```

- [ ] **Paso 10: ejecutar las pruebas y el lint**

Ejecutar: `npx vitest run lib/__tests__/ver-como-sin-rastro.test.js lib/__tests__/ver-como.test.js`
Esperado: PASAN. `npx vitest run` completo, porque `lib/offline.js` y `SesionTracker` los tocan muchas pantallas, y `npx eslint components "app/(dashboard)/layout.jsx" lib/offline.js lib/modo-vista.js lib/cambio-de-cuenta.js lib/push-cliente.js` sin errores nuevos.

- [ ] **Paso 11: commit**

```bash
git add lib/modo-vista.js lib/cambio-de-cuenta.js lib/offline.js lib/push-cliente.js components/cobradores/BotonVerComo.jsx components/armazon/FranjaVerComo.jsx components/providers/SesionTracker.jsx "app/(dashboard)/layout.jsx" "app/(dashboard)/cobradores/[id]/page.jsx" lib/__tests__/ver-como-sin-rastro.test.js
git commit -m "El botón «Ver como», la franja para volver, y la vista sin rastro en el cobrador

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Tarea 10: comprobar en el espejo, desplegar y dejar memoria

**Ficheros:**
- Crear: `.auditoria/_cuentas-guardadas-espejo.mjs`, `.auditoria/_ver-como-espejo.mjs`
- Modificar: `public/sw.js` (`CACHE_NAME` +1, mirando antes `git log` por si otra sesión ya lo subió)

**Interfaces:**
- Consume: todo lo anterior.
- Produce: nada.

- [ ] **Paso 1: la suite, el build y el lint**

```bash
npx vitest run
npx next build
npx eslint app components
```

Esperado:
- todas las pruebas pasan;
- el build, «✓ Compiled successfully»;
- el lint, 53 problemas y 9 errores (la línea base), sin ninguno nuevo.

- [ ] **Paso 2: espejo, cuentas guardadas (Playwright, 412px)**

Arrancar: `bash .auditoria/arrancar-espejo.sh`. El guion `.auditoria/_cuentas-guardadas-espejo.mjs` (ignorado por git, como el resto de `.auditoria/`) trabaja solo con la cuenta de prueba.

Para poder escribir una contraseña conocida, al empezar:
- guarda por SQL, en el espejo, el `password` (hash) actual del cobrador `cmns7uq37000tr7skx1pksedh` y del dueño `cmm7iigz600031t2rqrfksymp`;
- les pone el hash de una clave de prueba (`bcrypt.hash(clave, 10)`);
- en un `finally`, devuelve los dos hashes originales y borra sus filas de `CuentaGuardada`.

No usa `PATCH /api/cobradores/[id]`: cambiar la clave por ahí cortaría las cuentas guardadas en mitad de la prueba.

En un contexto de navegador con `localStorage` limpio, contra `http://localhost:3016/login`:
1. entra como el **cobrador de prueba** con la casilla marcada;
2. cierra la sesión, vuelve a `/login` y comprueba que sale la tarjeta con su nombre;
3. toca la tarjeta y comprueba que llega a `/dashboard` sin escribir nada;
4. cierra la sesión y entra con clave como el **dueño de prueba**, con la casilla marcada. Comprueba que pide el PIN, pone `0427`, que pide confirmarlo, pone `0427` y llega al panel;
5. en `/login` hay dos tarjetas. Toca la del dueño y pone `1111` cuatro veces: ve «Te quedan…» y la última vez «Te queda 1 intento». A la quinta, la tarjeta desaparece con el mensaje de `PIN_AGOTADO`;
6. con la sesión del dueño, en la ficha del cobrador, sección «Teléfonos con su cuenta guardada», toca «Quitar». Luego, en `/login`, al tocar la tarjeta del cobrador sale `CUENTA_NO_VALE` y la tarjeta se va;
7. repite los pasos 1 a 3 con `localStorage` bloqueado (`addInitScript` que hace lanzar a `localStorage.setItem`): se entra con el formulario de siempre, sin tarjetas y sin errores;
8. capturas en `informes/` de cada pantalla, a 412px y a 1366px.

Esperado: los 8 pasos se cumplen y la página no da errores (`pageerror`).

- [ ] **Paso 3: espejo, «ver como»**

El guion `.auditoria/_ver-como-espejo.mjs`, con un JWT de prueba del dueño (en el espejo sí se permite, con el secreto del espejo, como en `_importar-pantalla.mjs`):
1. abre `/cobradores/cmns7uq37000tr7skx1pksedh` y toca «Ver como…»;
2. comprueba que sale la franja «Viendo como … · solo lectura» y que la pantalla es la del cobrador (su Inicio, su ruta);
3. desde la página: `fetch('/api/caja')` da 200 y `fetch('/api/prestamos/<uno de su ruta>/pagos', { method: 'POST', … })` da 403 con el mensaje de solo lectura. Por SQL, ningún `Pago` nuevo;
4. por SQL: `SesionActiva.lastActivityAt` y `User.lastLoginAt` del cobrador **no cambiaron**, y en `ActividadLog` hay una fila `ver_como_cobrador`;
5. toca «Volver a mi cuenta»: llega a la ficha del cobrador como dueño, sin franja, y `localStorage['cf-solo-lectura']` ya no está;
6. **la vuelta sola a la hora**, sin esperar una hora: pone una cookie de prueba ya en vista (`id` del cobrador, `rol: 'cobrador'`, `vistaDe: { id: dueño, nombre }`, `soloLectura: true`, `vistaHasta: Date.now() - 1000`) y abre `/dashboard`. En unos segundos tiene que acabar en `/cobradores/cmns7uq37000tr7skx1pksedh` como dueño y sin franja;
7. la misma cookie, pero con `vistaDe.id` inexistente: la franja se queda y la página **no** entra en un bucle de recargas (contar las navegaciones en 10 s: una);
8. capturas a 412px y en PC.

Esperado: todo se cumple.

- [ ] **Paso 4: la versión del SW y el commit**

```bash
git log --oneline -3 -- public/sw.js   # ¿otra sesión ya la subió?
# subir CACHE_NAME en 1 sobre el que haya
git add public/sw.js
git commit -m "cf-vNNNN: cuentas guardadas y «ver como»

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Paso 5: producción: la tabla ANTES del código**

Se despliega por tandas: pedirle al dueño el visto bueno para esta tanda antes de este paso. Es la única escritura en producción del plan: crea una tabla vacía y no toca datos, así que no hace falta respaldo.

`.auditoria/_prod.sh` es de solo lectura y rechaza este SQL, porque lleva `ON DELETE`/`ON UPDATE`. Por eso se usa el mismo fichero de credenciales que ese guion deja en el VPS:

```bash
echo "SELECT 1" | bash .auditoria/_prod.sh          # deja /tmp/_cf.cnf en el VPS
echo "SHOW TABLES LIKE 'CuentaGuardada'" | bash .auditoria/_prod.sh   # tiene que salir vacío
ssh -o BatchMode=yes root@69.62.87.141 "mysql --defaults-file=/tmp/_cf.cnf prestamos_db" < .auditoria/_create-cuentaguardada.sql
echo "SHOW CREATE TABLE CuentaGuardada" | bash .auditoria/_prod.sh --raw
echo "SELECT COUNT(*) FROM CuentaGuardada" | bash .auditoria/_prod.sh
```

Esperado:
- la tabla existe, con `CuentaGuardada_tokenHash_key`, `CuentaGuardada_userId_idx` y `CuentaGuardada_userId_fkey … ON DELETE CASCADE`;
- el `COUNT(*)` da 0.

- [ ] **Paso 6: desplegar y verificar**

```bash
git fetch -q origin main && git log --oneline HEAD..origin/main   # nada que traer, o rebasar
git push origin HEAD:main
ssh -o BatchMode=yes root@69.62.87.141 "nohup bash /home/deploy-sistema.sh > /tmp/deploy.log 2>&1 &"
# esperar COMPLETADO, y:
ssh -o BatchMode=yes root@69.62.87.141 "cd /home/control-finanzas && git log --oneline -1; curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3002/login; pm2 jlist | python3 -c 'import sys,json;[print(p[\"name\"],p[\"pm2_env\"][\"status\"]) for p in json.load(sys.stdin) if p[\"name\"]==\"cf\"]'"
```

Esperado: el commit nuevo, `200` y dos `cf online`. Revisar los logs de error de `cf` tras el reinicio, sin «Unknown field» ni errores de NextAuth.

- [ ] **Paso 7: memoria**

Nuevo `~/.claude/projects/-home-keyce-Desktop-Control-Finanzas/memory/cuentas_guardadas_y_ver_como.md`, escrito con Write/Edit:
- la casilla muerta;
- el diseño;
- las 4 vías que cortan las llaves;
- el portero de solo lectura y sus excepciones;
- que al cambiar de identidad NO se llama a `limpiarDatosOffline`.

Y una línea en `MEMORY.md`, en «Rutas, cobros y pantallas».
