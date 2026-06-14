// lib/searchCommands.js — Catalogo local de destinos/acciones para el buscador
// global. Se filtra en el cliente (instantaneo, sin API) para que el usuario
// pueda llegar a navegacion, secciones y configuracion escribiendo cosas como
// "caja", "rutas", "tema oscuro", "mi cuenta", "plan", "nuevo cliente"...
//
// Cada item: { id, label, sub, href, icon, keywords[], roles? , grupo }
// - roles: si se omite, visible para todos. Si se define, solo esos roles.
// - keywords: sinonimos/terminos por los que tambien debe encontrarse.

// Iconos (paths heroicons-style, viewBox 24)
const I = {
  home: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75',
  ruta: 'M9 6.75V15m0-8.25a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM9 15a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 0V6.75m6-1.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM15 8.25V18m0 0a1.5 1.5 0 110 3 1.5 1.5 0 010-3z',
  mapa: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
  prestamo: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  clientes: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
  caja: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
  capital: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z',
  reportes: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  historial: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  gastos: 'M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z',
  perdidos: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  cobradores: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128H5.228m9.772 0a5.975 5.975 0 00-.786-3.073M5.228 19.128a9.37 9.37 0 01-2.625.372 9.337 9.337 0 01-4.121-.952 4.125 4.125 0 017.533-2.493M5.228 19.128v-.003c0-1.113.285-2.16.786-3.07M5.228 19.128A48.674 48.674 0 0112 18.75c2.43 0 4.817.178 7.152.518M14.25 8.25a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
  config: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  user: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
  bell: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  tema: 'M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z',
  estrella: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  tarjeta: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
  soporte: 'M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z',
  tutoriales: 'M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5',
  asistente: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z',
  plus: 'M12 4.5v15m7.5-7.5h-15',
}

// --- Navegacion principal (owner) ---
const NAV_OWNER = [
  { id: 'nav-dashboard', label: 'Dashboard', sub: 'Inicio', href: '/dashboard', icon: I.home, keywords: ['inicio', 'home', 'principal', 'resumen', 'panel'] },
  { id: 'nav-rutas', label: 'Rutas', sub: 'Gestionar rutas de cobro', href: '/rutas', icon: I.mapa, keywords: ['ruta', 'cobro', 'recorrido', 'zona'] },
  { id: 'nav-prestamos', label: 'Préstamos', sub: 'Todos los préstamos', href: '/prestamos', icon: I.prestamo, keywords: ['prestamo', 'credito', 'creditos', 'deuda', 'deudas'] },
  { id: 'nav-clientes', label: 'Clientes', sub: 'Todos los clientes', href: '/clientes', icon: I.clientes, keywords: ['cliente', 'deudor', 'deudores', 'personas'] },
  { id: 'nav-caja', label: 'Caja', sub: 'Cuadre y movimientos', href: '/caja', icon: I.caja, keywords: ['caja', 'cuadre', 'efectivo', 'dinero', 'arqueo', 'cierre'] },
  { id: 'nav-cobradores', label: 'Cobradores', sub: 'Equipo de cobro', href: '/cobradores', icon: I.cobradores, keywords: ['cobrador', 'cobradores', 'empleado', 'empleados', 'equipo', 'trabajador'] },
  { id: 'nav-capital', label: 'Capital', sub: 'Inversión y disponible', href: '/capital', icon: I.capital, keywords: ['capital', 'inversion', 'fondo', 'disponible', 'invertido'] },
  { id: 'nav-reportes', label: 'Reportes', sub: 'Estadísticas y análisis', href: '/reportes', icon: I.reportes, keywords: ['reporte', 'reportes', 'estadistica', 'estadisticas', 'analisis', 'grafica', 'graficas', 'ganancias'] },
  { id: 'nav-actividad', label: 'Historial', sub: 'Actividad reciente', href: '/actividad', icon: I.historial, keywords: ['historial', 'actividad', 'movimientos', 'registro', 'log', 'auditoria'] },
  { id: 'nav-gastos', label: 'Gastos', sub: 'Registrar y ver gastos', href: '/gastos', icon: I.gastos, keywords: ['gasto', 'gastos', 'egreso', 'egresos', 'salida'] },
  { id: 'nav-clavos', label: 'Préstamos perdidos', sub: 'Clavos / incobrables', href: '/clavos', icon: I.perdidos, keywords: ['perdido', 'perdidos', 'clavo', 'clavos', 'incobrable', 'incobrables', 'castigado'] },
  { id: 'nav-tutoriales', label: 'Tutoriales', sub: 'Aprende a usar el sistema', href: '/tutoriales', icon: I.tutoriales, keywords: ['tutorial', 'tutoriales', 'ayuda', 'guia', 'aprender', 'video', 'videos'] },
  { id: 'nav-soporte', label: 'Soporte', sub: 'Ayuda y tickets', href: '/soporte', icon: I.soporte, keywords: ['soporte', 'ayuda', 'ticket', 'tickets', 'contacto', 'problema'] },
]

