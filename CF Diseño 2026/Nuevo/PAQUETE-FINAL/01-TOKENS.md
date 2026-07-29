# 01 · Tokens

Valores exactos. No aproximes ni "redondees a la escala de Tailwind" si eso cambia el
píxel: estos números están elegidos.

## Colores — tema claro

### Superficies
| Token | Hex / rgba | Uso |
|---|---|---|
| `surface` | `#F4F4F1` | Fondo de la app. Hueso cálido, no blanco. |
| `card` | `#FFFFFF` | Toda tarjeta, fila de tabla, campo, barra de acción. |
| `card-alt` | `#F9F9F6` | Cabeceras de grupo dentro de una tarjeta (día en un historial, ruta en un reporte). |
| `fill` | `#F3F3EF` | Relleno de controles inactivos, avatares sin foto, cabecera de tabla, pista de barras de progreso. |
| `fill-2` | `#E4E4DF` | Interruptor apagado, barras de gráfico inactivas. |
| `keyboard` | `#D3D4D9` | Fondo del teclado del sistema (solo en mockups). |

### Trazos
| Token | rgba | Uso |
|---|---|---|
| `border` | `rgba(20,20,28,.08)` | Borde por defecto de tarjeta. |
| `border-strong` | `rgba(20,20,28,.12)` | Botón secundario, borde de marco de dispositivo. |
| `hairline` | `rgba(20,20,28,.06)` | Separador entre filas dentro de una tarjeta. |
| `divider` | `rgba(20,20,28,.07)` | Separador entre bloques de una tarjeta; separadores verticales de una tira de cifras. |
| `chevron` | `rgba(20,20,28,.30)` | Flechas de "entrar". |

### Texto
| Token | Hex | Uso |
|---|---|---|
| `ink` | `#15161A` | Texto principal, cifras, títulos. |
| `ink-2` | `#4A4E57` | Texto secundario, descripciones, etiquetas de botón secundario. |
| `ink-3` | `#63676F` | Etiquetas de sección, metadatos, texto de apoyo. |
| `ink-4` | `#8E929A` | Placeholder, estado deshabilitado, números de fila. |

### Dorado — el acento de marca
| Token | Hex | Uso |
|---|---|---|
| `gold` | `#E7A400` | Acción primaria, foco de campo, barra de progreso activa, riel de nav activa. |
| `gold-light` | `#F5C518` | Borde de 2px del logo y de la moneda. |
| `gold-ink` | `#3A2900` | Texto SOBRE dorado. Nunca blanco sobre dorado. |
| `gold-dark` | `#B07D00` | Enlaces y acciones textuales ("Ver todos", "Asignar", "Cambiar"). |
| `gold-text` | `#7A5800` | Texto sobre `gold-tint`. |
| `gold-text-2` | `#8A6100` | Texto de estado "atraso leve". |
| `gold-tint` | `#FDF3D6` | Fondo de nav activa, de chip seleccionado, de aviso ámbar. |
| `gold-tint-2` | `#FDF9EE` | Fila de tabla destacada / seleccionada. |
| `gold-focus` | `rgba(231,164,0,.13)` | Anillo de foco (`box-shadow: 0 0 0 3px`). |
| `gold-border` | `rgba(231,164,0,.30)` | Borde de tarjeta de aviso ámbar. |
| `gold-bg` | `rgba(231,164,0,.14)` | Fondo de pastilla de estado ámbar. |

