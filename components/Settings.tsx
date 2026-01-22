import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';

interface SettingsProps {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
}

export const Settings: React.FC<SettingsProps> = ({ profile, onSave }) => {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Update formData when profile changes
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

  const handleSave = () => {
    onSave(formData);
    triggerToast("Configuration Saved Successfully");
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Toast Notification */}
      {showToast && (
        <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-50 flex items-center animate-fade-in-up opacity-90">
          <svg className="w-4 h-4 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          {toastMessage}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="space-y-4 max-w-2xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Configuration</h2>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
            <p className="font-bold">Bring Your Own Key</p>
            Select your preferred AI provider. Your keys are stored locally on this device and never sent to our servers.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">AI Provider</label>
            <select
              name="selectedProvider"
              value={formData.selectedProvider || 'google'}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, selectedProvider: e.target.value as any }));
              }}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm text-sm"
            >
              <option value="google">Google Gemini (Default)</option>
              <option value="openai">OpenAI (GPT-5.2)</option>
              <option value="anthropic">Anthropic (Claude 4.5)</option>
            </select>
          </div>

          {(!formData.selectedProvider || formData.selectedProvider === 'google') && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Gemini API Key</label>
              <input
                type="password"
                value={formData.apiKeys?.google || formData.apiKey || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    apiKey: val, // Keep legacy in sync
                    apiKeys: { ...prev.apiKeys, google: val }
                  }));
                }}
                placeholder="AIza..."
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
              <p className="mt-1 text-xs text-blue-500">Required for Gemini 3.0 models.</p>
            </div>
          )}

          {formData.selectedProvider === 'openai' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">OpenAI API Key</label>
              <input
                type="password"
                value={formData.apiKeys?.openai || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    apiKeys: { ...prev.apiKeys, openai: val }
                  }));
                }}
                placeholder="sk-..."
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
              <p className="text-xs text-gray-500 mt-1">Required for GPT-5.2 and Responses API.</p>
            </div>
          )}

          {formData.selectedProvider === 'anthropic' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Anthropic API Key</label>
              <input
                type="password"
                value={formData.apiKeys?.anthropic || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    apiKeys: { ...prev.apiKeys, anthropic: val }
                  }));
                }}
                placeholder="sk-ant-..."
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
              />
              <p className="text-xs text-gray-500 mt-1">Required for Claude Sonnet 4.5.</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 absolute bottom-0 w-full">
        <button
          onClick={handleSave}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
};