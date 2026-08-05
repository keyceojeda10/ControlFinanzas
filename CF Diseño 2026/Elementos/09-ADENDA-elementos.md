# Elementos rediseñados — cinco piezas sueltas

> **Se suma al paquete `PAQUETE-FINAL/`. No lo reemplaza.**
> Mismos tokens (`01-TOKENS.md`), componentes (`03-COMPONENTES.md`) y criterios (`04-CRITERIOS.md`).

Esto **no son pantallas completas**: son cinco elementos que se reemplazan dentro de pantallas
que ya existen. Cada uno viene en su archivo, con el **antes** y el **después** lado a lado
cuando el contraste ayuda.

## Los cinco archivos

| Archivo | Qué reemplaza | Dónde vive |
|---|---|---|
| `E01-caja-filtros-fecha-y-pestanas.dc.html` | Las tres barras de la cabecera de Caja | Caja (todas las pestañas) |
| `E02-botones-ficha-prestamo-y-barra-lateral.dc.html` | Botón de pago, botones secundarios, barra lateral | Ficha de préstamo |
| `E03-seccion-informativa-prestamo.dc.html` | Banner IA + chips + tarjeta recurrente + línea de tiempo | Ficha de préstamo |
| `E04-informacion-de-contacto.dc.html` | El bloque "Información de contacto" | Ficha de cliente |
| `E05-ficha-cliente-y-recomendacion-lucas.dc.html` | Cabecera del cliente + recomendación IA | Ficha de cliente |
| `E00-contexto.dc.html` | — | El porqué de los cinco (opcional) |

Cada archivo trae al final un bloque **"Qué cambió"** con el razonamiento. **Léelo**: ahí está
el criterio, no solo la descripción.

---

## 1 · Caja: las tres barras → una fila

**Hoy:** periodo (5 chips) + selector de fecha nativo + pestañas (4). Unos 150px de cromo antes
del saldo.

### Qué hacer
- **Las pestañas y el periodo van en la misma fila.** Las pestañas son *navegación* (qué sección
  de caja miras); el periodo es un *filtro*. Hoy se ven idénticos: dos carriles grises apilados.
  Navegación a la izquierda, filtro a la derecha.
- **Fuera el `<input type="date">`.** Es lo único de la app que no se diseñó: cambia de aspecto
  en cada sistema operativo. Lo reemplaza una pastilla del sistema.
- **La pastilla dice el periodo Y la fecha:** `📅 Hoy · mié 5 de agosto`. Hoy están separados
  diciendo lo mismo.
- **Flechas de día anterior / siguiente** a los lados de la pastilla. La flecha del futuro va
  apagada (`opacity:.4`).
- **Los cinco periodos bajan a una hoja** que se abre al tocar la pastilla: Hoy · Ayer ·
  Últimos 7 · Últimos 30 · **Este mes** (nuevo) + Calendario para rango.

### Medidas
```css
/* pastilla de periodo */
height: 38px; padding: 0 16px; border-radius: 12px;
background: #FFF; border: 1px solid rgba(20,20,28,.10);
/* icono calendario 16px #B07D00 · "Hoy" 14px/700 #15161A · fecha 13px #63676F */

/* flechas */
width: 38px; height: 38px; border-radius: 12px;
background: #FFF; border: 1px solid rgba(20,20,28,.10);

/* carril de pestañas */
padding: 4px; border-radius: 13px;
background: #FFF; border: 1px solid rgba(20,20,28,.08);
  /* pestaña activa */   height:34px; padding:0 14px; border-radius:10px;
                         background:#15161A; color:#F4F4F1; 13px/700
  /* pestaña inactiva */ sin fondo; 13px/600 #4A4E57
```

En **móvil** las pestañas pasan a chips con scroll horizontal (`11px` de radio) y la pastilla
ocupa el ancho entre las dos flechas.

---

## 2 · Ficha de préstamo: botones y barra lateral

### El botón principal pasa de verde a dorado

⚠️ **Esto es una regla del sistema, no una preferencia.** En todo el rediseño el verde
(`#12A150`) significa *al día, pagado, a favor*. Usarlo como color de acción rompe esa lectura
justo en la pantalla donde más importa.

```css
height: 76px; border-radius: 18px;
background: #E7A400;           /* NO #1B7A3D */
padding: 0 22px;
/* icono en caja rgba(58,41,0,.14) de 44px, radio 14 */
/* etiqueta 11px/700 .09em uppercase rgba(58,41,0,.68) */
/* monto Space Grotesk 25px/600 -.03em #3A2900, tabular-nums */
/* chevron 22px trazo 2.4 #3A2900 */
```

