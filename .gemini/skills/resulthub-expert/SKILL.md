---
name: resulthub-expert
description: Expertise in ResultHub application architecture, test processing logic, and database schemas. Use when modifying report ingestion, Xray sync logic, or DB models to prevent regressions in quality filtering and flakiness tracking.
---
# ResultHub Expert Skill

This skill provides deep contextual knowledge of the ResultHub application, a specialized tool for processing Cucumber and Xray-formatted reports and syncing them with Jira Xray.

## Core Application Purpose
ResultHub automates the ingestion of test execution results, validates their quality (tagging, duplication, format), updates Jira Xray, and maintains a historical database for flakiness analytics and performance tracking.

## Critical Business Rules (Protect These)

### 1. Test Key Validation (The "@TEST_" Rule)
*   **Logic**: Only tags matching `/@TEST_([A-Z][A-Z0-9]+-\d+)/i` (case-insensitive) are treated as valid Jira keys.
*   **Strict Prefix**: For the `SRTM` project, keys are strictly expected as `@TEST_SRTM-\d+` or `SRTM-\d+`.
*   **Constraint**: Scenarios without a tag matching this specific pattern **must be skipped** during database insertion and Xray update.
*   **Warning**: Changing this regex or softening this rule will result in "Issue not found" errors from Xray or junk data in the DB.

### 2. Duplicate Detection
*   **Logic**: Multiple scenarios with the same name in a single report are considered errors **unless** their keyword is "Scenario Outline".
*   **Constraint**: Regular duplicates must be skipped. Scenario Outlines must be preserved.

### 3. Metadata Normalization
*   **Logic**: `module`, `channel`, and `device` fields must be trimmed and converted to **lowercase** before database operations.
*   **Constraint**: Always use `toLowerCase().trim()` when comparing or saving these metadata fields to ensure case-insensitive consistency across releases.

### 4. Database Integrity
*   **Cascading Deletes**: `TestCaseResult` records are linked to `TestRunSummary` with `onDelete: Cascade`. Deleting a summary automatically wipes its results.
*   **Deduplication**: Every `TestRunSummary` has a `reportHash` (SHA-256 of the JSON content). Duplicate uploads are rejected by the API.
*   **Flakiness Tracking**: The `FlakyTest` model tracks cumulative pass/fail counts per test case and release to identify unstable tests.

## Workflow Reference

### Report Ingestion (API)
*   **Supported Formats**: Cucumber JSON (single/bulk) and Xray JSON (single/bulk).
*   **Bulk ZIP Convention**: For bulk Cucumber uploads, ZIP filenames must follow `channel_module_device.json` or `module-channel-device.json`.
*   **Create Execution**: Uses Xray Multipart API. Requires a valid Test Plan Key. Filters scenarios before sending.
*   **Update Execution**: Converts Cucumber to Xray JSON format. 

### Xray Automatic Retry Mechanism
*   **Logic**: Features a 3-attempt retry loop that handles "not of type Test" errors from Xray.
*   **Mechanism**: Parses the error message to identify non-Test keys, adds them to an `excludedKeys` list, and retries the import.

### Quality Evaluation
*   Powered by `app/evaluate_report.py`. It flags missing tags, multiple tags, and malformed tags (missing numeric IDs).
*   **Output**: Generates a downloadable Excel report (`evaluation_report.xlsx`) detailing all discovered issues with features and scenarios.

## Domain Expertise Reference
Refer to these files for implementation details:
*   **Parser Logic**: `app/src/utils/cucumberReportParser.ts`
*   **Processing Logic**: `app/src/utils/reportProcessor.ts`
*   **DB Schema**: `app/prisma/schema.prisma`
*   **Evaluation Script**: `app/evaluate_report.py`
*   **Xray Integration**: `app/src/app/api/upload-to-xray/route.ts`
