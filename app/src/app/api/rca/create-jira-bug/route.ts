import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createJiraBug, linkBugToTestCase, linkBugToXrayExecution } from '@/utils/jiraClient';

export async function POST(req: Request) {
    try {
        const { 
            category, 
            app, 
            release, 
            device, 
            module, 
            xrayToken,
            jiraEmail,
            jiraToken,
            jiraBaseUrl,
            projectKey,
            issueType,
            severity,
            foundIn
        } = await req.json();

        // 1. Fetch all failures matching this category
        const failures = await prisma.testCaseResult.findMany({
            where: {
                rcaCategory: category,
                releaseName: release,
                ...(app && { TestRunSummary: { channel: app } }),
                ...(device && { TestRunSummary: { device: device } }),
                ...(module && module !== 'All' && { TestRunSummary: { module: module } }),
                status: { contains: 'failed', mode: 'insensitive' },
                jiraBugKey: null // Only those not bugged yet
            },
            include: {
                TestRunSummary: true
            }
        });

        if (failures.length === 0) {
            return NextResponse.json({ error: 'No unbugged failures found for this selection' }, { status: 404 });
        }

        // 2. Prepare description table
        let description = `Automated bug consolidated by ResultHub\n\n`;
        description += `*Category:* ${category}\n`;
        description += `*App:* ${app}\n`;
        description += `*Release:* ${release}\n\n`;
        description += `||Test Case||Scenario Name||Error Snapshot||\n`;

        failures.forEach(f => {
            const errorClean = (f.errorMessage || 'Unknown Error').substring(0, 300).replace(/\n/g, ' ');
            description += `|${f.testCaseId}|${f.testCaseName}|${errorClean}|\n`;
        });

        // 3. Create Bug in Jira
        const bug = await createJiraBug({
            summary: `[ResultHub] ${category} in ${app} - ${release}`,
            description,
            labels: [app, category.replace(/\s+/g, '_')],
            jiraEmail,
            jiraToken,
            jiraBaseUrl,
            projectKey,
            issueType,
            severity,
            foundIn
        });

        // 4. Background Tasks: Linking (Sequential to avoid race conditions)
        const executionKeys = new Set(failures.map(f => f.TestRunSummary?.jiraExecutionKey).filter(k => !!k));
        
        // Link to each Test Case (Repository)
        for (const f of failures) {
            try {
                await linkBugToTestCase(bug.key, f.testCaseId, jiraEmail, jiraToken, jiraBaseUrl);
            } catch (e) { console.error(`Link to TC ${f.testCaseId} failed`, e); }
        }

        // Link to each Test Execution (Xray Defects)
        for (const execKey of Array.from(executionKeys)) {
            try {
                await linkBugToXrayExecution(execKey as string, bug.key, xrayToken);
            } catch (e) { console.error(`Link to Exec ${execKey} failed`, e); }
        }

        // 5. Update Database
        await prisma.testCaseResult.updateMany({
            where: {
                id: { in: failures.map(f => f.id) }
            },
            data: {
                jiraBugKey: bug.key,
                jiraBugLink: bug.link,
                rcaStatus: 'Verified'
            }
        });

        return NextResponse.json({
            success: true,
            bugKey: bug.key,
            count: failures.length
        });

    } catch (error: any) {
        console.error('Create Jira Bug Error:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
