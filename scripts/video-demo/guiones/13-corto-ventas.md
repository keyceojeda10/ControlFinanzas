# Vídeo 13 · El corto de ventas

**Archivo:** `13-corto-ventas.mp4` · **Duración:** 1:20 · vertical 1080×1920

**No se grabó nada nuevo**: son trece pedazos recortados de los doce tutoriales.
Se genera con `node scripts/video-demo/v13-corto-ventas.mjs` y se rehace en un
minuto si quieres cambiar el orden o las duraciones.

⚠ Este **no lleva rótulos**. Los tutoriales los llevan quemados en la imagen, y
aquí estorbarían: hablan de otra cosa y se pisarían con la voz nueva. Cada
pedazo sale de un tramo sin cartel, y el propio guion lo comprueba al terminar.

**Caben ~190 palabras.** El texto de abajo tiene 178: deja aire para respirar,
que en un corto de ventas se nota más que en un tutorial.

---

## A quién le habla

A un prestamista que **todavía lleva cuaderno** y llega por WhatsApp preguntando
«¿cómo funciona?». No sabe qué es la app; en ochenta segundos tiene que ver que
esto le resuelve el día, no aprender a usarla.

Por eso el corto **no explica nada**: enseña. Y termina en una sola acción.

---

## El guion

Va marcado con el segundo en que entra cada frase y de qué vídeo sale la imagen,
por si quieres mover algo.

---

### 00:00 — 00:07 · La lista del día · *~16 palabras*
*(imagen: vídeo 9)*

> Todas las mañanas es la misma pregunta: a quién le cobro hoy, y cuánto.

---

### 00:07 — 00:15 · El préstamo · *~19 palabras*
*(imagen: vídeo 5)*

> Aquí el préstamo queda hecho con la cuenta lista: la cuota, el total y lo que
> vas a ganar.

---

### 00:15 — 00:27 · El interés · *~28 palabras*
*(imagen: vídeo 6)*

> ¿No sabes qué modo de interés usar? Respondes dos preguntas, con tus palabras,
> y él te dice cuál es el tuyo.
>
> Lo dejas puesto y no vuelves a pensarlo.

---

### 00:27 — 00:33 · Las rutas · *~14 palabras*
*(imagen: vídeo 7)*

> Las rutas se arman solas: agrupa a tus clientes por barrio y las crea.

---

### 00:33 — 00:51 · Cobrar · *~43 palabras*
*(imagen: vídeo 9)*

> Y cobrar son dos toques. Le das a cobrar, dices cómo te pagó, y ya está
> registrado.
>
> Sin apuntar nada, sin sumar de cabeza.
>
> Y si le das a «empezar ruta», te va abriendo un cliente tras otro, en orden.
> Tú solo cobras.

---

### 00:51 — 00:55 · El cliente · *~13 palabras*
*(imagen: vídeo 5)*

> Al cliente le llega su comprobante por WhatsApp, escrito solo.

---

### 00:55 — 01:08 · La noche · *~31 palabras*
*(imagen: vídeo 11)*

> Y a la noche la caja cuadra sola: lo que cobró, lo que prestó, y lo que te
> tiene que entregar.
>
> Sabes quién ya entregó y quién no.

---

### 01:08 — 01:20 · Tu plata, y la cuenta · *~34 palabras*
*(imagen: vídeos 12, 7 y 1)*

> Y en cualquier momento sabes cuánta plata es tuya y dónde está: la que tienes
> y la que está en la calle.
>
> Pruébalo catorce días. Gratis, y sin poner tarjeta.

---

## Notas para quien narre

- **Es un anuncio, no un tutorial.** Más ritmo que los otros doce, pero sin
  correr: hay aire de sobra.
- La frase que hace clic es **«sin apuntar nada, sin sumar de cabeza»**. Ahí es
  donde el del cuaderno se reconoce.
- El cierre es lo único que se pide: **catorce días, gratis, sin tarjeta**. Sin
  añadir nada después.

## De qué vídeo sale cada pedazo

| # | Vídeo | Desde | Dura | Qué se ve |
|---|---|---|---|---|
| 1 | 9 · cobrar el día | 29,8s | 7,2s | La lista del día |
| 2 | 5 · préstamo | 194,3s | 3,2s | El préstamo con la cuenta hecha |
| 3 | 6 · modos de interés | 227,8s | 5,2s | El ayudante de dos preguntas |
| 4 | 6 · modos de interés | 256,3s | 7,0s | «Usar siempre este modo» |
| 5 | 7 · rutas | 147,8s | 5,2s | Las sugerencias por barrio |
| 6 | 9 · cobrar el día | 113,3s | 10,2s | Cobrar en dos toques |
| 7 | 9 · cobrar el día | 205,8s | 8,2s | «Empezar ruta» |
| 8 | 5 · préstamo | 207,3s | 3,7s | El mensaje al cliente |
| 9 | 11 · caja | 60,3s | 7,2s | Lo que te queda en la mano |
| 10 | 11 · caja | 207,3s | 5,7s | El cuadre del día |
| 11 | 12 · capital | 35,3s | 7,7s | Toda tu plata |
| 12 | 7 · rutas | 187,3s | 6,7s | La ruta entera |
| 13 | 1 · registro | 99,8s | 2,7s | Crear la cuenta |

⚠ **Los segundos son de ESTA versión de los tutoriales.** Si se rehace alguno,
hay que volver a buscar sus tramos limpios:

```bash
node scripts/video-demo/tramos-limpios.mjs /tmp/videos/09-cobrar-el-dia.mp4 6
```

Y cada trozo entra **medio segundo dentro** del tramo por los dos lados: cuadrar
el corte con el borde exacto mete el rótulo del vecino. Pasó cuatro veces antes
de que el guion se lo comprobara solo.