// --- Navegacion principal (cobrador) ---
const NAV_COBRADOR = [
  { id: 'nav-dashboard', label: 'Dashboard', sub: 'Inicio', href: '/dashboard', icon: I.home, keywords: ['inicio', 'home', 'principal', 'resumen'] },
  { id: 'nav-cobros-hoy', label: 'Cobros de hoy', sub: 'Mis cobros del día', href: '/cobros-hoy', icon: I.caja, keywords: ['cobro', 'cobros', 'hoy', 'pendientes', 'cobrar'] },
  { id: 'nav-clientes', label: 'Clientes', sub: 'Mis clientes', href: '/clientes', icon: I.clientes, keywords: ['cliente', 'deudor', 'deudores'] },
  { id: 'nav-prestamos', label: 'Préstamos', sub: 'Mis préstamos', href: '/prestamos', icon: I.prestamo, keywords: ['prestamo', 'credito', 'creditos', 'deuda'] },
  { id: 'nav-rutas', label: 'Rutas', sub: 'Mi ruta de cobro', href: '/rutas', icon: I.mapa, keywords: ['ruta', 'cobro', 'recorrido'] },
  { id: 'nav-caja', label: 'Caja', sub: 'Mi caja del día', href: '/caja', icon: I.caja, keywords: ['caja', 'cuadre', 'efectivo', 'cierre'] },
  { id: 'nav-mis-stats', label: 'Mi resumen', sub: 'Mis estadísticas', href: '/mis-estadisticas', icon: I.reportes, keywords: ['estadistica', 'estadisticas', 'resumen', 'rendimiento', 'desempeno'] },
  { id: 'nav-tutoriales', label: 'Tutoriales', sub: 'Aprende a usar el sistema', href: '/tutoriales', icon: I.tutoriales, keywords: ['tutorial', 'tutoriales', 'ayuda', 'guia', 'video'] },
]

// --- Acciones rapidas (crear) ---
const ACCIONES_OWNER = [
  { id: 'act-nuevo-prestamo', label: 'Nuevo préstamo', sub: 'Crear préstamo', href: '/prestamos/nuevo', icon: I.plus, keywords: ['nuevo', 'crear', 'agregar', 'prestar', 'prestamo', 'credito'], accion: true },
  { id: 'act-nuevo-cliente', label: 'Nuevo cliente', sub: 'Registrar cliente', href: '/clientes/nuevo', icon: I.plus, keywords: ['nuevo', 'crear', 'agregar', 'registrar', 'cliente'], accion: true },
  { id: 'act-nuevo-cobrador', label: 'Nuevo cobrador', sub: 'Agregar al equipo', href: '/cobradores/nuevo', icon: I.plus, keywords: ['nuevo', 'crear', 'agregar', 'cobrador', 'empleado'], accion: true },
]
const ACCIONES_COBRADOR = [
  { id: 'act-nuevo-prestamo', label: 'Nuevo préstamo', sub: 'Crear préstamo', href: '/prestamos/nuevo', icon: I.plus, keywords: ['nuevo', 'crear', 'agregar', 'prestar'], accion: true, perm: 'puedeCrearPrestamos' },
  { id: 'act-nuevo-cliente', label: 'Nuevo cliente', sub: 'Registrar cliente', href: '/clientes/nuevo', icon: I.plus, keywords: ['nuevo', 'crear', 'agregar', 'registrar'], accion: true, perm: 'puedeCrearClientes' },
]

