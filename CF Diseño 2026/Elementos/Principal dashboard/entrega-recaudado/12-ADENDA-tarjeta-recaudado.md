# Adenda 4 · La tarjeta insignia del panel

> **Se suma al paquete `PAQUETE-FINAL/`. No lo reemplaza.**
> Tokens: `01-TOKENS.md` · Componentes: `03-COMPONENTES.md` · Escalas: `11-ESCALAS-Y-CONSISTENCIA.md`
>
> Referencia visual: **`E06-tarjeta-recaudado-hoy.dc.html`** (`support.js` en la misma carpeta).
> Trae el **antes** y el **después** lado a lado, más la versión de escritorio.

---

## Qué es

La tarjeta de **"Recaudado hoy"** del panel. Es lo primero que se ve al abrir la app.

**No es una pantalla nueva:** reemplaza la tarjeta que ya existe, en el mismo sitio.

---

## Por qué se rediseña

### 1 · El fondo dorado es un error de sistema, no un estilo

El dorado `#E7A400` está reservado en todo el sistema para **tres cosas**: el monto principal, la
acción primaria y el foco del campo activo. Cuando lo lleva el fondo entero:

- **El monto queda del mismo color que su contenedor.** El ojo no encuentra dónde mirar.
- **El texto oscuro sobre ámbar pierde contraste.** La hora pico de cobro es las **17:00**, bajo
  sol: es la peor combinación posible.
- **Las barras ámbar sobre fondo ámbar son invisibles.**

La regla del sistema es que **la cifra que resuelve la pantalla va en bloque oscuro `#15161A`**.
Esta tarjeta no era la excepción: era el incumplimiento más visible.

### 2 · El 40% estaba dos veces

Una pastilla arriba a la derecha y una barra de progreso abajo, diciendo lo mismo, sin conexión
visual entre las dos.

### 3 · Las siete barras no decían nada

Sin escala, sin referencia y del mismo color que el fondo. El pie *"Martes 4 · $565.000"*
flotaba abajo a la izquierda sin indicar a qué barra pertenecía.

---

## Cómo se construye

### El contenedor

```css
background: #15161A;
border-radius: 20px;
padding: 19px 21px;              /* 26px 30px en escritorio */
display: flex; flex-direction: column; gap: 14px;
```

⚠️ **Sobre fondo oscuro los colores cambian:** dorado `#F5B824`, verde `#2FBE6A`, rojo `#F0575C`.
Los del tema claro no tienen contraste suficiente sobre `#15161A`.

### Fila 1 · Etiqueta
```css
font-size: 10px; font-weight: 700;
letter-spacing: .1em; text-transform: uppercase;
color: #A3A8B2;
```
→ `RECAUDADO HOY`

### Fila 2 · El monto y su contexto, en la misma línea
```css
/* contenedor */
display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;

/* monto — móvil */
font-family: 'Space Grotesk'; font-size: 34px; font-weight: 600;
letter-spacing: -.035em; color: #F3F3F6; line-height: 1;
font-variant-numeric: tabular-nums lining-nums;

/* monto — escritorio */
font-size: 40px; letter-spacing: -.04em;

/* contexto */
font-size: 12px; color: #8A8E98;   /* 14px en escritorio */
font-variant-numeric: tabular-nums;
padding-bottom: 2px;
```
→ `$248.000` · `de $626.167 que toca cobrar`

⚠️ **Copy: "meta del día" → "que toca cobrar".** $626.167 no es una meta: es plata que le deben
hoy. Una meta es algo a lo que uno aspira y que se puede no alcanzar sin consecuencia; esto es
una cuenta por cobrar. Llamarlo meta hace que quedarse corto se sienta normal.

### Fila 3 · La barra con su porcentaje
```css
/* contenedor */
display: flex; align-items: center; gap: 11px;

/* pista */
flex: 1; height: 11px; border-radius: 999px;
background: rgba(255,255,255,.12); overflow: hidden;
/* relleno */
display: block; width: 40%; height: 11px;
border-radius: 999px; background: #F5B824;

/* porcentaje */
font-family: 'Space Grotesk'; font-size: 15px; font-weight: 600;
letter-spacing: -.02em; color: #F5B824;
font-variant-numeric: tabular-nums; flex: none;
```

**El porcentaje va al final de la barra, no en una pastilla suelta.** Así deja de ser un dato
duplicado y pasa a ser la etiqueta de su propia barra.

### Fila 4 · Tira de cifras
Separada por `padding-top: 13px; border-top: 1px solid rgba(255,255,255,.09)`.

```css
/* contenedor */ display: flex; gap: 8px;
/* columna */    flex: 1; display: flex; flex-direction: column; gap: 4px;
/* separador */  width: 1px; background: rgba(255,255,255,.09);

/* etiqueta */ 10px/700, letter-spacing .06em, uppercase, #8A8E98
/* valor */    Space Grotesk 15px/600, tabular-nums lining-nums, #F3F3F6
               (19px en escritorio, letter-spacing -.02em)
```

| Móvil (3 columnas) | Escritorio (5 columnas) |
|---|---|
| Cobrados · `2 de 16` | Cobrados · `2 de 16` |
| Te faltan · `$378.167` (en `#F5B824`) | Te faltan · `$378.167` (`#F5B824`) |
| Ayer · `$460.400` | En mora · `6` (`#F0575C`) |
| | Ayer · `$460.400` |
| | Promedio 7d · `$512.400` |

**Máximo 4 columnas en móvil, 5 en escritorio.**

