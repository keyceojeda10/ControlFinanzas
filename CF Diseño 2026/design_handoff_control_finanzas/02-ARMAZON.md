# 02 · El armazón: cabecera, barra inferior, barra lateral

Este documento es el que más pidió el cliente. La decisión que lo define:

> **El armazón se gana su sitio.** Aparece cuando el usuario está navegando y se retira
> cuando está haciendo una sola cosa.

Cabecera + barra inferior ocupan **132px de los 844** de un teléfono — un sexto de la
pantalla. En una app de cobro ese sexto es una tarjeta de cliente más.

---

## A · Cabecera móvil — 56px

**Dirección elegida y definitiva: marca mínima.**
(Se descartaron dos alternativas: "el saludo es la cabecera" y "buscar es la cabecera".)

```
┌──────────────────────────────────────────────────────────┐
│ [$ 32]                    [buscar 40] [campana 40·] [CC 32] │  56px
└──────────────────────────────────────────────────────────┘
```

### Contenedor

```css
height:     56px;                        /* fijo, siempre */
padding:    0 18px 0 20px;
background: rgba(244,244,241,.86);       /* translúcido sobre la superficie */
display:    flex; align-items: center; gap: 6px;
```
**Sin `border-bottom`**: la separación la da el fondo translúcido.

### Piezas, de izquierda a derecha

**1 · Glifo de marca** — sin logotipo escrito. El usuario ya sabe en qué app está; el
nombre escrito solo añade peso.

```css
display: inline-flex; align-items: center; justify-content: center;
flex: none;
width: 32px; min-width: 32px; height: 32px; min-height: 32px;
aspect-ratio: 1;                         /* blindaje: si no, se aplana */
border-radius: 10px;
background: #E7A400;
border: 2px solid #F5C518;
/* glifo: "$" Space Grotesk 16px/700, color #3A2900 */
```

**2 · Espaciador** — `flex: 1`

**3 · Buscar**
```css
width: 40px; height: 40px; border-radius: 12px;
background: none;
/* icono lupa 20px, trazo 1.9px, color #4A4E57 */
/* path: circle cx=11 cy=11 r=7  +  M16.5 16.5L21 21 */
```

**4 · Campana**
```css
width: 40px; height: 40px; border-radius: 12px;
background: none;
/* icono 20px, trazo 1.9px, color #4A4E57 */
```
El path de la campana es este — tiene cuerpo, borde inferior y badajo, y se lee como
campana a 20px:
```svg
<path d="M18 8.5a6 6 0 00-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5z"/>
<path d="M13.7 20.5a2 2 0 01-3.4 0"/>
```
No uses un arco simple (`M18.5 15.5a6.5 6.5 0 10-13 0` + una línea): no se reconoce.

**Insignia de avisos** — un **punto de 8px, no un número**. El conteo exacto de avisos no
cambia ninguna decisión del usuario.
```css
position: absolute; top: 7px; right: 9px;
width: 8px; height: 8px; border-radius: 999px;
background: #E5484D;
border: 2px solid #F4F4F1;               /* recorta contra la cabecera */
```

**5 · Avatar** — abre la hoja de cuenta (sección C).
```css
display: inline-flex; align-items: center; justify-content: center;
flex: none; margin-left: 4px;
width: 32px; min-width: 32px; height: 32px; min-height: 32px;
aspect-ratio: 1;
border-radius: 999px;
background: #2F6FED;
/* iniciales 12px/700 #FFF */
```
Cuando importa el estado de conexión, punto de `11px` en
`bottom:-1px; right:-1px`, `background:#12A150` (o `#8E929A` sin conexión),
`border:2px solid #F4F4F1`.

### El saludo va en el cuerpo, no en la cabecera
```
título:    Space Grotesk 22px/600, letter-spacing -.02em
subtítulo: 12px #63676F, tabular-nums
```
Primer bloque de la columna de contenido, con `padding-top: 8px`.

---

### Variante de detalle

Un nivel por debajo de una lista, la cabecera cambia de contenido pero **no de altura**:

```
[← 40]  Steven Olmos                       [whatsapp 40] [⋮ 40]
        2 préstamos · debe $291.000
```
- Flecha atrás: `40×40px`, icono 21px trazo `2.2px` `#15161A`.
- Título: Space Grotesk `17px/600`, `letter-spacing:-.015em`, con ellipsis.
- Subtítulo: `11px #63676F`, tabular-nums.
- A la derecha, **las acciones de ese objeto**, no las de la app.

