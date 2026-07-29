# Adenda 3 · Socios

> **Se suma al paquete `design_handoff_control_finanzas/`. No lo reemplaza.**
> Mismos tokens (`01-TOKENS.md`), componentes (`03-COMPONENTES.md`) y criterios
> (`04-CRITERIOS.md`).
>
> Referencia visual: **`NUEVO-socios-turnos-44-45.dc.html`** (`support.js` en la misma carpeta).
> El archivo trae dos turnos: el **45 arriba es el que se implementa**; el 44, debajo,
> documenta el problema que el 45 resuelve. Está ahí para el "por qué", no para construirlo.

---

## 0 · La decisión de producto

El sistema tiene **dos modelos de reparto conviviendo**: por préstamo asignado (`socioId`) y
por porcentaje de participación (`metaSociedad` + %). La app muestra los dos a la vez y admite
en letra chica que el % es "una referencia".

Eso es una bomba: **un socio que ve 66,7% en pantalla cree que le toca eso.**

### Se elige uno: reparto por porcentaje del capital

```
% de cada socio = su aporte neto / total aportado por los socios
```

**Por qué el porcentaje y no el préstamo asignado:** si el reparto va por préstamo, el socio al
que le tocaron los clientes malos come una pérdida que no eligió. Eso es lo que rompe
sociedades. El porcentaje reparte el riesgo en proporción a la plata, que es lo que una
sociedad *es*.

### El `socioId` del préstamo NO se borra: cambia de trabajo

| Antes | Ahora |
|---|---|
| Decide **quién gana** el interés de ese préstamo | Dice **dónde está la plata** de cada socio |

