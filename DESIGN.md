# Sistema de diseño — Control Finanzas 2026

> **Este documento describe el rediseño 2026. Reemplaza por completo al sistema
> anterior.** Nada del diseño viejo sobrevive: ni la cabecera, ni el menú, ni los
> iconos, ni las tarjetas, ni la paleta, ni los componentes.
>
> **La fuente de verdad es `CF Diseño 2026/design_handoff_control_finanzas/`.**
> Este archivo es el índice y el puente hacia el código. Ante cualquier duda o
> contradicción, gana el handoff.

---

## Dónde está cada cosa

| Qué | Handoff | Código |
|---|---|---|
| Tokens exactos | `01-TOKENS.md` | `app/tokens-2026.css` |
| Cabecera, barra inferior, sidebar | `02-ARMAZON.md` | `components/armazon/` |
| La regla de supresión | `02-ARMAZON.md` § E | `lib/armazon.js` + tests |
| Recetas de componentes | `03-COMPONENTES.md` | `components/cf/primitivos.jsx` |
| Los criterios (el porqué) | `04-CRITERIOS.md` | — |
| Inventario de 106 pantallas | `05-PANTALLAS.md` | `components/pantallas/` |
| **Modos sin tabla + pantalla "Más"** | `06-ADENDA-modos-sin-tabla.md` | `components/pantallas/` |
| **Menú del + y Lucas** | `07-ADENDA-menu-y-lucas.md` | `components/pantallas/` |
| Turnos 41–43 (visual) | `NUEVO-turnos-41-42-43.dc.html` | — |
| El documento visual | `Control Finanzas - Rediseno.dc.html` | — |
| Banco de pruebas | — | `app/estilo` |

---

## Las cuatro decisiones que definen el rediseño

No son de estilo. Si se implementa lo visual y se saltan estas, se pierde la
mitad del valor.

### 1 · La plata es lo único que brilla

El dorado `#E7A400` se reserva a **tres cosas**: el monto principal de la
pantalla, la acción primaria, y el foco del campo activo. Nada más.

Consecuencias que hay que respetar:
- El armazón de navegación es gris. La única excepción es la pastilla del
  destino activo (`--cf-gold-tint`), y el botón + va en **carbón** con el signo
  dorado, nunca al revés.
- **El chip de filtro activo es NEGRO**, no dorado.
- Cuando una pantalla no tiene monto, no tiene nada dorado salvo su botón.

### 2 · El armazón se gana su sitio

Cabecera (56px) + pastilla (62px + 18px) ocupan **137px de 844** — un sexto del
teléfono. Aparecen cuando el usuario **navega**; desaparecen cuando hace **una
sola cosa**.

La tabla normativa vive en `lib/armazon.js` y está cubierta por tests. La
pregunta que decide los casos nuevos:

> ¿El usuario llegó aquí buscando, o llegó a hacer una cosa?
> Buscando → armazón completo. A hacer algo → solo la salida.
> Si la respuesta es "las dos", la pantalla está haciendo demasiado.

**La regla de supresión es exclusiva de móvil.** En escritorio la barra lateral
nunca se oculta: quien usa PC está revisando, no cobrando en la calle.

### 3 · Una pantalla, una respuesta

Cada pantalla tiene **una** cifra que es la razón por la que se abrió. Va en el
bloque oscuro a 33–52px. Máximo **uno por pantalla**. Todo lo demás baja al menos
dos niveles de tamaño.

### 4 · El estado va en el acento, nunca en el fondo

Mora, atraso o al día se comunican con un **riel de 4px**, una **pastilla** o el
**color del relleno de una barra**. La superficie de la tarjeta es **siempre
blanca**.

Esto corrige el defecto principal del diseño anterior: tarjetas teñidas de rosa,
ámbar y rojo formando un muro donde nada destacaba porque todo destacaba.

---

## Reglas de números