### Variante de tarea

```
[✕ 36]  Cobro 3 de 11
        ▰▰▰▱▱▱▱▱▱▱▱      ← espina de progreso, 3px
```
`padding: 8px 20px 12px` → **56px exactos**, igual que las demás.
- Cerrar: `36×36px`, `border-radius:12px`, `background:#FFF`,
  `border:1px solid rgba(20,20,28,.1)`. **Arriba a la izquierda, lejos del pulgar.**
- Espina: segmentos `flex:1`, `height:3px`, `border-radius:999px`, `gap:3px`.
  Hechos `#12A150`, actual `#E7A400`, pendientes `#E4E4DF`.

---

## B · Barra inferior móvil — pastilla flotante de 62px

**No es una barra anclada al borde.** Es una pastilla que flota sobre el contenido, y el
contenido pasa por debajo. Este es el modelo definitivo (una versión anterior con barra
anclada de 76px y botón dorado sobresaliente se descartó).

```
                                                      ╭────╮
┌──────────────────────────────────────────────┐      │ +  │
│  (◈)   (👤)   ($)   (🗺)   (▦)                │      ╰────╯
└──────────────────────────────────────────────┘
   pastilla 62px, flex:1                          círculo 62px
```

### Contenedor

```css
position: absolute;
left: 16px; right: 16px; bottom: 18px;
display: flex; align-items: center; gap: 12px;
```

### La pastilla

```css
flex: 1;
height: 62px;
border-radius: 999px;
background: #FFFFFF;
border: 1px solid rgba(20,20,28,.08);
box-shadow: 0 6px 20px rgba(20,20,28,.10);
display: flex; align-items: center; justify-content: space-around;
padding: 0 6px;
```

### Los cinco destinos

```css
/* cada uno */
display: inline-flex; align-items: center; justify-content: center;
width: 42px; height: 42px;
/* icono 21px, trazo 1.9px, color #63676F */

/* el activo */
border-radius: 999px;
background: #FDF3D6;
/* icono 21px, trazo 2.1px, color #B07D00 */
```

**Solo iconos, sin etiquetas de texto.** El activo se marca con la pastilla dorada.
Orden: Panel · Clientes · Préstamos · Rutas · Más (rejilla de 4 cuadrados).

### El botón +

```css
display: inline-flex; align-items: center; justify-content: center;
flex: none;
width: 62px; min-width: 62px; height: 62px; min-height: 62px;
aspect-ratio: 1;
border-radius: 999px;
background: #15161A;                       /* CARBÓN, no dorado */
box-shadow: 0 6px 20px rgba(20,20,28,.28);
/* icono 26px, trazo 2.6px, color #F5B824  → el signo sí es dorado */
```

Va **fuera de la pastilla**, a su derecha, separado por `gap:12px`.

### Consecuencias para el contenido

1. La última tarjeta de la columna usa `border-radius: 18px 18px 0 0` y **se corta contra
   el borde inferior**: se ve que hay más contenido debajo de la pastilla.
2. La columna de contenido **no lleva `padding-bottom`** para la barra — el contenido
   pasa por debajo a propósito.
3. **Ningún texto puede quedar detrás de la pastilla.** Si una lista termina justo ahí,
   corta la última fila; no la dejes a medio tapar.

### Sin cobradores
Si la cuenta no tiene cobradores, **el destino de Rutas desaparece** y la pastilla queda
con cuatro. La app se comporta como una sola persona hasta que existe un segundo usuario.

## C · Hoja de cuenta (se abre desde el avatar)

Aquí vive el **cambio de tema**, y esto es una decisión, no un descuido:

> **El cambio claro/oscuro NO es un interruptor de sol y luna en la cabecera móvil.**
> Un usuario cambia de tema una o dos veces en su vida. Poner ese control permanente en
> los 390px más caros de la app es gastar el mejor sitio en el botón menos usado.
> En escritorio sí va visible, porque en la barra lateral no le quita sitio a nada.

### Contenido, en orden
1. **Identidad**: avatar 52px con punto de conexión de 14px, nombre en Space Grotesk
   19px/600, y debajo "Prestamos Castro · dueño".
