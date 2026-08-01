# Adenda 2 · el menú del + y Lucas

> **Se suma al paquete `design_handoff_control_finanzas/` y a `06-ADENDA-modos-sin-tabla.md`.
> No reemplaza a ninguno de los dos.**
> Mismos tokens (`01-TOKENS.md`), mismos componentes (`03-COMPONENTES.md`), mismos criterios
> (`04-CRITERIOS.md`).
>
> Referencia visual: **`NUEVO-turnos-41-42-43.dc.html`** (ábrelo en el navegador; `support.js`
> tiene que estar en la misma carpeta).

---

## Índice de lo que cubre este archivo

| Turno | Pantalla | Estado |
|---|---|---|
| 41 · 01 | Ficha `fijo` | ver `06-ADENDA` §1 |
| 41 · 02 | Ficha `unico` | ver `06-ADENDA` §2 |
| 41 · 03 | Pantalla "Más" | ver `06-ADENDA` §5 |
| **42 · 01** | **Ficha `manual`** | **§1 de este archivo** |
| **42 · 02** | **Ficha `proporcional`** | **§2** |
| **42 · 03** | **Ficha de préstamo por defecto en 1440** | **§3** |
| **43 · 01** | **El menú del +** | **§4** |
| **43 · 02** | **Lucas contestando** | **§5** |
| **43 · 03** | **Lucas vacío** | **§6** |
| **43 · 04** | **Lucas en 1440** | **§7** |

Con esto, **los 8 modos de interés tienen pantalla** y no queda nada por derivar.

---

## 1 · Ficha `manual` (10,6%)

Turno 42 · pantalla 01. **Estructura idéntica a la ficha `fijo`** (`06-ADENDA` §1), con dos
diferencias.

### La cuota la puso el dueño, y eso se marca

Dentro de la tarjeta "cómo se pactó", entre el trato y el resumen, va una **pastilla ámbar**:

```css
display: flex; align-items: center; gap: 9px;
padding: 9px 12px;
border-radius: 11px;
background: #FDF3D6;
border: 1px solid rgba(231,164,0,.28);
/* icono lápiz 15px trazo 2 #B07D00 */
/* texto 13px/600 #7A5800 */
```

Contenido: **"Cuota que le pusiste: $25.000"**.

El verbo hace el trabajo: reconoce que esa cifra la decidió él, no el sistema. En `fijo` la
cuota sale del total y el plazo; aquí es al revés.

### El plazo se deja feo

```
Le presté $800.000, me paga $960.000
[pastilla] Cuota que le pusiste: $25.000
Le alcanza para 39 semanas · tu ganancia $160.000
```

**No redondees "39 semanas" a 40.** El dueño va a cobrar 39 veces y la cuarenta sería por
otro valor. Un plazo redondeado es un plazo mentiroso, y la app pierde la única cosa que la
hace útil: que sus números cuadran.

Lo mismo con "le faltan 24 cuotas": sale de `ceil(saldoPendiente / cuota)`, no de una tabla.
Si el número es feo, es feo.

---

## 2 · Ficha `proporcional` (9,8%)

Turno 42 · pantalla 02. Estructura de `fijo`, con **una sola diferencia** — y es la única
excepción a una regla del paquete.

### Aquí sí se muestra el porcentaje

Dentro de "cómo se pactó", debajo del trato y separado por un `border-top`:

```
20%   al mes, repartido sobre 45 días — de ahí sale el total
↑     ↑
Space Grotesk 17px/600 #B07D00      12px/1.4 #4A4E57
```

**Por qué es la excepción:** en `fijo`, `unico` y `manual` el dueño pactó un total redondo
que él eligió, y traducirlo a tasa le dice algo que nunca pensó. En `proporcional` el total
**no es redondo** —$690.000— porque salió de una regla de tres. Sin ver "20% al mes sobre 45
días", esa cifra parece arbitraria.

### El color del atraso responde a la frecuencia

3 días de atraso en un préstamo quincenal va en **ámbar, no rojo**, y el pie del historial lo
dice en palabras:

