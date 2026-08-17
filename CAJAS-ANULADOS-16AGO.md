# Cajas por encima en préstamos anulados — 16 de agosto de 2026

**Esto NO hay que arreglarlo en bloque.** Queda escrito para que, si un cliente
reporta que su caja no le cuadra, se reconozca en un minuto en vez de
diagnosticarlo desde cero.

## Qué pasó

Anular un préstamo deja sus pagos vivos **a propósito**: el dinero entró y se
registró. Pero el reverso tenía dos modos, y uno de ellos —«devolver todo a
caja»— devolvía el desembolso ENTERO sin descontar lo que el cliente ya había
pagado. La caja se quedaba con esos pagos de regalo:

```
Nelson Cantillo (Crediya)
  salió   $2.119.000   se desembolsó el préstamo
  entró   $1.000.001   el cliente pagó  (en realidad, un pago mal escrito)
  ajuste +$2.119.000   «devolver todo» al anularlo
  ─────────────────
  neto   +$1.000.001   de más en la caja

NELLY PEÑALOZA (PRESTAMOS PEDRO)
  salió   $2.000.000
  entró   $2.000.000   pagó el préstamo completo
  ajuste +$2.000.000   «devolver todo»
  ─────────────────
  neto   +$2.000.000   la misma plata contada dos veces
```

Con el otro modo —devolver solo lo que no se recuperó— el neto da **cero**, que
es lo correcto.

## Ya no puede volver a pasar

Arreglado en `014af2c8`, en producción. Si el préstamo tiene pagos, el servidor
**degrada** «devolver todo» a «devolver lo pendiente» y lo escribe en el log.

⚠ Se fuerza en el SERVIDOR, no solo en la pantalla: la app se usa sin señal y
con el service worker sirviendo pantallas viejas, así que una versión anterior
seguiría mandando el modo malo.

**Casos nuevos desde el arreglo: 0.**

## Cómo se reconoce

El cliente dice algo como *«la caja me muestra más plata de la que tengo»* o
*«anulé un préstamo y el movimiento sigue ahí»*. Para confirmarlo:

```sql
SELECT p.id, c.nombre,
  (SELECT COALESCE(SUM(x.monto),0) FROM MovimientoCapital x
     WHERE x.referenciaId=p.id AND x.tipo='desembolso') salio,
  (SELECT COALESCE(SUM(x.monto),0) FROM MovimientoCapital x
     WHERE x.referenciaId=p.id AND x.tipo='recaudo') entro,
  (SELECT COALESCE(SUM(x.monto),0) FROM MovimientoCapital x
     WHERE x.referenciaId=p.id AND x.tipo='ajuste') ajuste
FROM Prestamo p JOIN Cliente c ON c.id=p.clienteId
WHERE p.organizationId = '<org>' AND p.estado='cancelado'
  AND EXISTS (SELECT 1 FROM MovimientoCapital x
              WHERE x.referenciaId=p.id AND x.tipo='recaudo');
```

`-salió + entró + ajuste > 0` es un caso. Si da **cero**, ese préstamo está bien
y el descuadre viene de otra parte.

⚠ **La causa más común de una caja en negativo NO es esto.** Medido el 16 ago:
**110 negocios tienen la caja en negativo y 106 de ellos nunca registraron su
capital inicial** — empezaron a prestar antes de decirle al sistema con cuánto
arrancaban, así que cada desembolso restó de cero. Eso se arregla registrando la
inyección de capital, no tocando préstamos.

## Cómo se arregla, caso por caso

**ELIMINAR el préstamo anulado** desde la ficha del cliente. No hace falta tocar
la base.

El `DELETE` de `app/api/prestamos/[id]` hace dos cosas y las dos hacen falta:

1. Le pregunta al libro **cuánto capital ya volvió** (`capitalYaDevuelto`) y
   devuelve solo lo que falte. En un caso viejo de «devolver todo» ya volvió el
   desembolso entero, así que aquí no devuelve nada más.
2. **Reversa todos los pagos**, que es exactamente el sobrante.

Comprobado con NELLY PEÑALOZA: salió 2.000.000, entró 2.000.000, ajuste
+2.000.000 → neto +2.000.000. Al eliminar, no devuelve capital (ya volvió) y
reversa el pago: −2.000.000. **Neto final: cero.**

