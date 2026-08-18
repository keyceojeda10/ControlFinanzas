# Lo que vio el dueño revisando la app — 18 de agosto de 2026

Ocho puntos, de la cuenta `ccaojd@gmail.com`. La prioridad la pongo yo, y el
criterio es: **primero lo que informa mal de PLATA**, después lo que se usa
todos los días, y al final el pulido de reportes.

Lo anterior (vigilante, errores viejos, ChunkLoadError, modo abreviado, líneas
de crédito) está cerrado y en el historial.

---

## 1 · «PAGO DIARIO REGISTRADO $40.000» cuando pagó $240.000  ← EMPEZANDO

Punto 7 suyo. El cliente estaba atrasado y pagó **$240.000** para ponerse al
día; la ficha dice «$40.000», que es la CUOTA, no lo que entregó.

Va primero porque es una cifra de plata mal puesta en la pantalla que se abre
después de cobrar — justo cuando uno comprueba que quedó bien registrado.

## 2 · «Hoy: cobrado en seguros $10.000» de un seguro viejo

Punto 1 suyo. Ese seguro se cobró hace mucho, no hoy. O el filtro no filtra, o
lo que se cuenta no es lo que dice el rótulo. Y no tiene rango de fechas.

## 3 · Las tarjetas de la cuadrícula, ilegibles

Punto 8 suyo. En móvil, la vista comprimida de préstamos monta los números
encima de las etiquetas: «Cuota fij$1.040....». Es la pantalla que más se abre.

## 4 · Los botones de descarga, enterrados al final

Punto 2 suyo. Con 32 clientes hay que bajar 32 tarjetas para encontrar PDF y
Excel; con mil, mil. Pasa en varias pantallas de informe, hay que barrerlas
todas. Y la banda de «Ver todos» sale CUADRADA, contra el canon.

## 5 · Los selectores Desde/Hasta salen vacíos

Puntos 3 y 6 suyos, que son el mismo control. Al elegir «Mes» deberían mostrar
el tramo; salen en blanco. Y en `/reportes` el de la derecha **se sale de su
caja**. Los dos son míos, de ayer.

## 6 · «Todo en bruto» y «Para el contador»

Puntos 4 y 5 suyos. El primero es una pantalla con un botón y nada más: sin
contexto, sin fechas, sin PDF. El segundo se le parece tanto que el dueño
pregunta si sobra uno de los dos. Hay que decidirlo, no maquillarlo.

---

## Cómo se cierra cada punto

1. **Medir contra producción en solo lectura ANTES de tocar.**
2. **Derivar la cifra esperada**, no escribirla a mano.
3. **Mirar la captura**, no el JSX.
4. Espejo → `npx vitest run` → `npx next build` → `npx eslint app components` →
   subir `CACHE_NAME` → desplegar → **verificar el commit en el VPS**.
