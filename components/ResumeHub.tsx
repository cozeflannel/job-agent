import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { FileHandler } from '../utils/FileHandler';
import { OptimizedResumes } from './OptimizedResumes';
import { ApplicationHistory } from './ApplicationHistory';

declare var chrome: any;

interface ResumeHubProps {
    profile: UserProfile;
    onSave: (profile: UserProfile) => void;
}

export const ResumeHub: React.FC<ResumeHubProps> = ({ profile, onSave }) => {
    const [activeSubTab, setActiveSubTab] = useState<'personal' | 'demographics' | 'base' | 'optimized' | 'history'>('personal');
    const [formData, setFormData] = useState<UserProfile>(profile);

    // File Upload State
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'extracting' | 'success' | 'error'>('idle');
    const [uploadMessage, setUploadMessage] = useState<string>('');

    // Toast State
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // Update formData when profile changes (e.g. from other tabs)
    useEffect(() => {
        setFormData(profile);
    }, [profile]);

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveFormData = () => {
        onSave(formData);
        triggerToast("Profile Updated Successfully");
    };

    const getEffectiveApiKey = (p: UserProfile): string => {
        const provider = p.selectedProvider || 'google';
        if (provider === 'google') return p.apiKeys?.google || p.apiKey;
        if (provider === 'openai') return p.apiKeys?.openai || '';
        if (provider === 'anthropic') return p.apiKeys?.anthropic || '';
        return '';
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setUploadStatus('idle');
        setUploadMessage('');

        if (!file) return;

        const apiKey = getEffectiveApiKey(formData);
        if (!apiKey) {
            triggerToast("⚠️ Missing API Key. Text will be parsed locally, but AI auto-fill will skip.");
        }

        try {
            setUploadStatus('extracting');
            setUploadMessage("Parsing document and extracting data...");

            // Use FileHandler for local processing
            const result = await FileHandler.handleUpload(file, apiKey);

            const updatedProfile = {
                ...formData,
                resumeText: result.text,
                resumeFileName: file.name,
                resumeBlob: result.blob,
                resumeMimeType: result.mimeType
            };

            // Merge extracted data if available
            if (result.extractionResult) {
                console.log("[ResumeHub] AI Extraction Result:", result.extractionResult);
                updatedProfile.firstName = result.extractionResult.firstName || updatedProfile.firstName;
                updatedProfile.lastName = result.extractionResult.lastName || updatedProfile.lastName;
                updatedProfile.email = result.extractionResult.email || updatedProfile.email;
                updatedProfile.phone = result.extractionResult.phone || updatedProfile.phone;
                updatedProfile.linkedin = result.extractionResult.linkedin || updatedProfile.linkedin;
                updatedProfile.portfolio = result.extractionResult.portfolio || updatedProfile.portfolio;
                updatedProfile.address = result.extractionResult.address || updatedProfile.address;
                updatedProfile.city = result.extractionResult.city || updatedProfile.city;
                updatedProfile.state = result.extractionResult.state || updatedProfile.state;
                updatedProfile.zip = result.extractionResult.zip || updatedProfile.zip;

                setUploadStatus('success');
                setUploadMessage(`Successfully parsed "${file.name}" and auto-filled profile.`);
                triggerToast("Resume data extracted & profile updated.");
            } else if (result.error) {
                console.error("Upload AI Error:", result.error);
                setUploadStatus('success');
                setUploadMessage(`Parsed text, but AI extraction failed: ${result.error}`);
                triggerToast(`⚠️ UI/AI Sync Warning: ${result.error.substring(0, 50)}...`);
            } else {
                setUploadStatus('success');
                setUploadMessage(`Successfully parsed "${file.name}". (No AI extraction performed)`);
                if (!apiKey) {
                    triggerToast("Parsed text locally. Set API Key to enable Auto-Fill.");
                }
            }

            setFormData(updatedProfile);

            // Auto-save the profile so extracted data persists
            onSave(updatedProfile);

        } catch (error: any) {
            console.error("Upload error:", error);
            setUploadStatus('error');
            setUploadMessage(`Failed to process file: ${error.message}`);
        }
    };

    const handleClearResume = () => {
        setFormData(prev => ({ ...prev, resumeText: '', resumeFileName: '', resumeBlob: '', resumeMimeType: '' }));
        setUploadStatus('idle');
        setUploadMessage('');
        // Save the cleared state
        onSave({ ...formData, resumeText: '', resumeFileName: '', resumeBlob: '', resumeMimeType: '' });
    };

    return (
        <div className="flex h-full bg-white relative">
            {/* Toast Notification */}
            {showToast && (
                <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50 flex items-center animate-fade-in-up opacity-90">
                    <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    {toastMessage}
                </div>
            )}

            {/* Sidebar Navigation */}
            <div className="w-14 hover:w-64 transition-all duration-300 ease-in-out flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col group z-20 absolute h-full shadow-lg hover:shadow-xl">
                <div className="p-4 border-b border-gray-200 flex items-center overflow-hidden whitespace-nowrap">
                    <span className="text-xl mr-3 text-gray-500">📂</span>
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-300">Resume Hub</h2>
                </div>
                <nav className="flex-1 p-2 space-y-1 overflow-hidden">
                    <button
                        onClick={() => setActiveSubTab('personal')}
                        className={`w-full flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeSubTab === 'personal'
                            ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        title="Personal"
                    >
                        <span className="mr-3 text-lg flex-shrink-0">👤</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">Personal</span>
                    </button>
                    <button
                        onClick={() => setActiveSubTab('demographics')}
                        className={`w-full flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeSubTab === 'demographics'
                            ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        title="Demographics"
                    >
                        <span className="mr-3 text-lg flex-shrink-0">🌍</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">Demographics</span>
                    </button>
                    <button
                        onClick={() => setActiveSubTab('base')}
                        className={`w-full flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeSubTab === 'base'
                            ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        title="Base Resume"
                    >
                        <span className="mr-3 text-lg flex-shrink-0">📄</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">Base Resume</span>
                    </button>
                    <button
                        onClick={() => setActiveSubTab('optimized')}
                        className={`w-full flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeSubTab === 'optimized'
                            ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        title="Optimized Resumes"
                    >
                        <span className="mr-3 text-lg flex-shrink-0">✨</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">Optimized Resumes</span>
                    </button>
                    <button
                        onClick={() => setActiveSubTab('history')}
                        className={`w-full flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeSubTab === 'history'
                            ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        title="History"
                    >
                        <span className="mr-3 text-lg flex-shrink-0">📜</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">History</span>
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 relative h-full ml-14">
                {/* Sub-Tabs Content */}

                {activeSubTab === 'personal' && (
                    <div className="space-y-4 max-w-2xl mx-auto pb-20">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Personal Information</h2>
                            <button onClick={handleSaveFormData} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">First Name</label>
                                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Email</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Phone</label>
                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Date of Birth (YYYY-MM-DD)</label>
                            <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm" />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-3">
                                <label className="block text-sm font-medium text-gray-700">Address</label>
                                <input type="text" name="address" value={formData.address} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm" placeholder="Street Address" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">City</label>
                                <input type="text" name="city" value={formData.city} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">State</label>
                                <input type="text" name="state" value={formData.state} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm" placeholder="NY" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Zip Code</label>
                                <input type="text" name="zip" value={formData.zip} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Portfolio URL</label>
                            <input type="url" name="portfolio" value={formData.portfolio} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">LinkedIn URL</label>
                            <input type="url" name="linkedin" value={formData.linkedin} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm" />
                        </div>
                    </div>
                )}

                {activeSubTab === 'demographics' && (
                    <div className="space-y-4 max-w-2xl mx-auto pb-20">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Demographics</h2>
                            <button onClick={handleSaveFormData} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Citizenship Status</label>
                            <select name="citizenship" value={formData.citizenship} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm">
                                <option value="US Citizen">US Citizen</option>
                                <option value="Green Card">Green Card / Permanent Resident</option>
                                <option value="Visa">Visa / Require Sponsorship</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Country to Work From</label>
                            <select name="workCountry" value={formData.workCountry} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm">
                                <option value="United States">United States</option>
                                <option value="Canada">Canada</option>
                                <option value="United Kingdom">United Kingdom</option>
                                <option value="Australia">Australia</option>
                                <option value="Germany">Germany</option>
                                <option value="France">France</option>
                                <option value="India">India</option>
                                <option value="Brazil">Brazil</option>
                                <option value="Mexico">Mexico</option>
                                <option value="Singapore">Singapore</option>
                                <option value="Remote">Remote (Any Country)</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Gender</label>
                            <select name="gender" value={formData.gender} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm">
                                <option value="Prefer not to say">Prefer not to say</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Non-binary">Non-binary</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Race/Ethnicity</label>
                            <select name="race" value={formData.race} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm">
                                <option value="Prefer not to say">Prefer not to say</option>
                                <option value="American Indian or Alaska Native">American Indian or Alaska Native</option>
                                <option value="Asian">Asian</option>
                                <option value="Black or African American">Black or African American</option>
                                <option value="Hispanic or Latino">Hispanic or Latino</option>
                                <option value="Native Hawaiian or Other Pacific Islander">Native Hawaiian or Other Pacific Islander</option>
                                <option value="White">White</option>
                                <option value="Two or More Races">Two or More Races</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Veteran Status</label>
                            <select name="veteranStatus" value={formData.veteranStatus} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm">
                                <option value="I am not a protected veteran">Not a Veteran</option>
                                <option value="I am a protected veteran">Protected Veteran</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Disability Status</label>
                            <select name="disabilityStatus" value={formData.disabilityStatus} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm">
                                <option value="No, I do not have a disability">No</option>
                                <option value="Yes, I have a disability">Yes</option>
                                <option value="Prefer not to say">Prefer not to say</option>
                            </select>
                        </div>
                    </div>
                )}

                {activeSubTab === 'base' && (
                    <div className="space-y-4 max-w-2xl mx-auto pb-20">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Base Resume</h2>
                            <button onClick={handleSaveFormData} className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700">Save</button>
                        </div>

                        {/* File Upload Zone */}
                        <div className={`relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors cursor-pointer group ${uploadStatus === 'error' ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}>
                            <input
                                type="file"
                                accept=".txt,.md,.text,.pdf"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <svg className={`w-10 h-10 mb-3 transition-colors ${uploadStatus === 'error' ? 'text-red-400' : 'text-gray-400 group-hover:text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                            </svg>
                            <p className="text-sm text-gray-600 font-medium">Click to upload or drag & drop</p>
                            <p className="text-xs text-gray-500 mt-1">Supported: .pdf, .txt, .md</p>
                        </div>

                        {/* Status Feedback */}
                        {uploadStatus === 'extracting' && (
                            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 flex items-center gap-3 animate-pulse">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="text-sm font-medium text-blue-800">{uploadMessage}</p>
                            </div>
                        )}

                        {uploadStatus === 'success' && (
                            <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-start gap-3">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-green-800">{uploadMessage}</p>
                                    {formData.resumeText && (
                                        <div className="mt-2 text-xs text-green-700 bg-green-100 p-2 rounded border border-green-200 font-mono">
                                            <span className="font-bold">Excerpt:</span> "{formData.resumeText.substring(0, 150)}..."
                                        </div>
                                    )}
                                </div>
                                <button onClick={handleClearResume} className="text-green-600 hover:text-green-800">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        )}

                        {uploadStatus === 'error' && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-3">
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <p className="text-sm font-medium text-red-800">{uploadMessage}</p>
                            </div>
                        )}

                        {/* Selected File Indicator */}
                        {formData.resumeFileName && uploadStatus === 'idle' && (
                            <div className="flex items-center justify-between bg-blue-50 px-3 py-2 rounded text-sm text-blue-700 border border-blue-100">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="text-lg">📄</span>
                                    <span className="truncate font-medium">{formData.resumeFileName}</span>
                                </div>
                                <button onClick={handleClearResume} className="text-blue-500 hover:text-blue-800 p-1 hover:bg-blue-100 rounded">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        )}

                        {/* Editable Content Area */}
                        <div className="mt-2">
                            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                                Resume Content (Editable)
                            </label>
                            <textarea
                                name="resumeText"
                                value={formData.resumeText}
                                onChange={handleChange}
                                rows={12}
                                className="w-full border border-gray-300 rounded-md p-3 shadow-sm text-xs font-mono bg-white focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Uploaded resume text will appear here..."
                            />
                        </div>
                    </div>
                )}

                {activeSubTab === 'optimized' && (
                    <div className="h-full">
                        <OptimizedResumes profile={profile} onSave={onSave} />
                    </div>
                )}

                {activeSubTab === 'history' && (
                    <div className="h-full">
                        <ApplicationHistory history={profile.applicationHistory || []} />
                    </div>
                )}
            </div>
        </div>
    );
};
