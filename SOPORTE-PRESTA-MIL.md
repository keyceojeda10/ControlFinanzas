# PRESTA MIL · el cuadre que no cuadraba — 18 de agosto de 2026

Reportado en video y nota de voz a las 7:58 de la mañana. **Arreglado y
desplegado el mismo día** (`7404a89c`).

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

## Lo que hay que preguntarle

**Las inyecciones de la noche.** En 21 días hay **40 inyecciones por
$9.774.894** en sus rutas, casi todas entre las 20:00 y las 23:00 y casi todas
con la nota «vase» (base), «CUADRE» o «CUADRAR VASE».

Desde el libro **no se puede distinguir** cuáles eran plata de verdad que él le
repuso al cobrador y cuáles eran para forzar el número. Solo él lo sabe. Lo que
sí se puede decir: **desde hoy ya no hace falta ninguna por ese motivo**, y si
sigue haciéndolas el capital le va a quedar inflado.

Si quiere revisarlas, están en Mi plata → movimientos, con su hora y su nota.
