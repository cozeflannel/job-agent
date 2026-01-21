import OpenAI from 'openai';
import { AIClient, AICompletionRequest } from '../utils/AIClient';

// Helper to map Gemini Schema types to standard JSON Schema for OpenAI
const mapSchema = (schema: any): any => {
    if (!schema) return undefined;

    const typeMapping: Record<string, string> = {
        OBJECT: 'object',
        ARRAY: 'array',
        STRING: 'string',
        NUMBER: 'number',
        BOOLEAN: 'boolean',
        INTEGER: 'integer'
    };

    const newSchema: any = {
        type: typeMapping[schema.type] || schema.type.toLowerCase(),
        description: schema.description
    };

    if (schema.properties) {
        newSchema.properties = {};
        newSchema.required = [];
        newSchema.additionalProperties = false; // Strict structure

        for (const [key, value] of Object.entries(schema.properties)) {
            newSchema.properties[key] = mapSchema(value);
            if (!(value as any).nullable) {
                newSchema.required.push(key);
            }
        }
    }

    if (schema.items) {
        newSchema.items = mapSchema(schema.items);
    }

    if (schema.enum) {
        newSchema.enum = schema.enum;
    }

    return newSchema;
};

export class OpenAIAdapter implements AIClient {
    private client: OpenAI;

    constructor(apiKey: string) {
        this.client = new OpenAI({
            apiKey,
            dangerouslyAllowBrowser: true
        });
    }

    async generateText(request: AICompletionRequest): Promise<string> {
        const messages: any[] = [
            { role: 'system', content: request.systemInstruction },
            ...(request.history?.map(m => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                content: m.text
            })) || []),
            { role: 'user', content: request.prompt }
        ];

        try {
            // @ts-ignore - 'responses' is a new endpoint for GPT-5.2
            const response = await this.client.responses.create({
                model: request.model || 'gpt-5.2',
                input: messages,
            });

            // Use output_text from the new Response type
            return response.output_text || "";
        } catch (error: any) {
            console.error("OpenAI Adapter Error:", error);
            throw new Error(`OpenAI Error: ${error.message}`);
        }
    }

    async generateStructuredJSON(request: AICompletionRequest): Promise<string> {
        // Convert Gemini Schema to OpenAI JSON Schema
        let jsonSchema = mapSchema(request.responseSchema);
        let isWrapped = false;

        // OpenAI Response Format MUST be an object. If the schema is an array (or primitive), wrap it.
        if (jsonSchema && jsonSchema.type !== 'object') {
            jsonSchema = {
                type: 'object',
                properties: {
                    data: jsonSchema
                },
                required: ['data'],
                additionalProperties: false
            };
            isWrapped = true;
        }

        try {
            // @ts-ignore - 'responses' is a new endpoint
            const response = await this.client.responses.create({
                model: request.model || 'gpt-5.2',
                input: [{ role: "user", content: request.prompt }],
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'data_extraction',
                        strict: true,
                        schema: jsonSchema
                    }
                }
            });

            const rawOutput = response.output_text || "";

            // Unwrap if we wrapped the structure
            if (isWrapped && rawOutput) {
                try {
                    const parsed = JSON.parse(rawOutput);
                    return JSON.stringify(parsed.data);
                } catch (e) {
                    console.warn("Failed to parse/unwrap OpenAI output, returning raw:", e);
                    return rawOutput;
                }
            }

            return rawOutput;
        } catch (error: any) {
            console.error("OpenAI Structured Output Error:", error);
            // Helpful error mapping for the UI
            if (error.message.includes('400')) {
                throw new Error(`OpenAI Schema Error: ${error.message}. Please check console.`);
            }
            throw error;
        }
    }
}
