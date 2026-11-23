# La carga de cartera la revisa y la carga el dueño — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dueño vea en `/cargar-cartera` lo que el sistema leyó de sus archivos (qué sirve, qué no, por qué y de qué archivo), lo complete en la revisión de «Pasar el cuaderno» y lo cargue él con el tipo de interés real de cada préstamo; Carlos solo entra si el dueño pide ayuda.

**Architecture:** La lectura y validación de `lib/carga-asesor/` no cambian. Las filas de la solicitud (formato del importador) se pasan con una función pura al formato de `components/migrador/LoteFotos.jsx`, que las revisa y crea por `/api/clientes` + `/api/prestamos` (todos los modos de interés). Cada fila creada se apunta en el servidor al momento (`POST /api/carga-asesor/cargada`), y lo de después de cargar (prueba, campana, WhatsApp, actividad) sale de una sola función compartida con la aprobación del panel.

**Tech Stack:** Next.js 15 App Router, JavaScript/JSX (sin TypeScript), Prisma 7 + MariaDB, NextAuth v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-22-carga-revisada-por-el-dueno-design.md`

## Global Constraints

- No hay TypeScript: una función o import inexistente pasa el build y revienta en producción. Después de cada tarea, `npx next build` además de las pruebas.
- Verificar con `npx vitest run` · `npx next build` · `npx eslint app components lib`.
- Las pruebas que miran código fuente se anclan en código, no en comentarios (los comentarios citan a clientes): quitar comentarios antes de buscar (`sinNotas`, ver `lib/__tests__/` de migrador) o anclar en JSX/expresiones.
- Solo el dueño (`session.user.rol === 'owner'`) ve y toca SU solicitud: todo filtra por `session.user.organizationId`.
- Nada de emojis en la interfaz (SVG estilo heroicons). `DESIGN.md` manda: tokens de color, radios 8/10/12/16/20, `Toggle`/`Checkbox` canónicos, `color-mix`, escalas cerradas. Teléfono = fichas.
- Nunca recortar nombre, cédula, teléfono ni dirección (bajan de renglón).
- No tocar la barra de navegación (la pill).
- Subir `CACHE_NAME` en `public/sw.js` en el release.
- Producción solo se LEE; el piloto corre en el espejo (`.auditoria/arrancar-espejo.sh`, 3016), que no habla con nadie de fuera.
- `lib/fetch-timeout.js` ya da 180 s a `/api/carga-asesor*`: las rutas nuevas van bajo ese prefijo.
- Lo de toda la carga en el modo solicitud arranca de «Cómo prestas por defecto» del negocio (`frecuenciaDefault`, `tasaDefault`, `modoInteresDefault`); si el negocio no lo tiene, vacío — nunca se supone «diario» ni «20 %» (call de Claude, sigue al diseño).

## Review Focus

1. **El dueño sigue en otro teléfono o borró el caché a mitad de cargar** → las filas ya creadas NO vuelven a salir (el servidor las sabe por `_id`). Prueba en Tarea 2 (`filasPendientes` excluye `creadas`) y Tarea 3 (GET).
2. **Pide ayuda después de haber cargado parte** → la aprobación de Carlos no vuelve a crear esas filas. Prueba en Tarea 2 (`aprobarSolicitud` salta `creadas`).
3. **Llega otra foto por WhatsApp mientras revisa** → las filas nuevas se suman a su revisión sin borrar lo que ya corrigió. Prueba en Tarea 1 (`unirFilasDelLote`) y Tarea 2 (`_id` estable al releer).
4. **Un Excel del que no salió ninguna fila** → se dice con su nombre y la plantilla; no se pinta una revisión vacía. Prueba en Tarea 1 (`problemasPorArchivo`) y Tarea 5.
5. **Más clientes de los que deja el plan** → el veredicto lo dice antes del botón. Prueba en Tarea 3 (GET devuelve `espacio`) y Tarea 5.

---

### Task 1: Piezas puras — de fila de solicitud a fila del lote

**Files:**
- Create: `lib/carga-asesor/al-lote.js`
- Test: `lib/__tests__/carga-al-lote.test.js`

**Interfaces:**
- Consumes: filas guardadas en `SolicitudCarga.filas` (campos de `CAMPOS_FILA` en `lib/carga-asesor/filas.js` + marcas `_id`, `_archivo`, `_hoja`, `_dudas` (strings), `_errores`, `_avisos`); `archivos` de `archivosDe(sol)` (`{ n, nombre, tipo, filas, fallos }`).
- Produces:
  - `filaParaLote(fila) → filaLote` con `{ _id, nombre, cedula, telefono, direccion, monto, tasa, frecuencia, plazoUnidades, fechaInicio, yaAbonado, cuotaLeida, saldoPendiente, diaCobro: '', _dudas: [{campo, texto}], _avisos: string[], _archivo, _hoja, _repetidaDe: string|null, _ia: null }`.
  - `filasParaLote(filas) → filaLote[]`.
  - `baseDesdeNegocio(org) → { tasa: string, frecuencia: string, modoInteres: string, rutaId: '' }`.
  - `problemasPorArchivo(archivos) → [{ n, nombre, tipo, sinFilas: boolean, motivos: string[] }]` (solo los archivos con algo que decir).
  - `unirFilasDelLote(locales, delServidor, creadas) → filaLote[]`: las locales tal cual + las del servidor cuyo `_id` no está en locales ni en `creadas`.
  - `MOTIVO_CLARO`: mapa de los mensajes del importador a palabras claras.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
import { describe, it, expect } from 'vitest'
import { filaParaLote, baseDesdeNegocio, problemasPorArchivo, unirFilasDelLote } from '@/lib/carga-asesor/al-lote'

describe('filaParaLote', () => {
  it('pasa monto, tasa, cuotas y abonado al formato del lote', () => {
    const f = filaParaLote({ _id: 'a1-0', _archivo: 1, nombre: 'Ana', montoPrestado: 500000, tasaInteres: 20, numeroCuotas: 24, frecuencia: 'diario', abonadoHasta: 100000, valorCuota: 25000 })
    expect(f).toMatchObject({ _id: 'a1-0', _archivo: 1, nombre: 'Ana', monto: 500000, tasa: 20, plazoUnidades: '24', frecuencia: 'diario', yaAbonado: 100000, cuotaLeida: 25000 })
  })
  it('sin cuotas pero con días y frecuencia, saca los cobros', () => {
    expect(filaParaLote({ montoPrestado: 1, diasPlazo: 56, frecuencia: 'semanal' }).plazoUnidades).toBe('8')
  })
  it('las dudas de texto pasan a { campo, texto }', () => {
    expect(filaParaLote({ _dudas: ['Monto muy bajo (900): ¿faltan ceros?'] })._dudas).toEqual([{ campo: 'monto', texto: 'Monto muy bajo (900): ¿faltan ceros?' }])
  })
  it('«Repetida con la fila 3» queda en _repetidaDe y sale de las dudas', () => {
    const f = filaParaLote({ _dudas: ['Repetida con la fila 3'] })
    expect(f._repetidaDe).toBe('3')
    expect(f._dudas).toEqual([])
  })
  it('debe un saldo pero no dice lo abonado: se pregunta, no se inventa', () => {
    const f = filaParaLote({ montoPrestado: 300000, saldoActual: 120000 })
    expect(f.yaAbonado).toBe('')
    expect(f._dudas).toContainEqual({ campo: 'yaAbonado', texto: 'Dice que debe $120.000: ¿cuánto te ha abonado?' })
  })
  it('vacío es vacío, no cero', () => {
    const f = filaParaLote({ nombre: 'X', montoPrestado: '', tasaInteres: '' })
    expect(f.monto).toBe(''); expect(f.tasa).toBe('')
  })
})

describe('baseDesdeNegocio', () => {
  it('usa «Cómo prestas por defecto»', () => {
    expect(baseDesdeNegocio({ tasaDefault: 15, frecuenciaDefault: 'semanal', modoInteresDefault: 'unico' })).toEqual({ tasa: '15', frecuencia: 'semanal', modoInteres: 'unico', rutaId: '' })
  })
  it('sin nada guardado: vacío, ni diario ni 20', () => {
    expect(baseDesdeNegocio({})).toEqual({ tasa: '', frecuencia: '', modoInteres: 'fijo', rutaId: '' })
  })
})

describe('problemasPorArchivo', () => {
  it('un Excel sin ninguna fila sale como sinFilas con su nombre', () => {
    const r = problemasPorArchivo([{ n: 1, nombre: 'clientes.xlsx', tipo: 'excel', filas: 0, fallos: ['Fila 2: sin nombre'] }])
    expect(r).toEqual([{ n: 1, nombre: 'clientes.xlsx', tipo: 'excel', sinFilas: true, motivos: ['Fila 2: sin nombre'] }])
  })
  it('un archivo que dio filas y trae avisos no es sinFilas', () => {
    expect(problemasPorArchivo([{ n: 2, nombre: 'f.jpg', tipo: 'imagen', filas: 12, fallos: ['El total no cuadra'] }])[0].sinFilas).toBe(false)
  })
  it('sin nada que decir no sale', () => {
    expect(problemasPorArchivo([{ n: 1, nombre: 'f.jpg', tipo: 'imagen', filas: 3, fallos: [] }])).toEqual([])
  })
})

describe('unirFilasDelLote', () => {
  it('suma las nuevas del servidor sin pisar lo corregido ni traer las creadas', () => {
    const locales = [{ _id: 'a', nombre: 'Ana corregida' }]
    const servidor = [{ _id: 'a', nombre: 'Ana' }, { _id: 'b', nombre: 'Beto' }, { _id: 'c', nombre: 'Caro' }]
    expect(unirFilasDelLote(locales, servidor, ['c']).map((f) => f.nombre)).toEqual(['Ana corregida', 'Beto'])
  })
})
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run lib/__tests__/carga-al-lote.test.js`
Expected: FAIL (`Cannot find module '@/lib/carga-asesor/al-lote'`).

