
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking prisma keys...');
  console.log('Keys on prisma instance:', Object.keys(prisma));
  
  if (prisma.employee) {
    console.log('SUCCESS: prisma.employee exists');
    try {
        const count = await prisma.employee.count();
        console.log('Employee count:', count);
    } catch (e) {
        console.error('Error querying employee:', e);
    }
  } else {
    console.error('FAILURE: prisma.employee is undefined');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
