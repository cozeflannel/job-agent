import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, OptimizedDocument, ApplicationEntry } from '../types';
import { scanPage } from '../utils/domFunctions';

declare var chrome: any;

interface JobFillerProps {
    profile: UserProfile;
    onUpdateProfile: (profile: UserProfile) => void;
}

export const JobFiller: React.FC<JobFillerProps> = ({ profile, onUpdateProfile }) => {
    const [status, setStatus] = useState<'idle' | 'prompt_resume_choice' | 'optimizing_input' | 'optimizing_preview' | 'scanning' | 'thinking' | 'filling' | 'uploading' | 'complete' | 'error'>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const startTimeRef = useRef<number>(0);
    const targetFrameId = useRef<number>(0);

    // Optimization Flow State
    const [draftJob, setDraftJob] = useState({ title: '', company: '', description: '' });
    const [optimizedResult, setOptimizedResult] = useState<OptimizedDocument | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizeStatus, setOptimizeStatus] = useState('');
    const [previewMode, setPreviewMode] = useState<'resume' | 'cover'>('resume');

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    // Metrics
    const history = profile.applicationHistory || [];
    const totalJobs = history.length;
    const totalAutofillSeconds = history.reduce((acc, curr) => acc + curr.autofillTimeSeconds, 0);
    const totalManualSeconds = history.reduce((acc, curr) => acc + curr.estimatedManualTimeSeconds, 0);
    const totalSavedSeconds = totalManualSeconds - totalAutofillSeconds;

    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}m ${secs}s`;
    };

    // --- Workflow Steps ---

    const startWorkflow = () => {
        startTimeRef.current = Date.now();
        setStatus('prompt_resume_choice');
    };

    const handleUseCurrent = () => {
        executeAutofill(profile);
    };

    const handleStartOptimize = async () => {
        setStatus('optimizing_input');
        // Auto-detect immediately
        await autoDetectJob();
    };

    const autoDetectJob = async () => {
        if (!profile.apiKey) return;

        try {
            setOptimizeStatus('🔍 Detecting job details...');

            // Get page content
            const tabs = await new Promise<any[]>((resolve) =>
                chrome.tabs.query({ active: true, currentWindow: true }, resolve)
            );

            if (!tabs[0]?.id) throw new Error('No active tab');

            const pageContextResponse = await new Promise<any>((resolve, reject) => {
                const timeoutId = setTimeout(() => reject(new Error('Timeout')), 5000);
                chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTEXT' }, (response) => {
                    clearTimeout(timeoutId);
                    if (chrome.runtime.lastError) {
                        resolve(null); // Fail gracefully
                    } else {
                        resolve(response);
                    }
                });
            });

            if (pageContextResponse?.success && pageContextResponse.context?.pageText) {
                // Extract
                const extractionResponse = await chrome.runtime.sendMessage({
                    type: 'EXTRACT_JOB_DETAILS',
                    payload: {
                        pageContent: pageContextResponse.context.pageText,
                        apiKey: profile.apiKey
                    }
                });

                if (extractionResponse?.success) {
                    const details = JSON.parse(extractionResponse.data);
                    setDraftJob({
                        title: details.jobTitle || '',
                        company: details.companyName || '',
                        description: details.jobDescription || ''
                    });
                    setOptimizeStatus('');
                    return;
                }
            }
            setOptimizeStatus('');
        } catch (e) {
            console.warn('Auto-detect failed', e);
            setOptimizeStatus('');
        }
    };

    const handleGenerateOptimization = async () => {
        if (!draftJob.title || !draftJob.description) {
            alert("Please fill in Job Title and Description");
            return;
        }

        try {
            setIsOptimizing(true);
            setOptimizeStatus('✨ Generating optimized resume...');

            const optimizationResponse = await chrome.runtime.sendMessage({
                type: 'OPTIMIZE_RESUME',
                payload: {
                    originalResume: profile.resumeText,
                    jobDescription: draftJob.description,
                    jobTitle: draftJob.title,
                    companyName: draftJob.company || 'Unknown Company',
                    apiKey: profile.apiKey
                }
            });

            if (!optimizationResponse?.success) {
                throw new Error(optimizationResponse?.error || 'Optimization failed');
            }

            let result;
            try {
                const cleanData = typeof optimizationResponse.data === 'string'
                    ? optimizationResponse.data.replace(/```json\n?|\n?```/g, '').trim()
                    : optimizationResponse.data;
                result = typeof cleanData === 'string' ? JSON.parse(cleanData) : cleanData;
            } catch (e) {
                throw new Error('Failed to parse AI response');
            }

            // Save
            const newDoc: OptimizedDocument = {
                id: Date.now().toString(),
                jobTitle: draftJob.title,
                companyName: draftJob.company || 'Unknown Company',
                jobDescription: draftJob.description,
                createdAt: Date.now(),
                optimizedResume: result.optimizedResume,
                optimizedCoverLetter: result.optimizedCoverLetter,
                isActive: false // Will be activated if used
            };

            // Persist
            const stored = await new Promise<any>((resolve) => {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.get(['optimizedDocuments'], resolve);
                } else {
                    const saved = localStorage.getItem('optimizedDocuments');
                    resolve({ optimizedDocuments: saved ? JSON.parse(saved) : [] });
                }
            });
            const updatedDocs = [newDoc, ...(stored.optimizedDocuments || [])];
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ optimizedDocuments: updatedDocs });
            } else {
                localStorage.setItem('optimizedDocuments', JSON.stringify(updatedDocs));
            }

            setOptimizedResult(newDoc);
            setStatus('optimizing_preview');
            setOptimizeStatus(`✅ Optimized for ${draftJob.title}`);

        } catch (error: any) {
            console.error('Optimization error:', error);
            setOptimizeStatus(`❌ ${error.message}`);
        } finally {
            setIsOptimizing(false);
        }
    };

    const handleUseOptimized = () => {
        if (!optimizedResult) return;

        // Construct a profile that uses this resume
        const base64Resume = btoa(unescape(encodeURIComponent(optimizedResult.optimizedResume)));
        const fileName = `${optimizedResult.jobTitle.replace(/[^a-z0-9]/gi, '_')}_Resume.txt`;

        const tempProfile: UserProfile = {
            ...profile,
            resumeText: optimizedResult.optimizedResume,
            resumeBlob: base64Resume,
            resumeFileName: fileName,
            resumeMimeType: 'text/plain'
        };

        executeAutofill(tempProfile);
    };

    const handleDownload = (format: 'txt' | 'pdf') => {
        if (!optimizedResult) return;
        const content = previewMode === 'resume' ? optimizedResult.optimizedResume : optimizedResult.optimizedCoverLetter;
        const type = previewMode;
        const filename = `${optimizedResult.jobTitle.replace(/[^a-z0-9]/gi, '-')}-${optimizedResult.companyName.replace(/[^a-z0-9]/gi, '-')}-${type}`;

        if (format === 'txt') {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        } else {
            // PDF (Simple print view)
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(`<html><body><pre style="white-space: pre-wrap; font-family: monospace;">${content}</pre><script>window.print();</script></body></html>`);
                printWindow.document.close();
            }
        }
    };



    const executeAutofill = async (activeProfile: UserProfile) => {
        if (!activeProfile.apiKey) {
            alert("Please configure your Gemini API Key in Settings first.");
            return;
        }

        try {
            setStatus('scanning');
            addLog("Scanning page DOM for inputs...");

            let context, fields;

            // Feature: Scan ALL frames using webNavigation to find iframes (Greenhouse, etc.)
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
                const tabs = await new Promise<any[]>((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
                if (tabs[0]?.id) {
                    const tabId = tabs[0].id;
                    const currentUrl = tabs[0].url || '';
                    const isAshby = currentUrl.includes('ashby') || currentUrl.includes('jobs.ashbyhq.com');

                    let retries = isAshby ? 8 : 5;
                    let attempt = 0;
                    let bestResult = { fields: [] as any[], context: null as any, frameId: 0 };

                    while (attempt < retries) {
                        try {
                            attempt++;
                            if (attempt > 1) {
                                const delay = isAshby ? attempt * 1000 : attempt * 500;
                                addLog(`Retry ${attempt}/${retries} - waiting ${delay}ms...`);
                                await new Promise(resolve => setTimeout(resolve, delay));
                            }

                            // Get all frames
                            let frames = [{ frameId: 0 }]; // Default to top frame
                            if (chrome.webNavigation && chrome.webNavigation.getAllFrames) {
                                try {
                                    const allFrames = await new Promise<any[]>((resolve) =>
                                        chrome.webNavigation.getAllFrames({ tabId }, resolve)
                                    );
                                    if (allFrames && allFrames.length > 0) {
                                        frames = allFrames;
                                    }
                                } catch (e) {
                                    console.warn("webNavigation failed, falling back to top frame", e);
                                }
                            }

                            // Query ALL frames in parallel
                            const framePromises = frames.map(frame =>
                                new Promise<any>((resolve) => {
                                    chrome.tabs.sendMessage(
                                        tabId,
                                        { type: 'GET_PAGE_CONTEXT' },
                                        { frameId: frame.frameId },
                                        (response) => {
                                            if (chrome.runtime.lastError) {
                                                resolve(null); // Frame might not have content script or is restricted
                                            } else {
                                                resolve({ ...response, frameId: frame.frameId });
                                            }
                                        }
                                    );
                                })
                            );

                            const results = await Promise.all(framePromises);

                            // Find best result from this batch
                            for (const res of results) {
                                if (res && res.success && res.fields && res.fields.length > bestResult.fields.length) {
                                    bestResult = { fields: res.fields, context: res.context, frameId: res.frameId };
                                }
                            }

                            if (bestResult.fields.length > 0) {
                                context = bestResult.context;
                                fields = bestResult.fields;
                                targetFrameId.current = bestResult.frameId || 0;
                                addLog(`✅ Found ${bestResult.fields.length} fields on attempt ${attempt} (Frame ${targetFrameId.current})`);

                                // Optimization: If we found a good form, stop retrying
                                if (bestResult.fields.length >= 3) {
                                    break;
                                }
                            }

                        } catch (err) {
                            console.warn(`Scan attempt ${attempt} failed:`, err);
                        }
                    }
                }
            }

            // Fallback or Local Dev Mode if messaging failed or returned no data
            if (!context || !fields) {
                const scanResult = scanPage();
                if (!context) context = scanResult.context;
                // Only overwrite fields if we didn't get any from the extension
                if (!fields) fields = scanResult.fields;
            }

            if (!fields || fields.length === 0) {
                addLog("❌ No form fields found. Are you on a job application page?");

                // Get current URL to provide specific guidance
                if (typeof chrome !== 'undefined' && chrome.tabs) {
                    const tabs = await new Promise<any[]>((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
                    const currentUrl = tabs[0]?.url || '';

                    if (currentUrl.includes('ashby') || currentUrl.includes('jobs.ashbyhq.com')) {
                        addLog("💡 For Ashby: Click the 'Apply for this job' button first to open the application form.");
                        addLog("💡 Make sure the form modal is visible with fields like 'First Name', 'Email', etc.");
                    } else {
                        addLog("💡 Try scrolling down or clicking 'Apply' to load the form first.");
                    }
                }

                setStatus('error');
                return;
            }

            addLog(`Found ${fields.length} fields. Context: ${context.siteName || context.title}`);
            setStatus('thinking');
            addLog("Sending to Gemini 3 for semantic reasoning...");

            let aiResponse;
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                try {
                    console.log('[JobFiller] Sending PROCESS_FORM_DATA request', { profile: { ...activeProfile, resumeText: '[REDACTED]', resumeBlob: '[REDACTED]' }, fieldsCount: fields.length, context });

                    const response = await chrome.runtime.sendMessage({
                        type: 'PROCESS_FORM_DATA',
                        payload: { profile: activeProfile, fields, context }
                    });

                    console.log('[JobFiller] Received response:', response);

                    if (!response) {
                        throw new Error('No response from background script. Extension may need to be reloaded.');
                    }

                    if (!response.success) {
                        console.error('[JobFiller] Background script error:', response.error);
                        throw new Error(response.error);
                    }

                    try {
                        aiResponse = JSON.parse(response.data);
                    } catch (e) {
                        console.error("Failed to parse AI response:", response.data);
                        throw new Error("Invalid response from AI agent.");
                    }
                    console.log('[JobFiller] AI Response:', aiResponse);
                } catch (err: any) {
                    console.error('[JobFiller] Error during AI analysis:', err);
                    addLog(`❌ Error: ${err.message}`);
                    throw err;
                }
            } else {
                addLog("⚠️ Running in Preview Mode (No Background Service Worker) ⚠️");
                setStatus('error');
                return;
            }

            setStatus('filling');
            addLog(`AI identified ${aiResponse.length} fields to fill.`);

            // Applying changes - send each field to content script
            const tabs = await new Promise<any[]>((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
            if (tabs[0]?.id) {
                let successCount = 0;
                let failCount = 0;

                for (const item of aiResponse) {
                    try {
                        console.log(`[JobFiller] Filling field ${item.fieldId} with value:`, item.value);

                        const response = await new Promise<any>((resolve) =>
                            chrome.tabs.sendMessage(tabs[0].id, {
                                type: 'FILL_FIELD',
                                payload: {
                                    fieldId: item.fieldId,
                                    value: item.value
                                }
                            }, { frameId: targetFrameId.current || 0 }, resolve)
                        );

                        if (response && response.success) {
                            successCount++;
                            addLog(`✅ Filled: ${item.fieldId}`);
                        } else {
                            failCount++;
                            addLog(`⚠️ Failed: ${item.fieldId}`);
                            console.warn(`[JobFiller] Failed to fill ${item.fieldId}:`, response);
                        }
                    } catch (err) {
                        failCount++;
                        addLog(`❌ Error filling ${item.fieldId}: ${err}`);
                        console.error(`[JobFiller] Error filling ${item.fieldId}:`, err);
                    }
                }

                addLog(`Filled ${successCount} fields, ${failCount} failed.`);
            } else {
                addLog('⚠️ No active tab found for filling.');
            }

            // --- AUTO-ATTACHMENT MODULE ---
            if (activeProfile.resumeBlob) {
                setStatus('uploading');
                addLog("Attempting auto-attachment of resume...");

                if (typeof chrome !== 'undefined' && chrome.tabs) {
                    const tabs = await new Promise<any[]>((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
                    if (tabs[0]?.id) {
                        const response = await new Promise<any>((resolve) =>
                            chrome.tabs.sendMessage(tabs[0].id, {
                                type: 'ATTACH_RESUME',
                                payload: {
                                    resumeBlob: activeProfile.resumeBlob,
                                    fileName: activeProfile.resumeFileName || 'Resume.pdf',
                                    mimeType: activeProfile.resumeMimeType || 'application/pdf'
                                }
                            }, resolve)
                        );

                        if (response && response.success) {
                            addLog("✅ Resume automatically attached for review.");
                        } else {
                            addLog("⚠️ Could not detect a valid 'Resume' upload field.");
                        }
                    }
                } else {
                    addLog("Simulating attachment in Dev Mode...");
                    // Local mock
                    setTimeout(() => addLog("✅ Resume attached (Mock)."), 500);
                }
            } else {
                addLog("⚠️ No resume file available. Please upload a resume in Settings.");
            }

            setStatus('complete');
            addLog("Job Application Sequence Complete.");

            // --- HISTORY TRACKING ---
            const endTime = Date.now();
            const durationSeconds = Math.round((endTime - (startTimeRef.current || endTime)) / 1000);

            // Heuristic for manual time: 5 mins base + 2 min per 5 fields filled
            const manualSeconds = 300 + (aiResponse ? aiResponse.length * 90 : 300);

            const newHistoryEntry: ApplicationEntry = {
                id: Date.now().toString(),
                date: new Date().toISOString(),
                company: draftJob.company || context?.siteName || 'Unknown Company',
                role: draftJob.title || context?.title || 'Unknown Role',
                autofillTimeSeconds: durationSeconds > 0 ? durationSeconds : 10, // Min 10s fallback
                estimatedManualTimeSeconds: manualSeconds,
                status: 'applied'
            };

            const updatedHistory = [newHistoryEntry, ...(profile.applicationHistory || [])];
            onUpdateProfile({ ...profile, applicationHistory: updatedHistory });

        } catch (e: any) {
            console.error(e);
            setStatus('error');
            addLog(`Error: ${e.message}`);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white font-sans text-gray-900 overflow-hidden">
            {/* --- Status Header (Only show if busy or regular view) --- */}
            {status !== 'prompt_resume_choice' && status !== 'optimizing_input' && status !== 'optimizing_preview' && (
                <div className="p-4 flex flex-col items-center justify-center space-y-4 border-b border-gray-100 pb-6">
                    <div className="text-center">
                        <h2 className="text-xl font-bold">Job-Agent AI</h2>
                        <p className="text-sm text-gray-500 mt-1">Manifest V3 • Local-First • Gemini 3</p>
                    </div>

                    <div className={`
                        w-20 h-20 rounded-full flex items-center justify-center border-4 transition-all duration-500
                        ${status === 'idle' ? 'border-gray-200 bg-gray-50' : ''}
                        ${status === 'scanning' ? 'border-blue-400 bg-blue-50 animate-pulse' : ''}
                        ${status === 'thinking' ? 'border-purple-500 bg-purple-50 animate-bounce' : ''}
                        ${status === 'filling' ? 'border-green-400 bg-green-50' : ''}
                        ${status === 'uploading' ? 'border-yellow-400 bg-yellow-50 animate-pulse' : ''}
                        ${status === 'complete' ? 'border-green-600 bg-green-100' : ''}
                        ${status === 'error' ? 'border-red-500 bg-red-50' : ''}
                    `}>
                        {status === 'idle' && <span className="text-3xl">🚀</span>}
                        {status === 'scanning' && <span className="text-3xl">👀</span>}
                        {status === 'thinking' && <span className="text-3xl">🧠</span>}
                        {status === 'filling' && <span className="text-3xl">✍️</span>}
                        {status === 'uploading' && <span className="text-3xl">📂</span>}
                        {status === 'complete' && <span className="text-3xl">✅</span>}
                        {status === 'error' && <span className="text-3xl">❌</span>}
                    </div>

                    {status === 'idle' && (
                        <div className="w-full max-w-sm space-y-6">
                            <button
                                onClick={startWorkflow}
                                className="w-full py-3 px-6 bg-gray-900 text-white rounded-lg font-bold shadow hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                            >
                                <span>⚡</span> Auto-Fill Application
                            </button>

                            {/* Metrics Dashboard */}
                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 text-center">Metrics</h3>
                                <div className="grid grid-cols-4 gap-2 text-center">
                                    <div className="flex flex-col">
                                        <span className="text-lg font-bold text-gray-900">{totalJobs}</span>
                                        <span className="text-[10px] text-gray-500 leading-tight">Jobs Applied</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-lg font-bold text-blue-600">{formatDuration(totalAutofillSeconds)}</span>
                                        <span className="text-[10px] text-gray-500 leading-tight">Autofill Time</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-lg font-bold text-gray-600">{formatDuration(totalManualSeconds)}</span>
                                        <span className="text-[10px] text-gray-500 leading-tight">Manual Time</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-lg font-bold text-green-600">{formatDuration(totalSavedSeconds)}</span>
                                        <span className="text-[10px] text-gray-500 leading-tight">Saved Time</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {(status !== 'idle' && status !== 'complete' && status !== 'error') && (
                        <div className="text-sm font-medium text-gray-700 animate-pulse">
                            {status.toUpperCase()}...
                        </div>
                    )}
                    {(status === 'complete' || status === 'error') && (
                        <div className="flex flex-col items-center gap-2">
                            <button onClick={() => setStatus('idle')} className="text-sm text-blue-600 underline">Reset</button>
                            {status === 'complete' && (
                                <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                                    History Updated! Check "Resume Hub &gt; History"
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* --- WORKFLOW: Step 1 - Prompt --- */}
            {status === 'prompt_resume_choice' && (
                <div className="flex-1 flex flex-col p-6 items-center justify-center space-y-6 animate-fade-in-up">
                    <h3 className="text-lg font-bold text-center">Resume & Autofill</h3>
                    <p className="text-sm text-gray-500 text-center">Do you want to use your existing resume or create a tailored one for this job?</p>

                    <button
                        onClick={handleUseCurrent}
                        className="w-full py-4 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-bold border border-gray-300 transition-all text-left flex items-center gap-3"
                    >
                        <span className="text-xl">📄</span>
                        <div>
                            <div className="text-sm font-bold">Use Current Resume</div>
                            <div className="text-xs text-gray-500 font-normal">Fastest. Uses your default profile resume.</div>
                        </div>
                    </button>

                    <button
                        onClick={handleStartOptimize}
                        className="w-full py-4 px-4 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 text-gray-900 rounded-lg font-bold border border-blue-200 transition-all text-left flex items-center gap-3"
                    >
                        <span className="text-xl">✨</span>
                        <div>
                            <div className="text-sm font-bold">Optimize for This Job</div>
                            <div className="text-xs text-gray-500 font-normal">Recommended. Tailors resume to match keywords.</div>
                        </div>
                    </button>

                    <button
                        onClick={() => setStatus('idle')}
                        className="text-gray-400 text-sm hover:text-gray-600"
                    >
                        Cancel
                    </button>
                </div>
            )}

            {/* --- WORKFLOW: Step 2 - Optimization Input --- */}
            {status === 'optimizing_input' && (
                <div className="flex-1 flex flex-col p-4 overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold">Optimize Resume</h3>
                        <button onClick={() => setStatus('prompt_resume_choice')} className="text-xs text-gray-400">Back</button>
                    </div>

                    <div className="space-y-3 flex-1">
                        {optimizeStatus && (
                            <div className="bg-blue-50 text-blue-800 text-xs p-2 rounded flex items-center gap-2">
                                <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                {optimizeStatus}
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Job Title</label>
                            <input
                                className="w-full border rounded p-2 text-sm"
                                value={draftJob.title}
                                onChange={e => setDraftJob({ ...draftJob, title: e.target.value })}
                                placeholder="e.g. Senior Product Designer"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Company</label>
                            <input
                                className="w-full border rounded p-2 text-sm"
                                value={draftJob.company}
                                onChange={e => setDraftJob({ ...draftJob, company: e.target.value })}
                                placeholder="e.g. Acme Corp"
                            />
                        </div>
                        <div className="flex-1 flex flex-col">
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Job Description</label>
                            <textarea
                                className="w-full border rounded p-2 text-sm flex-1 font-mono min-h-[150px]"
                                value={draftJob.description}
                                onChange={e => setDraftJob({ ...draftJob, description: e.target.value })}
                                placeholder="Paste job description here if not auto-detected..."
                            />
                        </div>
                        <button
                            onClick={handleGenerateOptimization}
                            disabled={isOptimizing}
                            className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold shadow hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isOptimizing ? 'Generating...' : '✨ Generate & Optimize'}
                        </button>
                    </div>
                </div>
            )}

            {/* --- WORKFLOW: Step 3 - Preview & Action --- */}
            {status === 'optimizing_preview' && optimizedResult && (
                <div className="flex-1 flex flex-col p-4 overflow-hidden">
                    <div className="flex justify-between items-center mb-2">
                        <div>
                            <h3 className="font-bold text-sm text-green-700">✅ Optimization Complete</h3>
                            <p className="text-xs text-gray-500">{optimizedResult.jobTitle} @ {optimizedResult.companyName}</p>
                        </div>
                        <div className="flex bg-gray-100 rounded p-1">
                            <button
                                onClick={() => setPreviewMode('resume')}
                                className={`px-3 py-1 text-xs rounded ${previewMode === 'resume' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500'}`}
                            >Resume</button>
                            <button
                                onClick={() => setPreviewMode('cover')}
                                className={`px-3 py-1 text-xs rounded ${previewMode === 'cover' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-500'}`}
                            >Cover Letter</button>
                        </div>
                    </div>

                    <div className="flex-1 border rounded bg-gray-50 p-2 overflow-y-auto mb-3">
                        <pre className="text-xs whitespace-pre-wrap font-mono text-gray-700">
                            {previewMode === 'resume' ? optimizedResult.optimizedResume : optimizedResult.optimizedCoverLetter}
                        </pre>
                    </div>

                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <button onClick={() => handleDownload('txt')} className="flex-1 bg-gray-100 py-2 rounded text-xs text-gray-700 font-medium hover:bg-gray-200">Download TXT</button>
                            <button onClick={() => handleDownload('pdf')} className="flex-1 bg-gray-100 py-2 rounded text-xs text-gray-700 font-medium hover:bg-gray-200">Download PDF</button>
                        </div>
                        <button
                            onClick={handleUseOptimized}
                            className="w-full py-3 bg-green-600 text-white rounded-lg font-bold shadow hover:bg-green-700 flex items-center justify-center gap-2"
                        >
                            <span>🚀</span> Continue to Autofill
                        </button>
                        <button
                            onClick={handleUseCurrent}
                            className="w-full py-2 text-xs text-gray-500 hover:text-gray-700"
                        >
                            Skip & Use Original Resume
                        </button>
                    </div>
                </div>
            )}

            {/* --- Logs (Bottom) --- */}
            {(status === 'scanning' || status === 'thinking' || status === 'filling' || status === 'uploading' || status === 'complete' || status === 'error') && (
                <div className="flex-1 bg-gray-900 text-green-400 font-mono text-xs p-4 overflow-y-auto border-t border-gray-800">
                    <div className="mb-2 uppercase border-b border-gray-700 pb-1">System Logs</div>
                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
            )}
        </div>
    );
};