import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * ResultHub DNA Matrix API
 * Fetches the status history of all test cases in a module across multiple releases.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const app = searchParams.get('app')?.toLowerCase();
        const moduleName = searchParams.get('module')?.toLowerCase();
        const device = searchParams.get('device')?.toLowerCase();

        if (!app || !moduleName || !device) {
            return NextResponse.json({ error: 'Missing app, module, or device' }, { status: 400 });
        }

        // 1. Get the last 10 unique releases for this app/device context
        const recentRuns = await prisma.testRunSummary.findMany({
            where: {
                channel: { equals: app, mode: 'insensitive' },
                device: { equals: device, mode: 'insensitive' }
            },
            select: { releaseName: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            distinct: ['releaseName'],
            take: 10
        });

        // Sort releases by time (oldest to newest for the matrix columns)
        const releases = recentRuns.map(r => r.releaseName).reverse();

        if (releases.length === 0) {
            return NextResponse.json({ releases: [], dna: [] });
        }

        // 2. Fetch all test results for these releases and module
        const allResults = await prisma.testCaseResult.findMany({
            where: {
                releaseName: { in: releases },
                TestRunSummary: {
                    channel: { equals: app, mode: 'insensitive' },
                    module: { equals: moduleName, mode: 'insensitive' },
                    device: { equals: device, mode: 'insensitive' }
                }
            },
            select: {
                testCaseId: true,
                testCaseName: true,
                status: true,
                releaseName: true
            }
        });

        // 3. Aggregate results into DNA strands (test case -> release -> status)
        const dnaMap = new Map();

        allResults.forEach(res => {
            if (!res.testCaseId) return;
            
            const strand = dnaMap.get(res.testCaseId) || { 
                id: res.testCaseId, 
                name: res.testCaseName, 
                history: {} 
            };
            
            const relKey = res.releaseName;
            const currentStatus = res.status.toLowerCase();
            const existing = strand.history[relKey];

            if (!existing) {
                strand.history[relKey] = currentStatus;
            } else if (existing !== currentStatus && existing !== 'flaky') {
                // If we see both pass and fail in the same release/module context, mark as flaky
                strand.history[relKey] = 'flaky';
            }
            
            dnaMap.set(res.testCaseId, strand);
        });

        // 4. Calculate reliability score and format for frontend
        const dnaResults = Array.from(dnaMap.values()).map(strand => {
            const historyArray = releases.map(rel => strand.history[rel] || 'no_data');
            
            // Reliability = (Consistent Passes) / (Total attempted releases)
            const attempts = historyArray.filter(h => h !== 'no_data');
            const passes = historyArray.filter(h => h === 'passed').length;
            const reliability = attempts.length > 0 ? (passes / attempts.length) * 100 : 0;

            return {
                ...strand,
                history: historyArray,
                reliability
            };
        }).sort((a, b) => a.reliability - b.reliability); // Show least reliable first

        return NextResponse.json({
            releases,
            dna: dnaResults
        });

    } catch (error) {
        console.error('DNA API Error:', error);
        return NextResponse.json({ error: 'Failed to generate DNA matrix' }, { status: 500 });
    }
}
