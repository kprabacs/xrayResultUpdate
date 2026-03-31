import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/rca/failures
 * Fetches all failed test cases with their RCA metadata.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const app = searchParams.get('app')?.trim();
        const release = searchParams.get('release')?.trim();
        const module = searchParams.get('module')?.trim();
        const device = searchParams.get('device')?.trim();

        console.log('RCA Params Received:', { app, release, module, device });

        const where: any = {
            status: { contains: 'failed', mode: 'insensitive' }
        };

        if (release && release.toLowerCase() !== 'all') {
            where.releaseName = { contains: release, mode: 'insensitive' };
        }

        if ((app && app.toLowerCase() !== 'all') || (module && module.toLowerCase() !== 'all') || (device && device.toLowerCase() !== 'all')) {
            where.TestRunSummary = {};
            if (app && app.toLowerCase() !== 'all') where.TestRunSummary.channel = { contains: app, mode: 'insensitive' };
            if (module && module.toLowerCase() !== 'all') where.TestRunSummary.module = { contains: module, mode: 'insensitive' };
            if (device && device.toLowerCase() !== 'all') where.TestRunSummary.device = { contains: device, mode: 'insensitive' };
        }

        console.log('RCA Final Where:', JSON.stringify(where, null, 2));

        const failures = await prisma.testCaseResult.findMany({
            where,
            include: {
                TestRunSummary: true
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`RCA Result Count: ${failures.length}`);

        return NextResponse.json({ failures });

    } catch (error) {
        console.error('Fetch Failures Error:', error);
        return NextResponse.json({ error: 'Failed to fetch failures' }, { status: 500 });
    }
}
