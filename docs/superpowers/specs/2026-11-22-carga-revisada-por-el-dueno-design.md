# La carga de cartera la revisa y la carga el dueño

22 nov 2026 · Control Finanzas (Next.js 15 App Router, JS/JSX, Prisma 7, MariaDB)

## Por qué

Hoy «Que te la carguemos» (`/cargar-cartera`) promete que «un asesor» pasa el
cuaderno en 24 h. El dueño sube fotos, Excel o PDF; el sistema los lee y valida
(`lib/carga-asesor/`), y la solicitud espera a que Carlos la revise en
`/admin/cargas/[id]` y pulse «Aprobar e importar».

Carlos (dueño de la plataforma): *«la gente está mandando solicitudes de carga
con fotos que le falta un montón de contexto o con archivos de Excel totalmente
incompletos […] la plataforma no tiene ningún tipo de retroalimentación aparte
de mí manualmente […] le informe en la misma plataforma si sirve o no, por qué
no sirve, cuáles son los errores, cuántos errores tiene, dónde los tiene, para
que el usuario sea consciente.»* Y sobre el interés: *«me gustaría que el tipo
de cobro de interés se ajustara a la realidad del préstamo. Porque si solo es
interés fijo y hay uno dinámico, variable o tipo globo, no va a funcionar.»*

Medido en producción (22 nov, solo lectura): 7 solicitudes. Las 4 que esperan
revisión tienen **121 de 121 filas con error**; les faltan siempre los mismos
datos de negocio: tasa (121/121), frecuencia (121/121), plazo o cuotas
(112/121), luego fecha de inicio y lo abonado. Un Excel dio 0 filas (el lector
descartó las 114). Solo una se aprobó (1 cliente).

El sistema YA sabe todo eso fila por fila, pero `GET /api/carga-asesor` lo
esconde a propósito (*«Al dueño solo se le dice lo que quedó cargado»*).

## Qué se quiere

Cuando el sistema termina de leer, el propio dueño ve en la app qué se leyó, qué
sirve y qué no (cuántas filas, cuáles, por qué, de qué archivo), completa lo que
falta, y lo carga él con el tipo de interés real de cada préstamo. Carlos solo
interviene si el dueño pide ayuda.

### Objetivos

1. Retroalimentación automática y en la app: veredicto con cifras, filas con
   problema, el motivo en palabras de prestamista y el archivo de origen.
2. Lo que es igual para toda la cartera (tasa, frecuencia, plazo o cuotas,
   **tipo de interés**) se pone una vez; cada fila puede llevar el suyo.
3. Cada préstamo entra con su tipo de interés real y con lo ya abonado bien
   repartido entre interés y capital.
4. Un archivo del que no salió nada lo dice, con qué mandar en su lugar.
5. Carlos solo recibe la solicitud si el dueño pulsa «Necesito ayuda».
6. El dueño se entera de que ya puede revisar: campana siempre y WhatsApp con
   una plantilla nueva (decidido por Carlos).

### No objetivos

- Mejorar los lectores (Gemini, mapeo de Excel, PDF Crossbox).
- Cambiar `lib/importar-cartera.js`, `validarCartera` ni la carga masiva normal.
- Tocar la barra de navegación.

### Anti-objetivos

- Que se cargue algo distinto de lo que se ve (el «decía 20 % y creaba al 0 %»
  de `migracion_cartera_lote`). `efectivo()` de `LoteFotos` sigue siendo la única
  cuenta de cada campo y la usan la fila, el semáforo y la creación.
- Cargar dos veces lo mismo (doble toque, reintento, Carlos y el dueño a la vez).
- Dejar al dueño sin salida: «Necesito ayuda» siempre está.
- Pantalla vacía con cero filas o con todo bien: se dice.

## Enfoques considerados

1. Meter las filas en la revisión de la carga masiva (`PasoRevisar`). Elegido
   primero, **descartado**: no edita campos ni quita filas, agrupa por cliente,
   espera el formato de `validarCartera` y su botón se activa con errores. Y
   carga por `importarCartera`, que solo crea interés fijo.
2. Darle al dueño la pantalla del superadmin (`/admin/cargas/[id]`). Sí edita,
   quita, rellena y enseña el original, pero está hecha para PC y también carga
   por `importarCartera` (solo fijo).
3. **ELEGIDO: la revisión de «Pasar el cuaderno» (`components/migrador/LoteFotos.jsx`)
   con las filas que ya leyó la solicitud.** Es la revisión para el dueño que ya
   existe y está en teléfono: semáforo por fila, filtro «solo las que hay que
   revisar», edición en la fila, quitar, tasa / frecuencia / **modo de interés**
   / ruta una vez arriba y por fila, la pregunta del abono raro (¿interés o
   capital?), y crea por `/api/clientes` + `/api/prestamos` con
   `yaEstabaEnLaCalle: true` — la misma puerta del formulario, que respeta todos
   los modos y arma la tabla. Reintentar no recrea al cliente (`_clienteId`).
   Lo que le falta: recibir filas ya leídas, decir de qué archivo salió cada
   una, y cerrar la solicitud al terminar.
4. Solo un informe para que vuelva a enviar: no saca a Carlos del medio.

## Cómo queda

### El recorrido del dueño (en `/cargar-cartera`)

1. Sube fotos / Excel / PDF, o por WhatsApp, como hoy. El texto ya no promete
   un asesor en 24 h: el sistema lo lee y en unos minutos le enseña lo que
   encontró para que lo revise y lo cargue.
