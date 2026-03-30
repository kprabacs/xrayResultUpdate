const fs = require('fs');
const path = require('path');

const RCA_CATEGORIES = {
  'Comparision Failed': ['expect(received).tocontain(expected)'],
  'Validation Failed': ['expect(received).tobetruthy()'],
  'Code Error': [
    'not a function',
    "typeerror: cannot read properties of null (reading 'tostring')"
  ],
  'Locator Not Found': ['element not found'],
  'Logic Issue': [
    'typeerror: cannot read properties of undefined (reading',
    "cannot read properties of undefined (reading 'unicode') at escaperegexforselector"
  ],
  'DDSE - Given Element Not Found': ['not found even after multiple retries & even with starts with approach.'],
  'Browser intermittently closed': ['target page, context or browser has been closed'],
  'MEW/TAB compatability issue': ['element is outside of the viewport'],
  'Locator of the element you are interacting inside an iFrame is stored as Array in Element js file, Change it to string type with single locator value.': ['locators must belong to the same frame.'],
  'Add product to List via API failed. API response returned content type text/html.': ['received html response, indicating a failure.'],
  'Validation Issue': [/expect.*pass.*receive.*fail/, /expect.*fail.*receive.*pass/]
};

const categorizeRCA = (error) => {
  if (!error) return 'Unknown';
  const msg = error.toLowerCase().trim();

  for (const [category, patterns] of Object.entries(RCA_CATEGORIES)) {
    for (const pattern of patterns) {
      const isRegex = pattern instanceof RegExp;
      if ((isRegex && pattern.test(msg)) || (!isRegex && typeof pattern === 'string' && msg.includes(pattern))) {
        return category;
      }
    }
  }
  return 'Custom Error';
};

