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
- [x] crear-prestamo — ✅ hecha (6 pasos) · `crear-prestamo.mjs`
- [x] registrar-pago — ✅ hecha (4 pasos) · `registrar-pago.mjs`
- [ ] editar-eliminar-prestamo — 3 puntitos, editar, eliminar
- [ ] liquidar-prestamo — pago total anticipado
- [ ] renovar-prestamo

### Dinero / caja
- [ ] ver-caja — dónde está y cómo cuadrarla
- [ ] capital — agregar y retirar plata
- [ ] pagar-mensualidad — cómo pagar el servicio

### Avanzado / configuración
- [ ] crear-ruta — crear ruta y asignar clientes
- [ ] crear-cobrador — crear cobrador y darle acceso
- [ ] lucas-ia — registrar pago por voz, preguntar ganancias
- [ ] configuracion — tema, datos del negocio, notificaciones

## Notas
- Las guías de onboarding (primer-ingreso) requieren una cuenta recién creada
  sin onboarding completado.
- `output/` y `.creds.json` están en .gitignore (binarios pesados / credenciales).
- Integración al bot: ÚLTIMO paso, cuando la biblioteca esté completa.