2. **Cómo se ve la app** — tres tarjetas de igual ancho, cada una con una **vista previa
   dibujada** (un rectángulo de 34px de alto que imita la pantalla) y su nombre:
   *Claro* · *Oscuro* · *Automático*. La seleccionada lleva
   `border:1.5px solid #E7A400` + anillo de foco. Nunca un desplegable con nombres.
   Debajo: "Automático usa el oscuro cuando tu teléfono lo tenga puesto."
3. **Lista de accesos** en una tarjeta: Configuración · Plan y pagos (con su pastilla de
   días restantes si aplica) · Soporte. Filas de `54px`.
4. **Estado de conexión**: pastilla verde "Conectado" + "Todo guardado hace un momento".
5. **Cerrar sesión** en la barra inferior de la hoja: botón de contorno rojo
   (`border:1px solid rgba(229,72,77,.3)`, texto `#C23B40`), nunca relleno.

---

## D · Escritorio 1440 — el armazón es lateral, no superior

**No hay cabecera superior en escritorio.** Todo el armazón vive en una barra lateral y
el ancho completo queda para el contenido.

```
┌────────────┬──────────────────────────────────────────────┐
│ [$] Control│  PANEL                                        │
│    Finanzas│  Buenos días, Carlos          [Prestarle a…] │
│    [🔔3]   │  martes 28 de julio · 7:02 a.m.               │
│ ┌────────┐ │                                               │
│ │Buscar… │ │  ┌─────────────────────┐ ┌────────────────┐  │
│ │ Ctrl+K │ │  │  bloque oscuro      │ │  tarjeta       │  │
│ └────────┘ │  └─────────────────────┘ └────────────────┘  │
│ ─────────  │                                               │
│ ▸ Dashboard│                                               │
│   Cobrar…  │                                               │
│   Rutas    │                                               │
│   …        │                                               │
│ ─────────  │                                               │
│ [Claro|Osc]│                                               │
│ [CC Carlos]│                                               │
└────────────┴──────────────────────────────────────────────┘
   250px
```

### Barra lateral
```
width:250px  (230px cuando el contenido necesita el aire)
background:#FFF
border-right:1px solid rgba(20,20,28,.08)
display:flex; flex-direction:column
```

**Zona superior** (`padding:16px 15px 13px`, `border-bottom:1px solid rgba(20,20,28,.07)`):
- Logo 32px + logotipo en dos líneas.
- **Campana** a la derecha del logo: `32×32px`, `border-radius:10px`,
  `background:#F3F3EF`, insignia roja con borde blanco de 2px.
- **Buscador**: `height:38px`, `border-radius:13px`, `background:#F3F3EF`,
  `border:1px solid rgba(20,20,28,.07)`. Lupa 15px `#8E929A`, placeholder 13px
  `#8E929A`, y a la derecha la tecla:
  ```
  height:20px; padding:0 6px; border-radius:6px
  background:#FFF; border:1px solid rgba(20,20,28,.1)
  ui-monospace 10px/600, color #63676F   →   "Ctrl+K"
  ```

**Zona de navegación** (`flex:1`, `padding:10px 12px`, `gap:2px`):
```
item:       height:37px; padding:0 12px; border-radius:13px
            icono 17px trazo 1.9 #63676F · texto 14px/600 #4A4E57
activo:     background:#FDF3D6; color:#7A5800; texto 700
            icono trazo 2.1 #B07D00
            + riel: position:absolute; left:0; top:7px; bottom:7px;
                    width:3px; border-radius:999px; background:#E7A400
```
Orden fijo: Dashboard · Cobrar hoy · Rutas · Préstamos · Líneas de crédito · Clientes ·
Caja. Después, un separador y **"MÁS HERRAMIENTAS"** plegable (11px/700, `.09em`,
uppercase, `#63676F`, con chevron de 14px). Al final, **"CUENTA"** plegable.

**Zona de cuenta** (`padding:12px`, `border-top:1px solid rgba(20,20,28,.07)`):

