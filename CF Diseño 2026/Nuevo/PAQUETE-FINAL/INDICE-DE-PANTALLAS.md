# ÍNDICE DE PANTALLAS

**146 pantallas · 45 turnos · una pantalla por archivo.**

Cada pantalla vive en `pantallas/` en su propio archivo. Ábrelo en el navegador (o léelo como
texto: son 200–400 líneas, todo inline) y construye **esa** pantalla. No abras el documento
maestro completo: son 18.000 líneas y no te va a caber.

## Cómo usar este índice

1. Busca en la tabla la pantalla que vas a construir.
2. Abre su archivo en `pantallas/`.
3. Abre la captura de la columna **ANTES** para ver qué existe hoy en el sistema real.
4. Lee la especificación de la columna **SPEC** para las medidas y reglas de esa familia.
5. Construye. Compara el resultado con el archivo de `pantallas/` lado a lado.

## Reglas que aplican a TODAS las pantallas

Antes de tocar la primera, lee estos tres:

- `01-TOKENS.md` — cada color, tamaño, radio y altura. **Sin esto nada encaja.**
- `02-ARMAZON.md` — cabecera, barra inferior, y **cuándo NO van** (§E).
- `03-COMPONENTES.md` — las 17 piezas del sistema en CSS plano.

Y las cuatro que se rompen más:

1. `font-variant-numeric: tabular-nums lining-nums` en **todo número**.
2. Las filas y tarjetas de contenido son `flex: none`. El único encogible es un `<div>` espaciador vacío.
3. Las barras de progreso llevan `flex: none`, o colapsan a 0px y desaparece el estado.
4. Un solo dorado `#E7A400` por pantalla: el monto principal, la acción primaria o el foco del campo.

---

## Turno 1 — Que cargar la cartera deje de ser el cuello de botella

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Perfil | movil | `pantallas/T01-01-perfil.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/02-onboarding/02-01-bienvenida.png` | `03-COMPONENTES.md` |
| 02 | Capital | movil | `pantallas/T01-02-capital.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/02-onboarding/02-03-capital.png` | `03-COMPONENTES.md` |
| 03 | Método de carga | movil | `pantallas/T01-03-metodo-de-carga.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/02-onboarding/02-04-cartulina.png` | `03-COMPONENTES.md` |
| 04 | Revisión del OCR — la pantalla clave | movil | `pantallas/T01-04-revision-del-ocr.dc.html` | — | `03-COMPONENTES.md` |
| 05 | Cierre y misiones | movil | `pantallas/T01-05-cierre-y-misiones.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/02-onboarding/02-11-checklist-misiones.png` | `03-COMPONENTES.md` |
| 06 | Crear préstamo, 7 pasos → 3 | movil | `pantallas/T01-06-crear-prestamo-7-pasos-3.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/04-crear-prestamo/04-02-monto.png` | `03-COMPONENTES.md` |
| 07 | Importar desde archivo (escritorio) | escritorio | `pantallas/T01-07-importar-desde-archivo-escritorio.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/09-entrada-datos/09-02-carga-masiva.png` | `02-ARMAZON.md §D` |
| 00 | Hoja única | movil | `pantallas/T01-00-hoja-unica.dc.html` | — | `03-COMPONENTES.md` |

## Turno 2 — Que se pueda leer al sol, con una mano y de prisa

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Panel del dueño | movil | `pantallas/T02-01-panel-del-dueno.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-01-dashboard.png` | `03-COMPONENTES.md` |
| 02 | Cobrar hoy — el arreglo del muro | movil | `pantallas/T02-02-cobrar-hoy.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-02-cobrar-hoy.png` | `03-COMPONENTES.md` |
| 03 | Modo ruta — nuevo | movil | `pantallas/T02-03-modo-ruta.dc.html` | — | `03-COMPONENTES.md` |
| 04 | Registrar pago (parcial) | movil | `pantallas/T02-04-registrar-pago-parcial.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/05-registrar-pago/05-01-registrar-pago.png` | `03-COMPONENTES.md` |
| 05 | Clientes | movil | `pantallas/T02-05-clientes.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-03-clientes.png` | `03-COMPONENTES.md` |
| 06 | Préstamos | movil | `pantallas/T02-06-prestamos.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-05-prestamos.png` | `03-COMPONENTES.md` |
| 07 | Panel (escritorio) | escritorio | `pantallas/T02-07-panel-escritorio.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/escritorio/pc-01-dashboard.png` | `02-ARMAZON.md §D` |

