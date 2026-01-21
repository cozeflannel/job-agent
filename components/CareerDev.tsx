import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ChatInterface } from './ChatInterface';
import { SkillsDev } from './SkillsDev';

interface CareerDevProps {
    profile: UserProfile;
    onUpdateProfile: (profile: UserProfile) => void;
}

export const CareerDev: React.FC<CareerDevProps> = ({ profile, onUpdateProfile }) => {
    const [activeSubTab, setActiveSubTab] = useState<'coach' | 'skills'>('coach');

    return (
        <div className="flex h-full bg-white">
            {/* Sidebar Navigation */}
            <div className="w-14 hover:w-64 transition-all duration-300 ease-in-out flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col group z-20 absolute h-full shadow-lg hover:shadow-xl">
                <div className="p-4 border-b border-gray-200 flex items-center overflow-hidden whitespace-nowrap">
                    <span className="text-xl mr-3 text-gray-500">🚀</span>
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity duration-300">Career Development</h2>
                </div>
                <nav className="flex-1 p-2 space-y-1 overflow-hidden">
                    <button
                        onClick={() => setActiveSubTab('coach')}
                        className={`w-full flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeSubTab === 'coach'
                            ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        title="Coach Dev"
                    >
                        <span className="mr-3 text-lg flex-shrink-0">🎓</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">Coach Dev</span>
                    </button>

                    <button
                        onClick={() => setActiveSubTab('skills')}
                        className={`w-full flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${activeSubTab === 'skills'
                            ? 'bg-white text-blue-600 shadow-sm border border-gray-100'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            }`}
                        title="Skills Dev"
                    >
                        <span className="mr-3 text-lg flex-shrink-0">📊</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">Skills Dev</span>
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden ml-14">
                {activeSubTab === 'coach' && (
                    <ChatInterface profile={profile} onUpdateProfile={onUpdateProfile} />
                )}
                {activeSubTab === 'skills' && (
                    <SkillsDev profile={profile} />
                )}
            </div>
        </div>
    );
};
