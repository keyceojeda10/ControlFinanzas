# Adenda 5 · Las tarjetas de lista

> **Se suma al paquete `PAQUETE-FINAL/`. No lo reemplaza.**
> Tokens: `01-TOKENS.md` · Componentes: `03-COMPONENTES.md` · Escalas: `11-ESCALAS-Y-CONSISTENCIA.md`
>
> Referencia visual: los cinco `.dc.html` de esta carpeta (`support.js` en la misma carpeta).
> Cada uno trae el **antes** y el **después** lado a lado, con el porqué en el pie de foto.

---

## Los cinco archivos

| Archivo | Qué reemplaza | Dónde |
|---|---|---|
| `E07-tarjeta-ruta-de-cobro.dc.html` | La tarjeta de cliente dentro de una ruta | Ruta de cobro |
| `E08-numero-de-parada-carril.dc.html` | El número de orden de la parada | Ruta de cobro |
| `E09-estados-fuera-de-parada.dc.html` | Al día · sin deuda · inactivo | Ruta de cobro |
| `E10-acento-de-estado-en-tarjetas.dc.html` | El riel lateral de color | Clientes y préstamos |
| `E11-lamina-de-rutas.dc.html` | La lámina dorada de la cabecera | Rutas |

**Orden de implementación:** E10 primero (es la regla que usan las otras), luego E11, E07, E08, E09.

---

## 1 · El acento de estado — E10

**Regla nueva del sistema. Reemplaza al riel lateral en todas las listas.**

> **El estado lo llevan los elementos que ya identifican a la fila — nunca uno añadido para
> pintarlo.**

| Tarjeta | Portadores |
|---|---|
| **Cliente** (tiene avatar) | **Anillo de 2px en el avatar** + **barra a sangre** abajo |
| **Préstamo** (sin avatar) | **Solo la barra a sangre** |
| Fila de tabla o lista densa | Riel de 4px a `left:8px` |

### Por qué se quita el riel
La tarjeta ya dice el estado tres veces: la pastilla, la cifra de atraso en rojo y la barra de
progreso. El riel era el cuarto y el único sin dato. Además iba pegado al borde con esquinas
rectas, peleando con el radio de 16px de la tarjeta.

⚠️ **Dos acentos solo conviven si dicen cosas distintas.** El anillo dice *cómo está*; la barra
dice *cuánto lleva pagado*. Añadir un riel encima sería decir la pastilla por cuarta vez.

### El anillo
```css
display: inline-flex; align-items: center; justify-content: center;
flex: none;
width: 38px; min-width: 38px; height: 38px; min-height: 38px;
aspect-ratio: 1;                          /* obligatorio: sin esto se aplasta */
border-radius: 999px;
background: #F3F3EF;
border: 2px solid #12A150;                /* #E7A400 atraso leve · #E5484D mora */
/* iniciales 13px/700 #4A4E57 */
```

### La barra a sangre
Último hijo de la tarjeta. La tarjeta lleva `overflow: hidden` y `padding-bottom: 0`.
```css
flex: none;                               /* obligatorio */
height: 5px; display: block;
background: #F3F3EF;
margin: 0 -17px;                          /* anula el padding lateral */
/* relleno */
display: block; height: 5px; width: N%;
background: #12A150 | #E7A400 | #E5484D;
```

---

## 2 · La lámina de Rutas — E11

Mismo error que la tarjeta del panel: **fondo dorado**, que apaga los montos y deja las barras
invisibles.

Pasa a **bloque oscuro compacto**: `border-radius: 16px`, `padding: 16px 18px` — no los 20 del
héroe del panel, porque aquí es un resumen sobre una lista.

```
RECAUDADO HOY                    TE FALTAN
$248.000                         $378.167      ← 26px / 19px, #F5B824 el segundo
[barra 8px ─────────] 40% · 9 rutas · 16 cobros
```

Dos cambios de contenido:
- Las cifras pasan a **recaudado / te faltan**, que es la gramática del sistema.
- **Entra la barra con su porcentaje.** Sin ella, los dos montos son datos sueltos: nadie sabe si
  el día va bien.
- La línea *"9 rutas · 16 cobros"* sube al lado del porcentaje en vez de vivir en un renglón gris
  aparte.

Los chips de la cabecera (`Hoy`, `Ordenar`) pasan de `border-radius: 999px` a **11px**: en el
sistema el 999px está reservado a avatar, punto, pastilla, barra y el botón +.

---

## 3 · La tarjeta de la ruta de cobro — E07

### El diagnóstico

> La tarjeta contestaba **"cuánto debe"**. Tiene que contestar **"cuánto le pido"**.

Las cifras grandes eran los saldos ($440.000, $520.000). El cobrador va a pedir **$80.000**, que
estaba en 15px al lado del nombre. Nueve cifras y ninguna era la que se iba a usar.

### Estructura, de arriba a abajo

