import { GoogleGenAI, Part } from "@google/genai";
import OpenAI from "openai";
import { ApiConfiguration } from "../types";

export interface StandardizedResponse {
    text: string;
    usage: {
        totalTokenCount: number;
    };
}

export interface AiManagerConfig {
    apiConfig: ApiConfiguration;
    preferredProvider: 'gemini' | 'openai' | 'groq' | 'council';
}

export class AiManager {
    private apiConfig: ApiConfiguration;
    private provider: 'gemini' | 'openai' | 'groq' | 'council';

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
            if (this.provider === 'council') {
                return this.generateCouncil(systemInstruction, userPrompt);
            } else if (this.provider === 'gemini') {
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

    private async generateCouncil(systemInstruction: string, userPrompt: string | Part[]): Promise<StandardizedResponse> {
        const promises: Promise<{ provider: string, response: StandardizedResponse | null, error?: any }>[] = [];

        // 1. Launch Parallel Requests
        if (this.apiConfig.geminiApiKey || import.meta.env.VITE_API_KEY) {
            promises.push(this.generateGemini(systemInstruction, userPrompt).then(res => ({ provider: 'Gemini', response: res })).catch(err => ({ provider: 'Gemini', response: null, error: err })));
        }
        if (this.apiConfig.openaiApiKey) {
            promises.push(this.generateOpenAI(systemInstruction, userPrompt).then(res => ({ provider: 'OpenAI', response: res })).catch(err => ({ provider: 'OpenAI', response: null, error: err })));
        }
        if (this.apiConfig.groqApiKey) {
            promises.push(this.generateGroq(systemInstruction, userPrompt).then(res => ({ provider: 'Groq', response: res })).catch(err => ({ provider: 'Groq', response: null, error: err })));
        }

        const results = await Promise.all(promises);
        const successfulResponses = results.filter(r => r.response !== null);

        if (successfulResponses.length === 0) {
            throw new Error("Council Mode Failed: All providers failed to generate a response.");
        }

        // 2. Synthesize Results
        // We need a "Judge" to synthesize. We prefer Gemini or OpenAI for this reasoning task.
        let judgeProvider: 'gemini' | 'openai' = 'gemini';

        if (this.apiConfig.openaiApiKey) {
            judgeProvider = 'openai';
        } else {
            judgeProvider = 'gemini'; // Default to Gemini (usually free/available)
        }

        const councilTranscript = successfulResponses.map(r => `
--- OPINION FROM ${r.provider.toUpperCase()} ---
${r.response?.text}
------------------------------------------------
`).join('\n\n');

        const synthesisPrompt = `
You are the High Council Judge.
You have received independent analyses from multiple AI experts regarding a trading setup.
Your job is to SYNTHESIZE these opinions into a SINGLE, FINAL VERDICT.

**RULES FOR JUDGMENT:**
1.  **Filter Hallucinations:** If one model sees a pattern that others explicitly contradict or miss, be skeptical. Look for consensus.
2.  **Strict Strategy Adherence:** The user's strategy is law. If a model proposes a trade that violates the strategy rules (provided in the system instruction), REJECT IT.
3.  **Best Setup Wins:** If one model found a valid, high-quality setup and others missed it, adopt the valid setup.
4.  **Unified Output:** Produce a single JSON response following the exact format required by the system instruction. Do NOT output a meta-commentary. Output the final JSON as if YOU performed the analysis, but backed by the wisdom of the council.

**THE OPINIONS:**
${councilTranscript}
`;

        // Call the Judge
        let finalResponse: StandardizedResponse;
        if (judgeProvider === 'openai') {
            finalResponse = await this.generateOpenAI(systemInstruction, synthesisPrompt); // Pass system instruction again to keep context
        } else {
            finalResponse = await this.generateGemini(systemInstruction, synthesisPrompt);
        }

        // Sum up tokens for billing/tracking
        const totalTokens = successfulResponses.reduce((acc, r) => acc + (r.response?.usage.totalTokenCount || 0), 0) + finalResponse.usage.totalTokenCount;

        return {
            text: finalResponse.text + "\n\n<<<COUNCIL_TRANSCRIPT_START>>>\n" + councilTranscript + "\n<<<COUNCIL_TRANSCRIPT_END>>>",
            usage: {
                totalTokenCount: totalTokens
            }
        };
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

        const defaultModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
        let model = modelOverride || defaultModel;

        // Safety check for deprecated models
        if (model.includes('llama-3.2-90b') || model.includes('llama-3.2-11b') || model.includes('llama-3.3-70b')) {
            console.warn(`Deprecated model ${model} detected. Switching to ${defaultModel}`);
            model = defaultModel;
        }

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

        const response = await chat.sendMessage({ message: newParts });

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


        const defaultModel = 'meta-llama/llama-4-scout-17b-16e-instruct';
        let model = modelOverride || defaultModel;

        // Safety check for deprecated models
        if (model.includes('llama-3.2-90b') || model.includes('llama-3.2-11b') || model.includes('llama-3.3-70b')) {
            console.warn(`Deprecated model ${model} detected. Switching to ${defaultModel}`);
            model = defaultModel;
        }

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
