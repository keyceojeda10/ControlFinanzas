// lib/tutorialesData.js — Datos de los 18 mini-tutoriales

export const TUTORIALES = [
  {
    id: 'registrarse',
    emoji: '📱',
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
    id: 'login',
    emoji: '🔑',
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
    emoji: '🔓',
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
    emoji: '📊',
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
• Ver clientes
• Rutas
• Configuración`,
  },
  {
    id: 'crear-cliente',
    emoji: '👤',
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
    emoji: '✏️',
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
    id: 'crear-prestamo',
    emoji: '💰',
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
    emoji: '💵',
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
    id: 'crear-ruta',
    emoji: '🗺️',
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
    emoji: '📋',
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
    emoji: '🔄',
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
    id: 'crear-cobrador',
    emoji: '👷',
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
    emoji: '🔐',
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
  {
    id: 'cierre-caja',
    emoji: '🏦',
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
    id: 'reportes',
    emoji: '📈',
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
    emoji: '💳',
    title: 'Cómo adquirir o cambiar de plan',
    images: [{ src: '/tutoriales/15_plan.png', caption: 'Página de planes y precios' }],
    text: `💳 *Cómo adquirir o cambiar de plan*

1. En el menú de abajo, toca *"Más"* → *"Configuración"*
2. Toca la pestaña *"Suscripción"* o ve directo a *Configuración → Plan*
3. Verás los planes disponibles:

   📦 *Básico — $59.000/mes*
   • 1 usuario (administrador)
   • Hasta 50 clientes
   • Gestión de préstamos y dashboard básico

   ⭐ *Profesional — $119.000/mes* (Más popular)
   • Hasta 3 usuarios
   • Hasta 300 clientes
   • Rutas, cobradores y cierre de caja
   • Reportes completos

   🏢 *Empresarial — $199.000/mes*
   • Hasta 7 usuarios
   • Clientes ilimitados
   • Reportes avanzados y exportar a Excel

4. Puedes elegir pago *Mensual*, *Trimestral (-10%)* o *Anual (2 meses gratis)*
5. Toca *"Elegir plan"* en el plan que quieras
6. Te lleva a Mercado Pago para completar el pago

✅ Tu plan se activa inmediatamente después del pago.`,
  },
  {
    id: 'configuracion',
    emoji: '⚙️',
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
   • Programa de referidos (si está disponible)

💡 *Tip:* Si necesitas cambiar tu contraseña, ve a *Mi perfil* → sección "Cambiar contraseña".`,
  },
  {
    id: 'soporte',
    emoji: '🆘',
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
]