1. **`font-variant-numeric: tabular-nums lining-nums` en TODO número.** Sin
   excepción. Usar las clases `.cf-num` (texto) o `.cf-fig` (cifra en Grotesk).
   Sin esto las columnas de montos bailan al cambiar de dígito.
2. **Los números tienen que cuadrar.** Si una tabla muestra un subtotal, la suma
   de sus filas visibles más el truncado declarado tiene que dar ese subtotal.
3. **Todo truncado se declara con su monto.** "Ves 10 de los 17 · faltan 7 por
   $4.826.336", nunca un "Ver todos" pelado.
4. **Toda cifra derivada dice de qué se deriva.**
5. **Nunca una resta que mienta.** Si una fórmula puede dar rojo en un caso
   bueno, la fórmula está mal. Prestar no es gastar.
6. **En "antes → después", el color dice qué le pasa a TU plata** — no a la del
   cliente, y no si la decisión es buena idea. Perdonar baja la deuda del cliente
   y **no va en verde**: el dueño acaba de regalar plata. Cobrar un recargo la
   sube y **no va en rojo**. Si una jugada es mala idea, eso se **dice con una
   frase**; un color no sabe argumentar. Verde y rojo quedan para las líneas de
   consecuencia, donde el significado es inequívoco.

---

## Contraste — se mide, no se elige a ojo

Mínimos: **4,5:1** para texto normal, **3:1** para texto grande (≥24px, o ≥18,66px
en negrita) y para elementos gráficos. Cubierto por `lib/__tests__/contraste.test.js`,
que calcula los ratios desde los tokens: si alguien baja un valor, el test cae.

**El fallo real no estaba donde parecía.** Los tokens del bloque oscuro pasan con
holgura —el más bajo es 5,36:1—. Donde fallaba era el **menú dorado**, y con los
valores que pide el propio handoff:

| Dónde | Handoff | Ratio | Ahora |
|---|---|---|---|
| Rótulos de grupo (10px) | `rgba(58,41,0,.55)` | **2,61:1** ❌ | `.86` → 4,94:1 |
| Fecha (12px) | `rgba(58,41,0,.62)` | **2,98:1** ❌ | `.82` → 4,55:1 |

Son los dos textos más pequeños sobre la superficie más saturada del sistema. Y
no se ven como un error: se ven como un texto "suave". Por eso van medidos.

**Regla general:** todo texto de alfa bajo sobre un fondo de color es sospechoso.
El bloque oscuro es seguro porque sus colores son opacos y vienen del token.

---

## Copy

Español colombiano, coloquial, segunda persona. **El idioma del prestamista, no
el del software.**

| No | Sí |
|---|---|
| Balance neto | Toda tu plata |
| Capital disponible | Lista para prestar |
| Cartera activa | En la calle, cobrándose |
| Registrar pago | Me paga |
| Préstamos irrecuperables | Clavos |
| Gestionar suscripción | Pagar $39.000 |

Los títulos de campo son **preguntas**: "Cuánto le vas a prestar". Los botones
dicen la acción **con su cifra**: "Aplicar $15.000". Los estados vacíos dicen
**qué hacer**, nunca "no hay datos".

---

## Estado de la migración

**Todo el sistema anterior se reemplaza.** Nada se conserva por inercia.

| | Estado |
|---|---|
| `app/tokens-2026.css` | ✅ nuevo, en uso |
| `--color-*` (tokens viejos) | ⚠️ vivos **solo** porque 42 archivos los referencian. Se borran cuando el último consumidor se reescriba. |
| `components/cf/`, `components/armazon/`, `components/pantallas/` | ✅ nuevos |
| `components/ui/` (40 componentes) | ⚠️ **ninguno sobrevive.** Se reemplazan uno a uno. |
| `MonedaCF` con cara y 5 poses | ❌ reemplazada por la moneda lisa del handoff |
| `Capi` (capibara) | ❌ eliminado del diseño |

