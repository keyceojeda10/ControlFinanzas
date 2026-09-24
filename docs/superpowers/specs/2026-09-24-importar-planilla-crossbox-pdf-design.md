# Importar la «Planilla Recaudador» de Crossbox desde el PDF

**Fecha:** 24 sep 2026
**Pedido por:** el dueño
**Estado:** diseño aprobado por partes en la conversación; falta revisar este documento.

## Por qué

Un prestamista que venía de Crossbox solo tenía su cartera en un PDF, la «Planilla Recaudador». Lo convirtió a Excel para subirlo y la pantalla dijo «No reconocí las columnas». Hubo que cargársela a mano, desde soporte, deduciendo lo que el PDF no trae.

El objetivo es que el próximo prestamista que venga de Crossbox suba **el mismo PDF que le da su app** y cargue su cartera solo.

## Qué trae la planilla, medido en el PDF real

Una tabla por páginas, con estas columnas:

`Fecha | U. Abono | Cliente | Teléfono | Crédito | Saldo | Cuota | Atrasadas | Vencidos`

- La cabecera trae la fecha de corte («Fecha: 24 Sep 2026») y el nombre de la ruta («Ruta: RUTA 1»).
- Tiene una fila de «Totales» arriba y otra abajo.
- Las fechas vienen como «22 Sep 26» (mes abreviado en español y año de dos cifras). «U. Abono» puede decir «Nunca».
- Los montos vienen como «$150,000.00». `parsearNumero` ya los lee bien.

**No trae** tasa, número de cuotas, frecuencia, total a pagar ni cédula.

Con los datos reales (49 créditos): capital $39.606.000 y saldo $44.503.400, que coinciden con la fila de totales. Deduciendo las condiciones y comprobándolas contra «Atrasadas», **45 cuadran**. Las 4 que no son números sin sentido (cuota de $3, cuota de $492) o casos ambiguos.

## Qué se construye

### 1. Leer el PDF

- **Subir:**
  - `lib/archivos-tabla.js`: `ACCEPT_TABLA` acepta también `.pdf` y `application/pdf`.
  - `PasoSubir`: si el archivo es un PDF, lo manda a `POST /api/carga-masiva/leer-pdf` (multipart; solo el dueño; máximo 5 MB y 30 páginas) en vez de abrirlo con SheetJS.
- **Extraer:** el servidor saca el texto con sus posiciones usando `unpdf`, la base de pdf.js para servidor. Es la única dependencia nueva.
- **Reconocer:** `lib/importar/planilla-crossbox.js` identifica la plantilla por sus cabeceras («Planilla Recaudador», «Crédito», «Saldo», «Cuota», «Atrasadas»). Agrupa el texto en renglones por su posición vertical y en columnas por la posición horizontal de las cabeceras. Salta las filas de «Totales» y las cabeceras repetidas.
- **Devuelve:** `{ formato: 'crossbox-planilla', fechaCorte, ruta, filas, totales }`. Cada fila lleva:
  - `nombre` y `telefono`;
  - `fechaInicio` (YYYY-MM-DD);
  - `ultimoAbono` (fecha o `null`) y `sinAbonos: true` si decía «Nunca»;
  - `montoPrestado`, `saldoActual` y `valorCuota`;
  - `atrasadas` y `vencidos`;
  - `fechaCorte` (la de la cabecera): la deducción calcula las atrasadas a esa fecha, no a la de hoy.
- **La cifra de control:** la suma de crédito y de saldo de las filas leídas tiene que coincidir **al peso** con la fila «Totales» del PDF. Si no coincide, no se carga nada y se avisa: «No pudimos leer la planilla completa».
- **Si no es esa planilla** (otra app, o un PDF escaneado sin texto): «Este PDF no es una planilla que sepamos leer. Escríbenos por WhatsApp y te ayudamos».
- **Después:** las columnas ya se conocen, así que la pantalla **se salta «Mapear columnas»** y va directo a la revisión.

### 2. Deducir las condiciones

`lib/importar/deducir-condiciones.js` es una pieza aparte, sin nada de Crossbox. Se usa en `validarFila` cuando la fila trae capital, saldo y cuota pero **ni tasa ni plazo**.

1. **Sin abonos** (`sinAbonos: true`; una columna que no viene **no** cuenta como «sin abonos»):
   - el total es el saldo;
   - la tasa sale de saldo ÷ capital − 1;
   - las cuotas, de round(saldo ÷ cuota), con la cuota subida al peso si no divide exacto.