- [ ] **Step 3: Implementar `lib/carga-asesor/al-lote.js`**

Sin red ni base. `plazoUnidades` como en `LoteFotos` (cuotas tal cual; si no, `round(diasPlazo / DIAS_POR_PERIODO[frecuencia])`, mínimo 1; si no, `''`). El campo de cada duda se adivina por la palabra («Monto» → `monto`, «tasa» → `tasa`, «abon» → `yaAbonado`, «fecha» → `fechaInicio`; si no, `''`). El texto del saldo usa `formatMoney` de `@/lib/i18n` con `'co'` y debe dar exactamente `Dice que debe $120.000: ¿cuánto te ha abonado?`. `MOTIVO_CLARO` traduce al menos:
`'Tasa de interés es requerida y no puede ser negativa' → 'Falta la tasa'`,
`'Plazo en días (o número de cuotas) debe ser mayor a 0' → 'Falta el plazo o el número de cuotas'`,
`'Fecha de inicio no válida. Usa DD/MM/YYYY o YYYY-MM-DD' → 'Falta la fecha en que empezó el préstamo'`,
`'Monto debe ser mayor a 0' → 'Falta el monto prestado'`.

- [ ] **Step 4: Correr y ver que pasan**

Run: `npx vitest run lib/__tests__/carga-al-lote.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/carga-asesor/al-lote.js lib/__tests__/carga-al-lote.test.js
git commit -m "carga del dueño: de la fila de la solicitud a la fila del lote"
```

