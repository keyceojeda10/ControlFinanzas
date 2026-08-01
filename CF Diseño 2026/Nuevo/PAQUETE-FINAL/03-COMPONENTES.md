# 03 · Componentes

Receta exacta de cada pieza. Todo está en CSS plano para que puedas traducirlo a tu
sistema de componentes sin ambigüedad.

---

## 1 · Tarjeta estándar

La pieza más usada del sistema.

```css
background: #FFFFFF;
border: 1px solid rgba(20,20,28,.08);
border-radius: 18px;
padding: 16px 19px;          /* vertical 16–20, horizontal 19–22 */
display: flex; flex-direction: column; gap: 12px;
```

**Sin sombra.** La separación la da el borde de 1px sobre el fondo hueso. Solo llevan
sombra los elementos que de verdad flotan (hojas, modales, tarjetas sobre un mapa).

### Sub-filas dentro de una tarjeta
Separadas por `border-top: 1px solid rgba(20,20,28,.06)`, con `padding: 12px 19px` y
altura de `46–56px`. La primera fila no lleva borde superior.

---

## 2 · Bloque oscuro — "la respuesta"

**Cuándo se usa:** cuando la pantalla tiene *una* cifra que es la respuesta a la pregunta
del usuario, o cuando hay que mostrar la consecuencia de una acción antes de confirmarla.
Máximo **uno por pantalla**.

```css
background: #15161A;
border-radius: 20px;
padding: 19px 21px;          /* 24–30px en escritorio */
display: flex; flex-direction: column; gap: 14px;
```

### Contenido canónico
```
1 · Etiqueta:  10px/700, letter-spacing .1em, uppercase, color #A3A8B2
2 · Cifra:     Space Grotesk 33–38px/600, letter-spacing -.035em,
               line-height 1, color #F3F3F6, tabular-nums lining-nums
               (dorada #F5B824 si es "lo que ganas"; verde #2FBE6A si es "a favor")
3 · Barra partida (opcional):  height 11–14px, border-radius 999px, overflow hidden
4 · Separador: height 1px, background rgba(255,255,255,.09)
5 · Tira de cifras: 2–5 columnas flex:1 separadas por spans de 1px
       etiqueta 10px/700 .06em uppercase #8A8E98
       valor    Space Grotesk 15–17px/600 #F3F3F6, tabular-nums
```

### Variante "antes → después"
Obligatoria en **todo modal que cambie plata**.
```
[etiqueta "ANTES → DESPUÉS"]
[columna izquierda]         [flecha]         [columna derecha]
 "Próxima cuota"            17px dorada       "ahora"
 $14.500 tachado                              $29.500
 17px/600 #8A8E98                             20–22px/600
 text-decoration:line-through                 #2FBE6A (mejora)
                                              #F0575C (empeora)
                                              #F3F3F6 (neutro)
[separador]
[fila resumen: etiqueta #A3A8B2 · valor #F3F3F6]
```
La flecha es un SVG de 17–18px, trazo `2.4px`, color `#F5B824`, con
`d="M5 12h14M14 7l5 5-5 5"`.

---

## 3 · Tarjeta de cliente / préstamo (lista)

La pieza más repetida. **Dos niveles de información, nunca tres.**

```
┌─────────────────────────────────────────────────┐
│▌ (SO)  Steven Olmos                    [Al día] │   ← nivel 1: quién
│        [36d] Bolivariana · Cl 8 # 31-05         │   ← nivel 2: dónde/cuándo
│                                                 │
│  DEUDA TOTAL                        18% pagado  │
│  $130.500                                       │   ← el monto
│  ▰▰▰▰▰▰▱▱▱▱                                     │   ← la barra
└─────────────────────────────────────────────────┘
```

```css
position: relative;
background: #FFF;
border: 1px solid rgba(20,20,28,.08);
border-radius: 18px;
padding: 15px 16px 15px 19px;    /* el 19 izquierdo deja sitio al riel */
display: flex; flex-direction: column; gap: 11px;
overflow: hidden;
flex: none;                       /* CRÍTICO: nunca flex:1 */
```

