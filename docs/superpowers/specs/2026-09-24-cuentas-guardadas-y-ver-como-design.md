# Cuentas guardadas en el teléfono y «Ver como este cobrador»

**Fecha:** 24 sep 2026 · **Pedido por:** el dueño · **Estado:** diseño aprobado por partes en la conversación, pendiente de revisar este documento.

## Por qué

El dueño: la casilla «Mantener la sesión en este teléfono» «no funciona como debería». Lo que hace falta es guardar uno o varios perfiles en el teléfono y entrar con un toque, sin escribir correo y contraseña. Eso importa sobre todo en la app instalada: ahí el navegador muchas veces no sugiere las contraseñas guardadas. También quiere que el administrador pueda meterse rápido en el perfil de un cobrador, con seguridad.

El administrador entra al perfil del cobrador **solo para verificar**, no para registrar nada: qué caja hizo y cómo le quedó la ruta, que lo que se programó desde el administrador se vea tal cual en el cobrador.

### Lo que hay hoy (medido en el código)

- **La casilla no hace nada.** `app/login/page.jsx` guarda `recordar` en el estado y nunca lo pasa a `signIn`. Toda sesión dura 8 horas (`lib/auth.js`, `session.maxAge`), marque lo que marque. Un cobrador que entra a las 6 a. m. queda fuera a las 2 p. m.
- **No hay forma de que el dueño vea la app como su cobrador** sin conocer su correo y su contraseña.
- La app instalada corre en modo aplicación (`app/manifest.json`, `display: standalone`).
- Ya existe un registro de sesiones por aparato (`SesionActiva`, `/api/sesiones`, `SesionTracker`) con un intérprete del aparato (`parseDispositivo`) que se puede reutilizar.

## Qué se construye

Dos piezas, cada una resuelve una necesidad:

1. **Cuentas guardadas en el teléfono:** entrar a la PROPIA cuenta con un toque.
2. **«Ver como este cobrador»:** que el dueño revise, en solo lectura, lo que ve su cobrador.

### Fuera de alcance

- Entrar con huella o Face ID (llaves de acceso, WebAuthn). Queda como mejora posterior encima de esto.
- Registrar cobros o préstamos «como» el cobrador. La vista es de solo lectura.
- Alargar la sesión de 8 horas. Con la cuenta guardada, volver a entrar es un toque, y alargarla haría más grave perder un teléfono.
- «Ver como» para el superadmin: tiene su propio panel.

## 1. Cuentas guardadas en el teléfono

### Lo que ve la persona

- La casilla del login pasa a decir **«Guardar esta cuenta en este teléfono»** y va marcada por defecto.
- Si el teléfono ya tiene cuentas guardadas, la pantalla de entrada empieza por ellas: una tarjeta por cuenta con la inicial, el nombre (sin recortar, baja de renglón), si es cobrador o dueño y el negocio. Debajo va «Entrar con otra cuenta», que abre el formulario de siempre.
- **Cobrador:** tocar la tarjeta y entra.
- **Dueño o superadmin:** tocar la tarjeta y poner el PIN de 4 números. El PIN se crea justo después de entrar con contraseña, la primera vez que se guarda la cuenta en ese teléfono. Es un paso de la misma pantalla, antes de ir al panel.
- Cada tarjeta tiene una «x» para quitar la cuenta de ese teléfono. Eso la borra del aparato y la corta en el servidor.
- «Cerrar sesión» **no** borra la cuenta guardada: sirve justo para volver a entrar con un toque.

### Seguridad

- **El teléfono no guarda la contraseña.** Guarda una llave aleatoria de 32 bytes (base64url) de ese aparato. El servidor guarda solo su huella SHA-256: para una llave de esa entropía, un hash rápido basta.
- **El PIN** (solo dueño y superadmin) se guarda con bcrypt: tiene poca entropía y necesita un hash lento. Hay un contador de intentos: **al 5.º error la cuenta guardada se revoca** y hay que entrar con correo y contraseña.
- La llave deja de servir:
  - al **cambiar la contraseña** de esa cuenta, que corta todas sus cuentas guardadas (ver «Cambios de contraseña»);
  - si la cuenta se desactiva o el negocio se suspende, que ya se revisa al entrar;
  - si no se usa en **60 días**, que se rechaza y se borra;
  - si se quita a mano desde la «x», desde Configuración o desde la ficha del cobrador.
