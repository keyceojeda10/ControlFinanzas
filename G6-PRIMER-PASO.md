# G6 · El primer paso, ya localizado (2 ago 2026)

> Complementa `AUDITORIA-ESTADO.md`, donde están las dos decisiones del dueño.

## El mecanismo exacto que borra la mora

`app/api/prestamos/[id]/pagos/route.js:348`

```js
const filasFuturas = filas.filter(f => (f.pagado || 0) < f.cuotaTotal)
```

**«Futura» está definida como «sin pagar», no como «aún no vencida».** Una cuota
atrasada y sin pagar entra en el lote que se reprograma con fechas nuevas, y el
atraso desaparece. Nadie decidió eso: es el efecto lateral de esa condición.

Según la decisión del dueño —*el atraso se sigue debiendo*— el filtro debe
partirse en dos:

```js
const vencidasSinPagar = filas.filter(f => sinPagar(f) &&  yaVencio(f))  // NO se tocan
const filasFuturas     = filas.filter(f => sinPagar(f) && !yaVencio(f))  // se reprograman
```

## ⚠ LA TRAMPA: la invariante se rompe si solo se cambia el filtro

El saldo se reparte sobre `filasFuturas.length` periodos
(`pagos/route.js:375-376`). Al sacar las vencidas de ese lote, **el capital que
llevaban dentro se queda huérfano** y deja de cumplirse:

```
Σ cuota.capital === montoPrestado
```

Hay que decidirlo explícitamente, y **la decisión cambia lo que el cliente
debe**:

| Opción | Qué implica |
|---|---|
| **A** · Las vencidas conservan su capital tal cual | El saldo a repartir baja por ese capital. Es lo más fiel a «el atraso se sigue debiendo»: la cuota vencida sigue siendo exactamente la que era |
| **B** · Su capital se redistribuye entre las futuras | Las vencidas quedarían como deuda sin capital detrás — incoherente con la propia tabla que la app imprime |

**Recomendación: A.** Es la única que deja la cuota vencida intacta, que es justo
lo que se pidió.

## Las dos pruebas que hay que escribir ANTES de tocar

1. Tras un abono a capital, `Σ cuota.capital === montoPrestado`.
2. Una cuota vencida y sin pagar conserva **la misma fecha y el mismo importe**
   que tenía antes del abono.

Sin esas dos, el cambio se puede colar roto: el build no lo ve y las pruebas
actuales tampoco, porque hoy ninguna mira la tabla después de un abono.

## Alcance, medido contra el espejo

| | préstamos | saldo |
|---|---|---|
| Con abono a capital | 28 | $26.853.376 |
| De esos, con tabla | 16 | $14.174.376 |
| Y además **activos hoy** | **10** | **$12.054.126** |

Los 6 con tabla ya cerrados no se auto-corrigen: van en la migración de G8, y
como cambia lo que un cliente debe, **con consentimiento** préstamo por
préstamo.

## Por dónde seguir

1. Escribir las dos pruebas (fallan).
2. Partir el filtro con la opción A.
3. Medir contra el espejo cuánto se mueve en los 10 vivos, préstamo por
   préstamo, antes de desplegar.