⚠ No mira `estabaCancelado`, le pregunta al libro. La versión que sí lo miraba
dejaba la caja **$1.000.001 por debajo** al borrar un cancelado — se cazó en el
espejo con el caso de Crediya.

⚠ Eliminar borra también el registro de que ese préstamo existió. Para un pago
mal escrito es exactamente lo que se quiere. Si el préstamo fue real y solo se
anuló, hay que preguntarle al dueño antes: puede preferir la fila con el
descuadre a perder el histórico.

## Por qué no se corrigió en bloque

Serían 55 préstamos en 31 negocios, moviendo cajas que la gente ya cuadró. Y en
la mayoría pesa poco sobre un saldo que arrastra otros desajustes conocidos: si
se corrige esto y no aquello, la caja no queda bien, queda distinta.

Solo en dos casos la cifra manda sobre la caja entera, y ahí sí conviene
avisarles:

- **SOLUCIONES Y MAS** — sobran $4.050.000 sobre una caja de $25.000. Ese
  negocio no puede confiar en su propia pantalla.
- **Inversiones EL CORDÓN DE TRES DOBLECES 4:12** — $1.000.000 sobre $2.474.520.

## La lista (medida el 16 ago 2026)

**55 préstamos · 31 negocios · $25.368.005**

Las cifras son de ese día: la caja de cada negocio se mueve, y si alguno elimina
su préstamo anulado, sale de la lista.

