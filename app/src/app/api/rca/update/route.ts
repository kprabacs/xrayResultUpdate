import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * PATCH /api/rca/update
 * Updates the RCA category, note, and status for a specific failure.
 */
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, rcaCategory, rcaNote, rcaStatus } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing failure ID' }, { status: 400 });
        }

        const updatedFailure = await prisma.testCaseResult.update({
            where: { id: parseInt(id, 10) },
            data: {
                rcaCategory,
                rcaNote,
                rcaStatus
            }
        });

        return NextResponse.json(updatedFailure);

    } catch (error) {
        console.error('Update RCA Error:', error);
        return NextResponse.json({ error: 'Failed to update RCA metadata' }, { status: 500 });
    }
}
