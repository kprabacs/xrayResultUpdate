
import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- DB Status Breakdown ---');
  
  const statusBreakdown = await prisma.testCaseResult.groupBy({
    by: ['status'],
    _count: true
  });
  
  console.table(statusBreakdown);

  const total = await prisma.testCaseResult.count();
  console.log('Total TestCaseResults:', total);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
