import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// Constants
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Status colors for Excel (RGB format)
const STATUS_COLORS: { [key: string]: string } = {
  passed: 'C6EFCE',   // Light green
  failed: 'FFC7CE',   // Light red
  pending: 'FFEB9C',  // Light yellow
  skipped: 'E2EFDA',  // Light gray
};

const moduleOptions = [
    'Creditgateway', 'Discovery', 'Bag', 'Checkout', 'E2E Trans', 'Giftcard',
    'Registry', 'Riskapp', 'Wishlist', 'OrderBatch', 'HnF', 'Home page',
    'MMoneyEarn', 'MMoneyRedeem', 'My Acc', 'Ordermods', 'PDP', 'Preference',
    'PricingandPromotion', 'PROS', 'Sitemon', 'Star Rewards', 'Wallet', 'Ordergroove'
];
const deviceOptions = ['Desktop', 'MEW', 'TAB'];

interface CucumberStep {
  keyword: string;
  line?: number;
  name: string;
  match?: {
    location: string;
  };
  result: {
    status: 'passed' | 'failed' | 'pending' | 'skipped';
    duration?: number;
    error_message?: string;
  };
  embeddings?: Array<{
    data: string;
    mime_type: string;
  }>;
}

interface CucumberTag {
  name: string;
  line?: number;
}

interface CucumberScenario {
  id: string;
  name: string;
  description: string;
  keyword: string;
  line: number;
  steps: CucumberStep[];
  tags?: CucumberTag[];
}

interface CucumberFeature {
  name: string;
  description: string;
  elements: CucumberScenario[];
  uri?: string;
}

interface ReportDataRow {
  Feature: string;
  Scenario: string;
  'Step Number': number;
  'Step Name': string;
  Keyword: string;
  Status: string;
  Duration: string;
  'Error Message': string;
  'Step Location': string;
}

interface TestSummary {
  totalTests: number;
  passed: number;
  failed: number;
  pending: number;
  skipped: number;
  totalDuration: string;
  p1: number;
  p2: number;
  p3: number;
  p4: number;
}

