'use client';

import React, { useState, useRef } from 'react';
import { File, UploadCloud, CheckCircle, AlertCircle } from 'lucide-react';
import JSZip from 'jszip';
import { processCucumberReportV2, triggerDownload, processBulkCucumberReportV2 } from '@/utils/reportProcessor';

type UpdateType = 'create' | 'update';
type Workflow = 'single-cucumber' | 'bulk-cucumber' | 'single-xray' | 'bulk-xray' | '';
type JsonType = 'cucumber' | 'xray';
type ActionType = '' | 'saveToDb' | 'uploadToXray' | 'both';

const moduleOptions = [
    'Creditgateway', 'Discovery', 'Bag', 'Checkout', 'E2E Trans', 'Giftcard',
    'Registry', 'Riskapp', 'Wishlist', 'OrderBatch', 'HnF', 'Home page',
    'MMoneyEarn', 'MMoneyRedeem', 'My Acc', 'Ordermods', 'PDP', 'Preference',
    'PricingandPromotion', 'PROS', 'Sitemon', 'Star Rewards', 'Wallet', 'Ordergroove'
];

export default function XrayUploadForm() {
  // Common State
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<React.ReactNode | boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI State
  const [jsonType, setJsonType] = useState<JsonType>('cucumber');
  const [workflow, setWorkflow] = useState<Workflow>('');
  const [actionType, setActionType] = useState<ActionType>('');
  
  // Xray-specific State
  const [jiraToken, setJiraToken] = useState('');
  const [testPlanKey, setTestPlanKey] = useState('');
  const [testExecKey, setTestExecKey] = useState('');
  const [updateType, setUpdateType] = useState<UpdateType | ''>('');
  const [summary, setSummary] = useState('');
  
  // DB and Excel State
  const [generateExcel, setGenerateExcel] = useState(false);
  const [release, setRelease] = useState('');
  const [module, setModule] = useState('');
  const [channel, setChannel] = useState('');
  const [device, setDevice] = useState('');

  // Evaluation State
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{message: string, status: string} | null>(null);


  const resetForm = (keepWorkflow = false, keepFile = false) => {
    if (!keepFile) setFile(null);
    setTestExecKey('');
    setTestPlanKey('');
    setJiraToken('');
    setUpdateType('');
    setSummary('');
    setGenerateExcel(false);
    setRelease('');
    setModule('');
    setChannel('');
    setDevice('');
    setEvaluationResult(null);
    setActionType('');
    if (!keepFile && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (!keepWorkflow) {
        setWorkflow('');
    }
  };

  const handleJsonTypeChange = (type: JsonType) => {
    setJsonType(type);
    resetForm();
  };
  
  const handleWorkflowChange = (newWorkflow: Workflow) => {
    setWorkflow(newWorkflow);
    resetForm(true, true); // Keep workflow AND file, reset rest
    if(newWorkflow === 'single-xray' || newWorkflow === 'bulk-xray') {
      setUpdateType('update');
    }
  }
  
  const handleGenerateExcel = async () => {
    if (!file) return;
    if (workflow === 'single-cucumber' && (!release.trim() || !module.trim() || !channel.trim() || !device.trim())) {
        throw new Error('Release, Module, Channel and Device are mandatory for excel generation.');
    }
    if(workflow === 'bulk-cucumber' && !release.trim()){
        throw new Error('Release is mandatory for excel generation.');
    }

    if(workflow === 'single-cucumber'){
        const blob = await processCucumberReportV2(file, release, module, channel, device);
        const filename = `cucumber_report_${Date.now()}.xlsx`;
        triggerDownload(blob, filename);
    } else if (workflow === 'bulk-cucumber') {
        const { blob, skippedFiles } = await processBulkCucumberReportV2(file, release);
        const filename = `bulk_cucumber_report_${Date.now()}.xlsx`;
        triggerDownload(blob, filename);
        if (skippedFiles.length > 0) {
            setError(`Report generated, but some files were skipped due to incorrect naming format: ${skippedFiles.join(', ')}`);
        }
    }
  }

  const processFile = (selectedFile: File) => {
    const isZip = selectedFile.name.endsWith('.zip');
    const isJson = selectedFile.name.endsWith('.json');

    if (!isZip && !isJson) {
      setError('Please select a valid .json or .zip file');
      setFile(null);
      return;
    }

    // If workflow is already selected, validate extension
    if (workflow) {
      const needsZip = (workflow === 'bulk-cucumber' || workflow === 'bulk-xray');
      if (needsZip && !isZip) {
        setError('Selected workflow requires a .zip file');
        setFile(null);
        return;
      }
      if (!needsZip && !isJson) {
        setError('Selected workflow requires a .json file');
        setFile(null);
        return;
      }
    }

    setFile(selectedFile);
    setError(null);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
        processFile(selectedFile);
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
        processFile(droppedFile);
    }
  };

  const handleEvaluate = async () => {
    if (!file) {
      setError('Please upload a file to evaluate.');
      return;
    }

    setEvaluating(true);
    setError(null);
    setSuccess(false);
    setEvaluationResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/evaluate-report', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await safeJsonResponse(response);
        throw new Error(err.error || 'Evaluation failed.');
      }

      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        const blob = await response.blob();
        triggerDownload(blob, 'evaluation_report.xlsx');
        setEvaluationResult({ message: 'Evaluation report has been downloaded.', status: 'issues_found' });
        setSuccess('Evaluation report has been downloaded.');
      } else {
        const result = await safeJsonResponse(response);
        setEvaluationResult(result);
        if (result.status === 'success') {
          setSuccess(result.message);
        } else {
          setError(result.message);
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during evaluation.');
    } finally {
      setEvaluating(false);
    }
  };
  
  const runUploadToXray = async () => {
    if (!workflow) { throw new Error('Please select a workflow to upload to Xray.'); }
    if (!jiraToken.trim()) { throw new Error('XRAY API Token is mandatory.'); }
    if (!file) { throw new Error('Please upload a file.'); }
    
    // 1. Single Cucumber Upload
    if (workflow === 'single-cucumber') {
        if (!updateType) { throw new Error('Please select a Type of Action.'); }
        if (updateType === 'update' && !testExecKey.trim()) { throw new Error('Test Execution Key is mandatory for updates.'); }
        if (updateType === 'create' && !summary.trim()) { throw new Error('Summary is mandatory for creating executions.'); }
        if (!testPlanKey.trim()) { throw new Error('Test Plan Key is mandatory.'); }
        
        const fileContent = await file.text();
        const cucumberReport = JSON.parse(fileContent);
        const response = await fetch('/api/upload-to-xray', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cucumberReport, token: jiraToken, updateType, testExecKey, testPlanKey, summary }),
        });
        const result = await safeJsonResponse(response);
        if (!response.ok) { 
            let msg = result.error || `Xray Upload Failed: Status ${response.status}`;
            if (result.skipped && result.skipped.length > 0) {
                msg += ` (Skipped tests not updated: ${result.skipped.join(', ')})`;
            }
            throw new Error(msg); 
        }
        let successMsg = `Xray Upload Successful: ${result.key || result.testExecutionKey || 'Done'}`;
        if (result.skipped && result.skipped.length > 0) {
            successMsg += ` (Skipped tests not updated: ${result.skipped.join(', ')})`;
        }
        return successMsg;
    }

    // 2. Bulk Cucumber Upload
    if (workflow === 'bulk-cucumber') {
        if (!updateType) { throw new Error('Please select a Type of Action.'); }
        if (updateType === 'update' && !testExecKey.trim()) { throw new Error('Test Execution Key is mandatory for updates.'); }
        if (!testPlanKey.trim()) { throw new Error('Test Plan Key is mandatory.'); }

        const zip = await JSZip.loadAsync(file);
        const jsonFiles = Object.values(zip.files).filter(f => !f.dir && f.name.endsWith('.json') && !f.name.startsWith('__MACOSX/'));
        if (jsonFiles.length === 0) { throw new Error('The ZIP file contains no valid .json files.'); }

        let mergedCucumberReport: unknown[] = [];
        for (const jsonFile of jsonFiles) {
            const content = await jsonFile.async('string');
            const report = JSON.parse(content);
            if (Array.isArray(report)) {
                mergedCucumberReport = [...mergedCucumberReport, ...report];
            } else {
                mergedCucumberReport.push(report);
            }
        }

        const response = await fetch('/api/upload-to-xray', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cucumberReport: mergedCucumberReport, token: jiraToken, updateType, testExecKey, testPlanKey, summary }),
        });
        const result = await safeJsonResponse(response);
        if (!response.ok) { 
            let msg = result.error || `Bulk Xray Upload Failed: Status ${response.status}`;
            if (result.skipped && result.skipped.length > 0) {
                msg += ` (Skipped tests not updated: ${result.skipped.join(', ')})`;
            }
            throw new Error(msg); 
        }
        let successMsg = `Bulk Xray Upload Successful: ${result.key || result.testExecutionKey || 'Done'}`;
        if (result.skipped && result.skipped.length > 0) {
            successMsg += ` (Skipped tests not updated: ${result.skipped.join(', ')})`;
        }
        return successMsg;
    }

    // 3. Single Xray Upload
    if (workflow === 'single-xray') {
        if (!testExecKey.trim()) { throw new Error('Test Execution Key is mandatory.'); }
        
        const fileContent = await file.text();
        const xrayReport = JSON.parse(fileContent);
        
        const response = await fetch('/api/upload-to-xray', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ xrayReport, token: jiraToken, updateType: 'update', testExecKey, testPlanKey }),
        });
        const result = await safeJsonResponse(response);
        if (!response.ok) { throw new Error(result.error || `Xray Upload Failed: Status ${response.status}`); }
        return `Xray Upload Successful: ${result.key || result.testExecutionKey || 'Done'}`;
    }

    // 4. Bulk Xray Upload
    if (workflow === 'bulk-xray') {
        const zip = await JSZip.loadAsync(file);
        const jsonFiles = Object.values(zip.files).filter(f => !f.dir && f.name.endsWith('.json') && !f.name.startsWith('__MACOSX/'));
        if (jsonFiles.length === 0) { throw new Error('The ZIP file contains no valid .json files.'); }

        const results: string[] = [];
        for (const jsonFile of jsonFiles) {
            const fileName = jsonFile.name.split('/').pop() || '';
            const derivedExecKey = fileName.replace('.json', '');
            
            try {
                const content = await jsonFile.async('string');
                const xrayReport = JSON.parse(content);
                
                const response = await fetch('/api/upload-to-xray', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ xrayReport, token: jiraToken, updateType: 'update', testExecKey: derivedExecKey, testPlanKey }),
                });
                const result = await safeJsonResponse(response);
                if (!response.ok) { 
                    results.push(`${fileName}: Failed - ${result.error}`);
                } else {
                    results.push(`${fileName}: Success - ${result.key || result.testExecutionKey}`);
                }
            } catch (err) {
                results.push(`${fileName}: Error - ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
        }
        return `Bulk Xray Upload Results: ${results.join('; ')}`;
    }
    
    throw new Error("Selected Xray workflow is not yet implemented.");
  };

  const safeJsonResponse = async (response: Response) => {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      return await response.json();
    } else {
      const text = await response.text();
      throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 100)}...`);
    }
  };

  const runSaveToDb = async () => {
    if (!file) { throw new Error('Please upload a file.'); }
    if (jsonType !== 'cucumber') { throw new Error('Saving to database is only supported for Cucumber reports.'); }
    
    const dbFormData = new FormData();
    dbFormData.append('file', file);
    let endpoint = '';

    if (workflow === 'single-cucumber') {
        if (!release.trim() || !module.trim() || !channel.trim() || !device.trim()) {
            throw new Error('Release, Module, Channel, and Device are mandatory for saving a single report.');
        }
        dbFormData.append('releaseName', release);
        dbFormData.append('module', module);
        dbFormData.append('channel', channel);
        dbFormData.append('device', device);
        endpoint = '/api/save-report';
    } else if (workflow === 'bulk-cucumber') {
        if (!release.trim()) { throw new Error('Release is mandatory for saving a bulk report.'); }
        dbFormData.append('releaseName', release);
        
        // Pass Xray metadata if applicable
        if (actionType === 'both') {
            dbFormData.append('uploadToXray', 'true');
            dbFormData.append('jiraToken', jiraToken);
            dbFormData.append('testPlanKey', testPlanKey);
            dbFormData.append('testExecKey', testExecKey);
            dbFormData.append('updateType', updateType);
            dbFormData.append('summary', summary);
        }
        
        endpoint = '/api/save-bulk-report';
    } else {
        throw new Error('Please select a valid Cucumber workflow (single or bulk).');
    }
    
    const response = await fetch(endpoint, {
        method: 'POST',
        body: dbFormData,
    });

    const result = await safeJsonResponse(response);
    if (!response.ok) { throw new Error(result.error || 'Failed to save to database.'); }
    return result.message || 'Successfully saved to database.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!actionType) { setError("Please select a 'Type of WorkFlow'."); return; }
    if (!file) { setError("Please upload a file."); return; }

    setLoading(true);
    try {
        if (generateExcel) {
            await handleGenerateExcel();
        }

        const results: string[] = [];
        
        if (actionType === 'both' && workflow === 'bulk-cucumber') {
            // Consolidated bulk call
            const res = await runSaveToDb();
            results.push(res);
        } else {
            // Parallel or separate calls
            const actionsToRun = [];
            if (actionType === 'saveToDb' || actionType === 'both') {
                actionsToRun.push(runSaveToDb());
            }
            if (actionType === 'uploadToXray') {
                actionsToRun.push(runUploadToXray());
            } else if (actionType === 'both' && workflow !== 'bulk-cucumber') {
                actionsToRun.push(runUploadToXray());
            }

            const settledResults = await Promise.allSettled(actionsToRun);
            settledResults.forEach(res => {
                if (res.status === 'fulfilled') {
                    results.push(res.value);
                } else {
                    results.push(res.reason.message);
                }
            });
        }
        
        setSuccess(<ul>{results.map((r, i) => <li key={i}>{r}</li>)}</ul>);
        resetForm();
        setTimeout(() => setSuccess(false), 20000);

    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Step 1: Report Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Step 1: Select Report Type</label>
        <div className="flex space-x-2">
            <button type="button" onClick={() => handleJsonTypeChange('cucumber')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${jsonType === 'cucumber' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                Cucumber result json
            </button>
            <button type="button" onClick={() => handleJsonTypeChange('xray')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-colors ${jsonType === 'xray' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                XRay formater json
            </button>
        </div>
      </div>

      {/* Step 2 & 3: Workflow Selection (Parallel) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 2: Workflow Selection */}
        {jsonType === 'cucumber' && (
            <div>
                <label htmlFor="cucumber-workflow" className="block text-sm font-medium text-gray-700 mb-2">Step 2: Select Cucumber Workflow</label>
                <select id="cucumber-workflow" value={workflow} onChange={(e) => handleWorkflowChange(e.target.value as Workflow)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black">
                    <option value="" disabled>Select a workflow...</option>
                    <option value="single-cucumber">Single Cucumber Upload</option>
                    <option value="bulk-cucumber">Bulk Cucumber Upload (ZIP)</option>
                </select>
            </div>
        )}

        {jsonType === 'xray' && (
            <div>
                <label htmlFor="xray-workflow" className="block text-sm font-medium text-gray-700 mb-2">Step 2: Select Xray Workflow</label>
                <select id="xray-workflow" value={workflow} onChange={(e) => handleWorkflowChange(e.target.value as Workflow)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black">
                    <option value="" disabled>Select a workflow...</option>
                    <option value="single-xray">Single Xray Upload</option>
                    <option value="bulk-xray">Bulk Xray Upload (ZIP)</option>
                </select>
            </div>
        )}

        {/* Step 3: Action Type (Always Visible) */}
        <div>
            <label htmlFor="actionType" className="block text-sm font-medium text-gray-700 mb-2">Step 3: Type of WorkFlow <span className="text-red-500">*</span></label>
            <select id="actionType" value={actionType} onChange={(e) => setActionType(e.target.value as ActionType)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black">
                <option value="" disabled>Select...</option>
                {jsonType === 'cucumber' && <option value="saveToDb">Save to Database</option>}
                <option value="uploadToXray">Update result to Xray</option>
                {jsonType === 'cucumber' && <option value="both">Save to Database and Update result to Xray</option>}
            </select>
        </div>
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Step 4: Upload {(workflow === 'bulk-cucumber' || workflow === 'bulk-xray') ? 'ZIP Archive' : 'JSON Report'} <span className="text-red-500">*</span>
        </label>
        <div onDragOver={handleDragOver} onDrop={handleDrop} className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer">
            <div className="flex flex-col items-center justify-center text-gray-500">
                <UploadCloud size={48} className="mb-4 text-gray-400" />
                <p className="font-semibold mb-2">Drag & drop your file here, or{' '}<label htmlFor="xray-file-input" className="text-indigo-600 hover:underline cursor-pointer">click to browse</label></p>
                <p className="text-xs">Supports .zip or .json files</p>
                <input type="file" accept=".zip,.json" onChange={handleFileChange} className="hidden" id="xray-file-input" ref={fileInputRef}/>
            </div>
            {file && <div className="mt-6 p-3 bg-green-50 text-green-800 rounded-lg text-sm flex items-center justify-center"><File size={16} className="mr-2" /><span>{file.name} ({(file.size / 1024).toFixed(2)} KB)</span></div>}
        </div>
      </div>
      
      {/* Evaluate button can be separate */}
      <div className="space-y-4">
        <button type="button" onClick={handleEvaluate} disabled={evaluating || !file}
            className="w-full bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center">
            {evaluating ? 'Evaluating...' : 'Evaluate Report Quality'}
        </button>

        {evaluationResult && (
            <div className={`p-4 rounded-lg flex items-start space-x-3 ${evaluationResult.status === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                {evaluationResult.status === 'success' ? <CheckCircle size={20} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />}
                <div>
                    <p className="font-semibold text-sm">{evaluationResult.status === 'success' ? 'Good News!' : 'Report Issues Detected'}</p>
                    <p className="text-sm">{evaluationResult.message}</p>
                </div>
            </div>
        )}
      </div>
      
      {/* Step 5: Fields Area */}
      {/* Metadata for DB and Excel */}
      {jsonType === 'cucumber' && (actionType === 'saveToDb' || actionType === 'both') && (
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border border-gray-200 rounded-lg mt-6">
            <h3 className="col-span-1 md:col-span-2 text-lg font-semibold text-gray-800 -mb-2">Report Metadata</h3>
            <p className="col-span-1 md:col-span-2 text-sm text-gray-500 -mt-2">Provide details for database records and Excel reports.</p>
            
            <div>
                <label htmlFor="release" className="block text-sm font-medium text-gray-700 mb-2">
                    Release <span className="text-red-500">*</span>
                </label>
                <input type="text" id="release" value={release} onChange={(e) => setRelease(e.target.value)} placeholder="e.g., v1.0.0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"/>
            </div>

            {workflow === 'single-cucumber' && (
                <>
                    <div>
                        <label htmlFor="module" className="block text-sm font-medium text-gray-700 mb-2">
                            Module <span className="text-red-500">*</span>
                        </label>
                        <input type="text" id="module" list="module-options" value={module} onChange={(e) => setModule(e.target.value)} placeholder="e.g., Checkout"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"/>
                        <datalist id="module-options">
                            {moduleOptions.map(opt => <option key={opt} value={opt} />)}
                        </datalist>
                    </div>
                    <div>
                        <label htmlFor="channel" className="block text-sm font-medium text-gray-700 mb-2">
                            Channel <span className="text-red-500">*</span>
                        </label>
                        <select id="channel" value={channel} onChange={(e) => setChannel(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black">
                            <option value="" disabled>Select a channel...</option>
                            <option value="mcom">mcom</option>
                            <option value="bcom">bcom</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="device" className="block text-sm font-medium text-gray-700 mb-2">
                            Device <span className="text-red-500">*</span>
                        </label>
                        <select id="device" value={device} onChange={(e) => setDevice(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black">
                            <option value="" disabled>Select a device...</option>
                            <option value="Desktop">Desktop</option>
                            <option value="MEW">MEW</option>
                            <option value="TAB">TAB</option>
                        </select>
                    </div>
                </>
            )}
             <div className="col-span-1 md:col-span-2">
                <label className="flex items-center">
                    <input type="checkbox" checked={generateExcel} onChange={(e) => setGenerateExcel(e.target.checked)} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                    <span className="ml-2 text-sm text-gray-900">Generate accompanying Excel Report</span>
                </label>
             </div>
        </div>
      )}

      {/* Xray Specific fields */}
      {(actionType === 'uploadToXray' || actionType === 'both') && (
        <div className="grid grid-cols-1 gap-6 p-6 border border-gray-200 rounded-lg mt-6">
            <h3 className="col-span-1 text-lg font-semibold text-gray-800 -mb-2">Xray Details</h3>
            {jsonType === 'cucumber' && (
              <>
                <div>
                  <label htmlFor="updateType" className="block text-sm font-medium text-gray-700 mb-2">Type of Action <span className="text-red-500">*</span></label>
                  <select id="updateType" value={updateType} onChange={(e) => setUpdateType(e.target.value as UpdateType)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black">
                      <option value="" disabled>Select an update type...</option>
                      <option value="create">Create New Test Execution</option>
                      <option value="update">Update Existing Test Execution</option>
                  </select>
                </div>
                {updateType === 'update' && (
                  <div>
                    <label htmlFor="testExecKey" className="block text-sm font-medium text-gray-700 mb-2">Test Execution Key <span className="text-red-500">*</span></label>
                    <input type="text" id="testExecKey" value={testExecKey} onChange={(e) => setTestExecKey(e.target.value)} placeholder="e.g., PROJ-123" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"/>
                  </div>
                )}
                {updateType === 'create' && workflow === 'single-cucumber' && (
                  <div>
                    <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-2">Summary <span className="text-red-500">*</span></label>
                    <input type="text" id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="e.g., Automated regression tests" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"/>
                  </div>
                )}
              </>
            )}

            {(workflow === 'single-xray' || workflow === 'bulk-xray') && (
              <div>
                <label htmlFor="testExecKey" className="block text-sm font-medium text-gray-700 mb-2">Test Execution Key to Update</label>
                 <p className="text-xs text-gray-500 mb-2">For bulk uploads, the execution key is derived from the JSON filename (e.g., PROJ-123.json). For single uploads, please provide it below.</p>
                <input type="text" id="testExecKey" value={testExecKey} onChange={(e) => setTestExecKey(e.target.value)} placeholder="e.g., PROJ-123" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black" disabled={workflow === 'bulk-xray'}/>
              </div>
            )}
            
            {(workflow === 'single-cucumber' || workflow === 'bulk-cucumber') && (
                <div>
                    <label htmlFor="testPlanKey" className="block text-sm font-medium text-gray-700 mb-2">Test Plan Key <span className="text-red-500">*</span></label>
                    <input type="text" id="testPlanKey" value={testPlanKey} onChange={(e) => setTestPlanKey(e.target.value)} placeholder="e.g., PROJ-456" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"/>
                </div>
            )}

            <div>
              <label htmlFor="jiraToken" className="block text-sm font-medium text-gray-700 mb-2">XRAY API Token <span className="text-red-500">*</span></label>
              <input type="password" id="jiraToken" value={jiraToken} onChange={(e) => setJiraToken(e.target.value)} placeholder="Enter your secret XRAY API Token" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"/>
            </div>
        </div>
      )}
      
      {error && <div className="p-4 bg-red-100 text-red-800 rounded-lg text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-100 text-green-800 rounded-lg text-sm">{success}</div>}
      
      {/* Final Submit Area */}
      <div className="space-y-4 pt-4 border-t">
        {loading && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div className="bg-indigo-600 h-2.5 rounded-full animate-pulse" style={{width: '100%'}}></div>
            </div>
        )}

        <button type="submit" disabled={loading || evaluating || !file || !actionType}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center">
            {loading ? 'Processing...' : 'Submit'}
        </button>
      </div>
    </form>
  );
}
