# Handoff — Rediseño de Control Finanzas

## Qué es esto

Control Finanzas es una app para prestamistas independientes en Colombia: gestionan
clientes, préstamos, rutas de cobro, caja y cobradores. El usuario principal es el
**dueño** (que casi siempre cobra él mismo) y, en un 5% de las cuentas, un equipo de
**cobradores** que trabajan de pie, en la calle, con una mano ocupada.

Este paquete contiene el rediseño completo: **106 pantallas** (85 de móvil a 390×844 y
21 de escritorio a 1440), organizadas en 39 turnos de trabajo dentro de un solo
documento HTML.

## Lo más importante que tienes que entender

**Los archivos HTML de este paquete son REFERENCIAS DE DISEÑO, no código de
producción.** Son prototipos que muestran el aspecto y el comportamiento buscados.

Tu tarea NO es copiar el HTML. Tu tarea es **recrear estos diseños dentro del código
real de la app** (Next.js / React, según `app/globals.css` y `app/layout.js`),
usando sus componentes, sus utilidades y sus convenciones. Si un patrón del rediseño
no existe todavía en el código, créalo siguiendo las especificaciones de estos
documentos.

**Fidelidad: alta (hi-fi).** Los colores, tipografías, espaciados, radios y textos son
definitivos. Reprodúcelos con exactitud. Donde el documento y la app real difieran en
*datos* (nombres de clientes, montos, conteos), gana la app real: los datos del
mockup son de ejemplo. Donde difieran en *diseño*, gana el mockup.

## Cómo leer este paquete

Léelos en este orden. Cada uno es normativo.

| Archivo | Qué contiene |
|---|---|
| `01-TOKENS.md` | Colores exactos, tipografía, escala de espaciado, radios, sombras. **Empieza aquí.** |
| `02-ARMAZON.md` | Cabecera, barra inferior, barra lateral de escritorio, y **la regla de cuándo aparecen y cuándo no**. |
| `03-COMPONENTES.md` | Receta exacta de cada pieza: tarjetas, modales, hojas inferiores, tablas, botones, campos, pastillas, barras. |
| `04-CRITERIOS.md` | Los criterios de diseño: cómo se decide una jerarquía, cómo se escribe el copy, cómo se formatean los números. **Esto es el "por qué".** |
| `05-PANTALLAS.md` | Inventario de las 106 pantallas: qué es cada una, en qué turno del HTML está, y qué decisión resuelve. |
| `Control Finanzas - Rediseno.dc.html` | El documento visual completo. Ábrelo en un navegador. |

## Regla de oro del rediseño

> **La plata es lo único que brilla.**

El dorado (`#E7A400`) se reserva para: el monto principal de una pantalla, la acción
primaria, y el foco del campo activo. Nada más. El armazón de navegación es gris. Las
tarjetas son blancas sobre un fondo hueso. El estado (mora, al día, atraso) va en un
**borde, una pastilla o una barra** — nunca tiñendo el fondo de la tarjeta.

Esto corrige el defecto principal del diseño actual: cada tarjeta de lista está teñida
de rosa, ámbar o rojo, y el resultado es un muro chillón donde nada destaca porque todo
destaca.

## Lo que este rediseño cambia de fondo (no solo de aspecto)

Estas son decisiones de producto, no de estilo. Si las implementas solo visualmente,
pierdes la mitad del valor.

1. **Prestar no es una pérdida.** La pantalla "Mi plata" mostraba un "Balance neto"
   negativo en rojo (`cobrado − prestado − gastos`). Esa resta no es un balance: un
   negocio que crece siempre saldrá rojo. Ahora la cifra principal es *toda tu plata* =
   caja + calle.
2. **Nunca se bloquea el cobro.** Cuando el plan se excede o se vence, se bloquea crear
   préstamos nuevos; registrar pagos sigue funcionando siempre, y se dice explícitamente.
3. **El armazón desaparece cuando hay trabajo.** Ver `02-ARMAZON.md`.
4. **Todo lo que cambia plata muestra "antes → después"** en un bloque oscuro antes de
   confirmar.
5. **Toda pantalla de cobro tiene salida hacia adelante**: la acción de confirmación es
   "cobrar y pasar al siguiente", con el nombre del siguiente cliente.
6. **El plan se elige después de cargar los datos**, no antes. Nadie puede escoger entre
   20, 40 o 100 clientes cuando lleva ocho minutos en la app.
7. **El registro de actividad agrupa lo repetido** y señala anomalías, en vez de listar
   todo con el mismo peso.

## Orden de implementación sugerido

1. Tokens y tipografía (`01-TOKENS.md`) — sin esto nada más encaja.
2. Armazón: cabecera, barra inferior, barra lateral, y la regla de supresión.
3. Los componentes base: tarjeta, bloque oscuro, pastilla de estado, barra de progreso,
   botón primario, campo con foco dorado.
4. La tarjeta de cliente/préstamo de lista (es la pieza más repetida del sistema).
5. Las pantallas de navegación: panel, cobrar hoy, clientes, préstamos, rutas, caja.
6. Los modales de cobro y de gestión.
7. Escritorio.
8. Onboarding, registro, portal del cliente.

## Nota sobre los datos del mockup

El mockup usa el conjunto de datos real de la cuenta de prueba: **31 clientes, 68
préstamos, cartera de $25.096.136, 9 rutas, 8 cobradores**. Dos pantallas usan estados
hipotéticos y lo dicen en su pie de foto (el plan excedido y el esqueleto de carga).
