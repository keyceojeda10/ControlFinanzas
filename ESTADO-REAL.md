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
