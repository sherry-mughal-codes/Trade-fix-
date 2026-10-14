
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.payment.count({ 
      where: { 
          currency: { not: 'PKR' } 
      } 
  });
  console.log(`Number of Non-PKR Payments to be fixed: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
