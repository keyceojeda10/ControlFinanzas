# Prueba de flujo del dinero

Monta un negocio de mentira **dentro del espejo**, con la caja en cero, y corre
el día entero de un cobrador por los endpoints reales. Como todos los montos los
define la prueba, se sabe de antemano cuál debe ser el resultado: si la caja no
cuadra, señala **en qué operación** aparece la diferencia.

## Antes de correrla: dos túneles

```
ssh -N -L 3005:localhost:3005 root@69.62.87.141    # la aplicación del espejo
ssh -N -L 3307:127.0.0.1:3306 root@69.62.87.141    # su base de datos
```

## Cómo se corre

```
npm run prueba:dinero                      # los cinco modos de interés
npm run prueba:dinero -- --modo=fijo       # uno solo
npm run prueba:dinero -- --presta-mil      # con las banderas de PRESTA MIL
npm run prueba:dinero -- --seguir          # no para en el primer descuadre
npm run prueba:dinero -- --conservar       # no borra al final (para mirarla)
npm run prueba:dinero -- --limpiar         # barre restos y sale
```

Sale con código 1 si algo no cuadra, así que sirve en un gancho de despliegue.

## Los once pasos

| | operación | qué comprueba |
|---|---|---|
| P0 | leer la caja vacía | **el ancla**: si no da cero, la organización no está limpia |
| P1 | préstamo en efectivo | la salida de caja |
| P2 | préstamo por transferencia | `desembolsadoDia` no distingue método: resta igual |
| P3 | cobro en efectivo | entra a efectivo |
| P4 | cobro por transferencia | entra a digital, **no** a efectivo |
| P5 | cobro con método `nequi` | la sonda: el método inválido se degrada a null |
| P6 | recargo | sube la deuda y **NO** toca la caja |
| P7 | gasto sin aprobar | **separa la vista B de la A y la C** |
| P8 | aprobarlo | ahora las tres coinciden |
| P9 | **renovación** | el caso reportado: sale la diferencia, no el monto |
| P10 | leer las tres vistas | la comparación final |

## Por qué el libro no hace reglas de tres

`calcularPrestamo` redondea **al centenar por cuota** y luego multiplica:

| préstamo | total real | `monto × (1+tasa)` | desvío |
|---|---|---|---|
| 347.000 · 20% · 30d | 417.000 | 416.400 | **600** |
| 200.000 · 20% · 20d | 228.000 | 240.000 | **−12.000** |
| 1.000.000 · 10% · 90d semanal | 1.326.000 | 1.100.000 | **+226.000** |

Por eso `libro.mjs` **le pregunta a la aplicación** en vez de calcular. Si
alguien teclea la fórmula a mano, la prueba empieza a reportar descuadres que no
existen — que es justo lo que vino a evitar.

## Otras dos trampas ya incorporadas

- **El cobro se recorta en silencio** (`pagos/route.js:243`): si pides cobrar
  41.700 y solo debe 30.000, se registran 30.000. El guion anota **lo que el
  servidor dijo**, no lo que pidió, y avisa cuando difieren.
- **La renovación redondea la diferencia al centenar superior**
  (`renovar/route.js:198-201`). Sin eso, hasta 99 pesos de descuadre inventado
  por renovación.

## Lo que destapó

**Las tres vistas del mismo cobrador cuentan cosas distintas:**

| | gastos | cobros |
|---|---|---|
| (A) `/api/caja?cobradorId` | pendiente + aprobado | solo suyos |
| (B) `cobradores[]` del dueño | **solo aprobado** | solo suyos |
| (C) `/api/caja/cobrador/[id]` | pendiente + aprobado | **suyos o de su ruta** |

Y con `renovacionesEnCobrado` (que tiene PRESTA MIL), la vista C suma el saldo
absorbido **a los dos lados**: en la corrida del 5 de agosto, 370.700 de más en
cobrado y los mismos 370.700 de más en prestado. Se cancelan en el total, pero
cada línea es falsa. Por eso el informe compara **línea por línea** y no solo el
saldo: el 27 de julio dos errores que se anulaban pasaron desapercibidos.

## Cómo se comprueba que la prueba sirve

Revertir a propósito la corrección de `lib/dinero/desembolsado.js` en el espejo y
correrla: debe parar en P9 con

```
desembolsado    689.300    1.060.000    370.700  ←── AQUÍ
```

y enseñar el movimiento de capital de 129.300 que demuestra que el dato bueno
existía. Comprobado el 5 de agosto de 2026.