// Validate file size
function validateFileSize(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (100MB). Please use a smaller file.`
    );
  }
}

// Validate Cucumber JSON format
function validateCucumberFormat(data: unknown): asserts data is CucumberFeature[] {
  if (!Array.isArray(data)) {
    throw new Error('Invalid Cucumber JSON format: Expected an array of features');
  }

  if (data.length === 0) {
    throw new Error('No test features found in the report');
  }

  const firstFeature = data[0];
  if (
    typeof firstFeature !== 'object' ||
    !('name' in firstFeature) ||
    !('elements' in firstFeature)
  ) {
    throw new Error(
      'Invalid Cucumber JSON format: Features must have "name" and "elements" properties'
    );
  }

  if (!Array.isArray(firstFeature.elements)) {
    throw new Error(
      'Invalid Cucumber JSON format: Each feature must have an "elements" array'
    );
  }

  const firstScenario = firstFeature.elements[0];
  if (
    !firstScenario ||
    typeof firstScenario !== 'object' ||
    !('steps' in firstScenario)
  ) {
    throw new Error(
      'Invalid Cucumber JSON format: Each scenario must have a "steps" array'
    );
  }
}

// Check if scenario has @TEST_SRTM- tag
function hasTestSRTMTag(scenario: CucumberScenario): boolean {
  if (!scenario.tags || scenario.tags.length === 0) {
    return false;
  }
  return scenario.tags.some((tag) => tag.name.startsWith('@TEST_SRTM-'));
}

// Calculate test summary statistics based on scenarios (test cases) with @TEST_SRTM- tags
function calculateSummary(data: CucumberFeature[]): TestSummary {
    let totalTests = 0;
    let passed = 0;
    let failed = 0;
    const pending = 0;
    const skipped = 0;

    let totalDurationNs = 0;
    let p1 = 0;
    let p2 = 0;
    let p3 = 0;
    let p4 = 0;

    data.forEach((feature) => {
        feature.elements.forEach((scenario) => {
            // Only count scenarios with @TEST_SRTM- tag
            if (!hasTestSRTMTag(scenario)) {
                return;
            }

            totalTests++;
            let scenarioFailed = false;
            let scenarioDurationNs = 0;

            scenario.steps.forEach((step) => {
                scenarioDurationNs += step.result.duration || 0;
                if (step.result.status === 'failed') {
                    scenarioFailed = true;
                }
            });

            if (scenarioFailed) {
                failed++;
            } else {
                passed++;
            }
            totalDurationNs += scenarioDurationNs;

            if (scenario.tags) {
                scenario.tags.forEach(tag => {
                    if (tag.name === '@p1') p1++;
                    if (tag.name === '@p2') p2++;
                    if (tag.name === '@p3') p3++;
                    if (tag.name === '@p4') p4++;
                });
            }
        });
    });

    return {
        totalTests,
        passed,
        failed,
        pending,
        skipped,
        totalDuration: formatDuration(totalDurationNs),
        p1,
        p2,
        p3,
        p4,
    };
}


// Apply color formatting to cells
function applyCellColor(cell: XLSX.CellObject | undefined, color: string): void {
  if (!cell) return;
  cell.s = {
    fill: { fgColor: { rgb: color } },
  };
}

export async function processCucumberReport(
  jsonFile: File,
  release: string,
  module: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Validate file size
    try {
      validateFileSize(jsonFile);
    } catch (error) {
      reject(error);
      return;
    }

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const fileContent = event.target?.result as string;
        let cucumberData: unknown;

        try {
          cucumberData = JSON.parse(fileContent);
        } catch (e) {
          throw new Error(
            `Invalid JSON: ${e instanceof Error ? e.message : 'Failed to parse JSON'}`
          );
        }

        // Validate Cucumber format
        validateCucumberFormat(cucumberData as CucumberFeature[]);

        // Calculate summary
        const summary = calculateSummary(cucumberData as CucumberFeature[]);

        // Process the cucumber data
        const reportData: ReportDataRow[] = [];

        (cucumberData as CucumberFeature[]).forEach((feature) => {
          feature.elements.forEach((scenario) => {
            scenario.steps.forEach((step, stepIndex) => {
              const row: ReportDataRow = {
                Feature: feature.name,
                Scenario: scenario.name,
                'Step Number': stepIndex + 1,
                'Step Name': step.name,
                Keyword: step.keyword.trim(),
                Status: step.result.status,
                Duration: formatDuration(step.result.duration || 0),
                'Error Message': step.result.error_message || '',
                'Step Location': step.match?.location || 'N/A',
              };
              reportData.push(row);
            });
          });
        });

        // Create Excel workbook
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(reportData);
        const metadataSheet = XLSX.utils.aoa_to_sheet([
          ['Release', release],
          ['Module', module],
          ['Generated Date', new Date().toISOString()],
          ['', ''],
          ['Summary Statistics', ''],
          ['Total Tests', summary.totalTests],
          ['Passed', summary.passed],
          ['Failed', summary.failed],
          ['Pending', summary.pending],
          ['Skipped', summary.skipped],
          ['Total Duration', summary.totalDuration],
        ]);

        // Apply color formatting to test results based on status
        const startRow = 2; // Start after header row
        reportData.forEach((row, index) => {
          const cellRef = `F${index + startRow}`;
          const cell = worksheet[cellRef];
          if (cell) {
            applyCellColor(cell, STATUS_COLORS[row.Status] || 'FFFFFF');
          }
        });

        // Set column widths
        const columnWidths = [
          { wch: 25 }, // Feature
          { wch: 30 }, // Scenario
          { wch: 12 }, // Step Number
          { wch: 35 }, // Step Name
          { wch: 12 }, // Keyword
          { wch: 12 }, // Status
          { wch: 12 }, // Duration
          { wch: 40 }, // Error Message
          { wch: 35 }, // Step Location
        ];
        worksheet['!cols'] = columnWidths;

        XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Test Results');

        // Generate Excel file
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        resolve(blob);
      } catch (error) {
        reject(
          new Error(
            `Failed to process cucumber report: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(jsonFile);
  });
}

