# LEER PRIMERO — guía de trabajo para el agente

Este paquete es el rediseño completo de **Control Finanzas**. Contiene **146 pantallas**, una por
archivo, más las especificaciones del sistema de diseño.

---

## ⚠️ El error que hay que evitar

**No abras `Control Finanzas - Rediseño.dc.html`.** Son 18.000 líneas con las 146 pantallas
juntas. Si lo abres, te llenas el contexto y no vas a poder trabajar. Ese archivo está solo como
respaldo.

**Trabaja con `pantallas/`**, donde cada pantalla es un archivo de 200–400 líneas.

---

## El flujo, pantalla por pantalla

Repite este ciclo. **Una pantalla por vez.** No intentes hacer varias.

```
1. Abre INDICE-DE-PANTALLAS.md y busca la pantalla.
2. Abre su archivo en pantallas/  →  esto es el objetivo.
3. Abre la captura de la columna ANTES  →  esto es lo que existe hoy.
4. Lee la SPEC que indica el índice para esa familia de pantallas.
5. Construye en el código real.
6. Compara tu resultado con el archivo de pantallas/ lado a lado.
7. Solo entonces pasa a la siguiente.
```

### Antes de la primera pantalla, lee estos tres

| Archivo | Qué saca de ahí |
|---|---|
| `01-TOKENS.md` | Cada color en hex, cada tamaño de fuente, cada radio, cada altura. **Sin esto nada encaja.** |
| `02-ARMAZON.md` | Cabecera 56px, barra inferior flotante, sidebar de escritorio, y **§E: cuándo NO van** |
| `03-COMPONENTES.md` | Las 17 piezas del sistema, en CSS plano listo para traducir |

Los otros se leen **cuando toque esa familia**, no antes:

| Archivo | Cuándo |
|---|---|
| `04-CRITERIOS.md` | Antes de escribir cualquier texto o formatear cualquier número |
| `05-PANTALLAS.md` | Contexto de qué resuelve cada pantalla |
| `06-ADENDA-modos-sin-tabla.md` | Fichas de préstamo (turnos 41–42) |
| `07-ADENDA-menu-y-lucas.md` | Menú del + y chat de Lucas (turno 43) |
| `08-ADENDA-socios.md` | Módulo de Socios (turno 45) |

---

## Cómo leer un archivo de `pantallas/`

Todo está **inline**: cada `style="..."` tiene los valores literales. No hay clases, no hay
variables, no hay CSS externo. Lo que ves es lo que va.

```
pantallas/T02-01-panel-del-dueno.dc.html
         │  │  └─ nombre de la pantalla
         │  └──── número dentro del turno
         └─────── turno
```

Dentro del archivo:

- Arriba: un encabezado con el turno y el nombre.
- En medio: **el marco de la pantalla** (390×844 móvil, 1440×N escritorio).
- Abajo: **el pie de foto** — explica la decisión de diseño y qué problema resuelve.
  **Léelo.** Ahí está el criterio, no solo la descripción.

El marco de teléfono (`border-radius:30px`, la barra de estado con la hora) es **andamio del
mockup**: no lo construyas. Construye lo que va **dentro**.

---

## Por dónde empezar

En este orden. Cada bloque depende del anterior.

### Bloque 1 · Fundaciones
1. Los tokens de `01-TOKENS.md` en el sistema de estilos.
2. El armazón: `pantallas/T39-01`, `T39-03`, `T39-04`, `T39-05` + la regla de `02-ARMAZON.md §E`.
3. La cabecera definitiva: `pantallas/T40-00-a-marca-minima.dc.html`.
   ⚠️ Las variantes B y C están **descartadas**. No las construyas.

### Bloque 2 · Los componentes que se repiten
4. Tarjeta estándar, bloque oscuro, pastilla de estado, barra de progreso, botón primario,
   campo con foco dorado. Todo en `03-COMPONENTES.md`.
5. **La tarjeta de cliente/préstamo de lista** — es la pieza más repetida del sistema.
   Referencia: `pantallas/T02-05-clientes.dc.html`.

### Bloque 3 · Las seis pantallas de navegación
6. `T02-01` panel · `T02-02` cobrar hoy · `T02-05` clientes · `T02-06` préstamos ·
   `T27-01` rutas · `T06-01` caja.

