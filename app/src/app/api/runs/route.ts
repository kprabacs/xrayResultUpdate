import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const skip = parseInt(searchParams.get('skip') || '0', 10);
        const take = parseInt(searchParams.get('take') || '50', 10);

        const runs = await prisma.testRunSummary.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            skip: skip,
            take: take
        });

        return NextResponse.json(runs);
    } catch (error) {
        console.error('Failed to fetch runs:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { ids } = await request.json();

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'No IDs provided for deletion' }, { status: 400 });
        }

        await prisma.testRunSummary.deleteMany({
            where: {
                id: { in: ids.map(id => parseInt(id, 10)) }
            }
        });

        return NextResponse.json({ message: `${ids.length} runs deleted successfully` });
    } catch (error) {
        console.error('Failed to bulk delete runs:', error);
        return NextResponse.json({ error: 'Failed to perform bulk deletion' }, { status: 500 });
    }
}
