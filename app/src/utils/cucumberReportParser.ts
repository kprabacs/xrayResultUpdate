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
    skippedCount: number;
};

const STRICT_JIRA_REGEX = /^@TEST_[A-Z][A-Z0-9]+-\d+$/i;

function getScenarioStatus(scenario: Scenario): 'passed' | 'failed' | 'skipped' {
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

function getScenarioFailureDetails(scenario: Scenario) {
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
    const features: Feature[] = Array.isArray(report) ? report : [report];
    
    let passCount = 0;
    let failCount = 0;
    let totalDurationNano = 0;
    let p1Executed = 0;
    let p2Executed = 0;
    let p3Executed = 0;
    let p4Executed = 0;
    let skippedCount = 0;

    const testCases: ParsedCucumberReport['testCases'] = [];
    const seenScenarioNames = new Set<string>();

    for (const feature of features) {
        if (!feature.elements) continue;

        for (const scenario of feature.elements) {
            if (!scenario.steps || !Array.isArray(scenario.steps)) {
                skippedCount++;
                continue;
            }

            const rawTags = scenario.tags ? scenario.tags.map(t => t.name) : [];
            
            // 1. Validation Logic (matching evaluate_report.py)
            const testCaseIdTag = rawTags.find(tag => STRICT_JIRA_REGEX.test(tag));
            
            // Skip if missing/malformed tag
            if (!testCaseIdTag) {
                skippedCount++;
                continue;
            }

            // Skip if duplicate name (and not a scenario outline)
            if (scenario.keyword !== 'Scenario Outline') {
                if (seenScenarioNames.has(scenario.name)) {
                    skippedCount++;
                    continue;
                }
                seenScenarioNames.add(scenario.name);
            }

            // 2. Processing Logic for Valid Scenarios
            const status = getScenarioStatus(scenario);
            const durationNano = scenario.steps.reduce((acc, step) => acc + (step.result.duration || 0), 0);
            
            totalDurationNano += durationNano;

            if (status === 'passed') {
                passCount++;
            } else if (status === 'failed') {
                failCount++;
            }

            const tagsLower = rawTags.map(t => t.toLowerCase());
            if (tagsLower.includes('@p1')) p1Executed++;
            if (tagsLower.includes('@p2')) p2Executed++;
            if (tagsLower.includes('@p3')) p3Executed++;
            if (tagsLower.includes('@p4')) p4Executed++;

            const testCaseId = testCaseIdTag.replace(/^@TEST_/i, '');

            const { errorMessage, stackTrace } = status === 'failed' 
                ? getScenarioFailureDetails(scenario) 
                : { errorMessage: undefined, stackTrace: undefined };

            testCases.push({
                testCaseId,
                testCaseName: scenario.name,
                status,
                duration: durationNano / 1e9, // convert to seconds
                errorMessage,
                stackTrace,
            });
        }
    }

    const totalTests = testCases.length;

    return {
        summary: {
            totalTests,
            passCount,
            failCount,
            passPercentage: totalTests > 0 ? (passCount / totalTests) * 100 : 0,
            totalDuration: totalDurationNano / 1e9, // convert to seconds
            p1Executed,
            p2Executed,
            p3Executed,
            p4Executed,
        },
        testCases,
        skippedCount,
    };
}
