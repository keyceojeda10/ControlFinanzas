// prisma/seed.js - Datos de prueba para Control Finanzas
// Ejecutar: npx prisma db seed

require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...\n')

  // ─── LIMPIAR DATOS ANTERIORES ─────────────────────────
  console.log('Limpiando datos anteriores...')
  await prisma.adminLog.deleteMany()
  await prisma.suscripcion.deleteMany()
  await prisma.cierreCaja.deleteMany()
  await prisma.pago.deleteMany()
  await prisma.prestamo.deleteMany()
  await prisma.cliente.deleteMany()
  await prisma.ruta.deleteMany()
  await prisma.user.deleteMany()
  await prisma.organization.deleteMany()

  // ─── PASSWORDS ────────────────────────────────────────
  const hashAdmin = await bcrypt.hash('Admin2026*', 10)
  const hash123   = await bcrypt.hash('123456', 10)

  // ─── SUPERADMIN ───────────────────────────────────────
  console.log('Creando superadmin...')
  const superadmin = await prisma.user.create({
    data: {
      nombre:   'Super Admin',
      email:    'admin@control-finanzas.com',
      password: hashAdmin,
      rol:      'superadmin',
    },
  })

  // ─── ORGANIZACIÓN DE PRUEBA ───────────────────────────
  console.log('Creando organizacion Prestamos Garcia...')
  const org = await prisma.organization.create({
    data: {
      nombre:   'Préstamos García',
      plan:     'standard',
      telefono: '3001234567',
      ciudad:   'Bogotá',
      activo:   true,
    },
  })

  // ─── OWNER ────────────────────────────────────────────
  console.log('Creando owner...')
  const owner = await prisma.user.create({
    data: {
      nombre:         'Carlos García',
      email:          'owner@test.com',
      password:       hash123,
      rol:            'owner',
      organizationId: org.id,
    },
  })

  // ─── COBRADORES ───────────────────────────────────────
  console.log('Creando cobradores...')
  const cobrador1 = await prisma.user.create({
    data: {
      nombre:         'Juan Pérez',
      email:          'cobrador1@test.com',
      password:       hash123,
      rol:            'cobrador',
      organizationId: org.id,
    },
  })

  const cobrador2 = await prisma.user.create({
    data: {
      nombre:         'Pedro López',
      email:          'cobrador2@test.com',
      password:       hash123,
      rol:            'cobrador',
      organizationId: org.id,
    },
  })

  // ─── RUTAS ────────────────────────────────────────────
  console.log('Creando rutas...')
  const ruta1 = await prisma.ruta.create({
    data: {
      nombre:         'Ruta Norte',
      organizationId: org.id,
      cobradorId:     cobrador1.id,
    },
  })

  const ruta2 = await prisma.ruta.create({
    data: {
      nombre:         'Ruta Sur',
      organizationId: org.id,
      cobradorId:     cobrador2.id,
    },
  })

  // ─── CLIENTES (10 en total) ───────────────────────────
  console.log('Creando 10 clientes...')
  const clientesData = [
    // Ruta Norte (cobrador1) - 5 clientes
    { nombre: 'María González',  cedula: '10012345678', telefono: '3001111111', direccion: 'Calle 10 #20-30, Usaquen',          rutaId: ruta1.id },
    { nombre: 'Ana Martínez',    cedula: '10023456789', telefono: '3002222222', direccion: 'Carrera 5 #15-20, Chapinero',       rutaId: ruta1.id },
    { nombre: 'Luis Rodríguez',  cedula: '10034567890', telefono: '3003333333', direccion: 'Avenida 1 #30-40, Santa Fe',       rutaId: ruta1.id },
    { nombre: 'Carmen Flores',   cedula: '10045678901', telefono: '3004444444', direccion: 'Calle 50 #10-15, Teusaquillo',     rutaId: ruta1.id },
    { nombre: 'Jorge Ramírez',   cedula: '10056789012', telefono: '3005555555', direccion: 'Carrera 15 #25-35, Engativa',      rutaId: ruta1.id },
    // Ruta Sur (cobrador2) - 5 clientes
    { nombre: 'Isabel Vargas',   cedula: '10067890123', telefono: '3006666666', direccion: 'Calle 70 #5-10, Kennedy',          rutaId: ruta2.id },
    { nombre: 'Roberto Herrera', cedula: '10078901234', telefono: '3007777777', direccion: 'Carrera 30 #40-50, Bosa',          rutaId: ruta2.id },
    { nombre: 'Patricia Soto',   cedula: '10089012345', telefono: '3008888888', direccion: 'Calle 90 #20-25, Suba',            rutaId: ruta2.id },
    { nombre: 'Andrés Castro',   cedula: '10090123456', telefono: '3009999999', direccion: 'Carrera 45 #15-20, Ciudad Bolivar', rutaId: ruta2.id },
    { nombre: 'Lucía Morales',   cedula: '10001234567', telefono: '3010000000', direccion: 'Avenida 68 #30-40, Fontibon',      rutaId: ruta2.id },
  ]

  const clientes = []
  for (const c of clientesData) {
    const cliente = await prisma.cliente.create({
      data: { ...c, organizationId: org.id, estado: 'activo' },
    })
    clientes.push(cliente)
  }

  // ─── PRÉSTAMOS ────────────────────────────────────────
  console.log('Creando prestamos...')
  const fechaBase = new Date('2026-02-01')

  // Préstamo 1: María González | $200.000 | 20% | 30 días | bien al día
  const monto1  = 200000
  const tasa1   = 20
  const total1  = monto1 * (1 + tasa1 / 100)  // 240.000
  const cuota1  = Math.round(total1 / 30)       // 8.000/día
  const prestamo1 = await prisma.prestamo.create({
    data: {
      clienteId:      clientes[0].id,
      organizationId: org.id,
      montoPrestado:  monto1,
      tasaInteres:    tasa1,
      totalAPagar:    total1,
      cuotaDiaria:    cuota1,
      fechaInicio:    fechaBase,
      fechaFin:       new Date('2026-03-02'),
      diasPlazo:      30,
      estado:         'activo',
    },
  })

  // Préstamo 2: Ana Martínez | $500.000 | 20% | 60 días | pocos pagos
  const monto2  = 500000
  const tasa2   = 20
  const total2  = monto2 * (1 + tasa2 / 100)  // 600.000
  const cuota2  = Math.round(total2 / 60)       // 10.000/día
  const prestamo2 = await prisma.prestamo.create({
    data: {
      clienteId:      clientes[1].id,
      organizationId: org.id,
      montoPrestado:  monto2,
      tasaInteres:    tasa2,
      totalAPagar:    total2,
      cuotaDiaria:    cuota2,
      fechaInicio:    fechaBase,
      fechaFin:       new Date('2026-04-01'),
      diasPlazo:      60,
      estado:         'activo',
    },
  })

  // Préstamo 3: Isabel Vargas | $300.000 | 20% | 20 días | casi completado
  const monto3  = 300000
  const tasa3   = 20
  const total3  = monto3 * (1 + tasa3 / 100)  // 360.000
  const cuota3  = Math.round(total3 / 20)       // 18.000/día
  const prestamo3 = await prisma.prestamo.create({
    data: {
      clienteId:      clientes[5].id,
      organizationId: org.id,
      montoPrestado:  monto3,
      tasaInteres:    tasa3,
      totalAPagar:    total3,
      cuotaDiaria:    cuota3,
      fechaInicio:    fechaBase,
      fechaFin:       new Date('2026-02-21'),
      diasPlazo:      20,
      estado:         'activo',
    },
  })

  // ─── PAGOS ────────────────────────────────────────────
  console.log('Registrando pagos...')

  // Prestamo 1: 10 pagos completos (días 1-10)
  for (let i = 0; i < 10; i++) {
    const fecha = new Date(fechaBase)
    fecha.setDate(fecha.getDate() + i)
    await prisma.pago.create({
      data: {
        prestamoId:     prestamo1.id,
        organizationId: org.id,
        cobradorId:     cobrador1.id,
        montoPagado:    cuota1,
        fechaPago:      fecha,
        tipo:           'completo',
      },
    })
  }

  // Prestamo 2: 5 pagos (días 1-5)
  for (let i = 0; i < 5; i++) {
    const fecha = new Date(fechaBase)
    fecha.setDate(fecha.getDate() + i)
    await prisma.pago.create({
      data: {
        prestamoId:     prestamo2.id,
        organizationId: org.id,
        cobradorId:     cobrador1.id,
        montoPagado:    cuota2,
        fechaPago:      fecha,
        tipo:           'completo',
      },
    })
  }

  // Prestamo 3: 18 de 20 pagos (casi completado)
  for (let i = 0; i < 18; i++) {
    const fecha = new Date(fechaBase)
    fecha.setDate(fecha.getDate() + i)
    await prisma.pago.create({
      data: {
        prestamoId:     prestamo3.id,
        organizationId: org.id,
        cobradorId:     cobrador2.id,
        montoPagado:    cuota3,
        fechaPago:      fecha,
        tipo:           'completo',
      },
    })
  }

  // ─── SUSCRIPCIÓN ─────────────────────────────────────
  console.log('Creando suscripcion activa...')
  await prisma.suscripcion.create({
    data: {
      organizationId:   org.id,
      plan:             'standard',
      estado:           'activa',
      fechaInicio:      new Date('2026-02-01'),
      fechaVencimiento: new Date('2026-03-01'),
      montoCOP:         150000,
    },
  })

  // ─── RESUMEN FINAL ────────────────────────────────────
  console.log('\nSeed completado exitosamente!')
  console.log('----------------------------------------')
  console.log('Usuarios: 4 (superadmin, owner, 2 cobradores)')
  console.log('Organizacion: Prestamos Garcia (plan standard)')
  console.log('Rutas: 2 | Clientes: 10 | Prestamos: 3')
  console.log('(Credenciales en prisma/seed.js - NO ejecutar en produccion)')
  console.log('----------------------------------------')
}

main()
  .catch((e) => {
    console.error('Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
