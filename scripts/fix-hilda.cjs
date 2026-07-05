const { crearPrisma } = require('../lib/prisma-cjs.cjs');
const prisma = crearPrisma();

async function main() {
  const email = "Tobonmorenojuancarlos@gmail.com";
  console.log("Buscando user...", email);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return console.log("User not found");
  
  const clientes = await prisma.cliente.findMany({
    where: { organizationId: user.organizationId, nombre: { contains: "Hilda" } }
  });
  console.log("Clientes:", clientes.map(c => c.nombre));
  
  if (clientes.length === 0) return console.log("Hilda no encontrada");
  const cliente = clientes[0];
  
  const prestamos = await prisma.prestamo.findMany({
    where: { clienteId: cliente.id },
    include: { cuotasAmortizacion: true, pagos: true }
  });
  console.log("Prestamos encontrados para el cliente:", JSON.stringify(prestamos.map(p => ({ id: p.id, monto: p.montoPrestado, estado: p.estado, date: p.fechaInicio, frec: p.frecuencia, cuotas: p.cuotasAmortizacion.length })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
