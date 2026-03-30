
import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- RCA Statistics ---');
  
  const rcaBreakdown = await prisma.testCaseResult.groupBy({
    by: ['rcaCategory'],
    _count: true,
    where: {
      status: { contains: 'failed', mode: 'insensitive' }
    }
  });
  
  console.log('RCA Category Breakdown (Failed tests):');
  rcaBreakdown.forEach(row => {
    console.log(`${row.rcaCategory}: ${row._count}`);
  });

  const customErrors = await prisma.testCaseResult.findMany({
    where: {
      rcaCategory: 'Custom Error',
      status: { contains: 'failed', mode: 'insensitive' }
    },
    select: {
      errorMessage: true
    },
    take: 10
  });

  if (customErrors.length > 0) {
    console.log('\nSample Custom Errors:');
    customErrors.forEach((err, i) => {
      console.log(`${i+1}. ${err.errorMessage?.substring(0, 150)}...`);
    });
  } else {
    console.log('\nNo "Custom Error" entries found in the list query.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
