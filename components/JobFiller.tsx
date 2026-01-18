import React, { useState } from 'react';
import { UserProfile, OptimizedDocument } from '../types';
import { scanPage } from '../utils/domFunctions';

declare var chrome: any;

interface JobFillerProps {
    profile: UserProfile;
}

export const JobFiller: React.FC<JobFillerProps> = ({ profile }) => {
    const [status, setStatus] = useState<'idle' | 'scanning' | 'thinking' | 'filling' | 'uploading' | 'complete' | 'error'>('idle');
    const [logs, setLogs] = useState<string[]>([]);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizeStatus, setOptimizeStatus] = useState('');

    const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

    // Quick Resume Optimization from current job page
    const handleQuickOptimize = async () => {
        if (!profile.apiKey) {
            alert("Please configure your Gemini API Key in Settings first.");
            return;
        }

        if (!profile.resumeText) {
            alert("Please upload your base resume in Config → Resume first.");
            return;
        }

        try {
            setIsOptimizing(true);
            setOptimizeStatus('🔍 Reading job details from page...');

            // Get page content
            const tabs = await new Promise<any[]>((resolve) =>
                chrome.tabs.query({ active: true, currentWindow: true }, resolve)
            );

            if (!tabs[0]?.id) {
                throw new Error('No active tab');
            }

            const pageContextResponse = await new Promise<any>((resolve, reject) => {
                const timeoutId = setTimeout(() => reject(new Error('Timeout')), 5000);
                chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTEXT' }, (response) => {
                    clearTimeout(timeoutId);
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });

            if (!pageContextResponse?.success) {
                throw new Error('Could not read page');
            }

            const pageText = pageContextResponse.context?.pageText || '';

            setOptimizeStatus('🤖 AI analyzing job posting...');

            // Extract job details
            const extractionResponse = await chrome.runtime.sendMessage({
                type: 'EXTRACT_JOB_DETAILS',
                payload: {
                    pageContent: pageText,
                    apiKey: profile.apiKey
                }
            });

            if (!extractionResponse?.success) {
                throw new Error('Could not extract job details');
            }

            const jobDetails = JSON.parse(extractionResponse.data);

            if (!jobDetails.jobTitle || !jobDetails.jobDescription) {
                alert('Could not detect job details from this page. Please use Config → Optimized Resume for manual entry.');
                return;
            }

            setOptimizeStatus(`✨ Generating optimized resume for ${jobDetails.jobTitle}...`);

            // Generate optimized resume
            const optimizationResponse = await chrome.runtime.sendMessage({
                type: 'OPTIMIZE_RESUME',
                payload: {
                    originalResume: profile.resumeText,
                    jobDescription: jobDetails.jobDescription,
                    jobTitle: jobDetails.jobTitle,
                    companyName: jobDetails.companyName || 'Unknown Company',
                    apiKey: profile.apiKey
                }
            });

            if (!optimizationResponse?.success) {
                throw new Error(optimizationResponse?.error || 'Optimization failed');
            }

            console.log('[JobFiller] Optimization response:', optimizationResponse);

            let result;
            try {
                // Ensure data exists
                if (!optimizationResponse.data) {
                    throw new Error('No data received from AI');
                }

                // Clean markdown code blocks if present
                const cleanData = typeof optimizationResponse.data === 'string'
                    ? optimizationResponse.data.replace(/```json\n?|\n?```/g, '').trim()
                    : optimizationResponse.data;

                result = typeof cleanData === 'string' ? JSON.parse(cleanData) : cleanData;
            } catch (e) {
                console.error('[JobFiller] JSON Parse Error:', e);
                console.log('[JobFiller] Raw data:', optimizationResponse.data);
                throw new Error('Failed to parse AI response. Pls try again.');
            }

            // Save the optimized document
            const newDoc: OptimizedDocument = {
                id: Date.now().toString(),
                jobTitle: jobDetails.jobTitle,
                companyName: jobDetails.companyName || 'Unknown Company',
                jobDescription: jobDetails.jobDescription,
                createdAt: Date.now(),
                optimizedResume: result.optimizedResume,
                optimizedCoverLetter: result.optimizedCoverLetter,
                isActive: false
            };

            // Load existing documents
            const stored = await new Promise<any>((resolve) => {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.get(['optimizedDocuments'], resolve);
                } else {
                    const saved = localStorage.getItem('optimizedDocuments');
                    resolve({ optimizedDocuments: saved ? JSON.parse(saved) : [] });
                }
            });

            const existingDocs = stored.optimizedDocuments || [];
            const updatedDocs = [newDoc, ...existingDocs];

            // Save updated documents
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ optimizedDocuments: updatedDocs });
            } else {
                localStorage.setItem('optimizedDocuments', JSON.stringify(updatedDocs));
            }

            setOptimizeStatus(`✅ Success! Resume optimized for ${jobDetails.jobTitle}. Check Config → Optimized Resume to view and download.`);

            setTimeout(() => {
                setIsOptimizing(false);
                setOptimizeStatus('');
            }, 5000);

        } catch (error: any) {
            console.error('Quick optimize error:', error);
            setOptimizeStatus(`❌ ${error.message}`);
            setTimeout(() => {
                setIsOptimizing(false);
                setOptimizeStatus('');
            }, 5000);
        }
    };


    const handleRun = async () => {
        if (!profile.apiKey) {
            alert("Please configure your Gemini API Key in Settings first.");
            return;
        }

        try {
            setStatus('scanning');
            addLog("Scanning page DOM for inputs...");

            let context, fields;

            // Feature: Check if running in extension mode to use proper tab messaging for scanning
            if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
                const tabs = await new Promise<any[]>((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
                if (tabs[0]?.id) {
                    // Get the current URL to detect Ashby
                    const currentUrl = tabs[0].url || '';
                    const isAshby = currentUrl.includes('ashby') || currentUrl.includes('jobs.ashbyhq.com');

                    // Ashby needs more aggressive retries due to heavy async rendering
                    let retries = isAshby ? 8 : 5;
                    let attempt = 0;
                    let maxFieldsFound = 0;

                    if (isAshby) {
                        addLog(`🔍 Detected Ashby application - using extended retry strategy`);
                    }

                    while (attempt < retries) {
                        try {
                            attempt++;
                            if (attempt > 1) {
                                // Ashby: Longer delays (1s, 2s, 3s, 4s, 5s, 6s, 7s, 8s)
                                // Greenhouse/Other: Standard delays (500ms, 1s, 1.5s, 2s, 2.5s)
                                const delay = isAshby ? attempt * 1000 : attempt * 500;
                                addLog(`Retry ${attempt}/${retries} - waiting ${delay}ms for form to load...`);
                                await new Promise(resolve => setTimeout(resolve, delay));
                            }

                            const response = await new Promise<any>((resolve) =>
                                chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTEXT' }, resolve)
                            );

                            if (response && response.success) {
                                const tempContext = response.context;
                                const tempFields = response.fields;

                                // Always keep the scan with the most fields found
                                if (tempFields && tempFields.length > maxFieldsFound) {
                                    maxFieldsFound = tempFields.length;
                                    context = tempContext;
                                    fields = tempFields;
                                    addLog(`✅ Found ${tempFields.length} fields on attempt ${attempt}`);

                                    // If we found a good number of fields, we can stop early
                                    if (tempFields.length >= 5) {
                                        addLog(`✅ Found sufficient fields, proceeding with form fill`);
                                        break;
                                    }
                                }
                            }
                        } catch (err) {
                            console.warn(`Scan attempt ${attempt} failed:`, err);
                            addLog(`⚠️ Scan attempt ${attempt} failed, retrying...`);
                        }
                    }

                    // Log final result
                    if (maxFieldsFound > 0) {
                        addLog(`📊 Final result: ${maxFieldsFound} fields detected after ${attempt} attempts`);
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
                    console.log('[JobFiller] Sending PROCESS_FORM_DATA request', { profile: { ...profile, resumeText: '[REDACTED]', resumeBlob: '[REDACTED]' }, fieldsCount: fields.length, context });

                    const response = await chrome.runtime.sendMessage({
                        type: 'PROCESS_FORM_DATA',
                        payload: { profile, fields, context }
                    });

                    console.log('[JobFiller] Received response:', response);

                    if (!response) {
                        throw new Error('No response from background script. Extension may need to be reloaded.');
                    }

                    if (!response.success) {
                        console.error('[JobFiller] Background script error:', response.error);
                        throw new Error(response.error);
                    }

                    aiResponse = JSON.parse(response.data);
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
                            }, resolve)
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
            if (profile.resumeBlob) {
                setStatus('uploading');
                addLog("Attempting auto-attachment of resume...");

                if (typeof chrome !== 'undefined' && chrome.tabs) {
                    const tabs = await new Promise<any[]>((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
                    if (tabs[0]?.id) {
                        const response = await new Promise<any>((resolve) =>
                            chrome.tabs.sendMessage(tabs[0].id, {
                                type: 'ATTACH_RESUME',
                                payload: {
                                    resumeBlob: profile.resumeBlob,
                                    fileName: profile.resumeFileName || 'Resume.pdf',
                                    mimeType: profile.resumeMimeType || 'application/pdf'
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

        } catch (e: any) {
            console.error(e);
            setStatus('error');
            addLog(`Error: ${e.message}`);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="p-6 flex flex-col items-center justify-center space-y-6">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-900">Job-Agent AI</h2>
                    <p className="text-sm text-gray-500 mt-1">Manifest V3 • Local-First • Gemini 3</p>
                </div>

                <div className={`
            w-24 h-24 rounded-full flex items-center justify-center border-4 transition-all duration-500
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

                <button
                    onClick={handleRun}
                    disabled={status !== 'idle' && status !== 'complete' && status !== 'error'}
                    className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg font-bold shadow hover:bg-gray-800 disabled:opacity-50 transition-all"
                >
                    {status === 'idle' ? 'Auto-Fill Application' : status.toUpperCase()}
                </button>

                {/* Quick Optimize Button */}
                <div className="w-full border-t border-gray-200 pt-4">
                    <button
                        onClick={handleQuickOptimize}
                        disabled={isOptimizing}
                        className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-bold shadow-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    >
                        {isOptimizing ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Optimizing...
                            </>
                        ) : (
                            <>
                                ✨ Optimize Resume for This Job
                            </>
                        )}
                    </button>
                    {optimizeStatus && (
                        <div className={`mt-2 text-xs text-center px-3 py-2 rounded ${optimizeStatus.startsWith('✅') ? 'bg-green-50 text-green-800' : optimizeStatus.startsWith('❌') ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-800'}`}>
                            {optimizeStatus}
                        </div>
                    )}
                    <p className="text-xs text-gray-500 text-center mt-2">
                        Automatically detects job details and creates<br />
                        optimized resume + cover letter in one click
                    </p>
                </div>
            </div>

            <div className="flex-1 bg-gray-900 text-green-400 font-mono text-xs p-4 overflow-y-auto">
                <div className="mb-2 uppercase border-b border-gray-700 pb-1">System Logs</div>
                {logs.length === 0 ? (
                    <span className="text-gray-600 italic">Waiting for command...</span>
                ) : (
                    logs.map((log, i) => <div key={i}>{log}</div>)
                )}
            </div>
        </div>
    );
};