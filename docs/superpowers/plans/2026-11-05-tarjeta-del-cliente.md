# La tarjeta del cliente — plan

**Objetivo:** el recibo de WhatsApp lleva un enlace a la tarjeta del deudor, opcional por negocio.
**Spec:** `docs/superpowers/specs/2026-11-05-tarjeta-del-cliente-design.md`
**Ejecución:** en esta sesión, sin subagentes. Se construye y verifica en el espejo; desplegar requiere el visto bueno del dueño.

## Restricciones

- Producción solo lectura; el SQL de esquema se aplica a mano antes del código, con el OK del dueño.
- JS sin TypeScript: `prisma generate` tras el esquema; pedir cada campo en los `select`.
- Sin emojis en la interfaz; tokens y radios de `DESIGN.md`; no tocar la pill.
- Pruebas ancladas en código, no en comentarios. Subir `CACHE_NAME` en el release.

## Foco de revisión

1. Abierto, globo, francés y clavo: la tarjeta da lo mismo que la ficha.
2. Pago guardado sin señal: sin enlace.
3. Dueño con secciones guardadas: el enlace sale igual.
4. Opción apagada después de enviar: el enlace muere.
5. Cobrador de otra ruta pidiendo el enlace: 404.

## Tareas

- [x] **1. Esquema.** `Organization.reciboCliente` (default `comprobante`), `avisoTarjetaEn`; `Cliente.tarjetaToken` (único), `tarjetaVistaAt`; modelo `ReclamoPago`. SQL leído y aplicado al espejo; `prisma generate`.
- [x] **2. Datos.** `lib/tarjeta/datos.js`: `SELECT`, `tarjetaPorToken(token)`, `armarTarjeta` (pura), `primerNombre`. `lib/tarjeta/enlace.js`: `generarToken`, `asegurarEnlace`. Pruebas.
- [x] **3. Página pública.** Middleware (`x-cf-publica` + cabeceras), layout sin scripts, `sw.js` sin interceptar, `app/t/[token]/page.jsx`, `components/tarjeta/*`, ejemplo.
- [x] **4. Reclamo.** API pública, `GRUPO_DE`, pendientes, revisado. Pruebas.
- [x] **5. Enlace en el mensaje.** API del enlace, `lib/tarjeta/pedir-enlace.js`, plantilla, las cuatro vías. Pruebas.
- [x] **6. Ajuste y sesión.** `reciboCliente` en sesión (`auth-sesion`, `token-de-sesion`, `auth`, `useAuth`), PATCH y pantalla de Configuración, `nada` oculta los envíos, registro con `tarjeta`, aviso en Inicio.
- [x] **7. Verificar.** vitest, build, eslint. Medir tarjeta contra `/api/prestamos/[id]` en el espejo, todos los modos, hasta el peso. Capturas a 412 px y escritorio, claro y oscuro, con `elementFromPoint`. Comprobar que no sale ninguna petición a Google o Meta.
