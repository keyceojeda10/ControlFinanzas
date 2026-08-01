# Estado real del rediseño — 31 jul 2026

**Esto no es una valoración mía. Sale de contar imports.** El comando está al
final para que lo puedas volver a correr cuando quieras.

---

## La respuesta corta

De las pantallas de la app, **28 no tienen ni una línea del rediseño**. No están
«mal rediseñadas»: están sin tocar. Y de las de escritorio (1440), **29 láminas
no se han empezado**.

Cuando ves una pantalla que «no se parece», casi siempre es una de éstas. Y
cuando ves una que se parece a medias, es porque tiene dos o tres bloques nuevos
pegados encima de la anterior — que es justo lo que pasa en la ruta.

---

## Las que están a medias (lo nuevo montado encima de lo viejo)

| Pantalla | Del rediseño | Del diseño anterior |
|---|---|---|
| `rutas/[id]` · 3.098 líneas | ~~2 bloques~~ → cabecera, banda del día, atajos de cobro, modo recorrido, cierre, reordenar, capital | la lista de clientes y 9 modales |

Era 1 import de rediseño sobre 25; el 31 jul pasó a 8. La lámina de escritorio que le corresponde
—**T04-09**, con la tabla y la columna derecha— no está construida.

---

## Las 28 sin nada del rediseño

Ordenadas por tamaño, que es lo que cuesta cada una:

```
prestamos/nuevo            1879     cobradores/ranking          322
clientes/[id]              1456     lineas-credito              315
migrador                   1084     soporte/[id]                306
lineas-credito/[id]         895     lineas-credito/nueva        267
configuracion/plan          630     clavos                      253
dashboard/analiticas        529     clientes/nuevo              237
actividad                   425     soporte/nuevo               218
cobradores/nuevo            400     carga-masiva                216
cobradores/[id]/editar      354     soporte                     213
cobradores/[id]             354     mis-estadisticas            196
                                    clientes/[id]/historial     157
                                    socios/nuevo                116
                                    caja/cobrador/[id]          104
                                    clientes/[id]/editar         92
                                    qr/[id]                      64
                                    capital                      50
                                    tutoriales                   18
                                    asistente                    14
```

⚠ `prestamos/nuevo` y `clientes/nuevo` **sí** los toqué esta semana (los colapsé
a una pantalla), pero con los componentes viejos. Funcionan, no son la lámina.

---

## Los 22 componentes construidos que nadie ve

⚠ **CORRECCIÓN (31 jul): montarlos NO es «cablear, no diseñar».** Eso lo escribí
yo y es falso. Comprobados cuatro, fallan los cuatro por el mismo motivo: el
componente del banco recibe **datos ya calculados** y el de la app **los
calcula dentro**. No hay adaptador que los una, y montar el nuevo tal cual
PIERDE funciones:

| Del banco | En la app | Qué se perdería |
|---|---|---|
| `Renovar` | `RenovarPrestamo` (470) | los cálculos de entrega/ganancia, en un flujo que ya tuvo un bug de caja |
| `Lucas` | `AsistenteChat` (479) | historial, streaming, límite por plan, dictado |
| `Plantillas` | `ModalWhatsAppTemplates` (491) | construcción de plantillas, edición, secciones, extras |
| `Pagare` | `FirmaDigital` (438) | lienzo de firma, guardado, descarga |

El patrón es siempre el mismo: **el del banco es la piel, el de la app es el
motor**. El trabajo real es escribir el adaptador que los junta, no cambiar un
import. Los que SÍ son montaje directo son los que no tienen motor detrás —
`PlanExcedido` (sustituye a un `router.replace` silencioso) y `PanelCargando`
(sustituye a un esqueleto dibujado a mano).

Están hechos y cotejados, viven solo en `/estilo`:

