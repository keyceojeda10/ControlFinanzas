# Empieza aquí

## Qué hacer con este paquete

Este ZIP contiene el rediseño completo de Control Finanzas: **106 pantallas** (85 móvil a
390×844, 21 escritorio a 1440) y cinco documentos de especificación.

**Descomprime el ZIP dentro de tu repositorio**, por ejemplo en
`docs/design_handoff_control_finanzas/`, y luego pega en Claude Code el prompt que está
más abajo.

---

## El prompt para Claude Code

Copia y pega esto tal cual, en una sesión nueva, con el repositorio abierto:

---

```
Voy a rediseñar por completo la interfaz de Control Finanzas. En
docs/design_handoff_control_finanzas/ tienes el paquete de diseño.

ANTES DE ESCRIBIR CÓDIGO, lee estos archivos en este orden y no te salgas de ellos:

1. README.md              — contexto, fidelidad, orden de implementación
2. 01-TOKENS.md           — colores, tipografía, radios, espaciado, alturas
3. 02-ARMAZON.md          — cabecera, barra inferior, barra lateral, y la regla
                            normativa de cuándo aparecen y cuándo no
4. 03-COMPONENTES.md      — receta CSS de las 17 piezas del sistema
5. 04-CRITERIOS.md        — los criterios de diseño: jerarquía, números, copy, flujo
6. 05-PANTALLAS.md        — inventario de las 106 pantallas

Después abre "Control Finanzas - Rediseno.dc.html" en un navegador (o léelo como
texto). Es el documento visual. Está organizado en turnos, el más nuevo arriba.
Cada pantalla tiene debajo un pie de foto numerado que explica LA DECISIÓN que
resuelve — léelos, ahí está el criterio, no solo la descripción.

REGLAS DEL TRABAJO:

- El HTML es una REFERENCIA DE DISEÑO, no código para copiar. Recrea los diseños
  en el código real del proyecto (Next.js/React), con sus componentes y
  convenciones. Si un patrón no existe todavía, créalo siguiendo la especificación.

- Fidelidad ALTA. Los colores, tipografías, espaciados, radios y textos son
  definitivos. Reprodúcelos con exactitud, no los "adaptes" a la escala de
  Tailwind si eso cambia el píxel.

- Los DATOS del mockup son de ejemplo (nombres, montos). Donde el mockup y el
  sistema real difieran en datos, gana el sistema real. Donde difieran en DISEÑO,
  gana el mockup.

- No inventes pantallas ni cambies flujos que no estén en el paquete. Si algo no
  está especificado, pregúntame antes de decidirlo tú.

EMPIEZA POR:
1. Los tokens de 01-TOKENS.md en el sistema de estilos del proyecto.
2. El armazón de 02-ARMAZON.md: cabecera 56px, pastilla flotante de 62px, barra
   lateral de escritorio, y la REGLA DE SUPRESIÓN de la sección E (es lo más
   importante del rediseño: el armazón desaparece cuando el usuario está
   trabajando).
3. Los componentes base: tarjeta, bloque oscuro, pastilla de estado, barra de
   progreso, botón primario, campo con foco dorado.
4. La tarjeta de cliente/préstamo de lista — es la pieza más repetida del sistema.

Cuando termines cada bloque, muéstrame qué hiciste antes de seguir con el
siguiente. No hagas las 106 pantallas de una pasada.
```

---

## Las 5 cosas que tu agente NO puede pasar por alto

Si implementa todo lo visual pero se salta esto, pierdes la mitad del valor:

1. **La regla del armazón** (`02-ARMAZON.md` sección E). Cabecera y barra inferior
   aparecen solo cuando el usuario está navegando. En una ficha, un formulario o el modo
   ruta, desaparecen y su sitio lo ocupa la acción de la pantalla.

2. **Prestar no es una pérdida.** El "Balance neto" negativo de Mi plata está mal
   calculado por diseño: `cobrado − prestado − gastos` siempre da rojo en un negocio que
   crece. La cifra principal es *toda tu plata* = caja + calle.

3. **Nunca se bloquea el cobro.** Plan vencido o excedido bloquea *crear*; registrar
   pagos siempre funciona, y la pantalla lo dice.

4. **"Antes → después" en todo lo que cambia plata**, antes de confirmar.

5. **`font-variant-numeric: tabular-nums lining-nums` en todo número.** Es el detalle
   que hace que la app se sienta seria.

---

## Contenido del ZIP

```
00-EMPIEZA-AQUI.md              ← este archivo
README.md                       Contexto y fidelidad
01-TOKENS.md                    Colores, tipografía, radios, espaciado
02-ARMAZON.md                   Cabecera, barra inferior, sidebar, la regla
03-COMPONENTES.md               17 recetas en CSS plano
04-CRITERIOS.md                 Jerarquía, números, copy, flujo, errores a evitar
05-PANTALLAS.md                 Inventario de las 106 pantallas
Control Finanzas - Rediseno.dc.html   El documento visual (ábrelo en el navegador)
support.js                      Runtime necesario para que el HTML se vea
```

**Importante:** `support.js` tiene que quedar en la misma carpeta que el HTML para que
el documento se renderice.