Los 27 préstamos ya asignados siguen sirviendo, como **trazabilidad**. No hay migración que
rompa nada, y es información que un socio agradece ("mi plata está en estos 18 préstamos, con
$420.000 en mora").

⚠️ **En la ficha del socio esto se dice explícitamente**, o el malentendido vuelve:
> *"Sirve para saber dónde está su aporte. La ganancia se reparte por su 66,7%, no por estos
> préstamos."*

### El socio no es un usuario

No entra a la app, no tiene sesión, no cobra. Consecuencia de diseño: **el dueño necesita poder
mandarle su cuenta**. Es el hueco funcional más grande del módulo actual — sin eso, el socio
tiene que llamar al dueño cada vez que quiere saber cómo va.

### La pregunta del socio

No es "cómo va el negocio". Es **"cuánto puse y cuánto llevo ganado"**. Todo el módulo se
subordina a eso.

---

## 1 · El modelo de datos que hace falta

```
socio
  nombre, cedula?, telefono?, notas?
  activo: bool
  desde: fecha            ← "socio desde marzo"

movimiento_socio          ← el historial de su cuenta
  socioId
  tipo: 'aporte' | 'reparto' | 'pago'
  monto
  fecha
  nota?                   ← en reparto: "66,7% de $1.410.000"
  repartoId?              ← agrupa los movimientos de un mismo reparto

reparto
  fechaDesde, fechaHasta
  gananciaDelPeriodo
  detalle: [{ socioId, porcentaje, monto }]
```

### Las cifras derivadas

```
aporteNeto(socio)   = Σ aportes − Σ retiros de capital
porcentaje(socio)   = aporteNeto / Σ aporteNeto de todos los socios activos
haGanado(socio)     = Σ movimientos tipo 'reparto'
leHasDado(socio)    = Σ movimientos tipo 'pago'
leDebes(socio)      = haGanado − leHasDado          ← la cifra que manda
```

### Reglas duras

1. **`leDebes` es la cifra héroe de la ficha del socio**, y va en dorado `#B07D00`. La relación
   con un socio es una deuda, no un balance.
2. **Los porcentajes suman 100%** y el reparto suma exacto:
   `$826.667 + $413.333 = $1.240.000`. Un reparto que no cuadra al peso es una discusión
   familiar. Redondea el último socio para absorber el residuo.
3. **Repartir NO mueve plata de la caja.** Crea la obligación. El pago es un movimiento
   aparte. Si esto no está claro en la UI, un dueño paga dos veces.

---

## 2 · Lista de socios (turno 45 · 01)

Móvil `390×844`. Lleva **armazón completo** (se llega desde "Más", es una lista que se navega).

### Cabecera de detalle
```
[← 40]  Socios
        2 activos · reparten por lo que pusieron        ← declara el modelo
                                             [Nuevo 34px]
```

### Bloque oscuro — la sociedad en una imagen
```
TUS SOCIOS PUSIERON
$12.000.000                                  ← Space Grotesk 34px/600
[barra partida 11px: 66,7% #F5B824 | 33,3% #2FBE6A]
● Carlos 66,7%    ● Marta 33,3%              ← leyenda 12px
```

**La barra partida reemplaza a la tarjeta plegable "Participación de socios".** El modelo *se
ve*; no hace falta un acordeón que lo explique.

### La tarjeta dorada — el trabajo pendiente
```css
background: #FFF;
border: 1.5px solid #E7A400;
box-shadow: 0 0 0 3px rgba(231,164,0,.13);
```
```
GANANCIA SIN REPARTIR                    desde el 30 de junio
$1.240.000
[ Repartir la ganancia ]                 ← botón dorado 48px
```

Esto convierte Socios de pantalla de consulta en **pantalla con trabajo**, que es lo que un
dueño con socios tiene todos los meses.

### Las tarjetas de socio — dos cifras, no seis
```
[CA 36px]  Carlos Andrés
           puso $8.000.000 · 66,7%                    [›]
───────────────────────────────────────
LE HAS DADO           │  LE DEBES
$1.200.000            │  $780.000  ← #B07D00
```

**"Le has dado" y "le debes".** No "balance neto", no "intereses cobrados". Las capturas
actuales tienen seis cifras compitiendo y ninguna contesta directo.

---

## 3 · Repartir la ganancia (turno 45 · 02) — **el corazón del módulo**

Hoja inferior. **En las capturas es un botón sin pantalla, y es el acto que da sentido a todo
lo demás.**

> **El reparto es un hecho con fecha, no un cálculo en vivo.** Se declara por período, queda
> registrado, y a partir de ahí es una deuda concreta.

### Estructura

**1 · Cabecera**: "Repartir la ganancia" + `del 30 de junio al 28 de julio`.

**2 · Bloque oscuro con la trazabilidad de la cifra**
```
VAS A REPARTIR
$1.240.000                                        ← #F5B824
De $8.838.907 que entró, quitando el capital que
volvió y $10.000 de gastos.
```
**Esa última línea no es decorativa.** Sin ella, $1.240.000 es un número que el dueño no puede
defender cuando un socio pregunte de dónde salió.

**3 · El reparto, con su suma visible**
```
[CA]  Carlos Andrés · 66,7% · puso $8.000.000        $826.667
[MR]  Marta Ruiz    · 33,3% · puso $4.000.000        $413.333
────────────────────────────────────────────────────────────
      Suman                                        $1.240.000   ← fondo #F9F9F6
```
Filas de `11px` de relleno. La fila "Suman" es obligatoria.

**4 · Antes → después** (bloque oscuro, patrón estándar)
```
Les debes  $1.380.000 (tachado)  →  ahora  $2.620.000
```

**5 · El aviso que evita el error más caro** (neutro, blanco con borde)
> *"Repartir **no saca plata de tu caja**: queda anotado que se lo debes. Cuando le pagues,
> registras el retiro."*

**6 · Barra de acción**: `Repartir $1.240.000` (dorado) + "Cambiar el período" como texto.

---

## 4 · La cuenta del socio (turno 45 · 03)

Cabecera de detalle: nombre + `socio desde marzo · 66,7%`. Sin barra inferior.

### Bloque oscuro
```
LE DEBES
$780.000                                          ← #F5B824, 34px
──────────────────────────────────────────────
PUSO           │  HA GANADO      │  LE HAS DADO
$8.000.000     │  $1.980.000     │  $1.200.000
               │  (#2FBE6A)      │
```
Las tres cuadran: `1.980.000 − 1.200.000 = 780.000`.

### Las dos acciones
```
[ 📱 Mandarle su cuenta ]  ← DORADO, la principal
[ Pagarle ]                ← secundario
```
**"Mandarle su cuenta" es la acción primaria** porque el socio no entra a la app. Genera un
resumen (WhatsApp o PDF) con: cuánto puso, su %, cuánto ha ganado, cuánto se le ha pagado,
cuánto se le debe, y el detalle de los repartos.

### Dónde está su plata — el `socioId` en su nuevo trabajo
```
DÓNDE ESTÁ SU PLATA
18 préstamos suyos                                          [›]
$7.2M en la calle · $420.000 en mora
───────────────────────────────────────────────────────────
Sirve para saber dónde está su aporte. La ganancia se
reparte por su 66,7%, no por estos préstamos.
```

### Su cuenta — las tres cosas que le pasan a un socio
Con punto de color y **la fórmula visible**, para que el socio pueda reconstruir su cuenta él
mismo (que es lo que va a intentar hacer):
```
● verde   Reparto de junio · 30 jun · 66,7% de $1.410.000    +$940.000
● ámbar   Le pagaste · 12 jun · efectivo                   −$1.200.000
● azul    Puso plata · 4 mar · primer aporte                $8.000.000
```

---

## 5 · Socios en 1440 (turno 45 · 04)

### La acción primaria del encabezado no es "nuevo socio"
Es **`Repartir $1.240.000`**, con la cifra dentro. Crear socios se hace dos veces en la vida;
repartir, todos los meses.

### La tabla — cinco columnas que cuadran en el total
```
Socio (flex 1.4) │ Puso 112 │ Le toca 84 │ Ha ganado 124 │ Le has dado 124 │ Le debes 124
```
```
Total   $12.000.000   100%   $2.880.000   $1.500.000   $1.380.000
```
`2.880.000 − 1.500.000 = 1.380.000`. Con socios reales, esta tabla es la que se imprime cuando
hay discusión.

### Las tres tarjetas de la derecha
1. **Ganancia sin repartir** (borde dorado + anillo) con el desglose por socio.
2. **"Un socio no entra a la app"** — dicho explícitamente, porque un dueño va a intentar darle
   acceso.
3. **"Tu parte"** — la que faltaba del todo:
   > *"Los socios pusieron $12M de los $27.6M que tienes en la calle. El resto es tuyo y su
   > ganancia no se reparte."*

   Sin ese dato el dueño no sabe si lo que va a repartir es toda su ganancia o una parte, y esa
   duda es la que hace que nadie use el módulo.

---

## 6 · Correcciones a las capturas actuales

| Qué está mal | Qué hacer |
|---|---|
| **Tres tarjetas de degradado dorado apiladas** con cifras oscuras sobre dorado claro | Fuera. Un solo bloque oscuro `#15161A`. El contraste es bajo y el dorado deja de significar "esto importa" cuando lo lleva todo. |
| "Capital total", "Balance neto", "Intereses" sin decir cuál es cuál | `Puso` · `Ha ganado` · `Le has dado` · `Le debes` |
| **"ROI 2026"** | *"Le rinde el 16,8% de lo que puso, en 5 meses."* Nadie que pone plata en un negocio de barrio dice ROI. |
| **"Liquidacion 2026"** con navegación `‹ ›` por año | El período del reparto lo define el dueño, no el calendario. La lista de repartos va en "su cuenta". |
| Tarjeta "Participación de socios" plegable con el % como "referencia" | Fuera. El % **es** el reparto ahora, y se ve en la barra partida del bloque oscuro. |
| "Eliminar socio" al lado de "Desactivar", sin consecuencia | Si tiene movimientos, **no se puede eliminar**: solo desactivar. Eliminar borraría su historial de repartos, que es contabilidad. |
| Formulario "Nuevo socio" con Nombre/Cédula/Teléfono/Notas | Correcto, se conserva. Añadir **"cuánto está poniendo"** como campo opcional: casi siempre el socio se crea *porque* acaba de poner plata. |
| Estado vacío: *"Los socios son inversores que aportan capital al negocio y reciben intereses"* | Casi bien. Cambiar "reciben intereses" por **"se llevan una parte de la ganancia según lo que pusieron"** — declara el modelo desde el primer segundo. |

---

## 7 · Resumen para el agente

```
MODELO
  Reparto por PORCENTAJE del capital aportado. Uno solo.
  socioId del préstamo = trazabilidad ("dónde está su plata"), NO reparto.
  Decirlo en la UI o el malentendido vuelve.
  El socio NO es usuario: no entra, no cobra, no tiene sesión.

LAS CUATRO CIFRAS
  puso · ha ganado · le has dado · le debes
  leDebes = haGanado − leHasDado, en dorado, es el héroe de su ficha.

REPARTIR
  Es un hecho con fecha, registrado. No un cálculo en vivo.
  Mostrar de dónde sale la ganancia del período.
  La suma tiene que cuadrar al peso; muestra la fila "Suman".
  NO mueve plata de la caja: crea la deuda. Decirlo en un aviso.
  Es la acción primaria del módulo, en móvil y en escritorio.

LO QUE FALTA Y HAY QUE CONSTRUIR
  "Mandarle su cuenta" por WhatsApp/PDF — el socio no puede verla solo.
  "Tu parte": cuánto del capital en la calle es del dueño.
  "Ganancia sin repartir" con su fecha de corte.

NO SE PUEDE
  Eliminar un socio con movimientos. Solo desactivar.
  Repartir sin declarar el período.
  Mostrar un % que no sea el reparto real.
```
