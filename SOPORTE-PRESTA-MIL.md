# PRESTA MIL · el cuadre que no cuadraba — 18 de agosto de 2026

Reportado en video y nota de voz a las 7:58 de la mañana. **Arreglado y
desplegado el mismo día** (`7404a89c`).

---

## Para mandarle (listo para copiar)

> Don Carlos, ya quedó. Lo encontramos con su video y lo corregimos hoy mismo;
> ya está en la app, solo tiene que refrescarla.
>
> *Qué era.* La cuenta del cuadre no estaba contando lo que usted saca o le mete
> a una ruta. Solo sumaba lo que salió, lo que cobró, lo que prestó y lo que
> gastó. Por eso el número del cuadre y el de «Capital por ruta» se separaban
> exactamente por lo que usted hubiera movido.
>
> *Su ruta 2.* La diferencia eran $326.000, que es el retiro que usted hizo el
> lunes a las 7:54 de la mañana. El número bueno era el de $468.000: era el
> único que estaba contando ese retiro. El del cuadre le estaba pidiendo al
> cobrador una plata que usted ya se había llevado.
>
> *Sus dos preguntas.* No hay que hacerle ajuste a ninguna ruta: el arreglo vale
> para las diez a la vez, y ya lo comprobamos en las suyas. Y puede seguir
> cobrando normal desde ya — los abonos nunca fueron el problema, suben las dos
> cifras por igual.
>
> Una cosa más: ahora, cuando usted saca o mete plata a una ruta, le aparece
> escrito en el cuadre («Le sacaste a esta ruta»), para que no le vuelva a
> cambiar un número sin decirle por qué.
>
> Y lo que sí siga haciendo: cuando una ruta se le quede sin base y le tenga que
> reponer, hágalo igual que siempre. Eso está bien y no tiene nada que ver.
>
> Solo dígame una cosa para cerrar: ¿alguna vez metió plata que no entregó de
> verdad, solo para que el número cuadrara? Por los movimientos parece que no,
> pero si pasó alguna vez la miramos para que no le quede capital de más.

---

## Qué pasaba

Su RUTA #2, en la pantalla, decía dos cosas a la vez:

| Dónde | Qué decía |
|---|---|
| Caja de JHON #2 → «Tiene que entregar» | **$794.000** |
| Mi plata → Capital por ruta → RUTA #2 | **$468.000** |

La diferencia son **$326.000**, y es exactamente un retiro que **él mismo hizo**
el lunes 17 a las **07:54:10**, en efectivo, desde su usuario de dueño.

## La causa, en una línea

La cuenta del día reconstruía el día así:

    con lo que salió + lo que cobró − lo que prestó − lo que gastó

**y ahí no están los retiros, ni las inyecciones, ni las correcciones.** Para
hallar «con lo que salió» el sistema resta del capital TODO lo que se movió hoy
—retiro incluido, y eso está bien— pero al volver a sumar hacia adelante solo
ponía cobros, préstamos y gastos. El retiro se contaba **una vez, en contra, y
desaparecía**.

Por eso la diferencia era SIEMPRE, al peso, lo que él hubiera metido o sacado.

## Cuál de los dos números era el bueno

**El del capital: $468.000.** Es el que sí contaba su retiro. El del cuadre le
estaba pidiendo al cobrador $326.000 que ya se los había llevado él por la
mañana.

⚠ Él creía lo contrario, y por eso llevaba semanas inyectando plata todas las
noches para subir el capital hasta la cifra del cuadre.

## Cuánto abarcaba

Medido contra producción, 14 rutas de **5 negocios**, 111 días·ruta con
movimiento en 14 días:

| | descuadrados |
|---|---|
| Con la fórmula que había | **73** (el peor, $25.476.000) |
| Con la fórmula nueva | **0** |

En sus diez rutas: el 17 fallaban 2, y el **15 —la noche de su ronda de
retiros— fallaban las diez**.

