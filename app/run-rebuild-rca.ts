
import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function categorizeRcaSync(errorMsg: string | null): string {
    if (!errorMsg) return 'Unknown';
    
    const msg = errorMsg.toLowerCase().trim();

    const patterns: Record<string, (string | RegExp)[]> = {
        'Comparision Failed': ['expect(received).tocontain(expected)'],
        'Validation Failed': [
            'expect(received).tobetruthy()',
            'expect(locator).tohavetext',
            'expect(locator).tobechecked',
            'expect(locator).tobevisible'
        ],
        'Code Error': [
            'not a function',
            "typeerror: cannot read properties of null (reading 'tostring')"
        ],
        'Locator Not Found': [
            'element not found',
            'element is not attached to the dom'
        ],
        'Logic Issue': [
            'typeerror: cannot read properties of undefined (reading',
            "cannot read properties of undefined (reading 'unicode') at escaperegexforselector"
        ],
        'DDSE - Given Element Not Found': ['not found even after multiple retries & even with starts with approach.'],
        'Browser intermittently closed': ['target page, context or browser has been closed'],
        'MEW/TAB compatability issue': ['element is outside of the viewport'],
        'Locator Frame Issue': ['locators must belong to the same frame.'],
        'API Failure (HTML Response)': [
            'received html response, indicating a failure.',
            'api response not found for endpoint',
            'empty in the api response'
        ],
        'Validation Issue': [/expect.*pass.*receive.*fail/i, /expect.*fail.*receive.*pass/i]
    };

    for (const [category, categoryPatterns] of Object.entries(patterns)) {
        for (const pattern of categoryPatterns) {
            if (pattern instanceof RegExp) {
                if (pattern.test(msg)) return category;
            } else if (msg.includes(pattern.toLowerCase())) {
                return category;
            }
        }
    }

    return 'Custom Error';
}

async function main() {
    console.log('--- Manual RCA Rebuild ---');
    
    // We want to re-process 'Custom Error' as well because we added new patterns
    const pendingFailures = await prisma.testCaseResult.findMany({
        where: {
            status: { contains: 'failed', mode: 'insensitive' },
            AND: [
                {
                    OR: [
                        { rcaCategory: null },
                        { rcaCategory: 'Unknown' },
                        { rcaCategory: 'Custom Error' }
                    ]
                },
                {
                    OR: [
                        { rcaStatus: 'Auto-Detected' },
                        { rcaStatus: null }
                    ]
                }
            ]
        },
        select: {
            id: true,
            errorMessage: true
        }
    });

    if (pendingFailures.length === 0) {
        console.log('No records require backfilling.');
        return;
    }

    console.log(`Processing ${pendingFailures.length} records...`);

    let updatedCount = 0;
    const batchSize = 100;
    for (let i = 0; i < pendingFailures.length; i += batchSize) {
        const batch = pendingFailures.slice(i, i + batchSize);
        const updates = batch.map(f => {
            const category = categorizeRcaSync(f.errorMessage);
            return prisma.testCaseResult.update({
                where: { id: f.id },
                data: { 
                    rcaCategory: category,
                    rcaStatus: 'Auto-Detected'
                }
            });
        });
        await prisma.$transaction(updates);
        updatedCount += batch.length;
        console.log(`Updated ${updatedCount}/${pendingFailures.length} records...`);
    }

    console.log(`RCA Rebuild Complete: ${updatedCount} records updated.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
