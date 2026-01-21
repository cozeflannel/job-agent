import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ChatState, ChatMessage, PageContext } from '../types';
import { FileHandler } from '../utils/FileHandler';

declare var chrome: any;

interface ChatInterfaceProps {
  profile: UserProfile;
  onUpdateProfile: (p: UserProfile) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ profile, onUpdateProfile }) => {
  const [state, setState] = useState<ChatState>({
    persona: 'IDLE',
    objective: 'Upload a resume to begin initialization...',
    messages: [],
    isThinking: false,
  });
  const [input, setInput] = useState('');
  const [pageContext, setPageContext] = useState<PageContext>({ url: '', title: '' });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages]);

  // Initial Context Fetch & Audit
  useEffect(() => {
    // 1. Get Context
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_CONTEXT' }, (response: any) => {
            if (response && response.success) {
              setPageContext(response.context);
            }
          });
        }
      });
    }

    // 2. Initial Audit if needed
    if (profile.resumeText && state.persona === 'IDLE' && profile.apiKey) {
      runAudit(profile.resumeText);
    }
  }, []);

  const addMessage = (text: string, sender: 'user' | 'ai' | 'system') => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender,
      text,
      timestamp: Date.now(),
    };
    setState(prev => ({ ...prev, messages: [...prev.messages, newMessage] }));
  };

  const runAudit = async (text: string, previousObjective?: string) => {
    setState(prev => ({ ...prev, isThinking: true }));

    if (previousObjective) {
      addMessage(`Running re-evaluation against goal: "${previousObjective}"...`, 'system');
    } else {
      addMessage("Initializing Resume Audit System...", 'system');
    }

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        const response = await chrome.runtime.sendMessage({
          type: 'AUDIT_RESUME',
          payload: {
            resumeText: text,
            apiKey: profile.apiKey,
            previousObjective
          }
        });

        if (!response.success) throw new Error(response.error);
        const result = JSON.parse(response.data);

        setState(prev => ({
          ...prev,
          persona: result.persona,
          objective: result.objective,
          isThinking: false
        }));

        addMessage(result.firstMessage, 'ai');
      } else {
        // Dev Mock
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            persona: 'ARCHITECT',
            objective: 'Fix 3 detected formatting errors.',
            isThinking: false
          }));
          addMessage("I've detected passive voice in your Experience section. Let's fix that.", 'ai');
        }, 1500);
      }
    } catch (e: any) {
      addMessage(`Error: ${e.message}`, 'system');
      setState(prev => ({ ...prev, isThinking: false }));
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !profile.apiKey) return;

    const userMsg = input;
    setInput('');
    addMessage(userMsg, 'user');
    setState(prev => ({ ...prev, isThinking: true }));

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        const response = await chrome.runtime.sendMessage({
          type: 'CHAT_MESSAGE',
          payload: {
            message: userMsg,
            history: state.messages,
            resumeText: profile.resumeText,
            persona: state.persona,
            objective: state.objective,
            apiKey: profile.apiKey,
            context: pageContext
          }
        });

        if (!response.success) throw new Error(response.error);

        setState(prev => ({ ...prev, isThinking: false }));
        addMessage(response.data, 'ai');

      } else {
        setTimeout(() => {
          addMessage("Dev Mode: I received your message.", 'ai');
          setState(prev => ({ ...prev, isThinking: false }));
        }, 1000);
      }
    } catch (e: any) {
      addMessage(`Connection Error: ${e.message}`, 'system');
      setState(prev => ({ ...prev, isThinking: false }));
    }
  };

  const handleReupload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      addMessage(`Uploading revised file: ${file.name}...`, 'system');
      setState(prev => ({ ...prev, isThinking: true }));

      // Use FileHandler to process the file
      const result = await FileHandler.handleUpload(file, profile.apiKey);

      onUpdateProfile({
        ...profile,
        resumeText: result.text,
        resumeFileName: file.name
      });

      // Pass the audit result directly if available, or runAudit manually with the new text
      if (result.auditResult) {
        const audit = result.auditResult;
        setState(prev => ({
          ...prev,
          persona: audit.persona,
          objective: audit.objective,
          isThinking: false
        }));
        addMessage(audit.firstMessage, 'ai');
      } else {
        // Fallback if audit wasn't in result (e.g. key missing?)
        runAudit(result.text, state.objective);
      }

    } catch (err: any) {
      addMessage(`Upload Failed: ${err.message}`, 'system');
      setState(prev => ({ ...prev, isThinking: false }));
    }
  };

  // Helper function to render text with basic markdown
  const renderFormattedText = (text: string) => {
    // 1. Handle Bold (**text**)
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    // 2. Handle Bullet points (* or - at start of line)
    // We can wrap the whole thing in a logic that splits by newlines and checks for bullets
    const lines = formatted.split('\n');
    const processedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        return `<li>${trimmed.substring(2)}</li>`;
      }
      return line;
    });

    // Join lines. If we have <li>, we might want to wrap them in <ul>, but simple replacement is safer for now 
    // without full parser. A simple way: just return the lines with <br/>, but <li> implies block element.
    // Let's just return the lines joined by <br/> unless it is a list item.
    // Actually, simply replacing the start is enough for "rich text" visual if we apply some CSS or accept it's a list item.
    // But to be proper HTML, we should wrap sequential <li> in <ul>. 
    // For simplicity given strict guardrails: allow <li> to just be rendered. Browser renders <li> even without <ul> sometimes but better to use simple bullet char if <ul> complex.
    // User requested "Render **text** as bold, * or - as bullet points".
    // Let's replace the bullet marker with a bullet entity for safer rendering if not using full HTML structure.
    // OR create a simple HTML structure.

    // Let's try a safer regex approach for just the formatting asked:
    formatted = formatted.replace(/(?:^|\n)[*-] (.*?)(?=(?:$|\n))/g, '<br/>• $1');

    // Clean up any double breaks if necessary, but the above is simple.
    // Let's use the <b> tag we created.
    return { __html: formatted };
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Objective Banner */}
      <div className={`
        p-3 shadow-sm border-b flex items-center justify-between transition-colors duration-500
        ${state.persona === 'ARCHITECT' ? 'bg-amber-50 border-amber-200' : ''}
        ${state.persona === 'STRATEGIST' ? 'bg-indigo-50 border-indigo-200' : ''}
        ${state.persona === 'IDLE' ? 'bg-gray-100 border-gray-200' : ''}
      `}>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-2">
            Current Objective
            {state.persona === 'ARCHITECT' && <span className="text-[10px] bg-amber-200 text-amber-800 px-1 rounded">LEVEL 1</span>}
            {state.persona === 'STRATEGIST' && <span className="text-[10px] bg-indigo-200 text-indigo-800 px-1 rounded">LEVEL 2</span>}
          </p>
          <p className={`text-sm font-semibold leading-tight ${state.persona === 'ARCHITECT' ? 'text-amber-800' : 'text-indigo-800'}`}>
            {state.objective}
          </p>
        </div>
        <div className="text-3xl ml-2 filter drop-shadow-sm">
          {state.persona === 'ARCHITECT' && '📐'}
          {state.persona === 'STRATEGIST' && '♟️'}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {state.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
          >
            {msg.sender === 'ai' && (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0 mr-2 flex items-center justify-center text-xs">AI</div>
            )}
            <div
              className={`
                max-w-[85%] rounded-lg p-3 text-sm shadow-sm
                ${msg.sender === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : msg.sender === 'system'
                    ? 'bg-gray-100 text-gray-500 text-xs text-center w-full italic border-none shadow-none'
                    : state.persona === 'ARCHITECT'
                      ? 'bg-white border-l-4 border-amber-400 text-gray-800 rounded-bl-none'
                      : 'bg-white border-l-4 border-indigo-500 text-gray-800 rounded-bl-none'
                }
              `}
            >
              {msg.sender === 'ai' ? (
                <div dangerouslySetInnerHTML={renderFormattedText(msg.text)} />
              ) : (
                <div className="whitespace-pre-wrap">{msg.text}</div>
              )}
            </div>
          </div>
        ))}
        {state.isThinking && (
          <div className="flex justify-start items-center">
            <div className="w-6 h-6 rounded-full bg-gray-200 flex-shrink-0 mr-2 flex items-center justify-center text-xs">AI</div>
            <div className="bg-white border border-gray-200 rounded-lg p-3 rounded-bl-none shadow-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors border border-transparent hover:border-blue-100"
            title="Upload Revised Resume"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".txt,.md,.text,.pdf"
            onChange={handleReupload}
          />

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={!profile.apiKey ? "Set API Key in Config first" : "Ask for feedback..."}
            disabled={!profile.apiKey || state.isThinking}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || state.isThinking}
            className={`p-2 text-white rounded-md transition-colors ${state.persona === 'ARCHITECT' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </button>
        </div>
      </div>
    </div>
  );
};