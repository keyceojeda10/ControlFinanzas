# Vídeo 1 · Cómo registrarse en el sistema

**Archivo:** `01-registro.mp4` · **Duración:** 38 s · vertical 1080×1920

Para grabar la voz en off. Los tiempos salen de la escaleta que imprime el
propio guion de grabación al terminar, no de un cálculo a mano: si se rehace
una toma y cambia de duración, se vuelve a correr y estos tiempos cambian solos.

**Cómo leerlo:** cada bloque empieza en su marca. Si sobra tiempo, callar —el
silencio sobre una pantalla que se entiende sola no molesta—. Si falta, recortar
la frase antes que acelerarla.

---

### 00:00 — 00:02 · La pantalla de registro

> Crear tu cuenta son cuatro pasos.

---

### 00:02 — 00:08 · Paso 1, tu nombre

> Lo primero, tu nombre. Es el que vas a ver dentro de la aplicación.

---

### 00:08 — 00:12 · Paso 2, el negocio

> Después, el nombre de tu negocio. Este sí es importante: es el que ven tus
> clientes en los recibos y el que ven tus cobradores cuando entran.

---

### 00:12 — 00:18 · Paso 3, país y WhatsApp

> Eliges tu país —el sistema trabaja en doce— y pones tu número de WhatsApp. Por
> ahí te llega el código para verificar la cuenta.

---

### 00:18 — 00:32 · Paso 4, correo, contraseña y términos

> El último paso son tus datos de entrada. El correo va a ser tu usuario, así que
> pon uno al que entres de verdad. Y una contraseña de mínimo ocho caracteres.
>
> *(pausa hasta que se acerque a la casilla, sobre 00:24)*
>
> Ojo con este cuadrito: hay que aceptar los términos. Si no lo marcas, el botón
> de abajo no te deja seguir.
>
> *(sobre 00:28)*
>
> Y ya está. Catorce días completos para probarlo, sin poner ninguna tarjeta.

---

### 00:32 — 00:38 · La verificación

> Al terminar te llega un código de seis dígitos por WhatsApp.
>
> Si no te llega, puedes pedirlo al correo. Y si tienes prisa, entras ya y
> verificas después.

---

## Notas para quien narre

- **Tuteo**, como el resto de la aplicación.
- **Sin palabras técnicas**: nada de «usuario», «formulario», «validar».
- Ritmo tranquilo: es un tutorial, no un anuncio.
- Lo único con énfasis: la casilla de términos y los catorce días sin tarjeta.
- El bloque de 00:18 es el más largo (14 s) y lleva tres ideas. Hay sitio de
  sobra para respirar entre ellas; las marcas entre paréntesis son dónde el
  vídeo se acerca a cada cosa.

## Lo que NO se dice, y por qué

- **El registro admite tres cuentas por hora desde la misma conexión.** Si
  alguien se equivoca varias veces le sale «Demasiados intentos» y tiene que
  esperar. No va en el vídeo —asusta más de lo que ayuda— pero **soporte debería
  saberlo**, porque parece una caída del sistema y no lo es.
- No se enseña el código de verificación escribiéndose: llega a un WhatsApp real
  y en la demostración el número es inventado.

## Si hay que rehacer un trozo

Cada bloque de arriba es una toma independiente:

```bash
node scripts/video-demo/v01-registro.mjs --toma 4   # solo «país y WhatsApp»
node scripts/video-demo/v01-registro.mjs --pegar    # y volver a pegar
```
