# Escalas cerradas y consistencia

> **Este documento es una tabla de consulta. Tenlo abierto mientras trabajas.**
>
> Complementa a `10-COMO-CREAR-ELEMENTOS-NUEVOS.md`: ese dice *qué tipo* de elemento usar,
> este dice *qué medidas exactas* tiene.

---

## La regla que lo gobierna todo

> **Las escalas son CERRADAS. Solo existen los valores de estas tablas.**
>
> Si necesitas un tamaño que no está, **no interpoles**: usa el más cercano de la tabla. No
> existe el 50px porque hay 48 y 52. No existe el radio de 15px porque hay 14 y 16.

Y su consecuencia, que es la que arregla la mayoría de los problemas:

> **Dos elementos con el mismo papel miden exactamente lo mismo, siempre, en toda la app.**
>
> Todos los botones primarios: 52px. Todos. No 52 en una pantalla y 50 en otra.

---

## 1 · Tipografía — tres escalas cerradas

### A · Cifras — Space Grotesk 600

**Seis tamaños. No hay más.**

| px | letter-spacing | Cuándo |
|---|---|---|
| **40** | `-.04em` | La respuesta de la pantalla, en escritorio |
| **34** | `-.035em` | La respuesta de la pantalla, en móvil |
| **26** | `-.03em` | Monto principal de una tarjeta |
| **19** | `-.02em` | Monto de una fila destacada, o de una tira de cifras |
| **15** | `-.02em` | Monto de una fila normal, celda de tabla |
| **13** | — | Monto secundario dentro de un metadato |

Todas llevan `font-variant-numeric: tabular-nums lining-nums`. Las de 26px y más llevan
`line-height: 1`.

⚠️ **El letter-spacing va atado al tamaño.** No es decorativo: sin él, una cifra de 34px se ve
suelta y una de 15px se ve apretada.

### B · Títulos — Space Grotesk 600

**Tres tamaños. No hay más.**

| px | letter-spacing | Cuándo |
|---|---|---|
| **27** | `-.025em` | Título de pantalla, en escritorio |
| **20** | `-.02em` | Título de pantalla en móvil, o de una hoja inferior |
| **17** | `-.015em` | Título de una cabecera de detalle (el nombre del cliente) |

### C · Texto — Manrope

**Siete tamaños. No hay más.**

| px | peso | Cuándo |
|---|---|---|
| **16** | 700 | Nombre en una tarjeta de lista · texto de botón primario |
| **15** | 600–700 | Texto principal de una fila · botón secundario |
| **14** | 600 | Texto de fila · botón de escritorio · etiqueta de botón cuadrado |
| **13** | 400–700 | Cuerpo, descripción, botón textual |
| **12** | 400–600 | Metadato, segunda línea, texto de apoyo |
| **11** | 400–700 | Metadato pequeño, subtítulo de cabecera de detalle |
| **10** | 700 | Etiqueta de sección (uppercase, `.09–.1em`) |

**Nada por debajo de 10px.** Y el 10px solo existe en mayúsculas con `letter-spacing`.

### D · La regla de los títulos que arregla tu problema

> **Una pantalla tiene UN título, y su tamaño lo fija el viewport: 20px en móvil, 27px en
> escritorio. Nunca otro valor.**
>
> **Las secciones dentro de una pantalla NO llevan título.** Llevan una **etiqueta**:
> `10px/700, letter-spacing .1em, text-transform: uppercase, color #63676F`.

Por eso en el sistema no hay títulos de distinto tamaño compitiendo: **solo hay uno por
pantalla**. Todo lo demás que parece un título es una etiqueta de 10px.

Si ves dos cosas en Space Grotesk grande en la misma pantalla, una de las dos está mal.

---

## 2 · Radios — escala cerrada

| radio | Para qué, exactamente |
|---|---|
| **999px** | **SOLO** cinco cosas: avatar, punto de estado, pastilla de estado, barra de progreso, y el botón + de la barra inferior |
| **20px** | Bloque oscuro |
| **18px** | **Tarjeta estándar** — el más usado |
| **16px** | Tarjeta pequeña · botón cuadrado de icono · campo grande |
| **14px** | Botón primario y secundario · campo de texto · aviso |
| **13px** | Botón de escritorio · item de barra lateral · pastilla de periodo |
| **12px** | Botón de icono · chip grande |
| **11px** | Chip de filtro · pastilla de estado · icono contenedor |
| **10px** | Icono contenedor pequeño · pestaña dentro de un carril |

### La regla que arregla los botones circulares

