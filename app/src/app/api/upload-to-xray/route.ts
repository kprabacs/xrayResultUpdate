import { NextResponse, NextRequest } from 'next/server';

// --- Type definitions moved from reportProcessor.ts ---

interface CucumberStep {
  result: {
    status: 'passed' | 'failed' | 'pending' | 'skipped';
  };
}

interface CucumberTag {
  name: string;
}

interface CucumberScenario {
  name:string;
  steps: CucumberStep[];
  tags?: CucumberTag[];
}

interface CucumberFeature {
  name: string;
  elements: CucumberScenario[];
}

interface XrayTest {
  testKey: string;
  status: 'PASSED' | 'FAILED';
  comment: string;
}

interface XrayReport {
  testExecutionKey?: string;
  info?: {
    testPlanKey?: string;
  };
  tests: XrayTest[];
}

// --- Helper to identify valid test keys ---
const JIRA_TEST_KEY_REGEX = /@TEST_([A-Z][A-Z0-9]+-\d+)/i;

// --- Filtering logic for the 'create' case (Multipart) ---

function filterCucumberReport(cucumberReport: CucumberFeature[], keysToExclude: string[] = []): { filteredReport: CucumberFeature[], skipped: string[] } {
    const skipped: string[] = [];
    const excludeSet = new Set(keysToExclude.map(k => k.toUpperCase()));
    
    if (!Array.isArray(cucumberReport)) {
        throw new Error('Cucumber report is not an array of features.');
    }

    const filteredReport: CucumberFeature[] = cucumberReport.map(feature => {
        if (!feature || !Array.isArray(feature.elements)) {
            return { ...feature, elements: [] };
        }

        const filteredElements = feature.elements.filter(scenario => {
            if (!scenario) return false;
            
            let testKey: string | undefined;
            const hasValidTag = scenario.tags?.some(tag => {
                if (!tag || !tag.name) return false;
                const match = tag.name.match(JIRA_TEST_KEY_REGEX);
                if (match) {
                    testKey = match[1].toUpperCase();
                    return true;
                }
                return false;
            });

            const isExcluded = testKey ? excludeSet.has(testKey) : false;

            if (!hasValidTag || isExcluded) {
                skipped.push(scenario.name || 'Unnamed Scenario');
                return false;
            }
            return true;
        });
        return { ...feature, elements: filteredElements };
    }).filter(feature => feature.elements.length > 0);

    return { filteredReport, skipped };
}

// --- Conversion logic for the 'update' case ---

function convertCucumberToXray(
  cucumberReport: CucumberFeature[],
  testExecKey?: string,
  testPlanKey?: string,
  keysToExclude: string[] = []
): { report: XrayReport, skipped: string[] } {
  const skipped: string[] = [];
  const excludeSet = new Set(keysToExclude.map(k => k.toUpperCase()));

  if (!Array.isArray(cucumberReport)) {
      throw new Error('Cucumber report is not an array of features.');
  }

  // Use a Map to aggregate by testKey
  const aggregatedTests = new Map<string, {
    testKey: string;
    status: 'PASSED' | 'FAILED';
    scenarios: string[];
  }>();

  cucumberReport.forEach(feature => {
    if (!feature || !Array.isArray(feature.elements)) return;

    feature.elements.forEach(scenario => {
      if (!scenario) return;

      let testKey: string | undefined;
      if (scenario.tags) {
        for (const tag of scenario.tags) {
          if (!tag || !tag.name) continue;
          const match = tag.name.match(JIRA_TEST_KEY_REGEX);
          if (match) {
            testKey = match[1].toUpperCase();
            break; 
          }
        }
      }

      if (testKey && !excludeSet.has(testKey)) {
        let currentStatus: 'PASSED' | 'FAILED' = 'PASSED';
        if (Array.isArray(scenario.steps)) {
            scenario.steps.forEach(step => {
              if (step?.result?.status !== 'passed') {
                currentStatus = 'FAILED';
              }
            });
        } else {
            currentStatus = 'FAILED';
        }

        if (aggregatedTests.has(testKey)) {
            const existing = aggregatedTests.get(testKey)!;
            if (currentStatus === 'FAILED') existing.status = 'FAILED';
            existing.scenarios.push(scenario.name || 'Unnamed');
        } else {
            aggregatedTests.set(testKey, {
                testKey,
                status: currentStatus,
                scenarios: [scenario.name || 'Unnamed']
            });
        }
      } else {
          skipped.push(scenario.name || 'Unnamed Scenario');
      }
    });
  });

  const tests: XrayTest[] = Array.from(aggregatedTests.values()).map(agg => ({
      testKey: agg.testKey,
      status: agg.status,
      comment: `Aggregated result for scenarios: ${agg.scenarios.join(', ')}`
  }));

  const xrayReport: XrayReport = {
    tests: tests,
  };

  if (testExecKey) {
    xrayReport.testExecutionKey = testExecKey;
  }

  if (testPlanKey) {
    xrayReport.info = {
        testPlanKey: testPlanKey
    };
  }

  return { report: xrayReport, skipped };
}

