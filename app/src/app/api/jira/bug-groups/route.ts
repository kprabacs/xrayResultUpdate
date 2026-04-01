import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/jira/bug-groups
 * Groups all failed test cases that haven't been bugged yet.
 */
export async function GET() {
    try {
        // Fetch all failed test cases with their summary info
        const failures = await prisma.testCaseResult.findMany({
            where: {
                status: { contains: 'failed', mode: 'insensitive' }
            },
            include: {
                TestRunSummary: {
                    select: {
                        channel: true,
                        device: true
                    }
                }
            }
        });

        // Grouping logic: Release + App + Category
        const groups: Record<string, any> = {};

        failures.forEach(f => {
            const release = f.releaseName || 'Unknown';
            const app = f.TestRunSummary?.channel || 'Unknown';
            const category = f.rcaCategory || 'Custom Error';
            const groupKey = `${release}|${app}|${category}`;

            if (!groups[groupKey]) {
                groups[groupKey] = {
                    release,
                    app,
                    category,
                    failCount: 0,
                    buggedCount: 0,
                    jiraBugKey: f.jiraBugKey, // Take the first one found if exists
                    jiraBugLink: f.jiraBugLink,
                    failures: []
                };
            }

            groups[groupKey].failCount++;
            if (f.jiraBugKey) {
                groups[groupKey].buggedCount++;
                // If we find any bug key in the group, use it as the reference
                groups[groupKey].jiraBugKey = f.jiraBugKey;
                groups[groupKey].jiraBugLink = f.jiraBugLink;
            }
        });

        const result = Object.values(groups).sort((a, b) => {
            // Sort by Release (desc) then App
            if (a.release !== b.release) return b.release.localeCompare(a.release);
            return a.app.localeCompare(b.app);
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error('Bug Groups API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch bug groups' }, { status: 500 });
    }
}
