import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const runs = await prisma.testRunSummary.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            take: 50 // Limit to last 50 runs for performance
        });

        return NextResponse.json(runs);
    } catch (error) {
        console.error('Failed to fetch runs:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
