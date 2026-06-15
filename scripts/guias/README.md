# Guías visuales para el bot de WhatsApp

Tutoriales con screenshots anotados (círculo/flecha/texto sobre el botón exacto)
que el bot enviará a los usuarios cuando pregunten "cómo hago X".

## Cómo generar
1. `npm i -D playwright && npx playwright install chromium` (solo al generar)
2. Crear `scripts/guias/.creds.json` con `{ "email": "...", "pass": "..." }` de una cuenta de prueba
3. Una guía suelta: `node scripts/guias/<guia>.mjs`
   - Varias de una (recomendado): `node scripts/guias/_runner.mjs <slug1> <slug2> ...`
4. Salida en `scripts/guias/output/<slug>/paso-N.png`

El motor (`motor.mjs`) navega el sistema real, captura cada paso y lo anota.

⚠️ **Rate-limit de login:** producción bloquea tras ~8 logins seguidos. Por eso
las guías nuevas exportan `export const def` (no auto-ejecutan) y se generan en
LOTE con `_runner.mjs`, que hace UN solo login y corre todas las guías del lote
en la misma sesión. Si igual te bloquea, espera ~10 min.

## Patrón de una guía
- Guías viejas: llaman `generarGuia({...})` directamente (1 login c/u).
- Guías nuevas: `export const def = {...}` + se corren con `_runner.mjs`.
- Helpers compartidos de préstamos en `_helpers.mjs` (`abrirPrestamo`, `abrirGestion`).

## Estado de la biblioteca

### Onboarding / primeros pasos
- [x] crear-cuenta — ✅ (3 pasos) · `crear-cuenta.mjs` (público; plan, datos, verificar)
- [x] crear-cliente — ✅ (4 pasos) · `crear-cliente.mjs` (incluye importar cartulina)
- [x] primer-ingreso — ✅ (4 pasos) · `primer-ingreso.mjs` (bienvenida, demo vs
      cliente real, ir al dashboard). Capturada con una cuenta de prueba creada
      directo en DB (emailVerificado=true, onboardingCompletado=false) y borrada
      al terminar. NOTA: el email se guarda normalizado (sin puntos en el local
      part, ver lib/normalizar-email.js) — usarlo asi para loguear.

### Operación diaria
- [x] crear-prestamo — ✅ (6 pasos) · `crear-prestamo.mjs`
- [x] registrar-pago — ✅ (4 pasos) · `registrar-pago.mjs`
- [x] editar-eliminar-prestamo — ✅ (5 pasos) · `editar-eliminar-prestamo.mjs` (incluye Modificar plazo, Cerrar anticipado, Cancelar)
- [x] renovar-prestamo — ✅ (3 pasos) · `renovar-prestamo.mjs` (sheet Gestión → Renovar)

### Acciones de cliente (detalle)
- [x] editar-cliente — ✅ (3 pasos) · `editar-cliente.mjs`
- [x] eliminar-cliente — ✅ (3 pasos) · `eliminar-cliente.mjs` (solo sin préstamos activos)
- [x] inactivar-cliente — ✅ (3 pasos) · `inactivar-cliente.mjs`
- [x] reagendar-visita — ✅ (3 pasos) · `reagendar-visita.mjs`
- [x] trasladar-cliente — ✅ (3 pasos) · `trasladar-cliente.mjs` (desde la ruta destino → "+ Agregar")

### Acciones de préstamo (sheet Gestión / detalle)
- [x] aplicar-recargo — ✅ (3 pasos) · `aplicar-recargo.mjs`
- [x] aplicar-descuento — ✅ (3 pasos) · `aplicar-descuento.mjs`
- [x] marcar-prestamo-perdido — ✅ (3 pasos) · `marcar-prestamo-perdido.mjs`
- [x] anular-un-pago — ✅ (3 pasos) · `anular-un-pago.mjs` (Historial de pagos → ícono papelera)
- [x] enviar-recibo-whatsapp — ✅ (3 pasos) · `enviar-recibo-whatsapp.mjs` ("Enviar resumen por WhatsApp")

### Dinero / caja
- [x] ver-caja — ✅ (5 pasos) · `ver-caja.mjs`
- [x] capital — ✅ (3 pasos) · `capital.mjs` (Movimiento general + Agregar/Retirar por ruta)
- [x] pagar-mensualidad — ✅ (3 pasos) · `pagar-mensualidad.mjs`
- [x] inyectar-capital — ✅ (3 pasos) · `inyectar-capital.mjs` (Capital → Movimiento → Agregar dinero)
- [x] retirar-capital — ✅ (3 pasos) · `retirar-capital.mjs` (Capital → Movimiento → Retirar dinero)
- [x] hacer-ajuste-caja — ✅ (3 pasos) · `hacer-ajuste-caja.mjs` ("Ajustar saldo general")
- [x] cuadrar-caja-con-cobradores — ✅ (3 pasos) · `cuadrar-caja-con-cobradores.mjs` (Cuadre del día → Con diferencia)
- [x] cerrar-caja — ✅ (3 pasos) · `cerrar-caja.mjs` (Cuadre del día → Confirmar cobradores)
- [x] reabrir-caja — ✅ (3 pasos) · `reabrir-caja.mjs` (Historial de cierres → Reabrir; sin cierres en la cuenta demo el paso 3 es descriptivo)

### Gastos
- [x] agregar-mi-gasto — ✅ (3 pasos) · `agregar-mi-gasto.mjs` (botón "Mi gasto")
- [x] aprobar-rechazar-gastos-cobradores — ✅ (3 pasos) · `aprobar-rechazar-gastos-cobradores.mjs` (pestaña Pendientes; sin gastos demo el paso 3 es descriptivo)

### Extras descubiertos
- [x] importar-cartulina — ✅ (3 pasos) · `importar-cartulina.mjs` (OCR de tarjeta física)

### Rutas
- [x] crear-ruta — ✅ (3 pasos) · `crear-ruta.mjs`
- [x] cobrar-desde-ruta — ✅ (4 pasos) · `cobrar-desde-ruta.mjs`
- [x] organizar-ruta — ✅ (3 pasos) · `organizar-ruta.mjs`

### Avanzado / configuración
- [x] crear-cobrador — ✅ (4 pasos) · `crear-cobrador.mjs`
- [x] lucas-ia — ✅ (3 pasos) · `lucas-ia.mjs`
- [x] configuracion — ✅ (5 pasos) · `configuracion.mjs` (perfil, organización, apariencia, notificaciones)

## Estado: BIBLIOTECA AMPLIADA — 35 guías ✅
(15 base + 20 nuevas de acciones puntuales: clientes, préstamos, caja/capital,
gastos y extras.)

Siguiente y último paso: integración al bot (subir imágenes al VPS + enseñarle
a enviar la guía correcta por WhatsApp cuando preguntan "cómo hago X"). Nota:
ya existe `lib/tutorialesData.js` (tutoriales con video + texto markdown para
WhatsApp) — al integrar, alinear los slugs de estas guías con esa data.

## Notas
- Para onboarding (primer-ingreso) se crea una cuenta de prueba directo en DB
  (emailVerificado=true, onboardingCompletado=false) y se borra al terminar.
  Recordar normalizar el email (sin puntos en el local part) para poder loguear.
- `output/` y `.creds.json` están en .gitignore (binarios pesados / credenciales).
- Integración al bot: ÚLTIMO paso, cuando la biblioteca esté completa.
