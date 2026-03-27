import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * ResultHub Analytics Engine
 * Optimized for Module-Specific Stability Logic.
 * Preserves Release Case for accurate filtering.
 */
export async function GET() {
    try {
        const allResults = await prisma.testCaseResult.findMany({
            select: {
                testCaseId: true,
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

        const contextMap = new Map();
        
        allResults.forEach(res => {
            if (!res.TestRunSummary || !res.testCaseId) return;
            
            // Note: We lowercase app, device, and module for normalization, but PRESERVE release casing.
            const channel = res.TestRunSummary.channel.toLowerCase();
            const device = res.TestRunSummary.device.toLowerCase();
            const moduleName = res.TestRunSummary.module.toLowerCase();
            const release = res.releaseName; // PRESERVE CASE
            
            const ctxKey = `${channel}|${release}|${device}|${moduleName}|${res.testCaseId}`;
            const stats = contextMap.get(ctxKey) || { passes: 0, fails: 0, latestStatus: '', latestTime: new Date(0), runCount: 0 };
            
            const status = res.status.toLowerCase();
            if (status === 'passed') stats.passes++;
            if (status === 'failed') stats.fails++;
            stats.runCount++;
            
            if (res.createdAt > stats.latestTime) {
                stats.latestTime = res.createdAt;
                stats.latestStatus = status;
            }
            
            contextMap.set(ctxKey, stats);
        });

        const results = Array.from(contextMap.entries()).map(([key, stats]) => {
            const parts = key.split('|');
            return {
                app: parts[0],
                release: parts[1], // Original case
                device: parts[2],
                module: parts[3],
                testCaseId: parts[4],
                status: stats.latestStatus,
                isFlaky: stats.passes > 0 && stats.fails > 0,
                runCount: stats.runCount,
                flakyCount: (stats.passes > 0 && stats.fails > 0) ? 1 : 0,
                flipCount: stats.runCount
            };
        });

        // Projection 3: Module Wise
        const projection3Map = new Map();
        results.forEach(res => {
            const key = `${res.app}|${res.release}|${res.device}|${res.module}`;
            const stats = projection3Map.get(key) || { testCount: 0, passCount: 0, failCount: 0, flakyCount: 0, flipCount: 0, maxRuns: 0 };
            
            stats.testCount++;
            if (res.status === 'passed') stats.passCount++;
            else if (res.status === 'failed') stats.failCount++;
            
            if (res.isFlaky) {
                stats.flakyCount++;
                stats.flipCount += res.runCount;
            }
            if (res.runCount > stats.maxRuns) stats.maxRuns = res.runCount;
            
            projection3Map.set(key, stats);
        });

        const projection3 = Array.from(projection3Map.entries()).map(([key, stats]) => {
            const [app, release, device, moduleName] = key.split('|');
            return {
                app, release, device, module: moduleName, ...stats,
                passPct: stats.testCount > 0 ? (stats.passCount / stats.testCount) * 100 : 0,
                isUnstable: stats.flakyCount > 0,
                hasMultipleRuns: stats.maxRuns > 1
            };
        });

        // Projection 1: App + Release
        const projection1Map = new Map();
        results.forEach(res => {
            const key = `${res.app}|${res.release}`;
            const stats = projection1Map.get(key) || { testCount: 0, passCount: 0, failCount: 0 };
            stats.testCount++;
            if (res.status === 'passed') stats.passCount++;
            else if (res.status === 'failed') stats.failCount++;
            projection1Map.set(key, stats);
        });

        const projection1 = Array.from(projection1Map.entries()).map(([key, stats]) => {
            const [app, release] = key.split('|');
            return { app, release, ...stats, passPct: stats.testCount > 0 ? (stats.passCount / stats.testCount) * 100 : 0 };
        });

        // Projection 4: Trend
        const projection4Map = new Map();
        results.forEach(res => {
            const key = `${res.release}|${res.app}`;
            const stats = projection4Map.get(key) || { pass: 0, fail: 0 };
            if (res.status === 'passed') stats.pass++;
            else if (res.status === 'failed') stats.fail++;
            projection4Map.set(key, stats);
        });

        const projection4 = Array.from(projection4Map.entries()).map(([k, s]) => {
            const [release, app] = k.split('|');
            return { release, app, ...s };
        }).sort((a, b) => a.release.localeCompare(b.release));

        return NextResponse.json({
            summary: projection1,
            moduleStats: projection3,
            trend: projection4
        });

    } catch (error) {
        console.error('Analytics Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
