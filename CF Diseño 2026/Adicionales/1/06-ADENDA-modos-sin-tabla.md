# Adenda · los modos sin tabla de amortización

> **Este archivo se suma al paquete `design_handoff_control_finanzas/`. No lo reemplaza.**
> Todo lo de aquí usa los mismos tokens (`01-TOKENS.md`), los mismos componentes
> (`03-COMPONENTES.md`) y los mismos criterios (`04-CRITERIOS.md`).
>
> Referencia visual: **turno 41** del documento HTML (id `41a`, el de más arriba).

---

## 0 · Por qué existe esta adenda

El paquete original diseñó las fichas de préstamo sobre los 4 modos que **tienen** tabla
de amortización. Medido en producción el 28 de julio de 2026, esos 4 modos son el
**6,2% de la cartera activa**.

| Modo | Préstamos | % | ¿Tabla? | ¿Diseñado? |
|---|---|---|---|---|
| `fijo` | 2.587 | **54,7%** | no | **sí — turno 41, pantalla 01** |
| `unico` | 882 | **18,6%** | no | **sí — turno 41, pantalla 02** |
| `manual` | 502 | **10,6%** | no | especificado en §3 de este archivo |
| `proporcional` | 464 | **9,8%** | no | especificado en §4 de este archivo |
| `solo_interes` | 141 | 3,0% | sí | sí — paquete original |
| `lineal` | 72 | 1,5% | sí | sí — paquete original |
| `saldo` | 58 | 1,2% | sí | sí — paquete original |
| `lineal_dinamico` | 24 | 0,5% | sí | sí — paquete original |

**Consecuencia de implementación:** la ficha de préstamo **por defecto** es la de
`fijo`. La ficha con tabla es la **variante** para 4 modos minoritarios.

> ⚠️ En `05-PANTALLAS.md` la ficha con tabla figura como *la* ficha de préstamo.
> **Está invertido.** Si construyes primero la de tabla, estás construyendo la excepción
> antes de la norma.

---

## 1 · Ficha `fijo` — la ficha por defecto (54,7%)

**Turno 41 · pantalla 01.** Es la ficha canónica de préstamo. Constrúyela primero.

### Qué la distingue de la ficha con tabla

| | Con tabla | `fijo` |
|---|---|---|
| Bloque oscuro dice | "Saldo pendiente" | **"Le falta pagar"** |
| Debajo del bloque | Desglose por mes (capital/interés/cuota) | **Historial de pagos** |
| El interés | Repartido por período | **Una sola cifra, en "cómo se pactó"** |
| Tira de cifras | Prestado · Cuota · Atraso · Cumple · Ganancia | **Cuota · En mora · Le faltan N cuotas** |

### Estructura, de arriba a abajo

**1 · Cabecera de detalle** (`02-ARMAZON.md`, variante de detalle, 56px)

- Título: nombre del cliente.
- Subtítulo: `$20.000 diarios · 36 días de atraso`. **La cuota va en el subtítulo**, no el
  modo: nadie llama a su préstamo "fijo".
- Acciones: WhatsApp + menú de tres puntos.
- **Sin barra inferior.**

**2 · Bloque oscuro** — `background:#15161A`, `border-radius:20px`, `padding:19px 21px`

```
LE FALTA PAGAR                    ← 10px/700 .1em uppercase #A3A8B2
$469.500                          ← Space Grotesk 34px/600 -.035em #F3F3F6
[barra 11px: 22% en #2FBE6A sobre rgba(255,255,255,.12)]
pagó $130.500 de $600.000              22%     ← 13px #A3A8B2 | 13px/700 #F5B824
```

La barra usa `totalPagado / totalAPagar`. **Funciona igual que en la ficha con tabla**:
esos dos campos sí existen para todos los modos.

**3 · Tira de tres cifras** — tarjeta blanca, `padding:15px 18px`, separadores de 1px

```
CUOTA          EN MORA         LE FALTAN
$20.000        $80.000         24 cuotas
               (#C23B40)
```

`cuotasFaltantes = ceil(saldoPendiente / cuotaDiaria)`. Es una división, no un dato
inventado: se calcula y es exacta.

**4 · Tarjeta "cómo se pactó"** — aquí y solo aquí va el interés

```
CÓMO SE PACTÓ
Le presté $500.000, me paga $600.000        ← 14px/600
30 cuotas diarias · tu ganancia $100.000    ← 12px #63676F
```

Escrito como lo diría el prestamista. **Nunca** "capital", "tasa efectiva" ni
"interés nominal".

**5 · Historial de pagos** (`flex:1`, ocupa el resto)

Filas de `fecha · medio de pago · saldo resultante` + monto a la derecha en `#0D7A3C`.
Pie: "Ver los N pagos". Es la misma tarjeta de historial de la ficha con tabla.