---

### Task 2: La vida de la solicitud — ids, ayuda, filas creadas y lo de después

**Files:**
- Modify: `lib/carga-asesor/solicitud.js` (constantes 37-41, `procesarSolicitud` 181-235, `avisarNueva` 237-251, `confirmarRecibida` 254-266, `guardarFilas` 268-279, `aprobarSolicitud` 285-357, `vueltaDeCargas` ~374-420)
- Modify: `lib/seguimiento/para-atender.js:78` (estados)
- Modify: `lib/carga-asesor/whatsapp.js:55` (texto del bot)
- Test: `lib/__tests__/carga-solicitud-dueno.test.js`

**Interfaces:**
- Consumes: `notificar`, `enviarPaso`, `reiniciarPrueba`, `sendMessage` (ya importados).
- Produces:
  - `ESTADOS_ABIERTOS = ['esperando', 'recibida', 'leyendo', 'en_revision', 'ayuda']`; `ESTADOS_POR_ATENDER = ['ayuda']`; `ESTADOS_EDITABLES = ['en_revision', 'ayuda']`.
  - `creadasDe(sol) → { [filaId]: { clienteId, prestamoId } }` (leído de `resumen.creadas`).
  - `filasPendientes(sol) → fila[]`: `filasDe(sol)` sin las de `creadasDe`.
  - `apuntarCreada({ id, organizationId, filaId, clienteId, prestamoId }) → { ok, yaEstaba?, quedan }`: con `conCandado`; comprueba que el préstamo es de esa organización; idempotente por `filaId`.
  - `terminarCarga({ id, organizationId, ahora }) → { ok, yaTerminada? }`: `en_revision` → `aprobada` cuando `filasPendientes` está vacío (o el dueño quitó el resto: `quitadas` en el body de Tarea 3), calcula clientes, préstamos y en la calle de los préstamos de `creadas`, y llama a `despuesDeCargar`.
  - `despuesDeCargar({ sol, dueno, clientes, prestamos, enLaCalle, ahora })`: lo que hoy hace `aprobarSolicitud` tras importar (actividadLog `carga_masiva`, `reiniciarPrueba`, `notificar` «Tu cartera quedó cargada», `enviarPaso` `cartera_cargada_v3` con `claveCaso: carga:${id}`). `aprobarSolicitud` pasa a usarla.
  - `pedirAyuda({ id, organizationId, nota }) → { ok }`: `en_revision` → `ayuda`, Telegram de escalamiento con el enlace `/admin/cargas/${id}` y la nota.
  - `devolverAlDueno({ id, adminId }) → { ok }`: `ayuda` → `en_revision`.
  - `avisarListaParaRevisar(sol)`: reemplaza la llamada a `avisarNueva` al terminar la lectura: campana (`notificar`, tipo `carga`, `href: '/cargar-cartera'`) y, solo si `process.env.WA_PLANTILLA_CARTERA_POR_REVISAR` existe, `enviarPaso` con esa plantilla y `datos: { nombre, listos, revisar }`.

