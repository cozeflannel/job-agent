import React, { useEffect, useState } from 'react';
import { Settings } from './components/Settings';
import { JobFiller } from './components/JobFiller';
import { ResumeHub } from './components/ResumeHub';
import { CareerDev } from './components/CareerDev';
import { UserProfile, DEFAULT_PROFILE } from './types';

declare var chrome: any;

type MainTab = 'resume-hub' | 'auto-fill' | 'career-dev' | 'config';

function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('resume-hub');
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load profile from local storage
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['jobAgentProfile'], (result) => {
        if (result.jobAgentProfile) {
          // Backwards compatibility: add workCountry if missing
          const loadedProfile = {
            ...DEFAULT_PROFILE,
            ...result.jobAgentProfile,
            workCountry: result.jobAgentProfile.workCountry || 'United States'
          };
          setProfile(loadedProfile);
        }
        setLoading(false);
      });
    } else {
      // Dev mode fallback
      const saved = localStorage.getItem('jobAgentProfile');
      if (saved) {
        const loadedProfile = JSON.parse(saved);
        setProfile({
          ...DEFAULT_PROFILE,
          ...loadedProfile,
          workCountry: loadedProfile.workCountry || 'United States'
        });
      }
      setLoading(false);
    }
  }, []);

  const handleSaveProfile = (newProfile: UserProfile) => {
    setProfile(newProfile);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ jobAgentProfile: newProfile });
    } else {
      localStorage.setItem('jobAgentProfile', JSON.stringify(newProfile));
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <div className="w-full h-screen flex flex-col font-sans text-gray-900 bg-gray-50">
      {/* Header */}
      <header className="flex-none bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center shadow-sm z-10">
        <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          Job-Agent AI
        </h1>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('resume-hub')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${activeTab === 'resume-hub' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          >
            Resume Hub
          </button>
          <button
            onClick={() => setActiveTab('auto-fill')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${activeTab === 'auto-fill' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          >
            Auto-Fill
          </button>
          <button
            onClick={() => setActiveTab('career-dev')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${activeTab === 'career-dev' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          >
            Career Dev
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${activeTab === 'config' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          >
            Config
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'resume-hub' && (
          <ResumeHub profile={profile} onSave={handleSaveProfile} />
        )}
        {activeTab === 'auto-fill' && (
          <JobFiller profile={profile} onUpdateProfile={handleSaveProfile} />
        )}
        {activeTab === 'career-dev' && (
          <CareerDev profile={profile} onUpdateProfile={handleSaveProfile} />
        )}
        {activeTab === 'config' && (
          <Settings profile={profile} onSave={handleSaveProfile} />
        )}
      </main>
    </div>
  );
}

export default App;