**6 · Barra de acción**: *Gestionar* (secundario) + *Registrar pago* (dorado).

### Las dos reglas que no se pueden romper

1. **No inventar el reparto del interés.** Se sabe que el interés total es $100.000. No se
   sabe cuánto de cada pago fue interés. Mostrar "ganancia" por pago sería fabricar un
   dato — exactamente lo que `04-CRITERIOS.md §B` prohíbe.
2. **No dibujar un calendario proyectado de 30 filas idénticas.** En `fijo` el calendario
   *es* la frase "$20.000 diarios durante 30 días", y ya está en el subtítulo y en "cómo
   se pactó". Treinta filas iguales es relleno.

---

## 2 · Ficha `unico` — pago al final (18,6%)

**Turno 41 · pantalla 02.** No es una variante menor de `fijo`: **cambia la pregunta**.

### Lo que desaparece

- **La barra de progreso.** No hay cuotas, así que estaría al 0% durante todo el plazo.
  Una barra en 0% no informa: alarma. Con 882 préstamos de este tipo, el dueño vería 882
  fichas que parecen impagas.
- **La tira de cifras de cuota.** No hay cuota diaria.

### Lo que la reemplaza: una fecha

**Bloque oscuro:**

```
TE VA A PAGAR                     ← futuro, no "le falta pagar"
$360.000                          ← Space Grotesk 38px/600
─────────────────────────────
[icono calendario 38px en rgba(245,184,36,.16)]
jueves 6 de agosto                ← 15px/700 #F3F3F6
en 9 días · todo de una vez       ← 12px #8A8E98
```

**Tarjeta "cómo se pactó"** con el patrón *antes → después* horizontal, que aquí no es
una consecuencia sino el trato mismo:

```
Le entregaste            →         te devuelve
$300.000                           $360.000
─────────────────────────────────────────────
Tu ganancia                         $60.000   (#0D7A3C)
Empezó el              7 de julio · hace 21 días
```

**Aviso neutro** (obligatorio): *"Este préstamo **no tiene cuotas**: se paga completo el
día del vencimiento. Si te abona antes, se registra igual y baja lo que falta."*

**Estado vacío del historial** — el detalle que más importa de esta pantalla:

```
[moneda 56px: #F3F3EF con border 2px rgba(231,164,0,.3), glifo $ en #B07D00]
Todavía no te ha abonado nada. Es normal: en este tipo de
préstamo se paga al final.
```

**Tranquiliza, no alarma.** Sin esa frase la ficha se lee como un impago.

**Barra de acción**: *Gestionar* + **"Registrar abono"** (no "registrar pago": aquí un
pago parcial es voluntario, no una cuota vencida).

---

## 3 · Ficha `manual` (10,6%) — deriva de `fijo`

El prestamista fija la cuota a mano y el sistema deduce el plazo. **Estructura idéntica a
`fijo`**, con tres cambios:

1. **Subtítulo de cabecera**: `$25.000 semanales · al día`. Igual que `fijo`.
2. **"Cómo se pactó" añade una línea**, porque el plazo es consecuencia y no acuerdo:

   ```
   Le presté $800.000, me paga $960.000
   Cuota que le pusiste $25.000 semanales
   Le alcanza para 39 semanas · tu ganancia $160.000
   ```

   El verbo importa: **"que le pusiste"**. El dueño decidió esa cifra y la ficha lo
   reconoce.
3. **"Le faltan N cuotas" puede ser un número feo** (39, 17, 23). No lo redondees. Si la
   última cuota queda incompleta, la tira dice `le faltan 24 cuotas` y el historial
   mostrará la última por su valor real. **No inventes una cuota final "ajustada"** si el
   sistema no la guarda.

Nada más. No hace falta pantalla nueva: es la del turno 41 · 01 con esa línea extra.

---

## 4 · Ficha `proporcional` (9,8%) — deriva de `fijo`

El interés se prorratea sobre el plazo. Para el usuario **se comporta igual que `fijo`**:
cuota fija, total fijo. La diferencia es cómo se calculó el total, no cómo se paga.

**Usa la ficha de `fijo` sin cambios estructurales.** Único ajuste, en "cómo se pactó":

```
CÓMO SE PACTÓ
Le presté $600.000, me paga $690.000
20% al mes sobre 45 días · tu ganancia $90.000
```

Es el único modo sin tabla donde **mencionar el porcentaje ayuda**, porque el total no es
un número redondo que el dueño eligió: salió de una regla de tres. Ver "20% al mes sobre
45 días" explica de dónde viene el $690.000.

En `fijo`, `unico` y `manual` **no muestres el porcentaje**: el dueño pactó un total, no
una tasa, y traducirlo a % le dice algo que no pensó.