**1 · Identidad** — avatar con anillo + nombre + dirección **con la distancia** + pastilla de días
```
[PH ⊙]  Prueba hoy                              [28d]
        Cl 8 # 31-05 · a 240 m
```
La distancia es nueva: el cobrador decide el orden real con ella.

**2 · El héroe**
```css
/* etiqueta */ 10px/700, .09em, uppercase, #63676F   →  "PÍDELE HOY"
/* cifra */    Space Grotesk 26px/600, -.03em, tabular-nums lining-nums
```
A la derecha, el plegador: `2 préstamos ⌄` en 12px `#63676F`.

**3 · El aviso de mora**, solo si la hay
```css
padding: 10px 13px; border-radius: 12px;
background: rgba(229,72,77,.07); border: 1px solid rgba(229,72,77,.22);
/* icono 15px #E5484D · texto 12px/1.4 #A8353A */
```
→ *"Lleva **28 días sin pagar**. Debe $960.000 en total."*

**4 · Acciones** — tres iconos de **44px** (`border-radius: 13px`, `background: #F3F3EF`) y el
botón `Cobrar` en dorado, `flex: 1`, 44px.

⚠️ **El botón pasa de verde a dorado.** En el sistema el verde significa *al día, pagado*; usarlo
como color de acción rompe esa lectura justo donde más importa.

**5 · La barra a sangre** al pie.

### El estado abierto
Los saldos por préstamo se pliegan y se abren solo si el cliente discute. Dentro:
- Se identifican **por fecha** (*"Del 4 de marzo"*), no como "Préstamo 1". El cliente dice *"el de
  marzo"*.
- Cada uno con su barra, su porcentaje y su saldo.
- Al pie, **la suma** — la cifra que el cobrador tiene que defender.
- La tira de abajo cambia *"próximo cobro"* (es hoy, por eso está en la ruta) por **"última vez:
  4 jul"**.

### Un préstamo
La tarjeta baja a 3 filas: no hay nada que plegar, así que el saldo va en la misma línea del
monto (`le quedan $128.000`, 12px a la derecha).

### La parada ya cobrada
Colapsa a una fila con check verde, hora y monto, al **62% de opacidad**. En una ruta de 16, las
cobradas no pueden ocupar lo mismo que las pendientes.

### ⚠️ Un error de dato que hay que arreglar
La franja roja dice **"28d Mora · 55 Cuotas · $960.000"**. Esos $960.000 son el **saldo total**,
no la mora. Un cobrador que lea esa línea le pide al cliente casi diez veces lo que corresponde.

Tres números seguidos sin etiqueta siempre terminan así. En el rediseño cada cifra dice qué es,
en una frase.

---

## 4 · El número de parada — E08

> **El orden no es un dato del cliente: es dónde está en la fila.** Por eso vive fuera de la
> tarjeta.

### Carril de recorrido — la solución elegida

Un carril de **34px** a la izquierda de cada tarjeta, con una línea de 2px que une las paradas.
Los números quedan alineados en columna: *"voy por el dos"* se lee sin entrar en ninguna tarjeta.

```
┌──────┬─────────────────────────────┐
│  ✓   │  [tarjeta cobrada, 62%]     │
│  │   │                              │
│ (2)  │  [tarjeta abierta + sombra] │   ← la que sigue
│  │   │                              │
│ (3)  │  [tarjeta normal]            │
└──────┴─────────────────────────────┘
   34px         flex: 1
```

**Los tres estados del carril:**

| Estado | Círculo |
|---|---|
| **Cobrada** | 30px, `background: #12A150`, check blanco de 16px |
| **La que sigue** | 34px, `background: #15161A`, número Space Grotesk 16px/700 `#F4F4F1` |
| **Pendiente** | 30px, `background: #FFF`, `border: 2px solid #C4C7CD`, número 14px/700 **`#4A4E57`** |

⚠️ **El número pendiente va en `#4A4E57`, no en gris claro.** Son los que el cobrador mira *por
delante* para saber cuánto le falta: en `#8E929A` quedan a 3,12:1 y no se leen bajo sol.

El conector es `width: 2px; background: #DCDCD6; border-radius: 999px`, y se omite en la última
parada.

**La tarjeta de la parada actual** lleva `box-shadow: 0 2px 10px rgba(20,20,28,.06)`.

### Coste y cuándo no usarlo
El carril cuesta **46px de ancho** (quedan 304px de los 350). Se paga solo porque también da el
progreso: se ve cuántas paradas van con check sin contar nada.

**Solo en la ruta de cobro.** En listas sin recorrido —clientes, préstamos, búsqueda— no hay orden
que seguir: ahí el número, si hace falta, va como chip carbón de 36px a la izquierda del avatar.

### ⚠️ Lo que NO se hace
El número **no va dentro del avatar** (le quita la cara al cliente, que es lo que hace reconocible
una parada) ni **como marca de agua** al 5% detrás del texto (protagonismo sin legibilidad).

---

## 5 · Los que no son parada — E09

> **El carril numera visitas, no clientes.**

