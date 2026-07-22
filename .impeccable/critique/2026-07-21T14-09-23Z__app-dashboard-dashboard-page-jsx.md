---
target: dashboard principal
total_score: 23
p0_count: 2
p1_count: 2
timestamp: 2026-07-21T14-09-23Z
slug: app-dashboard-dashboard-page-jsx
---
# Crítica de diseño — Dashboard principal

Target: `app/(dashboard)/dashboard/page.jsx` (2187 líneas) + `app/api/dashboard/resumen/route.js` (521)

## Design Health Score — 23/40 (Aceptable)

| # | Heurística | Score | Problema clave |
|---|-----------|-------|----------------|
| 1 | Visibilidad del estado | 3 | Skeleton no coincide con el layout real; count-up muestra cifras falsas ~900ms |
| 2 | Correspondencia mundo real | 3 | "Patrimonio", "Promesa total", "utilidad bruta" no son del gremio |
| 3 | Control y libertad | 2 | "Mostrar solo lo esencial" oculta 5 de ~20 secciones |
| 4 | Consistencia | 2 | Mismo dato con dos nombres; radios 18/14px prohibidos; dos sistemas de loading |
| 5 | Prevención de errores | 3 | Riesgo interpretativo: patrimonio subestimado, meta diaria falsa en domingo |
| 6 | Reconocer > recordar | 2 | La meta del día vive en un grupo colapsado |
| 7 | Flexibilidad | 2 | Sin filtros por ruta/cobrador/fecha; el owner no tiene accesos rápidos |
| 8 | Estética y minimalismo | 1 | ~20 secciones, 60-100 cifras, mora repetida 5 veces |
| 9 | Diagnóstico de errores | 2 | "No se pudo cargar el resumen." sin causa ni reintento |
| 10 | Ayuda y documentación | 3 | Sistema `info` excelente pero con textos desactualizados |
| **Total** | | **23/40** | **Aceptable — mejoras significativas necesarias** |

## Veredicto anti-patrones

**Evaluación LLM:** no es "AI slop" por fealdad; la ejecución técnica es alta. El problema es que **no se puede inferir la regla**: cards con gradiente y cards sin él, dos radios de card a 2px de diferencia, el mismo dato con dos nombres. En Linear/Stripe la confianza nace de que dos elementos del mismo tipo son idénticos; aquí no lo son.

**Escaneo determinista:** el detector empaquetado de la skill no está disponible (`bundled detector not found`, dos intentos). Sustituido por escaneo manual, que CONFIRMA: 4× `rounded-[14px]` y 1× `rounded-[18px]` (prohibidos por DESIGN.md), 19 `rgba()` hardcodeados en JSX, `heatmap30d` calculado en API y no renderizado, tooltip "hora Colombia" contra `getUtcOffset(country)`.

**Cards anidadas:** `KpiGroup` (card 16px + borde) contiene `KpiCard` (card + borde), misma superficie, doble borde. Ocurre 4 veces (1739, 1802, 1839, 1880).

## Problemas prioritarios

### P0-1 · No responde "¿quién no me pagó?" hasta el scroll ~85%
`NecesitaAtencion` (2026) y `Alertas de mora` (2038) están en posición 17 y 19 de 22, tras 13 secciones de contabilidad mensual. En móvil: 6-8 pantallas de scroll con una mano.
**Fix:** subir NecesitaAtencion bajo el hero; fusionar el bloque de mora; bajar "Listos para renovar" a un enlace; mover "Tus clientes" y "Operación" a reportes.

### P0-2 · "Patrimonio" resta los gastos del mes DOS veces
`route.js:372`: `patrimonio = saldoPorCobrar + cajaDisponible - gastosMes`. Pero `cajaDisponible = capital.saldo`, y en `lib/capital.js:31` el tipo `gasto` está en la lista de egresos, así que **ya se descontó**. VERIFICADO independientemente.
**Fix:** quitar `- gastosMes` de route.js:372 y del texto interpolado en page.jsx:1769. Añadir test que fije la invariante.

### P1-3 · Los tooltips describen una API que ya cambió
Cinco desincronizaciones: tipos de pago (el enum tiene 7 valores, el tooltip nombra 3), "hora Colombia" (la API usa el país de sesión), el chip "vs ayer" que no existe, la meta diaria que ignora frecuencia y días sin cobro, y 2 de 4 ramas muertas en el tip IA.

### P1-4 · El mismo dato aparece hasta 5 veces, con nombres distintos
Mora en 5 lugares. "Saldo en caja" y "Saldo disponible" son el mismo valor con dos nombres. Recaudo de hoy en 4 lugares.

### P2-5 · La card KPI completa abre un glosario en vez de navegar
8 cards con `role="button"` que abren definiciones. El círculo "i" visible es `pointer-events-none`: el usuario aprende el gesto contrario al sugerido.

### P3-6 · Código muerto que cuesta consultas a la DB
`Heatmap30d` nunca se renderiza pero la API consulta 30 días de pagos individuales en cada carga.

## Persona red flags

**Alex (power user):** clic en KPI abre glosario, no navega. Cero filtros. Count-up le miente al entrar.
**Casey (móvil, sol):** targets de 28px y 36px bajo el mínimo de 40px; **el monto del hero se trunca** con 7 cifras en pantalla pequeña; texto de apoyo a ~2.8:1 de contraste contra el 4.5:1 exigido.

## Fortalezas

1. **Sistema `info` con ejemplo interpolado con datos reales del usuario** — enseña con las cifras del propio negocio, no con un ejemplo inventado. Pieza a conservar y arreglar, nunca a quitar.
2. **Disciplina de tokens y mono tabular sin excepciones en montos** — `color-mix` sistemático, `.font-mono-display` en todos los montos.
3. **Estrategia de datos para señal mala** — cache-first desde IndexedDB, revalidación en background, re-fetch en visibilitychange/focus/online.

## Preguntas

- ¿Qué pasaría si el dashboard respondiera solo tres preguntas y todo lo demás viviera en Reportes?
- ¿El dueño necesita "Clientes activos" cada mañana, o eso es un número de vanidad?
