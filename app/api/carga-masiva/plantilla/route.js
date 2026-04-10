// app/api/carga-masiva/plantilla/route.js

import * as XLSX from 'xlsx'

export async function GET() {
  const headers = [
    'nombre', 'cedula', 'telefono', 'direccion', 'referencia',
    'tipo', 'montoPrestado', 'tasaInteres', 'diasPlazo', 'frecuencia',
    'fechaInicio', 'abonadoHasta',
  ]

  const ejemplos = [
    {
      nombre: 'Juan Pérez', cedula: '1234567890', telefono: '3001234567',
      direccion: 'Calle 10 #5-20', referencia: 'Esposa María',
      tipo: 'prestamo', montoPrestado: 500000, tasaInteres: 20,
      diasPlazo: 30, frecuencia: 'diario', fechaInicio: '01/04/2026', abonadoHasta: '',
    },
    {
      nombre: 'Juan Pérez', cedula: '1234567890', telefono: '3001234567',
      direccion: '', referencia: '',
      tipo: 'mercancia', montoPrestado: 200000, tasaInteres: 0,
      diasPlazo: 30, frecuencia: 'diario', fechaInicio: '05/04/2026', abonadoHasta: 50000,
    },
    {
      nombre: 'María López', cedula: '9876543210', telefono: '3109876543',
      direccion: 'Carrera 5 #12-30', referencia: '',
      tipo: 'prestamo', montoPrestado: 300000, tasaInteres: 10,
      diasPlazo: 60, frecuencia: 'diario', fechaInicio: '15/03/2026', abonadoHasta: 150000,
    },
    {
      nombre: 'Pedro García', cedula: '5555555555', telefono: '',
      direccion: '', referencia: '',
      tipo: '', montoPrestado: '', tasaInteres: '',
      diasPlazo: '', frecuencia: '', fechaInicio: '', abonadoHasta: '',
    },
  ]

  const data = [headers, ...ejemplos.map(e => headers.map(h => e[h]))]
  const ws = XLSX.utils.aoa_to_sheet(data)

  ws['!cols'] = [
    { wch: 20 }, { wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 18 },
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 14 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes')

  const instrucciones = [
    ['INSTRUCCIONES DE LLENADO - Control Finanzas'],
    [''],
    ['Columna', 'Requerido', 'Descripcion'],
    ['nombre', 'Si', 'Nombre completo del cliente'],
    ['cedula', 'Si', 'Numero de cedula (6-12 digitos, sin puntos)'],
    ['telefono', 'No', 'Celular colombiano (10 digitos, empieza en 3)'],
    ['direccion', 'No', 'Direccion del cliente'],
    ['referencia', 'No', 'Referencia personal (max 100 caracteres)'],
    ['tipo', 'No', '"prestamo" (dinero) o "mercancia" (articulo). Default: prestamo'],
    ['montoPrestado', 'No*', 'Monto original del prestamo / valor del articulo'],
    ['tasaInteres', 'No*', 'Tasa de interes mensual (ej: 20 = 20%). Mercancia: 0'],
    ['diasPlazo', 'No*', 'Plazo en dias del prestamo'],
    ['frecuencia', 'No', 'diario, semanal, quincenal o mensual (default: diario)'],
    ['fechaInicio', 'No*', 'Fecha de inicio del prestamo (DD/MM/YYYY)'],
    ['abonadoHasta', 'No', 'Total ya pagado por el cliente (prestamos en curso)'],
    [''],
    ['NOTAS IMPORTANTES:'],
    ['- Las columnas de prestamo son opcionales como grupo.'],
    ['  Si llenas montoPrestado, debes llenar tasaInteres, diasPlazo y fechaInicio.'],
    ['- Un cliente puede tener MULTIPLES prestamos: repite la cedula en varias filas.'],
    ['  Ejemplo: Juan Perez (fila 1 y 2) tiene un prestamo de dinero y uno de mercancia.'],
    ['- Si no llenas datos de prestamo, se crea solo el cliente.'],
    ['  Ejemplo: Pedro Garcia (fila 4) solo se crea como cliente, sin prestamo.'],
    ['- "abonadoHasta" es para prestamos que ya llevan tiempo (migracion).'],
    ['  Se registra como pago previo. No tienes que registrar cada pago individual.'],
  ]
  const wsInst = XLSX.utils.aoa_to_sheet(instrucciones)
  wsInst['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 60 }]
  XLSX.utils.book_append_sheet(wb, wsInst, 'Instrucciones')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="plantilla-carga-masiva.xlsx"',
    },
  })
}
