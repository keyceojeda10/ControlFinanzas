# 05 · Inventario de pantallas

106 pantallas en 39 turnos. El HTML está organizado con **el turno más nuevo arriba**;
cada turno tiene un id (`#39a`, `#38a`…) y cada pantalla un pie de foto que explica la
decisión que resuelve.

Formato: **Turno · pantalla — qué es → la decisión que resuelve.**

---

## Armazón y sistema

| Turno | Pantalla | Decisión |
|---|---|---|
| 39 | Armazón completo (panel) | Cabecera 56px + barra 76px + botón dorado; los 4 destinos |
| 39 | Hoja de cuenta | El tema claro/oscuro/auto vive aquí, no en la cabecera |
| 39 | Solo cabecera (ficha de cliente) | Atrás + título; la barra inferior desaparece |
| 39 | Sin armazón (registrar cobro) | Solo cerrar + progreso; 320px útiles con teclado |
| 39 | Armazón en 1440 | No hay cabecera superior: barra lateral de 250px |
| 39 | **Tabla normativa** | Cuándo aparece el armazón y cuándo no |

---

## Día a día (móvil)

| Turno | Pantalla | Decisión |
|---|---|---|
| 2 | Panel del dueño | Patrimonio como respuesta; "necesita tu atención" |
| 2 | Cobrar hoy | Recaudado y falta arriba; los cobrados colapsados |
| 2 | Lista de clientes | Riel de estado; barra de cumplimiento por cliente |
| 2 | Lista de préstamos | Filtros con conteo; ordenar por atraso |
| 2 | Panel de filtros | Vistas guardadas; el resultado se cuenta antes de aplicar |
| 27 | Recorrido (modo ruta) claro | Gramática de cifras del día |
| 28 | Recorrido oscuro | El tema oscuro son 4 valores, no un rediseño |
| 11 | Ruta en mapa | Pines con número de recorrido y color de estado |
| 15 | Atajos de cobro | Elegir cuál de los 2 préstamos; cerrar el bucle |

## Ficha y gestión

| Turno | Pantalla | Decisión |
|---|---|---|
| 11 | Ficha de préstamo 1440 | Historial como tabla con medio de pago y saldo resultante |
| 15 | Ficha de cliente 1440 | 12 barras de comportamiento = "¿este cómo paga?" |
| 39 | Ficha de cliente móvil | Dos préstamos + gráfico de comportamiento |
| 12 | Tabla de amortización (móvil) | Cada cuota como barra partida capital/ganancia |
| 12 | Comparar modos | Los 4 modos calculados sobre el mismo préstamo |
| 12 | Tabla completa 1440 | La columna que falta: saldo después de cada pago |
| 13 | Recargo | Falta *cuándo lo paga*: próxima cuota o repartido |
| 13 | Modificar plazo | "Lo que vas a recibir es igual" |
| 13 | Mover a perdidos | El dorado va en "seguir cobrando" |
| 19 | Descuento | ¿De dónde sale? De la ganancia o del capital |
| 19 | Próximo cobro · Día de cobro | Reprogramar sin recalcular el resto |
| 19 | Cerrar anticipado | $980.000 vuelven hoy y pueden salir esta tarde |
| 19 | Editar préstamo | Lo que recalcula 22 pagos, separado de lo que no |

## Crear y cargar datos

| Turno | Pantalla | Decisión |
|---|---|---|
| 4 | Crear préstamo (monto) | Teclado numérico y atajos de monto |
| 4 | Crear préstamo (condiciones) | Una sola barra de progreso |
| 16 | Crear préstamo 1440 | Sin wizard: la tabla se recalcula con cada tecla |
| 17 | Migrador OCR 1440 | La máquina dice cuándo no está segura |
| 7 | Crear cliente a mano | Solo lo que hace falta para cobrar mañana |
| 18 | Pagaré: antes de firmar | Escrito para leerlo en voz alta |
| 18 | Firma | La única pantalla horizontal del sistema |
| 18 | El pagaré | Dos firmas, número, código de verificación |

## Caja y dinero