/**
 * Parses keys from Xray error message: "Issues with keys SRTM-1,SRTM-2 are not of type Test."
 */
function parseKeysFromError(errorMsg: string): string[] {
    const match = errorMsg.match(/Issues with keys (.*) are not of type Test/i);
    if (match && match[1]) {
        return match[1].split(',').map(k => k.trim());
    }
    return [];
}

/**
 * Safely parses JSON response, handling HTML error pages.
 */
async function safeParseJson(response: Response) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return await response.json();
    } else {
        const text = await response.text();
        console.error(`Received non-JSON response (${response.status}):`, text.substring(0, 500));
        return { 
            error: `Xray returned ${response.status} ${response.statusText}`, 
            details: text.substring(0, 200) 
        };
    }
}


/**
 * Removes 'embeddings' (screenshots/data) from cucumber report steps to reduce payload size.
 * Xray import often fails with 413 if these are included.
 */
function stripEmbeddings(report: CucumberFeature[]): CucumberFeature[] {
    if (!Array.isArray(report)) return report;
    return report.map(feature => ({
        ...feature,
        elements: (feature.elements || []).map(scenario => ({
            ...scenario,
            steps: (scenario.steps || []).map(step => {
                if (step.result && (step as any).embeddings) {
                    const { embeddings, ...stepWithoutEmbeddings } = step as any;
                    return stepWithoutEmbeddings;
                }
                return step;
            })
        }))
    }));
}

