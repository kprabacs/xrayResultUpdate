import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { categorizeRcaSync } from './src/utils/rcaAnalyzer';

const connectionString = process.env.DATABASE_URL;
// @ts-ignore
const pool = new Pool({ connectionString });
// @ts-ignore
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('--- Database RCA Analysis & Grouping ---');
    
    // 1. Fetch all failed records
    const failures = await prisma.testCaseResult.findMany({
        where: {
            status: { contains: 'failed', mode: 'insensitive' }
        },
        include: {
            TestRunSummary: true
        }
    });

    if (failures.length === 0) {
        console.log('No failed records found in the database.');
        return;
    }

    console.log(`Found ${failures.length} failed test cases. Analyzing...`);

    const projectGroups: Record<string, Record<string, number>> = {};
    let updatedCount = 0;

    for (const f of failures) {
        const project = f.TestRunSummary?.channel || 'Unknown Project';
        let category = f.rcaCategory;

        // If category is vague or missing, try to auto-detect
        if (!category || category === 'Unknown' || category === 'Custom Error') {
            category = categorizeRcaSync(f.errorMessage);
            
            // Update the record in the database
            await prisma.testCaseResult.update({
                where: { id: f.id },
                data: { 
                    rcaCategory: category,
                    rcaStatus: 'Auto-Detected'
                }
            });
            updatedCount++;
        }

        // Grouping logic
        if (!projectGroups[project]) projectGroups[project] = {};
        projectGroups[project][category] = (projectGroups[project][category] || 0) + 1;
    }

    // 2. Output Summary Table
    console.log('\n--- Summary by Project and Category ---');
    console.table(projectGroups);

    console.log(`\nAnalysis Complete.`);
    console.log(`Total records analyzed: ${failures.length}`);
    console.log(`Total records auto-classified/updated: ${updatedCount}`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