**Riel de estado** — el portador de color:
```css
position: absolute; left: 0; top: 14px; bottom: 14px;
width: 4px; border-radius: 999px;
background: #E5484D | #E7A400 | #12A150;
```

**Avatar**: `40×40px`, círculo, `background:#F3F3EF`, iniciales `15px/700 #4A4E57`.
Cuando el estado importa, borde de `2px` del color del estado.

**Fila del nombre**: el nombre solo, `16px/700`, `letter-spacing:-.015em`, con
`min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis`.
**La pastilla de días baja a la segunda línea** junto a la dirección — si comparte fila
con el nombre le roba 51px y el nombre se corta.

**Barra de progreso**: `height:5px`, `flex:none` (obligatorio: si es encogible, colapsa
a 0 y desaparece el estado), `border-radius:999px`, pista `#F3F3EF`, relleno del color
del estado.

---

## 4 · Pastilla de estado

```css
display: inline-flex; align-items: center;
height: 20–24px; padding: 0 8–10px;
border-radius: 11px;
font-size: 10–11px; font-weight: 700;
flex: none;
```

| Estado | Fondo | Borde | Texto |
|---|---|---|---|
| Mora / vencido | `rgba(229,72,77,.12)` | `rgba(229,72,77,.25)` | `#C23B40` |
| Atraso leve | `rgba(231,164,0,.14)` | `rgba(231,164,0,.30)` | `#8A6100` |
| Al día / verificado | `rgba(18,161,80,.12)` | `rgba(18,161,80,.25)` | `#0D7A3C` |
| Neutro / conteo | `#F3F3EF` | `rgba(20,20,28,.08)` | `#63676F` |
| Recomendado | `rgba(18,161,80,.12)` | `rgba(18,161,80,.25)` | `#0D7A3C` |
| Destacado (sobre oscuro) | `#E7A400` | — | `#3A2900` |

Los días de atraso llevan `font-variant-numeric:tabular-nums` y se escriben `36d`,
nunca "36 días de atraso" dentro de una pastilla.

---

## 5 · Botones

### Primario
```css
height: 52–56px;               /* 42px en escritorio */
border: none; border-radius: 14px;
background: #E7A400;
color: #3A2900;                /* NUNCA blanco sobre dorado */
font: 700 16–17px 'Manrope';
```
**Uno solo por pantalla.** Su texto dice la acción concreta con su cifra cuando la hay:
"Aplicar $15.000", "Subir a Negocio · $79.000", "Cobrar y pasar al siguiente".

### Secundario
```css
height: 46–52px;
background: #FFF;
border: 1px solid rgba(20,20,28,.10–.12);
color: #15161A;  /* o #4A4E57 si es "cancelar" */
font: 600 14–15px 'Manrope';
border-radius: 14px;
```

### Destructivo
Nunca relleno. Contorno rojo:
```css
background: #FFF;
border: 1px solid rgba(229,72,77,.30–.35);
color: #C23B40;
font-weight: 700;
```
En una pantalla destructiva (mover a perdidos, cerrar cuenta) **el dorado va en la
acción NO destructiva** ("seguir cobrando") y la destructiva queda en contorno rojo.

### Textual
Sin fondo ni borde: `13px/700`, color `#B07D00`. Para "Ver todos", "Asignar", "Cambiar",
"Editar las plantillas".

### Barra de acción inferior
```css
background: #FFF;
border-top: 1px solid rgba(20,20,28,.09);
padding: 14px 20px 22px;       /* el 22 inferior es el área del indicador */
display: flex; gap: 10px;
```
Con dos botones, el primario lleva `flex:1.7` a `flex:2` y el secundario `flex:1`.
Una acción secundaria puede ir como texto centrado debajo del botón
(`13px/600 #63676F`).

---

## 6 · Campos

### Campo de texto
```css
height: 52–56px; padding: 0 16–18px;
background: #FFF; border: 1px solid rgba(20,20,28,.10);
border-radius: 14px;
font-size: 16–17px; font-weight: 600;
placeholder: color #8E929A, font-weight 400
```