- [ ] **Step 1: Escribir las pruebas que fallan** (prisma, telegram, notificar, enviarPaso y prueba mockeados, como `lib/__tests__/activar-sin-adicionales.test.js`)

```js
it('procesarSolicitud da _id estable a cada fila y no lo cambia al releer', ...)          // f._id === `${f._archivo}-${i}` la primera vez; segunda vuelta conserva
it('filasPendientes no devuelve las ya creadas', ...)                                      // resumen.creadas = { 'a-0': {...} }
it('apuntarCreada rechaza un préstamo de otra organización', ...)                         // prisma.prestamo.findFirst → null ⇒ { error, status: 404 }
it('apuntarCreada dos veces con el mismo filaId no duplica', ...)                         // segunda ⇒ { ok: true, yaEstaba: true }
it('terminarCarga hace lo de después UNA vez', ...)                                       // dos llamadas ⇒ enviarPaso 1 vez, reiniciarPrueba 1 vez
it('⚠ aprobarSolicitud (Carlos) salta las filas que el dueño ya creó', ...)               // importarCartera recibe solo las no creadas
it('al terminar la lectura avisa al DUEÑO y no a Carlos', ...)                            // notificar llamado; sendMessage NO
it('sin WA_PLANTILLA_CARTERA_POR_REVISAR no manda WhatsApp', ...)
it('pedirAyuda pasa a «ayuda» y avisa a Carlos; devolverAlDueno vuelve a en_revision', ...)
it('el recordatorio de 20 h solo cuenta las de «ayuda»', ...)
it('confirmarRecibida ya no promete 24 horas', () => {                                     // anclado en el texto que se manda, sin comentarios
  expect(sinNotas(src)).not.toMatch(/máximo 24 horas/)
})
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run lib/__tests__/carga-solicitud-dueno.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar en `lib/carga-asesor/solicitud.js`**

- `_id` se pone en `procesarSolicitud` antes de `marcarDudas`, solo a las filas que no lo traen: `${f._archivo}-${posición dentro de su archivo}`.
- `guardarFilas` pasa por `conCandado` y acepta `ESTADOS_EDITABLES`.
- `aprobarSolicitud` toma de `en_revision` o `ayuda`, importa `filasPendientes(sol)` y termina con `despuesDeCargar`.
- `confirmarRecibida`: campana «Recibimos tus archivos» / «Los estamos leyendo. En unos minutos te enseñamos lo que encontramos para que lo revises y lo cargues.»; el WhatsApp `cartera_recibida` se manda solo si `process.env.WA_PLANTILLA_CARTERA_RECIBIDA` existe (con ese nombre de plantilla).
- `whatsapp.js:55`: `'Recibido. Lo estamos leyendo y en unos minutos le dejamos en la app lo que encontramos, para que lo revise y lo cargue.'`
- `para-atender.js:78`: `estado: { in: ['recibida', 'en_revision', 'esperando', 'ayuda'] }`.

- [ ] **Step 4: Correr y ver que pasan; correr toda la suite**

Run: `npx vitest run lib/__tests__/carga-solicitud-dueno.test.js && npx vitest run`
Expected: PASS (las pruebas viejas de carga-asesor que esperaban el Telegram al leer se actualizan a la regla nueva, citando este plan).

- [ ] **Step 5: Commit**

```bash
git add lib/carga-asesor/solicitud.js lib/carga-asesor/whatsapp.js lib/seguimiento/para-atender.js lib/__tests__/
git commit -m "carga del dueño: filas con id, ayuda, filas creadas y una sola salida para lo de después"
```

---

### Task 3: La API del dueño

**Files:**
- Modify: `app/api/carga-asesor/route.js` (`vista`, `GET`)
- Create: `app/api/carga-asesor/archivo/[n]/route.js`
- Create: `app/api/carga-asesor/cargada/route.js`
- Create: `app/api/carga-asesor/ayuda/route.js`
- Test: `lib/__tests__/carga-asesor-api-dueno.test.js`

**Interfaces:**
- Consumes: Tarea 1 (`filasParaLote`, `baseDesdeNegocio`, `problemasPorArchivo`), Tarea 2 (`filasPendientes`, `creadasDe`, `apuntarCreada`, `terminarCarga`, `pedirAyuda`, `ESTADOS_EDITABLES`), `validarCartera`.
- Produces:
  - `GET /api/carga-asesor` → además de lo de hoy, con estado en `ESTADOS_EDITABLES`: `{ revision: { filas: filaLote[], base, problemas, creadas: string[], espacio: number|null, excedePlan: boolean, errorLectura: string|null } }`. `espacio` sale de `validarCartera(...).resumen.espacioDisponible` sobre `filasPendientes`. Con `ayuda`, `revision.bloqueada = true`.
  - `GET /api/carga-asesor/archivo/[n]` → el original (mismas cabeceras que la ruta de admin), solo si la solicitud es de `session.user.organizationId` y el usuario es dueño.
  - `POST /api/carga-asesor/cargada` body `{ solicitudId, filaId, clienteId, prestamoId }` → `apuntarCreada`; body `{ solicitudId, terminar: true, quitadas: string[] }` → `terminarCarga`. 409 si la solicitud está en `ayuda`.
  - `POST /api/carga-asesor/ayuda` body `{ solicitudId, nota? }` → `pedirAyuda`.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
it('el GET solo devuelve la revisión de la organización de la sesión', ...)   // where: { organizationId: session.user.organizationId }
it('el GET no trae las filas ya creadas', ...)                                 // Review Focus 1
it('el GET dice cuánto espacio deja el plan', ...)                              // Review Focus 5: revision.espacio === 3, excedePlan true
it('archivo/[n] da 403 a un cobrador y 404 a otra organización', ...)
it('cargada con un préstamo de otro negocio ⇒ 404', ...)
it('cargada en «ayuda» ⇒ 409', ...)
it('las cuatro rutas exigen rol owner', () => {                                // anclado en código
  for (const f of RUTAS) expect(sinNotas(read(f))).toMatch(/rol !== 'owner'/)
})
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run lib/__tests__/carga-asesor-api-dueno.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar las rutas** reutilizando `sesionDueno()` de `route.js` (moverla a `lib/carga-asesor/sesion-dueno.js` si hace falta compartirla). `vista` sigue devolviendo `cargado` como hoy.

- [ ] **Step 4: Correr y ver que pasan; build**

Run: `npx vitest run lib/__tests__/carga-asesor-api-dueno.test.js && npx next build`
Expected: PASS y build sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/api/carga-asesor lib/carga-asesor lib/__tests__/carga-asesor-api-dueno.test.js
git commit -m "carga del dueño: la API que le enseña lo leído y apunta lo que carga"
```

