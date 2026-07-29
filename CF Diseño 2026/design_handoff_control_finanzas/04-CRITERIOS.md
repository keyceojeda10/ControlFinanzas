# 04 · Criterios de diseño

Esto es el **por qué**. Si implementas los componentes pero no estos criterios, la app
se verá parecida y se sentirá distinta. Cada criterio viene con la decisión concreta que
lo aplica en el rediseño.

---

## A · Jerarquía

### 1 · La plata es lo único que brilla
El dorado `#E7A400` se reserva para tres cosas: **el monto principal**, **la acción
primaria**, y **el foco del campo activo**. Nada más.

Consecuencias:
- El armazón de navegación es gris (excepto el botón +).
- El chip de filtro activo es negro, no dorado.
- Las 8 secciones de configuración usan iconos grises.
- Cuando una pantalla no tiene monto, no tiene nada dorado salvo su botón.

### 2 · Una pantalla, una respuesta
Cada pantalla tiene **una** cifra que es la razón por la que el usuario la abrió. Esa
cifra va en el bloque oscuro, a 33–52px. Todo lo demás baja al menos dos niveles de
tamaño.

Ejemplos:
| Pantalla | La respuesta |
|---|---|
| Panel | Patrimonio |
| Cobrar hoy | Cuánto falta por recaudar hoy |
| Ficha de préstamo | Saldo pendiente |
| Mi plata | Toda tu plata (caja + calle) |
| ¿Cómo va el negocio? | 7,8% al mes |
| Reportes | Lo que entró en el período |
| Cobros del mes | Lo esperado vs. lo que ya entró |

### 3 · El estado va en el acento, nunca en el fondo
Un estado (mora, atraso, al día) se comunica con: un **riel de 4px** a la izquierda de la
tarjeta, una **pastilla**, o el **color del relleno de la barra**. La superficie de la
tarjeta es siempre blanca.

Esto corrige el defecto principal del diseño actual: tarjetas teñidas de rosa, ámbar y
rojo formando un muro donde nada destaca.

### 4 · Dos niveles de información por fila, nunca tres
Nombre arriba. Contexto abajo. Si hace falta un tercer dato, o entra en la segunda línea
separado por `·`, o no entra.

---

## B · Números

### Formato
- Miles con **punto**: `$1.200.000`. (Configurable por país, pero es el default de CO.)
- Abreviado solo cuando el espacio obliga: `$25.1M`, `$4.5M`, `$811.334`.
  Nunca mezclar formatos en la misma tira de cifras.
- El símbolo `$` va pegado al número, sin espacio.
- Días de atraso en pastilla: `36d`. En texto corrido: "36 días de atraso".
- Porcentajes con coma decimal: `7,8%`, `16,5%`. Enteros sin decimal: `92%`.

### Reglas duras
1. **`font-variant-numeric: tabular-nums lining-nums` en todo número.** Sin excepción.
2. **Los números tienen que cuadrar.** Si una tabla muestra un subtotal, la suma de sus
   filas visibles + el truncado declarado tiene que dar ese subtotal. Un usuario que
   suma y no llega deja de confiar en la app entera.
3. **Todo truncado se declara.** "Ves 10 de los 17 · faltan 7 por $4.826.336", no
   "Ver todos".
4. **Toda cifra derivada dice de qué se deriva.** "$130.500 de $435.000 · cuota 22 de 30".
5. **Nunca una resta que mienta.** El caso real: "Balance neto = cobrado − prestado −
   gastos" daba −$17.6M en rojo para un negocio sano. Prestar no es gastar. Si una
   fórmula puede dar rojo en un caso bueno, la fórmula está mal.

### Gramática de cifras del día
Cuando una pantalla resume un día de cobro, el orden es:
```
1 · Recaudado (lo que ya entró)      ← grande
2 · Falta (lo que queda por cobrar)  ← al lado, mediano
3 · Los cobrados, colapsados en una línea con su total
```
Nunca al revés. Lo primero que quiere saber el cobrador es cuánto lleva.

---

## C · Copy