// --- Configuracion (tabs via ?tab=) ---
const CONFIG_TODOS = [
  { id: 'cfg-perfil', label: 'Mi perfil', sub: 'Configuración', href: '/configuracion?tab=perfil', icon: I.user, keywords: ['perfil', 'cuenta', 'mi cuenta', 'datos', 'nombre', 'foto', 'contrasena', 'password', 'telefono', 'correo'] },
  { id: 'cfg-notif', label: 'Notificaciones', sub: 'Configuración', href: '/configuracion?tab=notificaciones', icon: I.bell, keywords: ['notificacion', 'notificaciones', 'alerta', 'alertas', 'aviso', 'push'] },
  { id: 'cfg-apariencia', label: 'Apariencia', sub: 'Tema claro / oscuro', href: '/configuracion?tab=apariencia', icon: I.tema, keywords: ['apariencia', 'tema', 'oscuro', 'claro', 'dark', 'light', 'modo', 'color', 'pantalla'] },
]
const CONFIG_OWNER = [
  { id: 'cfg-org', label: 'Organización', sub: 'Configuración del negocio', href: '/configuracion?tab=organizacion', icon: I.config, keywords: ['organizacion', 'negocio', 'empresa', 'configuracion', 'ajustes', 'nombre del negocio', 'logo', 'moneda', 'capital estricto', 'días sin cobro'] },
  { id: 'cfg-suscripcion', label: 'Suscripción', sub: 'Plan y facturación', href: '/configuracion?tab=suscripcion', icon: I.tarjeta, keywords: ['suscripcion', 'plan', 'pago', 'pagar', 'factura', 'facturacion', 'mensualidad', 'precio', 'upgrade', 'mejorar plan'] },
  { id: 'cfg-plan', label: 'Cambiar de plan', sub: 'Ver planes disponibles', href: '/configuracion/plan', icon: I.tarjeta, keywords: ['plan', 'planes', 'upgrade', 'mejorar', 'subir plan', 'precio', 'suscripcion'] },
  { id: 'cfg-referidos', label: 'Referidos', sub: 'Invita y gana', href: '/configuracion?tab=referidos', icon: I.estrella, keywords: ['referido', 'referidos', 'invitar', 'invita', 'gana', 'descuento', 'recomendar'] },
]

// Normaliza: minusculas y sin tildes, para matching tolerante.
export function normalizar(str = '') {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Devuelve TODOS los comandos visibles para el usuario segun su rol/permisos.
export function obtenerComandos({ esCobrador = false, permisos = {} } = {}) {
  const fueraDePermiso = (item) => item.perm && !permisos[item.perm]

  if (esCobrador) {
    return [
      ...NAV_COBRADOR,
      ...ACCIONES_COBRADOR.filter((a) => !fueraDePermiso(a)),
      ...CONFIG_TODOS,
    ]
  }
  return [
    ...NAV_OWNER,
    ...ACCIONES_OWNER,
    ...CONFIG_TODOS,
    ...CONFIG_OWNER,
  ]
}

// Filtra comandos por query. Score: match exacto al inicio del label >
// label incluye > keyword. Soporta multi-palabra: si la query tiene varios
// terminos, tambien matchea cuando CADA termino aparece en el label/keywords.
export function filtrarComandos(comandos, query, limite = 8) {
  const q = normalizar(query).trim()
  if (!q) return []
  const terminos = q.split(/\s+/).filter(Boolean)

  const scored = []
  for (const cmd of comandos) {
    const label = normalizar(cmd.label)
    const sub = normalizar(cmd.sub || '')
    const kws = (cmd.keywords || []).map(normalizar)
    const heno = [label, sub, ...kws] // donde buscar cada termino

    let score = 0
    if (label === q) score = 100
    else if (label.startsWith(q)) score = 80
    else if (label.includes(q)) score = 60
    else if (sub.includes(q)) score = 40
    else if (kws.some((k) => k === q)) score = 55
    else if (kws.some((k) => k.startsWith(q))) score = 45
    else if (kws.some((k) => k.includes(q))) score = 30

    // Multi-palabra: todos los terminos matchean algun campo -> score medio.
    if (score === 0 && terminos.length > 1) {
      const todos = terminos.every((t) => heno.some((h) => h.includes(t)))
      if (todos) score = 35
    }

    if (score > 0) scored.push({ cmd, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limite).map((s) => s.cmd)
}
