# Estado del rediseño 2026

> **Generado el 30 de julio de 2026.** Rama `rediseno-2026`, 150 commits por
> delante de `main`.

---

## ⚠ POR QUÉ NO VES NADA NUEVO

**Producción corre `main`. Todo esto está en `rediseno-2026` y no se ha
desplegado.** Si abres `app.control-finanzas.com` estás viendo el código del 29
de julio.

La prueba, medida en los dos sitios:

| | `main` (lo que ves) | `rediseno-2026` (esta rama) |
|---|---|---|
| Tokens viejos en caja | **329** | **0** |
| Índice de configuración | **no existe** | montado |
| Configuración en móvil | **15.510 px de alto** | índice + 6 pantallas |

### Para verlo

```bash
npm run dev
```

Y abre `http://localhost:3000`. Si ya lo tenías abierto, **recarga forzando**
(Ctrl+Shift+R): es una PWA y el service worker guarda la versión anterior.

Todas las pantallas juntas, con datos de mentira, en `http://localhost:3000/estilo`.

---

## Rutas de la app · 47

**Las 47 usan el sistema de color de 2026.** Cero referencias a la paleta vieja
fuera de `app/admin`, que es la consola interna y no la app del cliente.

### Con componente del rediseño montado · 17

| Ruta | Qué monta |
|---|---|
| `/dashboard` | `Panel` |
| `/caja` | `Caja` (día, cuentas, cuadre, pestañas) |
| `/cobros-hoy` | `CobrarHoy` |
| `/clientes` | `ListaClientes`, `CarteraVacia` |
| `/prestamos` | `ListaPrestamos`, `HojaFiltros` |
| `/prestamos/[id]` | `FichaPrestamo`, `Gestion`, `TablaAmortizacion` |
| `/prestamos/[id]/tabla` | `TablaAmortizacion` |
| `/rutas` | `ListaRutas` |
| `/rutas/[id]` | `DetalleRuta` (bloques de cartera y de hoy) |
| `/socios` | `SociosReparto` |
| `/socios/[id]` | `CuentaSocio` |
| `/cobradores` | `Cobradores` |
| `/reportes` | `Reportes` |
| `/configuracion` | índice móvil + 6 secciones · dos columnas en PC |
| `/mas` | `PantallaMas` |
| `/portal/login` | `PortalAcceso` |
| `/portal/prestamos/[id]` | `PortalPrestamo` |

### Rehechas sin componente de banco · 30

Pasaron al sistema nuevo pero no tienen lámina propia o la estructura se
conservó: `/gastos` (rehecha entera), `/migrador`, `/clientes/[id]`,
`/clientes/nuevo`, `/prestamos/nuevo`, `/lineas-credito` y sus dos hijas,
`/capital`, `/actividad`, `/clavos`, `/carga-masiva`, `/mis-estadisticas`,
`/configuracion/plan`, `/dashboard/analiticas`, `/cobradores/*`, `/socios/nuevo`,
`/soporte/*`, `/qr/[id]`, `/tutoriales`, `/asistente`, `/portal`.

---

## Pantallas construidas · 47 componentes

### Montadas en la app · 25

Panel, Caja, CobrarHoy, ListaClientes, CarteraVacia, ListaPrestamos, HojaFiltros,
FichaPrestamo, Gestion, TablaAmortizacion, ListaRutas, DetalleRuta, Socios,
SociosReparto, Cobradores, Reportes, Configuracion, config/TuNegocio,
config/ComoPrestas, config/PlanYPagos, config/movil, PantallaMas, MenuCrear,
RegistrarCobro, RevisionCarga, PortalCliente.

### Construidas y todavía en el banco · 22

| Pantalla | Por qué no está montada |
|---|---|
| `ClienteNuevo` | La lámina tiene 4 campos; el formulario real tiene referencia, notas, grupo y portal. Montarla te quitaría campos |
| `Simulador` | El componente es presentacional: recibe el monto como texto y no tiene `onChange`. Montarlo rompe la calculadora |
| `Renovar`, `MenuGestion` | Van dentro de la ficha de préstamo; falta enchufarlas a los modales que ya existen |
| `Recibo` | Va después de registrar un pago; falta el punto de entrada |
| `Plantillas` | Sustituye a `ModalWhatsAppTemplates` |
| `MiHistorial` | Es la vista del cliente; falta la ruta |
| `ModoRuta`, `RutaEditar`, `RutaCierre`, `FichaRuta` | La mitad de `rutas/[id]`, que son 3.000 líneas |
| `FichaCliente` | Se conservó `ClienteHeroCard` para no perder la foto y el portal |
| `Cargando`, `Estados` | Esqueletos y estados; van repartidos por todas las rutas |
| `Lucas`, `Onboarding`, `Arranque`, `Pagare`, `PlanExcedido`, `SociosEscritorio` | Cola |

---

## Láminas del paquete · 146

| | |
|---|---|
| Construidas | **~110** |
| Faltan | **~36**, casi todas de escritorio 1440 |

Bloques cerrados esta tanda: gestión del préstamo (B), cobradores (C), entrada de
datos (D).

---

## Lo que falta, por orden

1. **Desplegar a `main`** para que se vea. Es lo primero.
2. Las 22 pantallas del banco, empezando por las que ya tienen sitio: `Renovar`,
   `MenuGestion`, `Recibo`, `Plantillas`.
3. La otra mitad de `rutas/[id]` — modo ruta, editar, cierre.
4. Escritorio 1440: las ~24 láminas que quedan.
5. Los tres huecos que el paquete no dibuja y que hacen falta: estados vacíos por
   pantalla, esqueletos de carga, y mensajes de error de formulario.

---

## Decisiones de plata tomadas en el camino

Cosas que se corrigieron porque el rótulo no decía la verdad:

- **«Le debes»** en la ficha del socio enseñaba el capital que puso. Ahora dice
  «Su capital hoy». Lo que se le debe **no se puede calcular** hasta que exista el
  tipo de movimiento «reparto».
- **«Tu patrimonio»** en caja era el saldo del libro de capital: $16,5M contra los
  $24,9M del panel, con la misma definición escrita. Ahora es «Saldo del capital».
- **«Debe entregar»** del cobrador no es lo que recogió: es solo el efectivo. Lo
  que entró por transferencia ya está en la cuenta.
- **La efectividad** sin nada esperado no es 0%: no existe. Un 0% rojo por un
  domingo es una acusación falsa.
- **El hallazgo de reportes** solo aparece si TODOS los cobradores marcan cero. Si
  uno registró algo, decirlo en grande sería una acusación falsa a los demás.

---

## Pruebas

**1.512 en verde**, 89 archivos.
