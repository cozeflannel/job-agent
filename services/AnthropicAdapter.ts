import Anthropic from "@anthropic-ai/sdk";
import { AIClient, AICompletionRequest } from "../utils/AIClient";

export class AnthropicAdapter implements AIClient {
    private client: Anthropic;

    constructor(apiKey: string) {
        this.client = new Anthropic({
            apiKey: apiKey,
            // browsers (e.g. extension) require this or a proxy, assuming standard usage or dangerouslyAllowBrowser if supported/needed
            // The SDK might complain in browser without a proxy usually, but for extensions it might be okay or need specific config.
            // @anthropic-ai/sdk normally runs in Node. For browser extensions, we might need 'dangerouslyBrowser: true' equivalent 
            // but strictly speaking, their SDK is Node-first. However, usually people use fetch directly or allow it.
            // Let's check constructor options. 'dangerouslyAllowBrowser: true' is supported in recent versions.
        });
    }

    // Schema Converter for Anthropic Input Schema (Standard JSON Schema)
    private convertSchema(googleSchema: any): any {
        if (!googleSchema) return undefined;

        const convertType = (type: string) => {
            return type.toLowerCase();
        };

        const convertNode = (node: any): any => {
            const newNode: any = {
                type: convertType(node.type)
            };

            if (node.properties) {
                newNode.properties = {};
                newNode.required = []; // Claude prefers explicit required

                for (const [key, value] of Object.entries(node.properties)) {
                    newNode.properties[key] = convertNode(value);
                    // Google schema usually implies nullable means optional, otherwise required.
                    if (!(value as any).nullable) {
                        newNode.required.push(key);
                    }
                }
            }

            if (node.items) {
                newNode.items = convertNode(node.items);
            }

            if (node.enum) {
                newNode.enum = node.enum;
            }

            return newNode;
        };

        return convertNode(googleSchema);
    }

    async generateText(request: AICompletionRequest): Promise<string> {
        const model = request.model || 'claude-sonnet-4-5';

        let system = request.systemInstruction || "";
        let messages: any[] = [];

        if (request.history && request.history.length > 0) {
            const historyMsgs = request.history
                .filter(h => h.sender !== 'system' && h.text && h.text.trim().length > 0)
                .map(h => ({
                    role: h.sender === 'user' ? 'user' : 'assistant',
                    content: h.text
                }));
            messages = historyMsgs;
        }

        messages.push({ role: "user", content: request.prompt });

        const response = await this.client.messages.create({
            model: model,
            max_tokens: 4096,
            system: system,
            messages: messages,
        });

        if (response.content[0].type === 'text') {
            return response.content[0].text;
        }
        return "";
    }

    async generateStructuredJSON(request: AICompletionRequest): Promise<string> {
        const model = request.model || 'claude-sonnet-4-5';

        // Convert schema to tool definition
        const toolName = "output_formatter";
        const inputSchema = this.convertSchema(request.responseSchema);

        const system = request.systemInstruction
            ? `${request.systemInstruction}\n\nIMPORTANT: You must use the ${toolName} tool to output your response.`
            : `You must use the ${toolName} tool to output your response.`;

        const messages = [{ role: "user" as const, content: request.prompt }];

        const response = await this.client.messages.create({
            model: model,
            max_tokens: 4096,
            system: system,
            messages: messages,
            tools: [{
                name: toolName,
                description: "Formats the response into the required JSON structure.",
                input_schema: inputSchema
            }],
            tool_choice: { type: "tool", name: toolName }
        });

        // Find the tool use block
        const toolUseBlock = response.content.find(c => c.type === 'tool_use');

        if (toolUseBlock && toolUseBlock.type === 'tool_use') {
            return JSON.stringify(toolUseBlock.input);
        }

        throw new Error("Claude failed to use the output tool defined.");
    }
}
