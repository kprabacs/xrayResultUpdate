
import sys
import json
import os
import re
from pathlib import Path

# RCA Categories and their matching patterns (strings or regex)
RCA_CATEGORIES = {
    'Comparision Failed': ['expect(received).tocontain(expected)'],
    'Validation Failed': [
        'expect(received).tobetruthy()',
        'expect(locator).tohavetext',
        'expect(locator).tobechecked',
        'expect(locator).tobevisible'
    ],
    'Code Error': [
        'not a function',
        "typeerror: cannot read properties of null (reading 'tostring')"
    ],
    'Locator Not Found': [
        'element not found',
        'element is not attached to the dom'
    ],
    'Logic Issue': [
        'typeerror: cannot read properties of undefined (reading',
        "cannot read properties of undefined (reading 'unicode') at escaperegexforselector"
    ],
    'DDSE - Given Element Not Found': ['not found even after multiple retries & even with starts with approach.'],
    'Browser intermittently closed': ['target page, context or browser has been closed'],
    'MEW/TAB compatability issue': ['element is outside of the viewport'],
    'Locator Frame Issue': ['locators must belong to the same frame.'],
    'API Failure (HTML Response)': [
        'received html response, indicating a failure.',
        'api response not found for endpoint',
        'empty in the api response'
    ],
    'Validation Issue': [
        r'expect.*pass.*receive.*fail', 
        r'expect.*fail.*receive.*pass'
    ]
}

def categorize_rca(error_msg):
    """
    Categorizes an error message based on predefined patterns.
    """
    if not error_msg:
        return 'Unknown'
    
    msg_lower = error_msg.lower().strip()

    for category, patterns in RCA_CATEGORIES.items():
        for pattern in patterns:
            # Check if it's a regex pattern (Validation Issue uses regex in original script)
            if category == 'Validation Issue' or pattern.startswith('r\''):
                if re.search(pattern, msg_lower, re.IGNORECASE):
                    return category
            # Standard string inclusion
            elif pattern.lower() in msg_lower:
                return category
                
    return 'Custom Error'

def analyze_json_content(content, file_name="unknown"):
    """
    Parses Cucumber JSON content and performs RCA on failed steps.
    """
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return None

    features = data if isinstance(data, list) else [data]
    results = []

    for feature in features:
        feature_name = feature.get('name', 'N/A')
        for scenario in feature.get('elements', []):
            if scenario.get('type') != 'scenario':
                continue
            
            scenario_name = scenario.get('name', 'Unnamed Scenario')
            tags = [tag['name'] for tag in scenario.get('tags', [])]
            
            # Find the first failed step
            for step in scenario.get('steps', []):
                result = step.get('result', {})
                if result.get('status') == 'failed':
                    full_error = result.get('error_message', '')
                    # Get the first line of the error for categorization
                    short_error = full_error.split('\n')[0] if full_error else 'No error message'
                    
                    rca_category = categorize_rca(short_error)
                    
                    results.append({
                        'file': file_name,
                        'feature': feature_name,
                        'scenario': scenario_name,
                        'tags': tags,
                        'step': step.get('name', 'Unknown Step'),
                        'error': short_error,
                        'full_error': full_error,
                        'rca_category': rca_category
                    })
                    # Only report the first failure in a scenario
                    break
    return results

def process_path(target_path):
    """
    Processes a file or directory and returns consolidated RCA results.
    """
    consolidated_results = []
    path = Path(target_path)

    if path.is_file():
        if path.suffix == '.json':
            with open(path, 'r', encoding='utf-8', errors='replace') as f:
                res = analyze_json_content(f.read(), path.name)
                if res: consolidated_results.extend(res)
    elif path.is_dir():
        for json_file in path.glob('**/cucumber_report*.json'):
            with open(json_file, 'r', encoding='utf-8', errors='replace') as f:
                res = analyze_json_content(f.read(), json_file.name)
                if res: consolidated_results.extend(res)

    # Calculate Summary Stats
    total_failures = len(consolidated_results)
    category_counts = {}
    for item in consolidated_results:
        cat = item['rca_category']
        category_counts[cat] = category_counts.get(cat, 0) + 1

    return {
        'status': 'success',
        'total_failures': total_failures,
        'category_distribution': category_counts,
        'failures': consolidated_results
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "Usage: python analyze_rca.py <path_to_json_or_dir>"}))
        sys.exit(1)
    
    input_path = sys.argv[1]
    if not os.path.exists(input_path):
        print(json.dumps({"status": "error", "message": f"Path not found: {input_path}"}))
        sys.exit(1)
        
    analysis_result = process_path(input_path)
    print(json.dumps(analysis_result))