| Turno | Pantalla | Decisión |
|---|---|---|
| 8 | Caja · hoy | Lo contado vs. lo registrado |
| 8 | Caja · por ruta | Las 4 rutas, incluidas las inactivas |
| 20 | Caja · cuentas | Solo el efectivo lleva las tres cifras del día |
| 20 | Caja · cuadre | La app reconoce la cifra del descuadre |
| 20 | Caja · historial | Los 4 descuadres del mes son de la misma ruta |
| 33 | El mes en caja | $10.000 de gastos sobre $8.8M = no se registran |
| 30 | Mi plata | **Prestar no es una pérdida** |
| 31 | Mi plata 1440 + modal | Meto plata / saco plata; el ajuste se separa |

## Reportes y analítica

| Turno | Pantalla | Decisión |
|---|---|---|
| 30 | Reportes móvil | Los 8 cobradores marcan $0 en 26 días |
| 32 | Reportes 1440 | La columna "le entregó": tres en −$1.000.000 |
| 30 | ¿Cómo va el negocio? | "Por cada $100 ganas $8 neto" sube al héroe |
| 31 | Analíticas 1440 | Capital y ganancia en pesos al lado del % |
| 33 | Cobros del mes 1440 | Lo único que dice cuánto *debería* entrar |
| 33 | Bajar información | Los filtros dicen cuántos van a salir: 18 · $16.2M |
| 32 | Quién hizo qué 1440 | Lo repetido se agrupa; el panel hace notar |
| 29 | Simulador | La respuesta arriba; y deja de ser un callejón |
| 30 | Línea de crédito | Sale del degradado azul; el corte sube a 2º lugar |

## Equipo y configuración

| Turno | Pantalla | Decisión |
|---|---|---|
| 9 | Cobradores | Esperado vs. recogido vs. entregado |
| 9 | Menú de configuración | 8 secciones nombradas como el dueño piensa |
| 10 | Tu negocio | El formato de montos se elige viendo las 3 opciones |
| 10 | Cómo prestas · Plan · Avisos · Portal · Seguridad | Una pantalla por sección |
| 38 | Cómo prestas 1440 | El bloque negro: $500.000 → $20.000 al día |
| 38 | Plantillas 1440 | Ver el mensaje como le llega; pastillas, no códigos |
| 11 | Plantillas de WhatsApp (móvil) | Elegir plantilla y ver el texto antes de enviar |
| 36 | Cómo me fue hoy (cobrador) | Cuánto tiene que entregar en efectivo |

## Entrada al sistema

| Turno | Pantalla | Decisión |
|---|---|---|
| 7 | Registro (nombre y negocio) | De 6 pantallas a 4 |
| 7 | Registro (WhatsApp) | Sirve para recordatorios, no solo recuperar cuenta |
| 37 | Verificar el WhatsApp | El número escrito con un "está mal" al lado |
| 37 | Elegir plan | **Invertido**: gratis 30 días, el plan se decide después |
| 37 | Listo | Dice lo que quedó cargado, con la cartera en pesos |
| 3 | Onboarding (5 pantallas) | La carga de datos es el paso que decide |
| 1 | Login | — |

## Portal del cliente

| Turno | Pantalla | Decisión |
|---|---|---|
| 36 | Recuperar la clave | La respuesta es idéntica exista el número o no |
| 36 | Historial completo | La cifra grande es lo que **ya pagó** |
| 26 | Portal (entrada y consulta) | Lleva el nombre del prestamista |

## Estados y avisos

| Turno | Pantalla | Decisión |
|---|---|---|
| 23 | Error de servidor | Culpa nuestra, no se perdió nada, sigue cobrando |
| 23 | Búsqueda sin resultados | Martha con hache: primero los parecidos |
| 22 | Cartera vacía · esqueleto | El esqueleto tiene la forma de lo que llega |
| 34 | Verificar correo · Novedades · Búsqueda global | Una línea con un botón, nunca un formulario |
| 35 | Un solo aviso arriba | Prioridad por dinero en juego, no por negocio de la app |
| 35 | Cosas por resolver | Solo avisos *de la app*; la cartera va al panel |
| 35 | Plan excedido | Se bloquea prestar, nunca cobrar |

---

## Cómo navegar el HTML

1. Abre `Control Finanzas - Rediseno.dc.html` en un navegador.
2. Está en modo lienzo: puedes hacer pan y zoom libremente.
3. **El turno 39 (arriba) es el sistema.** Empieza ahí.
4. Cada pantalla tiene debajo un pie de foto numerado (`01 ·`, `02 ·`) que explica la
   decisión. **Léelos**: contienen el criterio, no solo la descripción.
5. Los pies de foto también marcan lo que es hipotético o propuesto sin captura de
   referencia.