---

### Task 4: `LoteFotos` en modo solicitud

**Files:**
- Modify: `components/migrador/LoteFotos.jsx` (`efectivo` 92, `estadoDe` 137, firma 165, estado `filas`/`base` 177-187, caché 195-215, `crear` 350-492, `Fila` 785)
- Test: `lib/__tests__/lote-fotos-solicitud.test.js`

**Interfaces:**
- Consumes: Tarea 1 (`filaLote`, `unirFilasDelLote`), Tarea 3 (`POST /api/carga-asesor/cargada`).
- Produces (props nuevas, todas opcionales; sin ellas el componente se comporta EXACTAMENTE como hoy en `/migrador` y en `OnboardingWizard`):
  - `filasIniciales?: filaLote[]`, `creadas?: string[]`, `baseInicial?: object`.
  - `claveLote?: string` (en modo solicitud: `carga:${solicitudId}`).
  - `enlaceArchivo?: (n) => string` → la fila pinta «foto N» / «Excel, hoja H» con enlace que abre el original en otra pestaña.
  - `onCreada?: (fila, { clienteId, prestamoId }) => Promise<void>`: se llama tras crear CADA préstamo, antes de sacar la fila del lote.
  - `sinSubir?: boolean`: oculta los botones de galería y cámara.
  - Exporta `efectivo` y `estadoDe` como nombrados para las pruebas.

