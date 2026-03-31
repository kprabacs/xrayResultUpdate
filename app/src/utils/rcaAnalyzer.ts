import { spawn } from 'child_process';
import path from 'path';

export interface RcaFailure {
    file: string;
    feature: string;
    scenario: string;
    tags: string[];
    step: string;
    error: string;
    full_error: string;
    rca_category: string;
}

export interface RcaAnalysisResult {
    status: string;
    total_failures: number;
    category_distribution: Record<string, number>;
    failures: RcaFailure[];
}

/**
 * TypeScript implementation of the RCA categorization logic.
 * Used for efficient batch processing of existing database records.
 */
export function categorizeRcaSync(errorMsg: string | null): string {
    if (!errorMsg) return 'Unknown';
    
    const msg = errorMsg.toLowerCase().trim();

    const patterns: Record<string, (string | RegExp)[]> = {
        'Comparision Failed': [
            'expect(received).tocontain(expected)',
            'expect(received).tobe(expected)',
            'comparison failed'
        ],
        'Validation Failed': [
            'expect(received).tobetruthy()',
            'expect(locator).tohavetext',
            'expect(locator).tobechecked',
            'expect(locator).tobevisible',
            'validation failed',
            'assertion error'
        ],
        'Code Error': [
            'not a function',
            "typeerror: cannot read properties of null (reading 'tostring')",
            'referenceerror',
            'syntaxerror'
        ],
        'Locator Not Found': [
            'element not found',
            'element is not attached to the dom',
            'waiting for locator',
            'no element found for selector'
        ],
        'Logic Issue': [
            'typeerror: cannot read properties of undefined (reading',
            "cannot read properties of undefined (reading 'unicode') at escaperegexforselector",
            'logic error'
        ],
        'DDSE - Given Element Not Found': ['not found even after multiple retries & even with starts with approach.'],
        'Browser intermittently closed': [
            'target page, context or browser has been closed',
            'browser closed',
            'navigation failed because browser has disconnected'
        ],
        'MEW/TAB compatability issue': [
            'element is outside of the viewport',
            'overlapping element'
        ],
        'Locator Frame Issue': ['locators must belong to the same frame.'],
        'API Failure (HTML Response)': [
            'received html response, indicating a failure.',
            'api response not found for endpoint',
            'empty in the api response',
            'status code 500',
            'status code 404',
            'failed to fetch'
        ],
        'Validation Issue': [
            /expect.*pass.*receive.*fail/i, 
            /expect.*fail.*receive.*pass/i
        ],
        'Timeout Error': [
            'timeout exceeded',
            'timed out',
            'exceeded 30000ms'
        ],
        'Network Error': [
            'net::err_connection_refused',
            'net::err_name_not_resolved',
            'network error'
        ]
    };

    for (const [category, categoryPatterns] of Object.entries(patterns)) {
        for (const pattern of categoryPatterns) {
            if (pattern instanceof RegExp) {
                if (pattern.test(msg)) return category;
            } else if (msg.includes(pattern.toLowerCase())) {
                return category;
            }
        }
    }

    return 'Custom Error';
}

/**
 * Calls the Python analyze_rca.py script to categorize test failures.
 */
export async function analyzeRca(filePath: string): Promise<RcaAnalysisResult | null> {
    try {
        const pythonExecutable = path.resolve(process.cwd(), 'venv', 'bin', 'python');
        const scriptPath = path.resolve(process.cwd(), 'analyze_rca.py');

        const pythonResult = await new Promise<string>((resolve, reject) => {
            const pythonProcess = spawn(pythonExecutable, [scriptPath, filePath]);
            
            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error('RCA Analysis failed:', stderr);
                    return reject(new Error(`Python script failed with code ${code}`));
                }
                resolve(stdout);
            });

            pythonProcess.on('error', (err) => {
                reject(err);
            });
        });

        if (!pythonResult.trim()) return null;
        return JSON.parse(pythonResult);

    } catch (error) {
        console.error('Error in analyzeRca:', error);
        return null;
    }
}