const generateHTML = (features, summaryData, rcaData, fileCount) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Consolidated Playwright RCA Report</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f6f8;
    }
    header {
      position: sticky;
      top: 0;
      background-color: #2c3e50;
      color: white;
      padding: 10px 20px;
      text-align: center;
      z-index: 1000;
      font-size: 1.2rem;
    }
    main {
      padding: 10px 20px;
      max-width: 1200px;
      margin: auto;
    }
    h2, h3 {
      color: #2c3e50;
      margin-bottom: 10px;
      font-size: 1.1rem;
    }
    .table-container {
      background-color: white;
      border-radius: 6px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      padding: 15px;
      margin-bottom: 20px;
    }
    .scrollable-table {
      max-height: 300px;
      overflow-y: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      word-wrap: break-word;
      font-size: 0.9rem;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: #ecf0f1;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    th:first-child, td:first-child {
      width: 40px;
    }
    pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 0;
    }
    .Code\\ Error { background-color: #ffe0e0; }
    .Locator\\ Issue { background-color: #fff0cc; }
    .Timeout\\ Issue { background-color: #e0f7ff; }
    .Validation\\ Issue { background-color: #e0ffe0; }
    .Logic\\ Issue { background-color: #fce4ec; }
    .Unknown { background-color: #f9f9f9; }
    .export-button {
      margin-bottom: 10px;
      padding: 6px 12px;
      font-size: 0.9rem;
      background-color: #3498db;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .file-info {
      background-color: #e8f4fd;
      border-left: 4px solid #3498db;
      padding: 10px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .file-path {
      font-family: monospace;
      background-color: #f8f9fa;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 0.85rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: white;
      padding: 15px;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-number {
      font-size: 2rem;
      font-weight: bold;
      color: #2c3e50;
    }
    .stat-label {
      color: #7f8c8d;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
<header>Consolidated Playwright Cucumber RCA Report</header>
<main>
  <div class="file-info">
    <strong>📁 Files Processed:</strong> ${fileCount} cucumber report files from reports folder and subdirectories
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-number">${summaryData.reduce((sum, item) => sum + item.total, 0)}</div>
      <div class="stat-label">Total Scenarios</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${summaryData.reduce((sum, item) => sum + item.passed, 0)}</div>
      <div class="stat-label">Passed</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${summaryData.reduce((sum, item) => sum + item.failed, 0)}</div>
      <div class="stat-label">Failed</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${((summaryData.reduce((sum, item) => sum + item.passed, 0) / summaryData.reduce((sum, item) => sum + item.total, 0)) * 100).toFixed(1)}%</div>
      <div class="stat-label">Pass Rate</div>
    </div>
  </div>

  <div class="table-container">
    <h3>Summary by Feature & File</h3>
    <button class="export-button" onclick="exportTableToCSV('summaryTable', 'consolidated_summary.csv')">Export Summary</button>
    <div class="scrollable-table">
      <table id="summaryTable">
        <thead>
          <tr>
            <th style="width: 50px;">S.No</th>
            <th>File Path</th>
            <th>Feature</th>
            <th>Module</th>
            <th>Device Type</th>
            <th>Brand</th>
            <th>Total Scenarios</th>
            <th>Passed</th>
            <th>Failed</th>
            <th>Pass %</th>
          </tr>
        </thead>
        <tbody>
          ${summaryData.map((item, i) => {
            const module = item.featureName;
            
            let deviceType = 'Desktop';
            if (item.featureName.toLowerCase().includes('mew')) {
              deviceType = 'MEW';
            } else if (item.featureName.toLowerCase().includes('tablet')) {
              deviceType = 'TAB';
            }

            let brand = '';
            if (item.featureName.toLowerCase().includes('mcom')) {
              brand = 'MCOM';
            } else if (item.featureName.toLowerCase().includes('bcom')) {
              brand = 'BCOM';
            }
            
            return `
            <tr>
              <td>${i + 1}</td>
              <td><span class="file-path">${item.fileName}</span></td>
              <td>${item.featureName}</td>
              <td>${module}</td>
              <td>${deviceType}</td>
              <td>${brand}</td>
              <td>${item.total}</td>
              <td>${item.passed}</td>
              <td>${item.failed}</td>
              <td>${item.total > 0 ? ((item.passed / item.total) * 100).toFixed(2) : 0}</td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div class="table-container">
    <h3>Consolidated RCA</h3>
    <button class="export-button" onclick="exportTableToCSV('rcaTable', 'consolidated_rca.csv')">Export RCA</button>
    <div class="scrollable-table">
      <table id="rcaTable">
        <thead>
          <tr>
            <th style="width: 50px;">S.No</th>
            <th>File Path</th>
            <th>Feature</th>
            <th>Module</th>
            <th>Device Type</th>
            <th>Brand</th>
            <th>Scenario Name</th>
            <th>Scenario Tags</th>
            <th>Step Failed</th>
            <th>Exception</th>
            <th>RCA Category</th>
          </tr>
        </thead>
        <tbody>
          ${rcaData.map((item, i) => {
            const module = item.feature;

            let deviceType = 'Desktop';
            if (item.feature.toLowerCase().includes('mew')) {
              deviceType = 'MEW';
            } else if (item.feature.toLowerCase().includes('tablet')) {
              deviceType = 'TAB';
            }

            let brand = '';
            if (item.feature.toLowerCase().includes('mcom')) {
              brand = 'MCOM';
            } else if (item.feature.toLowerCase().includes('bcom')) {
              brand = 'BCOM';
            }

            return `
            <tr class="${item.rca.replace(/ /g, '\\ ')}">
              <td>${i + 1}</td>
              <td><span class="file-path">${item.file}</span></td>
              <td>${item.feature}</td>
              <td>${module}</td>
              <td>${deviceType}</td>
              <td>${brand}</td>
              <td>${item.scenario}</td>
              <td>${item.totalTags}</td>
              <td>${item.step}</td>
              <td><pre>${item.error}</pre></td>
              <td>${item.rca}</td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  </div>
</main>
<script>
function exportTableToCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  const rows = Array.from(table.querySelectorAll("tr"));
  const csv = rows.map(row => {
    const cols = Array.from(row.querySelectorAll("th, td"));
    return cols.map(col => '"' + col.innerText.replace(/"/g, '""') + '"').join(",");
  }).join("\\n");

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.setAttribute("href", URL.createObjectURL(blob));
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
</script>
</body>
</html>
`;


// Helper function to recursively find all JSON files
const findAllJsonFiles = (dir, jsonFiles = []) => {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      // Recursively search subdirectories
      findAllJsonFiles(fullPath, jsonFiles);
    } else if (item.endsWith('.json') && item.startsWith('cucumber_report')) {
      jsonFiles.push(fullPath);
    }
  });
  
  return jsonFiles;
};

const generateReport = () => {
  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) {
    console.error('❌ reports folder not found');
    return;
  }

  // Find all JSON files recursively in the reports directory and subdirectories
  const jsonFiles = findAllJsonFiles(reportsDir);

  if (jsonFiles.length === 0) {
    console.error('❌ No cucumber_report JSON files found in ./reports folder or its subdirectories');
    return;
  }

  console.log(`📊 Processing ${jsonFiles.length} cucumber_report file(s):`);
  jsonFiles.forEach(file => {
    const relativePath = path.relative(reportsDir, file);
    console.log(`   - ${relativePath}`);
  });

  const features = new Set();
  const summaryData = [];
  const rcaData = [];
  const consolidatedFeatures = new Map();

  // Process each JSON file
  jsonFiles.forEach((jsonPath, fileIndex) => {
    try {
      const report = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const relativePath = path.relative(reportsDir, jsonPath);
      const fileName = relativePath.replace(/\\/g, '/'); // Use forward slashes for consistency
      
      report.forEach((feature) => {
        const featureKey = `${feature.name} (${fileName})`;
        features.add(featureKey);
        
        let total = 0, passed = 0, failed = 0;

        feature.elements.forEach(scenario => {
          total++;
          const hasFailedStep = scenario.steps.some(step => step.result.status === 'failed');
          
          if (hasFailedStep) {
            failed++;
            const tagsArray = [];
            scenario.tags.forEach(tag => {
              tagsArray.push(tag.name);
            });
            
            scenario.steps.forEach(step => {
              if (step.result.status === 'failed') {
                const fullError = step.result.error_message || '';
                const shortError = fullError.split('\n')[0];
                rcaData.push({
                  file: fileName,
                  feature: feature.name,
                  scenario: scenario.name,
                  totalTags: tagsArray,
                  step: step.name,
                  error: shortError,
                  rca: categorizeRCA(shortError)
                });
              }
            });
          } else {
            passed++;
          }
        });

        // Store feature summary with file info
        consolidatedFeatures.set(featureKey, { total, passed, failed, fileName });
        summaryData.push({ total, passed, failed, fileName, featureName: feature.name });
      });
    } catch (error) {
      const relativePath = path.relative(reportsDir, jsonPath);
      console.error(`❌ Error processing ${relativePath}:`, error.message);
    }
  });

  const html = generateHTML([...features], summaryData, rcaData, jsonFiles.length);
  const outputPath = path.join(__dirname, 'reports', 'consolidated_cucumber_rca_report.html');
  fs.writeFileSync(outputPath, html);
  console.log(`✅ Consolidated RCA report generated: ${outputPath}`);
  console.log(`📈 Total files processed: ${jsonFiles.length}`);
  console.log(`📊 Total failed scenarios: ${rcaData.length}`);
};

generateReport();