- [ ] **Step 1: Escribir las pruebas que fallan**

```js
import { estadoDe } from '@/components/migrador/LoteFotos'
const base = { tasa: '20', frecuencia: 'diario', modoInteres: 'fijo', rutaId: '' }
const ok = { nombre: 'Ana', monto: 500000, frecuencia: 'diario', plazoUnidades: '24', _dudas: [] }
it('repetida sin resolver es roja', () => expect(estadoDe({ ...ok, _repetidaDe: '3' }, base)).toBe('rojo'))
it('repetida marcada «no es la misma» vuelve a su estado', () => expect(estadoDe({ ...ok, _repetidaDe: '3', noEsLaMisma: true }, base)).toBe('verde'))
it('sin frecuencia en la fila ni arriba es roja', () => expect(estadoDe({ ...ok, frecuencia: '' }, { ...base, frecuencia: '' })).toBe('rojo'))
it('sin tasa en la fila ni arriba es roja', () => expect(estadoDe(ok, { ...base, tasa: '' })).toBe('rojo'))
it('el migrador de siempre no cambia: base con valores, fila sin frecuencia ⇒ ámbar', () => expect(estadoDe({ ...ok, frecuencia: '' }, base)).toBe('ambar'))
it('onCreada va antes de sacar la fila del lote', () => {                     // anclado en código de `crear`
  const c = sinNotas(src); expect(c.indexOf('onCreada')).toBeLessThan(c.indexOf("prev.filter((x) => x._id !== f._id)"))
})
it('con filasIniciales nuevas se unen con unirFilasDelLote', () => expect(sinNotas(src)).toMatch(/unirFilasDelLote\(/))
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run lib/__tests__/lote-fotos-solicitud.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

- `estadoDe`: rojo si `e.frecuencia` vacío, si `e.tasa` es null, o si `f._repetidaDe && !f.noEsLaMisma`. La fila repetida enseña «Parece la misma que la fila N» con dos botones: «Quitar» y «No es la misma».
- Con `filasIniciales`: el lote arranca de la caché `claveLote` si existe y se une con `unirFilasDelLote(locales, filasIniciales, creadas)`; si no hay caché, `filasIniciales` sin las `creadas`. `baseInicial` solo si la caché no trae `base`.
- `onCreada` se espera (`await`) antes de `setFilas(prev.filter…)`; si falla, la fila queda con `_error` «Se guardó pero no se pudo apuntar: toca Crear otra vez» y `_clienteId`/`_prestamoId` puestos para no recrear nada.

- [ ] **Step 4: Correr y ver que pasan, y que el migrador sigue igual**

Run: `npx vitest run lib/__tests__/lote-fotos-solicitud.test.js && npx vitest run lib/__tests__ -t "migrador|lote" && npx next build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/migrador/LoteFotos.jsx lib/__tests__/lote-fotos-solicitud.test.js
git commit -m "LoteFotos revisa también lo que leyó una solicitud de carga"
```

---

### Task 5: La pantalla del dueño en `/cargar-cartera`

**Files:**
- Modify: `app/(dashboard)/cargar-cartera/page.jsx` (`ABIERTA` 25, títulos 43, vistas 105-223)
- Create: `components/carga/RevisionDeLaCarga.jsx`
- Modify: `components/pantallas/TraerCartera.jsx:307`, `components/**/CarteraVacia.jsx:86` (texto sin «asesor en 24 horas»)
- Modify: `public/sw.js` (`CACHE_NAME`)
- Test: `lib/__tests__/cargar-cartera-revision.test.js`

**Interfaces:**
- Consumes: Tarea 3 (`GET /api/carga-asesor` → `revision`, rutas `archivo`, `cargada`, `ayuda`), Tarea 4 (props de `LoteFotos`), `PreguntaPlataDeHoy` (`components/cf/PreguntaPlataDeHoy`), `invalidarCachePorPrefijo('clientes:')`.
- Produces: `RevisionDeLaCarga({ solicitud, revision, rutas, onCambio })`.

- [ ] **Step 1: Escribir las pruebas que fallan** (anclas en JSX y expresiones)

```js
it('mientras lee se refresca sola', ...)                 // setInterval/setTimeout que vuelve a llamar a cargar() con estado recibida|leyendo
it('el veredicto pinta leídos, listos y por revisar', ...) // >{leidos} clientes leídos<, listos y «necesitan algo»
it('un archivo sin filas lo dice y enlaza la plantilla', ...) // '/api/carga-masiva/plantilla' en JSX con problemas.sinFilas
it('con cero filas no se monta LoteFotos', ...)            // condición revision.filas.length > 0 antes de <LoteFotos
it('excede el plan: lo dice antes del botón', ...)        // revision.excedePlan con revision.espacio en JSX
it('«Necesito ayuda» llama a /api/carga-asesor/ayuda', ...)
it('al terminar: PreguntaPlataDeHoy e invalidar clientes', ...)
it('sin emojis', ...)                                      // ningún carácter emoji en los .jsx tocados
it('ya no promete un asesor en 24 horas', ...)            // TraerCartera, CarteraVacia y la página
```

- [ ] **Step 2: Correr y ver que fallan**

Run: `npx vitest run lib/__tests__/cargar-cartera-revision.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar**

