# Cómo crear elementos nuevos

> **Este documento es para cuando NO hay un diseño que copiar.**
> Un botón nuevo, una sección nueva, un aviso que no existía.
>
> Los otros documentos dicen **qué existe**. Este dice **cómo se decide**.
> Léelo completo una vez. Después vuelve a las tablas de decisión.

---

## La regla que hace todo lo demás innecesario

> **Un elemento nuevo nunca se inventa: se compone de piezas que ya existen.**

No hay un solo elemento en las 146 pantallas de este sistema que sea original. Todos son
combinaciones de nueve piezas: contenedor, cifra, etiqueta, fila, pastilla, barra, botón,
separador, icono.

Cuando te pidan algo nuevo, **no diseñes**. Pregúntate:

1. ¿Qué contenedor es? (tarjeta / bloque oscuro / fila / aviso)
2. ¿Cuál es el dato más importante? → ese va grande
3. ¿Qué tipo de dato es? (cifra / texto / estado / acción)
4. ¿Cuántas acciones tiene? → decide el tipo de botón

Si tu respuesta a alguna de las cuatro es "ninguna de las opciones", **pregunta al usuario**. No
completes el hueco con criterio propio: es la única forma de romper el sistema.

---

## 1 · Voy a poner un BOTÓN

### Tabla de decisión

| ¿Qué hace? | Qué botón | Especificación |
|---|---|---|
| Es **la** acción de la pantalla (mueve plata, avanza el flujo) | **Primario dorado** | ver A |
| Es una acción secundaria de la misma pantalla | **Secundario blanco** | ver B |
| Destruye, anula o cancela algo | **Contorno rojo** | ver C |
| Solo lleva a otro sitio, o abre un detalle | **Textual dorado** | ver D |
| Es una de 3–4 acciones equivalentes sobre el mismo objeto | **Cuadrado con icono** | ver E |
| Es un icono solo (cerrar, atrás, menú) | **Botón de icono** | ver F |

### La pregunta que decide entre A y B

> **¿Si el usuario solo pudiera pulsar una cosa en esta pantalla, sería esta?**

Si sí → dorado. Si no → blanco. **Solo puede haber un dorado por pantalla.** Si te salen dos,
una de las dos no es primaria, o la pantalla está haciendo dos cosas y hay que partirla.

### A · Primario dorado
```css
height: 52px;                    /* 56px si es el remate de un flujo de cobro */
border: none; border-radius: 14px;
background: #E7A400;
color: #3A2900;                  /* NUNCA blanco sobre dorado */
font: 700 16px 'Manrope';
```
En escritorio: `height: 42px; padding: 0 18px; border-radius: 13px; font-size: 14px`.

**Su texto lleva la cifra cuando hay una:** `Aplicar $15.000`, `Repartir $1.240.000`,
`Cobrar y pasar al siguiente`. Nunca `Guardar`, `Aceptar`, `Continuar` a secas si hay un número
en juego.

### B · Secundario blanco
```css
height: 48px;                    /* 40px en escritorio */
background: #FFF;
border: 1px solid rgba(20,20,28,.11);
border-radius: 14px;
color: #15161A;                  /* #4A4E57 si es "Cancelar" */
font: 600 15px 'Manrope';
```

### C · Contorno rojo — destructivo
```css
background: #FFF;                /* NUNCA relleno rojo */
border: 1px solid rgba(229,72,77,.30);
color: #C23B40;
font-weight: 700;
```
**Y va acompañado de su consecuencia escrita**, en `11–12px #63676F`:
*"Se anula y no se cobra más"*, *"Saca $184.733 de tu cartera"*.

⚠️ En una pantalla donde la acción destructiva es la que el usuario venía a pulsar (mover a
perdidos, cerrar cuenta), **el dorado va en la acción NO destructiva** ("seguir cobrando") y la
destructiva queda en contorno rojo. El dorado protege, no empuja.

### D · Textual dorado
```css
/* sin fondo ni borde */
font: 700 13px 'Manrope';
color: #B07D00;
```
Para `Ver todos`, `Cambiar`, `Asignar`, `Editar`. Si necesita más de dos palabras, no es un
enlace: es un botón secundario.