2. Mientras lee: «Estamos leyendo tus N archivos», con refresco solo.
3. Al terminar le llega la campana y el WhatsApp, y en la pantalla ve:
   - **El veredicto**: «28 clientes leídos · 3 listos · 25 necesitan algo».
   - **Lo que no se pudo leer**, por archivo: «De este Excel no sacamos ningún
     cliente: no encontramos columnas de nombre y monto. Usa la plantilla»
     (enlace a `/api/carga-masiva/plantilla`). Los avisos de un archivo que sí dio
     filas (el total de la foto no cuadra) van como aviso, no como fallo.
   - **La revisión de `LoteFotos`** con esas filas: arriba lo de toda la carga
     (tasa, frecuencia, tipo de interés, ruta) y fila por fila con su estado,
     motivo y «foto 2 ↗» / «Excel, hoja 1» que abre el original.
   - **«Cargar N clientes»** de `LoteFotos`, y **«Necesito ayuda»**.
4. Al terminar de crear: la solicitud queda `aprobada` y pasa todo lo que hoy
   hace `aprobarSolicitud` después de importar: `actividadLog`,
   `reiniciarPrueba`, `notificar` y el WhatsApp `cartera_cargada_v3`. Si quedan
   filas que fallaron, la solicitud sigue abierta con esas filas.

### Reglas de la revisión (calls de Claude, marcadas)

- **Repetidas dentro de la misma carga** (misma cédula o nombre y mismo monto):
  la fila sale en rojo y no se crea hasta que se quite o se marque «no es la
  misma». Sin esto la misma cartulina fotografiada dos veces entra dos veces.
- **Montos raros y dudas del lector**: amarillo, con su foto; no bloquean.
- **Frecuencia sin dato** en la fila y sin valor para toda la carga: no se
  supone «diario»; la fila no está lista.
- **Lo de toda la carga solo rellena lo vacío**; no se aplica el plazo a una
  fila que trae la cuota (el plazo sale de la cuota) ni la tasa a una fila del
  PDF que trae saldo y fecha de corte (la tasa se deduce, `lib/carga-masiva.js`).

### Lo de Carlos

- Ya no le llega Telegram al terminar la lectura ni el recordatorio de 20 h; le
  llega cuando el dueño pulsa «Necesito ayuda». Desde ahí la solicitud queda
  `ayuda` (el estado es texto: sin migración) y el dueño ve «Carlos la está
  revisando», sin poder editarla, hasta que Carlos la devuelva o la apruebe.
- `/admin/cargas` sigue funcionando. ⚠ Su «Aprobar e importar» crea interés
  fijo (`importarCartera`); si alguna fila o el negocio usa otro modo, el panel
  lo avisa antes del botón. (Call de Claude.)
- Las escrituras de filas (`guardarFilas`) pasan por el candado de fila
  (`conCandado`) para que Carlos y el dueño no se pisen.

### Las 4 solicitudes que ya esperan (decidido por Carlos)

Son el piloto: se prueban en el espejo con esos datos reales hasta que salgan
bien, y entonces se les avisa a sus dueños (el aviso se confirma con Carlos
antes de mandarlo). Nadie las carga a mano.

### WhatsApp (decidido por Carlos)

Plantilla nueva de utilidad, p. ej. `cartera_por_revisar`: «Ya leímos tu
cartera: {listos} clientes listos y {revisar} por revisar. Entra a terminarla:
{enlace}». Se manda a Meta al empezar la obra; mientras no esté aprobada avisa
solo la campana. Las plantillas que prometen «un asesor en 24 h»
(`cartera_recibida`, `cuenta_configurar` en `lib/seguimiento/plantillas.js`) se
cambian por versiones nuevas en la misma tanda; el texto del bot
(`lib/carga-asesor/whatsapp.js`), `TraerCartera.jsx`, `CarteraVacia.jsx` y el
`notificar` de `confirmarRecibida` se cambian ya.

### Piezas (propuesta; el constructor puede ajustar)

- `GET /api/carga-asesor`: con la solicitud `en_revision`, devuelve las filas
  con sus marcas (`_archivo`, `_hoja`, `_errores`, `_avisos`, `_dudas`), los
  archivos y lo que falló por archivo. Solo el dueño de esa organización.
- `GET /api/carga-asesor/archivo/[n]`: el original, solo para el dueño de esa
  solicitud (hoy solo existe la versión de superadmin).
- `LoteFotos` acepta `filasIniciales` (y su origen) en vez de leer fotos, y un
  `onListo` que, con la solicitud, llama a:
- `POST /api/carga-asesor/cargada`: recibe qué filas se crearon (ids de
  cliente y préstamo), marca la solicitud y hace lo de después de
  `aprobarSolicitud`. Idempotente: una segunda llamada no repite nada.
- `POST /api/carga-asesor/ayuda`.
- Una función pura que pasa una fila de la solicitud (formato del importador)
  a fila de `LoteFotos`, con pruebas por cada campo.
- `lib/fetch-timeout.js` ya da 180 s a `/api/carga-asesor*`.

## Lo que queda al constructor

- El aspecto del veredicto y de «lo que no se pudo leer» dentro de `DESIGN.md`.
- El intervalo de refresco mientras lee.
- Si «Necesito ayuda» pide una nota.
- Cómo devuelve Carlos una solicitud al dueño desde `/admin/cargas`.

## Cómo se prueba

- Unitarias: el paso fila de solicitud → fila de `LoteFotos`, las reglas de la
  revisión, la idempotencia de `cargada`.
- En el espejo con las 4 solicitudes reales: leer, completar lo de toda la
  carga con distintos tipos de interés, cargar, y desglosar al peso al menos un
  préstamo por modo contra el formulario de nuevo préstamo (mismo monto, tasa,
  plazo y abono deben dar la misma cuota, total y saldo).
- Ver la pantalla a 412 px y en PC; probar el cero (archivo sin filas) y todo
  bien.
