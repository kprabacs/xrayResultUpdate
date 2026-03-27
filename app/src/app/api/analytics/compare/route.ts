import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Compares two releases for a specific application.
 * Calculates deltas for overall health and individual modules.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const app = searchParams.get('app')?.toLowerCase();
        const baseRelease = searchParams.get('base'); 
        const targetRelease = searchParams.get('target');

        if (!app || !baseRelease || !targetRelease) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        // 1. Fetch Latest Results for both releases (Case Insensitive)
        const allResults = await prisma.testCaseResult.findMany({
            where: {
                releaseName: { in: [baseRelease, targetRelease], mode: 'insensitive' },
                TestRunSummary: {
                    channel: { equals: app, mode: 'insensitive' }
                }
            },
            select: {
                testCaseId: true,
                status: true,
                releaseName: true,
                TestRunSummary: {
                    select: { module: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        if (allResults.length === 0) {
            return NextResponse.json({ overall: { basePct: 0, targetPct: 0, delta: 0 }, modules: [] });
        }

        // 2. Deduplicate: Latest status per testCaseId per release (Case Insensitive release map)
        const latestMap = new Map();
        allResults.forEach(res => {
            if (!res.testCaseId || !res.TestRunSummary) return;
            const key = `${res.releaseName.toLowerCase()}|${res.testCaseId.toLowerCase()}`;
            if (!latestMap.has(key)) {
                latestMap.set(key, {
                    status: res.status.toLowerCase(),
                    module: res.TestRunSummary.module.toLowerCase(),
                    release: res.releaseName.toLowerCase()
                });
            }
        });

        // 3. Aggregate Stats
        const processStats = (releaseName: string) => {
            const rel = releaseName.toLowerCase();
            const moduleMap = new Map();
            let totalTests = 0;
            let totalPass = 0;

            latestMap.forEach((val) => {
                if (val.release !== rel) return;

                totalTests++;
                if (val.status === 'passed') totalPass++;

                const m = moduleMap.get(val.module) || { pass: 0, total: 0 };
                m.total++;
                if (val.status === 'passed') m.pass++;
                moduleMap.set(val.module, m);
            });

            return {
                pct: totalTests > 0 ? (totalPass / totalTests) * 100 : 0,
                modules: moduleMap
            };
        };

        const base = processStats(baseRelease);
        const target = processStats(targetRelease);

        // 4. Calculate Deltas
        const allModules = Array.from(new Set([...base.modules.keys(), ...target.modules.keys()]));
        const comparison = allModules.map(mod => {
            const b = base.modules.get(mod) || { pass: 0, total: 0 };
            const t = target.modules.get(mod) || { pass: 0, total: 0 };
            const bPct = b.total > 0 ? (b.pass / b.total) * 100 : 0;
            const tPct = t.total > 0 ? (t.pass / t.total) * 100 : 0;

            return {
                module: mod,
                basePct: bPct,
                targetPct: tPct,
                delta: tPct - bPct
            };
        }).sort((a, b) => b.delta - a.delta);

        return NextResponse.json({
            baseRelease,
            targetRelease,
            overall: {
                basePct: base.pct,
                targetPct: target.pct,
                delta: target.pct - base.pct
            },
            modules: comparison
        });

    } catch (error) {
        console.error('Comparison API Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