```
Arranque       Estados        ModoRuta       Recibo         RutaCierre
Cargando       FichaCliente   Onboarding     RegistrarCobro RutaEditar
ClienteNuevo   FichaRuta      Pagare         Renovar        SociosEscritorio
CrearPrestamo  Lucas          PlanExcedido   RevisionCarga
MenuCrear      MiHistorial    Plantillas
```

---

## Láminas que corrigen a otra anterior (el fallo que me costó dos días)

El paquete numera por turnos y **un turno posterior manda sobre el anterior**.
Las descarté leyendo su nombre en vez de su pie:

| Manda | Sustituye a | Estado |
|---|---|---|
| T03-04 préstamos | T02-06 | ✅ hecha 31 jul |
| T03-03 clientes | T02-05 | ✅ hecha 31 jul |
| T03-01 cobrar hoy | T02-02 | ✅ hecha 31 jul |
| T03-02 filtros y orden | los 4 chips de hoy | ✅ hecha 31 jul |
| T27-02 detalle de ruta | T04-02 | ✅ hecha 31 jul |
| T15-02 atajos de cobro | *nunca diseñada* | ✅ hecha 31 jul |
| T28-01/02 recorriendo | T02-03, T04-04 | pendiente |
| T45-01/02/03/04 socios | T44 | decidido, T45 manda |
| T40-A cabecera | T39-01 | ✅ |

---

## Cómo volver a sacar esto

```bash
# Rutas de la app sin nada del rediseño
for f in $(find "app/(dashboard)" -name page.jsx); do
  grep -q "@/components/\(pantallas\|cf\)/" "$f" || echo "$f"
done

# Componentes que solo viven en el banco
for c in components/pantallas/*.jsx; do
  n=$(basename "$c" .jsx)
  grep -rl "pantallas/$n'" --include=*.jsx app/ | grep -qv app/estilo || echo "$n"
done

# El pie de una lámina dice qué corrige — SIEMPRE leerlo antes de construir
tail -8 "CF Diseño 2026/Nuevo/PAQUETE-FINAL/pantallas/T04-09-*.dc.html"
```

---

## Escritorio (1440) — lo medido el 31 jul

Catorce pantallas miradas a 1440 con captura. Lo que sigue NO es opinión: es lo
que se ve, con el archivo donde está.

### Hecho y cotejado

| Lámina | Qué era | Dónde |
|---|---|---|
| T02-07 panel | una columna estirada de 1.400px | `pantallas/Panel.jsx` |
| T31-01 mi plata | `<select>` del sistema con 4 cosas mezcladas | `capital/CapitalTab.jsx` |
| T31-02 negocio | **la pantalla no cargaba** | `dashboard/analiticas` |
| T32-03 quién hizo qué | 13 filas idénticas | `adaptadores/actividad.js` |
| T32-01 reportes | tarjetas apiladas → tabla | `reportes/page.jsx` |
| T07-01 clientes | tarjetas → tabla (3ª vista) | `clientes/page.jsx` |
| T14-01 préstamos | tarjetas → tabla (3ª vista) | `prestamos/page.jsx` |
| T11-03 historial | dos líneas comprimidas → tabla | `pantallas/FichaPrestamo.jsx` |
| T12-03 amortización | resumen arriba → a la derecha | `pantallas/TablaAmortizacion.jsx` |
| T23-01 error | callaba que los cobros están a salvo | `(dashboard)/error.jsx` |
| T23-00 sin resultados | solo ofrecía «limpiar búsqueda» | `clientes/page.jsx` |
| caja | selector de fecha de 1.000px | `caja/FiltroPeriodo.jsx` |
| configuración | campos de 1.200px | `configuracion/page.jsx` |

### Pendiente, con el motivo

- **T22-00 · arranque con cartera vacía.** NO es «escribirnos», como decía el
  plan. Es el embudo de activación —foto de la libreta / Excel / de cero— y es
  la pantalla que más plata mueve del producto. Sesión propia.
