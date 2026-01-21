import { GoogleGenAI, Type } from "@google/genai";
import { AIClient, AICompletionRequest } from "../utils/AIClient";

export class GeminiAdapter implements AIClient {
    private client: GoogleGenAI;

    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
    }

    private async retryWithBackoff<T>(
        operation: () => Promise<T>,
        maxRetries: number = 5,
        initialDelay: number = 1000
    ): Promise<T> {
        let retries = 0;
        while (true) {
            try {
                return await operation();
            } catch (error: any) {
                const errorStr = JSON.stringify(error);
                const isOverloaded = error?.message?.includes('503') || error?.status === 503 || errorStr.includes('"code":503') || errorStr.includes('overloaded');
                const isRateLimited = error?.message?.includes('429') || error?.status === 429 || errorStr.includes('"code":429');

                if ((isOverloaded || isRateLimited) && retries < maxRetries) {
                    const delay = initialDelay * Math.pow(2, retries);
                    console.log(`[GeminiAdapter] Error ${error.status || 'unknown'}. Retrying in ${delay}ms... (Attempt ${retries + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    retries++;
                } else {
                    throw error;
                }
            }
        }
    }

    async generateText(request: AICompletionRequest): Promise<string> {
        const model = request.model || 'gemini-3-flash-preview';

        // Construct contents from history + prompt
        let contents: any[] = [];

        if (request.history && request.history.length > 0) {
            contents = request.history
                .filter(h => h.sender !== 'system' && h.text && h.text.trim().length > 0)
                .map(h => ({
                    role: h.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: h.text }]
                }));
        }

        contents.push({ role: 'user', parts: [{ text: request.prompt }] });

        return this.retryWithBackoff(async () => {
            const response = await this.client.models.generateContent({
                model: model,
                contents: contents,
                config: {
                    systemInstruction: request.systemInstruction,
                    temperature: request.temperature,
                    tools: request.enableSearch ? [{ googleSearch: {} }] : undefined,
                }
            });
            const anyResp = response as any;
            const text = typeof anyResp.text === 'function' ? anyResp.text() : anyResp.text;
            return (text || '') as string;
        });
    }

    async generateStructuredJSON(request: AICompletionRequest): Promise<string> {
        const model = request.model || 'gemini-3-flash-preview';

        return this.retryWithBackoff(async () => {
            const response = await this.client.models.generateContent({
                model: model,
                contents: request.prompt,
                config: {
                    systemInstruction: request.systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: request.responseSchema,
                    temperature: request.temperature,
                    tools: request.enableSearch ? [{ googleSearch: {} }] : undefined,
                }
            });
            const anyResp = response as any;
            const text = typeof anyResp.text === 'function' ? anyResp.text() : anyResp.text;
            return (text || '') as string;
        });
    }
}
