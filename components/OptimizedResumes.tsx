import React, { useState, useEffect } from 'react';
import { UserProfile, OptimizedDocument } from '../types';

declare var chrome: any;

interface OptimizedResumesProps {
    profile: UserProfile;
    onSave: (profile: UserProfile) => void;
}

export const OptimizedResumes: React.FC<OptimizedResumesProps> = ({ profile, onSave }) => {
    const [documents, setDocuments] = useState<OptimizedDocument[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showNewDocModal, setShowNewDocModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<OptimizedDocument | null>(null);
    const [previewMode, setPreviewMode] = useState<'resume' | 'cover'>('resume');


    // Form state for new document
    const [jobTitle, setJobTitle] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [jobDescription, setJobDescription] = useState('');
    const [isDetecting, setIsDetecting] = useState(false);

    // Toast state
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    useEffect(() => {
        loadDocuments();
    }, []);

    useEffect(() => {
        if (showToast) {
            const timer = setTimeout(() => setShowToast(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showToast]);

    const triggerToast = (msg: string) => {
        setToastMessage(msg);
        setShowToast(true);
    };

    const loadDocuments = async () => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['optimizedDocuments'], (result) => {
                if (result.optimizedDocuments) {
                    setDocuments(result.optimizedDocuments);
                }
            });
        } else {
            const saved = localStorage.getItem('optimizedDocuments');
            if (saved) {
                setDocuments(JSON.parse(saved));
            }
        }
    };

    const saveDocuments = (docs: OptimizedDocument[]) => {
        setDocuments(docs);
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ optimizedDocuments: docs });
        } else {
            localStorage.setItem('optimizedDocuments', JSON.stringify(docs));
        }
    };

    const handleAutoDetect = async () => {
        if (!profile.apiKey) {
            triggerToast('⚠️ Please add your API key in Settings first');
            return;
        }

        try {
            setIsDetecting(true);
            console.log('[OptimizedResumes] Starting auto-detection...');

            // Check if we're in extension context
            if (typeof chrome === 'undefined' || !chrome.tabs) {
                throw new Error('Extension context not available');
            }

            // Get current page context from content script
            console.log('[OptimizedResumes] Querying active tab...');
            const tabs = await new Promise<any[]>((resolve) =>
                chrome.tabs.query({ active: true, currentWindow: true }, resolve)
            );

            if (!tabs[0]?.id) {
                throw new Error('No active tab found');
            }

            console.log('[OptimizedResumes] Active tab:', tabs[0].url);

            // Send message to content script
            console.log('[OptimizedResumes] Requesting page context...');
            const pageContextResponse = await new Promise<any>((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error('Timeout waiting for page content. Try refreshing the page.'));
                }, 5000);

                chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTEXT' }, (response) => {
                    clearTimeout(timeoutId);
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });

            console.log('[OptimizedResumes] Page context response:', pageContextResponse);

            if (!pageContextResponse || !pageContextResponse.success) {
                throw new Error('Failed to read page content. Make sure you\'re on a job posting page and try refreshing.');
            }

            const pageText = pageContextResponse.context?.pageText || '';

            if (!pageText || pageText.length < 50) {
                throw new Error('Page content is too short. Navigate to the job posting page and try again.');
            }

            console.log('[OptimizedResumes] Page text length:', pageText.length);
            console.log('[OptimizedResumes] Extracting job details with AI...');

            // Extract job details using AI
            const response = await chrome.runtime.sendMessage({
                type: 'EXTRACT_JOB_DETAILS',
                payload: {
                    pageContent: pageText,
                    apiKey: profile.apiKey
                }
            });

            console.log('[OptimizedResumes] AI extraction response:', response);

            if (!response || !response.success) {
                throw new Error(response?.error || 'AI extraction failed. Please try again or enter details manually.');
            }

            const result = JSON.parse(response.data);
            console.log('[OptimizedResumes] Extracted data:', result);

            if (!result.jobTitle && !result.companyName && !result.jobDescription) {
                triggerToast('⚠️ This doesn\'t look like a job posting. Please enter details manually.');
                return;
            }

            // Pre-fill the form
            if (result.jobTitle) {
                console.log('[OptimizedResumes] Setting job title:', result.jobTitle);
                setJobTitle(result.jobTitle);
            }
            if (result.companyName) {
                console.log('[OptimizedResumes] Setting company name:', result.companyName);
                setCompanyName(result.companyName);
            }
            if (result.jobDescription) {
                console.log('[OptimizedResumes] Setting job description length:', result.jobDescription.length);
                setJobDescription(result.jobDescription);
            }

            const fieldsFound = [result.jobTitle, result.companyName, result.jobDescription].filter(Boolean).length;
            triggerToast(`✅ Detected ${fieldsFound}/3 fields - review and edit as needed!`);

        } catch (error: any) {
            console.error('[OptimizedResumes] Error auto-detecting job details:', error);
            triggerToast(`⚠️ ${error.message}`);
        } finally {
            setIsDetecting(false);
        }
    };


    const handleOpenModal = () => {
        // Reset form
        setJobTitle('');
        setCompanyName('');
        setJobDescription('');
        setShowNewDocModal(true);

        // DON'T auto-detect - let user click a button to do it
        // This prevents excessive scanning
    };


    const handleGenerate = async () => {
        if (!profile.apiKey) {
            triggerToast('⚠️ Please add your API key in Settings');
            return;
        }

        if (!profile.resumeText) {
            triggerToast('⚠️ Please upload your resume in Settings first');
            return;
        }

        if (!jobTitle || !companyName || !jobDescription) {
            triggerToast('⚠️ Please fill in all fields');
            return;
        }

        try {
            setIsGenerating(true);

            const response = await chrome.runtime.sendMessage({
                type: 'OPTIMIZE_RESUME',
                payload: {
                    originalResume: profile.resumeText,
                    jobDescription,
                    jobTitle,
                    companyName,
                    apiKey: profile.apiKey
                }
            });

            console.log('[OptimizedResumes] Generated response:', response);

            if (!response || !response.success) {
                throw new Error(response?.error || 'Failed to generate optimized documents');
            }

            let result;
            try {
                // Ensure data exists
                if (!response.data) {
                    throw new Error('No data received from AI');
                }

                // Clean markdown code blocks if present
                const cleanData = typeof response.data === 'string'
                    ? response.data.replace(/```json\n?|\n?```/g, '').trim()
                    : response.data;

                result = typeof cleanData === 'string' ? JSON.parse(cleanData) : cleanData;
            } catch (e) {
                console.error('[OptimizedResumes] JSON Parse Error:', e);
                console.log('[OptimizedResumes] Raw data:', response.data);
                throw new Error('Failed to parse AI response. Please try again.');
            }

            const newDoc: OptimizedDocument = {
                id: Date.now().toString(),
                jobTitle,
                companyName,
                jobDescription,
                createdAt: Date.now(),
                optimizedResume: result.optimizedResume,
                optimizedCoverLetter: result.optimizedCoverLetter,
                isActive: false
            };

            const updatedDocs = [newDoc, ...documents];
            saveDocuments(updatedDocs);

            // Reset form
            setJobTitle('');
            setCompanyName('');
            setJobDescription('');
            setShowNewDocModal(false);
            triggerToast('✅ Optimized documents created successfully');

        } catch (error: any) {
            console.error('Error generating optimized documents:', error);
            triggerToast(`❌ ${error.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePreview = (doc: OptimizedDocument) => {
        setSelectedDoc(doc);
        setPreviewMode('resume');
        setShowPreviewModal(true);
    };

    const handleDownload = (doc: OptimizedDocument, format: 'txt' | 'pdf' | 'docx', type: 'resume' | 'cover') => {
        const content = type === 'resume' ? doc.optimizedResume : doc.optimizedCoverLetter;
        const filename = `${doc.jobTitle.replace(/[^a-z0-9]/gi, '-')}-${doc.companyName.replace(/[^a-z0-9]/gi, '-')}-${type}`;

        if (format === 'txt') {
            // TXT Download
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            triggerToast(`✅ Downloaded ${type} as TXT`);

        } else if (format === 'pdf') {
            // PDF Download using print
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                triggerToast('⚠️ Please allow popups to download PDF');
                return;
            }

            // Create formatted HTML for PDF
            const html = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${filename}</title>
                    <style>
                        @page { margin: 0.75in; }
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                            font-size: 11pt;
                            line-height: 1.4;
                            color: #000;
                            max-width: 8.5in;
                            margin: 0 auto;
                        }
                        h1 { font-size: 18pt; margin: 0 0 4pt 0; font-weight: bold; }
                        h2 { font-size: 12pt; margin: 16pt 0 4pt 0; font-weight: bold; text-transform: uppercase; }
                        p { margin: 0 0 8pt 0; }
                        .contact { font-size: 10pt; margin: 0 0 12pt 0; color: #333; }
                        .section { margin: 0 0 12pt 0; }
                        .job-header { font-weight: bold; margin: 8pt 0 2pt 0; }
                        .date { color: #666; font-style: italic; }
                        ul { margin: 4pt 0 0 0; padding-left: 20pt; }
                        li { margin: 0 0 4pt 0; }
                        @media print {
                            body { margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    <pre style="font-family: Arial, Helvetica, sans-serif; white-space: pre-wrap; word-wrap: break-word;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                    <script>
                        window.onload = function() {
                            setTimeout(function() {
                                window.print();
                                setTimeout(function() {
                                    window.close();
                                }, 500);
                            }, 250);
                        }
                    </script>
                </body>
                </html>
            `;

            printWindow.document.write(html);
            printWindow.document.close();
            triggerToast(`✅ Opening print dialog for PDF...`);

        } else if (format === 'docx') {
            // DOCX Download (create RTF that Word can open)
            // RTF format is text-based and compatible with Word
            const rtfContent = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\fnil\\fcharset0 Arial;}}
{\\colortbl;\\red0\\green0\\blue0;}
\\viewkind4\\uc1\\pard\\cf1\\f0\\fs22
${content
                    .replace(/\\/g, '\\\\')
                    .replace(/{/g, '\\{')
                    .replace(/}/g, '\\}')
                    .replace(/\n/g, '\\par\n')}
}`;

            const blob = new Blob([rtfContent], { type: 'application/rtf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.rtf`; // RTF can be opened by Word
            a.click();
            URL.revokeObjectURL(url);
            triggerToast(`✅ Downloaded ${type} as DOCX-compatible RTF`);
        }
    };

    const handleReplace = (doc: OptimizedDocument) => {
        // Deactivate all other documents
        const updatedDocs = documents.map(d => ({
            ...d,
            isActive: d.id === doc.id
        }));

        saveDocuments(updatedDocs);

        // Convert the optimized resume text to a base64 blob for the auto-uploader
        // We use encodeURIComponent + unescape as a safe way to handle Unicode variables in btoa
        const base64Resume = btoa(unescape(encodeURIComponent(doc.optimizedResume)));
        const fileName = `${doc.jobTitle.replace(/[^a-z0-9]/gi, '_')}_Resume.txt`;

        // Update profile with the new resume text AND the blob for the uploader
        const updatedProfile = {
            ...profile,
            resumeText: doc.optimizedResume,
            resumeBlob: base64Resume, // This is crucial for the contentScript injectResumeFile
            resumeFileName: fileName,
            resumeMimeType: 'text/plain'
        };
        onSave(updatedProfile);

        triggerToast('✅ Resume replaced - now using optimized version for autofill');
    };

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this optimized document?')) {
            const updatedDocs = documents.filter(d => d.id !== id);
            saveDocuments(updatedDocs);
            triggerToast('✅ Document deleted');
        }
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Toast */}
            {showToast && (
                <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50 flex items-center animate-fade-in-up opacity-90">
                    {toastMessage}
                </div>
            )}

            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Optimized Resumes</h2>
                    <p className="text-xs text-gray-500 mt-1">Create job-specific resumes & cover letters</p>
                </div>
                <button
                    onClick={handleOpenModal}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <span>+</span> Create New
                </button>
            </div>

            {/* Documents List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
                {documents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                        <div className="text-6xl">📄</div>
                        <div>
                            <p className="text-gray-600 font-medium">No optimized documents yet</p>
                            <p className="text-xs text-gray-400 mt-1">Create your first job-specific resume</p>
                        </div>
                    </div>
                ) : (
                    documents.map(doc => (
                        <div
                            key={doc.id}
                            className={`border rounded-lg p-4 transition-all ${doc.isActive ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:shadow-md'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-gray-900">{doc.jobTitle}</h3>
                                        {doc.isActive && (
                                            <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full font-medium">
                                                Active
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-600">{doc.companyName}</p>
                                    <p className="text-xs text-gray-400 mt-1">{formatDate(doc.createdAt)}</p>
                                </div>
                                <button
                                    onClick={() => handleDelete(doc.id)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => handlePreview(doc)}
                                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors"
                                >
                                    👁️ Preview
                                </button>

                                <div className="relative group">
                                    <button className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 transition-colors">
                                        📥 Download
                                    </button>
                                    <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-white shadow-lg rounded-md border border-gray-200 py-1 z-10 whitespace-nowrap">
                                        {/* Resume Downloads */}
                                        <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Resume</div>
                                        <button
                                            onClick={() => handleDownload(doc, 'txt', 'resume')}
                                            className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-100"
                                        >
                                            📄 TXT Format
                                        </button>
                                        <button
                                            onClick={() => handleDownload(doc, 'pdf', 'resume')}
                                            className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-100"
                                        >
                                            📑 PDF Format
                                        </button>
                                        <button
                                            onClick={() => handleDownload(doc, 'docx', 'resume')}
                                            className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-100"
                                        >
                                            📘 RTF/DOCX Format
                                        </button>

                                        {/* Divider */}
                                        <div className="border-t border-gray-200 my-1"></div>

                                        {/* Cover Letter Downloads */}
                                        <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Cover Letter</div>
                                        <button
                                            onClick={() => handleDownload(doc, 'txt', 'cover')}
                                            className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-100"
                                        >
                                            📄 TXT Format
                                        </button>
                                        <button
                                            onClick={() => handleDownload(doc, 'pdf', 'cover')}
                                            className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-100"
                                        >
                                            📑 PDF Format
                                        </button>
                                        <button
                                            onClick={() => handleDownload(doc, 'docx', 'cover')}
                                            className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-100"
                                        >
                                            📘 RTF/DOCX Format
                                        </button>
                                    </div>
                                </div>

                                {!doc.isActive && (
                                    <button
                                        onClick={() => handleReplace(doc)}
                                        className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors"
                                    >
                                        🔄 Use for Autofill
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* New Document Modal */}
            {showNewDocModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h3 className="text-lg font-bold text-gray-900">Create Optimized Resume</h3>
                            <button
                                onClick={() => setShowNewDocModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {/* Auto-Detection Status */}
                            {isDetecting && (
                                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-center gap-3">
                                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-sm text-blue-800 font-medium">🔍 Auto-detecting job details from current page...</p>
                                </div>
                            )}

                            {!isDetecting && showNewDocModal && (
                                <div className="bg-green-50 border border-green-200 rounded-md p-3 flex justify-between items-center">
                                    <p className="text-sm text-green-800">
                                        ✨ <span className="font-medium">Tip:</span> Job details are auto-filled from the current page!
                                    </p>
                                    <button
                                        onClick={handleAutoDetect}
                                        className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                    >
                                        🔄 Retry
                                    </button>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
                                <input
                                    type="text"
                                    value={jobTitle}
                                    onChange={(e) => setJobTitle(e.target.value)}
                                    placeholder="e.g., Senior Software Engineer"
                                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                                <input
                                    type="text"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="e.g., Google"
                                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Job Description</label>
                                <textarea
                                    value={jobDescription}
                                    onChange={(e) => setJobDescription(e.target.value)}
                                    placeholder="Paste the full job description here..."
                                    rows={12}
                                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500 font-mono"
                                />
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                                <p className="font-medium">💡 How it works:</p>
                                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                                    <li>AI analyzes the job description for key skills and requirements</li>
                                    <li>Creates an optimized resume highlighting relevant experience</li>
                                    <li>Generates a custom cover letter for this specific role</li>
                                    <li>You can then use this version for autofilling applications</li>
                                </ul>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={() => setShowNewDocModal(false)}
                                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md font-medium hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    '✨ Generate'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {showPreviewModal && selectedDoc && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">{selectedDoc.jobTitle}</h3>
                                <p className="text-sm text-gray-600">{selectedDoc.companyName}</p>
                            </div>
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Toggle between Resume and Cover Letter */}
                        <div className="px-6 pt-4 flex gap-2">
                            <button
                                onClick={() => setPreviewMode('resume')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${previewMode === 'resume'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Resume
                            </button>
                            <button
                                onClick={() => setPreviewMode('cover')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${previewMode === 'cover'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Cover Letter
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-6 font-mono text-sm whitespace-pre-wrap">
                                {previewMode === 'resume' ? selectedDoc.optimizedResume : selectedDoc.optimizedCoverLetter}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={() => handleDownload(selectedDoc, 'txt', previewMode)}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition-colors"
                            >
                                📥 Download TXT
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