## Turno 3 — La tarjeta tiene que servir para trabajar, no solo para verse

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Cobrar hoy, con datos | movil | `pantallas/T03-01-cobrar-hoy-con-datos.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-02-cobrar-hoy.png` | `03-COMPONENTES.md` |
| 02 | Filtros y orden — nuevo | movil | `pantallas/T03-02-filtros-y-orden.dc.html` | — | `03-COMPONENTES.md` |
| 03 | Clientes, con datos | movil | `pantallas/T03-03-clientes-con-datos.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-03-clientes.png` | `03-COMPONENTES.md` |
| 04 | Préstamos, con datos | movil | `pantallas/T03-04-prestamos-con-datos.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-05-prestamos.png` | `03-COMPONENTES.md` |

## Turno 4 — La ruta es la pantalla de trabajo, no el resumen del dueño

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Rutas | movil | `pantallas/T04-01-rutas.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-08-rutas.png` | `03-COMPONENTES.md` |
| 02 | Detalle de ruta — la pantalla que más se usa | movil | `pantallas/T04-02-detalle-de-ruta.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-09-ruta-detalle.png` | `03-COMPONENTES.md` |
| 03 | La ruta al cerrar el día | movil | `pantallas/T04-03-la-ruta-al-cerrar-el-dia.dc.html` | — | `03-COMPONENTES.md` |
| 04 | Recorriendo, en claro | movil | `pantallas/T04-04-recorriendo-en-claro.dc.html` | — | `03-COMPONENTES.md` |
| 05 | Ficha de préstamo | movil | `pantallas/T04-05-ficha-de-prestamo.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-06-prestamo-ficha.png` | `03-COMPONENTES.md` |
| 06 | Portal del cliente · acceso | movil | `pantallas/T04-06-portal-del-cliente-acceso.dc.html` | — | `03-COMPONENTES.md` |
| 07 | Portal del cliente · su préstamo | movil | `pantallas/T04-07-portal-del-cliente-su-prestamo.dc.html` | — | `03-COMPONENTES.md` |
| 08 | Entrar | movil | `pantallas/T04-08-entrar.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/01-acceso/01-01-login.png` | `03-COMPONENTES.md` |
| 09 | Detalle de ruta (escritorio) | escritorio | `pantallas/T04-09-detalle-de-ruta-escritorio.dc.html` | — | `02-ARMAZON.md §D` |

## Turno 5 — Nueve modales sueltos y los estados que nadie diseña

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Menú de gestión | movil | `pantallas/T05-01-menu-de-gestion.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/07-gestion-prestamo/07-00-menu-gestion.png` | `03-COMPONENTES.md` |
| 02 | Renovar — el patrón | movil | `pantallas/T05-02-renovar.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/07-gestion-prestamo/07-05-renovar.png` | `03-COMPONENTES.md` |
| 03 | Días sin cobro | movil | `pantallas/T05-03-dias-sin-cobro.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/07-gestion-prestamo/07-09-dias-sin-cobro.png` | `03-COMPONENTES.md` |
| 04 | Cartera vacía | movil | `pantallas/T05-04-cartera-vacia.dc.html` | — | `03-COMPONENTES.md` |
| 05 | Sin conexión | movil | `pantallas/T05-05-sin-conexion.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/15-estados/15-05-sin-conexion.png` | `03-COMPONENTES.md` |
| 06 | Cargando | movil | `pantallas/T05-06-cargando.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/15-estados/15-04-skeleton-cargando.png` | `03-COMPONENTES.md` |

## Turno 6 — La caja tiene que cuadrar sola

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Caja del día | movil | `pantallas/T06-01-caja-del-dia.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-07-caja.png` | `03-COMPONENTES.md` |
| 02 | Cierre de cobradores — adiós a las caritas | movil | `pantallas/T06-02-cierre-de-cobradores.dc.html` | — | `03-COMPONENTES.md` |
| 03 | Tu dinero | movil | `pantallas/T06-03-tu-dinero.dc.html` | — | `03-COMPONENTES.md` |
| 04 | Registrar gasto | movil | `pantallas/T06-04-registrar-gasto.dc.html` | — | `03-COMPONENTES.md` |
| 05 | Caja (escritorio) | escritorio | `pantallas/T06-05-caja-escritorio.dc.html` | — | `02-ARMAZON.md §D` |