### E · Cuadrado con icono — 3 o 4 acciones equivalentes
```css
/* fila con gap 9px, cada uno flex:1 */
height: 74px; border-radius: 16px;
background: #FFF; border: 1px solid rgba(20,20,28,.09);
display: flex; flex-direction: column;
align-items: center; justify-content: center; gap: 7px;
/* icono 20px · etiqueta 13px/700 #15161A */
```
**Una palabra por botón.** Si necesita subtítulo para entenderse, la acción no está clara y hay
que renombrarla, no explicarla.

### F · Botón de icono
```css
width: 40px; height: 40px; border-radius: 12px;
background: none;                /* o #FFF + border si necesita separarse del fondo */
/* icono 20px, trazo 1.9–2.2, color #4A4E57 */
```

---

## 2 · Voy a poner una SECCIÓN o un BLOQUE

### Tabla de decisión

| ¿Qué contiene? | Qué contenedor |
|---|---|
| La cifra que resuelve la pantalla | **Bloque oscuro** `#15161A` |
| La consecuencia de una acción antes de confirmarla | **Bloque oscuro** con *antes → después* |
| Datos agrupados, una lista, un formulario | **Tarjeta blanca** |
| Un dato de una línea con su acción | **Fila** dentro de una tarjeta |
| Algo que el usuario debe saber antes de seguir | **Aviso** (ámbar / rojo / neutro) |
| 2–5 cifras comparables del mismo objeto | **Tira de cifras** |

### Bloque oscuro
```css
background: #15161A; border-radius: 20px; padding: 19px 21px;
display: flex; flex-direction: column; gap: 14px;
```
**Máximo uno por pantalla.** Es el que dice la respuesta.

Su contenido, en orden:
```
ETIQUETA          10px/700 .1em uppercase #A3A8B2
$27.616.416       Space Grotesk 34px/600 -.035em #F3F3F6, tabular-nums
[barra 11px]      opcional
frase de apoyo    13px #A3A8B2
─────────────     1px rgba(255,255,255,.09)
[tira de cifras]  etiquetas #8A8E98 · valores #F3F3F6
```

⚠️ **Sobre fondo oscuro los colores cambian:** dorado `#F5B824`, verde `#2FBE6A`, rojo `#F0575C`.
Los del tema claro no tienen contraste suficiente sobre `#15161A`.

### Tarjeta blanca
```css
background: #FFF;
border: 1px solid rgba(20,20,28,.08);
border-radius: 18px;
padding: 16px 19px;
display: flex; flex-direction: column; gap: 12px;
flex: none;                      /* OBLIGATORIO */
```
**Sin sombra.** La separación la da el borde sobre el fondo hueso `#F4F4F1`.

### Fila dentro de una tarjeta
```css
height: 52–56px;                 /* 46px si es una lista densa */
padding: 0 18px;
border-top: 1px solid rgba(20,20,28,.06);   /* la primera fila NO lo lleva */
display: flex; align-items: center; gap: 12px;
flex: none;
```
Estructura: `[icono 30–34px] [texto flex:1] [dato o chevron 15px flex:none]`.

### Aviso
```css
/* ÁMBAR — atención, no error */
background: rgba(231,164,0,.07); border: 1px solid rgba(231,164,0,.28);
/* icono #B07D00 · texto #7A5800 */

/* ROJO — riesgo o dato que no cuadra */
background: rgba(229,72,77,.07); border: 1px solid rgba(229,72,77,.22);
/* icono #E5484D · texto #A8353A */

/* NEUTRO — explicación */
background: #FFF; border: 1px solid rgba(20,20,28,.08);
/* icono #63676F · texto #4A4E57 */

/* común */
border-radius: 14–18px; padding: 14px 16px;
display: flex; gap: 10px; align-items: flex-start;
/* icono 16px flex:none margin-top:1px · texto 12–13px/1.45 */
```
**Un solo aviso de bloque por pantalla.** Si hay dos, uno es una fila normal.

⚠️ **Nunca un aviso con ✕ para cerrar.** Si se puede cerrar, no importaba. Y si importa, se
resuelve o no se muestra.

