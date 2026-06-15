# Guías visuales para el bot de WhatsApp

Tutoriales con screenshots anotados (círculo/flecha/texto sobre el botón exacto)
que el bot enviará a los usuarios cuando pregunten "cómo hago X".

## Cómo generar
1. `npm i -D playwright && npx playwright install chromium` (solo al generar)
2. Crear `scripts/guias/.creds.json` con `{ "email": "...", "pass": "..." }` de una cuenta de prueba
3. `node scripts/guias/<guia>.mjs`
4. Salida en `scripts/guias/output/<slug>/paso-N.png`

El motor (`motor.mjs`) navega el sistema real, captura cada paso y lo anota.

## Estado de la biblioteca

### Onboarding / primeros pasos
- [ ] crear-cuenta — registro (3 pasos: plan, datos, verificar) — PÚBLICO
- [ ] primer-ingreso — demo vs cliente real (requiere cuenta NUEVA)
- [ ] crear-cliente — registrar primer cliente

### Operación diaria
- [x] crear-prestamo — ✅ (6 pasos) · `crear-prestamo.mjs`
- [x] registrar-pago — ✅ (4 pasos) · `registrar-pago.mjs`
- [x] editar-eliminar-prestamo — ✅ (5 pasos) · `editar-eliminar-prestamo.mjs` (incluye Modificar plazo, Cerrar anticipado, Cancelar)
- [ ] renovar-prestamo — (opción "Renovar" en el sheet Gestión)

### Dinero / caja
- [x] ver-caja — ✅ (5 pasos) · `ver-caja.mjs`
- [x] capital — ✅ (3 pasos) · `capital.mjs` (Movimiento general + Agregar/Retirar por ruta)
- [x] pagar-mensualidad — ✅ (3 pasos) · `pagar-mensualidad.mjs`

### Rutas
- [x] crear-ruta — ✅ (3 pasos) · `crear-ruta.mjs`
- [x] cobrar-desde-ruta — ✅ (4 pasos) · `cobrar-desde-ruta.mjs`
- [x] organizar-ruta — ✅ (3 pasos) · `organizar-ruta.mjs`

### Avanzado / configuración
- [x] crear-cobrador — ✅ (4 pasos) · `crear-cobrador.mjs`
- [x] lucas-ia — ✅ (3 pasos) · `lucas-ia.mjs`
- [x] configuracion — ✅ (5 pasos) · `configuracion.mjs` (perfil, organización, apariencia, notificaciones)

## Notas
- Las guías de onboarding (primer-ingreso) requieren una cuenta recién creada
  sin onboarding completado.
- `output/` y `.creds.json` están en .gitignore (binarios pesados / credenciales).
- Integración al bot: ÚLTIMO paso, cuando la biblioteca esté completa.
