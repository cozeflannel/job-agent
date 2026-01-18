import React, { useEffect, useState } from 'react';
import { Settings } from './components/Settings';
import { JobFiller } from './components/JobFiller';
import { ChatInterface } from './components/ChatInterface';
import { UserProfile, DEFAULT_PROFILE } from './types';

declare var chrome: any;

function App() {
  const [activeTab, setActiveTab] = useState<'filler' | 'chat' | 'settings'>('chat');
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
    <div className="w-full h-screen flex flex-col font-sans text-gray-900">
      {/* Header */}
      <header className="flex-none bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center shadow-sm z-10">
        <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          Job-Agent AI
        </h1>
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('filler')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${activeTab === 'filler' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          >
            Fill
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${activeTab === 'chat' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          >
            Coach
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${activeTab === 'settings' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          >
            Config
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'filler' && (
          <JobFiller profile={profile} />
        )}
        {activeTab === 'chat' && (
          <ChatInterface profile={profile} onUpdateProfile={handleSaveProfile} />
        )}
        {activeTab === 'settings' && (
          <Settings profile={profile} onSave={handleSaveProfile} />
        )}
      </main>
    </div>
  );
}

export default App;