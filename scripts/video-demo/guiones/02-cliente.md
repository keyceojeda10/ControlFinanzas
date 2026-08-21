# Vídeo 2 · Crear un cliente

**Archivo:** `02-cliente.mp4` · **Duración:** 1:51 · vertical 1080×1920

Ocho tomas. El préstamo va en el vídeo 3.

**Sobre el ritmo:** este vídeo se hizo tres veces. El segundo estaba bien
explicado pero corría, y con la voz encima eso se paga caro — o se lee acelerado
o el audio queda desfasado. Ahora cada bloque tiene aire de sobra.

**La cuenta de las palabras.** En español se narra cómodo a unas 2,4 palabras por
segundo. Debajo de cada bloque va cuántas caben. El texto propuesto siempre deja
margen: **si sobra tiempo, callar**. Un silencio de dos segundos sobre una
pantalla que se entiende sola no molesta a nadie; una frase atropellada, sí.

---

### 00:00 — 00:08 · El panel  · *caben ~21 palabras*

> Este es tu panel: lo primero que ves al entrar.
>
> Abajo a la derecha, ese botón del más abre todo.

---

### 00:08 — 00:25 · El menú  · *caben ~38 palabras*

> Al tocarlo se abre todo lo que puedes hacer.
>
> Fíjate cómo está ordenado: arriba lo que hace entrar plata, abajo lo que la
> hace salir, y después lo que puedes crear.
>
> Para meter un cliente, tocas «Un cliente nuevo».

---

### 00:25 — 00:41 · Dos formas de crearlo  · *caben ~40 palabras*

> Aquí tienes dos caminos.
>
> El primero es escribir tú los datos, uno por uno.
>
> El segundo es tomarle foto a la cartulina donde lo tienes apuntado, y el
> sistema los lee solo. Vamos a hacerlo a mano para que veas qué pide.

---

### 00:41 — 00:58 · Quién es  · *caben ~40 palabras*

> Lo primero es quién es.
>
> Y fíjate en lo que dice ahí: solo el nombre es obligatorio.
>
> Escribes el nombre y ya tienes un cliente creado. Lo demás lo completas
> después, cuando lo visites.

---

### 00:58 — 01:06 · Cédula y celular  · *caben ~19 palabras*

> La cédula sirve para encontrarlo rápido. Y con el celular le mandas el recibo
> por WhatsApp.

---

### 01:06 — 01:22 · Dónde lo ubicamos  · *caben ~38 palabras*

> Ahora dónde vive, que es para poder visitarlo y para armar la ruta.
>
> La referencia la agradece mucho el cobrador: «frente a la panadería» vale más
> que un número de casa que nadie tiene puesto.
>
> Y si quieres, marcas el punto en el mapa.

---

### 01:22 — 01:37 · La ruta  · *caben ~35 palabras*

> Aquí decides a qué ruta pertenece. Si ya las tienes armadas, lo dejas puesto
> desde ya y aparece en el recorrido del cobrador.
>
> Y si todavía no, lo creas sin ruta y se la asignas después.

---

### 01:37 — 01:51 · Crear  · *caben ~33 palabras*

> Cuando esté listo, le das a «Crear cliente».
>
> Y ya está en tu lista, listo para prestarle. Eso lo vemos en el siguiente
> vídeo.

---

## Notas para quien narre

- Tuteo, sin palabras técnicas.
- Lo que más conviene decir despacio: **la foto de la cartulina**, **«solo el
  nombre es obligatorio»** y **la referencia de la dirección**. Son las tres
  cosas que hacen decir «ah, mira».
- No hace falta llenar el silencio. El vídeo está pensado con hueco.

## Si hay que rehacer un trozo

```bash
node scripts/video-demo/v02-cliente.mjs --toma 6   # solo «dónde lo ubicamos»
node scripts/video-demo/v02-cliente.mjs --pegar
```

Los tiempos de arriba los imprime el propio guion al terminar. Si se rehace una
toma y cambia de duración, se vuelve a correr y se copian los nuevos.
