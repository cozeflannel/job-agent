export type LLMProvider = 'google' | 'openai' | 'anthropic';

export interface UserProfile {
  apiKey: string; // Legacy support (maps to google)
  selectedProvider: LLMProvider;
  apiKeys: {
    google: string;
    openai?: string;
    anthropic?: string;
  };
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  linkedin: string;
  portfolio: string;
  dob: string; // YYYY-MM-DD
  address: string;
  city: string;
  state: string;
  zip: string;
  citizenship: string; // e.g., "US Citizen", "Green Card", "Visa"
  workCountry: string; // Country intending to work from (e.g., "United States", "Canada", "Remote")
  veteranStatus: string;
  disabilityStatus: string;
  gender: string;
  race: string;
  sexualOrientation: string;
  resumeText: string;
  resumeFileName?: string;
  resumeBlob?: string; // Base64-encoded PDF blob for auto-upload
  resumeMimeType?: string; // MIME type of the resume file (e.g., 'application/pdf')
  applicationHistory?: ApplicationEntry[];
}

export interface ApplicationEntry {
  id: string;
  date: string; // ISO String
  company: string;
  role: string;
  autofillTimeSeconds: number;
  estimatedManualTimeSeconds: number;
  status: 'applied' | 'failed' | 'in-progress';
}

export interface FormField {
  id: string;
  name: string;
  label: string;
  type: string; // 'text', 'radio', 'checkbox', 'select', 'textarea'
  options?: string[]; // For selects/radios
  value?: string | boolean | string[];
}

export interface PageContext {
  url: string;
  title: string;
  siteName?: string;
  pageText?: string; // Truncated body text for analysis
}

export type PersonaType = 'ARCHITECT' | 'STRATEGIST' | 'IDLE';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'system';
  text: string;
  timestamp: number;
}

export interface ChatState {
  persona: PersonaType;
  objective: string;
  messages: ChatMessage[];
  isThinking: boolean;
}

export interface OptimizedDocument {
  id: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  createdAt: number;
  optimizedResume: string;
  optimizedCoverLetter: string;
  isActive: boolean; // If true, this resume is being used for autofill
}

export type ExtensionMessage =
  | { type: 'GET_PAGE_CONTEXT' }
  | { type: 'PROCESS_FORM_DATA'; payload: { profile: UserProfile, fields: FormField[], context: PageContext } }
  | { type: 'AUDIT_RESUME'; payload: { resumeText: string, apiKey: string, previousObjective?: string } }
  | { type: 'EXTRACT_RESUME_DATA'; payload: { resumeText: string, apiKey: string } }
  | { type: 'ATTACH_RESUME'; payload: { resumeBlob: string, fileName: string, mimeType?: string } }
  | { type: 'CHAT_MESSAGE'; payload: { message: string, history: ChatMessage[], resumeText: string, persona: PersonaType, objective: string, apiKey: string, context: PageContext } }
  | { type: 'OPTIMIZE_RESUME'; payload: { originalResume: string, jobDescription: string, jobTitle: string, companyName: string, apiKey: string } }
  | { type: 'EXTRACT_JOB_DETAILS'; payload: { pageContent: string, apiKey: string } }
  | { type: 'LOG_ERROR'; payload: string };

export const DEFAULT_PROFILE: UserProfile = {
  apiKey: '',
  selectedProvider: 'google',
  apiKeys: {
    google: '',
  },
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  linkedin: '',
  portfolio: '',
  dob: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  citizenship: 'US Citizen',
  workCountry: 'United States',
  veteranStatus: 'I am not a protected veteran',
  disabilityStatus: 'No, I do not have a disability',
  gender: 'Prefer not to say',
  race: 'Prefer not to say',
  sexualOrientation: 'Prefer not to say',
  resumeText: '',
  resumeFileName: '',
  applicationHistory: []
};