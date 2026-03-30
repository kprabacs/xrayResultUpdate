
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DB Diagnostic ---');
  
  const totalFailures = await prisma.testCaseResult.count({
    where: { status: 'failed' }
  });
  console.log('Total Failed Test Cases in DB:', totalFailures);

  if (totalFailures > 0) {
    const sample = await prisma.testCaseResult.findFirst({
      where: { status: 'failed' },
      include: {
        TestRunSummary: true
      }
    });
    console.log('Sample Failure Data:');
    console.log(JSON.stringify(sample, null, 2));
  } else {
    console.log('NO FAILURES FOUND WITH status="failed"');
    const allStatuses = await prisma.testCaseResult.groupBy({
      by: ['status'],
      _count: true
    });
    console.log('Status Breakdown:', allStatuses);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