`$378.167` = `626.167 − 248.000`. La cifra tiene que cuadrar.

### Fila 5 · La gráfica de los últimos 7 días

⚠️ **La altura del contenedor es explícita en px, nunca `flex:1`.** Las barras usan `height` en
porcentaje: si el contenedor colapsa, el gráfico desaparece.

```css
/* contenedor */
position: relative;
height: 52px;                    /* 96px en escritorio */
display: flex; align-items: flex-end; gap: 7px;   /* 9px en escritorio */

/* línea de meta — lo que toca cobrar cada día */
position: absolute; left: 0; right: 0; top: 13px;   /* 24px en escritorio */
border-top: 1px dashed rgba(255,255,255,.26);

/* barra */
flex: 1; border-radius: 4px 4px 0 0;               /* 5px en escritorio */
/* días que cobraron todo */   background: rgba(255,255,255,.34)
/* días que no llegaron */     background: rgba(255,255,255,.16)
/* hoy */                      background: #F5B824
```

Valores del ejemplo, con la línea de meta al 75%: `82% · 64% · 91% · 58% · 79% · 71% · 40%(hoy)`
→ tres días por encima de la línea.

**Debajo, en móvil**, solo los extremos (como la gráfica de ingresos de Reportes):
```
hace una semana                                    hoy
11px #8A8E98                            11px/700 #F5B824
```

**En escritorio** caben los nombres de los días (`jue vie sáb dom lun mar hoy`, 10px/700,
`flex:1; text-align:center`) y la **cifra de la línea de meta** arriba a la derecha
(`position:absolute; right:0; top:6px; 10px/700 #8A8E98` → `$626.167`).

### Fila 6 · La lectura escrita
```css
font-size: 12px; line-height: 1.45; color: #A3A8B2;
font-variant-numeric: tabular-nums;
```
→ *"Cobraste todo **3 de los últimos 7 días**. La línea es lo que toca cada día."*

**Sin esta frase la gráfica sigue sin decir nada.** Un gráfico que necesita interpretación no
informa; uno que trae su lectura sí. Y el texto y el gráfico tienen que contar **la misma
historia**: si dice "3 de 7", tiene que haber exactamente 3 barras por encima de la línea.

### Lo que desaparece

- **La pastilla de 40%** arriba a la derecha → pasa a ser la etiqueta de la barra.
- **El pie "Martes 4 · $565.000"** → era la etiqueta de la barra seleccionada, pero flotaba sin
  conexión con ninguna barra. Un dato que hay que adivinar a qué se refiere es un dato que no
  está.
- **La lista "2 cobrados · 14 pendientes · ayer $460.400"** → pasa a la tira de cifras, con
  etiquetas y jerarquía.

---

## Escritorio 1440

Dos bloques oscuros lado a lado dentro de la fila del panel:

```
┌──────────────────────────────────┬─────────────────────┐
│  RECAUDADO HOY                   │  LOS ÚLTIMOS 7 DÍAS │
│  $248.000   de $626.167…         │  [gráfica 96px]     │
│  [barra 12px ───────── 40%]      │  jue vie sáb … hoy  │
│  ─────────────────────────────   │  ─────────────────  │
│  5 columnas de cifras            │  lectura escrita    │
│  flex: 1                         │  width: 392px       │
└──────────────────────────────────┴─────────────────────┘
```

La gráfica sale a su propia tarjeta porque en 392px ya caben la cifra de la línea de meta y los
nombres de los días — en 390px de móvil no cabían.

La lectura escrita de escritorio añade la comparación contra el promedio:
> *"La línea punteada es lo que toca cobrar cada día. Vas **$114.000 por debajo** de tu promedio
> a esta hora."*

---

## Checklist antes de darla por hecha

```
□ El contenedor es #15161A, radio 20px. Ningún dorado en el fondo.
□ El monto: 34px móvil / 40px escritorio, con su letter-spacing pareado.
□ Todos los números llevan font-variant-numeric: tabular-nums lining-nums.
□ El 40% aparece UNA sola vez, al final de la barra.
□ La tira tiene 3 columnas en móvil, 5 en escritorio. Ni una más.
□ $378.167 = $626.167 − $248.000. Cuadra.
□ El contenedor de la gráfica tiene height en px, no flex:1.
□ Hay exactamente 3 barras por encima de la línea punteada, y el texto dice 3.
□ Sobre el fondo oscuro: dorado #F5B824, verde #2FBE6A, rojo #F0575C.
□ Dice "que toca cobrar", no "meta del día".
```

---

## Resumen para el agente

```
Reemplaza la tarjeta dorada del panel por un BLOQUE OSCURO #15161A.
El dorado vuelve a ser solo el acento: la barra, el %, y la cifra "te faltan".

Estructura, de arriba a abajo:
  1. etiqueta RECAUDADO HOY (10px/700 uppercase #A3A8B2)
  2. $248.000 (34/40px) + "de $626.167 que toca cobrar" en la misma línea
  3. barra 11px + su % al final  ← el % NO va en pastilla suelta
  4. tira de cifras: 3 en móvil, 5 en escritorio
  5. gráfica 7 días con LÍNEA DE META punteada, altura en px
  6. la lectura escrita: "cobraste todo 3 de los últimos 7 días"

Se elimina: la pastilla de 40%, el pie "Martes 4 · $565.000",
y la lista de tres datos sueltos sin etiqueta.

Copy: "meta del día" → "que toca cobrar".
```