### Tira de cifras
```css
/* contenedor */
display: flex; gap: 8px;
/* cada columna */
flex: 1; display: flex; flex-direction: column; gap: 4px;
/* separador entre columnas */
width: 1px; background: rgba(20,20,28,.07);

/* etiqueta */ 10px/700 .06em uppercase #63676F
/* valor */    Space Grotesk 14–19px/600, tabular-nums lining-nums
               #15161A neutro · #0D7A3C a favor · #C23B40 en contra
```
**Máximo 4 columnas en móvil, 5 en escritorio.** Con más, no se leen.

---

## 3 · Voy a mostrar un DATO

### Si es dinero, una cantidad o una fecha
```css
font-family: 'Space Grotesk';
font-weight: 600;
font-variant-numeric: tabular-nums lining-nums;   /* SIEMPRE, sin excepción */
```

Tamaño según su papel, y el `letter-spacing` va con el tamaño:

| Papel | Tamaño | letter-spacing |
|---|---|---|
| La respuesta de la pantalla (bloque oscuro) | 33–38px | `-.035em` |
| Monto de una tarjeta | 22–27px | `-.03em` |
| Monto de una fila o tira | 14–19px | `-.02em` |

Formato: miles con punto (`$1.200.000`), abreviado solo si el espacio obliga (`$25.1M`),
porcentajes con coma (`7,8%`), días en pastilla como `36d`.

### Si es texto
| Qué es | Especificación |
|---|---|
| Nombre en una tarjeta de lista | Manrope 16px/700, `-.015em` |
| Texto de fila | Manrope 14px/600 |
| Descripción o apoyo | Manrope 13px/400–500, `line-height:1.45–1.55` |
| Metadato, segunda línea | Manrope 11–12px, `#63676F` |
| Etiqueta de sección | Manrope 10–11px/700, `.09–.1em`, uppercase, `#63676F` |

### Si es un estado
**Nunca tiñas el fondo de la tarjeta.** Tres portadores, y solo tres:

1. **Riel** de 4px a la izquierda de la tarjeta
   ```css
   position: absolute; left: 0; top: 14px; bottom: 14px;
   width: 4px; border-radius: 999px;
   ```
2. **Pastilla** de 20–24px (colores en `03-COMPONENTES.md` §4)
3. **El color del relleno** de una barra de progreso

Y siempre acompañado de **una palabra o un número**: `Al día`, `36d`. Nada depende solo del
color.

---

## 4 · Lo que NUNCA se hace

Esta lista es la que evita las "locuras". Si tu elemento nuevo cae en alguna, está mal por
definición y no hace falta discutirlo.

| ❌ Nunca | Por qué |
|---|---|
| Dos botones dorados en una pantalla | Si hay dos primarias, ninguna lo es |
| Blanco sobre dorado | No hay contraste. El texto sobre `#E7A400` es `#3A2900` |
| Verde como color de acción | El verde significa *al día, pagado*. Usarlo para "toca aquí" rompe la lectura |
| Fondo de tarjeta teñido por estado | Con 30 tarjetas en pantalla, nada destaca. Es el defecto principal del diseño viejo |
| Un número sin `tabular-nums` | Las columnas bailan al actualizarse |
| Una fila o tarjeta con `flex: 1` | Absorbe el déficit, se aplasta, y su texto se sale del recorte |
| Una barra de progreso sin `flex: none` | Colapsa a 0px y desaparece el estado |
| Barras de gráfico en `%` dentro de un contenedor `flex:1` | Si el contenedor colapsa, el gráfico desaparece. Altura explícita en px |
| Un `<input type="date">` o cualquier control nativo del navegador | Cambia de aspecto en cada sistema operativo. Se diseña |
| Un aviso con ✕ para cerrar | Si se puede cerrar, no importaba |
| Un color que no esté en `01-TOKENS.md` | No hay grises "casi iguales": hay cuatro y son suficientes |
| Una tercera familia tipográfica | Space Grotesk para números y títulos, Manrope para todo lo demás. Nada más |
| Una sombra en una tarjeta que no flota | Solo llevan sombra hojas, modales y lo que está sobre un mapa |
| Emoji | El sistema no usa ninguno |
| Un dato que el sistema no guarda | Inventar el reparto de un interés, redondear un plazo feo, mostrar un % que no es el real |
| Repetir el mismo dato en dos elementos de la misma pantalla | "Préstamo #3" en un chip y en una tarjeta. Uno de los dos sobra |
| Texto por debajo de 12px que no sea una etiqueta en mayúsculas | No se lee de pie, en la calle |
| Un objetivo táctil menor de 44px | Se usa con una mano y a veces con guantes |