## Turno 7 — En el PC, una tabla — no las mismas tarjetas en dos columnas

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Clientes (escritorio) | escritorio | `pantallas/T07-01-clientes-escritorio.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/escritorio/pc-04-clientes.png` | `02-ARMAZON.md §D` |
| 02 | Registro | movil | `pantallas/T07-02-registro.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/01-acceso/01-02-registro-04-telefono.png` | `03-COMPONENTES.md` |
| 03 | Crear cliente a mano | movil | `pantallas/T07-03-crear-cliente-a-mano.dc.html` | — | `03-COMPONENTES.md` |
| 04 | Recibo | movil | `pantallas/T07-04-recibo.dc.html` | — | `03-COMPONENTES.md` |

## Turno 8 — Si el pago llegó por Nequi, la caja no puede decir efectivo

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Pago con medio — campo nuevo | movil | `pantallas/T08-01-pago-con-medio.dc.html` | — | `03-COMPONENTES.md` |
| 02 | Caja · por ruta | movil | `pantallas/T08-02-caja-por-ruta.dc.html` | — | `03-COMPONENTES.md` |
| 03 | Cobrar hoy (escritorio) con el cobro abierto | escritorio | `pantallas/T08-03-cobrar-hoy-escritorio-con-el-cobro-abierto.dc.html` | — | `02-ARMAZON.md §D` |

## Turno 9 — El modo equipo solo aparece cuando hay equipo

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Configuración (escritorio) | escritorio | `pantallas/T09-01-configuracion-escritorio.dc.html` | — | `02-ARMAZON.md §D` |
| 02 | Cobradores | movil | `pantallas/T09-02-cobradores.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/escritorio/pc-09-cobradores.png` | `03-COMPONENTES.md` |
| 03 | Crear cobrador | movil | `pantallas/T09-03-crear-cobrador.dc.html` | — | `03-COMPONENTES.md` |

## Turno 10 — Las ocho secciones, una por una

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Índice | movil | `pantallas/T10-01-indice.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/escritorio/pc-12-configuracion.png` | `03-COMPONENTES.md` |
| 02 | Tu negocio | movil | `pantallas/T10-02-tu-negocio.dc.html` | — | `03-COMPONENTES.md` |
| 03 | Cómo prestas | movil | `pantallas/T10-03-como-prestas.dc.html` | — | `03-COMPONENTES.md` |
| 04 | Plan y pagos | movil | `pantallas/T10-04-plan-y-pagos.dc.html` | — | `03-COMPONENTES.md` |
| 05 | Avisos por WhatsApp | movil | `pantallas/T10-05-avisos-por-whatsapp.dc.html` | — | `03-COMPONENTES.md` |
| 06 | Portal del cliente | movil | `pantallas/T10-06-portal-del-cliente.dc.html` | — | `03-COMPONENTES.md` |
| 07 | Seguridad y datos | movil | `pantallas/T10-07-seguridad-y-datos.dc.html` | — | `03-COMPONENTES.md` |

## Turno 11 — El mensaje y el recorrido, que son trabajo de calle

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Plantillas de WhatsApp | movil | `pantallas/T11-01-plantillas-de-whatsapp.dc.html` | — | `03-COMPONENTES.md` |
| 02 | Ruta en mapa | movil | `pantallas/T11-02-ruta-en-mapa.dc.html` | — | `03-COMPONENTES.md` |
| 03 | Ficha de préstamo (escritorio) | escritorio | `pantallas/T11-03-ficha-de-prestamo-escritorio.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-06-prestamo-ficha.png` | `02-ARMAZON.md §D` |

## Turno 12 — La tabla que el cliente pide cuando reclama

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Tabla en móvil | movil | `pantallas/T12-01-tabla-en-movil.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-06-prestamo-ficha.png` | `03-COMPONENTES.md` |
| 02 | Comparar modos — nuevo | movil | `pantallas/T12-02-comparar-modos.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/04-crear-prestamo/04-05-modo-interes.png` | `03-COMPONENTES.md` |
| 03 | Tabla completa (escritorio) | escritorio | `pantallas/T12-03-tabla-completa-escritorio.dc.html` | — | `02-ARMAZON.md §D` |