- Entrar con la llave pasa por **las mismas revisiones** que entrar con contraseña: cuenta activa, correo verificado, negocio activo, límite de cobradores del plan, y rutas y permisos del cobrador.
- Límite de intentos por cuenta guardada con el `loginLimiter` que ya existe.

### Dónde se administran

- **Configuración → «Teléfonos con tu cuenta guardada»:** aparato (con `parseDispositivo`), cuándo se guardó, último uso y «Quitar».
- **Ficha del cobrador (panel del dueño):** lo mismo para los aparatos de ese cobrador, para cortarlo si pierde el teléfono o se va.

### Datos

Tabla nueva `CuentaGuardada`:

| campo | tipo | para qué |
|---|---|---|
| `id` | cuid | se guarda en el teléfono junto a la llave |
| `userId` | → User (cascade) | de quién es |
| `tokenHash` | String, único | SHA-256 de la llave |
| `pinHash` | String? | bcrypt del PIN; null en cobradores |
| `intentosPin` | Int, default 0 | al 5 se revoca |
| `dispositivo` | String? | «iPhone · Safari», con `parseDispositivo` |
| `createdAt` | DateTime | cuándo se guardó |
| `lastUsedAt` | DateTime | último uso; con más de 60 días se rechaza |

Revocar = borrar la fila. No hace falta guardar el historial de revocadas: la fila no sirve para nada más.

En el teléfono, `localStorage['cf-cuentas-guardadas']` guarda una lista de `{ id, token, nombre, rol, orgNombre, conPin }`. Toda lectura y escritura va en try/catch: sin almacenamiento, la pantalla es el formulario de siempre.

### Flujo

1. Login con contraseña correcto y la casilla marcada. Si es dueño o superadmin, se pide crear el PIN y confirmarlo. Luego `POST /api/cuentas-guardadas` con `{ pin? }`, ya con la sesión recién creada. El servidor crea la fila y devuelve `{ id, token }`, y la pantalla lo guarda en `localStorage`.
2. Entrada con la tarjeta: `signIn('cuenta-guardada', { id, token, pin? })`. Un proveedor nuevo de NextAuth busca la fila, compara la huella, revisa los 60 días y el PIN, actualiza `lastUsedAt` y arma la sesión con la función compartida.
3. La «x»: `DELETE /api/cuentas-guardadas/[id]` con la llave en el cuerpo como prueba (sirve sin sesión) y se quita de `localStorage`.
4. Administrar: `GET`/`DELETE /api/cuentas-guardadas` para las propias y `GET`/`DELETE /api/cobradores/[id]/cuentas-guardadas` para el dueño sobre sus cobradores.

## 2. «Ver como este cobrador»

### Lo que ve el dueño

- En la ficha del cobrador (`/cobradores/[id]`) hay un botón **«Ver como Juan»**. Solo lo ve el dueño, y solo para cobradores de su negocio.
- Al tocarlo, la app se abre como la ve Juan: su Inicio, su ruta en el orden que le quedó, su caja, lo que le toca cobrar hoy. Todo con **sus permisos**: si Juan no ve el capital, aquí tampoco sale.
- Arriba, fija, una franja: **«Viendo como Juan · solo lectura · Volver a mi cuenta»**. Va en el armazón del panel, como `AvisoSinSenal`, y no toca la barra de navegación.
- Los botones siguen visibles, para que la pantalla sea idéntica. Cualquier registro se rechaza con «Estás viendo como Juan: desde aquí no se registra nada. Vuelve a tu cuenta».
- «Volver a mi cuenta» devuelve a la cuenta del dueño sin contraseña ni PIN. **A la hora vuelve sola.**
- En el Historial queda «Carlos vio la app como Juan», con la hora (acción nueva `ver_como_cobrador` en `activity-log-types.js`).

### Cómo funciona

