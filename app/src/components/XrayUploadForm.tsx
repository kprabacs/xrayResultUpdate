'use client';

import React, { useState, useRef } from 'react';
import { File, UploadCloud } from 'lucide-react';
import JSZip from 'jszip';
import { processCucumberReportV2, triggerDownload, processBulkCucumberReportV2 } from '@/utils/reportProcessor';

type UpdateType = 'create' | 'update';
type Workflow = 'single-cucumber' | 'bulk-cucumber' | 'single-xray' | 'bulk-xray' | '';
type JsonType = 'cucumber' | 'xray';

const moduleOptions = [
    'Creditgateway', 'Discovery', 'Bag', 'Checkout', 'E2E Trans', 'Giftcard',
    'Registry', 'Riskapp', 'Wishlist', 'OrderBatch', 'HnF', 'Home page',
    'MMoneyEarn', 'MMoneyRedeem', 'My Acc', 'Ordermods', 'PDP', 'Preference',
    'PricingandPromotion', 'PROS', 'Sitemon', 'Star Rewards', 'Wallet', 'Ordergroove'
];

export default function XrayUploadForm() {
  // Common State
  const [file, setFile] = useState<File | null>(null);
  const [jiraToken, setJiraToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<React.ReactNode | boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI State
  const [jsonType, setJsonType] = useState<JsonType>('cucumber');
  const [workflow, setWorkflow] = useState<Workflow>('');
  
  // Specific State
  const [testPlanKey, setTestPlanKey] = useState('');
  const [testExecKey, setTestExecKey] = useState('');
  const [updateType, setUpdateType] = useState<UpdateType | ''>('');
  const [summary, setSummary] = useState('');
  
  // Excel Report State
  const [generateExcel, setGenerateExcel] = useState(false);
  const [release, setRelease] = useState('');
  const [module, setModule] = useState('');
  const [channel, setChannel] = useState('');
  const [device, setDevice] = useState('');

  // Evaluation State
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{message: string, status: string} | null>(null);


  const resetForm = (keepWorkflow = false) => {
    setFile(null);
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
    if (fileInputRef.current) {
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
    resetForm(true); // Keep workflow, reset rest
    if(newWorkflow === 'single-xray' || newWorkflow === 'bulk-xray') {
      setUpdateType('update');
    }
  }
  
  const handleGenerateExcel = async () => {
    if (!file) return;
    if (!release.trim() || !module.trim() || !channel.trim() || !device.trim()) {
        setError('Release, Module, Channel and Device are mandatory for excel generation.');
        return;
    }
    try {
        const blob = await processCucumberReportV2(file, release, module, channel, device);
        const filename = `cucumber_report_${Date.now()}.xlsx`;
        triggerDownload(blob, filename);
    } catch(err) {
        setError(err instanceof Error ? err.message : 'Could not generate excel report.');
    }
  }

  const handleBulkGenerateExcel = async () => {
    if (!file) return;
    if (!release.trim()) {
        setError('Release is mandatory for excel generation.');
        return;
    }
    try {
        const { blob, skippedFiles } = await processBulkCucumberReportV2(file, release);
        const filename = `bulk_cucumber_report_${Date.now()}.xlsx`;
        triggerDownload(blob, filename);
        if (skippedFiles.length > 0) {
            setError(`Report generated, but some files were skipped due to incorrect naming format: ${skippedFiles.join(', ')}`);
        }
    } catch(err) {
        setError(err instanceof Error ? err.message : 'Could not generate bulk excel report.');
    }
  }

  const processFile = (selectedFile: File) => {
    const expectedExtension = (workflow === 'bulk-cucumber' || workflow === 'bulk-xray') ? '.zip' : '.json';
    if (selectedFile.name.endsWith(expectedExtension)) {
        setFile(selectedFile);
        setError(null);
    } else {
        setError(`Please select a valid ${expectedExtension} file`);
        setFile(null);
    }
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
        const err = await response.json();
        throw new Error(err.error || 'Evaluation failed.');
      }

      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        const blob = await response.blob();
        triggerDownload(blob, 'evaluation_report.xlsx');
        setSuccess('Evaluation report has been downloaded.');
      } else {
        const result = await response.json();
        setEvaluationResult(result);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during evaluation.');
    } finally {
      setEvaluating(false);
    }
  };

  const handleSingleCucumberSubmit = async () => {
    if (!file) { setError('Please upload a Cucumber JSON file.'); return false; }
    if (!updateType) { setError('Please select an update type.'); return false; }
    if (updateType === 'update' && !testExecKey.trim()) { setError('Test Execution Key is mandatory for updates.'); return false; }
    if (updateType === 'create' && !summary.trim()) { setError('Summary is mandatory for creating executions.'); return false; }
    if (!testPlanKey.trim()) { setError('Test Plan Key is mandatory.'); return false; }
    if (!jiraToken.trim()) { setError('Jira API Token is mandatory.'); return false; }
    
    if (generateExcel) await handleGenerateExcel();

    const fileContent = await file.text();
    const cucumberReport = JSON.parse(fileContent);
    const response = await fetch('/api/upload-to-xray', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cucumberReport, token: jiraToken, updateType, testExecKey, testPlanKey, summary }),
    });
    const result = await response.json();
    if (!response.ok) { throw new Error(result.error || `Failed to import execution results. Status: ${response.status}`); }
    setSuccess(<p>Successfully processed results for execution:{' '}<a href={result.self} target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 hover:underline">{result.key}</a></p>);
    return true;
  };

  const handleBulkCucumberSubmit = async () => {
    if (!file) { setError('Please upload a ZIP file.'); return false; }
    if (!updateType) { setError('Please select an update type.'); return false; }
    if (updateType === 'update' && !testExecKey.trim()) { setError('Test Execution Key is mandatory for updates.'); return false; }
    if (!testPlanKey.trim()) { setError('Test Plan Key is mandatory for bulk uploads.'); return false; }
    if (!jiraToken.trim()) { setError('Jira API Token is mandatory for bulk uploads.'); return false; }

    if (generateExcel) await handleBulkGenerateExcel();

    const zip = await JSZip.loadAsync(file);
    const jsonFiles = Object.values(zip.files).filter(f => !f.dir && f.name.endsWith('.json') && !f.name.startsWith('__MACOSX/'));
    if (jsonFiles.length === 0) { setError('The ZIP file contains no valid .json files.'); return false; }

    const uploadPromises = jsonFiles.map(async (jsonFile) => {
      try {
        const fileContent = await jsonFile.async('string');
        const cucumberReport = JSON.parse(fileContent);
        const featureName = cucumberReport[0]?.name || 'Execution from bulk upload';
        
        const body: any = { 
            cucumberReport, 
            token: jiraToken, 
            updateType, 
            testPlanKey 
        };
        if (updateType === 'create') {
            body.summary = featureName;
        } else { // update
            body.testExecKey = testExecKey;
        }

        const response = await fetch('/api/upload-to-xray', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok) { throw new Error(result.error || `Status ${response.status}`); }
        return { status: 'fulfilled' as const, value: result, filename: jsonFile.name };
      } catch (err) {
        return { status: 'rejected' as const, reason: err instanceof Error ? err.message : 'Unknown error', filename: jsonFile.name };
      }
    });
    const results = await Promise.all(uploadPromises);
    const successfulUploads = results.filter((r): r is Extract<typeof r, { status: 'fulfilled' }> => r.status === 'fulfilled');
    const failedUploads = results.filter((r): r is Extract<typeof r, { status: 'rejected' }> => r.status === 'rejected');
    if (successfulUploads.length > 0) {
      const successDetails = (<div><p>{successfulUploads.length} of {jsonFiles.length} files uploaded successfully.</p><ul className="list-disc list-inside mt-2 text-xs">{successfulUploads.map(res => (<li key={res.value.key}>{res.filename}: Processed{' '}<a href={res.value.self} target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 hover:underline">{res.value.key}</a></li>))}</ul></div>);
      setSuccess(successDetails);
    }
    if (failedUploads.length > 0) {
      const failedFiles = failedUploads.map(f => `${f.filename} (${f.reason})`).join(', ');
      setError(`Bulk upload partially failed. ${failedUploads.length} files failed to upload: ${failedFiles}`);
    }
    return successfulUploads.length > 0;
  };

  const handleXraySubmit = async () => {
    if (!file) { setError('File, Test Execution Key, and Jira Token are mandatory.'); return false; }
    if (!testExecKey.trim() || !jiraToken.trim()) { return false; }
    
    if (generateExcel) await handleGenerateExcel();

    const fileContent = await file.text();
    const xrayReport = JSON.parse(fileContent);

    const response = await fetch('/api/upload-to-xray', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cucumberReport: xrayReport, // Re-using the same backend key for simplicity
            token: jiraToken,
            updateType: 'update', // Always update for pre-formatted Xray JSON
            testExecKey: testExecKey,
            testPlanKey: testPlanKey,
        }),
    });
    const result = await response.json();
    if (!response.ok) { throw new Error(result.error || `Failed to import execution results. Status: ${response.status}`); }
    setSuccess(<p>Successfully updated execution:{' '}<a href={result.self} target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 hover:underline">{result.key}</a></p>);
    return true;
  };
  
  const handleBulkXraySubmit = async () => {
    if (!file) { setError('Please upload a ZIP file.'); return false; }
    if (!jiraToken.trim()) { setError('Jira API Token is mandatory for bulk uploads.'); return false; }

    if (generateExcel) await handleBulkGenerateExcel();

    const zip = await JSZip.loadAsync(file);
    const jsonFiles = Object.values(zip.files).filter(f => !f.dir && f.name.endsWith('.json') && !f.name.startsWith('__MACOSX/'));
    if (jsonFiles.length === 0) { setError('The ZIP file contains no valid .json files.'); return false; }

    const uploadPromises = jsonFiles.map(async (jsonFile) => {
      try {
        const fileContent = await jsonFile.async('string');
        const xrayReport = JSON.parse(fileContent);
        const executionKey = jsonFile.name.replace('.json', '');

        const response = await fetch('/api/upload-to-xray', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cucumberReport: xrayReport,
            token: jiraToken,
            updateType: 'update',
            testExecKey: executionKey,
          }),
        });
        const result = await response.json();
        if (!response.ok) { throw new Error(result.error || `Status ${response.status}`); }
        return { status: 'fulfilled' as const, value: result, filename: jsonFile.name };
      } catch (err) {
        return { status: 'rejected' as const, reason: err instanceof Error ? err.message : 'Unknown error', filename: jsonFile.name };
      }
    });

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results.filter((r): r is Extract<typeof r, { status: 'fulfilled' }> => r.status === 'fulfilled');
    const failedUploads = results.filter((r): r is Extract<typeof r, { status: 'rejected' }> => r.status === 'rejected');

    if (successfulUploads.length > 0) {
      const successDetails = (<div><p>{successfulUploads.length} of {jsonFiles.length} files uploaded successfully.</p><ul className="list-disc list-inside mt-2 text-xs">{successfulUploads.map(res => (<li key={res.value.key}>{res.filename}: Updated{' '}<a href={res.value.self} target="_blank" rel="noopener noreferrer" className="font-bold text-indigo-600 hover:underline">{res.value.key}</a></li>))}</ul></div>);
      setSuccess(successDetails);
    }
    if (failedUploads.length > 0) {
      const failedFiles = failedUploads.map(f => `${f.filename} (${f.reason})`).join(', ');
      setError(`Bulk upload partially failed. ${failedUploads.length} files failed to upload: ${failedFiles}`);
    }
    return successfulUploads.length > 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setEvaluationResult(null);

    if ((jsonType === 'cucumber' || jsonType === 'xray') && !workflow) {
        setError('Please select a workflow.');
        return;
    }

    setLoading(true);
    try {
        let wasSuccessful = false;
        if (workflow === 'single-cucumber') wasSuccessful = await handleSingleCucumberSubmit();
        else if (workflow === 'bulk-cucumber') wasSuccessful = await handleBulkCucumberSubmit();
        else if (workflow === 'single-xray') wasSuccessful = await handleXraySubmit();
        else if (workflow === 'bulk-xray') wasSuccessful = await handleBulkXraySubmit();
        
        if (wasSuccessful) {
            resetForm();
            setTimeout(() => setSuccess(false), 15000);
        }
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Workflow Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Report Type</label>
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

      {jsonType === 'cucumber' && (
        <div>
            <label htmlFor="cucumber-workflow" className="block text-sm font-medium text-gray-700 mb-2">Select Cucumber Workflow</label>
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
            <label htmlFor="xray-workflow" className="block text-sm font-medium text-gray-700 mb-2">Select Xray Workflow</label>
            <select id="xray-workflow" value={workflow} onChange={(e) => handleWorkflowChange(e.target.value as Workflow)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black">
                <option value="" disabled>Select a workflow...</option>
                <option value="single-xray">Single Xray Upload</option>
                <option value="bulk-xray">Bulk Xray Upload (ZIP)</option>
            </select>
        </div>
      )}
      
      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Upload {(workflow === 'bulk-cucumber' || workflow === 'bulk-xray') ? 'ZIP Archive' : 'JSON Report'} <span className="text-red-500">*</span>
        </label>
        <div onDragOver={handleDragOver} onDrop={handleDrop} className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer">
            <div className="flex flex-col items-center justify-center text-gray-500">
                <UploadCloud size={48} className="mb-4 text-gray-400" />
                <p className="font-semibold mb-2">Drag & drop your file here, or{' '}<label htmlFor="xray-file-input" className="text-indigo-600 hover:underline cursor-pointer">click to browse</label></p>
                <p className="text-xs">Supports {(workflow === 'bulk-cucumber' || workflow === 'bulk-xray') ? '.zip' : '.json'} files only</p>
                <input type="file" accept={(workflow === 'bulk-cucumber' || workflow === 'bulk-xray') ? '.zip' : '.json'} onChange={handleFileChange} className="hidden" id="xray-file-input" ref={fileInputRef}/>
            </div>
            {file && <div className="mt-6 p-3 bg-green-50 text-green-800 rounded-lg text-sm flex items-center justify-center"><File size={16} className="mr-2" /><span>{file.name} ({(file.size / 1024).toFixed(2)} KB)</span></div>}
        </div>
      </div>
      
      <button type="button" onClick={handleEvaluate} disabled={evaluating || !file}
        className="w-full bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center">
        {evaluating ? 'Evaluating...' : 'Evaluate'}
      </button>
      
      {/* 3. Fields Area */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Provide Details</label>
        <div className="grid grid-cols-1 gap-6">
            {jsonType === 'cucumber' && (
              <>
                <div>
                  <label htmlFor="updateType" className="block text-sm font-medium text-gray-700 mb-2">Update Type <span className="text-red-500">*</span></label>
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
              <label htmlFor="jiraToken" className="block text-sm font-medium text-gray-700 mb-2">Jira API Token <span className="text-red-500">*</span></label>
              <input type="password" id="jiraToken" value={jiraToken} onChange={(e) => setJiraToken(e.target.value)} placeholder="Enter your secret Jira API Token" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"/>
            </div>
        </div>
      </div>
      
    {(workflow === 'single-cucumber' || workflow === 'bulk-cucumber' || workflow === 'single-xray' || workflow === 'bulk-xray') && (
    <div className="mt-6">
        <label className="flex items-center">
        <input type="checkbox" checked={generateExcel} onChange={(e) => setGenerateExcel(e.target.checked)} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
        <span className="ml-2 text-sm text-gray-900">Generate Excel Report</span>
        </label>
    </div>
    )}

    {generateExcel && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border-t border-gray-200 mt-6">
             {(workflow === 'single-cucumber' || workflow === 'single-xray' || workflow === 'bulk-cucumber' || workflow === 'bulk-xray') && (
                <div>
                    <label htmlFor="release" className="block text-sm font-medium text-gray-700 mb-2">
                        Release <span className="text-red-500">*</span>
                    </label>
                    <input type="text" id="release" value={release} onChange={(e) => setRelease(e.target.value)} placeholder="e.g., v1.0.0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-black"/>
                </div>
             )}
            {(workflow === 'single-cucumber' || workflow === 'single-xray') && (
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
        </div>
    )}


      {error && <div className="p-4 bg-red-100 text-red-800 rounded-lg text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-100 text-green-800 rounded-lg text-sm">{success}</div>}
      {evaluationResult && (
        <div className={`p-4 rounded-lg text-sm ${evaluationResult.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {evaluationResult.message}
        </div>
      )}
      
      <button type="submit" disabled={loading || !workflow || evaluating}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center">
        {loading ? 'Processing & Uploading...' : 'Upload to Xray'}
      </button>
    </form>
  );
}
