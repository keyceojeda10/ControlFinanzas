// lib/asistente-tools.js — Definiciones de herramientas para Lucas IA

export const TOOLS_OWNER = [
  {
    name: 'lookup_client',
    description: 'Busca un cliente por nombre o número de cédula para obtener su ID interno. Úsalo ANTES de crear un préstamo para verificar que el cliente existe. Esta herramienta no modifica nada.',
    input_schema: {
      type: 'object',
      properties: {
        buscar: { type: 'string', description: 'Nombre completo o número de cédula del cliente' },
      },
      required: ['buscar'],
    },
  },
  {
    name: 'create_client',
    description: 'Crea un nuevo cliente en el sistema. Úsalo SOLO cuando tengas nombre, cédula y teléfono completos. Si falta alguno, pregunta primero.',
    input_schema: {
      type: 'object',
      properties: {
        nombre:    { type: 'string', description: 'Nombre completo del cliente' },
        cedula:    { type: 'string', description: 'Número de cédula (solo dígitos, 6-12 caracteres)', pattern: '^\\d{6,12}$' },
        telefono:  { type: 'string', description: 'Número de teléfono celular colombiano' },
        rutaId:    { type: 'string', description: 'ID de la ruta a asignar (opcional)' },
        rutaNombre: { type: 'string', description: 'Nombre de la ruta (para mostrar en confirmación, opcional)' },
        direccion: { type: 'string', description: 'Dirección del cliente (opcional)' },
      },
      required: ['nombre', 'cedula', 'telefono'],
    },
  },
  {
    name: 'create_loan',
    description: 'Crea un préstamo para un cliente que YA existe en el sistema. Siempre usa lookup_client primero para obtener el clienteId. Si el cliente no existe, crea el cliente primero con create_client.',
    input_schema: {
      type: 'object',
      properties: {
        clienteId:     { type: 'string', description: 'ID interno del cliente (obtenido con lookup_client)' },
        clienteNombre: { type: 'string', description: 'Nombre del cliente para mostrar en confirmación' },
        montoPrestado: { type: 'number', description: 'Monto a prestar en pesos colombianos' },
        tasaInteres:   { type: 'number', description: 'Tasa de interés en porcentaje mensual (ej: 20 para 20%)' },
        diasPlazo:     { type: 'number', description: 'Plazo del préstamo en días' },
        fechaInicio:   { type: 'string', description: 'Fecha de inicio en formato YYYY-MM-DD. Si no se especifica, usa hoy.' },
        frecuencia:    { type: 'string', enum: ['diario', 'semanal', 'quincenal', 'mensual'], description: 'Frecuencia de cobro de las cuotas' },
      },
      required: ['clienteId', 'clienteNombre', 'montoPrestado', 'tasaInteres', 'diasPlazo', 'fechaInicio', 'frecuencia'],
    },
  },
  {
    name: 'create_route',
    description: 'Crea una nueva ruta de cobro. Opcionalmente asigna un cobrador.',
    input_schema: {
      type: 'object',
      properties: {
        nombre:         { type: 'string', description: 'Nombre de la ruta' },
        cobradorId:     { type: 'string', description: 'ID del cobrador a asignar (opcional)' },
        cobradorNombre: { type: 'string', description: 'Nombre del cobrador para mostrar en confirmación (opcional)' },
      },
      required: ['nombre'],
    },
  },
  {
    name: 'assign_clients_to_route',
    description: 'Asigna clientes a una ruta de cobro. Usar cuando el usuario quiera organizar clientes en rutas.',
    input_schema: {
      type: 'object',
      properties: {
        rutaId:       { type: 'string', description: 'ID de la ruta destino' },
        rutaNombre:   { type: 'string', description: 'Nombre de la ruta para mostrar en confirmación' },
        clienteIds:   { type: 'array', items: { type: 'string' }, description: 'Lista de IDs de clientes a asignar' },
        clienteCount: { type: 'number', description: 'Número de clientes para mostrar en confirmación' },
        forzar:       { type: 'boolean', description: 'true para mover clientes que ya están en otra ruta' },
      },
      required: ['rutaId', 'rutaNombre', 'clienteIds', 'clienteCount'],
    },
  },
  {
    name: 'adjust_capital',
    description: 'Registra un movimiento de capital: inyección (dinero que entra al negocio) o retiro (dinero que sale). Úsalo cuando el usuario quiera ajustar su caja o capital disponible.',
    input_schema: {
      type: 'object',
      properties: {
        tipo:        { type: 'string', enum: ['inyeccion', 'retiro'], description: 'Tipo de movimiento' },
        monto:       { type: 'number', description: 'Monto en pesos colombianos' },
        descripcion: { type: 'string', description: 'Descripción del movimiento' },
      },
      required: ['tipo', 'monto'],
    },
  },
  {
    name: 'edit_loan',
    description: 'Edita un préstamo existente. Puede extender el plazo, corregir la fecha fin, o cambiar el día de cobro.',
    input_schema: {
      type: 'object',
      properties: {
        prestamoId:     { type: 'string', description: 'ID del préstamo a editar' },
        clienteNombre:  { type: 'string', description: 'Nombre del cliente para mostrar en confirmación' },
        modo:           { type: 'string', enum: ['extender', 'corregir', 'diaCobro'], description: 'Tipo de edición: extender (agrega días), corregir (nueva fecha fin), diaCobro (cambia día de cobro)' },
        nuevaFechaFin:  { type: 'string', description: 'Nueva fecha fin YYYY-MM-DD (para modo corregir o extender)' },
        diasExtra:      { type: 'number', description: 'Días a extender (para modo extender)' },
        frecuencia:     { type: 'string', enum: ['diario', 'semanal', 'quincenal', 'mensual'], description: 'Frecuencia actual del préstamo' },
        diaCobroSemana: { type: 'number', description: 'Nuevo día de la semana 0=dom, 1=lun...6=sáb (para préstamos semanales/quincenales)' },
        diaCobroMes:    { type: 'number', description: 'Nuevo día del mes 1-31 (para préstamos mensuales)' },
      },
      required: ['prestamoId', 'clienteNombre', 'modo'],
    },
  },
  {
    name: 'escalate_support',
    description: 'Muestra opciones de contacto con soporte humano. Úsalo cuando el usuario pida hablar con soporte, quiera renovar su plan, reportar un bug, o necesite ayuda que Lucas no puede dar.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: {
          type: 'string',
          enum: ['soporte_general', 'renovar_plan', 'reportar_bug', 'consulta_pago', 'otro'],
          description: 'Motivo del escalamiento'
        },
        mensaje: { type: 'string', description: 'Mensaje personalizado para mostrar al usuario (opcional)' },
      },
      required: ['motivo'],
    },
  },
  {
    name: 'register_payment',
    description: 'Registra un pago de cuota de un cliente. SIEMPRE usa lookup_client primero para obtener el prestamoId. Muestra la tarjeta de confirmación con el saldo antes y después.',
    input_schema: {
      type: 'object',
      properties: {
        prestamoId:    { type: 'string', description: 'ID del préstamo activo (obtenido con lookup_client)' },
        clienteNombre: { type: 'string', description: 'Nombre del cliente para mostrar en confirmación' },
        monto:         { type: 'number', description: 'Monto pagado en pesos colombianos' },
        tipo:          { type: 'string', enum: ['completo', 'parcial'], description: 'Tipo de pago: completo si cubre la cuota entera, parcial si es menos' },
        metodoPago:    { type: 'string', enum: ['efectivo', 'transferencia'], description: 'Método de pago' },
        plataforma:    { type: 'string', description: 'Si es transferencia: Nequi, Daviplata, Bancolombia, etc. (opcional)' },
      },
      required: ['prestamoId', 'clienteNombre', 'monto', 'tipo'],
    },
  },
  {
    name: 'register_expense',
    description: 'Registra un gasto menor del negocio. Útil cuando el usuario está en campo: gasolina, almuerzo, parqueadero, papelería, etc.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Descripción del gasto (ej: gasolina, almuerzo de cobro, parqueadero)' },
        monto:       { type: 'number', description: 'Monto en pesos colombianos' },
      },
      required: ['description', 'monto'],
    },
  },
]

// Solo las herramientas que puede usar un cobrador (sin acceso a crear clientes/préstamos/rutas)
export const TOOLS_COBRADOR = [
  TOOLS_OWNER.find(t => t.name === 'lookup_client'),
  TOOLS_OWNER.find(t => t.name === 'register_payment'),
  TOOLS_OWNER.find(t => t.name === 'register_expense'),
].filter(Boolean)