**Que un componente viejo siga en el repo no significa que se conserve.**
Significa que todavía tiene consumidores. Al reescribir una pantalla, sus
componentes viejos se van con ella.

---

## Lo único que sobrevive del sistema anterior

No son estilo: son **hechos de plataforma** que costaron bugs en producción y que
el handoff no contempla porque no puede saberlos.

1. **`border-radius` en GPU Mali (Android)** rompe el rasterizado al hacer
   scroll. Fix: `transform: translateZ(0)` en el elemento con radio que flote.
2. **Iconos `absolute` dentro de inputs** no se ven en Safari iOS sin `z-index`.
3. **Los inputs no pueden bajar de 16px**: iOS hace zoom automático al enfocar.
4. **Campos de tasa y decimales**: `type="text"` con `inputMode="decimal"`, nunca
   `type="number"` — rechaza el separador que no coincide con el locale.
5. **Todo release que cambie UI visible** debe subir `CACHE_NAME` en
   `public/sw.js`, o la PWA sigue mostrando lo viejo.
6. **`html, body { overflow-x: clip }`**: ningún elemento puede generar scroll
   horizontal.

---

## Errores de maquetación que el handoff ya encontró

Causa raíz del 90% de los defectos visuales. Están en `04-CRITERIOS.md` § G:

1. Una **barra de progreso** como único hijo encogible de un contenedor fijo
   absorbe el déficit y **colapsa a 0px**. Siempre `flex: none`.
2. Una **tarjeta o fila con `flex:1`** dentro de una columna saturada se aplasta
   y su texto se sale del `overflow`. Las filas de contenido son `flex: none`; el
   único encogible permitido es un espaciador vacío.
3. **Barras de gráfico con `height:%`** dentro de un contenedor `flex:1`
   desaparecen si el contenedor colapsa. Altura explícita en px.
4. Un **número pegado a una barra** en la misma celda: dejar 18px.
5. Una **pastilla en la fila del nombre** le roba ~51px y corta el nombre. Baja a
   la segunda línea.

---

## Desviaciones deliberadas del handoff

Se documentan acá para que se lean como decisiones y no como olvidos.

| Qué | Por qué |
|---|---|
| **Rutas nunca se oculta de la pastilla.** El handoff dice que desaparece en cuentas sin cobradores. | Sacar un destino de la barra ya rompió una vez al cliente con más cobradores, el mismo día. Un destino que aparece y desaparece rompe la memoria muscular, que es lo único que tiene alguien que cobra de pie. Aprobado por el dueño del producto. |
| **La pastilla flotante de 62px**, no la barra anclada de 76px. | `01-TOKENS.md` y `05-PANTALLAS.md` dicen 76px anclada; `02-ARMAZON.md` dice que ese modelo se descartó y el definitivo es la pastilla. Gana el documento del armazón, que es el normativo y el más nuevo. |
| **En Caja las acciones van en el contenido, no ancladas abajo.** El render del handoff las dibuja ancladas. | La tabla normativa pone caja en "pastilla: sí", y la propia § E dice que la barra anclada ocupa el sitio de la pastilla **solo cuando la pastilla no está**. Son el mismo hueco. Van justo debajo del saldo —no al final del scroll— porque cerrar el día es lo que uno hace con esa cifra. |
| **La tarjeta de lista de un préstamo `unico` no lleva barra de progreso**, igual que su ficha. | Sin cuotas marcaría 0% durante todo el plazo. La adenda quita la barra en la ficha por eso mismo; dejarla en la lista reintroduce la misma alarma falsa en la pantalla que se abre primero, y son 882 préstamos. En su sitio va el vencimiento. |
| **Una ruta sin cobros programados va en gris y muestra "—"**, no 0% en rojo. | El rojo dice "esta ruta va mal" cuando lo cierto es "no tenía nada que cobrar hoy". Un rojo que no significa nada entrena al usuario a ignorar los que sí. |

