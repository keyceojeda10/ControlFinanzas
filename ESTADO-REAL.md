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