### Voz
Español colombiano, coloquial, en segunda persona. **El idioma del prestamista, no el
del software.**

| No | Sí |
|---|---|
| Gestionar suscripción | Pagar $39.000 |
| Modo estricto | No prestar sin tener con qué |
| Balance neto | Toda tu plata |
| Capital disponible | Lista para prestar |
| Cartera activa | En la calle, cobrándose |
| Registrar movimiento | Meto plata / Saco plata |
| Desembolsar | Le doy plata |
| Registrar pago | Me paga |
| Ajuste manual | Cuadrar el saldo |
| Préstamos irrecuperables | Clavos |
| Sin resultados | Está escrito distinto |
| ROI mensual | Por cada $100 en la calle, ganas $8 neto |

### Términos del gremio que se conservan tal cual
**Clavos** (préstamos perdidos) · **cuota** · **abono** · **ruta** · **cobrador** ·
**cartera** · **la calle** (el dinero prestado) · **cuadre** · **corte**.

### Reglas de copy
1. **Los títulos de campo son preguntas**: "Cuánto le vas a prestar", "Cuánto te dio",
   "Cada cuánto le cobras".
2. **Los botones dicen la acción con su cifra**: "Aplicar $15.000", "Guardar 14 cuotas",
   "Meter $3.000.000", "Ver los 7 cobros de hoy".
3. **Los avisos dicen la consecuencia, no la categoría**: "Si se vence sigues cobrando y
   registrando pagos normal. Lo que se bloquea es crear préstamos nuevos."
4. **Los estados vacíos dicen qué hacer**, nunca "no hay datos".
5. **Los errores dicen de quién es la culpa, si se perdió algo, y qué se puede seguir
   haciendo.** En ese orden.
6. **El texto y el gráfico cuentan la misma historia.** Si el gráfico muestra ámbar en
   marzo, el texto no puede decir "pagaba bien hasta mayo".
7. Cuando la app se dirige al **cliente final** (portal, recibos, pagaré), habla del
   prestamista por su nombre: "pregúntale a Don Carlos", "Prestamos Castro". El cliente
   no conoce "Control Finanzas".

---

## D · Flujo

### 1 · Toda pantalla de cobro tiene salida hacia adelante
La confirmación de un pago no dice "Listo". Dice **"Cobrar y pasar al siguiente"**, y en
la pantalla de éxito la acción dorada es **el nombre del siguiente cliente**. En la calle
el cobro no termina: sigue.

### 2 · Nunca se bloquea la plata que entra
Cuando el plan se excede o se vence, se bloquea **crear** préstamos y clientes.
**Registrar pagos siempre funciona**, y la pantalla lo dice explícitamente con una lista
de lo que sigue disponible. Un prestamista al que le corten el cobro pierde plata ese día
y se va.

### 3 · Ninguna pantalla es un callejón
- El simulador termina en **"Crear este préstamo"** con los datos prellenados.
- La búsqueda vacía ofrece **crear el cliente con el nombre ya escrito**.
- El error de servidor ofrece **seguir cobrando**.
- El plan excedido ofrece **seguir cobrando sin crear el cliente**.

### 4 · Todo lo que cambia plata muestra "antes → después"
Antes de confirmar: recargo, descuento, modificar plazo, cerrar anticipado, mover a
perdidos, mover capital. Sin excepción.

### 5 · Se empieza por la intención, no por el número
Nadie piensa "quiero 14 cuotas". Piensa "quiero bajarle la cuota". Los modales que
cambian condiciones preguntan primero **qué quiere lograr** y luego ajustan el número.

### 6 · La acción destructiva nunca es la dorada
En "mover a perdidos", el dorado va en *seguir cobrando*. Lo destructivo va en contorno
rojo, y antes se muestra lo que se intentó (cuándo se le escribió, cuándo se le visitó) y
una alternativa (proponer un acuerdo).

### 7 · Lo peligroso se separa de lo cotidiano
En "editar préstamo", los campos que recalculan pagos hacia atrás van arriba, marcados
uno por uno; los que se tocan sin miedo van abajo. Un formulario plano donde el monto y
la nota interna valen lo mismo es una trampa.

