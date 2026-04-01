/**
 * Jira API Client Utility
 * Handles issue creation and Xray linking.
 */

interface CreateBugParams {
    summary: string;
    description: string;
    labels?: string[];
    priority?: string;
    jiraEmail: string;
    jiraToken: string;
    jiraBaseUrl: string;
    projectKey: string;
    issueType: string;
    severity: string;
    foundIn: string;
}

/**
 * Creates a Bug in Jira
 */
export async function createJiraBug({ 
    summary, 
    description, 
    labels = [], 
    priority = 'Medium',
    jiraEmail,
    jiraToken,
    jiraBaseUrl,
    projectKey,
    issueType,
    severity,
    foundIn
}: CreateBugParams) {
    
    if (!jiraBaseUrl || !jiraToken || !jiraEmail || !projectKey || !issueType) {
        throw new Error('Jira configuration missing in request.');
    }

    const url = `${jiraBaseUrl.replace(/\/$/, '')}/rest/api/2/issue`;
    const auth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');

    const body = {
        fields: {
            project: { key: projectKey },
            summary,
            description,
            issuetype: { name: issueType },
            priority: { name: priority },
            labels: [...labels, 'ResultHub'],
            // Mandatory Custom Fields for this project
            "customfield_10033": { "value": severity }, // Severity
            "customfield_10042": { "value": foundIn }   // Found In
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();
    if (!response.ok) {
        console.error('Jira Create Error:', data);
        throw new Error(data.errors ? JSON.stringify(data.errors) : (data.errorMessages ? data.errorMessages[0] : 'Failed to create Jira bug'));
    }

    return {
        key: data.key,
        id: data.id,
        link: `${jiraBaseUrl.replace(/\/$/, '')}/browse/${data.key}`
    };
}

/**
 * Links a Bug to a Test Case (Relates link)
 */
export async function linkBugToTestCase(bugKey: string, testCaseKey: string, jiraEmail: string, jiraToken: string, jiraBaseUrl: string) {
    const url = `${jiraBaseUrl.replace(/\/$/, '')}/rest/api/2/issueLink`;
    const auth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');

    const body = {
        type: { name: 'Relates' },
        inwardIssue: { key: bugKey },
        outwardIssue: { key: testCaseKey }
    };

    await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
}

/**
 * Links a Bug to an Xray Test Execution (Defect column)
 */
export async function linkBugToXrayExecution(executionKey: string, bugKey: string, xrayToken: string) {
    // Xray uses its own token and endpoint
    const url = `https://xray.cloud.getxray.app/api/v2/import/execution/defects`;
    
    const body = {
        testExecutionKey: executionKey,
        defects: [bugKey]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${xrayToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.text();
        console.error('Xray Linking Error:', err);
    }
}