**Comprobado en producción ya con el arreglo puesto: sus 10 rutas de 10
coinciden al peso.**

## Qué se cambió

1. La cuenta del día suma las inyecciones y resta los retiros y las
   correcciones. `Lo que queda en la ruta` vuelve a ser, por construcción, el
   `saldoCapital` de la ruta.
2. **Y sale escrito**: un renglón nuevo, «Le sacaste a esta ruta» (y «Le metiste
   a esta ruta»). Su queja no era el número: era *«yo no entiendo este resultado
   de dónde sale»*. Un número que se corrige solo, sin decir por qué, es el
   mismo problema con otra cifra.
3. Un retiro por transferencia baja el capital de la ruta pero **no** «Tiene que
   entregar», que son billetes. Hoy no hay ninguno así en la base, pero el día
   que lo haya la cuenta no se tuerce.

---

## Las inyecciones de la noche: él confirma que cuadraba a mano

> «A mí me ha tocado sacarle y inyectarle para que los números cuadraran. Que
> eso es lo que quiero: que solamente si yo necesito sacarle plata a la ruta,
> yo voy y le saco y el número cambie.» — 18 ago 2026

Con el saldo de la ruta reconstruido antes y después de cada una (55 en 21 días
por $13.186.872), el patrón es este:

| | |
|---|---|
| La ruta estaba **en negativo** al inyectar | **37**, por $10.347.650 |
| La ruta estaba en positivo | 18, por $2.839.222 |

Y se repite una pareja muy concreta: **primero una inyección que deja la ruta
EXACTAMENTE en cero, y acto seguido otra con la base de verdad.**

    06 ago 22:02  RUTA #1    +$991.000   → $0     luego +$82.000  → $82.000
    06 ago 22:23  RUTA #10 +$1.009.723   → $0     luego +$500.000 → $500.000
    11 ago 07:41  RUTA #4    +$791.000   → $0     luego +$457.000 → $457.000

⚠ **La primera de cada pareja NO se puede llamar plata falsa.** Que la ruta esté
en −$991.000 significa que el cobrador prestó más de lo que llevaba, y esa plata
salió de la oficina de verdad: la inyección la registra. Borrar el negativo y
financiar el hueco son, en el libro, la misma operación.

**Conclusión honesta: no se puede separar desde el libro, y afirmar que hay
capital inflado sería inventarlo.** Lo que sí se puede decir es que desde hoy
ninguna hace falta para cuadrar, así que las de mañana en adelante son limpias.

La lista completa, con el saldo antes y después de cada una, sale de
`.auditoria/` contra producción (guion `q17`).

## Lo de fondo, que sigue abierto

**Sus rutas se van al rojo mucho: 40 de 210 noches·ruta (19%) en 21 días.** Por
eso le toca inyectar. Ninguna ruta tiene registrado un capital inicial —en toda
la base hay UN solo movimiento `capital_inicial` con ruta—, así que las rutas se
financian solo con inyecciones y el saldo arranca en cero.

Es la misma historia de [[capital_negativo_no_es_bug]]: 98 de 107 negocios nunca
registraron el capital inicial. **Eso es lo siguiente que hay que mirarle**, y
es harina de otro costal: no es un fallo del cuadre.

## Lo que hay que preguntarle

Una sola, y concreta: en el video dice *«me toca llegar y inyectarle plata para
que este saldo suba a 794»*. Eso sí sería un parche. **¿Alguna vez metió plata
que no entregó de verdad, solo para que el número cuadrara?**

Por el libro parece que no —de 42 días con inyección, solo 2 acabaron en la
cifra del cuadre— pero la intención no se lee en una tabla. Si la respuesta es
que sí, hay que mirar esas para no dejar capital inflado. Si es que no, no hay
nada que tocar.

Y en cualquier caso: **desde hoy ninguna hace falta por ese motivo.**
