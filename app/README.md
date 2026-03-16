# Cucumber Report Processor UI

A React 19 + Next.js web application that processes Cucumber test report JSON files and generates Excel spreadsheets with test execution results.

## Features

- 📤 **File Upload**: Drag and drop or select your `cucumber_report.json` file
- 📋 **Form Inputs**:
  - **Release** (Mandatory): Version identifier for tracking
  - **Module** (Mandatory): Component/module name being tested
  - **Report Link** (Optional): URL reference to the full test report
- 📊 **Excel Generation**: Automatically generates a formatted Excel file with:
  - Test Results sheet with feature, scenario, and step details
  - Metadata sheet with release, module, and report information
  - Formatted columns with proper widths
  - Test execution duration in human-readable format
- 🎨 **Modern UI**: Built with Tailwind CSS with responsive design
- ✅ **TypeScript**: Full type safety for reliability

## Project Structure

```
app/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Main page component
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   └── CucumberUploadForm.tsx  # Main form component
│   └── utils/
│       └── reportProcessor.ts  # Cucumber processing logic
├── package.json
├── tsconfig.json
├── next.config.ts
└── tailwind.config.ts
```

## Tech Stack

- **Framework**: Next.js 16.1.6 with React 19.2.3
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS 4
- **Excel Generation**: xlsx 0.18.5
- **Node.js**: 18+ recommended

## Installation

1. Navigate to the app directory:
```bash
cd app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## Usage

1. **Upload File**: Drag and drop or click to select your `cucumber_report.json` file
2. **Fill Required Fields**:
   - Enter the Release version (e.g., `v1.0.0`, `Release-2024-01`)
   - Enter the Module name (e.g., `Authentication`, `Payment`, `Dashboard`)
3. **Optional Field**: Add a Report Link if available
4. **Generate**: Click "Generate Excel Report" button
5. **Download**: The Excel file will automatically download as `cucumber_report_[timestamp].xlsx`

## Cucumber JSON Format

The application expects a Cucumber JSON report with the following structure:

```json
[
  {
    "name": "Feature Name",
    "description": "Feature description",
    "elements": [
      {
        "name": "Scenario Name",
        "keyword": "Scenario",
        "line": 26,
        "steps": [
          {
            "keyword": "Given ",
            "name": "Step description",
            "result": {
              "status": "passed",
              "duration": 10416152000
            },
            "match": {
              "location": "path/to/step.js:6"
            }
          }
        ]
      }
    ]
  }
]
```

## Output Excel Format

The generated Excel file contains two sheets:

### Metadata Sheet
- Release
- Module
- Report Link (if provided)
- Generated Date

### Test Results Sheet
Columns for each test step:
- **Feature**: Feature name
- **Scenario**: Scenario name
- **Step Number**: Sequential step number
- **Step Name**: Full step description
- **Keyword**: Step type (Given, When, Then, etc.)
- **Status**: Test result (passed, failed, pending, skipped)
- **Duration**: Step execution time
- **Step Location**: File path and line number of the step definition

## Features & Validation

### Form Validation
- File upload is required
- Release field is mandatory
- Module field is mandatory
- Report Link is optional
- Only JSON files are accepted

### Error Handling
- Clear error messages for validation failures
- File read errors are caught and reported
- JSON parsing errors are handled gracefully

### Success Feedback
- Success message shown after generation
- File downloads automatically
- Form resets after successful submission

## Styling Details

The UI uses Tailwind CSS with:
- Gradient background (blue to indigo)
- Card-based layout with shadows
- Responsive design (mobile-first)
- Icons from inline SVG
- Color-coded status messages (green for success, red for errors)
- Loading state with spinner animation
- Focus states for accessibility

## Building for Production

To build the application for production:

```bash
npm run build
npm start
```

## Customization

### Modifying Column Headers
Edit the `ReportDataRow` interface in `reportProcessor.ts` to change column names.

### Changing Styling
Modify the Tailwind classes in `CucumberUploadForm.tsx` for custom appearance.

### Excel Output Format
Adjust the Excel generation logic in the `processCucumberReport` function:
- Column widths (in `columnWidths` array)
- Sheet names
- Data formatting
- Additional metadata fields

## Troubleshooting

### Issue: npm install fails with cache errors
**Solution**: Clear npm cache and reinstall:
```bash
npm cache clean --force
npm install
```

### Issue: TypeScript errors on build
**Solution**: Ensure TypeScript strict mode is enabled and all types are properly defined.

### Issue: Excel file not downloading
**Solution**: Check browser console for errors. Ensure pop-ups aren't blocked.

## Dependencies

- **next**: Next.js framework
- **react** & **react-dom**: React library
- **xlsx**: Excel file generation
- **tailwindcss**: Utility-first CSS framework
- **typescript**: Type safety
- **eslint**: Code linting

## Development

### Running in Development Mode
```bash
npm run dev
```

The application hot-reloads on file changes.

### Linting
```bash
npm run lint
```

### Building
```bash
npm run build
```

## Performance Considerations

- File processing happens in the browser using the FileReader API
- Large JSON files (>10MB) may take longer to process
- Excel generation is efficient and handles 1000+ test steps
- All processing is client-side, no server upload required

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- IE11: ❌ Not supported

## License

This project is part of the Execution Result Application.

## Support

For issues or questions, please check the project documentation or create an issue in the project repository.