### Bloque 4 · Fichas
7. `T41-01` ficha `fijo` — **es la ficha de préstamo por defecto: el 54,7% de la cartera.**
8. `T41-02` ficha `unico` · `T42-01` `manual` · `T42-02` `proporcional`.
9. `T15-01` ficha de cliente · `T12-01` la tabla (solo el 6,2% de los préstamos: va después).

### Bloque 5 · Lo que mueve plata
10. `T02-04` registrar pago · `T08-01` pago con medio · los modales de gestión (`T13`, `T19`).

### Bloque 6 · El resto
11. Caja (`T06`, `T20`, `T33`) · reportes y analíticas (`T30`–`T33`) · configuración (`T10`, `T38`)
    · onboarding y registro (`T01`, `T07`, `T37`) · portal (`T36`) · Socios (`T45`) ·
    Lucas y el menú del + (`T43`) · estados y avisos (`T05`, `T23`, `T34`, `T35`).

---

## Las cinco cosas que se rompen siempre

Si tu resultado se ve mal, empieza por aquí:

1. **`font-variant-numeric: tabular-nums lining-nums` en todo número.** Sin esto las columnas de
   montos bailan al actualizarse y la app se siente barata.

2. **Las filas y tarjetas de contenido van `flex: none`.** Si dejas una `flex: 1` dentro de una
   columna saturada, absorbe todo el déficit, se aplasta, y su texto se sale del
   `overflow: hidden`. El único encogible permitido es un `<div>` espaciador vacío.

3. **Las barras de progreso van `flex: none`.** Si son el único hijo encogible, colapsan a 0px y
   con ellas desaparece el estado de la fila.

4. **Un solo dorado `#E7A400` por pantalla.** El monto principal, la acción primaria, o el foco
   del campo activo. Nada más. El armazón de navegación es gris.

5. **El estado nunca tiñe el fondo de la tarjeta.** Va en un riel de 4px a la izquierda, una
   pastilla, o el color del relleno de la barra. La tarjeta siempre es blanca. Este es el defecto
   principal del diseño actual: 30 tarjetas teñidas de rosa y rojo donde nada destaca.

---

## Qué manda cuando algo se contradice

| Situación | Qué gana |
|---|---|
| El mockup dice un dato distinto al sistema real (nombres, montos, conteos) | **El sistema real.** Los datos del mockup son de ejemplo. |
| El mockup dice un diseño distinto a lo que hay hoy | **El mockup.** Para eso es el rediseño. |
| Dos documentos del paquete se contradicen | **El de número más alto.** Las adendas 06/07/08 son posteriores. |
| Turno 44 vs turno 45 (Socios) | **El 45.** El 44 está ahí solo para explicar el problema. |
| `05-PANTALLAS.md` dice que la ficha con tabla es la principal | **Está invertido.** La principal es `fijo` (54,7%); la de tabla es el 6,2%. |

---

## Si algo no está especificado

**Pregunta antes de inventarlo.** El paquete tiene 146 pantallas y ocho documentos: si algo no
aparece, es porque no se diseñó, no porque se te haya escapado. Inventar una pantalla nueva con
criterio propio es lo único que puede romper la coherencia del sistema.

---

## Contenido del paquete

```
LEER-PRIMERO-GUIA-AGENTE.md      ← este archivo
INDICE-DE-PANTALLAS.md           ← la tabla de las 146 pantallas
pantallas/                       ← 146 archivos, uno por pantalla
  T01-01-perfil.dc.html
  T02-01-panel-del-dueno.dc.html
  …
support.js                       ← runtime; tiene que estar junto a los .dc.html

01-TOKENS.md                     Colores, tipografía, radios, espaciado, alturas
02-ARMAZON.md                    Cabecera, barra inferior, sidebar, la regla de supresión
03-COMPONENTES.md                17 recetas en CSS plano
04-CRITERIOS.md                  Jerarquía, números, copy, flujo, errores a evitar
05-PANTALLAS.md                  Inventario con la decisión de cada pantalla
06-ADENDA-modos-sin-tabla.md     Fichas fijo / unico / manual / proporcional
07-ADENDA-menu-y-lucas.md        Menú del + y chat de Lucas
08-ADENDA-socios.md              Módulo de Socios
README.md                        Contexto del producto

Control Finanzas - Rediseño.dc.html   ← respaldo. NO lo abras.
```
