import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Generates data for an Excel report of multi-run tests within a specific module.
 * Lists results for every dry run attempt.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const app = searchParams.get('app')?.toLowerCase();
        const release = searchParams.get('release');
        const device = searchParams.get('device')?.toLowerCase();
        const module = searchParams.get('module')?.toLowerCase();

        if (!app || !release || !device || !module) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // 1. Get all TestRunSummary IDs for this specific module context (Case Insensitive Release)
        const summaries = await prisma.testRunSummary.findMany({
            where: {
                channel: { equals: app, mode: 'insensitive' },
                releaseName: { equals: release, mode: 'insensitive' },
                device: { equals: device, mode: 'insensitive' },
                module: { equals: module, mode: 'insensitive' }
            },
            select: { id: true, createdAt: true },
            orderBy: { createdAt: 'asc' }
        });

        if (summaries.length === 0) {
            return NextResponse.json({ error: 'No data found.' }, { status: 404 });
        }

        const summaryIds = summaries.map(s => s.id);

        // 2. Fetch all test results
        const allResults = await prisma.testCaseResult.findMany({
            where: {
                testRunSummaryId: { in: summaryIds },
                testCaseId: { not: null }
            },
            select: {
                testCaseId: true,
                testCaseName: true,
                status: true,
                testRunSummaryId: true
            },
            orderBy: { testCaseId: 'asc' }
        });

        // 3. Map into rows
        const testMap = new Map();
        allResults.forEach(res => {
            const list = testMap.get(res.testCaseId) || [];
            list.push(res);
            testMap.set(res.testCaseId, list);
        });

        const reportRows: any[] = [];
        
        testMap.forEach((results, testId) => {
            const row: any = {
                "Release": release,
                "Application": app.toUpperCase(),
                "Device Type": device.toUpperCase(),
                "Module": module.toUpperCase(),
                "Test Case ID": testId,
                "Test Case Name": results[0].testCaseName,
            };

            summaries.forEach((s, index) => {
                const runResult = results.find((r: any) => r.testRunSummaryId === s.id);
                row[`Run ${index + 1} (${new Date(s.createdAt).toLocaleDateString()})`] = runResult ? runResult.status.toUpperCase() : "N/A";
            });

            reportRows.push(row);
        });

        return NextResponse.json(reportRows);

    } catch (error) {
        console.error('Flaky Report Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
