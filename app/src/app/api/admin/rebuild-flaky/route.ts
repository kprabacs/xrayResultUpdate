import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Rebuilds the FlakyTest table from scratch based on current TestCaseResults.
 * Useful after manual deletions to ensure flakiness stats are accurate.
 */
export async function POST() {
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Clear existing flaky data
            await tx.flakyTest.deleteMany({});

            // 2. Fetch all results grouped by release and test case
            const allResults = await tx.testCaseResult.findMany({
                where: {
                    testCaseId: { not: null }
                },
                orderBy: {
                    createdAt: 'asc' // Process from oldest to newest to maintain 'lastStatus'
                }
            });

            // 3. Aggregate results in memory
            const flakyMap = new Map();

            for (const res of allResults) {
                if (!res.testCaseId) continue;
                
                const key = `${res.testCaseId}|${res.releaseName}`;
                const existing = flakyMap.get(key) || {
                    testCaseId: res.testCaseId,
                    testCaseName: res.testCaseName,
                    releaseName: res.releaseName,
                    passCount: 0,
                    failCount: 0,
                    lastStatus: ''
                };

                if (res.status === 'passed') existing.passCount++;
                else if (res.status === 'failed') existing.failCount++;
                
                existing.lastStatus = res.status;
                flakyMap.set(key, existing);
            }

            // 4. Batch insert new flaky data
            const newFlakyRecords = Array.from(flakyMap.values());
            if (newFlakyRecords.length > 0) {
                await tx.flakyTest.createMany({
                    data: newFlakyRecords
                });
            }
        });

        return NextResponse.json({ message: 'Flaky test metrics recalculated successfully' });
    } catch (error) {
        console.error('Failed to rebuild flaky data:', error);
        return NextResponse.json({ error: 'Failed to recalculate metrics' }, { status: 500 });
    }
}
