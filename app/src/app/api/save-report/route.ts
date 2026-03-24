import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseCucumberReport } from '@/utils/cucumberReportParser';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        if (!process.env.DATABASE_URL) {
            return NextResponse.json({ 
                error: 'Database configuration missing.' 
            }, { status: 500 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        
        const releaseName = (formData.get('releaseName') as string || 'N/A').trim();
        const moduleName = (formData.get('module') as string || 'N/A').trim().toLowerCase();
        const channel = (formData.get('channel') as string || 'N/A').trim().toLowerCase();
        const device = (formData.get('device') as string || 'N/A').trim().toLowerCase();
        const runAttempt = parseInt(formData.get('runAttempt') as string || '1', 10);

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
        }

        const reportContent = await file.text();
        
        // Generate hash to prevent duplicate uploads
        const reportHash = crypto.createHash('sha256').update(reportContent).digest('hex');

        // Check if this report was already uploaded
        const existingReport = await prisma.testRunSummary.findFirst({
            where: { reportHash }
        });

        if (existingReport) {
            return NextResponse.json({ 
                error: 'This report has already been uploaded.',
                summaryId: existingReport.id 
            }, { status: 409 });
        }

        const reportJson = JSON.parse(reportContent);
        const { summary, testCases, skippedCount } = parseCucumberReport(reportJson);

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Summary
            const testRunSummary = await tx.testRunSummary.create({
                data: {
                    ...summary,
                    releaseName,
                    module: moduleName,
                    channel,
                    device,
                    reportHash,
                }
            });

            // 2. Create Test Case Results
            const testCaseData = testCases.map(tc => ({
                ...tc,
                releaseName,
                runAttempt,
                testRunSummaryId: testRunSummary.id,
            }));

            await tx.testCaseResult.createMany({
                data: testCaseData,
            });

            // 3. Update Flaky Test Tracking
            for (const tc of testCases) {
                if (tc.testCaseId) {
                    await tx.flakyTest.upsert({
                        where: { 
                            testCaseId_releaseName: {
                                testCaseId: tc.testCaseId,
                                releaseName
                            }
                        },
                        update: {
                            testCaseName: tc.testCaseName,
                            passCount: { increment: tc.status === 'passed' ? 1 : 0 },
                            failCount: { increment: tc.status === 'failed' ? 1 : 0 },
                            lastStatus: tc.status,
                        },
                        create: {
                            testCaseId: tc.testCaseId,
                            testCaseName: tc.testCaseName,
                            releaseName,
                            passCount: tc.status === 'passed' ? 1 : 0,
                            failCount: tc.status === 'failed' ? 1 : 0,
                            lastStatus: tc.status,
                        }
                    });
                }
            }

            return testRunSummary;
        });

        let finalMessage = 'Report processed and saved successfully.';
        if (skippedCount > 0) {
            finalMessage += ` (${skippedCount} malformed/duplicate test cases were skipped based on quality rules)`;
        }

        return NextResponse.json({ 
            message: finalMessage,
            summaryId: result.id,
            summary: result
        }, { status: 201 });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ 
            error: `Backend error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 });
    }
}
