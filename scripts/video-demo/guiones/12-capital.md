# Vídeo 12 · El capital: tu fondo de préstamos

**Archivo:** `12-capital.mp4` · **Duración:** 4:16 · vertical 1080×1920

Diez tomas. El último de la serie, y el que cierra la cuenta.

Ritmo de siempre: ~2,4 palabras por segundo. **Si sobra tiempo, callar.**

---

## La idea que cierra la serie

    la caja es EL DÍA · el capital es EL FONDO

Sin esa distinción, quien mira la caja y ve poco cree que el negocio va mal
cuando lo que pasa es que su plata está en la calle.

## Y la cuenta que hay que enseñar

    TODA TU PLATA        $12.544.833
      lista para prestar   $6.924.000   ← la tienes
      en la calle          $5.620.833   ← la tienen tus clientes

⚠ **Ojo con la tercera cifra.** «Por cobrar (cartera)» son $6.549.800, y **no es
lo mismo**: incluye el interés que todavía no has ganado. «En la calle» es TU
plata. Sumar la cartera al fondo es contarse plata que aún no es suya, y de ahí
salen los «gané mucho más de lo que gané».

---

### 00:00 — 00:18 · Toma 1 · Qué es el capital · *~43 palabras*

> El capital es tu fondo de préstamos: la plata que pusiste tú en el negocio.
>
> Y no es lo mismo que la caja. La caja te dice cómo fue el día; esto te dice
> cuánto tienes.

---

### 00:18 — 00:49 · Toma 2 · Dónde está tu plata · *~75 palabras*

> Arriba tienes todo lo tuyo, partido en dos.
>
> Lo que está disponible ahora mismo para prestar.
>
> Y lo que está afuera, en manos de tus clientes, cobrándose.
>
> Por eso, si abres la caja y la ves vacía, no quiere decir que el negocio vaya
> mal. Quiere decir que tu plata está trabajando.

---

### 00:49 — 01:24 · Toma 3 · Tu plata no es la cartera · *~83 palabras*

> Y aquí hay dos cifras que se confunden todo el tiempo.
>
> «Capital prestado» es tu plata: lo que entregaste y te tienen que devolver.
>
> «Por cobrar» es eso más el interés que todavía no has ganado.
>
> Sumar la cartera a tu fondo es contarte plata que aún no es tuya. Fíjate bien
> en cuál estás mirando.

*El punto del vídeo. Es de donde salen las cuentas infladas.*

---

### 01:24 — 01:51 · Toma 4 · Meter y sacar plata · *~65 palabras*

> Cuando metes plata tuya al negocio, se registra aquí.
>
> «Meto plata» cuando pones más de tu bolsillo, «saco plata» cuando retiras
> para ti.
>
> Y le pones de dónde salió o para qué fue, porque dentro de tres meses no te
> vas a acordar.

---

### 01:51 — 02:18 · Toma 5 · Cuando la cuenta no coincide · *~65 palabras*

> Y si el saldo no coincide con lo que tienes de verdad, se cuadra.
>
> Le dices cuánto tienes y el sistema anota el ajuste con su motivo.
>
> No borra nada ni lo esconde: el ajuste queda en la lista, con su fecha. Así
> dentro de un mes sabes qué pasó.

---

### 02:18 — 02:39 · Toma 6 · Prestar sin tener · *~50 palabras*

> Este interruptor decide qué pasa cuando te quedas sin fondo.
>
> Apagado, puedes prestar igual y el saldo se va a negativo. Es lo normal si
> metes y sacas plata sin registrarla toda.
>
> Encendido, el sistema no te deja prestar más de lo que tienes. Sirve cuando
> hay cobradores creando préstamos.

---

### 02:39 — 03:04 · Toma 7 · Cómo va el mes · *~59 palabras*

> Más abajo tienes el mes en cuatro cifras: cuánto prestaste, cuánto te entró,
> cuánto se fue en gastos y el balance.
>
> Y ojo: en un negocio que arranca esto sale muy negativo, y es normal. Acabas
> de soltar la plata y todavía no ha vuelto.
>
> El mes que importa es cuando ya llevas la rueda girando.

---

### 03:04 — 03:26 · Toma 8 · De dónde salió cada peso · *~51 palabras*

> Y abajo está todo lo que ha pasado con tu plata, desde el primer día.
>
> Cada movimiento con su fecha y con el saldo que iba quedando después.
>
> Y los filtros de arriba te dejan ver solo lo que agregaste, solo lo que
> retiraste, o solo lo prestado.

---

### 03:26 — 03:49 · Toma 9 · La plata que nadie está cobrando · *~55 palabras*

> Y fíjate en este aviso, que es de los que ahorran plata de verdad.
>
> Te dice cuánto tienes prestado a clientes que no están en ninguna ruta.
>
> O sea: préstamos que nadie está saliendo a cobrar. Si esa cifra crece, ahí
> tienes trabajo.

---

### 03:49 — 04:16 · Toma 10 · La caja es el día, el capital es el fondo · *~65 palabras*

> Y con esto se cierra la cuenta completa del negocio.
>
> La caja te dice cómo fue el día. El capital te dice cuánto tienes.
>
> Y las dos juntas responden la única pregunta que de verdad importa: cuánta
> plata es tuya, y dónde está ahora mismo.

---

## Notas para quien narre

- **La toma 3 es el vídeo.** Capital prestado no es cartera. Ir despacio.
- La frase que tranquiliza, y que conviene decir con calma: **«si la caja se ve
  vacía, tu plata está trabajando»**.
- La toma 7 evita un susto real: el balance del primer mes siempre sale feo.

## Lo que NO se pulsa, y por qué

- **«Registrar»** de la hoja de mover plata: metería o sacaría dinero de verdad.
- **«Cuadrar el saldo»**: es un ajuste contable y deja su asiento.
- **El interruptor de modo estricto**: se enseña y se explica; encenderlo dejaría
  el negocio de la demostración configurado distinto para los demás vídeos.

## Si hay que rehacer un trozo

```bash
node scripts/video-demo/v12-capital.mjs --toma 3   # solo «tu plata no es la cartera»
node scripts/video-demo/v12-capital.mjs --pegar
```

⚠ Cada toma rehace el mismo día —cuatro cobros por el endpoint real— y devuelve
el modo estricto a apagado.