---

## 5 · Pantalla "Más" — el quinto destino

**Turno 41 · pantalla 03.** Es **navegación**, así que lleva **armazón completo**
(cabecera 56px + pastilla flotante, con el quinto icono activo).

### Estructura

**Grupo 1 · "Más herramientas"** — tarjeta con filas de 56px. **Cada fila lleva su cifra:**

```
Mi plata                  $2.520.280 listos para prestar
¿Cómo va el negocio?      rinde 7,8% al mes            (#0D7A3C)
Reportes                  —
Gastos                    solo $10.000 este mes        (#8A6100)
Cobradores                8 sin registrar nada         (#C23B40)
Perdidos                  1 préstamo · $1.2M
```

Un menú de nombres es un índice; con la cifra al lado es un panel. "Cobradores · 8 sin
registrar nada" es un problema visible sin entrar.

**Ordenadas por frecuencia de uso, no alfabéticamente.**

**Grupo 2 · "Cargar datos"** — dos tarjetas lado a lado, fuera de la lista:
*Pasar mi cuaderno* · *Importar Excel*. Son de un solo uso; no deben competir con lo
diario.

**Grupo 3 · "Cuenta"** — Configuración · Soporte · Tutoriales. Filas de 54px.

### Lo que se oculta condicionalmente

Igual que Rutas y Equipo en el resto del sistema:

- **Socios** → solo si existe al menos un socio.
- **Quién hizo qué** → solo si hay más de un usuario.

Catorce filas de las que cuatro no aplican es peor que diez que sí.

### En escritorio no existe

La barra lateral ya lista todo con sus grupos plegables. **No construyas una pantalla
"Más" en 1440.**

---

## 6 · "Comparar modos" → renombrar a **"Comparar calendarios"**

**No hace falta diseñar nada. Es un cambio de título.**

La pantalla del turno 12 no compara *modos de interés*: compara **calendarios de pago**.
Los 4 que muestra son exactamente los 4 que tienen calendario, así que la selección
siempre fue correcta — el título prometía los 8.

Con el nombre corregido, el hueco desaparece.

**¿Dónde se comparan los 8?** Donde ya se comparan bien: **el selector del paso 5 de
crear préstamo**. Ahí la comparación es en **lista vertical** y sobre lo único comparable
cuando no hay cronograma: total a pagar, cuota y plazo. Comparar `fijo` contra `unico` en
una tabla de meses no tiene sentido — uno no tiene meses.

Y así se respeta el criterio del propio paquete ("máximo cuatro columnas en móvil"): la
comparación de 8 vive en una lista, no en columnas.

---

## 7 · Qué se deriva y qué no

### Derivable sin diseño nuevo (aplica `03-COMPONENTES.md` + `04-CRITERIOS.md`)

- Ficha `manual` y `proporcional` → §3 y §4 de este archivo.
- **Ficha `fijo` en escritorio 1440** → misma estructura que la ficha con tabla en
  escritorio (turno 11), sustituyendo la tabla de amortización por la tabla de historial
  de pagos, que ya está diseñada ahí. El panel derecho (próximo cobro · el cliente ·
  documentos) no cambia.
- Tarjeta de lista de un préstamo sin tabla → **la misma tarjeta de lista de siempre**.
  `totalPagado/totalAPagar` alimenta la barra y `diasMora` el riel de estado. No cambia
  nada.
- Ficha de préstamo **completado** → misma ficha, riel y pastilla en verde, bloque oscuro
  dice "Terminó de pagar" con la fecha, y la barra de acción se reduce a *Prestarle otra
  vez*.

### No derivable — pregúntame antes

- **Socios**: no hay ninguna pantalla en el paquete y no sé cómo reparten utilidades.
  Si hace falta, es un diseño nuevo.
- Cualquier flujo de **renovación** que no sea "crear préstamo con los datos
  prellenados".

---

## 8 · Resumen para el agente

```
1. Construye la ficha `fijo` (turno 41 · 01) como LA ficha de préstamo.
2. Construye la ficha `unico` (turno 41 · 02) como variante: sin barra de
   progreso, con fecha de vencimiento y estado vacío que tranquiliza.
3. `manual` y `proporcional` = ficha `fijo` + la línea extra de §3 / §4.
4. La ficha con tabla del paquete original es la variante para 4 modos que
   suman el 6,2%. Constrúyela DESPUÉS.
5. Renombra "Comparar modos" a "Comparar calendarios". Nada más que hacer ahí.
6. La pantalla "Más" (turno 41 · 03) es navegación: armazón completo.
   No la construyas en escritorio.
7. Nunca repartas el interés por pago en un modo sin tabla. El dato no existe.
```