---

## Orden de construcción — CORREGIDO

> ⚠️ **`05-PANTALLAS.md` tiene el orden invertido en las fichas de préstamo.**
> Ahí la ficha CON tabla de amortización figura como *la* ficha. Es la
> **excepción**: cubre el 6,2% de la cartera.

La ficha por defecto es la de **`fijo`** (54,7%). Construir primero la de tabla
es construir la excepción antes que la norma.

| Orden | Ficha | Cartera | Dónde | |
|---|---|---|---|---|
| 1 | `fijo` — **la ficha canónica** | 54,7% | `06-ADENDA` §1 · turno 41·01 | ✅ |
| 2 | `unico` — cambia la pregunta | 18,6% | `06-ADENDA` §2 · turno 41·02 | ✅ |
| 3 | `manual` = `fijo` + la cuota la puso una persona | 10,6% | `07-ADENDA` §1 · turno 42·01 | ✅ |
| 4 | `proporcional` = `fijo` + el porcentaje explicado | 9,8% | `07-ADENDA` §2 · turno 42·02 | ✅ |
| 5 | con tabla — la **variante** | 6,2% | paquete original · turno 12 | ✅ |

Las cuatro viven en `components/pantallas/FichaPrestamo.jsx`, un solo componente
con `modo`. La quinta, en `TablaAmortizacion.jsx`.

Construidas además: **Más** (`PantallaMas.jsx`), **menú del +** (`MenuCrear.jsx`),
**Lucas** en sus tres estados (`Lucas.jsx`), **Caja** del día y cierre de
cobradores (`Caja.jsx`), **Préstamos** (`ListaPrestamos.jsx`) y **Comparar
calendarios** (en `TablaAmortizacion.jsx`, ya con el nombre corregido).

Con eso, **las seis pantallas de navegación existen**: Panel, Cobrar hoy,
Clientes, Préstamos, Rutas y Caja — más el quinto destino, Más.

### Tres reglas de las fichas sin tabla

1. **Nunca repartir el interés por pago.** Se sabe el interés total; no se sabe
   cuánto de cada pago fue interés. Mostrarlo sería fabricar un dato.
2. **No dibujar un calendario proyectado.** En `fijo` el calendario *es* la frase
   "$20.000 diarios durante 30 días". Treinta filas iguales es relleno.
3. **Los números feos se dejan feos.** "39 semanas" no se redondea a 40: el dueño
   va a cobrar 39 veces. Un plazo redondeado es un plazo mentiroso.

### `unico` no es una variante menor

Se le quita la **barra de progreso**: sin cuotas estaría en 0% todo el plazo, y
882 préstamos que parecen impagos es una alarma falsa. La reemplaza la **fecha de
vencimiento**, y el estado vacío del historial **tranquiliza en vez de alarmar**:
*"Es normal: en este tipo de préstamo se paga al final."*

---

## Huecos cerrados

Las adendas resolvieron los tres que había:

1. ~~Ficha sin tabla~~ → `06-ADENDA` + `07-ADENDA`, los 8 modos tienen pantalla.
2. ~~Pantalla "Más"~~ → turno 41·03. Cada fila lleva **su cifra**: un menú de
   nombres es un índice; con la cifra al lado es un panel.
3. ~~Comparar modos~~ → **no era un hueco.** La pantalla compara *calendarios*, y
   los 4 que muestra son los 4 que tienen calendario. Se renombra a **"Comparar
   calendarios"** y el problema desaparece. Los 8 se comparan donde ya se
   comparan bien: el selector del paso 5 de crear préstamo, en lista vertical.

## Lo único que sigue sin diseñar

- **Socios.** No hay pantalla en ningún paquete. Si hace falta, es diseño nuevo.
- Cualquier flujo de **renovación** que no sea "crear préstamo con datos
  prellenados".
