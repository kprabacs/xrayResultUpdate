/* eslint-disable @typescript-eslint/no-explicit-any */
type Scenario = {
    name: string;
    keyword?: string;
    tags: { name: string }[];
    steps: {
        result: {
            status: 'passed' | 'failed' | 'skipped' | 'undefined';
            duration: number;
            error_message?: string;
        };
    }[];
};

type Feature = {
    elements: Scenario[];
};

export type ParsedCucumberReport = {
    summary: {
        totalTests: number;
        passCount: number;
        failCount: number;
        passPercentage: number;
        totalDuration: number; // in seconds
        p1Executed: number;
        p2Executed: number;
        p3Executed: number;
        p4Executed: number;
    };
    testCases: {
        testCaseId?: string;
        testCaseName: string;
        status: 'passed' | 'failed' | 'skipped';
        duration: number; // in seconds
        errorMessage?: string;
        stackTrace?: string;
    }[];
    metadata?: {
        applicationName?: string;
        deviceType?: string;
        moduleName?: string;
        featureName?: string;
    };
    skippedCount: number;
};

const STRICT_JIRA_REGEX = /^@TEST_[A-Z][A-Z0-9]+-\d+$/i;

function extractMetadataFromId(id: string) {
    if (!id) return null;
    
    const firstHyphen = id.indexOf('-');
    const secondHyphen = id.indexOf('-', firstHyphen + 1);

    // Standard Pattern: app-device-module--regression...
    if (firstHyphen !== -1 && secondHyphen !== -1) {
        const applicationName = id.substring(0, firstHyphen).trim();
        const deviceType = id.substring(firstHyphen + 1, secondHyphen).trim();
        
        let remainder = id.substring(secondHyphen + 1);
        
        // Stop at any of these boundaries to isolate the Module Name
        // Added 'verifying' as it often starts the descriptive part of the ID
        const boundaries = ["---", "--", "regression", "verifying", ";", " - "];
        let endPos = remainder.length;
        
        for (const b of boundaries) {
            const pos = remainder.toLowerCase().indexOf(b);
            if (pos !== -1 && pos < endPos) {
                endPos = pos;
            }
        }
        
        let rawModule = remainder.substring(0, endPos).trim();
        // Remove trailing hyphens
        rawModule = rawModule.replace(/-+$/, '');
        // Replace inner hyphens with spaces for readability
        const moduleName = rawModule.replace(/-/g, ' ').trim();

        if (applicationName && deviceType && moduleName) {
            return { applicationName, deviceType, moduleName };
        }
    }

    // Fallback: If it doesn't match the hyphenated pattern, try to take the first word
    // This handles cases like "ccas verifying chat registration form..." -> "ccas"
    const firstWord = id.split(/[\s-]/)[0].trim();
    if (firstWord && firstWord.length > 1) {
        return {
            applicationName: firstWord,
            deviceType: 'unknown',
            moduleName: firstWord
        };
    }

    return null;
}

function getScenarioStatus(scenario: any): 'passed' | 'failed' | 'skipped' {
    let hasFailure = false;
    let allSkipped = true;
    for (const step of scenario.steps) {
        if (step.result.status === 'failed') {
            hasFailure = true;
            break;
        }
        if (step.result.status !== 'skipped' && step.result.status !== 'undefined') {
            allSkipped = false;
        }
    }

    if (hasFailure) return 'failed';
    if (allSkipped) return 'skipped';
    return 'passed';
}

function getScenarioFailureDetails(scenario: any) {
    for (const step of scenario.steps) {
        if (step.result.status === 'failed' && step.result.error_message) {
            const fullError = step.result.error_message;
            const firstLine = fullError.split('\n')[0];
            return {
                errorMessage: firstLine,
                stackTrace: fullError
            };
        }
    }
    return { errorMessage: undefined, stackTrace: undefined };
}