### Estado
| Token | Hex / rgba | Uso |
|---|---|---|
| `red` | `#E5484D` | Mora, pérdida, punto de estado. |
| `red-dark` | `#C23B40` | Texto rojo sobre blanco. |
| `red-darker` | `#A8353A` | Texto rojo dentro de un aviso rojo. |
| `red-bg` | `rgba(229,72,77,.07)` | Fondo de aviso rojo. |
| `red-border` | `rgba(229,72,77,.22)` | Borde de aviso rojo. |
| `red-pill-bg` | `rgba(229,72,77,.12)` | Fondo de pastilla de mora. |
| `red-pill-border` | `rgba(229,72,77,.25)` | Borde de pastilla de mora. |
| `green` | `#12A150` | Al día, pago recibido, punto de conexión. |
| `green-dark` | `#0D7A3C` | Texto verde sobre blanco. |
| `green-pill-bg` | `rgba(18,161,80,.12)` | Fondo de pastilla "al día". |
| `green-pill-border` | `rgba(18,161,80,.25)` | Borde de pastilla "al día". |
| `blue` | `#2F6FED` | **Solo** el avatar del usuario y su punto de ubicación en el mapa. Azul = persona, nunca dinero. |
| `whatsapp` | `#25D366` | Solo el icono y el botón de enviar por WhatsApp. Única excepción de marca permitida. |
| `whatsapp-bubble` | `#DCF8C6` | Burbuja de mensaje en la vista previa. |
| `whatsapp-highlight` | `#C3ECAB` | Dato rellenado dentro de la burbuja. |

### Velos y sombras
| Token | Valor | Uso |
|---|---|---|
| `scrim` | `rgba(20,20,28,.42)` | Velo detrás de una hoja inferior. |
| `scrim-modal` | `rgba(20,20,28,.50)` | Velo detrás de un modal centrado (escritorio). |
| `shadow-sheet` | `0 -12px 32px rgba(20,20,28,.18)` | Hoja inferior. |
| `shadow-modal` | `0 24px 64px rgba(20,20,28,.40)` | Modal centrado. |
| `shadow-fab` | `0 6px 20px rgba(231,164,0,.40)` | Botón + de la barra inferior. |
| `shadow-float` | `0 8px 28px rgba(20,20,28,.18)` | Tarjeta flotante sobre un mapa. |
| `shadow-pill` | `0 3px 12px rgba(20,20,28,.16)` | Leyenda flotante. |
| `shadow-card` | `0 1px 3px rgba(20,20,28,.05)` | Elemento de lista seleccionado. |
| `shadow-knob` | `0 1px 3px rgba(20,20,28,.24)` | Perilla de interruptor. |

## Colores — tema oscuro

**El tema oscuro son cuatro valores, no un rediseño.** Tipografía, espaciado, radios y
la gramática de cifras son idénticos.

| Token claro | Token oscuro | Nota |
|---|---|---|
| `surface #F4F4F1` | `#15161A` | |
| tarjeta elevada sobre oscuro | `#1E1F24` | **No negro puro**, para que los bordes se sigan viendo. |
| `ink #15161A` | `#F3F3F6` | |
| `ink-2 #4A4E57` | `#A3A8B2` | |
| `ink-3 #63676F` | `#8A8E98` | |
| `gold #E7A400` | `#F5B824` | Más claro, para contraste sobre oscuro. |
| `green #12A150` | `#2FBE6A` | |
| `red #E5484D` | `#F0575C` | |
| `card #FFF` | `rgba(255,255,255,.06)` | Relleno de tarjeta sobre superficie oscura. |
| `border` | `rgba(255,255,255,.09)` – `.12` | |
| `fill` | `rgba(255,255,255,.07)` | |

El **bloque oscuro** (ver `03-COMPONENTES.md`) usa estos mismos valores en tema claro,
porque es una isla oscura dentro de una pantalla clara.

## Tipografía

Dos familias. Ninguna más.

```
Space Grotesk — 500, 600, 700
Manrope       — 400, 500, 600, 700, 800
```

### Reparto
- **Space Grotesk** → todo número, todo monto, todo título de pantalla, el logotipo.
  Peso 600 casi siempre.
- **Manrope** → todo texto corrido, etiquetas, botones, metadatos.

### Escala real usada