```
### Inversiones Don Pacho  —  sobra $9.502.834  ·  caja hoy $41.388.541  (23%)
    2026-06-13  yulieth alex                     prestó $   6.500.000  sobra $    520.000   id cmqcikp6j00y1p59lcfk0saqf
    2026-06-16  yulieth alex                     prestó $   3.850.000  sobra $  1.142.500   id cmqgmrazc01aqzi8iidwnmup5
    2026-06-16  ALEX MARTINES OJITO CHET         prestó $   3.000.000  sobra $    300.000   id cmqgnh5d701dpzi8it6skr44w
    2026-06-17  elkin mendoza                    prestó $   1.000.000  sobra $    100.000   id cmqil0yrd008ehh61k6tfjn1a
    2026-06-17  EN GRAN KARILLO                  prestó $  10.000.000  sobra $    600.000   id cmqimv9oo00hchh61x81i86ku
    2026-06-17  EN GRAN KARILLO                  prestó $  10.000.000  sobra $  1.150.000   id cmqimzrrq00j8hh61gi219jqc
    2026-06-17  EN GRAN KARILLO                  prestó $  10.000.000  sobra $    600.000   id cmqin0t4q00kbhh61uyfq8rtg
    2026-06-20  Harol Fontalvo                   prestó $     350.000  sobra $    305.000   id cmqmqdwuq00uvlruexkbgukv1
    2026-06-23  EDGAR GAVALO                     prestó $   1.000.000  sobra $    300.000   id cmqpwowfq00oazok86py6j1d6
    2026-06-30  KEVIN GARCIA                     prestó $   1.100.000  sobra $    622.000   id cmr103gxa001dxyty0m5cghdv
    2026-06-30  YESI GALLO                       prestó $   3.000.000  sobra $    770.000   id cmr10rti0000j115m58pby1kn
    2026-06-30  YURI URIBE                       prestó $   2.000.000  sobra $  1.853.334   id cmr11t2n0000gyav7yns1t4fk
    2026-07-02  Nilson Pérez                     prestó $   4.000.000  sobra $    940.000   id cmr3x4ttx0003bxuki3eo4g9u
    2026-07-03  KEVIN GARCIA                     prestó $   1.100.000  sobra $    300.000   id cmr55jj90000pl7wtmoxehtis

### SOLUCIONES Y MAS  —  sobra $4.050.000  ·  caja hoy $25.000  (16200%)
    2026-06-14  Luis José Castilla Quintero      prestó $   2.000.000  sobra $  4.050.000   id cmqd73cxd00j9ggioe0glttqv

### PRESTAMOS PEDRO  —  sobra $2.000.000  ·  caja hoy $-177.402.654  (1%)
    2026-07-04  NELLY PEÑALOZA                   prestó $   2.000.000  sobra $  2.000.000   id cmr6spymq002f5ptrexhzj8a5

### Inversiones Jk  —  sobra $1.600.000  ·  caja hoy $-23.022.260  (7%)
    2026-06-07  Hilda acuña                      prestó $   1.600.000  sobra $  1.600.000   id cmq3z6lwk01eaaphes7bqu7te

### IAM  —  sobra $1.540.000  ·  caja hoy $16.773.600  (9%)
    2026-03-22  Sindi                            prestó $  30.000.000  sobra $  1.540.000   id cmn11rtyq000jbknsqzgmn1ye

### Inversiones EL CORDÓN DE TRES DOBLECES 4:12  —  sobra $1.000.000  ·  caja hoy $2.474.520  (40%)
    2026-06-10  Juan Yulieth Mercabasto          prestó $   1.000.000  sobra $  1.000.000   id cmq7kbuj703jmqe49kr770me9

### Inversiones hermanos Sánchez  —  sobra $946.000  ·  caja hoy $-24.634.500  (4%)
    2026-06-09  Roberth                          prestó $   1.000.000  sobra $    120.000   id cmq6ylank00i7p20brc236a67
    2026-06-09  Edilberto Cervantes              prestó $     300.000  sobra $    122.000   id cmq74d1pb0118qe49j50bqhas
    2026-06-10  Liliana                          prestó $     300.000  sobra $    240.000   id cmq8io63u01h0l4rdznojfbql
    2026-06-10  Liliana                          prestó $     240.000  sobra $    184.000   id cmq8irofd01kno9c4g86zsfu7
    2026-06-11  Jaime Miranda                    prestó $     300.000  sobra $    280.000   id cmq9s9vbo00hfq2mckh88hnb8

### D&B INVERSIÓNES.  —  sobra $700.000  ·  caja hoy $17.133.700  (4%)
    2026-06-24  SEÑORA ESTER                     prestó $   1.000.000  sobra $    700.000   id cmqsqje7m01fd66jmbnn0kh49

### Fontalvo  —  sobra $600.000  ·  caja hoy $87.950.000  (1%)
    2026-07-30  Carlina zambrano                 prestó $   1.000.000  sobra $    600.000   id cms82wj1s07ljfsl0yyx3gr6g

### KEYAS SOLUCIONES S.A.S  —  sobra $600.000  ·  caja hoy $3.222.000  (19%)
    2026-08-03  MARIO ENRIQUE LOPEZ              prestó $   1.500.000  sobra $    300.000   id cmscj2nit006pqzl0q1g16syb
    2026-08-03  MARIO ENRIQUE LOPEZ              prestó $   1.500.000  sobra $    300.000   id cmscjwbnj007wqzl0ygnkvlrq

### APROVACION CRÉDITO  DE  PRESTAMO  —  sobra $370.000  ·  caja hoy $997.661.750  (0%)
    2026-07-01  Jhon Eder Cuero renteria         prestó $     500.000  sobra $    370.000   id cmr2awx1n001pcw55owlpc1wz

### INVERSIONESJYM  —  sobra $300.000  ·  caja hoy $27.364.005  (1%)
    2026-06-21  jose alexis terrero              prestó $   1.000.000  sobra $    300.000   id cmqoeq82f01sw138vlw14vu6t

### Préstamos myg  —  sobra $280.000  ·  caja hoy $-69.781.767  (0%)
    2026-07-11  ARMANDO MARTÍNEZ                 prestó $     400.000  sobra $    280.000   id cmrgryer401r3xjl0gzepcczv

### 🏦PRESTA MIL 3223846884 número SUPERVISOR para información sobre su crédito o reclamos 📝💸💰  —  sobra $270.000  ·  caja hoy $26.845.982  (1%)
    2026-06-27  MARIA GONZALEZ $250              prestó $     350.000  sobra $    270.000   id cmqwraz6i003zejssx1ichjl2

### INVESIONES J&C  —  sobra $200.000  ·  caja hoy $3.659.550  (5%)
    2026-06-11  Juan David urbina                prestó $     500.000  sobra $    200.000   id cmq8ydrrv01eiczs1adqw9qg3

### Préstamo CD  —  sobra $200.000  ·  caja hoy $-23.762.100  (1%)
    2026-06-29  Luigui chamo                     prestó $   1.000.000  sobra $    200.000   id cmqzg4gu9006r4h38r1fn0ud0

### Prestamos. S.C.  —  sobra $180.000  ·  caja hoy $830.000  (22%)
    2026-07-18  Maravilla                        prestó $     200.000  sobra $    180.000   id cmrqmftkg004mdjl0q75cix1q

### INVERSIONES & REPUESTOS  —  sobra $150.000  ·  caja hoy $21.580.151  (1%)
    2026-07-29  juan villaraga                   prestó $   1.500.000  sobra $    150.000   id cms687bv901erfsl06gd7a8ag

### Créditos charly  —  sobra $146.000  ·  caja hoy $-6.738.000  (2%)
    2026-05-24  José Eduardo Orosco Villegas     prestó $     200.000  sobra $     50.000   id cmpkdqwgy005dr16yoce452qs
    2026-05-25  Adriana Lorena Becerra           prestó $     200.000  sobra $     96.000   id cmpkl1z1v003r7hpc6wqlurit

### Inverciones J.A  —  sobra $100.000  ·  caja hoy $150.000  (67%)
    2026-07-05  Laura López                      prestó $   1.000.000  sobra $    100.000   id cmr7ab8eb000iyyqnhndiov07

### Carro gris  —  sobra $84.000  ·  caja hoy $-6.028.000  (1%)
    2026-07-28  Jesús Herrera                    prestó $     200.000  sobra $     28.000   id cms5b4b9w00fhj5l0di7qf3uh
    2026-07-28  Pablo Morales                    prestó $     200.000  sobra $     56.000   id cms5ba7eg00izk9l0ykk7di9y

### CrediLianm  —  sobra $80.000  ·  caja hoy $2.520.200  (3%)
    2026-07-05  Valentina ortega                 prestó $     200.000  sobra $     80.000   id cmr78y09s000m3yezrnpvtt7e

### Creditos jh  —  sobra $79.700  ·  caja hoy $-5.732.400  (1%)
    2026-05-27  Maicol owen                      prestó $     200.000  sobra $     49.700   id cmpo8q6dm00g7zgul4ptj2iq0
    2026-07-24  Aldermar llipeto veneno          prestó $     300.000  sobra $     30.000   id cmrybp44u03hkddl0a9ym6t8c

### Créditos Pastrana  —  sobra $75.000  ·  caja hoy $3.577.000  (2%)
    2026-07-18  Juan Ávila                       prestó $     250.000  sobra $     75.000   id cmrqyt5rn01tq24l0i1zo7ioo

### Inversiones Jesús  —  sobra $60.000  ·  caja hoy $-3.702.533  (2%)
    2026-06-30  Kanchis                          prestó $     300.000  sobra $     60.000   id cmr0t7a8q000nz4fs7yz04na5

### Santamaría  —  sobra $60.000  ·  caja hoy $-1.274.200  (5%)
    2026-06-08  Cristofer González               prestó $     250.000  sobra $     60.000   id cmq5inhxs005lu1q1ymhgfu4m

### Créditos JM  —  sobra $50.000  ·  caja hoy $-2.186.800  (2%)
    2026-04-16  María Cecilia Bocheleme quin 1   prestó $   1.000.000  sobra $     50.000   id cmo0yi7lp00nz11wpeayl5lni

### Soluciones diaz  —  sobra $40.000  ·  caja hoy $1.311.000  (3%)
    2026-04-15  María nuñes  #2 miércoles        prestó $     120.000  sobra $     40.000   id cmo0owdd10017bmqb5qzbz0sa

### esterminiosjimmy7204@gmail.com  —  sobra $36.480  ·  caja hoy $6.360.000  (1%)
    2026-06-04  Sérgio Martinez                  prestó $       5.000  sobra $     36.480   id cmpzk2lp100nocj1zgr7tn2jj

### Préstamos jc  —  sobra $35.000  ·  caja hoy $-9.496.000  (0%)
    2026-06-28  Egardo                           prestó $     150.000  sobra $     35.000   id cmqy8mugg00mfrfx63mzxz0fo

### Distribuidora BM  —  sobra $32.991  ·  caja hoy $-7.796.253  (0%)
    2026-07-07  Jhoany Calderón                  prestó $       3.000  sobra $        900   id cmrawgp8p00kwwcl0d92t8nee
    2026-07-07  Fernando rdj                     prestó $       7.000  sobra $     30.380   id cmraxlu7o00q8wcl0cahg3fs6
    2026-07-07  Edison rdj                       prestó $      15.000  sobra $      1.500   id cmraye48m00rqwol0kt6ihny5
    2026-07-07  Fernando rdj                     prestó $         700  sobra $        211   id cmrb50a5901nnwcl0mjvy3u3i
```