## Turno 13 — Tres decisiones que cambian la plata

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Recargo | movil | `pantallas/T13-01-recargo.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/07-gestion-prestamo/07-10-recargo.png` | `03-COMPONENTES.md` |
| 02 | Modificar plazo | movil | `pantallas/T13-02-modificar-plazo.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/07-gestion-prestamo/07-04-modificar-plazo.png` | `03-COMPONENTES.md` |
| 03 | Mover a perdidos | movil | `pantallas/T13-03-mover-a-perdidos.dc.html` | — | `03-COMPONENTES.md` |

## Turno 14 — Una tabla y cuatro tarjetas

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Préstamos (escritorio) | escritorio | `pantallas/T14-01-prestamos-escritorio.dc.html` | — | `02-ARMAZON.md §D` |
| 02 | Rutas (escritorio) | escritorio | `pantallas/T14-02-rutas-escritorio.dc.html` | — | `02-ARMAZON.md §D` |

## Turno 15 — Quién es el cliente, y cómo cobrarle sin abrir el préstamo

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Ficha de cliente (escritorio) | escritorio | `pantallas/T15-01-ficha-de-cliente-escritorio.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-04-cliente-ficha.png` | `02-ARMAZON.md §D` |
| 02 | Atajos de cobro — nunca diseñada | movil | `pantallas/T15-02-atajos-de-cobro.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/05-registrar-pago/05-02-atajos-cobro.png` | `03-COMPONENTES.md` |
| 03 | Cobro hecho | movil | `pantallas/T15-03-cobro-hecho.dc.html` | — | `03-COMPONENTES.md` |

## Turno 16 — En PC no hay que hacer wizard

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 00 | Cliente | escritorio | `pantallas/T16-00-cliente.dc.html` | — | `02-ARMAZON.md §D` |

## Turno 17 — La libreta y la pantalla, uno al lado del otro

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Migrador OCR (escritorio) | escritorio | `pantallas/T17-01-migrador-ocr-escritorio.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/09-entrada-datos/09-01-migrador.png` | `02-ARMAZON.md §D` |

## Turno 18 — Lo que queda cuando el cliente dice que nunca firmó

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Lo que va a firmar | movil | `pantallas/T18-01-lo-que-va-a-firmar.dc.html` | — | `03-COMPONENTES.md` |
| 03 | El pagaré firmado | movil | `pantallas/T18-03-el-pagare-firmado.dc.html` | — | `03-COMPONENTES.md` |

## Turno 19 — Aplazar, perdonar y cerrar

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Próximo cobro | movil | `pantallas/T19-01-proximo-cobro.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/07-gestion-prestamo/07-03-proximo-cobro.png` | `03-COMPONENTES.md` |
| 02 | Día de cobro | movil | `pantallas/T19-02-dia-de-cobro.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/07-gestion-prestamo/07-02-dia-de-cobro.png` | `03-COMPONENTES.md` |
| 03 | Descuento | movil | `pantallas/T19-03-descuento.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/07-gestion-prestamo/07-11-descuento.png` | `03-COMPONENTES.md` |
| 04 | Cerrar anticipado | movil | `pantallas/T19-04-cerrar-anticipado.dc.html` | — | `03-COMPONENTES.md` |
| 05 | Editar préstamo | movil | `pantallas/T19-05-editar-prestamo.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/07-gestion-prestamo/07-01-editar-prestamo.png` | `03-COMPONENTES.md` |

## Turno 20 — Contar la plata y que cuadre

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Cuentas | movil | `pantallas/T20-01-cuentas.dc.html` | — | `03-COMPONENTES.md` |
| 02 | Cuadre | movil | `pantallas/T20-02-cuadre.dc.html` | — | `03-COMPONENTES.md` |
| 03 | Historial de cierres | movil | `pantallas/T20-03-historial-de-cierres.dc.html` | — | `03-COMPONENTES.md` |

## Turno 21 — Las ocho acciones sin salir de la ficha

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Gestión del préstamo (escritorio) | escritorio | `pantallas/T21-01-gestion-del-prestamo-escritorio.dc.html` | — | `02-ARMAZON.md §D` |

