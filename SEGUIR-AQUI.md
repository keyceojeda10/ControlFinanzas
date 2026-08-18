# Dónde va esto — 18 de agosto de 2026

## Desplegado hoy (`20b0b44f`, verificado en el VPS)

Las **seis** cosas que salieron de revisar la app con `ccaojd@gmail.com`:

| Lo que vio | Qué era de verdad |
|---|---|
| «pago diario registrado $40.000» con $240.000 pagados | Enseñaba la CUOTA, no lo cobrado |
| Seguros «Hoy» traía un cobro viejo, y sin rango de fechas | El filtro caía a `null` en vez de a hoy |
| Las fichas de cuadrícula, ilegibles | En 180px iban dos pastillas y el monto en un renglón |
| Los botones de descarga, al final de la lista | Con 32 clientes había que recorrerla entera |
| «Desde» y «Hasta» en blanco | No decían de qué día a qué día era lo que se miraba |
| La fecha de la derecha, fuera de su caja | `globals.css` fuerza 16px a todo input bajo 1024px |
| La franja de «Ver todos», cuadrada | Su fondo tapaba las esquinas de la tarjeta |
| «Todo en bruto», un botón solo | Ni decía qué baja, ni se distinguía de «Para el contador» |

Medido en el espejo a 412 y 1440px: `node .auditoria/_ver-informes-18ago.mjs`.
Pruebas: `lib/__tests__/informes-y-cuadricula-18ago.test.js`.

## Lo siguiente

1. **Los mensajes a los cinco negocios que escribieron por el banner.**
   Están escritos y comprobados en `RESPUESTAS-SUGERENCIAS.md`, listos para
   copiar. ⚠ Los manda el dueño, no yo. El banner se apaga solo el 28 de agosto,
   así que pueden llegar más.

2. **La campaña de fotos de cuadernos** se apaga sola a las 40 fotos o el lunes
   10 de agosto — comprobar si ya se cerró. Se prometió **borrarlas antes del 31
   de agosto** y avisar cuando el cargue por fotos esté listo.

3. **Pendientes de fondo, sin fecha:** el wizard de préstamo en PC (T16-00),
   las 119 guías del bot de junio, las 1.462 filas de fechas con el convenio
   viejo, y las 28 rutas con capital negativo.

## Al medir, dos avisos

- El espejo local se arranca **con su guión**: `bash .auditoria/arrancar-espejo.sh`.
  `npx next start -p 3016` a secas lee `.env`, y `.env` apunta a producción.
- Toda medida empieza contando lo que va a medir, y descarta lo invisible
  (`getClientRects().length > 0`): hoy hubo dos falsos veredictos por eso.