- **T11-03 · la columna derecha de la ficha de préstamo.** `prestamos/[id]` es
  una lista plana con `space-y-4`: la rejilla obliga a marcar la columna en cada
  hijo, si no se descoloca la pantalla entera.
- **T14-02 · rutas.** BLOQUEADA por datos: la lámina pide cartera y kilómetros
  por ruta y `/api/rutas` no los manda. La propia pantalla lo confiesa: «la
  cartera y el capital de cada ruta están adentro, en su detalle». Probé una
  rejilla de dos columnas y trunca el nombre —a 1440 solo hay ~1.040px útiles—;
  revertida.
- **E6 · configuración.** `TuNegocio` está IMPORTADO en `configuracion/page.jsx`
  y no se renderiza: importación muerta, y lo que se ve es el formulario
  anterior. Cablearlo exige comparar campo por campo (el nuevo guarda solo, el
  viejo tiene «Guardar cambios», País y Ciudad).
- **T16-01 · crear préstamo.** La lámina dice «SIN WIZARD: los tres pasos caben
  en una pantalla y el panel derecho se recalcula al escribir». Hoy siguen los
  3 pasos. Es reestructurar, no ajustar.
- **Líneas de crédito** no se pudo cotejar: la cartera de prueba tiene 0.

### Dos cercos nuevos, y por qué

- `tokens-existen.test.js` — un `var(--cf-*)` inventado NO da error: se resuelve
  a nada. Me dejó dos capas a pantalla completa transparentes. Encontró 2 más al
  primer intento.
- `display-en-linea.test.js` — `style={{display:'flex'}}` gana sobre `lg:grid`,
  así que la clase responsive no se aplica y la pantalla sale con la disposición
  del móvil a 1440. Lo hice TRES veces en un día.

### El patrón de mis fallos, para que no se repita

Casi todos fueron **leer un campo con el nombre equivocado**: `data.pago`,
`datos.sparkline7d`, `c.saldoPendiente`, `Vence` en vez de «próximo cobro».
Ninguno da error: devuelven `undefined`, la pantalla sale con `$0` o un guion, y
las pruebas pasan. **Construir las vistas nuevas sobre la salida del adaptador,
no sobre el objeto crudo** — además garantiza que dos pantallas del mismo dato
digan lo mismo.

### Herramientas nuevas de auditoría

- `.auditoria/trozo.mjs <ruta> <selector> <png> [ancho] [clave=valor…]` —
  fotografía UN elemento. Recortar por coordenadas de una captura larga no
  funciona: `getBoundingClientRect` es relativa a la ventana. Siembra
  localStorage y cierra el aviso de novedades.
- `.auditoria/pulsa.mjs` — ahora escribe (`escribe:3000000`) y exige que el
  objetivo sea VISIBLE (la tabla de escritorio vive en el DOM también en móvil y
  se llevaba los clics).
- `scripts/descobrar-hoy.mjs` — borra los cobros de hoy en local para poder
  repetir una prueba de cobro.
- `.auditoria/envejecer.mjs` — mueve hacia atrás el inicio de un préstamo para
  que genere interés vencido.

---

## Decidido: el histórico de 12 meses, sí. «Te ha dejado», no.

T15-01 (ficha de cliente en escritorio) y `FichaCliente` (C10) esperan lo mismo:
un histórico de comportamiento. Esto es lo que hay que construir y lo que no.

### SÍ · `GET /api/clientes/[id]/comportamiento`

Devuelve doce meses, del más viejo al más reciente:

```
[{ mes: '2025-08', aTiempo: 18, tarde: 4, noPago: 0 }, …]
```

**Por qué esto primero.** Contesta la única pregunta que la app hoy no contesta
—«¿este cliente paga?»— y que ahora hay que inferir leyendo una lista de pagos.
Desbloquea DOS pantallas de una vez.