```css
/* pie del historial */
padding: 12px 18px;
border-top: 1px solid rgba(20,20,28,.06);
background: #FDF9EE;
/* icono 15px #B07D00 + texto 12px/1.4 #7A5800 */
```
→ **"Le vence una cuota hace 3 días"**

Tres días no es lo mismo en diario que en quincenal. El color tiene que decir eso, y el
número solo no lo dice.

---

## 3 · Ficha de préstamo por defecto en 1440

Turno 42 · pantalla 03. Marco `1440×820`.

Misma arquitectura que la ficha con tabla en escritorio (turno 11 del paquete original):
cabecera con migaja + título + acciones, columna izquierda `flex:1.5`, panel derecho de
`312px`. **Dos sustituciones:**

### La tabla es de historial, no de amortización

Columnas: `Fecha (96px) · Tipo (flex 1.2) · Medio (flex 1) · Cobrador (flex 1) · Monto (flex
1, derecha) · **Le quedó** (flex 1, derecha)`.

La última columna se llama **"Le quedó"**, no "Saldo". Es la palabra que usa el prestamista
cuando el cliente reclama, y es exactamente para eso que se abre esta tabla.

### El bloque negro del panel derecho dice "cómo se pactó"

No repite el saldo —ya está arriba, a 38px—. Dice el trato en una frase:

```
CÓMO SE PACTÓ
Le presté $500.000, me paga $600.000
─────────────────────────────────────
30 cuotas diarias · sin tabla de amortización
```

Esa última nota —**"sin tabla de amortización"**— le ahorra al dueño buscar un desglose que
no existe, y al desarrollador preguntarse si falta algo.

### La tira de cifras en escritorio son cinco

`Le presté · Me paga · Cuota · En mora · Tu ganancia`. En móvil son tres; el ancho permite dos
más. Nunca más de cinco.

---

## 4 · El menú del + (solo móvil)

Turno 43 · pantalla 01. **No existe en escritorio**: ahí esa acción vive en el botón dorado
de cada pantalla.

### El lienzo es dorado a pantalla completa

```css
width: 390px; height: 844px;
background: #E7A400;
color: #3A2900;
```

Es la única pantalla del sistema con el dorado como superficie. Se justifica porque es el
momento en que la app pregunta, y porque **es la pantalla más frecuente después del panel**.
La barra de estado se pinta en `#3A2900`.

### Las nueve opciones van agrupadas por lo que le pasa a la plata

```
¿Qué vas a hacer?               ← Space Grotesk 24px/600 #3A2900
martes 28 · 7:14 a. m.          ← 12px rgba(58,41,0,.62)

ENTRA PLATA                     ← 10px/700 .11em uppercase rgba(58,41,0,.55)
  Registrar un pago    · te faltan 5 cobros de hoy     [62px, icono en #FDF3D6]
  Escanear un QR                                        [56px, icono en #F3F3EF]

SALE PLATA
  Prestarle a alguien  · tienes $2.5M para prestar     [62px, icono en #FDF3D6]
  Anotar un gasto                                       [56px]

CREAR
  Un cliente nuevo                                      [54px]

IR A                            ← rejilla 2×2, filas de 52px
  Cobrar hoy · 5 pendientes     |  La caja · sin cerrar
  Mi plata · $2.5M libres       |  Mi plan · vence en 5 días

  Preguntarle a Lucas                                   [66px, tarjeta aparte]
  "¿cuánto recaudé esta semana?"
```

**Tarjetas:** `background: rgba(255,255,255,.92)`, `border-radius: 18px`, sin borde (el
contraste con el dorado ya separa). Filas separadas por
`border-top: 1px solid rgba(20,20,28,.07)`.

**Iconos:** contenedor de `36–38px`, `border-radius: 11–12px`. El de la **acción destacada de
cada grupo** va en `#FDF3D6` con el trazo en `#B07D00`; los demás en `#F3F3EF` con `#4A4E57`.

### Las tres reglas de este menú

1. **Los destinos se ven distintos de las acciones.** "Ir a" es una rejilla de dos columnas,
   filas más bajas y **sin flecha**. Una acción hace algo; un destino solo lleva. Si se ven
   iguales, el usuario los trata igual.