### Los tres botones dispares → cuatro iguales

Hoy: WhatsApp y Cobros en fila, Gestión sola debajo, con subtítulos de dos palabras que no
explican nada ("Renovar, plazo, ajustes").

```css
/* fila de 4, gap 9px */
flex: 1; height: 74px; border-radius: 16px;
background: #FFF; border: 1px solid rgba(20,20,28,.09);
display: flex; flex-direction: column;
align-items: center; justify-content: center; gap: 7px;
/* icono 20px · etiqueta 13px/700 #15161A */
```

Los cuatro: **WhatsApp · Abonos · Firmar · Gestión**. Una palabra cada uno. El que necesita
subtítulo para entenderse no debería estar ahí.

### La barra lateral

- ⚠️ **Fuera el "Enviar resumen por WhatsApp" de arriba.** WhatsApp ya está en los cuatro
  botones de la columna izquierda; hoy aparece dos veces en la misma pantalla.
- **La firma deja de ser un dato y pasa a ser un pendiente.** Hoy dice "Sin firma" en gris junto
  a tres iconos sin peso. Ahora: título, desde cuándo, y **"Firmar ahora"** en dorado.
- Después, los accesos en una tarjeta de filas de 52px: comprobante · próximos pagos ·
  historial de cambios.
- **Al final, "Cancelar el préstamo"** con contorno rojo:
  ```css
  background: #FFF; border: 1px solid rgba(229,72,77,.22); border-radius: 18px;
  /* título 14px/700 #C23B40 · consecuencia 11px #63676F */
  /* botón: border 1px solid rgba(229,72,77,.3); color #C23B40 */
  ```
  Enterrada al fondo de un desplegable de gestión, se toca sin querer.

---

## 3 · Sección informativa del préstamo: cuatro bloques → uno

**Hoy hay cuatro cosas que dicen tres:**
1. Banner con ✕: "Faltan solo 5 cuotas para completar"
2. Chips: `✓ 1 cuota pagada` · `👤 Préstamo #3 con este cliente`
3. Tarjeta "Cliente recurrente · Préstamo #3 con este cliente" ← **repite el chip literal**
4. Línea de tiempo con otro chip verde

### Qué hacer

**Una tarjeta con tres filas:**

```
CÓMO VA                        del 27 de jul al 21 de ene
[barra 8px con marcador de 14px en la posición de hoy]
1 cuota pagada de 6                        faltan 169 días
──────────────────────────────────────────────  fondo #F9FBF9
📈 Va adelantado. Le faltan 5 cuotas y ya casi termina.
──────────────────────────────────────────────
👤 Es su tercer préstamo contigo · pagó los 2 anteriores   [Ver]
```

- ⚠️ **El banner con ✕ desaparece.** Un aviso que se puede cerrar es un aviso que no importaba,
  y decía lo mismo que la barra que tiene justo debajo.
- **La línea de tiempo se queda** —es buena— pero pierde el fondo crema, que la hacía parecer un
  aviso, y gana **"1 de 6 cuotas"**: los días que faltan no dicen cuántos pagos faltan.
- **"Cliente recurrente" pasa a la frase útil.** Lo que importa de un cliente repetido no es
  *que* se repita, es **cómo terminó las veces anteriores**. Ese dato hoy no está en ninguna
  parte y es con el que se decide prestarle otra vez.

El marcador de posición de hoy:
```css
position: absolute; left: 19%; top: -3px; transform: translateX(-50%);
width: 14px; height: 14px; border-radius: 999px;
background: #FFF; border: 3px solid #E7A400;
```

---

## 4 · Información de contacto

**El problema no era el aspecto: era que ningún dato hacía nada.** Un cobrador abre esa tarjeta
para *llamar* o *llegar*, y hoy tiene que copiar el número a mano y escribir la dirección en su
mapa.

### Qué hacer

- **Tres tarjetas → tres filas** de 58–60px. Cada dato ocupaba una tarjeta entera con su propio
  fondo para mostrar diez caracteres.
- **El teléfono trae dos botones**: llamar (`#4A4E57`) y WhatsApp (`#25D366`), de 38px.
- **La dirección trae "Ir"**, que abre el mapa del teléfono:
  ```css
  height: 38px; padding: 0 13px; border-radius: 12px;
  background: #F3F3EF; border: 1px solid rgba(20,20,28,.07);
  /* icono flecha 15px + "Ir" 13px/700 */
  ```
