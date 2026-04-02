import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Endpoint to unlink a Jira bug from a group of failed test cases.
 */
export async function POST(req: Request) {
    try {
        const { category, app, release } = await req.json();

        if (!category || !app || !release) {
            return NextResponse.json({ error: 'Missing required group parameters' }, { status: 400 });
        }

        const result = await prisma.testCaseResult.updateMany({
            where: {
                rcaCategory: category,
                releaseName: release,
                TestRunSummary: {
                    channel: app
                },
                jiraBugKey: { not: null }
            },
            data: {
                jiraBugKey: null,
                jiraBugLink: null
            }
        });

        return NextResponse.json({ 
            success: true, 
            count: result.count,
            message: `Successfully unlinked ${result.count} failures.`
        });

    } catch (error: any) {
        console.error('Unlink Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
