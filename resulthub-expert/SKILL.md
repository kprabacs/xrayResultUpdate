---
name: resulthub-expert
description: Expertise in ResultHub application architecture, test processing logic, and database schemas. Use when modifying report ingestion, Xray sync logic, or DB models to prevent regressions in quality filtering and flakiness tracking.
---
# ResultHub Expert Skill

This skill provides deep contextual knowledge of the ResultHub application, a specialized tool for processing Cucumber reports and syncing them with Jira Xray.

## Core Application Purpose
ResultHub automates the ingestion of test execution results, validates their quality (tagging, duplication), updates Jira Xray, and maintains a historical database for flakiness analytics.

## Critical Business Rules (Protect These)

### 1. Test Key Validation (The "@TEST_" Rule)
*   **Logic**: Only tags matching `^@TEST_[A-Z][A-Z0-9]+-\d+$` (case-insensitive) are treated as valid Jira keys.
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

## Workflow Reference

### Report Ingestion (API)
*   **Create Execution**: Uses Xray Multipart API. Requires a valid Test Plan Key. Filters scenarios before sending.
*   **Update Execution**: Converts Cucumber to Xray JSON format. Features an **Automatic Retry Mechanism** that parses "not of type Test" errors from Xray, filters the offending keys, and retries up to 3 times.

### Quality Evaluation
*   Powered by `app/evaluate_report.py`. It flags missing tags, multiple tags, and malformed tags (missing numeric IDs).

## Domain Expertise Reference
Refer to these files for implementation details:
*   **Parser Logic**: `app/src/utils/cucumberReportParser.ts`
*   **DB Schema**: `app/prisma/schema.prisma`
*   **Evaluation Script**: `app/evaluate_report.py`
*   **Xray Integration**: `app/src/app/api/upload-to-xray/route.ts`
