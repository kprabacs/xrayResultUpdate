import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { categorizeRcaSync } from '@/utils/rcaAnalyzer';

/**
 * GET /api/admin/rebuild-rca
 * Scans the database for failures with missing RCA categories and backfills them.
 * Supports optional ?runId=X to target a specific execution.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const runId = searchParams.get('runId');

        const where: any = {
            status: { contains: 'failed', mode: 'insensitive' },
            // Category is either missing or vague
            OR: [
                { rcaCategory: null },
                { rcaCategory: 'Unknown' },
                { rcaCategory: 'Custom Error' }
            ],
            // AND Status is either Auto-Detected or Null (never touched by human)
            AND: [
                {
                    OR: [
                        { rcaStatus: 'Auto-Detected' },
                        { rcaStatus: null }
                    ]
                }
            ]
        };

        // TARGETED SYNC: If runId is provided, filter by it
        if (runId) {
            where.testRunSummaryId = parseInt(runId);
        }

        const pendingFailures = await prisma.testCaseResult.findMany({
            where,
            select: {
                id: true,
                errorMessage: true
            }
        });

        if (pendingFailures.length === 0) {
            return NextResponse.json({ 
                success: true,
                message: runId ? `No pending records found for Run #${runId}.` : 'No records require backfilling.',
                count: 0,
                breakdown: {}
            });
        }

        console.log(`RCA Backfill: Processing ${pendingFailures.length} records...`);

        // Categorize and update each record in a transaction
        // Track breakdown
        const categoryBreakdown: Record<string, number> = {};
        
        const updates = pendingFailures.map(f => {
            const category = categorizeRcaSync(f.errorMessage);
            
            // Track for breakdown report
            categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;

            return prisma.testCaseResult.update({
                where: { id: f.id },
                data: { 
                    rcaCategory: category,
                    rcaStatus: 'Auto-Detected'
                }
            });
        });

        await prisma.$transaction(updates);

        return NextResponse.json({ 
            success: true,
            message: `Successfully updated ${pendingFailures.length} records${runId ? ` for Run #${runId}` : ''}.`,
            count: pendingFailures.length,
            breakdown: categoryBreakdown
        });

    } catch (error) {
        console.error('RCA Backfill Error:', error);
        return NextResponse.json({ error: 'Failed to backfill RCA data' }, { status: 500 });
    }
}
