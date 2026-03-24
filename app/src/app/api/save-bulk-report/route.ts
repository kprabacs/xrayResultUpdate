import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseCucumberReport, ParsedCucumberReport } from '@/utils/cucumberReportParser';
import JSZip from 'jszip';
import crypto from 'crypto';

type SummaryData = ParsedCucumberReport['summary'] & {
    releaseName: string;
    module: string;
    channel: string;
    device: string;
    reportHash: string;
}

export async function POST(request: Request) {
    try {
        if (!process.env.DATABASE_URL) {
            return NextResponse.json({ 
                error: 'Database configuration missing.' 
            }, { status: 500 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const releaseName = formData.get('releaseName') as string || 'N/A';

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
        }
        if (!file.name.toLowerCase().endsWith('.zip')) {
             return NextResponse.json({ error: 'Invalid file type. Please upload a .zip file.' }, { status: 400 });
        }

        const fileBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(fileBuffer);
        
        const jsonFiles = Object.values(zip.files).filter(f => 
            !f.dir && f.name.toLowerCase().endsWith('.json') && !f.name.startsWith('__MACOSX/')
        );

        if (jsonFiles.length === 0) {
            return NextResponse.json({ error: 'The uploaded ZIP file contains no .json files.' }, { status: 400 });
        }

        const reportsToCreate: { summaryData: SummaryData, testCases: ParsedCucumberReport['testCases'] }[] = [];
        const skippedFiles: string[] = [];
        const duplicateFiles: string[] = [];
        let totalSkippedScenarios = 0;

        for (const jsonFile of jsonFiles) {
            const fileName = jsonFile.name.split('/').pop() || "";
            const fileNameWithoutExt = fileName.replace(/\.json$/i, '');
            
            let moduleName = "";
            let channelName = "";
            let deviceName = "";

            // Try hyphen format first (module-channel-device)
            const hyphenParts = fileNameWithoutExt.split('-');
            if (hyphenParts.length === 3) {
                [moduleName, channelName, deviceName] = hyphenParts;
            } else {
                // Try underscore format (channel_module_device) - matching the ZIP content provided
                const underscoreParts = fileNameWithoutExt.split('_');
                if (underscoreParts.length === 3) {
                    [channelName, moduleName, deviceName] = underscoreParts;
                } else {
                    skippedFiles.push(jsonFile.name);
                    continue;
                }
            }
            
            moduleName = moduleName.trim().toLowerCase();
            channelName = channelName.trim().toLowerCase();
            deviceName = deviceName.trim().toLowerCase();

            const content = await jsonFile.async('string');
            
            // Generate hash to prevent duplicate uploads
            const reportHash = crypto.createHash('sha256').update(content).digest('hex');

            // Check if this report was already uploaded
            const existingReport = await prisma.testRunSummary.findFirst({
                where: { reportHash }
            });

            if (existingReport) {
                duplicateFiles.push(jsonFile.name);
                continue;
            }

            const reportJson = JSON.parse(content);
            const { summary, testCases, skippedCount } = parseCucumberReport(reportJson);
            totalSkippedScenarios += skippedCount;

            reportsToCreate.push({
                summaryData: {
                    ...summary,
                    releaseName,
                    module: moduleName,
                    channel: channelName,
                    device: deviceName,
                    reportHash,
                },
                testCases
            });
        }

        if (reportsToCreate.length === 0) {
            return NextResponse.json({ 
                error: 'No new reports to process. All files were duplicates, malformed, or improperly named.',
                duplicateFiles,
                skippedFiles
            }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const createdSummaries = [];
            for (const report of reportsToCreate) {
                const testRunSummary = await tx.testRunSummary.create({
                    data: report.summaryData,
                });

                const testCaseData = report.testCases.map(tc => ({
                    ...tc,
                    releaseName,
                    runAttempt: 1,
                    testRunSummaryId: testRunSummary.id,
                }));

                await tx.testCaseResult.createMany({
                    data: testCaseData,
                });

                // Update Flaky Test Tracking for each test case in the report
                for (const tc of report.testCases) {
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

                createdSummaries.push({ id: testRunSummary.id, module: testRunSummary.module });
            }
            return createdSummaries;
        });

        let finalMessage = `Successfully processed and saved ${result.length} reports.`;
        if (totalSkippedScenarios > 0) finalMessage += ` (${totalSkippedScenarios} malformed/duplicate test cases skipped).`;
        if (duplicateFiles.length > 0) finalMessage += ` Skipped ${duplicateFiles.length} duplicates.`;
        if (skippedFiles.length > 0) finalMessage += ` Skipped ${skippedFiles.length} invalid files.`;

        return NextResponse.json({ 
            message: finalMessage,
            savedReports: result,
            duplicateFiles: duplicateFiles.length > 0 ? duplicateFiles : undefined,
            skippedFiles: skippedFiles.length > 0 ? skippedFiles : undefined,
        }, { status: 201 });

    } catch (error) {
        console.error('Bulk API Error:', error);
        return NextResponse.json({ 
            error: `Backend error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 });
    }
}