### Campo con foco (el patrón dorado)
```css
border: 1.5px solid #E7A400;
box-shadow: 0 0 0 3px rgba(231,164,0,.13);
```
Este mismo par se usa para **marcar la opción seleccionada** en cualquier grupo de
tarjetas o chips. Es la única señal de selección del sistema.

### Campo de monto (héroe)
```css
height: 64–88px; padding: 0 18–22px;
border-radius: 16–18px;
+ el patrón de foco dorado
```
Dentro: el símbolo `$` en Space Grotesk `23–28px/600` color `#63676F`, y el número en
Space Grotesk `32–44px/600`, `letter-spacing:-.03em a -.04em`, tabular-nums.
El símbolo **siempre en un span aparte y más pequeño** que la cifra.

### Etiqueta de campo
```css
font-size: 10px; font-weight: 700;
letter-spacing: .1em; text-transform: uppercase;
color: #63676F;
```
Escrita como pregunta en el idioma del usuario: "Cuánto le vas a prestar",
"Cada cuánto le cobras", "Cuánto te dio".

### Texto de ayuda
Debajo del campo, `12px`, `color:#63676F`, `line-height:1.45`. Dice la consecuencia,
no repite la etiqueta.

---

## 7 · Chips y grupos de opciones

### Chip de filtro (fila con scroll horizontal)
```css
height: 34–36px; padding: 0 12–13px;
border-radius: 11px;
font-size: 12px; font-weight: 600;
flex: none;

inactivo: background #FFF, border 1px solid rgba(20,20,28,.08), color #4A4E57
activo:   background #15161A, color #F4F4F1, font-weight 700
```
El chip activo es **negro, no dorado**: el dorado es para la plata.
Los chips llevan su conteo cuando lo tienen: `+30d · 13`.

### Grupo segmentado (elegir una de 2–4)
```css
contenedor: display:flex; gap:6–7px
opción:     flex:1; height:46–54px; border-radius:14px
            font-size:13px; font-weight:600
inactiva:   background #FFF o #F3F3EF, border 1px solid rgba(20,20,28,.07–.09)
            color #4A4E57
activa:     background #15161A, color #F4F4F1, font-weight 700
```

### Tarjeta de opción (elegir una de 2–4, con explicación)
```css
flex:1; padding:13–18px; border-radius:14–16px;
background:#FFF; border:1px solid rgba(20,20,28,.08–.10);
seleccionada: border 1.5px solid #E7A400 + anillo dorado
```
Con radio de `20px`: sin seleccionar es `border:1.5px solid rgba(20,20,28,.18)`;
seleccionado es un círculo dorado relleno con un check de `12px` en `#3A2900`.

---

## 8 · Interruptor

```css
pista:   46×28px; border-radius:999px
         apagado: background #E4E4DF, border 1px solid rgba(20,20,28,.09)
         encendido: background #E7A400 (sin borde)
perilla: 22×22px; border-radius:999px; background:#FFF
         box-shadow: 0 1px 3px rgba(20,20,28,.24)
         apagado: left:3px; top:3px
         encendido: right:3px; top:3px
```
Siempre en una fila con su etiqueta (`14px/700`) y su explicación (`12px #63676F`)
a la izquierda, el interruptor a la derecha con `flex:none`.

---

## 9 · Barras

### Barra de progreso
```css
pista:   height:5–14px; border-radius:999px; background:#F3F3EF; overflow:hidden
         flex: none;                  /* OBLIGATORIO */
relleno: display:block; height igual; border-radius:999px
         background: #E7A400 | #12A150 | #E5484D según el estado
```
Alturas por contexto: `5px` en tarjeta de lista, `8–9px` en tarjeta de resumen,
`11–14px` en bloque oscuro.

> **Nunca dejes una barra como único hijo encogible de un contenedor de altura fija.**
> Absorbe el déficit y colapsa a 0px, y con ella desaparece el estado de la fila.