| Uso | Familia | Tamaño | Peso | letter-spacing |
|---|---|---|---|---|
| Monto héroe (bloque oscuro, móvil) | Grotesk | 33–38px | 600 | `-.035em` |
| Monto héroe (escritorio) | Grotesk | 40–52px | 600 | `-.04em` |
| Monto de tarjeta | Grotesk | 22–27px | 600 | `-.03em` |
| Monto de fila / tira de cifras | Grotesk | 14–19px | 600 | `-.02em` a `-.025em` |
| Título de pantalla (móvil) | Grotesk | 19–22px | 600 | `-.02em` |
| Título de pantalla (escritorio) | Grotesk | 26–28px | 600 | `-.025em` |
| Nombre en tarjeta de lista | Manrope | 16px | 700 | `-.015em` |
| Texto de fila | Manrope | 14px | 600 | — |
| Cuerpo / descripción | Manrope | 13px | 400–500 | — |
| Metadato / segunda línea | Manrope | 11–12px | 400–600 | — |
| **Etiqueta de sección** | Manrope | 10–11px | 700 | `.09em`–`.1em`, `uppercase` |
| Cabecera de tabla | Manrope | 11px | 700 | `.07em`, `uppercase` |
| Pastilla de estado | Manrope | 10–11px | 700 | — |
| Botón primario | Manrope | 16–17px | 700 | — |
| Botón secundario | Manrope | 14–15px | 600 | — |

### Regla obligatoria de cifras

**Todo número que represente dinero, cantidad o fecha lleva:**
```css
font-variant-numeric: tabular-nums lining-nums;
```
Sin esto, las columnas de montos bailan al cambiar de dígito y el usuario pierde la
confianza. Es el detalle más importante de la tipografía de esta app.

### Interlineado
- Cifras y títulos: `line-height: 1` a `1.2` (los montos grandes SIEMPRE `1`).
- Cuerpo: `1.45` a `1.55`.
- Nunca por debajo de `1.4` en texto corrido.

## Radios

| Valor | Uso |
|---|---|
| `30px` | Marco de teléfono (solo mockup). |
| `22px 22px 0 0` | Hoja inferior. |
| `20px` | Bloque oscuro héroe. |
| `18px` | **Tarjeta estándar.** El más usado. |
| `16px` | Tarjeta pequeña, campo grande. |
| `14px` | Botón, campo, chip grande. |
| `13px` | Botón de escritorio, item de nav. |
| `11px` | Chip, pastilla de estado, botón pequeño. |
| `10px` | Icono contenedor pequeño. |
| `6px` | Tecla de teclado. |
| `999px` | Barra de progreso, avatar, punto, pastilla redonda. |

## Espaciado

No hay una escala rígida de 4px. Los valores reales, por contexto:

| Contexto | Valor |
|---|---|
| Padding lateral de pantalla (móvil) | `20px` |
| Padding lateral de pantalla (escritorio) | `36px` |
| Padding lateral de hoja inferior | `22px` |
| Padding interior de tarjeta | `16–20px` vertical, `19–22px` horizontal |
| Padding interior de bloque oscuro | `19–21px` (móvil), `24–30px` (escritorio) |
| Gap entre tarjetas de una columna | `11–13px` (móvil), `16–18px` (escritorio) |
| Gap dentro de una tarjeta | `11–14px` |
| Gap entre chips | `6–8px` |
| Padding de fila de tabla | `0 24px` |
| Barra de acción inferior | `14px 20px 22px` |

## Alturas fijas

| Elemento | Altura |
|---|---|
| Barra de estado (mockup) | `44px` |
| **Cabecera móvil** | `56px` |
| **Barra inferior móvil** | `76px` |
| Botón + de la barra inferior | `58px`, desplazado `-18px` |
| Botón primario móvil | `52–56px` |
| Botón secundario móvil | `46–50px` |
| Campo de texto móvil | `52–56px` |
| Campo de monto (héroe) | `64–88px` |
| Chip / filtro | `33–36px` |
| Chip grande (opción) | `42–50px` |
| Pastilla de estado | `20–24px` |
| Fila de lista dentro de tarjeta | `46–56px` |
| Fila de tabla (escritorio) | `42–56px` |
| Cabecera de tabla | `38–44px` |
| Botón de escritorio | `40–42px` |
| Item de nav lateral | `35–38px` |
| Interruptor | `46 × 28px`, perilla `22px` |
| Barra de sidebar (escritorio) | `230–250px` de ancho |
| Objetivo táctil mínimo | **`44px`** — nunca menos |

## Lienzos

| Vista | Tamaño |
|---|---|
| Móvil | `390 × 844` |
| Escritorio | `1440 × alto variable` |

No hay tablet en este rediseño. Si hace falta, la regla es: por debajo de 900px de
ancho se usa el diseño móvil a ancho completo; por encima, el de escritorio.
