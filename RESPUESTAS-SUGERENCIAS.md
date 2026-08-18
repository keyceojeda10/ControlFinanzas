# Qué contestarle a cada uno — 17 de agosto de 2026

Las 7 sugerencias del banner, de 4 negocios, en tres días. Ninguna tenía
respuesta porque `Sugerencia` no tenía dónde anotarla; eso ya está (panel de
superadmin → **Sugerencias**: cuatro estados y una caja para escribir qué se le
contestó).

**Los textos de abajo son para mandarlos por WhatsApp tal cual**, que es por
donde escribieron. La app no les manda nada sola.

---

## Préstamos Rincón · Miguel Ángel — 5 puntos, 3 ya resueltos

| Lo que pidió | Cómo está |
|---|---|
| El fallo del francés (última cuota en $0 o disparada) | **Arreglado hoy** |
| Interés moratorio que no se puede aplicar | **Ya estaba hecho** |
| Los recaudos del mes claros en los reportes | **Ya está**: informe «Los cobros del mes» |
| Gastos vs utilidad, y utilidad vs capital recuperado | **Ya está**: informe «Para el contador», en mes/trimestre/semestre/año |
| Movimientos bancarios de entrada y salida por banco | **Ya está**: informe «Movimientos por cuenta» |
| Filtro «próximos a vencer en 5 o 10 días» + aviso | **No está.** Los filtros de hoy miran el atraso, no lo que está por vencer |
| «Cálculos inexactos en el recaudo de intereses» | **Hay que preguntarle cuál**: sin un préstamo concreto no se puede mirar |

> Miguel Ángel, le contesto sus cinco puntos:
>
> **1. El sistema francés.** Ya está corregido. Lo que pasaba no era que la
> cuenta estuviera mal: cuando usted escribe la cuota A MANO y además fija el
> plazo, la última cuota tiene que recoger la diferencia, y por eso salía en $0 o
> disparada. El problema es que la pantalla no se lo decía en ninguna parte.
> Ahora, apenas eso ocurre, le sale un aviso con las dos salidas: la cuota exacta
> que deja todas iguales, o en cuántos cobros se salda con la suya y de cuánto
> quedaría el último. Un toque y se aplica.
>
> **2. El interés moratorio** ya se puede aplicar; venía en una versión anterior
> y creo que no le avisamos. Si al abrirlo no lo ve, dígame y lo revisamos con su
> cuenta.
>
> **3. Los recaudos del mes** están en Informes → **Los cobros del mes**, cliente
> por cliente, y se baja en PDF y en Excel.
>
> **4. Los extractos para declarar** también están, los dos que pidió:
> **Para el contador** (gastos contra utilidad, y utilidad contra capital
> recuperado) en mensual, trimestral, semestral y anual; y **Movimientos por
> cuenta**, con lo que entró y salió por cada banco y por efectivo.
>
> **5. El filtro de «próximos a vencer»** todavía no existe: los que hay miran
> el atraso, no lo que está por vencerse. Queda anotado y le aviso cuando esté.
>
> Y sobre lo de los cálculos inexactos en el recaudo de intereses: ¿me pasa el
> nombre de un cliente donde lo vea? Con un caso concreto lo reviso a fondo.

---

## Crediya · Yainer — 3 puntos, ninguno resuelto todavía

| Lo que pidió | Cómo está |
|---|---|
| Ver cuánto ganó de interés **entre dos fechas** | **A medias**: el informe existe, pero solo con períodos fijos (hoy, mes, año). El rango libre es lo siguiente que se hace |
| Decidir sin límite qué pago va a capital y cuál a interés | **Es una limitación real, y ya sé por qué** |
| Ver el interés por quincena en los de interés fijo | **No se puede hoy**, y es por cómo se guarda ese modo |

**El diagnóstico del punto 2, para no contestarle de oído:** al registrar «pago
de intereses», el sistema solo cuenta el interés **ya devengado hasta hoy**
(`calcularInteresesPendientes` salta las cuotas cuya fecha aún no llegó). Si su
cliente le paga el interés **antes** de que caiga la quincena, no hay nada
devengado y sale «No hay intereses pendientes para pagar». Ahí está el bloqueo.

**Y el del punto 3:** en modo **interés fijo** el interés no se lleva aparte —va
sumado dentro del total a pagar—, así que no hay de dónde sacar «cuánto gané
esta quincena». Los modos que sí lo llevan separado son **Sobre saldo**,
**Globo** y **Decreciente**.

> Yainer, mil gracias por lo que escribió, y le contesto de frente:
>
> **1. Ver cuánto ganó de interés de una fecha a otra.** El informe existe
> (Informes → **Lo que entró**), pero hoy solo deja escoger períodos armados: el
> mes, el año. Poder pedir «del 1 al 15 de julio» es justo lo que estamos
> terminando; le aviso en cuanto esté arriba.
>
> **2. Que usted decida qué va a capital y qué a interés.** Tiene razón, y ya
> encontramos la causa: la app solo deja registrar el interés que ya se venció.
> Si su cliente le paga el interés antes de que caiga la quincena, le dice que no
> hay interés por registrar. No es que no lo dejemos: es que está mirando la
> fecha, y no debería. Lo vamos a cambiar.
>
> **3. El interés por quincena en los clientes de interés fijo.** Ahí sí le debo
> una explicación técnica: en el modo «interés fijo» el interés no se guarda
> aparte, va sumado dentro del total, y por eso no hay de dónde sacar el reparto
> por quincena. En **Sobre saldo** sí sale, porque ahí el interés se calcula
> sobre lo que queda debiendo. Si quiere, miramos juntos si le conviene mover a
> ese modo los clientes que lleva así.
>
> Y lo de llevarlo «como en el Excel»: mándeme una foto de su hoja. Si nos dice
> qué columnas mira primero, eso es lo que hay que poner en pantalla.

---

## Créditos jh · Héctor — «Está bien»

Nada que hacer. Se marca como leída.

## Inversiones Don Pacho · Gustavo — «X»

Escribió una equis: probablemente probando el botón. Nada que hacer.

---

## Lo que sale de aquí y hay que hacer

Tres cosas nuevas, ninguna inventada por mí — las tres las pidieron ellos:

1. **El interés que aún no se ha vencido se puede cobrar.** Quitar la mirada al
   calendario en `calcularInteresesPendientes` cuando el prestamista lo registra
   a mano. Bloquea a Crediya HOY, todas las quincenas.
2. **Filtro «próximos a vencer» (5 y 10 días)** en la lista de préstamos, y
   ordenar por lo más cercano a vencer. Lo pidió Rincón y dice que es el filtro
   que más usa.
3. **Interés por período en los modos sin tabla** (`fijo`, `unico`). Es el más
   grande de los tres y toca cómo se guarda el préstamo: hay que medirlo antes
   de prometerlo.