**No necesita datos nuevos.** Los `Pago` con `fechaPago` ya están, y la lógica
que decide si una cuota fue a tiempo, tarde o no se pagó ya existe en
`calcularDiasMora` y en la tabla de amortización. Es ensamblar lo que hay.

Tres cosas que hay que respetar al escribirlo:

1. **El calendario es el de `fechas_un_solo_calendario`**: convenio T05:00Z,
   aritmética en UTC. Producción corre en UTC y el dev en Bogotá — los bugs de
   fecha son invisibles en local.
2. **Los días sin cobro no cuentan como «no pagó».** Un domingo marcado no
   genera mora, así que tampoco puede pintarse rojo.
3. **Un mes sin cuotas vencidas no es un mes malo**: se devuelve con los tres en
   cero y la gráfica lo deja vacío, no rojo. Un cliente nuevo no puede salir
   como el peor de la lista.

### NO (todavía) · «Te ha dejado $X de ganancia»

Es interés cobrado, no recaudado —ver `ganancia_no_es_recaudado`, que ya infló
las analíticas 7,9x una vez— y a nivel de cliente exige recorrer la cascada de
pagos préstamo por préstamo. Menos valor que el histórico y más riesgo de
enseñar una cifra de plata equivocada en la ficha de una persona.

Cuando se haga: sale de la misma cascada que `calcularCapitalRestante`, y se
prueba contra un cliente con pagos de los tres tipos (completo, parcial y abono
a capital) antes de enseñarlo.

---

## T16-01 · crear préstamo sin wizard — medido, no empezado

La lámina lo dice literal: **«sin wizard: los tres pasos caben en una pantalla y
el panel derecho se recalcula al escribir. Subir el interés de 20 a 25 mueve la
cuota, la ganancia y las ocho filas mientras se decide — que es exactamente lo
que el dueño hace hoy con una calculadora al lado.»**

**No se empezó a propósito.** Es la pantalla que crea préstamos y lleva la
aritmética del dinero dentro; a medio hacer es peligrosa, no fea.

### Lo que ya está y no hay que construir

| Qué | Dónde |
|---|---|
| El cálculo en vivo | `prestamos/nuevo/page.jsx:431` — `const calculo = useMemo(...)` |
| El estado del wizard | línea 245 — `const [paso, setPaso] = useState(0)` |
| La validación por paso | línea 519 — `if (paso === 0) …` |

Son 1.879 líneas y tres pasos: 0 cliente · 1 condiciones · 2 revisar.

### El camino más corto, y por qué

**No disolver el wizard.** En móvil los tres pasos son correctos: en 390px no
caben, y el paso a paso es lo que evita el formulario infinito. La lámina es de
1440.

En `lg`: los tres bloques apilados en la columna izquierda —sin la fila de
puntos ni los botones de «siguiente»— y el resumen del paso 2 sacado a una
**columna derecha pegajosa** que ya se recalcula sola, porque `calculo` es un
`useMemo` de los campos. La barra de acción se queda con «Revisar y crear».

Dos cosas que hay que respetar:

1. **La validación es POR PASO.** Con todo visible hay que juntarla en una sola
   comprobación antes de crear, o se podrá enviar con el paso 1 a medias.
2. **`cuotaInsuficiente`** (línea 509) ya avisa cuando la cuota no cubre el
   interés. Ese aviso tiene que quedar EN EL PANEL DERECHO, no al final: es la
   señal de que el préstamo se va a alargar solo, y el dueño la tiene que ver
   mientras mueve la tasa, no después de confirmar.

---

## T09-01 · configuración — cotejado campo por campo, NO cambiado

`TuNegocio` está **importado en la línea 5 de `configuracion/page.jsx` y no se
renderiza en ningún sitio**. Importación muerta. El formulario que se ve es el
anterior.

Cotejo de los dos, campo por campo:

| Campo | El de hoy | `TuNegocio` |
|---|---|---|
| Nombre del negocio | sí | sí |
| WhatsApp | sí | sí |
| **Ciudad** | **sí** (línea 547, va en el `body` de la línea 462) | **NO EXISTE** |
| País y moneda | no | sí, de solo lectura |
| Formato de los montos | no | sí, de solo lectura |
| Tema | no | sí, tres opciones |
| Cómo guarda | botón «Guardar cambios» | solo, al dejar el campo |

**Cambiarlo tal cual borra «Ciudad» de la pantalla** y deja de mandarla en el
`PATCH`. No es una diferencia de diseño: es un dato que se deja de poder
escribir.

Antes de montarlo hay que **añadirle `ciudad` a `TuNegocio`** —cabe en la
segunda rejilla, junto a WhatsApp— y comprobar que el guardado solo la incluye.
Lo demás del cambio es ganancia: país, formato y tema hoy no se ven en ninguna
parte de configuración.

### T09-01 · dónde va el cambio (medido, un solo sitio)

`configuracion/page.jsx` tiene **dos componentes**, y eso cambia el trabajo:

- **El panel viejo**, líneas **501-553** — «Datos del negocio»: nombre, teléfono,
  país con enlace a soporte, ciudad y «Guardar cambios».
- **El armazón del rediseño**, desde la ~1300, que monta los paneles viejos
  DENTRO de cada sección. Su comentario en la línea 1456 lo dice literal:
  *«según se vaya rehaciendo cada panel, se cambia su línea aquí y ya está»*.

Y ese armazón **ya tiene preparado todo lo que `TuNegocio` pide**:

| Prop | De dónde sale | Línea |
|---|---|---|
| `tema` / `onTema` | `tema`, `cambiarTema` | 1362, 1446 |
| país y moneda | `paisCfg` | 1424 |
| `inicial` | `org` | ya cargado |

`cambiarTema` además pasa por `setThemeGlobal` del proveedor a propósito —
escribir `localStorage` a mano cambia el tema en disco y deja la pantalla igual
hasta recargar.

**Así que el cambio es de una línea en el armazón, no de reescribir la
sección.** Con `ciudad` y `enlacePais` ya añadidos al componente
(commit `bfd1ca6c`), montarlo ya no le quita nada al formulario de hoy.

### T43-04 · lo que queda fuera, y por qué

La columna de 396px está. Lo que **no** está es la segunda mitad de la lámina:

> *«cuando la respuesta es una lista de clientes, Lucas devuelve las mismas
> tarjetas con riel de estado que hay en la lista de clientes, no texto con
> nombres»*

Eso no es diseño, es contrato: hoy el asistente contesta con texto. Para pintar
tarjetas tiene que devolver los clientes **estructurados** —id, nombre, atraso,
saldo— y no una frase que los nombre. `app/api/asistente/route.js` ya trabaja
con herramientas, así que el sitio existe; falta decidir la forma de la
respuesta y que el chat sepa pintarla.

Se deja anotado en vez de aproximarlo: sacar nombres de un texto con una
expresión regular para fingir tarjetas es exactamente el patrón que ya nos costó
una cifra mal en `lib/adaptadores/actividad.js`.

### T45-04 · socios: qué entró y qué falta, con la causa

**Entró «Tu parte»**, que la lámina no trata como adorno sino como la causa de
que el módulo no se use: sin saber cuánto puso él, el dueño no sabe si lo que va
a repartir es toda su ganancia o una parte.

**Falta la tabla de cinco columnas** —puso · le toca · ha ganado · le has dado ·
le debes— y la acción primaria «Repartir $X». No es trabajo de diseño; son dos
datos:

| Columna | Estado |
|---|---|
| puso · le toca | ya están |
| **ha ganado** | `interesesCobrados` YA viene por socio en `/api/socios`. Es cablear. |
| le has dado | ya está (`totalRetiros`) |
| **le debes** | **BLOQUEADA**: necesita el tipo de movimiento `reparto`, que no existe. `cuentaDelSocio` ya devuelve `null` a propósito — un `$0` ahí se lee como «no le debo nada» cuando lo cierto es que todavía no se ha repartido. |