*Selector de tema* — tres pastillas en un carril:
```
carril:    padding:4px; border-radius:12px; background:#F3F3EF
           border:1px solid rgba(20,20,28,.07); gap:5px
opción:    flex:1; height:32px; border-radius:9px
           texto 12px/600 #63676F, icono 14px
activa:    background:#FFF; box-shadow:0 1px 2px rgba(20,20,28,.1)
           texto 12px/700 #15161A; icono #B07D00
```
Etiquetas: *Claro* (icono sol) · *Oscuro* (icono luna) · *Auto* (sin icono).

*Ficha del usuario*:
```
padding:10px; border-radius:14px; border:1px solid rgba(20,20,28,.08)
avatar 32px #2F6FED + punto verde 10px con borde blanco 2px
nombre 13px/700 (ellipsis) · rol 11px #63676F
chevron 15px #8E929A a la derecha
```

### La barra lateral nunca se oculta en escritorio
Quien usa PC está revisando, no cobrando en la calle. Ahí la navegación siempre ayuda.
**La regla de supresión es exclusiva de móvil.**

### Cabecera de contenido en escritorio
Cada pantalla pone su propio encabezado (`padding:26px 36px 18px`):
- Migaja: 12px/700, `.1em`, uppercase, `#63676F`.
- Título: Space Grotesk 26–28px/600, `letter-spacing:-.025em`.
- Subtítulo: 13px `#63676F`, tabular-nums.
- A la derecha, la acción primaria (`height:42px`, dorada) y las secundarias
  (`height:40px`, blancas con borde).

---

## E · LA REGLA — cuándo aparece el armazón y cuándo no

Tabla normativa. Si una pantalla nueva no encaja, se decide con la pregunta final.

| Dónde está el usuario | Cabecera | Barra inferior | Por qué |
|---|---|---|---|
| Panel, cobrar hoy, clientes, rutas, préstamos, caja | **Completa · 56px** | **Sí · pastilla 62px** | Está explorando. Necesita saber dónde está y poder saltar. |
| Ficha de cliente, de préstamo, de ruta | Atrás + título + acciones | **No** | Llegó desde una lista: su salida es volver, no saltar. Abajo va la acción de la ficha. |
| Registrar pago, crear préstamo, wizards | Cerrar + progreso | **No** | Salirse a medias pierde datos. Una barra de destinos es una trampa. |
| Modo ruta en la calle | Mínima, sin iconos | **No** | Una sola tarea, una mano, sol de frente. Cada píxel es para el cobro. |
| Hojas inferiores y modales | **Ninguna** · solo asa y cerrar | **No** | La página de atrás sigue visible con su velo: el contexto ya está dado. |
| Firma del pagaré | **Nada**, ni barra de estado | **No** | Horizontal y el teléfono cambia de manos. Quien firma no debe poder navegar. |
| Registro y onboarding | Solo la espina de progreso | **No** | Todavía no hay a dónde navegar. Una sola barra de principio a fin. |
| Portal del cliente | Nombre del prestamista | **No** | No es la app: es una consulta. Y el cliente no conoce "Control Finanzas". |

### La pregunta que decide

> **¿El usuario llegó aquí buscando, o llegó a hacer una cosa?**
>
> Buscando → armazón completo.
> A hacer una cosa → solo la salida.
> Si la respuesta es "las dos", la pantalla está haciendo demasiado y hay que partirla.

### Lo que nunca cambia

1. **La cabecera siempre mide 56px** y la barra inferior es **siempre una pastilla de
   62px a 18px del borde** — nunca anclada, nunca de otra altura. Juntas son **137px**.
   Nunca hay una tercera altura.
2. **La cabecera nunca se encoge al hacer scroll.** En una app que se usa de pie y en
   movimiento, un objetivo que se mueve es un objetivo que se falla.
3. **El dorado nunca aparece en el armazón**, salvo la pastilla del destino activo
   (`#FDF3D6`). El botón + va en carbón con el signo dorado, no al revés.
4. Cuando la pastilla no está, **su sitio lo ocupa la acción de la pantalla** en una
   barra de acción anclada (`background:#FFF`,
   `border-top:1px solid rgba(20,20,28,.09)`, `padding:14px 20px 22px`), o en un botón
   de píldora flotante en la misma posición (`left:16px; right:16px; bottom:18px;
   height:62px; border-radius:999px`) cuando la pantalla es una lista sobre la que se
   actúa. Nunca queda un hueco vacío.
