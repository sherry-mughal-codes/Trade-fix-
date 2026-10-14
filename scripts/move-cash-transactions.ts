
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting migration of transactions from Cash (1000) to General Cash (1001)...');

    // 1. Get Source Account (Cash - 1000)
    const sourceAccount = await prisma.account.findFirst({
        where: { code: '1000' }
    });

    if (!sourceAccount) {
        console.error('Source account (1000) not found!');
        return;
    }

    // 2. Get Destination Account (General Cash - 1001)
    const destAccount = await prisma.account.findFirst({
        where: { code: '1001' }
    });

    if (!destAccount) {
        console.error('Destination account (1001) not found!');
        return;
    }

    console.log(`Source: ${sourceAccount.name} (${sourceAccount.id})`);
    console.log(`Destination: ${destAccount.name} (${destAccount.id})`);

    // 3. Update Journal Rows
    const updateResult = await prisma.journalRow.updateMany({
        where: {
            accountId: sourceAccount.id
        },
        data: {
            accountId: destAccount.id
        }
    });

    console.log(`Moved ${updateResult.count} journal rows.`);

    // 4. Update Payments (if they link to account directly - specific schema check needed)
    // Checking schema... Payment model doesn't link directly to Account usually, 
    // but SalaryPayment does: `fromAccountId`.
    
    // Check SalaryPayment links
    const salaryPaymentUpdate = await prisma.salaryPayment.updateMany({
        where: {
            fromAccountId: sourceAccount.id
        },
        data: {
            fromAccountId: destAccount.id
        }
    });
    console.log(`Updated ${salaryPaymentUpdate.count} salary payments.`);

    // 5. Verify Source is empty
    const remainingRows = await prisma.journalRow.count({
        where: { accountId: sourceAccount.id }
    });

    if (remainingRows === 0) {
        console.log('Success: Source account is now empty.');
    } else {
        console.warn(`Warning: Source account still has ${remainingRows} rows.`);
    }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
