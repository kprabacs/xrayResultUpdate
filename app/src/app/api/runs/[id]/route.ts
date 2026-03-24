import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const runId = parseInt(id, 10);

        if (isNaN(runId)) {
            return NextResponse.json({ error: 'Invalid run ID' }, { status: 400 });
        }

        // Deleting the summary will cascade delete TestCaseResults
        await prisma.testRunSummary.delete({
            where: { id: runId }
        });

        return NextResponse.json({ message: 'Run deleted successfully' });
    } catch (error) {
        console.error('Failed to delete run:', error);
        return NextResponse.json({ error: 'Failed to delete run' }, { status: 500 });
    }
}
