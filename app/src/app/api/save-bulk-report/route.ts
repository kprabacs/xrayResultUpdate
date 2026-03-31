import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseCucumberReport, ParsedCucumberReport } from '@/utils/cucumberReportParser';
import { categorizeRcaSync } from '@/utils/rcaAnalyzer';
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
        const releaseName = (formData.get('releaseName') as string || 'N/A').trim();
        
        // Xray metadata from form
        const jiraToken = formData.get('jiraToken') as string || '';
        const testPlanKey = formData.get('testPlanKey') as string || '';
        let currentTestExecKey = formData.get('testExecKey') as string || '';
        let currentUpdateType = formData.get('updateType') as string || ''; // 'create' or 'update'
        const xraySummary = formData.get('summary') as string || '';
        const uploadToXray = formData.get('uploadToXray') === 'true';

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

        const reportsToCreate: { summaryData: SummaryData, testCases: ParsedCucumberReport['testCases'], rawJson: any }[] = [];
        const duplicateFiles: string[] = [];
        let totalSkippedScenarios = 0;

        for (const jsonFile of jsonFiles) {
            const fileName = jsonFile.name.split('/').pop() || "";
            const fileNameWithoutExt = fileName.replace(/\.json$/i, '');
            
            let fallbackModuleName = "";
            let fallbackChannelName = "";
            let fallbackDeviceName = "";

            // Try hyphen format first (module-channel-device)
            const hyphenParts = fileNameWithoutExt.split('-');
            if (hyphenParts.length === 3) {
                [fallbackModuleName, fallbackChannelName, fallbackDeviceName] = hyphenParts;
            } else {
                // Try underscore format (channel_module_device)
                const underscoreParts = fileNameWithoutExt.split('_');
                if (underscoreParts.length === 3) {
                    [fallbackChannelName, fallbackModuleName, fallbackDeviceName] = underscoreParts;
                }
            }
            
            fallbackModuleName = (fallbackModuleName || "unknown").trim().toLowerCase();
            fallbackChannelName = (fallbackChannelName || "unknown").trim().toLowerCase();
            fallbackDeviceName = (fallbackDeviceName || "unknown").trim().toLowerCase();

            const content = await jsonFile.async('string');
            const reportHash = crypto.createHash('sha256').update(content).digest('hex');

            const existingReport = await prisma.testRunSummary.findFirst({
                where: { reportHash }
            });

            if (existingReport) {
                duplicateFiles.push(jsonFile.name);
                continue;
            }

            const reportJson = JSON.parse(content);
            const { summary, testCases, metadata, skippedCount } = parseCucumberReport(reportJson);
            totalSkippedScenarios += skippedCount;

            const finalModuleName = (metadata?.moduleName || fallbackModuleName).toLowerCase();
            const finalChannelName = (metadata?.applicationName || fallbackChannelName).toLowerCase();
            const finalDeviceName = (metadata?.deviceType || fallbackDeviceName).toLowerCase();

            reportsToCreate.push({
                summaryData: {
                    ...summary,
                    releaseName,
                    module: finalModuleName,
                    channel: finalChannelName,
                    device: finalDeviceName,
                    reportHash,
                },
                testCases,
                rawJson: reportJson
            });
        }

        if (reportsToCreate.length === 0) {
            return NextResponse.json({ 
                error: 'No new reports to process. All files were duplicates or malformed.',
                duplicateFiles
            }, { status: 400 });
        }

        // 1. Save to Database
        const dbResult = await prisma.$transaction(async (tx) => {
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
                    rcaCategory: tc.status === 'failed' ? categorizeRcaSync(tc.errorMessage || null) : null,
                    rcaStatus: tc.status === 'failed' ? 'Auto-Detected' : null
                }));

                await tx.testCaseResult.createMany({
                    data: testCaseData,
                });

                // Update Flaky Test Tracking
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

        // 2. Handle Xray Upload (Serial Strategy to prevent 413)
        let xrayMessage = "";
        if (uploadToXray && jiraToken) {
            let successCount = 0;
            let failCount = 0;
            let lastError = "";

            const host = request.headers.get('host') || process.env.VERCEL_URL || 'localhost:3000';
            const protocol = host.includes('localhost') ? 'http' : 'https';
            const xrayUrl = `${protocol}://${host}/api/upload-to-xray`;

            for (let i = 0; i < reportsToCreate.length; i++) {
                const report = reportsToCreate[i];
                try {
                    const xrayResponse = await fetch(xrayUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            cucumberReport: Array.isArray(report.rawJson) ? report.rawJson : [report.rawJson], 
                            token: jiraToken, 
                            updateType: currentUpdateType, 
                            testExecKey: currentTestExecKey, 
                            testPlanKey, 
                            summary: xraySummary || `Bulk Upload: ${releaseName} (${report.summaryData.module})` 
                        }),
                    });

                    const xrayResult = await xrayResponse.json();
                    if (xrayResponse.ok) {
                        successCount++;
                        // If we created a new execution, use its key for all remaining reports
                        if (currentUpdateType === 'create') {
                            currentTestExecKey = xrayResult.key || xrayResult.testExecutionKey;
                            currentUpdateType = 'update'; // Switch to update for subsequent files
                        }
                    } else {
                        failCount++;
                        lastError = xrayResult.error || 'Unknown error';
                        console.error(`Xray upload failed for file ${i}:`, xrayResult);
                    }
                } catch (err) {
                    failCount++;
                    lastError = err instanceof Error ? err.message : 'Connection error';
                    console.error(`Exception during Xray upload for file ${i}:`, err);
                }
            }
            
            xrayMessage = ` | Xray: ${successCount} synced, ${failCount} failed.`;
            if (currentTestExecKey) xrayMessage += ` (Key: ${currentTestExecKey})`;
            if (failCount > 0) xrayMessage += ` Last Error: ${lastError}`;
        }

        let finalMessage = `Successfully processed ${dbResult.length} reports.${xrayMessage}`;
        if (totalSkippedScenarios > 0) finalMessage += ` (${totalSkippedScenarios} malformed scenarios skipped).`;
        if (duplicateFiles.length > 0) finalMessage += ` Skipped ${duplicateFiles.length} duplicates.`;

        return NextResponse.json({ 
            message: finalMessage,
            savedReports: dbResult,
            duplicateFiles: duplicateFiles.length > 0 ? duplicateFiles : undefined,
        }, { status: 201 });

    } catch (error) {
        console.error('Bulk API Global Error:', error);
        return NextResponse.json({ 
            error: `Bulk API Error: ${error instanceof Error ? error.message : 'An internal server error occurred'}`
        }, { status: 500 });
    }
}