### 8 · El wizard existe porque el teléfono es pequeño
En escritorio no hay wizard: los tres pasos van a la izquierda y **el resultado se
recalcula a la derecha con cada tecla**. Nunca se replica un flujo por pasos en 1440 si
todo cabe a la vez.

### 9 · Una sola barra de progreso
Nunca dos indicadores simultáneos ("Paso 2 de 3" + "Paso 1 de 5"). Un flujo, una espina,
de principio a fin. El registro y el onboarding comparten la misma.

### 10 · La configuración es trabajo de escritorio
Escribir plantillas con teclado se hace sentado. En móvil solo se **eligen y se envían**.

---

## E · Cómo se decide qué se muestra

### La app dice cuándo no está segura
El migrador OCR no rellena y calla: cuando las cuentas de la libreta no cuadran, lo dice
en el idioma del dueño, **sin hablar de confianza ni porcentajes**, y ofrece "saltar por
ahora" para que un dato dudoso no frene toda la migración.

### Los registros agrupan y señalan
Un historial no lista: **hace notar**. Siete ediciones idénticas seguidas se colapsan en
una fila con su rango de horas y un "ver los 7", y un panel aparte dice lo que un humano
diría: *"el mismo préstamo cambió de día de cobro 11 veces en dos noches, siempre al
mismo valor"*.

### Los agujeros se muestran como agujeros
Una ruta con clientes y sin cobrador, o préstamos sin ruta, no son una fila más de la
tabla: se separan con su propio fondo al pie, porque no son una categoría — son un
problema. "Sin ruta · 3 préstamos rindiendo al 1%" contra el 16% de las buenas.

### Los conteos se comparan contra algo
Un total solo no dice nada. `$11.468.436` esperado va siempre al lado de `$8.838.907`
que ya entró y `$2.629.529` que falta.

---

## F · Accesibilidad y realidad de campo

1. **Objetivo táctil mínimo 44px.** Los botones de cobro son de 52–56px porque se pulsan
   de pie, con una mano, a veces con guantes.
2. **Contraste**: el tema claro es el default porque la hora pico de cobro es **17:00**,
   bajo sol. El oscuro es para el 23% de cobros nocturnos.
3. **Texto mínimo 10px** y solo para etiquetas en mayúsculas con `letter-spacing`. El
   cuerpo nunca baja de 12px.
4. **Nada depende solo del color**: cada estado tiene además una palabra ("Al día",
   "36d") o una posición.
5. **La app funciona sin señal.** El estado de sincronización es visible siempre (punto
   verde en el avatar, pastilla "Conectado" en la hoja de cuenta) y el error de servidor
   cuenta lo guardado sin subir, con su monto.

---

## G · Errores de maquetación que este rediseño ya encontró (evítalos)

Estos salieron una y otra vez durante el diseño. Son la causa raíz del 90% de los
defectos visuales:

1. **Una barra de progreso como único hijo encogible de un contenedor fijo** → absorbe el
   déficit y colapsa a 0px. Ponle `flex:none`.
2. **Una tarjeta o fila con `flex:1;min-height:0` dentro de una columna saturada** →
   absorbe todo el déficit, se aplasta, y su texto de altura fija se sale del
   `overflow:hidden`. Las filas de contenido son siempre `flex:none`; el único
   encogible permitido es un `<div>` espaciador vacío.
3. **Barras de gráfico con `height:%` dentro de un contenedor `flex:1`** → si el
   contenedor colapsa, el gráfico desaparece. Dale `height` explícito en px.
4. **Un número pegado a una barra en la misma celda de tabla** → deja 18px.
5. **Una pastilla en la misma fila que un nombre largo** → le roba ~51px y el nombre se
   corta. Baja la pastilla a la segunda línea.
6. **Listas sin espacio reservado para la barra de acción** → la última tarjeta queda
   debajo del botón. Añade `padding-bottom` igual a la altura de la barra.
