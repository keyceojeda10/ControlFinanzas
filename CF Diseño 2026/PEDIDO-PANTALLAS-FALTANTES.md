# Pedido de pantallas faltantes — rediseño Control Finanzas

> Para pasarle a Claude Design **junto con el paquete original**
> (`design_handoff_control_finanzas/`). Todo lo de acá se apoya en ese paquete:
> mismos tokens, mismos componentes, mismos criterios. No es un rediseño nuevo,
> son huecos del que ya existe.

---

## Contexto: por qué faltan

El paquete de 106 pantallas está implementándose. Al llevarlo al código real
aparecieron tres huecos donde el diseño no cubre casos que sí existen en el
sistema. Dos son grandes.

**El dato que lo explica todo:** la app tiene **8 modos de interés**, y solo 4
generan tabla de amortización. El rediseño diseñó las fichas y comparaciones
sobre los que **sí** tienen tabla — que son el **6,2% de los préstamos activos**.

Reparto real de la cartera activa, medido en producción el 28 de julio de 2026:

| Modo | Préstamos | % | ¿Tabla de amortización? |
|---|---|---|---|
| `fijo` | 2.587 | **54,7%** | no |
| `unico` | 882 | **18,6%** | no |
| `manual` | 502 | **10,6%** | no |
| `proporcional` | 464 | **9,8%** | no |
| `solo_interes` (globo) | 141 | 3,0% | sí |
| `lineal` | 72 | 1,5% | sí |
| `saldo` | 58 | 1,2% | sí |
| `lineal_dinamico` | 24 | 0,5% | sí |

**El 93,7% de los préstamos no tiene tabla de amortización.** Las fichas del
rediseño muestran "Desglose por mes" con capital/interés/cuota por período. Esos
préstamos no tienen esa información: no existe.

---

## PANTALLA 1 — Ficha de préstamo SIN tabla de amortización

**La más importante de las tres. Son 2 de cada 3 préstamos del sistema.**

### Qué es cada modo, en el idioma del prestamista

- **`fijo`** — "le presto $500.000 y me paga $20.000 diarios hasta completar
  $600.000". Cuota fija, plazo fijo, total fijo. El interés no se recalcula nunca.
- **`unico`** — un solo pago al final. "Le presto $300.000 y en un mes me devuelve
  $360.000".
- **`manual`** — el prestamista fija la cuota a mano y el sistema deduce el resto.
- **`proporcional`** — el interés se prorratea sobre el plazo.

### Qué datos existen para estos préstamos

```
montoPrestado      $500.000
totalAPagar        $600.000
totalPagado        $130.500
saldoPendiente     $469.500
cuotaDiaria        $20.000
frecuencia         diario | semanal | quincenal | mensual
diasPlazo          30
fechaInicio        27 jul 2026
fechaFin           26 ago 2026
proximoCobro       29 jul 2026
diasMora           36
montoEnMora        $80.000
historial de pagos [fecha, monto, medio de pago, saldo resultante]
```

**Lo que NO existe:** desglose de capital e interés por período. No hay filas.
El interés es un número único del préstamo completo, no repartido en el tiempo.

### La pregunta que la pantalla tiene que responder

La misma que la ficha con tabla: **¿cuánto debe y cómo viene pagando?**

### Lo que necesito decidido

1. **Qué ocupa el lugar del "Desglose por mes".** En la ficha con tabla ese
   bloque es la mitad de la pantalla. Acá está vacío. ¿Va el historial de pagos?
   ¿Un calendario de cuotas proyectadas (que se pueden calcular, aunque no
   estén guardadas)? ¿Nada, y la pantalla es más corta?

2. **Si se muestra el interés, cómo.** Se sabe el interés total ($100.000 sobre
   $500.000) pero no cuánto de cada pago fue interés. Mostrar "ganancia" por
   pago sería inventar un dato.

3. **El caso `unico`.** Un solo pago al final. No hay progreso de cuotas ni
   cuota diaria. Es casi otra pantalla: ¿merece su propio tratamiento?

### Restricciones del sistema que ya existen

- Bloque oscuro con **saldo pendiente** como respuesta (ya definido en el paquete).
- La barra de progreso y el riel de estado funcionan igual: hay `totalPagado`
  sobre `totalAPagar`.
- Los modales de gestión (recargo, descuento, modificar plazo, cerrar
  anticipado) aplican igual y ya están diseñados.

---

## PANTALLA 2 — "Más" (quinto destino de la pastilla)

**Puedo derivarla, la pido solo si querés verla distinta.**

El paquete define los cinco destinos de la pastilla y dice que el quinto es una
rejilla de cuatro cuadrados, pero no hay pantalla de destino. En móvil hoy
quedan **catorce herramientas sin puerta de entrada**.

La barra lateral de escritorio ya las agrupa así, y pensaba respetar esa
agrupación:

**Más herramientas** — Mi plata · Gastos · Reportes · ¿Cómo va el negocio? ·
Cobradores · Socios · Pasar mi cuaderno · Importar Excel · Perdidos ·
Quién hizo qué

**Cuenta** — Configuración · Soporte · Tutoriales

Referencia interna: el **menú de configuración del turno 9** resuelve el mismo
problema (8 secciones nombradas como el dueño piensa). Pensaba usar ese patrón.

Es una pantalla de navegación, así que lleva **armazón completo**.

---

## PANTALLA 3 — Comparar modos, versión completa

**Puede que no haga falta. Es una pregunta de producto, no de diseño.**

El turno 12 compara 4 modos sobre el mismo préstamo. Los 4 que compara son
justo los que tienen tabla, o sea donde "comparar" significa comparar un
*calendario*.

**La pregunta:** ¿esa pantalla debe cubrir los 8 modos, o está bien con 4?

- Si son 8: hace falta saber cómo se agrupan y qué se compara cuando no hay
  cronograma — probablemente solo total a pagar, cuota y plazo.
- Si son 4: no hace falta nada, y basta decirlo para que quede cerrado.

El criterio del propio paquete dice *"máximo cuatro columnas en móvil, cinco en
escritorio; con más, no se leen"*, lo que sugiere que 8 a la vez no va.

---

## Lo que NO hace falta diseñar

Para que no se gaste esfuerzo de más: todo lo demás del paquete alcanza. Donde
falta una pantalla menor, se deriva aplicando los criterios de `04-CRITERIOS.md`
y los componentes de `03-COMPONENTES.md`, y se marca en el commit para poder
revisarla después.

---

## Prioridad

1. **Pantalla 1** — bloquea las fichas de préstamo, que son el corazón de la app.
2. **Pantalla 3** — una respuesta de una línea puede cerrarla sin diseñar nada.
3. **Pantalla 2** — solo si querés verla distinta a lo derivado.