Vistas por estado: `esperando`/sin solicitud → subir (lo de hoy, texto nuevo: «Sube las fotos del cuaderno, el Excel o el PDF. Lo leemos en unos minutos y te enseñamos lo que encontramos para que lo revises y lo cargues»); `recibida`/`leyendo` → «Estamos leyendo tus N archivos» con refresco cada 5 s; `en_revision` → `RevisionDeLaCarga` (veredicto con cifras de `LoteFotos`, problemas por archivo, `LoteFotos` con `sinSubir`, `filasIniciales`, `creadas`, `baseInicial`, `claveLote`, `enlaceArchivo`, `onCreada` → `POST cargada`, y al quedarse sin filas → `POST cargada { terminar: true, quitadas }`), botón «Necesito ayuda» con nota opcional; `ayuda` → «Carlos la está revisando. Te avisamos cuando esté»; `aprobada` → lo de hoy + `PreguntaPlataDeHoy`. Subir `CACHE_NAME`.

- [ ] **Step 4: Correr, build y ver la pantalla**

Run: `npx vitest run lib/__tests__/cargar-cartera-revision.test.js && npx next build`
Expected: PASS. Luego, en el espejo, captura a 412 px y en escritorio de los estados leyendo, en_revision (con errores, todo bien y cero filas), ayuda y aprobada; comprobar con `elementFromPoint` que «Cargar» y «Necesito ayuda» no están tapados.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/cargar-cartera/page.jsx" components/carga components/pantallas/TraerCartera.jsx public/sw.js lib/__tests__/cargar-cartera-revision.test.js
git commit -m "Cargar mi cartera: el dueño ve lo leído, lo completa y lo carga"
```

---

### Task 6: El panel de Carlos

**Files:**
- Modify: `app/api/admin/cargas/[id]/route.js` (POST: `accion: 'devolver'`)
- Modify: `app/admin/cargas/[id]/page.jsx` (`abierta` 121, botón «Devolver al dueño», aviso de modo, filas creadas)
- Modify: `app/admin/cargas/page.jsx:20`, `app/admin/inicio/page.jsx:33` (estado `ayuda`)
- Test: `lib/__tests__/admin-cargas-ayuda.test.js`

**Interfaces:**
- Consumes: Tarea 2 (`devolverAlDueno`, `ESTADOS_EDITABLES`, `creadasDe`).

- [ ] **Step 1: Pruebas que fallan**

```js
it('POST devolver llama a devolverAlDueno', ...)
it('la ficha deja editar y aprobar en en_revision y en ayuda', ...)          // ESTADOS_EDITABLES.includes(s.estado)
it('avisa que «Aprobar e importar» crea interés fijo si el negocio usa otro', ...) // modoInteresDefault !== 'fijo' en JSX antes del botón
it('las filas que el dueño ya creó se ven como creadas y no se importan', ...)
it('la lista y el inicio cuentan «ayuda» como abierta', ...)
```

- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run lib/__tests__/admin-cargas-ayuda.test.js` → FAIL.
- [ ] **Step 3: Implementar.** El GET de admin incluye `organization.modoInteresDefault` y `creadas`.
- [ ] **Step 4: Correr y build** — PASS.
- [ ] **Step 5: Commit**

