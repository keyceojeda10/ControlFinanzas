# Ajuste del capital por ruta — PRESTA MIL, 6 de agosto de 2026

Registro de una corrección de datos en producción. **Se tocó dinero**, así que
queda escrito qué, por qué y con qué respaldo.

## Qué se corrigió

El `saldoCapital` de 8 rutas, llevándolo a la base que el dueño contó y confirmó
en el cuadre de la noche del 5 de agosto.

```
ruta        antes        después     ajuste
RUTA #1      92.000       92.000          0   (ya cuadraba, se saltó)
RUTA #2     504.874      198.000   -306.874
RUTA #3   1.951.044    1.879.000    -72.044
RUTA #4     801.664      339.000   -462.664
RUTA #5     596.534      221.000   -375.534
RUTA #6     444.978      318.000   -126.978
RUTA #7     156.322      130.000    -26.322
RUTA #8      25.666        4.000    -21.666
RUTA #9     115.000       60.000    -55.000
RUTA #10  -1.009.723         —           —    (sin cuadre reciente, se saltó)
```

El ajuste fue sobre la **apertura**, no sobre el saldo actual: las rutas que ya
habían cobrado hoy conservan lo cobrado. Por eso al terminar la #3 marca
1.889.000 (1.879.000 + 10.000 de hoy) y la #7 marca 425.000 (130.000 + 295.000).

## Por qué estaban desviadas

Dos causas, las dos medidas:

1. **Movimientos sin `rutaId`.** Los ajustes por cancelar y eliminar préstamos se
   asentaban sin ruta: el dinero volvía a la caja global pero no bajaba a la
   sub-bolsa. Arreglado el mismo día (ver `movimiento-lleva-su-ruta.test.js`).
   En toda la plataforma: 3.247 movimientos por $609.511.731.

2. **Los ajustes de «Corrección renovación»** del 5 de agosto (35 movimientos,
   $751.018). Son los que dejaban cifras como 504.**874** o 444.**978** — los
   «centavos» que el dueño reportó. No son dinero contado, son residuos de
   dividir cuotas que no dan exacto.

Hasta el 1 de agosto el capital de casi todas las rutas cuadraba **al peso** con
la base contada. El sistema funcionaba; lo rompieron esas dos cosas.

## Lo que NO se hizo, y por qué

- **CARLOS #10 se saltó.** Su cuadre más reciente es de hace once días y el
  ajuste habría sido **+$8.792.723**. Eso no es corregir un desvío, es inventar
  capital. Su ruta sigue en −1.009.723 y hay que mirarla aparte.
- **El capital global NO se movió.** Los 8 movimientos llevan
  `ajusteArranqueRuta = true`: tocan la sub-bolsa de la ruta y no el saldo del
  negocio. El dinero no apareció ni desapareció, estaba mal repartido.

## Respaldo

- Probado antes en el espejo aplicándolo de verdad sobre 3 rutas sembradas: las
  tres quedaron en su base y el capital global no cambió.
- Foto de producción antes: capital global 17.890.759.
- Verificado después contra el **API real** de producción: los 9 cobradores
  muestran «Con lo que salió» = su base, 9 de 9.
- Cada ajuste quedó como `MovimientoCapital` con la descripción
  «Cuadre de la base: la ruta queda con los $X contados el YYYY-MM-DD».

⚠ La subida de $30.000 en el capital global entre la foto y la comprobación fue
un **cobro real** de las 15:30, no el ajuste.

## Pendiente

- **RUTA #10 (CARLOS)**: −1.009.723 y sin cuadrar caja desde hace once días.
- Los ~600 millones mal repartidos en otros negocios de la plataforma: la causa
  ya está cortada, pero los saldos históricos siguen desviados.
