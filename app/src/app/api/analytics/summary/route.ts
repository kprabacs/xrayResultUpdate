import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * ResultHub Analytics Engine
 * Provides 4 hierarchical projections with latest-result deduplication.
 */
export async function GET() {
    try {
        // 1. Fetch all test case results ordered by creation date (newest first)
        const allResults = await prisma.testCaseResult.findMany({
            select: {
                testCaseId: true,
                testCaseName: true,
                status: true,
                releaseName: true,
                createdAt: true,
                TestRunSummary: {
                    select: {
                        channel: true,
                        device: true,
                        module: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // 2. Deduplicate: Keep only the latest result for each unique test case 
        const latestResultsMap = new Map();
        
        allResults.forEach(res => {
            if (!res.TestRunSummary || !res.testCaseId) return;
            
            const app = res.TestRunSummary.channel.toLowerCase();
            const release = res.releaseName;
            const device = res.TestRunSummary.device.toLowerCase();
            const moduleName = res.TestRunSummary.module.toLowerCase();
            
            const key = `${app}|${release}|${device}|${res.testCaseId}`;
            
            if (!latestResultsMap.has(key)) {
                latestResultsMap.set(key, {
                    app,
                    release,
                    device,
                    module: moduleName,
                    status: res.status.toLowerCase(),
                    testCaseId: res.testCaseId
                });
            }
        });

        const deduplicatedResults = Array.from(latestResultsMap.values());

        // --- Projection 1: App + Release ---
        const projection1Map = new Map();
        deduplicatedResults.forEach(res => {
            const key = `${res.app}|${res.release}`;
            const stats = projection1Map.get(key) || { testCount: 0, passCount: 0, failCount: 0 };
            stats.testCount++;
            if (res.status === 'passed') stats.passCount++;
            else if (res.status === 'failed') stats.failCount++;
            projection1Map.set(key, stats);
        });

        const projection1 = Array.from(projection1Map.entries()).map(([key, stats]) => {
            const [app, release] = key.split('|');
            return {
                app, release, ...stats,
                passPct: stats.testCount > 0 ? (stats.passCount / stats.testCount) * 100 : 0,
                failPct: stats.testCount > 0 ? (stats.failCount / stats.testCount) * 100 : 0
            };
        });

        // --- Projection 2: App + Release + Device ---
        const projection2Map = new Map();
        deduplicatedResults.forEach(res => {
            const key = `${res.app}|${res.release}|${res.device}`;
            const stats = projection2Map.get(key) || { testCount: 0, passCount: 0, failCount: 0 };
            stats.testCount++;
            if (res.status === 'passed') stats.passCount++;
            else if (res.status === 'failed') stats.failCount++;
            projection2Map.set(key, stats);
        });

        const projection2 = Array.from(projection2Map.entries()).map(([key, stats]) => {
            const [app, release, device] = key.split('|');
            return {
                app, release, device, ...stats,
                passPct: stats.testCount > 0 ? (stats.passCount / stats.testCount) * 100 : 0,
                failPct: stats.testCount > 0 ? (stats.failCount / stats.testCount) * 100 : 0
            };
        });

        // --- Projection 3: App + Release + Device + Module ---
        const projection3Map = new Map();
        deduplicatedResults.forEach(res => {
            const key = `${res.app}|${res.release}|${res.device}|${res.module}`;
            const stats = projection3Map.get(key) || { testCount: 0, passCount: 0, failCount: 0 };
            stats.testCount++;
            if (res.status === 'passed') stats.passCount++;
            else if (res.status === 'failed') stats.failCount++;
            projection3Map.set(key, stats);
        });

        const projection3 = Array.from(projection3Map.entries()).map(([key, stats]) => {
            const [app, release, device, moduleName] = key.split('|');
            return {
                app, release, device, module: moduleName, ...stats,
                passPct: stats.testCount > 0 ? (stats.passCount / stats.testCount) * 100 : 0,
                failPct: stats.testCount > 0 ? (stats.failCount / stats.testCount) * 100 : 0
            };
        });

        // --- Projection 4: Release Wise Trend ---
        const projection4Map = new Map();
        deduplicatedResults.forEach(res => {
            const key = `${res.release}|${res.app}`;
            const stats = projection4Map.get(key) || { pass: 0, fail: 0 };
            if (res.status === 'passed') stats.pass++;
            else if (res.status === 'failed') stats.fail++;
            projection4Map.set(key, stats);
        });

        const projection4 = Array.from(projection4Map.entries())
            .map(([key, stats]) => {
                const [release, app] = key.split('|');
                return { release, app, ...stats };
            })
            .sort((a, b) => a.release.localeCompare(b.release));

        return NextResponse.json({
            summary: projection1,
            deviceStats: projection2,
            moduleStats: projection3,
            trend: projection4
        });

    } catch (error) {
        console.error('Analytics Error:', error);
        return NextResponse.json({ error: 'Failed to generate analytics' }, { status: 500 });
    }
}