> **Un botón nunca es circular.** El `border-radius: 999px` está reservado a esas cinco cosas de
> arriba, y ninguna es un botón de acción.
>
> La estética del sistema es **cuadrado redondeado**. Un botón de acción es siempre 12–16px de
> radio. Si mide 40×40 y lleva un icono, es `border-radius: 12px`, no un círculo.

Las tres excepciones legítimas, y no hay más:
- El **botón + de la barra inferior** (62px, círculo carbón).
- El **avatar** del usuario o de un cliente.
- La **moneda** de los estados vacíos.

### La regla del radio proporcional

> **El radio crece con el elemento, y nunca al revés.**

Un elemento de 34px de alto no puede tener radio 18px (se ve como una cápsula deforme); uno de
76px no puede tener radio 11px (se ve como una caja de sistema operativo). La escala de arriba ya
está ordenada por eso: usa el radio de la fila que corresponde al papel del elemento.

---

## 3 · Alturas — por papel, no por gusto

**Mismo papel = misma altura, en toda la app.**

### Interactivos
| Papel | Altura |
|---|---|
| Botón héroe (el de registrar el pago) | **76px** |
| Botón cuadrado con icono (fila de 3–4) | **74px** |
| Botón primario de remate de flujo | **56px** |
| **Botón primario** (el normal) | **52px** |
| Botón secundario | **48px** |
| Botón primario dentro de una tarjeta | **48px** |
| Botón de escritorio, primario y secundario | **42px** / **40px** |
| Botón de icono | **40px** |
| Chip grande / opción / pastilla de periodo | **38px** |
| Chip de filtro | **34px** |
| Interruptor | **28px** (perilla 22px) |

### Contenedores y filas
| Papel | Altura |
|---|---|
| Cabecera de pantalla (móvil) | **56px** — fija, siempre |
| Barra inferior flotante | **62px** — fija, siempre |
| Campo de texto | **56px** |
| Campo de monto (héroe) | **64–88px** |
| Fila de lista dentro de una tarjeta | **52–56px** |
| Fila de lista densa | **46px** |
| Fila de tabla (escritorio) | **58px** |
| Cabecera de tabla | **44px** |
| Item de barra lateral | **37px** |
| Pastilla de estado | **20–24px** |

### El mínimo que no se negocia
> **44px de alto para cualquier cosa que se toque.** Se usa de pie, con una mano, a veces con
> guantes.

---

## 4 · La regla de contención — arregla "botones más grandes que las cajas"

> **Un elemento nunca puede ser más alto que el ritmo de su contenedor.**

En concreto, y es checkable:

| Dónde está el botón | Altura máxima |
|---|---|
| En la **barra de acción** al pie de la pantalla | 52–56px |
| **Dentro de una tarjeta** | **48px** |
| **Dentro de una fila** de una tarjeta | **40px** |
| **Dentro de una pastilla o chip** | 34–36px |

Las alturas de 52 y 56px **solo existen en la barra de acción de la pantalla**. Un botón de 56px
dentro de una tarjeta de 18px de radio y 19px de padding se ve como si se estuviera saliendo,
porque se está saliendo.

### Y la que va con ella
> **Un elemento nunca toca el borde de su contenedor.** El espacio mínimo entre un elemento y el
> borde es el padding del contenedor, y ese padding no se reduce para que algo quepa.

Si algo no cabe, se quita contenido — no se recorta el padding ni se encoge el elemento por
debajo de su escala.

---

## 5 · Espaciado — por relación, no por número

El padding lateral lo fija el contexto. **No se negocia por pantalla.**

| Contexto | Padding lateral |
|---|---|
| Pantalla móvil | **20px** |
| Pantalla escritorio | **36px** |
| Hoja inferior | **22px** |
| Interior de tarjeta | **18–20px** |
| Interior de bloque oscuro | **21px** móvil · **28px** escritorio |
| Fila de tabla | **24px** |
| Barra de acción inferior | **14px 20px 22px** (el 22 es el área del indicador) |

### El gap comunica la relación

| Qué relación hay | gap |
|---|---|
| Elementos **pegados** (icono + su texto, cifra + su símbolo) | **7–9px** |
| Elementos **relacionados** (filas de un grupo, chips) | **11–12px** |
| Bloques **distintos** dentro de una columna | **16–18px** |
| Secciones **separadas** (escritorio) | **20–26px** |

Si dos cosas están a 11px, el usuario las lee como parte de lo mismo. Si están a 18px, como cosas
distintas. **Usa el gap para decir eso, no para llenar espacio.**

---

## 6 · Iconos — atados a su contenedor