2. **Cada opción trae su cifra.** "5 pendientes", "$2.5M libres", "vence en 5 días", "sin
   cerrar". Con la cifra al lado, el menú se vuelve un panel y el dueño decide sin entrar.
   Mismo criterio que la pantalla "Más".
3. **Lucas es una tarjeta blanca como las demás**, con el icono en `#FDF3D6`. Va al pie y
   separada, porque no es una acción: es otra forma de usar la app.
   ⚠️ **No le pongas un círculo oscuro sobre el dorado.** Se lee como un parche: dos oscuros
   distintos peleando en el mismo fondo.

### El cierre

El FAB se convierte en el botón de cerrar, **en el mismo sitio**:

```css
position: absolute; right: 22px; bottom: 22px;
width: 62px; height: 62px; aspect-ratio: 1;
border-radius: 999px;
background: #15161A;
box-shadow: 0 6px 20px rgba(58,41,0,.32);
/* icono ✕ 24px trazo 2.6 #F5B824 */
```

---

## 5 · Lucas contestando — **la decisión más importante de este archivo**

Turno 43 · pantalla 02.

> **Lucas contesta con los componentes de la app, no con párrafos.**

Una frase corta arriba, y debajo **el mismo bloque negro** que ya existe en la pantalla donde
ese dato vive. Ejemplo real, para "¿cuánto estoy ganando realmente?":

```
[burbuja del usuario: fondo #15161A, radio 16 16 4 16, texto #F3F3F6]
  ¿Cuánto estoy ganando realmente?

Este mes te queda $2.161.331 limpio, después de gastos.   ← 14px/1.5, plano

[BLOQUE NEGRO — idéntico al de "¿Cómo va el negocio?"]
  LO QUE RINDE TU CAPITAL
  7,8%  al mes                          ← 34px/600 #2FBE6A
  Por cada $100 en la calle, ganas $8 neto.
  ─────────────────────────────────────
  RECAUDADO $8.8M | GASTOS $10.000 | EN LA CALLE $27.6M

[Ver la pantalla]  [Bajar en PDF]        ← chips blancos de 38px
```

**Por qué importa:** un chatbot que escribe "tu ROI mensual es del 7,8%" obliga a creerle. Uno
que muestra el bloque real deja ver de dónde sale, y **"Ver la pantalla" lleva al sitio donde
el dato vive** — Lucas no reemplaza la app, la navega.

### Cuando la respuesta es una lista, devuelve tarjetas

Para "¿quién me debe más?", Lucas devuelve **las mismas tarjetas con riel de estado** de la
lista de clientes: riel de `3px` a la izquierda, nombre en `14px/700`, días de atraso debajo,
monto a la derecha en Space Grotesk. Se leen igual, se tocan igual.

Y las acciones que ofrece son **las de la app**, no del chat: "Escribirles", "Ver los 31".

### Dos detalles del cuerpo

- **Bajar en PDF** aparece en toda respuesta con cifras: la mitad de estas preguntas terminan
  en algo que el dueño le manda al contador.
- Debajo de la respuesta, **las dos preguntas que siguen a esa**, no las cinco iniciales. Quien
  pregunta por su ganancia va a querer saber qué ruta le rinde menos.

### El pie

```
Lucas se puede equivocar. Los números salen de tu app.
```

En vez del genérico "puede cometer errores". La segunda frase es la que de verdad tranquiliza
a alguien que va a tomar una decisión de plata.

---

## 6 · Lucas vacío

Turno 43 · pantalla 03. Hoja inferior estándar (`03-COMPONENTES.md` §10): velo
`rgba(20,20,28,.45)`, asa de 38px, radio `22px 22px 0 0`.

### Cabecera

```
[icono 38px: #E7A400 con border 2px #F5C518, chispa en #3A2900]
Lucas                          ← Space Grotesk 18px/600
sabe todo de tu negocio        ← 11px #63676F
                                              [editar 36px] [cerrar 36px]
```

### Las sugerencias van en dos grupos

**Este es el cambio de fondo.** La app promete "pídeme que haga algo" y luego solo ofrece
preguntas, así que el usuario nunca descubre que Lucas actúa.