### Barra partida (composición)
Dos o tres spans con `width:%` dentro de un contenedor `display:flex` con
`overflow:hidden`. Sin gap. Sobre claro: `#15161A` + `#E7A400`.
Sobre oscuro: `#F3F3F6` + `#F5B824`.
Siempre con su leyenda debajo: punto de `9px` `border-radius:3px` + etiqueta + cifra.

### Espina de progreso (wizard)
```css
contenedor: display:flex; gap:3–5px
segmento:   flex:1; height:3–4px; border-radius:999px
hecho:      #E7A400 (o #12A150 en el modo ruta)
actual:     #E7A400
pendiente:  #E4E4DF
```
**Una sola espina por flujo.** Nunca dos barras de progreso simultáneas.

---

## 10 · Hoja inferior (bottom sheet)

El patrón de modal en móvil. **Siempre desde abajo, nunca centrado.**

```css
/* la página de atrás queda visible con su velo */
velo:  position:absolute; inset:0; background:rgba(20,20,28,.42)

hoja:  background:#F4F4F1;
       border-radius:22px 22px 0 0;
       box-shadow:0 -12px 32px rgba(20,20,28,.18);
       display:flex; flex-direction:column; overflow:hidden

asa:   width:38px; height:4px; border-radius:999px;
       background:rgba(20,20,28,.16);
       align-self:center; margin: 10px 0 14–16px
```

### Estructura
```
[asa]
[cabecera: título Space Grotesk 20px/600 + subtítulo 13px #63676F   ✕ 21px]
[cuerpo: padding 0 22px, gap 11–14px]
[barra de acción: background #FFF, border-top, padding 14px 22px 24px]
```

La cabecera de la hoja **no repite** el dato que ya está en la página de atrás; lo
completa. La página de atrás debe seguir mostrando el contexto (nombre y monto) por
encima de la hoja.

---

## 11 · Modal centrado (solo escritorio)

```css
velo:  position:absolute; inset:0; background:rgba(20,20,28,.50)
modal: position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
       width:520px;
       background:#F4F4F1;
       border-radius:22px;
       box-shadow:0 24px 64px rgba(20,20,28,.40);
       overflow:hidden; display:flex; flex-direction:column
```
Mismo reparto que la hoja: cabecera blanca con borde inferior, cuerpo sobre `#F4F4F1`,
barra de acción blanca con borde superior.

---

## 12 · Tabla (escritorio)

```css
contenedor: background:#FFF; border:1px solid rgba(20,20,28,.08);
            border-radius:18px; overflow:hidden;
            display:flex; flex-direction:column

cabecera:   height:38–44px; padding:0 24px;
            background:#F3F3EF;
            border-top y border-bottom 1px solid rgba(20,20,28,.08);
            celdas: 11px/700, letter-spacing .07em, uppercase, #63676F

fila:       height:42–56px; padding:0 24px;
            border-bottom:1px solid rgba(20,20,28,.06)
            flex: none;                /* nunca flex:1 */

fila sel.:  background:#FDF9EE

subtotal:   background:#F9F9F6, height 36px  (cabecera de grupo)

total:      height:58px; background:#F3F3EF; sin borde inferior
```

### Reglas de columnas
- Los **montos van alineados a la derecha** con `tabular-nums lining-nums`.
- El texto va a la izquierda.
- Anchos: la columna de nombre es `flex:1`; las de cifras llevan `width` fijo en px +
  `flex:none`. Nunca todas `flex`.
- Cuando una celda combina una barra y un número, **deja 18px de separación** entre
  ellos (`padding-left` en la celda) para que el número no toque la barra.
- **Pie de tabla** con el truncado dicho honestamente: "Ves 10 de los 17 · faltan 7 por
  $4.826.336". Si el usuario suma la columna, tiene que poder llegar al total.

### Espaciador
Entre la última fila y el pie, un `<div style="flex:1;min-height:0"></div>`. Ese es el
**único** elemento encogible permitido dentro de una tabla de altura fija.

---

## 13 · Avisos