---

## 5 · Cómo se escribe el texto de un elemento nuevo

Español colombiano, coloquial, segunda persona. **El idioma del prestamista, no el del
software.**

| ❌ | ✅ |
|---|---|
| Gestionar suscripción | Pagar $39.000 |
| Balance neto | Toda tu plata |
| Capital disponible | Lista para prestar |
| Cartera activa | En la calle, cobrándose |
| Registrar movimiento | Meto plata / Saco plata |
| ROI mensual | Por cada $100 en la calle, ganas $8 neto |
| Sin resultados | Está escrito distinto |
| Cliente recurrente | Es su tercer préstamo contigo |

### Cinco reglas
1. **Los títulos de campo son preguntas**: *"Cuánto le vas a prestar"*, *"Cuánto te dio"*.
2. **Los botones dicen la acción con su cifra**: *"Aplicar $15.000"*.
3. **Los avisos dicen la consecuencia, no la categoría**: *"Si se vence sigues cobrando; lo que
   se bloquea es crear préstamos nuevos"*.
4. **Los estados vacíos dicen qué hacer**, nunca "no hay datos".
5. **El texto y el gráfico cuentan la misma historia.** Si el gráfico muestra ámbar en marzo, el
   texto no puede decir "iba bien hasta mayo".

### Términos del gremio que se conservan tal cual
**clavos** (préstamos perdidos) · **cuota** · **abono** · **ruta** · **cobrador** · **cartera** ·
**la calle** · **cuadre** · **corte**.

---

## 6 · Los cuatro criterios de jerarquía

Cuando tengas que decidir qué va grande y qué va chico:

1. **La plata es lo único que brilla.** El dorado se reserva para el monto principal, la acción
   primaria y el foco del campo activo.
2. **Una pantalla, una respuesta.** Hay *una* cifra que es la razón por la que el usuario abrió
   esa pantalla. Va en el bloque oscuro, a 33–38px. Todo lo demás baja dos niveles.
3. **El estado va en el acento, nunca en el fondo.**
4. **Dos niveles de información por fila, nunca tres.** Nombre arriba, contexto abajo. Si hace
   falta un tercer dato, entra en la segunda línea separado por `·`, o no entra.

---

## 7 · Checklist antes de decir que terminaste

Revisa las doce. Si alguna falla, el elemento no está listo.

```
□  1. ¿Hay exactamente UN dorado, o ninguno?
□  2. ¿Todos los números llevan tabular-nums lining-nums?
□  3. ¿Todas las filas y tarjetas son flex:none?
□  4. ¿Las barras de progreso llevan flex:none?
□  5. ¿Los gráficos con % tienen contenedor de altura explícita?
□  6. ¿El estado va en riel, pastilla o barra — nunca en el fondo?
□  7. ¿Cada color sale de 01-TOKENS.md?
□  8. ¿Solo hay Space Grotesk (números, títulos) y Manrope (el resto)?
□  9. ¿El texto está en el idioma del prestamista, no del software?
□ 10. ¿Los botones dicen su cifra cuando hay una?
□ 11. ¿Ningún dato se repite en dos elementos de la misma pantalla?
□ 12. ¿Todos los objetivos táctiles miden 44px o más?
```

Y la que vale más que las doce:

```
□  ¿Estoy mostrando algún dato que el sistema no guarda de verdad?
```

Si la respuesta es sí, quítalo. Un número inventado es peor que un hueco: el hueco se nota, el
número falso se cree.

---

## 8 · Cuando de verdad no sabes

**Pregunta.** El sistema tiene 146 pantallas diseñadas y nueve documentos: si algo no aparece
en ninguno, no es que se te haya escapado — es que no se decidió.

Formula la pregunta así, y quien te responda podrá decidir en un minuto:

```
Necesito [elemento] en [pantalla].
Lo que hace: [una frase].
Lo más parecido que encontré en el sistema es [referencia].
Mi propuesta: [contenedor] + [dato principal] + [acción].
Lo que no sé decidir: [la duda concreta].
```

Eso es mejor que inventarlo bien.
