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

// --- Conversion logic for the 'update' case ---

function convertCucumberToXray(
  cucumberReport: CucumberFeature[],
  testExecKey?: string,
  testPlanKey?: string
): XrayReport {
  const tests: XrayTest[] = [];

  cucumberReport.forEach(feature => {
    feature.elements.forEach(scenario => {
      let testKey: string | undefined;
      if (scenario.tags) {
        const srtmTag = scenario.tags.find(tag => tag.name.includes('SRTM-'));
        if (srtmTag) {
          const keyIndex = srtmTag.name.indexOf('SRTM-');
          if (keyIndex !== -1) {
            testKey = srtmTag.name.substring(keyIndex);
          }
        }
      }

      if (testKey) {
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

  return xrayReport;
}


// --- Main API Route Handler ---

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cucumberReport, token, updateType, testExecKey, testPlanKey, summary } = body;

    // 1. Validation
    if (!cucumberReport) {
      return NextResponse.json({ error: 'No execution results were provided.' }, { status: 400 });
    }
    if (!token) {
      return NextResponse.json({ error: 'Jira API token is missing.' }, { status: 401 });
    }
    if (!updateType) {
      return NextResponse.json({ error: 'Update type is missing.' }, { status: 400 });
    }

    let response: Response;

    // 2. Determine API call type and execute
    if (updateType === 'create') {
        if (!testPlanKey || !testPlanKey.includes('-')) {
            return NextResponse.json({ error: 'A valid Test Plan Key (e.g., PROJ-123) is required to derive the Project Key.' }, { status: 400 });
        }

        const xrayApiUrl = 'https://xray.cloud.getxray.app/api/v2/import/execution/cucumber/multipart';
        
        const formData = new FormData();
        
        const projectKey = testPlanKey.split('-')[0];
        const infoPart = {
            "fields": {
                "project": {
                    "key": projectKey
                },
                "summary": summary,
                "issuetype": {
                    "name": "Test Execution"
                }
            },
            "xrayFields": {
                "testPlanKey": testPlanKey
            }
        };
        formData.append('info', new Blob([JSON.stringify(infoPart)], { type: 'application/json' }), 'info.json');
        
        formData.append('results', new Blob([JSON.stringify(cucumberReport)], { type: 'application/json' }), 'results.json');

        response = await fetch(xrayApiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            body: formData,
        });

    } else { // 'update'
        const xrayApiUrl = 'https://xray.cloud.getxray.app/api/v2/import/execution';
        const reportToSend = convertCucumberToXray(cucumberReport, testExecKey, testPlanKey);
        
        response = await fetch(xrayApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(reportToSend),
        });
    }

    // 3. Handle the response from Xray
    const responseData = await response.json();

    if (!response.ok) {
      const errorMessage = responseData.error || `An unknown error occurred while communicating with Xray. Status: ${response.status}`;
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    // 4. Send the successful response from Xray back to the client
    return NextResponse.json(responseData, { status: 200 });

  } catch (error) {
    console.error('Internal server error:', error);
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
