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

## Las inyecciones de la noche: NO son un parche (medido)

La sospecha razonable era que esas 40 inyecciones de $9.774.894 en 21 días
fueran él cuadrando a mano lo que el sistema debía hacer solo. **El libro dice
que no**, y conviene saberlo antes de pedirle que deje de hacerlas.

Si estuviera parcheando para que el capital igualara la cifra del cuadre, casi
todas tendrían que dejar la ruta EXACTAMENTE en esa cifra:

| | |
|---|---|
| Días con inyección | 42 |
| **Dejan el capital en la cifra que decía el cuadre** | **2** |
| **La ruta ya venía en NEGATIVO antes de inyectar** | **31** |
| La dejan exactamente en cero | 5 |
| La dejan en una cifra redonda de miles | 17 |

Y las rutas se van al rojo de verdad: **40 de 210 noches·ruta (19%)** cerraron
en negativo en 21 días, casi todas entre el 29 de julio y el 6 de agosto.

    RUTA #4   9 noches en rojo   la peor, −$875.328
    RUTA #2   8 noches           −$608.748
    RUTA #5   7 noches           −$705.068

**Conclusión: esas inyecciones son plata de verdad repuesta a rutas que se
quedaron sin base.** Son la operación normal del negocio, no un rodeo. ⚠ **No
hay que pedirle que las deje de hacer**: sería pedirle que deje de fondear a sus
cobradores.

Lo que sí se automatizó es lo que él pedía en el video —«que este número sea
igualito al del lado allá»—, y era el cuadre sin contar sus propios retiros.

## Lo que hay que preguntarle

Una sola, y concreta: en el video dice *«me toca llegar y inyectarle plata para
que este saldo suba a 794»*. Eso sí sería un parche. **¿Alguna vez metió plata
que no entregó de verdad, solo para que el número cuadrara?**

Por el libro parece que no —de 42 días con inyección, solo 2 acabaron en la
cifra del cuadre— pero la intención no se lee en una tabla. Si la respuesta es
que sí, hay que mirar esas para no dejar capital inflado. Si es que no, no hay
nada que tocar.

Y en cualquier caso: **desde hoy ninguna hace falta por ese motivo.**