export function parseCucumberReport(report: any): ParsedCucumberReport {
    const features: any[] = Array.isArray(report) ? report : [report];
    
    let totalDurationNano = 0;
    let extractedMetadata: ParsedCucumberReport['metadata'] = undefined;

    // Use a Map to aggregate results by testCaseId (Jira Key)
    const aggregatedTestCases = new Map<string, {
        testCaseId: string;
        testCaseName: string;
        status: 'passed' | 'failed' | 'skipped';
        durationNano: number;
        iterations: { status: string; errorMessage?: string; stackTrace?: string; name?: string }[];
        p1: boolean;
        p2: boolean;
        p3: boolean;
        p4: boolean;
    }>();

    let skippedCount = 0;

    for (const feature of features) {
        if (!feature.elements) continue;

        if (!extractedMetadata && feature.id) {
            extractedMetadata = extractMetadataFromId(feature.id) || undefined;
        }
        
        if (feature.name && (!extractedMetadata || !extractedMetadata.featureName)) {
            extractedMetadata = { ...(extractedMetadata || {}), featureName: feature.name };
        }

        for (const scenario of feature.elements) {
            if (!scenario.steps || !Array.isArray(scenario.steps)) {
                skippedCount++;
                continue;
            }

            const rawTags = scenario.tags ? scenario.tags.map((t: any) => t.name) : [];
            const testCaseIdTag = rawTags.find(tag => STRICT_JIRA_REGEX.test(tag));
            
            if (!testCaseIdTag) {
                skippedCount++;
                continue;
            }

            const testCaseId = testCaseIdTag.replace(/^@TEST_/i, '').toUpperCase();
            const status = getScenarioStatus(scenario);
            const durationNano = scenario.steps.reduce((acc, step) => acc + (step.result.duration || 0), 0);
            const { errorMessage, stackTrace } = status === 'failed' 
                ? getScenarioFailureDetails(scenario) 
                : { errorMessage: undefined, stackTrace: undefined };

            const tagsLower = rawTags.map(t => t.toLowerCase());
            const p1 = tagsLower.includes('@p1');
            const p2 = tagsLower.includes('@p2');
            const p3 = tagsLower.includes('@p3');
            const p4 = tagsLower.includes('@p4');

            if (aggregatedTestCases.has(testCaseId)) {
                const existing = aggregatedTestCases.get(testCaseId)!;
                // If any iteration fails, the whole test fails
                if (status === 'failed') existing.status = 'failed';
                else if (status === 'passed' && existing.status === 'skipped') existing.status = 'passed';
                
                existing.durationNano += durationNano;
                existing.iterations.push({ status, errorMessage, stackTrace, name: scenario.name });
                if (p1) existing.p1 = true;
                if (p2) existing.p2 = true;
                if (p3) existing.p3 = true;
                if (p4) existing.p4 = true;
            } else {
                aggregatedTestCases.set(testCaseId, {
                    testCaseId,
                    testCaseName: scenario.name,
                    status,
                    durationNano,
                    iterations: [{ status, errorMessage, stackTrace, name: scenario.name }],
                    p1, p2, p3, p4
                });
            }
        }
    }

    const testCases: ParsedCucumberReport['testCases'] = [];
    let passCount = 0;
    let failCount = 0;
    let p1Executed = 0;
    let p2Executed = 0;
    let p3Executed = 0;
    let p4Executed = 0;

    aggregatedTestCases.forEach((agg) => {
        totalDurationNano += agg.durationNano;
        if (agg.status === 'passed') passCount++;
        else if (agg.status === 'failed') failCount++;

        if (agg.p1) p1Executed++;
        if (agg.p2) p2Executed++;
        if (agg.p3) p3Executed++;
        if (agg.p4) p4Executed++;

        // Consolidate iteration details into stackTrace for visibility
        let consolidatedError = undefined;
        let consolidatedStack = undefined;

        if (agg.iterations.length > 1) {
            consolidatedStack = `Total Iterations: ${agg.iterations.length}\n`;
            agg.iterations.forEach((it, idx) => {
                consolidatedStack += `\n[Iteration ${idx + 1}] Result: ${it.status.toUpperCase()}`;
                if (it.errorMessage) {
                    consolidatedStack += `\nError: ${it.errorMessage}`;
                    if (!consolidatedError) consolidatedError = `Iteration ${idx + 1} failed: ${it.errorMessage}`;
                }
            });
        } else {
            consolidatedError = agg.iterations[0].errorMessage;
            consolidatedStack = agg.iterations[0].stackTrace;
        }

        testCases.push({
            testCaseId: agg.testCaseId,
            testCaseName: agg.testCaseName,
            status: agg.status,
            duration: agg.durationNano / 1e9,
            errorMessage: consolidatedError,
            stackTrace: consolidatedStack,
        });
    });

    const totalTests = testCases.length;

    return {
        summary: {
            totalTests,
            passCount,
            failCount,
            passPercentage: totalTests > 0 ? (passCount / totalTests) * 100 : 0,
            totalDuration: totalDurationNano / 1e9,
            p1Executed,
            p2Executed,
            p3Executed,
            p4Executed,
        },
        testCases,
        metadata: extractedMetadata,
        skippedCount,
    };
}
