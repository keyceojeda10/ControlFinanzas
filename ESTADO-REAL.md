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
| `rutas/[id]` · 3.098 líneas | 2 bloques (`LoPuestoAqui`, `LoDeHoy`) | **todo lo demás** — cabecera, lista de clientes, 10 modales, cierre, modo ruta |

Es 1 import de rediseño sobre 25. La lámina de escritorio que le corresponde
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

Están hechos y cotejados, viven solo en `/estilo`. Montar cada uno es cablear,
no diseñar:

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
| T03-01 cobrar hoy | T02-02 | pendiente |
| T03-02 filtros y orden | los 4 chips de hoy | pendiente |
| T27-02 detalle de ruta | T04-02 | pendiente |
| T15-02 atajos de cobro | *nunca diseñada* | pendiente |
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