- **Proveedor `ver-como`** `{ cobradorId }`: lee el token actual con `getToken(req)`. Exige que quien pide sea `owner`, que el cobrador sea `cobrador`, esté activo y sea del mismo negocio. Arma la sesión de Juan con la función compartida y le añade `vistaDe: { id, nombre }` (el dueño), `soloLectura: true` y `vistaHasta: ahora + 1 h`. No toca `lastLoginAt` ni `lastActivityAt` de Juan.
- **Proveedor `volver`:** solo si el token actual trae `vistaDe`. Arma de nuevo la sesión del dueño con la función compartida, que vuelve a revisar que siga activo.
- **Callback `jwt`:** conserva `vistaDe`, `soloLectura` y `vistaHasta` en el refresco de cada 15 minutos. Si pasó `vistaHasta`, rehace el token como el del dueño: esa es la vuelta automática. El callback `session` los expone en `session.user`.
- **El solo lectura, en un solo sitio:** en `middleware.js`, si el token trae `soloLectura` y la petición es `/api/*` con un método distinto de GET, HEAD u OPTIONS, contesta 403 JSON con el mensaje de arriba. Excepciones: `/api/auth/*` (salir, volver) y `/api/errores-cliente`. Al estar en el portero, ninguna pantalla nueva se lo salta.
- **Que la revisión no deje rastro en Juan:**
  - `SesionTracker` no registra nada en modo vista; su POST igual lo rechazaría el middleware.
  - Las notificaciones push no se suscriben en modo vista; su POST igual se rechaza.
  - El modo sin conexión no descarga la cartera de Juan al teléfono del dueño. **No se llama a `limpiarDatosOffline` al volver**, porque borraría cobros pendientes del dueño. Simplemente no se escribe nada en modo vista.
- Los GET que calculan por dentro (los devengos pendientes, por ejemplo) siguen corriendo: son cálculos del sistema que igual ocurrirían, no actos de Juan.

## Una sola función para armar la sesión

Hoy todas las revisiones viven dentro del `authorize` de la contraseña: cuenta activa, correo verificado, negocio activo, límite de cobradores del plan, rutas, permisos, vencimiento y datos del negocio. Se sacan a `sesionDeUsuario(user)`, en `lib/auth-sesion.js`, y la usan las cuatro entradas: contraseña, cuenta guardada, ver-como y volver. Así ninguna entrada revisa menos que otra.

## Cambios de contraseña

Cortan todas las cuentas guardadas de esa persona (`deleteMany({ userId })`) en las cuatro vías que la cambian:

- `app/api/auth/reset-password` (olvidé mi clave);
- `app/api/configuracion/perfil` (mi perfil);
- `app/api/cobradores/[id]` (el dueño le cambia la clave a un cobrador);
- `app/api/admin/organizaciones/[id]` (superadmin).

(`registro` crea una cuenta nueva y `clientes/[id]/portal` es la clave del portal del cliente, no de un `User`: no aplican.)

## Pruebas

**Automáticas:**
- huella de la llave;
- PIN correcto e incorrecto, y revocación al 5.º error;
- rechazo con más de 60 días;
- rechazo tras cambiar la contraseña, en las cuatro vías;
- un cobrador no puede usar `ver-como`;
- un dueño no puede ver como un cobrador de otro negocio;
- el middleware rechaza POST, PATCH y DELETE en modo vista y deja pasar GET y las excepciones;
- `volver` solo funciona con `vistaDe`.

**En el espejo, con el navegador, a 412px y en PC:**
- guardar un cobrador y entrar con un toque;
- dueño con PIN, incluidos los 5 errores;
- «Ver como», intentar cobrar (rechazado) y volver a mi cuenta;
- comprobar que la «última actividad» de Juan no se movió;
- quitar un aparato desde la ficha y comprobar que ese teléfono ya no entra.

## Despliegue

- Una tanda.
- `CREATE TABLE CuentaGuardada` en producción **antes** del código. Se saca con `prisma migrate diff`, se lee y se comprueba.
- Subir `CACHE_NAME`.
- La verificación de siempre: `git log` en el VPS, `/login` en 200 y las dos `cf` en pie.