## Turno 22 — La pantalla del que todavía no tiene nada

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 00 | Escribirnos | escritorio | `pantallas/T22-00-escribirnos.dc.html` | — | `02-ARMAZON.md §D` |

## Turno 23 — Cuando algo falla, decir qué sí se puede hacer

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Error de servidor (escritorio) | escritorio | `pantallas/T23-01-error-de-servidor-escritorio.dc.html` | — | `02-ARMAZON.md §D` |
| 00 | Buscar ahí también | escritorio | `pantallas/T23-00-buscar-ahi-tambien.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/15-estados/15-01-busqueda-sin-resultados.png` | `02-ARMAZON.md §D` |

## Turno 24 — Una ruta es un orden, no una lista

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Crear ruta | movil | `pantallas/T24-01-crear-ruta.dc.html` | — | `03-COMPONENTES.md` |
| 02 | Reordenar el recorrido — nunca existió | movil | `pantallas/T24-02-reordenar-el-recorrido.dc.html` | — | `03-COMPONENTES.md` |
| 03 | Capital de la ruta | movil | `pantallas/T24-03-capital-de-la-ruta.dc.html` | — | `03-COMPONENTES.md` |

## Turno 27 — Lo de hoy en la lista, el acumulado adentro

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Lista de rutas · solo hoy | movil | `pantallas/T27-01-lista-de-rutas-solo-hoy.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-08-rutas.png` | `03-COMPONENTES.md` |
| 02 | Detalle de ruta · aquí sí el acumulado | movil | `pantallas/T27-02-detalle-de-ruta-aqui-si-el-acumulado.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-09-ruta-detalle.png` | `03-COMPONENTES.md` |

## Turno 28 — La hora pico es las cinco de la tarde

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Recorriendo · claro — el default | movil | `pantallas/T28-01-recorriendo-claro.dc.html` | — | `03-COMPONENTES.md` |
| 02 | Recorriendo · oscuro — variante del interruptor | movil | `pantallas/T28-02-recorriendo-oscuro.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-09-ruta-detalle--oscuro.png` | `03-COMPONENTES.md` |

## Turno 29 — La respuesta arriba, no al final del scroll

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Simulador · el resultado arriba | movil | `pantallas/T29-01-simulador-el-resultado-arriba.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/09-entrada-datos/09-03-simulador.png` | `03-COMPONENTES.md` |

## Turno 30 — Prestar no es una pérdida

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Mi plata — el error de fondo | movil | `pantallas/T30-01-mi-plata.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/escritorio/pc-10-mi-plata.png` | `03-COMPONENTES.md` |
| 02 | ¿Cómo va el negocio? | movil | `pantallas/T30-02-como-va-el-negocio.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/escritorio/pc-11-analiticas.png` | `03-COMPONENTES.md` |
| 03 | Reportes | movil | `pantallas/T30-03-reportes.dc.html` | — | `03-COMPONENTES.md` |
| 04 | Línea de crédito | movil | `pantallas/T30-04-linea-de-credito.dc.html` | — | `03-COMPONENTES.md` |

## Turno 31 — Meter plata y sacarla no son la misma cosa

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Mi plata en 1440, con el modal de movimiento | escritorio | `pantallas/T31-01-mi-plata-en-1440-con-el-modal-de-movimiento.dc.html` | — | `02-ARMAZON.md §D` |
| 02 | ¿Cómo va el negocio? en 1440 | escritorio | `pantallas/T31-02-como-va-el-negocio-en-1440.dc.html` | — | `02-ARMAZON.md §D` |

## Turno 32 — Un registro que lo cuenta todo no cuenta nada

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Reportes en 1440 | escritorio | `pantallas/T32-01-reportes-en-1440.dc.html` | — | `02-ARMAZON.md §D` |
| 02 | Líneas de crédito en 1440 | escritorio | `pantallas/T32-02-lineas-de-credito-en-1440.dc.html` | — | `02-ARMAZON.md §D` |
| 03 | Quién hizo qué en 1440 | escritorio | `pantallas/T32-03-quien-hizo-que-en-1440.dc.html` | — | `02-ARMAZON.md §D` |