| Contenedor | Icono | Trazo |
|---|---|---|
| Botón de 40px | **20px** | 1.9 |
| Contenedor de 34–38px | **17–18px** | 1.9–2 |
| Contenedor de 30–32px | **15–16px** | 1.9 |
| Contenedor de 28px | **14px** | 1.9 |
| Dentro de una fila, sin contenedor | **15–17px** | 1.9 |
| Chevron de "entrar" | **15–16px** | 2.2 |
| Cerrar (✕) y atrás (←) | **19–21px** | 2.2 |
| Botón + de la barra inferior | **26px** | 2.6 |

### Reglas
- **El trazo por defecto es 1.9.** Sube a **2.1–2.2** solo cuando el elemento está activo (icono
  de nav activa) o es un chevron. Sube a **2.4–2.6** solo para ✕ y +.
- **Todos los iconos son de línea, nunca rellenos.** `fill="none"` + `stroke`.
- `stroke-linecap="round"` y `stroke-linejoin="round"` siempre.
- **Color por defecto `#63676F`** en estado normal, `#4A4E57` cuando acompaña texto principal,
  `#B07D00` cuando está activo o dentro de un contenedor `#FDF3D6`.

---

## 7 · Contenedores de icono — el patrón

Cuando un icono necesita fondo:

```css
display: inline-flex; align-items: center; justify-content: center;
flex: none;
width: Npx; min-width: Npx; height: Npx; min-height: Npx;
aspect-ratio: 1;              /* OBLIGATORIO: sin esto se aplasta */
border-radius: 10–12px;       /* o 999px SOLO si es avatar */
background: #F3F3EF;          /* neutro */
           /* #FDF3D6 si es el destacado del grupo */
           /* rgba(229,72,77,.10) si es de alarma */
```

⚠️ **`flex:none` + `min-width` + `min-height` + `aspect-ratio:1` son obligatorios.** Sin ellos,
una columna apretada convierte el círculo en un óvalo. Pasó de verdad en este proyecto, tres
veces.

Tamaños: **52px** (avatar de ficha) · **40px** (avatar de tarjeta) · **38px** · **34px** ·
**32px** · **30px** (dentro de una fila) · **28px** (fila densa).

---

## 8 · Los cinco síntomas de inconsistencia, y su causa

| Síntoma | Causa | Regla que lo arregla |
|---|---|---|
| Títulos de distinto tamaño en la misma pantalla | Se tituló una sección | §1D — **una pantalla, un título**. Las secciones llevan etiqueta de 10px |
| Botones circulares en una estética cuadrada | Se usó `999px` fuera de sus cinco casos | §2 — `999px` solo para avatar, punto, pastilla, barra y el + |
| Un botón que se sale de su tarjeta | Se usó la altura de barra de acción dentro de una tarjeta | §4 — dentro de una tarjeta, **48px máximo** |
| Anchos y paddings distintos para lo mismo | Se ajustó el padding para que algo cupiera | §5 — el padding lo fija el contexto; si no cabe, se quita contenido |
| Textos de 13, 13.5 y 14px | Se interpoló entre valores de la escala | §1 — la escala es **cerrada**: siete tamaños de texto y nada más |

---

## 9 · Checklist de consistencia

Corre esto sobre cualquier elemento nuevo, además del checklist de
`10-COMO-CREAR-ELEMENTOS-NUEVOS.md §7`:

```
□  1. ¿Cada tamaño de fuente sale de las tres escalas de §1?
□  2. ¿Hay UN solo título en la pantalla, del tamaño que fija el viewport?
□  3. ¿Las secciones llevan etiqueta de 10px/700 uppercase, no título?
□  4. ¿Cada letter-spacing corresponde al tamaño de su cifra?
□  5. ¿Cada radio sale de la escala de §2?
□  6. ¿El 999px se usa SOLO en avatar, punto, pastilla, barra o el botón +?
□  7. ¿Cada altura corresponde al papel del elemento en §3?
□  8. ¿Ningún elemento interactivo baja de 44px?
□  9. ¿Ningún botón dentro de una tarjeta pasa de 48px?
□ 10. ¿El padding lateral es el del contexto, sin ajustar?
□ 11. ¿Cada gap dice la relación correcta (7-9 pegado / 11-12 relacionado / 16-18 distinto)?
□ 12. ¿Cada icono tiene el tamaño y trazo de su contenedor?
□ 13. ¿Todo contenedor de icono lleva flex:none + min-width + min-height + aspect-ratio:1?
```

Y la comprobación final, que vale más que las trece:

> **Busca en el sistema otro elemento con el mismo papel y compara las medidas una por una.**
> Si no coinciden exactamente, el tuyo está mal — no el que ya existe.
>
> Esa es la única forma real de mantener consistencia: **no decidir**, copiar la decisión que ya
> se tomó.
