# Vídeo 1 · Cómo registrarse en el sistema

**Archivo:** `01-registro.mp4` · **Duración:** 2:24 · vertical 1080×1920

Ocho tomas. Rehecho para igualar el ritmo del vídeo 2: la primera versión iba a
6,3 segundos por bloque y esta va a 14, que es lo que hace falta para poner la
voz encima sin correr.

**La cuenta de las palabras.** En español se narra cómodo a unas 2,4 palabras por
segundo. Debajo de cada bloque va cuántas caben. El texto propuesto deja margen:
**si sobra tiempo, callar.**

---

### 00:00 — 00:12 · La pantalla de registro · *~30 palabras*

> Crear tu cuenta son cuatro pasos.
>
> Arriba te va diciendo por cuál vas.

---

### 00:12 — 00:28 · Paso 1, tu nombre · *~38 palabras*

> Lo primero, tu nombre.
>
> Es el que verás dentro de la aplicación cuando entres.

---

### 00:28 — 00:42 · Paso 2, el negocio · *~32 palabras*

> Ahora el nombre de tu negocio.
>
> Este sí importa: es el que ven tus clientes en los recibos y el que ven tus
> cobradores cuando entran.

---

### 00:42 — 00:59 · Paso 3, país y WhatsApp · *~41 palabras*

> Eliges tu país. El sistema trabaja en doce países, así que la moneda y las
> fechas se ajustan solas al tuyo.
>
> Y pones tu WhatsApp: por ahí te llega el código para verificar la cuenta.

---

### 00:59 — 01:16 · Paso 4, correo y contraseña · *~41 palabras*

> El último paso son tus datos de entrada.
>
> El correo va a ser tu usuario, así que pon uno al que entres de verdad.
>
> Y una contraseña de mínimo ocho caracteres.

---

### 01:16 — 01:31 · La casilla de los términos · *~34 palabras*

> Ojo con este cuadrito: hay que aceptar los términos.
>
> Si no lo marcas, el botón de abajo no te va a dejar seguir.

*Es donde más gente se traba, y la pantalla no lo dice. Decirlo despacio.*

---

### 01:31 — 01:48 · Crear la cuenta · *~40 palabras*

> Y ya está: le das a «Crear cuenta gratis».
>
> Tienes catorce días completos para probarlo, sin poner ninguna tarjeta.

---

### 01:48 — 02:02 · La verificación · *~35 palabras*

> Al terminar te llega un código de seis dígitos por WhatsApp. Lo escribes ahí y
> quedas verificado.
>
> Si no te llega, puedes pedirlo al correo.

---

### 02:02 — 02:24 · Dónde te deja · *~51 palabras*

> Y si tienes prisa, entras ya y verificas después.
>
> Ya estás dentro, y el sistema no te suelta en una pantalla vacía: te recibe con
> una guía de primeros pasos.
>
> Eso es lo que vemos en el siguiente vídeo.

---

## Notas para quien narre

- Tuteo, sin palabras técnicas.
- Lo que conviene decir con énfasis: **la casilla de términos** y **los catorce
  días sin tarjeta**.
- No hace falta llenar los silencios.

## Lo que NO se dice, y por qué

- **El registro admite tres cuentas por hora desde la misma conexión.** Al cuarto
  intento sale «Demasiados intentos» y hay que esperar. No va en el vídeo
  —asusta más de lo que ayuda— pero **soporte debería saberlo**: parece una
  caída del sistema y no lo es.
- No se enseña el código escribiéndose: llega a un WhatsApp real y en la
  demostración el número es inventado.

## Si hay que rehacer un trozo

```bash
node scripts/video-demo/v01-registro.mjs --toma 6   # solo «la casilla»
node scripts/video-demo/v01-registro.mjs --pegar
```

⚠ Para grabarlo entero hay que **reiniciar el espejo antes** (`bash
.auditoria/arrancar-espejo.sh`): cada toma crea una cuenta y el límite es de
tres por hora.