```bash
git add app/api/admin/cargas app/admin lib/__tests__/admin-cargas-ayuda.test.js
git commit -m "panel de cargas: solo las que piden ayuda, devolver al dueño y aviso del modo"
```

---

### Task 7: Las plantillas de WhatsApp

**Files:**
- Modify: `lib/seguimiento/plantillas.js` (añadir `cartera_por_revisar`, `cartera_recibida_v2`, `cuenta_configurar_v2`)
- Test: el de siempre de plantillas (`lib/__tests__/seguimiento-reglas.test.js` / «utility no lleva palabras de venta»)

**Interfaces:**
- Produces: nombres de plantilla para `WA_PLANTILLA_CARTERA_POR_REVISAR` y `WA_PLANTILLA_CARTERA_RECIBIDA` (Tarea 2).

- [ ] **Step 1: Pruebas que fallan**: las tres existen, son `UTILITY`, sus variables casan con lo que manda Tarea 2 (`['nombre', 'listos', 'revisar']`; `['nombre', 'archivos']`; `['nombre']`), ninguna dice «24 horas» ni «asesor», ninguna empieza o termina en variable.
- [ ] **Step 2: Correr y ver que fallan.**
- [ ] **Step 3: Definirlas.** Textos:
  - `cartera_por_revisar`: «Hola {{1}}, ya leímos los archivos de su cartera en Control Finanzas: {{2}} clientes listos y {{3}} por revisar. Entre a la app para terminar de cargarlos.» Botón URL «Revisar mi cartera» → `/cargar-cartera`.
  - `cartera_recibida_v2`: «Hola {{1}}, recibimos sus {{2}} archivos para cargar su cartera en Control Finanzas. En unos minutos le dejamos en la app lo que encontramos para que lo revise.»
  - `cuenta_configurar_v2`: como `cuenta_configurar` cambiando «y se los dejamos cargados en 24 horas» por «y la app los lee por usted».
- [ ] **Step 4: Correr y ver que pasan.**
- [ ] **Step 5: Commit.** Subirlas a Meta con `.auditoria/_subir-plantillas-seguimiento.mjs` en el VPS (decidido por Carlos el 22 nov); las variables `WA_PLANTILLA_*` se ponen en el `.env` del VPS solo cuando `--estado` diga APPROVED.

---

### Task 8: El piloto con las 4 solicitudes reales (espejo)

**Files:** ninguno de producto. Scripts en `.auditoria/` (ignorado por git).

- [ ] **Step 1:** Refrescar el espejo con `mysqldump` de producción (solo `SolicitudCarga`, `Organization`, `Cliente`, `Prestamo`, `Pago` y lo que pida la carga) y copiar los archivos de esas 4 solicitudes del almacén al almacén del espejo.
- [ ] **Step 2:** Releer las 4 en el espejo (`procesarSolicitud`) para que tengan `_id`.
- [ ] **Step 3:** Con JWT de mentira del dueño de cada una (solo espejo), recorrer la pantalla en Playwright a 412 px: completar lo de toda la carga con un modo distinto en cada una (fijo, «de una vez», sobre saldo, globo), corregir una fila, quitar una repetida, cargar.
- [ ] **Step 4:** Desglosar al peso, por cada modo, un préstamo cargado contra el mismo préstamo hecho en el formulario de nuevo préstamo (mismo monto, tasa, plazo, fecha y abono): cuota, total, saldo y lo abonado (interés / capital) iguales.
- [ ] **Step 5:** Repetir el corte a mitad (cerrar la pestaña tras 3 filas, entrar en otro contexto): no se duplica nadie. Pedir ayuda tras cargar parte y aprobar desde el panel: no se duplica nadie.
- [ ] **Step 6:** Informe a Carlos con capturas y cifras. El aviso a los 4 dueños reales se manda solo tras su visto bueno y después del despliegue.