### Ámbar (atención, no error)
```css
background: rgba(231,164,0,.07);
border: 1px solid rgba(231,164,0,.28);
border-radius: 14–18px;
padding: 14–16px 16–18px;
icono 16–17px #B07D00 · texto 12–13px #7A5800, line-height 1.45–1.5
```

### Rojo (riesgo o dato que no cuadra)
```css
background: rgba(229,72,77,.07);
border: 1px solid rgba(229,72,77,.22);
icono #E5484D · texto #A8353A
```

### Neutro (explicación)
```css
background: #FFF; border: 1px solid rgba(20,20,28,.08);
icono 16px #63676F · texto 12px #4A4E57
```
Icono de información: círculo de `r=9` con `M12 11v5M12 8h.01`.

### Franja de aviso en cabecera
```css
margin: 0 20px 12px;
padding: 13px 15px;
border-radius: 14px;
background: #FDF3D6; border: 1px solid rgba(231,164,0,.32);
título 13px/700 #7A5800 · subtítulo 11px #8A6100
acción: chip dorado de 32px a la derecha
```
**Una sola franja a la vez.** Ver `02-ARMAZON.md`.

---

## 14 · Tira de cifras (4 columnas)

El patrón para "las cuatro cosas que importan de este objeto".

```css
contenedor: display:flex; gap:8px
columna:    flex:1; display:flex; flex-direction:column; gap:4px
separador:  width:1px; background:rgba(20,20,28,.07)   /* entre columnas */

etiqueta:   10px/700, letter-spacing .06–.07em, uppercase, #63676F
valor:      Space Grotesk 14–18px/600, tabular-nums lining-nums
            #15161A (neutro) · #0D7A3C (a favor) · #C23B40 (en contra)
```
Máximo cuatro columnas en móvil, cinco en escritorio. Con más, no se leen.

---

## 15 · Gráficos

**No se usa ninguna librería.** Todos los gráficos del rediseño son divs.

### Barras verticales
```css
contenedor: display:flex; align-items:flex-end; gap:3–9px
            height: FIJA en px (nunca flex:1 con hijos en %)
barra:      flex:1; height:N%; border-radius:4px 4px 0 0
            background:#E7A400 | #12A150 | #E4E4DF (inactiva)
```
> **Las barras en % necesitan un contenedor de altura resuelta.** Si el contenedor es
> `flex:1` dentro de una columna saturada, colapsa a 0 y el gráfico desaparece.
> Dale siempre `height` explícito.

### Barras de comportamiento (12 meses)
12 barras de `flex:1`, `gap:4px`, `border-radius:3px 3px 0 0`, coloreadas por resultado
del mes: `#12A150` pagó bien · `#E7A400` pagó tarde · `#E5484D` no pagó.
Debajo, una frase que dice lo mismo en palabras: *"Pagaba tarde pero cerraba el mes.
Desde mayo viene fallando."* **El texto y el gráfico tienen que contar la misma
historia.**

### Barras horizontales (ranking)
Fila con nombre `flex:1` (ellipsis), pista de `56–74px × 7px` y la cifra a la derecha
con `width` fijo y `text-align:right`.

---

## 16 · Estado vacío

```
[moneda 88px]
Título Space Grotesk 27–29px/600, centrado, max 30ch
Explicación 15px/1.5 #4A4E57, centrada
[botón primario]
[acción secundaria como texto]
```
La **moneda** es el elemento de marca: círculo de `88px`, `background:#E7A400`,
`border:4px solid #F5C518`, `box-shadow:0 10px 28px rgba(231,164,0,.32)`, con el glifo
`$` en Space Grotesk `40px/700` color `#3A2900`. Reemplaza a la mascota anterior.

Nunca dice "no hay datos". Dice qué hacer y cuánto cuesta hacerlo.

---

## 17 · Esqueleto de carga

Bloques con la **forma exacta** de lo que va a llegar (misma altura de tarjeta, misma
tira de cifras), en `#F3F3EF` sobre `#FFF`, que se desvanecen hacia abajo con
`opacity` decreciente. **Nunca un spinner dentro del contenido.**