`ListaSocios` ya acepta `pendiente` y `onRepartir` y nadie se los pasa: el día
que exista el movimiento de reparto, la acción primaria es cablear, no construir.

## E2 · caja y líneas de crédito — medido, con dos bloqueos reales

### T06-05 · caja en escritorio

La lámina resume la queja: *«En 1440px la caja actual gasta todo el ancho en un
"$0" y cinco mosaicos, y deja los movimientos en un desplegable»*. Pide tres
cosas: el saldo y su desglose en UNA banda, los movimientos como TABLA con hora ·
concepto · cliente · cobrador, y **el cierre de cobradores a la derecha** — *«que
es lo que el dueño mira a las siete de la tarde»*.

Medido en `app/(dashboard)/caja/page.jsx` (2.000+ líneas):

| Dónde | Qué |
|---|---|
| línea 989 | `max-w-2xl lg:max-w-5xl mx-auto space-y-4` — la vista del dueño. Se ensancha pero **sigue siendo una columna**. |
| línea 643 | `max-w-xl mx-auto` — 576px fijos, la otra vista. |
| línea 1522 | `cobradores.map(...)` — el cierre por cobrador, **en otra pestaña** («Cuadre»). |
| línea 744 | `{cantidadPagosFiltrados > 0 && pagosDiaCard}` — la tabla de movimientos ya existe y **solo se pinta si hay pagos**. |

**Dos bloqueos, ninguno de diseño:**

1. **No es cotejable con los datos de hoy.** La demo tiene 0 pagos, así que la
   tabla de movimientos —lo que la lámina quiere sacar del desplegable— no se
   pinta. Para juzgarla hay que registrar un cobro primero. No se construye a
   ciegas una pantalla que mueve plata.
2. **El cierre de cobradores vive en otra pestaña.** Traerlo a la derecha de la
   caja del día no es mover un bloque: es repartir el estado de las pestañas.

El camino corto cuando se retome: partir el cuerpo de la línea 989 en dos
columnas en `lg` —izquierda el saldo, las acciones y los movimientos; derecha el
capital por ruta y el cierre— y **registrar un cobro antes de mirar**.

### T32-02 · líneas de crédito en 1440

**Sigue sin poder cotejarse: 0 filas en la demo.** Es el mismo bloqueo que ya
estaba anotado; no ha cambiado. Sembrar una línea de crédito es el paso previo.

### Sistémico · `await req.json()` sin guarda

Medido: **92 rutas de API** hacen `await req.json()` y **solo 9** lo protegen con
`.catch()`. Con un cuerpo vacío o roto eso lanza `SyntaxError` y sale como un
**500**, no como un 400 con el motivo. Se comprobó de verdad en el desembolso de
una línea de crédito.

Para el cliente es lo peor de los dos mundos: recibe un error sin mensaje y
—porque el `.json()` de la respuesta también falla— enseña «Error de red», que
es falso: la red funcionó.

Arregladas las **5 de líneas de crédito**, que son las que se probaron rotas y
mueven plata. Las otras 87 se dejan medidas y NO se tocan en bloque: un cambio
masivo a mano sobre rutas que escriben es exactamente lo que ya salió mal con
los imports de React. Conviene un barrido dirigido, ruta por ruta, empezando por
las que escriben dinero.

### T16-01 · lo que se hizo y lo que NO, con el motivo

Al cotejarla se cayó una suposición mía: **la cuota NO estaba escondida**. La
banda verde del paso 2 es `fixed` y se recalcula al escribir — eso lo cerró
T01-06 en una sesión anterior. Repetir la cuota en un panel habría sido poner la
misma cifra dos veces en la misma pantalla.