## Turno 33 — El único reporte que mira hacia adelante

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Cobros del mes (con seguros y la gráfica de ingresos) | escritorio | `pantallas/T33-01-cobros-del-mes-con-seguros-y-la-grafica-de-i.dc.html` | — | `02-ARMAZON.md §D` |
| 02 | Bajar información | movil | `pantallas/T33-02-bajar-informacion.dc.html` | — | `03-COMPONENTES.md` |
| 03 | El mes en caja | movil | `pantallas/T33-03-el-mes-en-caja.dc.html` | — | `03-COMPONENTES.md` |

## Turno 34 — Nadie lee siete novedades

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Verificar correo, sin estorbar | movil | `pantallas/T34-01-verificar-correo-sin-estorbar.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/13-banners-overlays/13-01-banner-verificar-email.png` | `03-COMPONENTES.md` |
| 02 | Novedades | movil | `pantallas/T34-02-novedades.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/13-banners-overlays/13-07-modal-novedades.png` | `03-COMPONENTES.md` |
| 03 | Búsqueda global | movil | `pantallas/T34-03-busqueda-global.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/13-banners-overlays/13-08-busqueda-global.png` | `03-COMPONENTES.md` |

## Turno 35 — Nunca bloquear la plata que entra

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Un solo aviso arriba | movil | `pantallas/T35-01-un-solo-aviso-arriba.dc.html` | — | `03-COMPONENTES.md` |
| 02 | Cosas por resolver | movil | `pantallas/T35-02-cosas-por-resolver.dc.html` | — | `03-COMPONENTES.md` |
| 03 | Plan excedido | movil | `pantallas/T35-03-plan-excedido.dc.html` | — | `03-COMPONENTES.md` |

## Turno 36 — El portal es público, y eso cambia todo

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Recuperar la clave | movil | `pantallas/T36-01-recuperar-la-clave.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/01-acceso/01-03-recuperar-clave.png` | `03-COMPONENTES.md` |
| 02 | Historial completo del cliente | movil | `pantallas/T36-02-historial-completo-del-cliente.dc.html` | — | `03-COMPONENTES.md` |
| 03 | Cómo me fue hoy (cobrador) | movil | `pantallas/T36-03-como-me-fue-hoy-cobrador.dc.html` | — | `03-COMPONENTES.md` |

## Turno 37 — Nadie puede elegir un plan antes de tener clientes

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Verificar el WhatsApp | movil | `pantallas/T37-01-verificar-el-whatsapp.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/01-acceso/01-02-registro-04-telefono.png` | `03-COMPONENTES.md` |
| 02 | Elegir plan — invertido | movil | `pantallas/T37-02-elegir-plan.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/02-onboarding/02-02-bienvenida-plan.png` | `03-COMPONENTES.md` |
| 03 | Listo | movil | `pantallas/T37-03-listo.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/02-onboarding/02-05-exito.png` | `03-COMPONENTES.md` |

## Turno 38 — Nadie entiende “20% mensual” hasta que ve la cuota

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Cómo prestas, en 1440 | escritorio | `pantallas/T38-01-como-prestas-en-1440.dc.html` | — | `02-ARMAZON.md §D` |
| 02 | Las plantillas de WhatsApp, en 1440 | escritorio | `pantallas/T38-02-las-plantillas-de-whatsapp-en-1440.dc.html` | — | `02-ARMAZON.md §D` |

## Turno 39 — El armazón desaparece cuando hay trabajo

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Armazón completo · solo en las 6 pantallas de navegación | movil | `pantallas/T39-01-armazon-completo-solo-en-las-6-pantallas-de-.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-01-dashboard--nav.png` | 02-ARMAZON.md |
| 02 | La hoja de cuenta · claro y oscuro viven aquí | movil | `pantallas/T39-02-la-hoja-de-cuenta-claro-y-oscuro-viven-aqui.dc.html` | — | 02-ARMAZON.md |
| 03 | Solo cabecera · sin barra inferior | movil | `pantallas/T39-03-solo-cabecera-sin-barra-inferior.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-04-cliente-ficha--nav.png` | 02-ARMAZON.md |
| 04 | Sin armazón · una tarea, una mano | movil | `pantallas/T39-04-sin-armazon-una-tarea-una-mano.dc.html` | — | 02-ARMAZON.md |
| 05 | El armazón en 1440 | escritorio | `pantallas/T39-05-el-armazon-en-1440.dc.html` | — | 02-ARMAZON.md |

