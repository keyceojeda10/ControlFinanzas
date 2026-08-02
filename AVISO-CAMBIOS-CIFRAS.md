# Aviso: qué cifras cambian y por qué

> Borrador para el dueño. **No es para enviar tal cual**: hay que elegir qué se
> le dice a cada negocio según lo que le mueva. Abajo está el texto corto listo
> para WhatsApp y, debajo, el detalle por si alguien pregunta.

---

## Por qué hay que avisar antes y no después

Un prestamista **apunta estas cifras en un cuaderno**. Si mañana ve su capital
un 37% más bajo sin que nadie le haya dicho nada, no lo lee como «lo arreglaron»:
lo lee como «ahora está peor». Y tendrá razón en desconfiar, porque no puede
distinguir un arreglo de una avería.

La regla que se siguió para decidir qué se avisa:

| | |
|---|---|
| **Silencio** | Cifras que el usuario no pudo apuntar a mano: ROI, rentabilidad, agregados de analíticas. Se corrigen y se registran, sin aviso |
| **Aviso** | Todo lo que aparece en un recibo, lo que un cobrador lee en voz alta, o lo que el dueño apunta: caja del día, esperado del día, **capital en la calle**, ganancia del mes |
| **Consentimiento** | Todo lo que cambie **lo que un cliente debe**. Nada de esta tanda entra aquí |

---

## El texto corto (WhatsApp)

> Hola [nombre]. Esta semana corregimos varias fórmulas de la app y hay tres
> números tuyos que van a cambiar. **Ninguno cambia lo que tus clientes te
> deben** — cambia cómo los estábamos calculando nosotros.
>
> **1 · «Capital en la calle» te va a bajar.** Antes te sumábamos todo lo que
> habías prestado alguna vez, sin descontar lo que tus clientes ya te
> devolvieron. Ahora descuenta. Es tu plata que sigue afuera de verdad, y es con
> la que decides si puedes prestar.
>
> **2 · El reporte de cartera por ruta te va a SUBIR, y bastante.** Ese reporte
> estaba escondiendo a tus clientes en mora. Ahora los ves — que son justo a los
> que hay que ir a cobrar.
>
> **3 · La ganancia de meses pasados puede cambiar.** Estábamos contando como
> pérdida de interés lo que en realidad era capital que no volvió. Son dos cosas
> distintas y ahora se ven por separado.
>
> Si algo no te cuadra, dime y lo revisamos juntos préstamo por préstamo.

---

## El detalle, por si preguntan

### 1 · Capital en la calle

**Qué pasaba:** se sumaba el monto original de cada préstamo activo, sin
descontar lo que el cliente ya había devuelto. Un préstamo de $500.000 con
$300.000 ya pagados seguía contando como $500.000 de capital afuera.

**Qué pasa ahora:** cada peso que entra lleva su parte de capital y su parte de
interés, así que el capital baja según el cliente paga.

**Cuánto se mueve** (medido sobre datos reales el 1 ago 2026):

| Negocio | Antes | Ahora | |
|---|---|---|---|
| El de 10 cobradores | $277.067.809 | $201.582.321 | **−27%** |
| Otro | $277.900.000 | $205.750.001 | −26% |
| Otro | $300.108.333 | $278.975.634 | −7% |
| Otro | $193.523.563 | $177.395.321 | −8% |

**Lo que NO cambia:** lo que cada cliente debe. Eso no se ha tocado.

### 2 · El reporte de cartera por ruta

**Qué pasaba:** el reporte filtraba por clientes «activos», y el estado de un
cliente moroso es literalmente «mora». Así que el reporte **escondía a todos los
morosos**.

**Cuánto escondía**, en toda la plataforma: **1.081 clientes y $631.726.806** —
el 14% de la cartera. En el negocio de 10 cobradores, 444 clientes y
$109.337.700: el **44% de su cartera** no aparecía.

**Por qué importa:** ese reporte se usa para saber a qué ruta hay que apretar.
Estaba dejando fuera justo a la gente a la que hay que ir.

### 3 · La ganancia, y el capital que no volvió

**Qué pasaba:** hay préstamos que se cerraron cobrando menos de lo que se
prestó — prestó $1.500.000, recogió $900.000, y se cerró. Eso son **850
préstamos**, y 758 de ellos cerrados justo en lo que el cliente había pagado.

La app repartía esa diferencia como «interés negativo» a lo largo de todos los
pagos de ese préstamo. Resultado: la ganancia de meses en los que no había
pasado nada malo bajaba retroactivamente el día que alguien cerraba un préstamo
viejo. En un negocio, un mes pasaba de **−$29.016.042** a **−$316.404** al
corregirlo.

**Qué pasa ahora:** eso no es interés, es **capital que no volvió**, y tiene su
propia cifra. El interés vuelve a ser interés, y la pérdida se ve como pérdida.

### 4 · Cosas que se corrigieron sin que se note

- **Préstamos con más de 30 días de mora**: antes salía siempre **0** porque
  estaba escrito a mano; ahora cuenta de verdad. En un negocio pasa de 0 a **88**.
  ⚠ Esto conviene decirlo: ver saltar un contador de 0 a 88 asusta.
- Los gastos **rechazados** ya no bajan la ganancia: esa plata nunca salió.
- La caja del día ya avisa cuando no cuadra, en vez de cuadrar siempre por una
  línea de «ajustes» que absorbía la diferencia.

---

## Antes de mandar nada

1. **Correr la foto de auditoría contra producción** y comparar con lo previsto.
   Si un negocio se mueve algo que no está en esta lista, se para y se mira.
2. **Escoger a quién se le avisa.** No todos se mueven igual: hay negocios donde
   el capital baja un 7% y otros un 27%.
3. **Tener el detalle a mano.** Si alguien dice «tu app está mal», la respuesta
   no es «no, está bien»: es abrir la cifra y enseñarle los préstamos concretos.
   Para eso está el «¿de dónde sale?» de la caja.
