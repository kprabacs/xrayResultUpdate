
import sys
import json
import os
import zipfile
import tempfile
from openpyxl import Workbook
import re

ILLEGAL_CHARACTERS_RE = re.compile(r'[\000-\010]|[\013-\014]|[\016-\037]')

def sanitize_for_excel(text):
    if not isinstance(text, str):
        return text
    # Truncate to avoid hitting cell character limits, and remove illegal characters.
    truncated_text = (text[:32766] + '…') if len(text) > 32767 else text
    return ILLEGAL_CHARACTERS_RE.sub(r'', truncated_text)

def find_issues_in_report(report_content):
    """
    Analyzes a single Cucumber JSON report content for issues.
    """
    issues = {
        'duplicate_test_cases': [],
        'no_test_tag': [],
        'multiple_test_tags': []
    }
    test_case_names = set()
    
    try:
        data = json.loads(report_content)
    except json.JSONDecodeError:
        return {'error': 'Invalid JSON format'}

    for feature in data:
        if 'elements' not in feature:
            continue
        for scenario in feature['elements']:
            if scenario.get('type') != 'scenario':
                continue
            
            scenario_name = scenario.get('name', 'Unnamed Scenario')
            feature_name = feature.get('name', 'N/A')
            
            tags = [tag['name'] for tag in scenario.get('tags', [])]
            test_tags = [tag for tag in tags if re.match(r'@TEST_[A-Z0-9_-]+', tag, re.IGNORECASE)]

            # Check for duplicate test cases
            if scenario_name in test_case_names:
                issues['duplicate_test_cases'].append({'feature': feature_name, 'scenario': scenario_name, 'test_ids': ', '.join(test_tags)})
            else:
                test_case_names.add(scenario_name)
            
            if not test_tags:
                issues['no_test_tag'].append({'feature': feature_name, 'scenario': scenario_name})
            elif len(test_tags) > 1:
                issues['multiple_test_tags'].append({'feature': feature_name, 'scenario': scenario_name, 'test_ids': ', '.join(test_tags)})

    return issues

def create_excel_report(issues, output_dir):
    """
    Creates an Excel report from the found issues in a single sheet.
    """
    workbook = Workbook()
    ws = workbook.active
    ws.title = "Evaluation Report"
    
    ws.append(["Reason", "Testcase ID(s)", "Scenario", "Feature"])

    for item in issues.get('duplicate_test_cases', []):
        ws.append([
            "Duplicate Test Case",
            sanitize_for_excel(item.get('test_ids', 'N/A')),
            sanitize_for_excel(item['scenario']),
            sanitize_for_excel(item['feature'])
        ])

    for item in issues.get('no_test_tag', []):
        ws.append([
            "Missing @TEST Tag",
            "", # No test ID for this issue type
            sanitize_for_excel(item['scenario']),
            sanitize_for_excel(item['feature'])
        ])
            
    for item in issues.get('multiple_test_tags', []):
        ws.append([
            "Multiple @TEST Tags",
            sanitize_for_excel(item['test_ids']),
            sanitize_for_excel(item['scenario']),
            sanitize_for_excel(item['feature'])
        ])

    with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx", dir=output_dir, prefix="evaluation_report_") as tmp:
        excel_path = tmp.name
    
    workbook.save(excel_path)
    return excel_path

def process_file(file_path):
    """
    Processes a single JSON file or a ZIP archive of JSON files.
    """
    all_issues = {
        'duplicate_test_cases': [],
        'no_test_tag': [],
        'multiple_test_tags': []
    }

    if file_path.lower().endswith('.zip'):
        with tempfile.TemporaryDirectory() as temp_dir:
            with zipfile.ZipFile(file_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
                for root, _, files in os.walk(temp_dir):
                    for file in files:
                        if file.lower().endswith('.json'):
                            json_path = os.path.join(root, file)
                            with open(json_path, 'r', encoding='utf-8', errors='replace') as f:
                                content = f.read()
                                issues = find_issues_in_report(content)
                                if 'error' in issues:
                                    continue # Or handle error
                                for key in all_issues:
                                    all_issues[key].extend(issues[key])
    elif file_path.lower().endswith('.json'):
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
            issues = find_issues_in_report(content)
            if 'error' not in issues:
                for key in all_issues:
                    all_issues[key].extend(issues[key])

    total_issues = sum(len(v) for v in all_issues.values())
    
    if total_issues == 0:
        return {"status": "success", "message": "No issues found in the report."}
    else:
        output_dir = os.path.dirname(file_path)
        excel_path = create_excel_report(all_issues, output_dir)
        return {"status": "issues_found", "file_path": excel_path, "message": f"Found {total_issues} issues. Report generated."}

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"status": "error", "message": "Usage: python evaluate_report.py <path_to_file>"}), file=sys.stderr)
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    if not os.path.exists(file_path):
        print(json.dumps({"status": "error", "message": f"File not found: {file_path}"}), file=sys.stderr)
        sys.exit(1)
        
    result = process_file(file_path)
    print(json.dumps(result))
