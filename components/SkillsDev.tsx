import React, { useState } from 'react';
import { UserProfile } from '../types';
import { RemoteLogger } from '../utils/RemoteLogger';

declare var chrome: any;

interface SkillsDevProps {
    profile: UserProfile;
}

export const SkillsDev: React.FC<SkillsDevProps> = ({ profile }) => {
    const [status, setStatus] = useState<'idle' | 'detecting' | 'analyzing' | 'complete' | 'error'>('idle');
    const [jobDetails, setJobDetails] = useState<{ title: string; company: string; description: string } | null>(null);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');

    const handleAutoDetect = async () => {
        if (!profile.apiKey) {
            alert("Please configure your API Key in Settings first.");
            return;
        }

        setStatus('detecting');
        setErrorMsg('');

        try {
            // Get page content
            const tabs = await new Promise<any[]>((resolve) =>
                chrome.tabs.query({ active: true, currentWindow: true }, resolve)
            );

            if (!tabs[0]?.id) throw new Error('No active tab');

            const pageContextResponse = await new Promise<any>((resolve, reject) => {
                const timeoutId = setTimeout(() => reject(new Error('Page scan timed out. Try reloading the page.')), 5000);
                chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTEXT' }, (response) => {
                    clearTimeout(timeoutId);
                    if (chrome.runtime.lastError) {
                        resolve(null);
                    } else {
                        resolve(response);
                    }
                });
            });

            if (pageContextResponse?.success && pageContextResponse.context?.pageText) {
                // Extract Job Details
                RemoteLogger.log("Sending EXTRACT_JOB_DETAILS message", { pageContentLength: pageContextResponse.context.pageText.length });
                const extractionResponse = await chrome.runtime.sendMessage({
                    type: 'EXTRACT_JOB_DETAILS',
                    payload: {
                        pageContent: pageContextResponse.context.pageText,
                        apiKey: profile.apiKey
                    }
                });
                RemoteLogger.log("Received EXTRACT_JOB_DETAILS response", extractionResponse);

                if (extractionResponse?.success) {
                    let details;
                    try {
                        details = JSON.parse(extractionResponse.data);
                    } catch (parseError) {
                        RemoteLogger.error("Failed to parse extraction response data:", extractionResponse.data);
                        throw new Error("Received invalid data format from extraction service.");
                    }

                    if (!details.jobDescription) {
                        throw new Error("Could not detect a job description on this page.");
                    }
                    setJobDetails({
                        title: details.jobTitle || 'Unknown Role',
                        company: details.companyName || 'Unknown Company',
                        description: details.jobDescription
                    });

                    // Proceed immediately to analysis
                    setStatus('analyzing');
                    await analyzeGap(details.jobDescription);
                } else {
                    RemoteLogger.error("Extraction failed. Response:", extractionResponse);
                    throw new Error(extractionResponse?.error || "Failed to extract job details. No specific error returned.");
                }
            } else {
                throw new Error("Could not read page content. Please ensure you are on a job page.");
            }

        } catch (e: any) {
            RemoteLogger.error("Auto detect failure", e);
            setErrorMsg(e.message);
            setStatus('error');
        }
    };

    // Helper for hashing
    const generateHash = (str: string): string => {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    };

    const analyzeGap = async (jobDescription: string) => {
        const jdHash = generateHash(jobDescription);

        try {
            // --- EFFICIENCY LOOP: Check Cache ---
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const result = await new Promise<any>((resolve) => {
                    chrome.storage.local.get(['skillsGapCache'], (res) => {
                        resolve(res.skillsGapCache || {});
                    });
                });

                if (result[jdHash]) {
                    console.log('⚡ Loaded skills gap from cache');
                    setAnalysisResult(result[jdHash]);
                    setStatus('complete');
                    return;
                }
            }
            // ------------------------------------

            const response = await chrome.runtime.sendMessage({
                type: 'ANALYZE_SKILLS_GAP',
                payload: {
                    resumeText: profile.resumeText,
                    jobDescription: jobDescription,
                    apiKey: profile.apiKey
                }
            });

            if (response && response.success) {
                let data = response.data;
                if (typeof data === 'string') {
                    try {
                        data = JSON.parse(data);
                    } catch (e) {
                        // keep as string if parse fails
                        console.error('Parse error', e); // local parse error, keep console or remote? Remote is better.
                        RemoteLogger.error('Parse error during skills gap', e);
                    }
                }
                setAnalysisResult(data);

                // --- Save to Cache ---
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.get(['skillsGapCache'], (res) => {
                        const cache = res.skillsGapCache || {};
                        // Limit cache size? For now, unlimited logic is fine, maybe truncate if > 50
                        const newCache = { ...cache, [jdHash]: data };
                        chrome.storage.local.set({ skillsGapCache: newCache });
                    });
                }
                // ---------------------

                setStatus('complete');
            } else {
                throw new Error(response?.error || "Analysis failed.");
            }
        } catch (e: any) {
            RemoteLogger.error("Gap analysis failure", e);
            setErrorMsg(e.message);
            setStatus('error');
        }
    };

    return (
        <div className="h-full bg-gray-50 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Header Section */}
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Skills Gap Analysis</h2>
                    <p className="text-sm text-gray-500 mb-6">
                        Automatically detect the job description from your current tab and compare it against your resume to find missing skills and recommended courses.
                    </p>

                    {status === 'idle' || status === 'error' ? (
                        <div>
                            {status === 'error' && (
                                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm border border-red-200">
                                    ❌ {errorMsg}
                                </div>
                            )}
                            <button
                                onClick={handleAutoDetect}
                                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700 transition flex items-center justify-center gap-2"
                            >
                                <span>🔍</span> Detect Job & Analyze Gaps
                            </button>
                        </div>
                    ) : (
                        <div className="p-8 flex flex-col items-center justify-center space-y-4">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                            <p className="text-blue-600 font-medium animate-pulse">
                                {status === 'detecting' ? 'Scanning Page for Job Details...' : 'Analyzing Skills Gap & Finding Courses...'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Results Section */}
                {status === 'complete' && analysisResult && (
                    <div className="space-y-6 animate-fade-in-up">

                        {/* Job Context */}
                        {jobDetails && (
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-blue-900">{jobDetails.title}</h3>
                                    <p className="text-sm text-blue-700">{jobDetails.company}</p>
                                </div>
                                <span className="px-3 py-1 bg-white text-blue-600 text-xs font-bold rounded-full shadow-sm">
                                    Active Analysis
                                </span>
                            </div>
                        )}

                        {/* Thorough Analysis */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Gap Analysis</h3>
                            <div className="prose prose-sm text-gray-700 max-w-none whitespace-pre-wrap">
                                {analysisResult.analysis}
                            </div>

                            {/* Identified Gaps */}
                            <div className="mt-6 grid gap-4">
                                {analysisResult.gaps?.map((gap: any, idx: number) => (
                                    <div key={idx} className="flex gap-4 p-3 bg-red-50 rounded border border-red-100">
                                        <div className="flex-shrink-0 mt-0.5">
                                            <span className="text-red-500 font-bold">⚠️</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-red-900">{gap.skill}</span>
                                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${gap.importance === 'High' ? 'bg-red-200 text-red-800' :
                                                    gap.importance === 'Medium' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-800'
                                                    }`}>{gap.importance} Importance</span>
                                            </div>
                                            <p className="text-sm text-red-800">{gap.explanation}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Coursera Recommendations */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <div className="flex items-center gap-2 mb-4 border-b pb-2">
                                <span className="text-2xl">🎓</span>
                                <h3 className="text-lg font-bold text-gray-900">Recommended Coursera Courses</h3>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                {analysisResult.courses?.map((course: any, idx: number) => (
                                    <a
                                        key={idx}
                                        href={course.url || `https://www.coursera.org/search?query=${encodeURIComponent(course.title)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block p-4 rounded-lg border border-gray-200 hover:border-blue-400 hover:shadow-md transition group bg-white h-full flex flex-col"
                                    >
                                        <div className="mb-2">
                                            <h4 className="font-bold text-blue-600 group-hover:underline text-sm mb-1">{course.title}</h4>
                                            <p className="text-xs text-gray-500 font-medium bg-gray-100 inline-block px-2 py-0.5 rounded">{course.provider}</p>
                                        </div>

                                        <div className="flex-1 space-y-2">
                                            {course.description && (
                                                <p className="text-xs text-gray-800 line-clamp-3" title={course.description}>
                                                    {course.description}
                                                </p>
                                            )}

                                            <div className="bg-blue-50 p-2 rounded border border-blue-100">
                                                <p className="text-xs text-blue-800 italic">
                                                    "{course.reasoning}"
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-3 text-xs text-blue-500 font-medium flex items-center gap-1 pt-2 border-t border-gray-100">
                                            {course.url ? 'Go to Course' : 'Search on Coursera'} <span>→</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                            {(!analysisResult.courses || analysisResult.courses.length === 0) && (
                                <p className="text-gray-500 text-sm italic">No specific course recommendations found.</p>
                            )}
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};
