// lib/tutorialesData.js — Datos de tutoriales organizados por categorías

export const CATEGORIAS = [
  { id: 'inicio', label: 'Primeros pasos', color: '#22c55e' },
  { id: 'clientes', label: 'Clientes y prestamos', color: '#3b82f6' },
  { id: 'cobro', label: 'Cobro y rutas', color: '#f59e0b' },
  { id: 'admin', label: 'Administracion', color: '#8b5cf6' },
  { id: 'extras', label: 'Extras', color: '#ec4899' },
]

export const TUTORIALES = [
  // ════════════════════════════════════════════
  // PRIMEROS PASOS
  // ════════════════════════════════════════════
  {
    id: 'registrarse',
    categoria: 'inicio',
    videoId: '_zGxVXUJr-Y',
    title: 'Cómo registrarse en la plataforma',
    images: [{ src: '/tutoriales/01_login.png', caption: 'Pantalla de login — enlace "Regístrate gratis"' }],
    text: `📱 *Cómo registrarse en Control Finanzas*

1. Entra a *app.control-finanzas.com*
2. En la pantalla de inicio, toca *"Regístrate gratis"* (abajo del botón Ingresar)
3. Llena el formulario con tu nombre, correo y contraseña
4. Toca *"Crear cuenta"*
5. Revisa tu correo electrónico y confirma tu cuenta con el enlace que te llegó
6. ¡Listo! Ya puedes iniciar sesión

💡 *Tip:* Usa un correo que revises seguido porque ahí te llegarán las notificaciones del sistema.`,
  },
  {
    id: 'verificar-correo',
    categoria: 'inicio',
    videoId: 'LkUSjXpqXsk',
    title: 'Cómo verificar tu correo electrónico',
    images: [],
    text: `📧 *Cómo verificar tu correo electrónico*

Después de registrarte, necesitas confirmar tu correo para activar tu cuenta:

1. Revisa la *bandeja de entrada* del correo con el que te registraste
2. Busca un correo de *Control Finanzas* con el asunto "Verifica tu correo"
3. Abre el correo y toca el botón *"Verificar mi correo"*
4. Te redirige al sistema con tu cuenta ya verificada
5. ¡Listo! Ya puedes usar todas las funciones

⚠️ *¿No te llegó el correo?*
• Revisa la carpeta de *spam* o *correo no deseado*
• Espera unos minutos e intenta de nuevo
• Si usas Gmail, revisa la pestaña *"Promociones"*

💡 *Tip:* Si después de 5 minutos no te llega, puedes reenviar el correo de verificación desde la pantalla de aviso.`,
  },
  {
    id: 'login',
    categoria: 'inicio',
    videoId: 'unpPU2hzONs',
    title: 'Cómo iniciar sesión',
    images: [{ src: '/tutoriales/01_login.png', caption: 'Pantalla de login' }],
    text: `🔑 *Cómo iniciar sesión*

1. Entra a *app.control-finanzas.com*
2. Escribe tu *correo electrónico*
3. Escribe tu *contraseña*
4. Toca el botón amarillo *"Ingresar"*
5. Te llevará al Dashboard (panel principal)

⚠️ Si olvidaste tu contraseña, toca *"¿Olvidaste tu contraseña?"* y sigue los pasos.`,
  },
  {
    id: 'password',
    categoria: 'inicio',
    videoId: 'KSkOhFhPUIU',
    title: 'Cómo recuperar tu contraseña',
    images: [{ src: '/tutoriales/01_login.png', caption: 'Enlace "¿Olvidaste tu contraseña?"' }],
    text: `🔓 *Cómo recuperar tu contraseña*

1. Entra a *app.control-finanzas.com*
2. Toca *"¿Olvidaste tu contraseña?"* (debajo del campo de contraseña)
3. Escribe el *correo electrónico* con el que te registraste
4. Toca *"Enviar enlace"*
5. Revisa tu correo (puede llegar a spam)
6. Abre el correo y toca el enlace para crear una nueva contraseña
7. Escribe tu nueva contraseña y confírmala
8. ¡Listo! Ya puedes ingresar con tu nueva contraseña

💡 *Tip:* La contraseña debe tener mínimo 6 caracteres.`,
  },
  {
    id: 'dashboard',
    categoria: 'inicio',
    videoId: 'b5x-lWu_vbA',
    title: 'Cómo usar el Dashboard',
    images: [{ src: '/tutoriales/02_dashboard.png', caption: 'Dashboard — Panel principal' }],
    text: `📊 *Cómo usar el Dashboard (Panel principal)*

El Dashboard es la pantalla principal que ves al entrar. Ahí encuentras el resumen de tu negocio:

📌 *Lo que puedes ver:*
• *Clientes activos* — cuántos clientes tienes y cuántos están en mora
• *Préstamos activos* — cantidad de préstamos vigentes
• *Cartera activa* — el total de dinero que te deben
• *Cuota diaria total* — lo que esperas recibir por día
• *Recaudado hoy* — lo que ya cobraste hoy con barra de progreso
• *Recaudado este mes* — total cobrado en el mes
• *Últimos pagos* — los pagos más recientes
• *Alertas de mora* — clientes atrasados organizados por gravedad

📌 *Accesos rápidos (abajo):*
• Nuevo cliente
• Nuevo préstamo
• Cierre de caja
• Capital
• Rutas
• Configuración`,
  },

  // ════════════════════════════════════════════
  // CLIENTES Y PRÉSTAMOS
  // ════════════════════════════════════════════
  {
    id: 'crear-cliente',
    categoria: 'clientes',
    videoId: 'EEGrlsU-k7Y',
    title: 'Cómo crear un cliente nuevo',
    images: [
      { src: '/tutoriales/03_clientes_lista.png', caption: 'Lista de clientes → botón "+ Nuevo cliente"' },
      { src: '/tutoriales/04_cliente_nuevo.png', caption: 'Formulario de nuevo cliente' },
    ],
    text: `👤 *Cómo crear un cliente nuevo*

1. En el menú de abajo, toca *"Clientes"*
2. Toca el botón amarillo *"+ Nuevo cliente"* (arriba a la derecha)
3. Llena los datos:
   • *Nombre completo* (obligatorio)
   • *Cédula* (obligatorio, 6-12 dígitos)
   • *Teléfono* (obligatorio)
   • Dirección (opcional)
   • Referencia (opcional, ej: "Tienda La Esquina")
   • Notas (opcional)
4. Toca *"Guardar cliente"*

✅ El cliente queda registrado y listo para asignarle préstamos.

💡 *Tip:* Si ya tienes una ruta creada, puedes asignarle la ruta al momento de crearlo.`,
  },
  {
    id: 'editar-cliente',
    categoria: 'clientes',
    videoId: '4Cl0POT9cFU',
    title: 'Cómo editar un cliente',
    images: [{ src: '/tutoriales/05_cliente_detalle.png', caption: 'Detalle del cliente → botón "Editar"' }],
    text: `✏️ *Cómo editar un cliente*

1. Ve a *"Clientes"* en el menú de abajo
2. Toca el nombre del cliente que quieres editar
3. En la ficha del cliente, toca el botón *"Editar"*
4. Modifica los datos que necesites (nombre, teléfono, dirección, notas, etc.)
5. Toca *"Guardar cambios"*

✅ Los datos se actualizan al instante.

⚠️ *Importante:* Si cambias la cédula, el sistema verifica que no esté repetida.`,
  },
  {
    id: 'eliminar-cliente',
    categoria: 'clientes',
    title: 'Cómo eliminar, inactivar o trasladar clientes',
    images: [{ src: '/tutoriales/05_cliente_detalle.png', caption: 'Detalle del cliente — botones Inactivar y Eliminar' }],
    text: `🗑️ *Cómo eliminar, inactivar o trasladar clientes*

Desde la ficha de cada cliente, el administrador puede inactivar o eliminar clientes. Solo el administrador tiene acceso a estas opciones.

---

📌 *Inactivar un cliente:*

1. Ve a *"Clientes"* → toca el cliente
2. En los botones de la ficha, toca *"Inactivar"*
3. El cliente queda marcado como *"Inactivo"* (badge gris)
4. Sigue apareciendo en tu lista pero sabes que no está activo
5. Puedes reactivarlo en cualquier momento tocando *"Activar"*

💡 *Usa "Inactivar" cuando:* el cliente terminó de pagar y no quieres verlo como activo, pero tampoco quieres borrarlo.

---

📌 *Eliminar un cliente (sin préstamos):*

1. Ve a *"Clientes"* → toca el cliente
2. Toca el botón rojo *"Eliminar"*
3. Si el cliente *no tiene préstamos*, se elimina de tu lista inmediatamente
4. El cliente desaparece de todas las vistas (lista, rutas, reportes, etc.)

---

📌 *Eliminar un cliente que tiene préstamos:*

Si el cliente tiene préstamos asignados, al tocar "Eliminar" te aparece un modal con cada préstamo y dos opciones:

*Opción 1: Trasladar el préstamo a otro cliente*
1. Toca *"Trasladar a otro cliente"*
2. Busca el cliente destino por nombre o cédula
3. Toca el cliente al que quieres moverle el préstamo
4. El préstamo se mueve con todo su historial de pagos al nuevo cliente

*Opción 2: Eliminar el préstamo*
1. Toca *"Eliminar préstamo"*
2. Confirma la acción (se eliminan el préstamo y todos sus pagos)

Una vez que no queden préstamos, el cliente se elimina automáticamente.

💡 *Usa "Trasladar" cuando:* un cliente pasa su deuda a un familiar, amigo o conocido. El préstamo se mueve con todo el historial intacto.

---

⚠️ *Importante:*
• Solo el *administrador* puede eliminar e inactivar clientes
• Los clientes eliminados *no se borran de la base de datos*, solo desaparecen de tu vista
• Los cobradores no ven estas opciones`,
  },
  {
    id: 'crear-prestamo',
    categoria: 'clientes',
    videoId: 'wuk7J8zd_Ko',
    title: 'Cómo crear un préstamo',
    images: [
      { src: '/tutoriales/06_prestamos_lista.png', caption: 'Lista de préstamos' },
      { src: '/tutoriales/07_prestamo_nuevo.png', caption: 'Formulario nuevo préstamo' },
    ],
    text: `💰 *Cómo crear un préstamo*

1. En el menú de abajo, toca *"Préstamos"*
2. Toca el botón *"+ Nuevo préstamo"*
3. Selecciona el tipo: *Préstamo* o *Mercancía*
4. Llena los datos:
   • *Cliente* — busca por nombre o cédula
   • *Monto prestado* — la cantidad en pesos
   • *Tasa de interés (%)* — ej: 20%
   • *Plazo (días)* — ej: 30 días
   • *Frecuencia de cobro* — Diario, Semanal, Quincenal o Mensual
   • *Fecha de inicio*
5. Revisa el resumen que aparece abajo (cuota, total a pagar, etc.)
6. Toca *"Crear préstamo"*

✅ El préstamo queda activo y las cuotas se calculan automáticamente.

💡 *Ejemplo:* Si prestas $100.000 al 20% a 30 días diario:
• Total a pagar: $120.000
• Cuota diaria: $4.000`,
  },
  {
    id: 'registrar-pago',
    categoria: 'clientes',
    videoId: 'CPnWwHtrTiQ',
    title: 'Cómo registrar un pago',
    images: [{ src: '/tutoriales/08_prestamo_pago.png', caption: 'Botón verde "Registrar pago"' }],
    text: `💵 *Cómo registrar un pago*

1. Ve a *"Préstamos"* en el menú de abajo
2. Toca el préstamo del cliente al que le vas a registrar el pago
3. En la pantalla del préstamo, verás el botón verde *"Registrar pago — $XX.XXX"*
4. Toca ese botón para registrar la cuota completa

   *¿Y si paga un monto diferente?*
   Toca *"+ Hacer abono extraordinario"* y escribe el monto que pagó

5. ¡Listo! El pago queda registrado, el saldo se actualiza automáticamente y se ve en el historial

💡 *Tip:* En el resumen financiero puedes ver:
• Saldo pendiente
• Porcentaje pagado (barra de progreso)
• Días en mora (si aplica)`,
  },

  {
    id: 'abono-capital',
    categoria: 'clientes',
    title: 'Cómo hacer un abono a capital',
    images: [],
    text: `🏦 *Cómo hacer un abono a capital*

El abono a capital es un pago especial que reduce el *principal* del préstamo (el monto original prestado), lo que también reduce los intereses pendientes. Es diferente a un pago normal que solo abona a la deuda total.

📌 *Cuándo usarlo:*
• El cliente quiere adelantar una parte grande del préstamo
• El cliente quiere reducir su deuda base (no solo pagar cuotas)

📌 *Cómo hacerlo:*

1. Ve al *detalle del préstamo* del cliente
2. Toca *"+ Hacer abono extraordinario"*
3. En el modal de pago, selecciona el tipo *"Abono a capital"*
4. Ingresa el monto que el cliente va a abonar
5. El sistema te muestra cuánto se reduce el total a pagar (capital + ahorro de intereses)
6. Confirma el pago

📌 *¿Qué pasa después?*
• El *total a pagar* se reduce (no solo el saldo, sino también los intereses sobre ese capital)
• El ahorro de intereses aparece en morado en el historial
• La cuota diaria se mantiene igual, pero el préstamo se termina antes

📌 *Ejemplo:*
Préstamo de $100.000 al 20% (total $120.000)
Si el cliente abona $50.000 a capital:
• Se descuentan $50.000 del principal
• Se ahorran $10.000 de interés (20% de $50.000)
• Nuevo total a pagar: $60.000

⚠️ *Importante:*
• El abono a capital *no puede superar* el capital restante
• En el historial aparece con badge morado *"A Capital"*
• También se registra como recaudo en el módulo de Capital`,
  },
  {
    id: 'recargo-descuento',
    categoria: 'clientes',
    title: 'Cómo aplicar recargos y descuentos',
    images: [],
    text: `⚖️ *Cómo aplicar recargos y descuentos a un préstamo*

Los recargos y descuentos son ajustes al saldo de un préstamo. Sirven para sumar o restar montos por situaciones especiales fuera de los pagos normales.

━━━━━━━━━━━━━━━━━━━━━━
📌 *RECARGO (sumar al saldo)*
━━━━━━━━━━━━━━━━━━━━━━

Usa el recargo cuando necesites *agregar dinero* al saldo del préstamo:

• *Multa por mora* — el cliente se pasó del plazo y le cobras penalidad
• *Artículo adicional* — el cliente de mercancía saca un artículo nuevo
• *Cargo extra* — cualquier concepto que quieras sumarle a la deuda

*Cómo hacerlo:*
1. Ve al *detalle del préstamo*
2. Toca el botón naranja *"Recargo"*
3. Ingresa el *monto* del recargo
4. Escribe el *motivo* (obligatorio) — ej: "Multa por 5 días de atraso"
5. Verás el preview: Saldo actual → Nuevo saldo (más alto)
6. Toca *"Aplicar recargo"*

El saldo del préstamo sube inmediatamente.

━━━━━━━━━━━━━━━━━━━━━━
📌 *DESCUENTO (restar del saldo)*
━━━━━━━━━━━━━━━━━━━━━━

Usa el descuento cuando necesites *quitar dinero* del saldo del préstamo:

• *Pago anticipado* — el cliente pagó antes, le descuentas intereses no causados
• *Artículo devuelto* — la mercancía salió mala y le descuentas ese valor
• *Pago de contado* — el cliente quiere pagar todo ya y le haces descuento

*Cómo hacerlo:*
1. Ve al *detalle del préstamo*
2. Toca el botón verde *"Descuento"*
3. Ingresa el *monto* del descuento
4. Escribe el *motivo* (obligatorio) — ej: "Descuento por pago anticipado 1 mes"
5. Verás el preview: Saldo actual → Nuevo saldo (más bajo)
6. Toca *"Aplicar descuento"*

El saldo del préstamo baja inmediatamente. Si llega a $0, el préstamo se marca como completado.

━━━━━━━━━━━━━━━━━━━━━━
📌 *¿Dónde se ven en el historial?*
━━━━━━━━━━━━━━━━━━━━━━

En el historial de pagos del préstamo:
• *Recargo* — aparece en naranja con signo *+* y badge rojo "Recargo"
• *Descuento* — aparece en verde con signo *−* y badge azul "Descuento"
• El motivo que escribiste aparece debajo de cada registro

━━━━━━━━━━━━━━━━━━━━━━
📌 *¿Se pueden anular?*
━━━━━━━━━━━━━━━━━━━━━━

Sí. Si te equivocaste, puedes anular un recargo o descuento igual que un pago normal:
1. En el historial, toca el ícono de papelera al lado del registro
2. Confirma la anulación
3. El saldo vuelve a como estaba antes

⚠️ *Importante:*
• Solo el *administrador* puede aplicar recargos y descuentos (los cobradores no)
• Los recargos y descuentos *no cuentan* como pagos reales
• No afectan el cierre de caja ni los reportes de ingresos
• No afectan el recaudado del cobrador
• El motivo es *obligatorio* para tener trazabilidad
• El descuento no puede superar el saldo pendiente`,
  },

  // ════════════════════════════════════════════
  // COBRO Y RUTAS
  // ════════════════════════════════════════════
  {
    id: 'crear-ruta',
    categoria: 'cobro',
    videoId: 'tldha8LjE4c',
    title: 'Cómo crear una ruta',
    images: [{ src: '/tutoriales/09_rutas_lista.png', caption: 'Lista de rutas → botón "+ Nueva ruta"' }],
    text: `🗺️ *Cómo crear una ruta*

1. En el menú de abajo, toca *"Más"* → luego *"Rutas"*
2. Toca el botón *"+ Nueva ruta"*
3. Escribe el *nombre de la ruta* (ej: "Ruta Norte", "Zona Centro")
4. Toca *"Crear"*

✅ La ruta queda creada. Ahora puedes:
• Asignarle un cobrador
• Agregar clientes a la ruta

💡 *Tip:* Puedes crear tantas rutas como necesites para organizar tus zonas de cobro.`,
  },
  {
    id: 'enrutar-desenrutar',
    categoria: 'cobro',
    title: 'Cómo enrutar y desenrutar clientes',
    images: [{ src: '/tutoriales/10_ruta_detalle.png', caption: 'Detalle de ruta con "+ Agregar clientes" y ✕' }],
    text: `📋 *Cómo enrutar y desenrutar clientes*

✅ *ENRUTAR un cliente (asignarlo a una ruta)*

1. Ve a *Rutas* en el menú
2. Selecciona la ruta donde quieres agregar el cliente
3. Toca el botón *"+ Agregar clientes"*
4. Te aparecen los clientes que no tienen ruta
5. Marca los que quieres agregar con el checkbox ☑️
6. Presiona *"Agregar"*

¡Listo! El cliente queda asignado.

---

❌ *DESENRUTAR un cliente (quitarlo de una ruta)*

1. Ve a *Rutas* → entra a la ruta donde está el cliente
2. En la lista de clientes, al lado de cada uno hay una ✕
3. Toca la ✕ del cliente que quieres quitar
4. El cliente se quita de la ruta (no se elimina, solo se desvincula)

Después lo puedes volver a asignar a cualquier otra ruta sin problema.

---

⚠️ *Importante*
• Solo el *administrador* puede enrutar y desenrutar clientes
• Si eliminas una ruta, los clientes quedan sin ruta pero no se borran`,
  },
  {
    id: 'reordenar-ruta',
    categoria: 'cobro',
    title: 'Cómo reordenar clientes en una ruta',
    images: [{ src: '/tutoriales/10_ruta_detalle.png', caption: 'Flechas ↑↓ para reordenar clientes' }],
    text: `🔄 *Cómo reordenar clientes en una ruta*

El orden de los clientes en la ruta define el recorrido del cobrador. Puedes cambiarlo así:

1. Ve a *Rutas* → selecciona la ruta
2. En la lista de clientes verás unas *flechitas ↑ ↓* al lado izquierdo de cada cliente
3. Toca *↑* para subir un cliente o *↓* para bajarlo
4. El orden se *guarda automáticamente*

💡 *Tip:* En computador también puedes *arrastrar y soltar* los clientes para reordenarlos.

✅ Aparecerá brevemente el mensaje "Orden guardado" confirmando el cambio.`,
  },
  {
    id: 'recorrer-ruta',
    categoria: 'cobro',
    title: 'Cómo recorrer una ruta de cobro',
    images: [{ src: '/tutoriales/10_ruta_detalle.png', caption: 'Ruta con indicadores de pago y navegación' }],
    text: `🚀 *Cómo recorrer una ruta de cobro (paso a paso)*

El sistema te guía cliente por cliente para que no pierdas tiempo volviendo a la lista. Así funciona:

📌 *Empezar la ruta:*

1. Ve a *Rutas* y toca la ruta que vas a cobrar
2. Toca el *primer cliente* de la lista
3. A partir de ahí, el sistema te lleva de cliente en cliente automáticamente

---

📌 *Navegación entre clientes:*

Cuando estás en la ficha de un cliente (viniendo desde la ruta), verás:
• *Barra de navegación arriba* — muestra "3 de 15" y flechas ← → para moverte
• *Botón "No pagó · Siguiente"* — si el cliente no pagó, lo saltas y pasas al siguiente
• Después de registrar un pago, aparece *"Siguiente → [nombre del cliente]"* para avanzar directo
• En el *último cliente* aparece *"Ruta finalizada · Volver a [ruta]"*

---

📌 *Indicadores de pago en la ruta:*

Al ver la lista de clientes en la ruta, cada uno muestra su estado:
• 🟢 *Punto verde + "Pagó hoy"* — ya pagó la cuota del día
• 🟡 *Punto amarillo + "Pagó ayer · Falta hoy"* — pagó ayer pero hoy no
• 🟠 *Punto naranja + "Hace X días"* — lleva varios días sin pagar
• 🔴 *Punto rojo* — tiene mora

---

📌 *Continuar ruta después de una pausa:*

Si cierras la app y vuelves a abrir la misma ruta *el mismo día*:
• Te aparece un *banner amarillo* con el nombre del último cliente que visitaste
• Toca *"Continuar ruta"* para retomar desde donde ibas
• O toca *"Nueva ruta"* para empezar desde el principio

La lista se desplaza automáticamente al siguiente cliente que te toca visitar.

---

💡 *Tips:*
• El orden de los clientes *nunca cambia* durante el recorrido. Si los reordenaste antes, se mantiene así
• Si entras a un cliente desde *Préstamos* (no desde la ruta), no aparece la navegación de ruta — funciona como siempre
• El administrador también puede recorrer rutas de la misma forma`,
  },
  {
    id: 'crear-cobrador',
    categoria: 'cobro',
    videoId: 'zQdJ8019zrQ',
    title: 'Cómo crear un cobrador',
    images: [
      { src: '/tutoriales/11_cobradores_lista.png', caption: 'Lista de cobradores' },
      { src: '/tutoriales/12_cobrador_nuevo.png', caption: 'Formulario nuevo cobrador con permisos' },
    ],
    text: `👷 *Cómo crear un cobrador*

1. En el menú de abajo, toca *"Más"* → luego *"Cobradores"*
2. Toca el botón *"+ Nuevo cobrador"*
3. Llena los datos:
   • *Nombre completo*
   • *Correo electrónico* — con este correo el cobrador inicia sesión
   • *Contraseña temporal* — mínimo 6 caracteres (luego la puede cambiar)
4. Configura los *permisos* (están desactivados por defecto):
   • Crear préstamos
   • Crear clientes
   • Editar clientes
5. Toca *"Crear cobrador"*

✅ El cobrador ya puede ingresar al sistema con su correo y contraseña.

💡 *Tip:* Después de crearlo, asígnalo a una ruta para que vea solo los clientes de esa ruta.`,
  },
  {
    id: 'permisos-cobrador',
    categoria: 'cobro',
    title: 'Cómo configurar permisos de un cobrador',
    images: [{ src: '/tutoriales/12_cobrador_nuevo.png', caption: 'Sección "PERMISOS DEL COBRADOR"' }],
    text: `🔐 *Cómo configurar permisos de un cobrador*

Los permisos controlan qué puede hacer cada cobrador en el sistema:

1. Ve a *Cobradores*
2. Toca el cobrador que quieres configurar
3. Toca *"Editar"*
4. Busca la sección *"PERMISOS DEL COBRADOR"*
5. Activa o desactiva cada permiso:

   🔘 *Crear préstamos* — Puede registrar nuevos préstamos para clientes de su ruta
   🔘 *Crear clientes* — Puede registrar clientes nuevos (se asignan a su ruta automáticamente)
   🔘 *Editar clientes* — Puede modificar datos como teléfono, dirección, etc.

6. Guarda los cambios

⚠️ *Importante:*
• Los permisos vienen *desactivados* por defecto
• El cobrador solo ve los clientes de *su ruta asignada*
• Solo el *administrador* puede cambiar estos permisos`,
  },

  // ════════════════════════════════════════════
  // ADMINISTRACIÓN
  // ════════════════════════════════════════════
  {
    id: 'cierre-caja',
    categoria: 'admin',
    title: 'Cómo hacer cierre de caja',
    images: [{ src: '/tutoriales/13_caja.png', caption: 'Página de Caja — Resumen del día' }],
    text: `📊 *Cómo hacer cierre de caja*

El cierre de caja te permite registrar cuánto dinero recogió el cobrador al final del día.

1. En el menú de abajo, toca *"Caja"*
2. Selecciona la *fecha* del cierre (por defecto es hoy)
3. Verás el *resumen del día*:
   • Esperado — lo que debieron cobrar
   • Recaudado — lo que efectivamente pagaron los clientes
   • Gastos — gastos menores del día
   • Disponible — lo que debería tener el cobrador
4. En la sección *COBRADORES*, al lado de cada cobrador verás si ya cerró o está *"Pendiente"*
5. Toca el cobrador → ingresa el *monto que entregó*
6. El sistema calcula automáticamente la diferencia

💡 *Tip:* También puedes registrar *gastos menores* del día (gasolina, almuerzos, etc.) tocando el botón ➕ en "Gastos menores".`,
  },
  {
    id: 'capital',
    categoria: 'admin',
    title: 'Cómo usar el control de Capital',
    images: [],
    text: `🏦 *Cómo usar el control de Capital*

El módulo de Capital te permite llevar el control de cuánto dinero disponible tienes para prestar. Se actualiza automáticamente con cada préstamo, pago y gasto.

📌 *Cómo configurarlo:*

1. En el menú lateral, toca *"Capital"*
2. La primera vez te pedirá que registres tu *capital inicial* (cuánto tienes disponible para prestar)
3. Ingresa el monto y toca *"Registrar"*

📌 *Qué se actualiza automáticamente:*
• Cuando creas un préstamo → se *resta* del saldo (desembolso)
• Cuando un cliente paga → se *suma* al saldo (recaudo)
• Cuando apruebas un gasto → se *resta* del saldo

📌 *Movimientos manuales:*
Puedes registrar movimientos adicionales tocando *"+ Movimiento"*:
• *Inyectar capital* — agregas más dinero para prestar
• *Retirar capital* — sacas plata para uso personal
• *Ajuste manual* — correcciones si algo no cuadra

📌 *Lo que ves en la página:*
• *Saldo disponible* — cuánto tienes en caja ahora mismo
• *Stats del mes* — desembolsado, recaudado, gastos y flujo neto
• *Historial de movimientos* — todos los movimientos con filtros

⚠️ *Importante:*
• Es totalmente opcional, no afecta el funcionamiento normal del sistema
• Solo el administrador puede ver y gestionar el capital
• Si no lo configuras, todo sigue funcionando igual que siempre
• El saldo también aparece en el Dashboard como "Saldo disponible"`,
  },
  {
    id: 'reportes',
    categoria: 'admin',
    title: 'Cómo ver reportes',
    images: [{ src: '/tutoriales/14_reportes.png', caption: 'Página de Reportes con gráficas' }],
    text: `📈 *Cómo ver reportes*

1. En el menú de abajo, toca *"Más"* → luego *"Reportes"*
2. Selecciona el *rango de fechas* que quieres consultar
3. Verás un resumen completo:

📌 *Métricas principales:*
   • Clientes activos y en mora
   • Préstamos activos
   • Cartera activa (cuánto te deben)
   • Ingresos del período
   • Capital prestado activo

📌 *Gráficas de ingresos:*
   • Vista Diaria, Semanal o Mensual
   • Gráfica de barras con el cobro de cada día

💡 *Tip:* Usa los reportes para identificar tus mejores días de cobro y los clientes que más se atrasan.`,
  },
  {
    id: 'plan',
    categoria: 'admin',
    videoId: 'Sm71tPRlAtg',
    title: 'Cómo adquirir o cambiar de plan',
    images: [{ src: '/tutoriales/15_plan.png', caption: 'Página de planes y precios' }],
    text: `💳 *Cómo adquirir o cambiar de plan*

1. En el menú de abajo, toca *"Más"* → *"Configuración"*
2. Toca la pestaña *"Suscripción"* o ve directo a *Configuración → Plan*
3. Verás los planes disponibles:

  🌱 *Inicial — $39.000/mes*
  • 1 usuario, hasta 150 clientes, 1 ruta

  📦 *Basico — $59.000/mes*
  • 1 usuario, hasta 450 clientes, 1 ruta

   🚀 *Crecimiento — $79.000/mes* (Mas popular)
   • 2 usuarios, hasta 1,000 clientes, 3 rutas

   ⭐ *Profesional — $119.000/mes*
   • 5 usuarios, hasta 2,000 clientes, 6 rutas

   🏢 *Empresarial — $259.000/mes*
   • 10 usuarios, hasta 10,000 clientes, 10 rutas

4. Puedes elegir pago *Mensual*, *Trimestral (-10%)* o *Anual (2 meses gratis)*
5. Toca *"Elegir plan"* en el plan que quieras
6. Te lleva a Mercado Pago para completar el pago

✅ Tu plan se activa inmediatamente después del pago.`,
  },
  {
    id: 'configuracion',
    categoria: 'admin',
    title: 'Cómo ver la configuración y perfil',
    images: [{ src: '/tutoriales/16_configuracion.png', caption: 'Página de Configuración — Mi perfil' }],
    text: `⚙️ *Cómo ver la configuración y perfil*

1. En el menú de abajo, toca *"Más"* → luego *"Configuración"*
2. Verás varias pestañas:

   👤 *Mi perfil*
   • Ver y editar tu nombre
   • Ver tu correo
   • Cambiar tu contraseña

   🏢 *Organización*
   • Nombre de tu negocio
   • Configuraciones de la organización

   💳 *Suscripción*
   • Estado de tu plan actual
   • Días restantes
   • Cambiar de plan

   🔗 *Referidos*
   • Tu código de referido
   • Compartir enlace para invitar personas

💡 *Tip:* Si necesitas cambiar tu contraseña, ve a *Mi perfil* → sección "Cambiar contraseña".`,
  },
  {
    id: 'soporte',
    categoria: 'admin',
    title: 'Cómo enviar un ticket de soporte',
    images: [
      { src: '/tutoriales/17_soporte_lista.png', caption: 'Lista de tickets de soporte' },
      { src: '/tutoriales/18_soporte_nuevo.png', caption: 'Formulario nuevo ticket' },
    ],
    text: `🆘 *Cómo enviar un ticket de soporte*

Si tienes un problema o una pregunta, puedes crear un ticket de soporte:

1. En el menú de abajo, toca *"Más"* → luego *"Soporte"*
2. Toca el botón *"+ Nuevo ticket"*
3. Llena el formulario:
   • *Tipo de solicitud* — "Tengo una pregunta", "Reportar un error", etc.
   • *Asunto* — título corto del problema (ej: "No puedo registrar un pago")
   • *Descripción* — explica tu problema con el mayor detalle posible
   • ☑️ Puedes marcar *"Solicitar que me contacten"* si quieres que te llamen
4. Toca *"Enviar ticket"*

✅ Tu ticket queda registrado. Puedes ver su estado (Abierto/Cerrado) en la lista de soporte.

💡 *Tip:* Entre más detalle des en la descripción, más rápido podemos ayudarte.`,
  },

  // ════════════════════════════════════════════
  // HERRAMIENTAS EXTRA
  // ════════════════════════════════════════════
  {
    id: 'offline',
    categoria: 'extras',
    title: 'Cómo instalar la app y usarla sin internet',
    images: [],
    text: `📶 *Cómo instalar la app y usarla sin internet*

Control Finanzas se puede instalar en tu celular o computador como una app normal, y funciona incluso sin internet. Esto es ideal para cuando estás cobrando en zonas sin señal.

📌 *Cómo instalar — paso a paso:*

Al entrar al sistema verás un botón *"Instalar app"* en la parte superior. Al tocarlo te muestra las instrucciones exactas para tu dispositivo y navegador. Pero aquí te las resumimos:

*iPhone / iPad (cualquier navegador):*
1. Abre *app.control-finanzas.com*
2. Toca el icono de *Compartir* (cuadrado con flecha hacia arriba ↑) — este icono funciona igual en Safari, Chrome, Firefox y Edge de iPhone
3. Desplaza hacia abajo en el menú que aparece
4. Toca *"Agregar a pantalla de inicio"*
5. Toca *"Agregar"*

*Android (Chrome):*
1. Abre *app.control-finanzas.com* en Chrome
2. Toca los *3 puntos verticales* del menú (arriba a la derecha)
3. Toca *"Instalar app"* o *"Agregar a pantalla de inicio"*
4. Confirma tocando *"Instalar"*

*Android (Samsung Internet):*
1. Busca el icono *+* en la barra de direcciones
2. Selecciona *"Pantalla de inicio"*
3. Si no ves el +, toca los 3 puntos del menú → *"Agregar a pantalla de inicio"*

*Android (Edge):*
1. Toca los *3 puntos horizontales* del menú (abajo en el centro)
2. Toca *"Agregar a pantalla de inicio"*
3. Confirma

*Android (Firefox):*
1. Toca los *3 puntos verticales* del menú (abajo a la derecha)
2. Toca *"Instalar"* o *"Agregar a pantalla de inicio"*

*Computador (Chrome o Edge):*
1. Abre *app.control-finanzas.com*
2. Busca el icono de *instalar* en la barra de direcciones (a la derecha de la URL)
3. Haz clic en *"Instalar"*
4. La app se abre como ventana independiente

*Computador (Firefox):*
Firefox de escritorio no permite instalar apps web. Abre el sitio en *Chrome* o *Edge* para instalarlo.

---

📌 *¿Qué puedes hacer sin internet?*
• *Ver tus clientes* — la lista se guarda en tu dispositivo
• *Ver préstamos* — consultar saldos y cuotas
• *Registrar pagos* — se guardan localmente y se sincronizan cuando vuelvas a tener señal
• *Ver tu dashboard* — el resumen se guarda en caché
• *Navegar por la app* — todas las pantallas funcionan offline

📌 *¿Cómo se sincronizan los pagos?*
• Cuando registras un pago sin internet, aparece un aviso amarillo *"X pagos pendientes"*
• Al recuperar la conexión, los pagos se envían *automáticamente* al servidor
• También puedes tocar el aviso para sincronizar manualmente

⚠️ *Importante:*
• La primera vez que abras la app, necesitas internet para que se descarguen los datos
• Los pagos registrados offline se sincronizan en el orden en que los hiciste`,
  },
  {
    id: 'referidos',
    categoria: 'extras',
    videoId: 'yoFFF6V-oow',
    title: 'Cómo invitar personas y ganar meses gratis',
    images: [{ src: '/tutoriales/16_configuracion.png', caption: 'Configuración → pestaña Referidos' }],
    text: `🎁 *Cómo invitar personas y ganar meses gratis*

Por cada persona que se registre con tu enlace de referido, *ganas 1 mes gratis* en tu suscripción.

📌 *Cómo compartir tu enlace:*

1. Ve a *"Configuración"* en el menú
2. Toca la pestaña *"Referidos"*
3. Ahí verás tu *código de referido* y tu enlace personal
4. Tienes dos opciones para compartir:
   • *Copiar link* — copia el enlace para pegarlo donde quieras
   • *Compartir por WhatsApp* — envía un mensaje listo con tu enlace

📌 *¿Cómo funciona?*
• Cuando alguien abre tu enlace y se registra, queda vinculado como tu referido
• Por cada referido que se registre, *se suma 1 mes gratis* a tu suscripción
• En la misma pestaña puedes ver la lista de todas las personas que se registraron con tu enlace

💡 *Tip:* Comparte tu enlace con otros prestamistas que conozcas. Mientras más referidos tengas, más meses gratis acumulas.`,
  },
]
