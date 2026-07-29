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
| **Una ruta sin cobros programados va en gris y muestra "—"**, no 0% en rojo. | El rojo dice "esta ruta va mal" cuando lo cierto es "no tenía nada que cobrar hoy". Un rojo que no significa nada entrena al usuario a ignorar los que sí. |

---

## Huecos conocidos del handoff

Ver `CF Diseño 2026/PEDIDO-PANTALLAS-FALTANTES.md`.

1. **Ficha de préstamo sin tabla de amortización.** El handoff diseñó las fichas
   sobre los 4 modos que tienen tabla — el **6,2%** de los préstamos activos. El
   **93,7%** restante (`fijo`, `unico`, `manual`, `proporcional`) no tiene
   desglose por período: el dato no existe.
2. **La pantalla "Más"** (quinto destino de la pastilla). Derivable del menú de
   configuración del turno 9 y de la agrupación que ya usa la barra lateral.
3. **Comparar modos**: el handoff compara 4 de los 8. Puede estar bien así.
