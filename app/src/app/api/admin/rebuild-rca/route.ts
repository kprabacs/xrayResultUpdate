import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { categorizeRcaSync } from '@/utils/rcaAnalyzer';

/**
 * GET /api/admin/rebuild-rca
 * Scans the database for failures with missing RCA categories and backfills them.
 */
export async function GET() {
    try {
        // 1. Fetch failed test cases that are STILL in 'Auto-Detected' mode
        // and have either no category or a fallback category.
        const pendingFailures = await prisma.testCaseResult.findMany({
            where: {
                status: { contains: 'failed', mode: 'insensitive' },
                OR: [
                    { rcaCategory: null },
                    { rcaCategory: 'Unknown' },
                    { rcaCategory: 'Custom Error' }
                ],
                // ONLY touch records that haven't been manually verified or changed by a human
                rcaStatus: { in: ['Auto-Detected', null] }
            },
            select: {
                id: true,
                errorMessage: true
            }
        });

        if (pendingFailures.length === 0) {
            return NextResponse.json({ message: 'No records require backfilling.' });
        }

        console.log(`RCA Backfill: Processing ${pendingFailures.length} records...`);

        // 2. Categorize and update each record
        // Note: Using a loop here for simplicity, but we could use a single transaction
        let updatedCount = 0;
        
        // We use a transaction to ensure integrity, but we'll batch if the count is huge
        const updates = pendingFailures.map(f => {
            const category = categorizeRcaSync(f.errorMessage);
            return prisma.testCaseResult.update({
                where: { id: f.id },
                data: { 
                    rcaCategory: category,
                    rcaStatus: 'Auto-Detected' // Re-set status for clarity
                }
            });
        });

        // Execute all updates
        await prisma.$transaction(updates);
        updatedCount = pendingFailures.length;

        console.log(`RCA Backfill Complete: ${updatedCount} records updated.`);

        return NextResponse.json({ 
            success: true,
            message: `Successfully backfilled RCA categories for ${updatedCount} historical failures.`,
            count: updatedCount
        });

    } catch (error) {
        console.error('RCA Backfill Error:', error);
        return NextResponse.json({ error: 'Failed to backfill RCA data' }, { status: 500 });
    }
}
