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
    
    const filteredReport: CucumberFeature[] = cucumberReport.map(feature => {
        const filteredElements = feature.elements.filter(scenario => {
            let testKey: string | undefined;
            const hasValidTag = scenario.tags?.some(tag => {
                const match = tag.name.match(JIRA_TEST_KEY_REGEX);
                if (match) {
                    testKey = match[1].toUpperCase();
                    return true;
                }
                return false;
            });

            const isExcluded = testKey ? excludeSet.has(testKey) : false;

            if (!hasValidTag || isExcluded) {
                skipped.push(scenario.name);
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
  const tests: XrayTest[] = [];
  const skipped: string[] = [];
  const excludeSet = new Set(keysToExclude.map(k => k.toUpperCase()));

  cucumberReport.forEach(feature => {
    feature.elements.forEach(scenario => {
      let testKey: string | undefined;
      if (scenario.tags) {
        for (const tag of scenario.tags) {
          const match = tag.name.match(JIRA_TEST_KEY_REGEX);
          if (match) {
            testKey = match[1].toUpperCase();
            break; 
          }
        }
      }

      if (testKey && !excludeSet.has(testKey)) {
        let status: 'PASSED' | 'FAILED' = 'PASSED';
        scenario.steps.forEach(step => {
          if (step.result.status !== 'passed') {
            status = 'FAILED';
          }
        });

        tests.push({
          testKey: testKey,
          status: status,
          comment: `Scenario '${scenario.name}' result: ${status}`
        });
      } else {
          skipped.push(scenario.name);
      }
    });
  });

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


// --- Main API Route Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cucumberReport, xrayReport, token, updateType, testExecKey, testPlanKey, summary } = body;

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

    let excludedKeys: string[] = [];
    let allSkippedScenarios: string[] = [];
    let response: Response | null = null;
    let responseData: { error?: string, key?: string, testExecutionKey?: string, skipped?: string[] } | null = null;

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
            const infoPart = {
                "fields": {
                    "project": { "key": projectKey },
                    "summary": summary,
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

        responseData = await response.json();

        if (response && response.ok) {
            return NextResponse.json({ ...responseData, skipped: allSkippedScenarios }, { status: 200 });
        }

        // Check for specific Xray error: issues not being of type Test
        const errorMsg = responseData?.error || "";
        if (errorMsg.includes("not of type Test")) {
            const foundKeys = parseKeysFromError(errorMsg);
            if (foundKeys.length > 0) {
                console.log(`Detected non-Test keys: ${foundKeys.join(', ')}. Retrying...`);
                excludedKeys = Array.from(new Set([...excludedKeys, ...foundKeys]));
                continue; // Retry with filtered keys
            }
        }

        // If it's any other error
        return NextResponse.json({ error: errorMsg, skipped: allSkippedScenarios }, { status: response?.status || 500 });
    }

    return NextResponse.json({ 
        error: responseData?.error || "Maximum retry attempts reached while filtering non-Test issues.",
        skipped: allSkippedScenarios 
    }, { status: response?.status || 500 });

  } catch (error) {
    console.error('Internal server error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
