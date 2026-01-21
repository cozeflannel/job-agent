import { ChatMessage, PageContext, UserProfile, FormField } from '../types';

export interface AICompletionRequest {
    model?: string;
    systemInstruction: string;
    prompt: string;
    history?: ChatMessage[];
    responseSchema?: any; // The generic JSON schema
    temperature?: number;
    enableSearch?: boolean; // Flag to enable Google Search grounding
}

export interface AIClient {
    generateText(request: AICompletionRequest): Promise<string>;
    generateStructuredJSON(request: AICompletionRequest): Promise<string>;
}