export async function processCucumberReportV2(
  jsonFile: File,
  release: string,
  module: string,
  channel: string,
  device: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      validateFileSize(jsonFile);
    } catch (error) {
      reject(error);
      return;
    }

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const fileContent = event.target?.result as string;
        let cucumberData: unknown;

        try {
          cucumberData = JSON.parse(fileContent);
        } catch (e) {
          throw new Error(
            `Invalid JSON: ${e instanceof Error ? e.message : 'Failed to parse JSON'}`
          );
        }

        validateCucumberFormat(cucumberData as CucumberFeature[]);
        const summary = calculateSummary(cucumberData as CucumberFeature[]);
        const passPercentage = summary.totalTests > 0 ? (summary.passed / summary.totalTests) * 100 : 0;

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.aoa_to_sheet([
          ['Release', 'Module', 'Channel', 'Device', 'Total Tests', 'Pass', 'Fail', 'Pass %', 'Total Duration', '#P1 Executed', '#P2 Executed', '#P3 Executed', '#P4 Executed'],
          [release, module, channel, device, summary.totalTests, summary.passed, summary.failed, passPercentage.toFixed(2) + '%', summary.totalDuration, summary.p1, summary.p2, summary.p3, summary.p4],
        ]);

        worksheet['!cols'] = [
          { wch: 20 },
          { wch: 20 },
          { wch: 15 },
          { wch: 15 },
          { wch: 15 },
          { wch: 10 },
          { wch: 10 },
          { wch: 15 },
          { wch: 20 },
          { wch: 15 },
          { wch: 15 },
          { wch: 15 },
          { wch: 15 },
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Execution Summary');
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        resolve(blob);
      } catch (error) {
        reject(
          new Error(
            `Failed to process cucumber report: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(jsonFile);
  });
}

export async function processBulkCucumberReportV2(
  zipFile: File,
  release: string
): Promise<{ blob: Blob, skippedFiles: string[] }> {
    const zip = await JSZip.loadAsync(zipFile);
    const jsonFiles = Object.values(zip.files).filter(f => !f.dir && f.name.endsWith('.json') && !f.name.startsWith('__MACOSX/'));
    if (jsonFiles.length === 0) { throw new Error('The ZIP file contains no valid .json files.'); }

    const summaryData = [];
    const skippedFiles: string[] = [];

    for (const jsonFile of jsonFiles) {
        const fileNameWithoutExt = jsonFile.name.toLowerCase().split('/').pop()?.replace('.json', '') || "";
        
        let channel = "";
        let moduleName = "";
        let device = "";

        // Try underscore format (channel_module_device) - matching your ZIP
        const underscoreParts = fileNameWithoutExt.split('_');
        if (underscoreParts.length === 3) {
            [channel, moduleName, device] = underscoreParts;
        } else {
            // Try hyphen format (module-channel-device)
            const hyphenParts = fileNameWithoutExt.split('-');
            if (hyphenParts.length === 3) {
                [moduleName, channel, device] = hyphenParts;
            } else {
                skippedFiles.push(jsonFile.name);
                continue;
            }
        }

        const fileContent = await jsonFile.async('string');
        const cucumberData = JSON.parse(fileContent) as CucumberFeature[];
        validateCucumberFormat(cucumberData);
        
        const summary = calculateSummary(cucumberData);
        const passPercentage = summary.totalTests > 0 ? (summary.passed / summary.totalTests) * 100 : 0;
        
        summaryData.push([
            release,
            moduleName,
            channel,
            device,
            summary.totalTests,
            summary.passed,
            summary.failed,
            passPercentage.toFixed(2) + '%',
            summary.totalDuration,
            summary.p1,
            summary.p2,
            summary.p3,
            summary.p4,
        ]);
    }
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Release', 'Module', 'Channel', 'Device', 'Total Tests', 'Pass', 'Fail', 'Pass %', 'Total Duration', '#P1 Executed', '#P2 Executed', '#P3 Executed', '#P4 Executed'],
      ...summaryData,
    ]);

    worksheet['!cols'] = [
      { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
      { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 15 },
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Execution Summary');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    return { blob, skippedFiles };
}


function formatDuration(nanoseconds: number): string {
  const milliseconds = nanoseconds / 1000000;
  if (milliseconds < 1000) {
    return `${Math.round(milliseconds)}ms`;
  }
  const seconds = milliseconds / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }
  const minutes = seconds / 60;
  return `${minutes.toFixed(2)}m`;
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
