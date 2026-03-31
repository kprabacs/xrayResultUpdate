import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseCucumberReport } from '@/utils/cucumberReportParser';
import { analyzeRca } from '@/utils/rcaAnalyzer';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function POST(request: Request) {
    let tempFilePath: string | null = null;
    let tempDir: string | null = null;

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

        // --- NEW: RCA Analysis Step ---
        // Save to temp file for the Python script
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rca-'));
        tempFilePath = path.join(tempDir, 'report.json');
        await fs.writeFile(tempFilePath, reportContent);
        
        const rcaResult = await analyzeRca(tempFilePath);
        // Create a map for quick lookup: scenarioName -> category
        const rcaMap = new Map<string, string>();
        if (rcaResult) {
            rcaResult.failures.forEach(f => {
                rcaMap.set(f.scenario, f.rca_category);
            });
        }

        const reportJson = JSON.parse(reportContent);
        const { summary, testCases, metadata, skippedCount } = parseCucumberReport(reportJson);

        // Use extracted metadata if available, otherwise fallback to form data
        const finalModuleName = (metadata?.moduleName || moduleName).toLowerCase();
        const finalChannel = (metadata?.applicationName || channel).toLowerCase();
        const finalDevice = (metadata?.deviceType || device).toLowerCase();

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Summary
            const testRunSummary = await tx.testRunSummary.create({
                data: {
                    ...summary,
                    releaseName,
                    module: finalModuleName,
                    channel: finalChannel,
                    device: finalDevice,
                    reportHash,
                }
            });

            // 2. Create Test Case Results
            const testCaseData = testCases.map(tc => ({
                ...tc,
                releaseName,
                runAttempt,
                testRunSummaryId: testRunSummary.id,
                rcaCategory: tc.status === 'failed' ? (rcaMap.get(tc.testCaseName) || 'Custom Error') : null
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
    } finally {
        // Cleanup temp files
        if (tempDir) {
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (e) {
                console.error('Failed to cleanup temp dir:', e);
            }
        }
    }
}