Si hoy no hay nada que recoger, la fila **no lleva número y no cuenta para el total**. Un contador
que incluye paradas que no se hacen es peor que no tener contador: el cobrador cree que va
atrasado cuando va al día.

### La ruta se parte en dos zonas

```
[carril numerado]  ← las paradas de hoy

──────── TAMBIÉN EN ESTA RUTA ────────    ← separador, 10px/700 .1em uppercase #63676F
                                             con líneas de 1px a los lados

[filas sin número]  ← los otros tres estados
```

### Estado 1 · Al día (le toca en N días)
Tarjeta blanca normal, dos bloques separados por `border-top`.
```
[CP ⊙verde]  Carlos Prueba 1                        [Al día]
             Le cobras el 19 de agosto · en 13 días
─────────────────────────────────────────────────────────────
3 préstamos · debe $5.513.334              [ Cobrar antes ]
cuota de $888.334 al mes                     44px, blanco
```

Dos decisiones:
- **La fecha manda, los días acompañan.** *"Cobra en 13d"* deja al cobrador contando; *19 de
  agosto* es lo que se le dice al cliente.
- El botón es **"cobrar antes"**, secundario: cobrarle hoy es un adelanto, no la cuota. Y los
  tres saldos de siete cifras se resumen en una línea.

### Estado 2 · Sin deuda → es una oportunidad
```css
border: 1px solid rgba(231,164,0,.3);     /* borde dorado, no gris */
/* avatar: background #FDF3D6, border 2px #E7A400, iniciales #7A5800 */
```
```
[F1]  Fantasma 1                                    [Listo]
      Terminó de pagar el 4 de julio
──────────────────────────────────────────────────────────
Pagó completos sus 2 préstamos. Le puedes    [ Prestarle ]
prestar hasta $900.000.                        44px, dorado
```

⚠️ El botón dorado pálido sobre fondo gris del diseño actual **se lee como deshabilitado**, que es
lo contrario de lo que se quiere. Y el monto sugerido sale del mismo criterio que el recomendador
de Lucas.

### Estado 3 · Inactivo → sale de la ruta
Fila sin tarjeta, `background: rgba(20,20,28,.035)`, `border-radius: 14px`.
```
[DR]  Deisy Ramírez                                 [ Sacar ]
      Sin préstamos desde febrero                    44px, blanco
```
Lleva meses sin préstamo: no es oportunidad, es una ruta desactualizada.

### ⚠️ Copy
**"Sin deuda — se puede retirar"** suena a que el cliente se retira. Es *sacarlo de la ruta*, y
solo aplica al inactivo — al que no debe nada hay que **prestarle**, no sacarlo.

---

## 6 · Checklist

```
□  1. Ningún riel lateral en tarjetas de cliente ni de préstamo.
□  2. Cliente = anillo en avatar + barra a sangre. Préstamo = solo barra.
□  3. Todo contenedor de avatar lleva flex:none + min-width + min-height + aspect-ratio:1.
□  4. Toda barra lleva flex:none.
□  5. El botón de cobrar es DORADO, nunca verde.
□  6. Todo elemento táctil mide 44px. Sin excepciones.
□  7. La diferencia de peso entre botones la da el estilo, no la altura.
□  8. El héroe de la tarjeta de ruta es "pídele hoy", no el saldo.
□  9. Los números pendientes del carril van en #4A4E57 (7,2:1), no en gris claro.
□ 10. El carril numera solo las paradas de hoy.
□ 11. Los préstamos se identifican por fecha, no por "Préstamo 1".
□ 12. Ninguna cifra sin etiqueta: cada número dice qué es.
```

---

## 7 · Resumen para el agente

```
ACENTO DE ESTADO (aplica a TODAS las listas)
  Fuera el riel lateral.
  Cliente  → anillo 2px en el avatar + barra a sangre abajo.
  Préstamo → solo la barra a sangre.
  Dos acentos solo conviven si dicen cosas distintas.

TARJETA DE RUTA
  Héroe = "PÍDELE HOY $80.000". El saldo se pliega.
  Añadir la distancia a la dirección.
  Botón Cobrar: verde → DORADO, 44px.
  Préstamos por fecha, no por número.
  Parada cobrada = una fila al 62%.
  ARREGLAR EL DATO: "28d Mora · $960.000" — esos $960.000 son el saldo.

NÚMERO DE PARADA
  Fuera de la tarjeta, en un carril de 34px con línea conectora.
  Cobrada = check verde · Actual = círculo carbón · Pendiente = hueco #4A4E57.
  Nunca dentro del avatar ni como marca de agua.
  Solo en la ruta; en otras listas, chip carbón de 36px.

FUERA DE PARADA
  El carril numera VISITAS, no clientes.
  Separador "También en esta ruta" y tres estados sin número:
  al día (cobrar antes) · sin deuda (prestarle, borde dorado) · inactivo (sacar).

LÁMINA DE RUTAS
  Dorado → bloque oscuro compacto (radio 16, padding 16/18).
  Recaudado / te faltan + barra con su %.
```