2. **Con abonos:**
   - Prueba tasas del 10 % al 60 %, en pasos de 10 y empezando por el 20 %. Se queda con las que dan un número entero de cuotas: `round(capital × (1 + tasa) ÷ cuota)`, con tolerancia de 1.000 pesos por cuota para las cuotas redondeadas.
   - Para cada una prueba frecuencia diaria, semanal, quincenal y mensual. Calcula las cuotas vencidas a la fecha de corte, y al día anterior, menos las pagadas (total − saldo ÷ cuota).
   - Gana la combinación que más se acerca a «Atrasadas».
   - Desempates: el 20 %, luego diario, luego lo que diga el nombre («Semanal», «Diario», «Mensual»).
3. **Cuadra** si la diferencia con «Atrasadas» es de 1 cuota o menos. La fila entra con un aviso: «Deducido: 20 % en 24 cuotas diarias; cuadra con sus 3 cuotas atrasadas».
4. **No cuadra** si ninguna combinación se acerca, o si los números no tienen sentido (cuota menor que capital ÷ 1.000, o capital menor que $10.000). La fila sale en **error**: «No pudimos deducir la tasa y las cuotas de este crédito: créalo a mano con tus datos». El resto se importa igual.
5. **El saldo siempre es el de la planilla.** Lo ya pagado es total − saldo, por el mismo camino que usa hoy el importador.

**Domingos, y en qué orden:** la frecuencia diaria de cada fila depende de si se cuentan los domingos, y eso se decide con la planilla entera. Por eso `validarCartera`, cuando hay filas que deducir:
1. Si la cuenta ya tiene `diasSinCobro`, usa ese.
2. Si no, deduce todas las filas de las dos maneras (con y sin domingos) y se queda con la que más filas hace cuadrar.
3. Con esa decisión llama a `validarFila` para cada fila.

La decisión va en la respuesta de validar como `sinDomingos: true|false`.

### 3. La pantalla y la importación

- **Arriba de la revisión**, un recuadro: «Leímos tu planilla de Crossbox: RUTA 1, corte al 24 sep 2026, 49 créditos. La tasa y las cuotas son deducidas: revisa los avisos».
- **Domingos:** si la planilla cuenta sin domingos y la cuenta no lo tiene configurado, sale una casilla **ya marcada**: «Tu planilla cuenta sin domingos: no cobro los domingos». Si la deja marcada, al importar se guarda `diasSinCobro = [0]` en su organización y queda en su Historial. Nunca se cambia sin esa casilla.
- **La ruta:** «Asignar a ruta» viene con «Crear ruta: RUTA 1» ya puesto (el nombre de la planilla), y lo puede cambiar.
- **Todo lo demás es la revisión e importación de hoy** (`validarCartera` / `importarCartera`): filas con aviso, filas en error y el botón que cuenta solo lo que se crea.

## Errores y casos límite

- **PDF escaneado** (sin texto): el mensaje de «no es una planilla que sepamos leer».
- **La cifra de control no cuadra:** no se carga nada; se avisa y se ofrece WhatsApp.
- **Fila con cuota de $0 o sin saldo:** error en esa fila, no en toda la planilla.
- **Clientes con el mismo nombre:** siguen el camino de hoy. Sin cédula, la cédula se genera con el nombre, así que dos filas con el mismo nombre son un cliente con dos créditos.
- **PDF grande:** los topes de 5 MB y 30 páginas responden con un mensaje, no con un error del servidor.

## Pruebas

- **Lector:** un fichero de prueba con el texto y las posiciones del PDF real, con nombres y teléfonos cambiados por inventados.
  - Tiene que leer 49 filas, cuadrar al peso con «Totales» y sacar la fecha de corte y la ruta.
  - Un texto de otro PDF tiene que dar `null`, y el mensaje claro.
- **Deducción:** las 49 filas reales, solo cifras.
  - Tienen que salir 45 deducidas y las 4 raras en error.
  - Casos concretos: 20 % en 24 diarias; 40 % en 4 mensuales; 60 % en 12 semanales; «Nunca» da total = saldo.
  - La planilla entera tiene que dar «sin domingos».
- **Ruta nueva:** la ruta de leer el PDF solo la usa el dueño y rechaza los archivos que no son PDF o pasan los topes.
- **De punta a punta, en el espejo:**
  - se sube el PDF real desde la pantalla, en la cuenta de prueba, a 412 px y en PC;
  - se importa y se comprueba en la base que los saldos cargados son los del PDF y que la casilla de domingos se guarda;
  - después se limpia.

## Despliegue

- Una tanda.
- Instalar `unpdf` (el despliegue corre `npm install`).
- Subir `CACHE_NAME`.
- No hay cambios en la base de datos.

## Fuera de alcance

- PDFs de otras apps.
- PDFs escaneados (fotos): para eso está el lector de cartulinas.
- Juntar automáticamente a la misma persona con dos créditos y nombres distintos.
- Cédulas: el PDF no las trae; se generan como hoy.
- Editar las condiciones deducidas dentro de la revisión: se corrigen en el préstamo después de importar.
