# Rediseño 2026 — cuaderno de trabajo

Se rehace pantalla por pantalla contra el handoff, **empezando por el acceso**.

**Método:** localizar el diseño en el `.dc.html` → reescribir → `node scripts/recorrer.mjs`
→ mirar la captura → ajustar → commit.

```bash
node scripts/sesion-dev.mjs      # sesión local (no crea cuentas, no toca la BD)
node scripts/sembrar-demo.mjs    # cartera de prueba; --borrar la deshace
node scripts/recorrer.mjs        # 14 pantallas × móvil y escritorio
```

---

## Hecho

### Login — turno 4 · «08 · Entrar»
Copy del handoff: «Entra a tu cartera / Tus clientes, tus rutas y tu caja, donde
los dejaste». El anterior no decía a **qué** vuelves. Campos de 56px con etiqueta
arriba y 16px (por debajo, iOS hace zoom al enfocar). «La olvidé» sube a la fila
de la etiqueta: debajo del campo se lee *después* de escribir mal la clave.

Y **la salida al portal del deudor**, que no existía: el cliente final llegaba
al login y se quedaba sin entender qué hacer, porque la pantalla le pide un
correo que él nunca tuvo.

> ⚠️ **Pendiente:** la casilla «mantener la sesión» todavía no hace nada.
> NextAuth v4 tiene el `maxAge` global, no por inicio de sesión, así que
> respetarla es un cambio de backend. **Si no se va a hacer, hay que quitarla**:
> un control que no hace nada enseña a desconfiar de los que sí hacen.

### Registro — de 6 pantallas a 4
La portada de bienvenida **fuera**: «nadie se registra para leer una portada».
Era un clic entero antes de poder escribir nada, y solo repetía el título de la
página. Quitándola quedan exactamente los 4 pasos del diseño: nombre · negocio ·
WhatsApp · correo y clave.

Entra **la espina del onboarding**, no una barra propia: una sola barra desde que
se registra hasta que carga su cartera. (`ProgressBar` estaba definido en el
archivo y no se usaba en ninguna parte — por eso el diseño dice que ahí va la
espina.)

Al quitar la portada, el «Atrás» del primer paso quedó apuntando a nada. Fuera.

### Antes, en esta misma sesión
- **Armazón** cableado y sólido: 0 problemas estructurales en 28 capturas.
- **Avisos** del marco a una línea de 40px (`FranjaAviso`). Antes eran dos
  bloques de ~100px apilados: un tercio del teléfono antes de empezar.
- **Clientes**: cabecera + tarjetas del rediseño, completa.
- **Préstamos y Rutas**: tarjetas del rediseño (cabeceras aún viejas).
- **Más**: ruta nueva con su API.
- **Seguridad**: 11 rutas del dashboard se abrían sin sesión. Arreglado, con un
  test que compara la lista del middleware contra el disco.

---

## Dónde está cada diseño

El índice de las 80 pantallas vive en el `.dc.html`. Para encontrar una:

```bash
python -c "
import io,re,html
s=io.open('CF Diseño 2026/design_handoff_control_finanzas/Control Finanzas - Rediseno.dc.html',encoding='utf-8',errors='ignore').read()
t=re.sub(r'<[^>]+>','|',s); t=html.unescape(t)
i=t.find('08 · Entrar')
print(t[max(0,i-2000):i+900].replace('|','\n'))
"
```

Títulos útiles: `08 · Entrar` (login) · `02 · Registro` · `01 · Panel del dueño` ·
`02 · Cobrar hoy` · `01 · Caja del día` · `04 · Cartera vacía` (onboarding).

---

## Lo que sigue, en orden

1. **Onboarding** (`04 · Cartera vacía`) — sin rediseñar.
2. **Cabeceras de préstamos y rutas** — siguen las viejas; préstamos tiene tres
   filas de chips.
3. **Panel, Cobrar hoy, Caja** — componente hecho, sin cablear.

---

## Bloqueos y avisos

**El archivo de diseño del proyecto es más nuevo que mi copia local.** El del
proyecto se llama `Control Finanzas - Rediseño.dc.html` (con ñ, en la raíz) y es
el archivo de trabajo; el mío es `design_handoff_control_finanzas/…Rediseno.dc.html`.
No lo pude bajar entero: el MCP corta a 256 KiB y el archivo pesa ~1,8 MB.
→ **Si algo no cuadra, la fuente buena es la del proyecto.**

**Decisiones del diseñador que cambian trabajo ya hecho** (de `PENDIENTES.md`,
28 jul — detalle en `DESIGN.md`):

- El **modo ruta va en claro**, no en oscuro. Desmentido con 15.141 pagos
  reales: antes de las 8 a.m. solo el 1,9%, hora pico 17:00.
- **La moneda se queda** y sustituye a Capi en las 80 pantallas. Yo había
  anotado lo contrario; ya está corregido. **Pero no sustituir en masa
  todavía**: el diseñador la va a rediseñar («son un emoji redondo con cara, la
  forma no dice nada del negocio»).
- Los módulos secundarios usan **los nombres del usuario**: «¿Cómo va el
  negocio?» y no analíticas, «Mi plata» y no capital.

**Bugs de diseño abiertos en producción**, del backlog: emojis en caja (9
caritas tristes, una por cobrador), verde donde va dorado en la ficha de PC, y
todo entrando a caja como efectivo.

**Pendiente de decisión tuya:** las tarjetas de lista perdieron las acciones en
línea (WhatsApp directo). Es lo que dice el handoff —se toca para abrir la
ficha— pero le cambia el gesto diario a los cobradores. Se revierte con una prop
si en la calle pesa más el atajo.
