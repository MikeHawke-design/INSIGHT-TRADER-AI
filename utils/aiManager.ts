
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import OpenAI from "openai";
import { ApiConfiguration, UserSettings } from "../types";

export interface StandardizedResponse {
    text: string;
    usage: {
        totalTokenCount: number;
    };
}

export interface AiManagerConfig {
    apiConfig: ApiConfiguration;
    preferredProvider: 'gemini' | 'openai' | 'groq';
}

export class AiManager {
    private apiConfig: ApiConfiguration;
    private provider: 'gemini' | 'openai' | 'groq';

    constructor(config: AiManagerConfig) {
        this.apiConfig = config.apiConfig;
        this.provider = config.preferredProvider;
    }

    private getGeminiClient() {
        const key = this.apiConfig.geminiApiKey || import.meta.env.VITE_API_KEY;
        if (!key) throw new Error("Gemini API Key not found");
        return new GoogleGenAI({ apiKey: key });
    }

    private getOpenAIClient() {
        const key = this.apiConfig.openaiApiKey;
        if (!key) throw new Error("OpenAI API Key not found");
        return new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true });
    }

    private getGroqClient() {
        const key = this.apiConfig.groqApiKey;
        if (!key) throw new Error("Groq API Key not found");
        // Groq uses OpenAI SDK with a different base URL
        return new OpenAI({
            apiKey: key,
            baseURL: "https://api.groq.com/openai/v1",
            dangerouslyAllowBrowser: true
        });
    }

    async generateContent(
        systemInstruction: string,
        userPrompt: string | Part[],
        model?: string
    ): Promise<StandardizedResponse> {
        try {
            if (this.provider === 'gemini') {
                return this.generateGemini(systemInstruction, userPrompt, model);
            } else if (this.provider === 'openai') {
                return this.generateOpenAI(systemInstruction, userPrompt, model);
            } else if (this.provider === 'groq') {
                return this.generateGroq(systemInstruction, userPrompt, model);
            }
            throw new Error(`Unknown provider: ${this.provider}`);
        } catch (error) {
            console.error(`AI Generation Error (${this.provider}):`, error);
            throw error;
        }
    }

    async generateChat(
        systemInstruction: string,
        history: { role: 'user' | 'assistant', content: string | Part[] }[],
        newMessage: string | Part[],
        model?: string
    ): Promise<StandardizedResponse> {
        try {
            if (this.provider === 'gemini') {
                return this.chatGemini(systemInstruction, history, newMessage, model);
            } else if (this.provider === 'openai') {
                return this.chatOpenAI(systemInstruction, history, newMessage, model);
            } else if (this.provider === 'groq') {
                return this.chatGroq(systemInstruction, history, newMessage, model);
            }
            throw new Error(`Unknown provider: ${this.provider}`);
        } catch (error) {
            console.error(`AI Chat Error (${this.provider}):`, error);
            throw error;
        }
    }

    private async generateGemini(systemInstruction: string, userPrompt: string | Part[], modelOverride?: string): Promise<StandardizedResponse> {
        const client = this.getGeminiClient();
        const model = modelOverride || 'gemini-2.5-flash';

        const contents = typeof userPrompt === 'string'
            ? [{ role: 'user', parts: [{ text: userPrompt }] }]
            : [{ role: 'user', parts: userPrompt }];

        const response = await client.models.generateContent({
            model: model,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
            }
        });

        return {
            text: response.text || "",
            usage: {
                totalTokenCount: response.usageMetadata?.totalTokenCount || 0
            }
        };
    }

    private async generateOpenAI(systemInstruction: string, userPrompt: string | Part[], modelOverride?: string): Promise<StandardizedResponse> {
        const client = this.getOpenAIClient();
        const model = modelOverride || 'gpt-4o'; // Default to GPT-4o for OpenAI

        const messages: any[] = [
            { role: "system", content: systemInstruction }
        ];

        if (typeof userPrompt === 'string') {
            messages.push({ role: "user", content: userPrompt });
        } else {
            // Convert Gemini Parts to OpenAI Content
            const contentParts = this.convertPartsToOpenAI(userPrompt);
            messages.push({ role: "user", content: contentParts });
        }

        const response = await client.chat.completions.create({
            model: model,
            messages: messages,
        });

        return {
            text: response.choices[0].message.content || "",
            usage: {
                totalTokenCount: response.usage?.total_tokens || 0
            }
        };
    }

    private async generateGroq(systemInstruction: string, userPrompt: string | Part[], modelOverride?: string): Promise<StandardizedResponse> {
        const client = this.getGroqClient();
        // Use Llama 3.2 90b Vision for multimodal, or 70b versatile for text
        // We need to detect if there are images
        const hasImages = Array.isArray(userPrompt) && userPrompt.some(p => p.inlineData);
        const defaultModel = hasImages ? 'llama-3.2-90b-vision-preview' : 'llama-3.3-70b-versatile';
        const model = modelOverride || defaultModel;

        const messages: any[] = [
            { role: "system", content: systemInstruction }
        ];

        if (typeof userPrompt === 'string') {
            messages.push({ role: "user", content: userPrompt });
        } else {
            const contentParts = this.convertPartsToOpenAI(userPrompt);
            messages.push({ role: "user", content: contentParts });
        }

        const response = await client.chat.completions.create({
            model: model,
            messages: messages,
        });

        return {
            text: response.choices[0].message.content || "",
            usage: {
                totalTokenCount: response.usage?.total_tokens || 0
            }
        };
    }

    private async chatGemini(
        systemInstruction: string,
        history: { role: 'user' | 'assistant', content: string | Part[] }[],
        newMessage: string | Part[],
        modelOverride?: string
    ): Promise<StandardizedResponse> {
        const client = this.getGeminiClient();
        const model = modelOverride || 'gemini-2.5-flash';

        // Convert history to Gemini format
        const geminiHistory = history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: typeof msg.content === 'string' ? [{ text: msg.content }] : msg.content
        }));

        const newParts = typeof newMessage === 'string' ? [{ text: newMessage }] : newMessage;

        const chat = client.chats.create({
            model: model,
            config: { systemInstruction },
            history: geminiHistory
        });

        const response = await chat.sendMessage(newParts);

        return {
            text: response.text || "",
            usage: {
                totalTokenCount: response.usageMetadata?.totalTokenCount || 0
            }
        };
    }

    private async chatOpenAI(
        systemInstruction: string,
        history: { role: 'user' | 'assistant', content: string | Part[] }[],
        newMessage: string | Part[],
        modelOverride?: string
    ): Promise<StandardizedResponse> {
        const client = this.getOpenAIClient();
        const model = modelOverride || 'gpt-4o';

        const messages: any[] = [
            { role: "system", content: systemInstruction }
        ];

        // Convert history
        history.forEach(msg => {
            if (typeof msg.content === 'string') {
                messages.push({ role: msg.role, content: msg.content });
            } else {
                const contentParts = this.convertPartsToOpenAI(msg.content);
                messages.push({ role: msg.role, content: contentParts });
            }
        });

        // Add new message
        if (typeof newMessage === 'string') {
            messages.push({ role: "user", content: newMessage });
        } else {
            const contentParts = this.convertPartsToOpenAI(newMessage);
            messages.push({ role: "user", content: contentParts });
        }

        const response = await client.chat.completions.create({
            model: model,
            messages: messages,
        });

        return {
            text: response.choices[0].message.content || "",
            usage: {
                totalTokenCount: response.usage?.total_tokens || 0
            }
        };
    }

    private async chatGroq(
        systemInstruction: string,
        history: { role: 'user' | 'assistant', content: string | Part[] }[],
        newMessage: string | Part[],
        modelOverride?: string
    ): Promise<StandardizedResponse> {
        const client = this.getGroqClient();

        // Detect images in history or new message
        const hasImages = (Array.isArray(newMessage) && newMessage.some(p => p.inlineData)) ||
            history.some(h => Array.isArray(h.content) && h.content.some(p => p.inlineData));

        const defaultModel = hasImages ? 'llama-3.2-90b-vision-preview' : 'llama-3.3-70b-versatile';
        const model = modelOverride || defaultModel;

        const messages: any[] = [
            { role: "system", content: systemInstruction }
        ];

        // Convert history
        history.forEach(msg => {
            if (typeof msg.content === 'string') {
                messages.push({ role: msg.role, content: msg.content });
            } else {
                const contentParts = this.convertPartsToOpenAI(msg.content);
                messages.push({ role: msg.role, content: contentParts });
            }
        });

        // Add new message
        if (typeof newMessage === 'string') {
            messages.push({ role: "user", content: newMessage });
        } else {
            const contentParts = this.convertPartsToOpenAI(newMessage);
            messages.push({ role: "user", content: contentParts });
        }

        const response = await client.chat.completions.create({
            model: model,
            messages: messages,
        });

        return {
            text: response.choices[0].message.content || "",
            usage: {
                totalTokenCount: response.usage?.total_tokens || 0
            }
        };
    }

    private convertPartsToOpenAI(parts: Part[]): any[] {
        return parts.map(part => {
            if (part.text) return { type: "text", text: part.text };
            if (part.inlineData) {
                return {
                    type: "image_url",
                    image_url: {
                        url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                    }
                };
            }
            return null;
        }).filter(Boolean);
    }
}
