import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/rca/filters
 * Returns unique combinations of metadata that have AT LEAST one failure.
 * Used to drive intelligent cascading filters in the RCA Manager.
 */
export async function GET() {
    try {
        // Fetch all unique combinations from TestCaseResult where status is failed
        const failureCombinations = await prisma.testCaseResult.findMany({
            where: {
                status: { contains: 'failed', mode: 'insensitive' }
            },
            select: {
                releaseName: true,
                TestRunSummary: {
                    select: {
                        channel: true,
                        device: true,
                        module: true
                    }
                }
            }
        });

        // Use a Set to store unique strings and then parse them back to objects
        // Format: "app|release|device|module"
        const uniqueSet = new Set<string>();
        
        failureCombinations.forEach(f => {
            if (!f.TestRunSummary) return;
            const combo = `${f.TestRunSummary.channel}|${f.releaseName}|${f.TestRunSummary.device}|${f.TestRunSummary.module}`;
            uniqueSet.add(combo.toLowerCase());
        });

        // Convert back to a structured flat list for the frontend to filter
        const combinations = Array.from(uniqueSet).map(s => {
            const [app, release, device, module] = s.split('|');
            return { app, release, device, module };
        });

        // Summary lists for the initial dropdown populations
        const apps = Array.from(new Set(combinations.map(c => c.app))).sort();
        const releases = Array.from(new Set(combinations.map(c => c.release))).sort();
        const devices = Array.from(new Set(combinations.map(c => c.device))).sort();
        const modules = Array.from(new Set(combinations.map(c => c.module))).sort();

        return NextResponse.json({
            apps,
            releases,
            devices,
            modules,
            combinations // Full list for frontend-side dependency filtering
        });

    } catch (error) {
        console.error('RCA Filters API Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