- ⚠️ **Fuera el fondo verde del teléfono.** No significa nada, y en el sistema el verde es
  "al día" — ahí se lee como si el teléfono estuviera bien y los otros dos mal.
- **"Referencia · Tienda" deja de ser una fila.** Una referencia no es un dato aparte: es parte
  de la dirección. Pasa a la segunda línea como *"al lado de una tienda"*.
- **Las etiquetas en mayúsculas desaparecen.** Un número de diez cifras con formato de celular
  ya se ve que es un teléfono; "TELÉFONO" encima le roba la mitad del peso al dato.
- **El teléfono se formatea**: `300 887 5156`, no `3008875156`.

### El aviso que la tarjeta callaba

"Calle 9" **no es una dirección**. Sin número no se puede llegar ni sale en el mapa, y ese es el
motivo real de que un cobrador se pierda.

```css
/* fila de aviso al pie de la tarjeta */
padding: 12px 18px; background: #FDF9EE;
border-top: 1px solid rgba(20,20,28,.06);
/* icono 15px #B07D00 · texto 12px #7A5800 · "Completar" 12px/700 #B07D00 */
```
→ *"La dirección está incompleta. Sin número no sale en el mapa."*

Muéstralo solo cuando la dirección no tenga número.

---

## 5 · Ficha del cliente y la recomendación de Lucas

### La cabecera del cliente

- ⚠️ **El avatar morado sale de la paleta.** Pasa a `#F3F3EF` con **borde de 2px del color de su
  estado** (verde al día, ámbar atraso leve, rojo mora), que es como se ve el estado en todas las
  listas del sistema. El morado no significa nada y se lee como otra app.
- **Los datos en una línea, no en tres**, y con lo que falta:
  `CC 81.283.812 · 310 452 1188 · Ruta #1`. Hoy no están ni el teléfono ni la ruta.
- **El chevron sin destino → tres acciones**: llamar · WhatsApp · menú (⋮), de 40px.
- **Añadir la tira de cuatro cifras** que la ficha no tiene:
  `Le debe · Cuota · Próximo cobro · Cómo paga`. Es la información con la que se decide prestar
  otra vez, y hoy hay que bajar a buscarla.

### La recomendación IA vuelve como Lucas

**Hoy** es un banner gris con una chispa y un ✕, indistinguible de un aviso del sistema.

**Ahora** es un bloque negro con la marca de Lucas:

```css
background: #15161A; border-radius: 18px; padding: 18px 20px;
```
```
[icono 30px #E7A400 con chispa #3A2900]  Lucas te sugiere    al día · 3er préstamo

Le puedes prestar hasta $1.500.000 sin subir tu riesgo.     ← 17px, cifra en #F5B824

Pagó completos los 2 préstamos anteriores y este va         ← 13px #A3A8B2
adelantado. Tienes $2.5M libres.
─────────────────────────────────────────────────────
[ Prestarle $1.500.000 ]  [ Otro monto ]
```

Y debajo, en tarjeta blanca aparte:
> *"Es una sugerencia, no una aprobación. Sale de cómo te ha pagado y de la plata que tienes
> libre."*

**Por qué importa:** una recomendación sin monto y sin botón es una frase. Con los dos, es una
decisión que el dueño toma en dos segundos. Y el descargo la hace honesta — la app no está
aprobando un crédito, está resumiendo lo que ya sabe.

---

## Resumen para el agente

```
1. Caja: tres barras → una fila. Fuera el input de fecha nativo.
   Pastilla "Hoy · mié 5 de agosto" + flechas de día. Periodos en una hoja.

2. Botón de pago: VERDE → DORADO. Es regla del sistema, no gusto.
   Tres botones dispares → cuatro iguales de una palabra.
   Quitar el WhatsApp duplicado de la barra lateral.
   "Cancelar préstamo" sube a la barra lateral, contorno rojo.

3. Sección informativa: cuatro bloques → una tarjeta de tres filas.
   Fuera el banner con ✕. "Préstamo #3" se dice UNA vez.
   Cliente recurrente → "su tercer préstamo · pagó los 2 anteriores".

4. Contacto: tres tarjetas → tres filas CON ACCIONES.
   Teléfono: llamar + WhatsApp. Dirección: "Ir" al mapa.
   Fuera el fondo verde. Referencia → segunda línea de la dirección.
   Aviso si la dirección no tiene número.

5. Cliente: avatar gris con borde del color de su estado.
   Datos en una línea + teléfono + ruta. Tira de 4 cifras nueva.
   Recomendación IA → bloque negro de Lucas, con monto y botón.
```