## Turno 40 — Elige la cabecera y esa queda

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 00 | A · Marca mínima — elegida | movil | `pantallas/T40-00-a-marca-minima.dc.html` | — | 02-ARMAZON.md §A |
| 00 | B · El saludo es la cabecera — descartada | movil | `pantallas/T40-00-b-el-saludo-es-la-cabecera.dc.html` | — | 02-ARMAZON.md §A |
| 00 | C · Buscar es la cabecera — descartada | movil | `pantallas/T40-00-c-buscar-es-la-cabecera.dc.html` | — | 02-ARMAZON.md §A |

## Turno 41 — Diseñé para el 6,2% de la cartera

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Ficha fijo | movil | `pantallas/T41-01-ficha-fijo.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-06-prestamo-ficha.png` | 06-ADENDA-modos-sin-tabla.md |
| 02 | Ficha unico | movil | `pantallas/T41-02-ficha-unico.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-06-prestamo-ficha.png` | 06-ADENDA-modos-sin-tabla.md |
| 03 | Más — el quinto destino | movil | `pantallas/T41-03-mas.dc.html` | — | 06-ADENDA-modos-sin-tabla.md |

## Turno 42 — Los 8 modos, ya con pantalla

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Ficha manual | movil | `pantallas/T42-01-ficha-manual.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-06-prestamo-ficha.png` | 07-ADENDA-menu-y-lucas.md §1–3 |
| 02 | Ficha proporcional | movil | `pantallas/T42-02-ficha-proporcional.dc.html` | `uploads/CF-Diseno-Nucleo/capturas/movil/03-dia-a-dia/03-06-prestamo-ficha.png` | 07-ADENDA-menu-y-lucas.md §1–3 |
| 03 | Ficha por defecto en 1440 | escritorio | `pantallas/T42-03-ficha-por-defecto-en-1440.dc.html` | — | 07-ADENDA-menu-y-lucas.md §1–3 |

## Turno 43 — Lucas no debe contestar con párrafos

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | El menú del + | movil | `pantallas/T43-01-el-menu-del.dc.html` | — | 07-ADENDA-menu-y-lucas.md §4–7 |
| 02 | Lucas contestando — la pantalla que faltaba | movil | `pantallas/T43-02-lucas-contestando.dc.html` | — | 07-ADENDA-menu-y-lucas.md §4–7 |
| 03 | Lucas vacío | movil | `pantallas/T43-03-lucas-vacio.dc.html` | — | 07-ADENDA-menu-y-lucas.md §4–7 |
| 04 | Lucas en 1440 | escritorio | `pantallas/T43-04-lucas-en-1440.dc.html` | — | 07-ADENDA-menu-y-lucas.md §4–7 |

## Turno 44 — Dos formas de repartir, y la app no dice cuál manda

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Lista de socios | movil | `pantallas/T44-01-lista-de-socios.dc.html` | — | 08-ADENDA-socios.md (contexto) |
| 02 | La ficha del socio | movil | `pantallas/T44-02-la-ficha-del-socio.dc.html` | — | 08-ADENDA-socios.md (contexto) |
| 03 | Cambiar el reparto — la decisión que faltaba | movil | `pantallas/T44-03-cambiar-el-reparto.dc.html` | — | 08-ADENDA-socios.md (contexto) |
| 04 | Socios en 1440 | escritorio | `pantallas/T44-04-socios-en-1440.dc.html` | — | 08-ADENDA-socios.md (contexto) |

## Turno 45 — Un solo modelo: se reparte por lo que puso cada uno

| # | Pantalla | Vista | Archivo | ANTES (sistema actual) | SPEC |
|---|---|---|---|---|---|
| 01 | Lista de socios | movil | `pantallas/T45-01-lista-de-socios.dc.html` | — | 08-ADENDA-socios.md |
| 02 | Repartir la ganancia — el corazón del módulo | movil | `pantallas/T45-02-repartir-la-ganancia.dc.html` | — | 08-ADENDA-socios.md |
| 03 | La cuenta del socio | movil | `pantallas/T45-03-la-cuenta-del-socio.dc.html` | — | 08-ADENDA-socios.md |
| 04 | Socios en 1440 | escritorio | `pantallas/T45-04-socios-en-1440.dc.html` | — | 08-ADENDA-socios.md |

