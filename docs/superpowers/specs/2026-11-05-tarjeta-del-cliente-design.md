# La tarjeta del cliente — diseño

Aprobado por el dueño el 5 nov 2026 («dale»), a partir de los mockups del 4 nov.

## Para qué

La cartulina de papel, en el celular del deudor. El recibo que el cobrador ya manda
por WhatsApp lleva un enlace; el enlace abre lo que debe, la próxima cuota y sus
pagos, sin clave.

- **Frena el robo del cobrador:** si se guarda una cuota, el cliente no la ve y reclama.
- **Acaba el «yo le pagué»:** cada pago queda con fecha y saldo.
- **Se usa sin pedirlo:** ~18.000 pagos al mes, 94 negocios cobrando.

El portal con PIN no sirve para esto: 32 de 10.688 clientes lo tienen activo. Se deja como está.

## No objetivos

- No se paga desde la tarjeta. No se pide plata («aquí no se paga ni se pide plata»).
- No se manda nada por la API de WhatsApp: lo envía el cobrador desde su teléfono.
- No se muestran tasa, interés, monto prestado, cédula, dirección ni teléfono.
- No se toca la ruta de registrar pagos (`/api/prestamos/[id]/pagos`).

## Lo que haría que fallara aunque funcione

- Una cifra distinta de la ficha del préstamo.
- Que un negocio que no lo pidió se encuentre con sus clientes viendo las cuentas.
- Que el enlace llegue a Google o a Meta, o se pueda adivinar.
- Que la marca parezca el acreedor.
- Que un pago guardado sin señal dispare un reclamo falso.

## Decisiones del dueño

| Tema | Decisión |
|---|---|
| Opcional | Tres opciones en Configuración; el cobrador no la cambia |
| Negocios nuevos | Arrancan con la tarjeta |
| Negocios actuales | «Solo el comprobante» (igual que hoy) + aviso una vez en Inicio |
| Los que ocultan el saldo (10 de 94) | No les sale el aviso |
| Pie | Fijo: «Software de gestión: Control Finanzas · no presta dinero ni realiza cobros» |
| «Pagué y no aparece» | Solo al dueño (no existe el rol supervisor) |
| Vista previa en WhatsApp | Solo el nombre del negocio, sin cifras |
| Sin señal | El recibo sale sin enlace |

## Las tres opciones (`Organization.reciboCliente`)

- `tarjeta`: el mensaje de hoy + el enlace.
- `comprobante` (por defecto de la columna): el mensaje de hoy, sin enlace. Respeta «Ocultar saldo».
- `nada`: no se ofrece mandar el recibo: sin interruptor al cobrar, sin borrador
  automático, sin «Enviar por WhatsApp» ni «Mandar como imagen». Imprimir y ver el
  papel siguen. Los recordatorios y mensajes de mora no cambian.

Si deja de ser `tarjeta`, los enlaces ya enviados dejan de abrirse.

## El enlace

- `Cliente.tarjetaToken`: 18 bytes aleatorios en base64url, único, creado al pedirlo por primera vez.
- Por **cliente**, no por préstamo: sobrevive a una renovación y muestra todos sus créditos vivos.
- URL: `<NEXTAUTH_URL>/t/<token>`.
- Se pide con `GET /api/tarjeta/enlace/[clienteId]`: sesión, misma organización y, si
  es cobrador, cliente de su ruta. Devuelve `{ url: null }` si la opción no es `tarjeta`.
  No cuelga de `/api/clientes` porque el service worker cachea ese prefijo.

## Privacidad de `/t/*`

- El layout raíz carga la etiqueta de Google, el píxel de Meta, la captura de
  «Instalar», la sesión y el modo sin señal. En `/t/*` no carga ninguno: el
  middleware marca la petición (`x-cf-publica`) y el layout pinta solo los hijos.
- Respuesta con `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`.
- El service worker no intercepta `/t/` (si no, en el teléfono del cobrador podría salir el armazón de la app).
- El título y la vista previa llevan solo el nombre del negocio, sin la imagen de la marca.
- Enlace inválido, negocio inactivo u opción apagada: la misma página «Este enlace ya no está disponible», 404.

## Qué muestra la tarjeta

Cada préstamo `activo` del cliente; si no tiene, el último terminado, con «Pagado».
Nunca `pendiente_aprobacion`.

- A nombre del negocio. Saludo con el primer nombre.
- **Te falta pagar:** `calcularSaldoPendiente`, barra `calcularPorcentajePagado`, «Ya pagaste» (sin recargos ni descuentos, como la ficha).
- **Atraso:** `calcularDiasMora`. El moratorio calculado NO sale: es lo que se le ofrece al dueño aplicar, no una deuda; si lo aplica, entra como recargo al saldo y a la lista.
- **Próxima cuota:** `calcularCuotaQueToca` + `calcularProximoCobro`, con los días sin cobro resueltos igual que la ficha (`obtenerDiasSinCobro`).
- **Sus pagos:** fecha (`pagosEnOrden`, día de Bogotá según el país), medio y quién recibió (solo si tiene rol cobrador, primer nombre). Los recargos y descuentos salen con su nombre y signo.
- Las cifras salen de las mismas funciones que `GET /api/prestamos/[id]`, con el mismo `include`. Se comprueba contra datos reales.

**Con «Ocultar saldo»:** no salen saldo, barra ni atraso en plata; sí «Ya pagaste», próxima
cuota y pagos. El ajuste nunca se contradice, y el cliente sigue pudiendo vigilar sus pagos.

## «Pagué y no aparece»

- Formulario corto: cuánto (opcional), qué día, nota de hasta 200 caracteres.
- `POST /api/tarjeta/reclamo/[token]`, público, con límite por IP. Con uno abierto de las últimas 24 h no crea otro y responde lo mismo.
- Modelo `ReclamoPago`. Aviso con `notificar` a los dueños.
- En «Esperan tu decisión»: lo que dice el cliente junto a lo que se anotó ese día.
  Acciones: ver el préstamo y marcar revisado (`POST /api/tarjeta/reclamo-revisado/[id]`, solo dueño).
- El cobrador no lo ve en ninguna parte.

## El mensaje

Sección `tarjeta` en `pago_confirmacion`, antes de la firma, `locked` para que las
secciones guardadas por el dueño no la apaguen. Solo aparece si llega `tarjetaUrl`.
También en `generarTextoComprobante` (vías viejas).

Vías: borrador automático de `RegistrarPago`, `HojaWhatsApp` (ficha, ruta, cobro),
`BotonWhatsApp`, `BotonCompartir`. Un pago con `offline: true` o sin `id` de un
recibo recién cobrado no lleva enlace. El cliente nunca espera más de 2,5 s por él:
si no llega, sale sin enlace.

## Medir

`Cliente.tarjetaVistaAt`: última apertura, sin contar el robot de la vista previa
de WhatsApp/Meta, escrita como mucho una vez por hora. Es lo que dirá si se usa.

## A criterio del constructor

Textos finales dentro del tono del producto, `DESIGN.md`, ejemplo en `/t/ejemplo`
con datos inventados para que el dueño la vea antes de activarla.
