# El préstamo abierto (interés indefinido) — 18 de agosto de 2026

## Primero, los números. Contados en producción hoy

### Línea de crédito: no la usa nadie

| | |
|---|---|
| Líneas creadas | **4** |
| Negocios | **2** (y uno es «Carlos prestamos») |
| Desembolsos | 6, por $1.994.443 |
| Pagos | **1** |
| Cortes | **0** |
| Última línea creada | **3 de julio** |

Cero cortes es la prueba de que nadie llegó a operarla: sin corte el interés no
existe y el pago se come el capital. El módulo está muerto.

### La demanda, en cambio, es real — y ya vive dentro de «Globo»

| modo | préstamos | negocios | activos | capital |
|---|---|---|---|---|
| fijo | 5.897 | 177 | 3.368 | $3.400M |
| unico | 1.409 | 60 | 1.064 | $1.035M |
| **solo_interes (Globo)** | **231** | **25** | **195** | **$646M** |
| saldo | 114 | 21 | 90 | $203M |

**Globo es el tercer capital más grande de la app con el 3% de los préstamos.**
Monto medio **$3.027.504** — diez veces el préstamo típico. Es plata gorda.

Y ya lo están forzando para que sea abierto:

- **Plazo medio 242 días, máximo 1.080** (tres años). Nadie presta a tres años:
  estiran el plazo porque el sistema les exige uno.
- **10 préstamos vivos que ya pasaron su fecha fin, en 8 negocios**, y siguen
  recibiendo pagos de interés. Eso es un préstamo abierto a la fuerza.
- 48 préstamos con pagos de tipo «intereses» en 19 negocios.

## La recomendación: NO un modo nuevo — quitarle el plazo a Globo

Un noveno modo es una lista más que actualizar en cada pantalla, cada informe y
cada cálculo. Ya pasó con `saldo`, que es «el hijo olvidado» de media docena de
listas escritas a mano.

Globo **ya hace** lo que se pide: cobra solo interés por período y el capital
vuelve al final. Lo único que sobra es **el final**. Y la maquinaria del resto
ya existe y está probada: `interesCobrableAhora`, el pago de tipo «intereses»,
el abono a capital y la liquidación anticipada.

Los 195 préstamos vivos que ya están en Globo se benefician el mismo día, sin
migrar un solo registro.

## LA DECISIÓN DE DISEÑO, que es donde se gana o se pierde esto

El problema de fondo no es quitar una fecha: es que **en un préstamo abierto el
total no se puede saber**. Hoy `saldoPendiente = totalAPagar − pagado`, y esa
resta la usan 79 archivos.

Hay dos caminos y solo uno es barato:

**(a) Cambiar la fórmula del saldo** para los abiertos: capital restante +
interés devengado sin pagar. Toca la función central del dinero y los 79
archivos pasan a tener dos verdades.

**(b) Que el interés SUBA LA DEUDA cuando vence el período** — igual que ya hace
un recargo. `totalAPagar` crece, `pagado` crece cuando paga, y la resta de
siempre sigue valiendo **sin tocar un solo archivo de los 79**.

**Se hace (b).** No es un atajo: es lo que de verdad pasa. Cuando termina el mes
el cliente DEBE ese interés, lo pague o no. Y el proyecto ya tiene esa mecánica
montada y probada —el recargo sube `totalAPagar` sin tocar plazo ni cuota— así
que se reutiliza en vez de inventar una segunda contabilidad.

### Lo que eso obliga, y hay que hacerlo bien

El devengo lo dispara un **cron diario**, como los otros veinte que ya corren.
Y un cron que mueve plata tiene un único fallo grave posible: **devengar dos
veces**. Es exactamente el que tenía la línea de crédito.

Por eso el devengo es **idempotente por construcción**: un apunte por préstamo y
por período, con la clave `(prestamoId, periodo)` única en la base. Correr el
cron dos veces el mismo día no puede cobrar dos veces, ni aunque se lance a
mano, ni aunque se solapen dos ejecuciones.

⚠ Y el interés se calcula **sobre el capital que había en ese período**, no
sobre el de hoy: si el cliente abonó a capital a mitad de mes, el mes siguiente
paga menos. Es la diferencia entre cobrar bien y cobrar de más.

### Por qué NO se toca lo que ya existe

- `sinPlazo` es un campo nuevo con valor por defecto `false`: los 10.218
  préstamos de hoy nacen con el comportamiento de siempre, bit por bit.
- Solo se puede activar en modo Globo, validado en el API.
- El préstamo abierto **no lleva tabla de amortización**, y
  `tieneTablaAmortizacion` ya exige filas: sin tabla, los 89 sitios que
  ramifican por modo caen solos en el camino «sin tabla».
- La puerta: la foto de los **195 Globo vivos** (`.auditoria/foto/`), 11 cifras
  cada uno, $943.169.627 en saldos. Se vuelve a tomar después y si se mueve
  una, no sale.

## Qué hay que resolver de verdad (no es solo quitar un campo)

1. **Sin fecha fin**: la tabla de amortización de Globo termina con una cuota
   que trae el capital. Sin plazo no hay última cuota: el capital queda como
   saldo vivo y punto.
2. **La mora deja de mirar la fecha final** y pasa a mirar el período de
   interés: se está en mora si no pagó el interés del período, no porque llegó
   una fecha que ya no existe.
3. **Cuotas pendientes y vencidas** no pueden contar el capital. Hoy lo cuentan.
4. **Cartera, informes y «cómo va el negocio»** tienen que saber tratar un
   préstamo sin fecha de fin (hoy ordenan y agrupan por ella).
5. **Cobros de hoy y la ruta**: a quién le toca hoy sale del período de interés.
6. **El cierre**: se salda cuando el capital llega a cero, no cuando se acaba un
   calendario.

## La condición que puso el dueño, escrita como puerta de entrada

> «Que no sea como agregar un modo que estemos tocando un mes encontrándole
> fallos. Si vamos a montar algo, que lo montemos cuando esté validado.»

No se despliega hasta que TODO esto pase, y cada punto se mide, no se opina:

- [ ] `npm run prueba:dinero` con el modo nuevo añadido a los cinco actuales:
      monta un negocio de mentira con la caja en cero y corre el día entero por
      los endpoints reales. Tiene que cuadrar al peso.
- [ ] Un año simulado de un préstamo abierto: 12 pagos de interés, dos abonos a
      capital y el cierre. El interés cobrado tiene que dar exactamente
      capital × tasa × meses, con el capital bajando en los abonos.
- [ ] Día de cobro, mora y «cobros de hoy» comprobados contra el calendario en
      las cuatro frecuencias, con festivos y días sin cobro.
- [ ] Cero cuotas vencidas por el capital, en pantalla y en los informes.
- [ ] Los 195 Globo vivos de producción, recalculados en solo lectura: ninguna
      cifra puede moverse.
- [ ] Las tres vías de pago —interés, capital, cuota— cada una con su efecto, y
      el recibo y el estado de cuenta diciendo lo mismo que la ficha.

## Y qué se hace con línea de crédito

Con 4 líneas, 1 pago y 0 cortes no hay nada que migrar. Se apaga de la
navegación cuando el modo abierto esté vivo, y se avisa a los dos negocios.
Borrar los datos, no: son suyos.