Lo que sí faltaba de la lámina —«mueve la cuota, LA GANANCIA y LAS OCHO FILAS
mientras se decide»— es la segunda mitad:

| Pieza | Estado |
|---|---|
| La cuota en vivo | ya estaba (banda `fixed`, T01-06) |
| **La ganancia en vivo** | **hecho**: le entregas · te devuelve · ganas |
| **El aviso de cuota insuficiente donde se decide** | **hecho**: estaba al final del paso; ahora está en el panel, mientras se mueve la tasa |
| Las filas del calendario | **solo en modo Decreciente** |

**Por qué solo en Decreciente:** `calcularPrestamo` únicamente devuelve
`tablaAmortizacion` para `modo === 'lineal'` (línea 649 de `lib/calculos.js`).
En los demás modos no existe, y **no se calcula en el cliente**: repartir capital
e interés por período en el navegador es exactamente cómo se consigue que dos
pantallas digan cifras distintas del mismo préstamo. Cuando no hay tabla, el
panel no pinta filas — no inventa ninguna.

**Lo que sigue pendiente de la lámina:** «los tres pasos caben en una pantalla».
El asistente sigue siendo de tres pasos. Disolverlo es reestructurar tres
bloques de mil líneas en total sobre la pantalla que crea préstamos, y la
validación es POR PASO (`puedeAvanzarPaso`, línea 517): con todo visible hay que
juntarla en una sola comprobación antes de crear, o se podrá enviar con el paso
de condiciones a medias.

### C4 y C8 · lo que NO se monta, y por qué (medido)

Tres componentes del banco quedan sin montar **a propósito**. No es trabajo
pendiente: es la misma regla que salió en T09-01 y T38-02 — *cuando lo dibujado
tiene menos que lo que ya funciona, manda lo que funciona*.

#### `Arranque` (C4) — el asistente ya está rediseñado

Exporta cuatro pantallas, y **dos ya están superadas** por lo que se montó el 1
de agosto:

| Export | Estado |
|---|---|
| `ArranqueMetodo` | lo sustituye `TraerCartera` (T22-00), montada |
| `ArranqueCierre` | lo sustituye `ListoParaCobrar`, montada |
| `ArranquePerfil` | su equivalente vivo es `WizardWelcome` |
| `ArranqueCapital` | su equivalente vivo es `WizardCapital` |

Y los pasos que hoy se pintan **ya están con los tokens del rediseño**:

```
WizardWelcome 12 · WizardCapital 16 · WizardPlan 24 · WizardExcel 9
WizardCartulina 26 · WizardAyuda 1 · WizardProgress 7     tokens viejos: 0
```

`WizardCapital` (174 líneas) ya tiene todo lo que ofrece `ArranqueCapital`:
monto, atajos, borrar, continuar **y el enlace de escape**. Cambiarlo sería
churn visual sobre el flujo que decide si un negocio paga —0 clientes cargados =
0% de conversión— a cambio de nada.

⚠ Ojo: `WizardPerfil`, `WizardCliente`, `WizardCobrador`, `WizardFeatures`,
`WizardPrestamo`, `WizardMetodoCarga` y `WizardExito` están **importados o
presentes y NO se renderizan**. Son archivos muertos; borrarlos es tarea aparte
y sin riesgo, pero conviene hacerlo mirando cada uno.

#### `ClienteNuevo` y `CrearPrestamo` (C8)

Ya estaba escrito en `ESTADO-REDISENO.md:84` y sigue siendo cierto: la lámina de
cliente tiene **4 campos** y el formulario real tiene además referencia, notas,
grupo, tope y portal. Montarla **quita campos**. Igual con `CrearPrestamo` (295
líneas) contra el formulario real (1.909): montarlo perdería modos de interés,
mercancía, cuota manual y firma.

Lo que sí se hizo de esas dos láminas es traer lo que **añaden**: el panel de
ganancia en vivo de T16-01.