// --- Main API Route Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { cucumberReport, xrayReport, token, updateType, testExecKey, testPlanKey, summary } = body;

    // 1. Validation
    if (!cucumberReport && !xrayReport) {
      return NextResponse.json({ error: 'No execution results were provided.' }, { status: 400 });
    }
    if (!token) {
      return NextResponse.json({ error: 'Jira API token is missing.' }, { status: 401 });
    }
    if (!updateType) {
      return NextResponse.json({ error: 'Update type is missing.' }, { status: 400 });
    }

    // 2. Pre-process Cucumber Report (Strip heavy data)
    if (cucumberReport) {
        cucumberReport = stripEmbeddings(cucumberReport);
    }

    let excludedKeys: string[] = [];
    let allSkippedScenarios: string[] = [];
    let response: Response | null = null;
    let responseData: any = null;

    // Max 3 retries to prevent infinite loops
    for (let attempt = 0; attempt < 3; attempt++) {
        if (updateType === 'create') {
            if (!testPlanKey || !testPlanKey.includes('-')) {
                return NextResponse.json({ error: 'A valid Test Plan Key (e.g., PROJ-123) is required to derive the Project Key.' }, { status: 400 });
            }

            const { filteredReport, skipped } = filterCucumberReport(cucumberReport, excludedKeys);
            allSkippedScenarios = Array.from(new Set([...allSkippedScenarios, ...skipped]));

            if (filteredReport.length === 0) {
                return NextResponse.json({ 
                    error: 'No valid test cases remained after filtering non-Test issues.',
                    skipped: allSkippedScenarios 
                }, { status: 400 });
            }

            const xrayApiUrl = 'https://xray.cloud.getxray.app/api/v2/import/execution/cucumber/multipart';
            const formData = new FormData();
            const projectKey = testPlanKey.split('-')[0];
            
            // Auto-generate summary if missing
            let finalSummary = summary;
            if (!finalSummary && filteredReport.length > 0) {
                finalSummary = `Execution: ${filteredReport[0].name || 'Automated Tests'}`;
                if (filteredReport.length > 1) finalSummary += ` (+${filteredReport.length - 1} more)`;
            }
            if (!finalSummary) finalSummary = 'Automated Test Execution';

            const infoPart = {
                "fields": {
                    "project": { "key": projectKey },
                    "summary": finalSummary,
                    "issuetype": { "name": "Test Execution" }
                },
                "xrayFields": { "testPlanKey": testPlanKey }
            };
            formData.append('info', new Blob([JSON.stringify(infoPart)], { type: 'application/json' }), 'info.json');
            formData.append('results', new Blob([JSON.stringify(filteredReport)], { type: 'application/json' }), 'results.json');

            response = await fetch(xrayApiUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

        } else { // 'update'
            const xrayApiUrl = 'https://xray.cloud.getxray.app/api/v2/import/execution';
            let reportToSend: XrayReport;

            if (xrayReport) {
                reportToSend = { ...xrayReport };
                if (excludedKeys.length > 0) {
                    const excludeSet = new Set(excludedKeys.map(k => k.toUpperCase()));
                    reportToSend.tests = reportToSend.tests.filter((t: XrayTest) => !excludeSet.has(t.testKey.toUpperCase()));
                }
                if (testExecKey) reportToSend.testExecutionKey = testExecKey;
                if (testPlanKey) {
                    if (!reportToSend.info) reportToSend.info = {};
                    reportToSend.info.testPlanKey = testPlanKey;
                }
            } else {
                const { report, skipped } = convertCucumberToXray(cucumberReport, testExecKey, testPlanKey, excludedKeys);
                reportToSend = report;
                allSkippedScenarios = Array.from(new Set([...allSkippedScenarios, ...skipped]));
            }
            
            if (reportToSend.tests.length === 0) {
                 return NextResponse.json({ 
                     error: 'No valid test cases remained to update after filtering non-Test issues.',
                     skipped: allSkippedScenarios 
                 }, { status: 400 });
            }

            response = await fetch(xrayApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(reportToSend),
            });
        }

        if (!response) {
            throw new Error('No response received from Xray API.');
        }

        responseData = await safeParseJson(response);

        if (response.ok) {
            return NextResponse.json({ ...responseData, skipped: allSkippedScenarios }, { status: 200 });
        }

        // Check for specific Xray error: issues not being of type Test
        const errorMsg = responseData?.error || responseData?.message || "";
        if (errorMsg.includes("not of type Test")) {
            const foundKeys = parseKeysFromError(errorMsg);
            if (foundKeys.length > 0) {
                console.log(`Detected non-Test keys: ${foundKeys.join(', ')}. Retrying...`);
                excludedKeys = Array.from(new Set([...excludedKeys, ...foundKeys]));
                continue; // Retry with filtered keys
            }
        }

        // If it's any other error
        return NextResponse.json({ error: errorMsg, details: responseData?.details, skipped: allSkippedScenarios }, { status: response.status });
    }

    return NextResponse.json({ 
        error: responseData?.error || "Maximum retry attempts reached while filtering non-Test issues.",
        skipped: allSkippedScenarios 
    }, { status: response?.status || 500 });

  } catch (error) {
    console.error('Internal server error in upload-to-xray:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown internal error';
    return NextResponse.json({ 
        error: `Xray API Error: ${errorMessage}`,
        details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
