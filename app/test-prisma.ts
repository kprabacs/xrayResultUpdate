import prisma from './src/lib/prisma';

async function main() {
  try {
    const count = await prisma.testRunSummary.count();
    console.log('Count:', count);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