```
LO QUE MÁS TE PREGUNTAS          ← tarjeta blanca, filas de 54px
  ¿Cuánto estoy ganando de verdad?     [icono en #FDF3D6]
  ¿Quién me debe más?
  ¿Me alcanza para prestar más?

COSAS QUE PUEDO HACER POR TI
  Recordarles a los 13 en mora         [icono WhatsApp #25D366]
  Armarme el reporte del mes
```

Tres preguntas, no cinco: cinco pastillas grises iguales se leen como un formulario. Y cada
una con **icono de 30px**, para que se distingan de un campo de texto.

Las acciones traen **la cifra real** ("los 13 en mora"), que es lo que enseña la capacidad.

### Lo que se quita

⚠️ **Fuera el contador "200 de 200".** Doscientos de qué: no significa nada para un
prestamista, y poner un contador de cuota en la primera pantalla dice "esto se te va a acabar"
antes de que vea para qué sirve. Va en **Plan y pagos**, y solo aparece aquí **cuando queda
poco** (por debajo del 15%), como pastilla ámbar.

### El botón de enviar arranca apagado

```css
/* sin texto escrito */
background: #F3F3EF;
border: 1px solid rgba(20,20,28,.07);
/* icono en #8E929A */

/* con texto */
background: #E7A400;
/* icono en #3A2900 */
```

Un botón dorado sin nada que enviar es una promesa vacía — y rompe la regla de un solo dorado
por pantalla.

---

## 7 · Lucas en 1440

Turno 43 · pantalla 04. Marco `1440×800`.

> **En escritorio Lucas no es una hoja que tapa la pantalla: es una columna de 396px al lado.**

```
┌──────────┬───────────────────────────┬──────────────────┐
│ sidebar  │  Panel                    │  Lucas           │
│ 230px    │  patrimonio + atención    │  396px           │
│          │  flex:1                   │  flex:none       │
└──────────┴───────────────────────────┴──────────────────┘
```

El panel de Lucas:

```css
width: 396px; flex: none;
background: #FFF;
border: 1px solid rgba(20,20,28,.09);
border-radius: 20px;
box-shadow: 0 4px 20px rgba(20,20,28,.06);
display: flex; flex-direction: column; overflow: hidden;
```

**Por qué al lado y no encima:** el dueño quiere preguntar algo *mientras* mira sus números.
Taparle el panel para contestarle le quita el contexto que le da sentido a la respuesta.

Estructura interna igual que en móvil: cabecera con borde inferior, cuerpo `flex:1` con
`overflow:hidden`, y el compositor al pie con `border-top`. El pie se acorta a **"Los números
salen de tu app."**

---

## 8 · Resumen para el agente

```
FICHAS DE PRÉSTAMO (ver también 06-ADENDA)
  `fijo`         → ficha por defecto. Constrúyela PRIMERO.
  `unico`        → sin barra de progreso, con fecha de vencimiento.
  `manual`       → ficha `fijo` + pastilla "cuota que le pusiste".
                   El plazo se deja feo: no redondear.
  `proporcional` → ficha `fijo` + el porcentaje con su explicación.
                   Es la ÚNICA excepción a "no mostrar tasas".
  con tabla      → variante para 4 modos que suman el 6,2%. DESPUÉS.
  escritorio     → historial en tabla, columna "Le quedó",
                   bloque negro = "cómo se pactó".

MENÚ DEL + (solo móvil)
  Dorado a pantalla completa. Nueve opciones en 4 grupos:
  entra plata / sale plata / crear / ir a.
  Los destinos = rejilla 2×2, más bajos, sin flecha.
  Cada opción con su cifra.
  Lucas = tarjeta blanca al pie. NUNCA círculo oscuro sobre dorado.

LUCAS
  Contesta con los componentes de la app, no con párrafos.
  Cifra → bloque negro + "Ver la pantalla" + "Bajar en PDF".
  Lista → tarjetas con riel de estado + acciones de la app.
  Vacío → dos grupos: preguntas y cosas que puede hacer.
  Fuera el "200 de 200" (va en Plan y pagos, y solo si queda poco).
  Enviar arranca gris; se enciende al escribir.
  Escritorio → columna de 396px al lado del panel, no encima.
  Pie → "Lucas se puede equivocar. Los números salen de tu app."
```
