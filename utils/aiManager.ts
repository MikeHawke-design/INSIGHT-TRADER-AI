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
        // We use a helper to catch errors individually so Promise.all doesn't fail immediately
        const safeGenerate = async (provider: string, generator: () => Promise<StandardizedResponse>) => {
            try {
                const res = await generator();
                return { provider, response: res };
            } catch (err: any) {
                console.warn(`Council Member ${provider} failed:`, err);
                return { provider, response: null, error: err };
            }
        };

        if (this.apiConfig.geminiApiKey || import.meta.env.VITE_API_KEY) {
            promises.push(safeGenerate('Gemini', () => this.generateGemini(systemInstruction, userPrompt)));
        }
        if (this.apiConfig.openaiApiKey) {
            promises.push(safeGenerate('OpenAI', () => this.generateOpenAI(systemInstruction, userPrompt)));
        }
        if (this.apiConfig.groqApiKey) {
            promises.push(safeGenerate('Groq', () => this.generateGroq(systemInstruction, userPrompt)));
        }

        const results = await Promise.all(promises);
        const successfulResponses = results.filter(r => r.response !== null);

        if (successfulResponses.length === 0) {
            // Log the specific errors for debugging
            const errors = results.map(r => `${r.provider}: ${r.error?.message || 'Unknown Error'}`).join(', ');
            throw new Error(`Council Mode Failed: All providers failed. Details: ${errors}`);
        }

        // 2. Synthesize Results
        // We need a "Judge" to synthesize. We prefer Gemini or OpenAI for this reasoning task.
        // ROBUSTNESS IMPROVEMENT: Try primary judge, then fallback to secondary.

        const tryJudge = async (provider: 'gemini' | 'openai'): Promise<StandardizedResponse> => {
            try {
                if (provider === 'openai') {
                    if (!this.apiConfig.openaiApiKey) throw new Error("OpenAI key missing for Judge");
                    return await this.generateOpenAI(systemInstruction, synthesisPrompt);
                } else {
                    return await this.generateGemini(systemInstruction, synthesisPrompt);
                }
            } catch (err) {
                console.warn(`Judge ${provider} failed:`, err);
                throw err;
            }
        };

        const councilTranscript = results.map(r => {
            if (r.response) {
                return `
--- OPINION FROM ${r.provider.toUpperCase()} ---
${r.response.text}
------------------------------------------------
`;
            } else {
                return `
--- OPINION FROM ${r.provider.toUpperCase()} ---
[FAILED TO GENERATE OPINION: ${r.error?.message || 'Unknown Error'}]
------------------------------------------------
`;
            }
        }).join('\n\n');

        const synthesisPrompt = `
You are the High Council Judge.
You have received independent analyses from multiple AI experts regarding a trading setup.
Your job is to SYNTHESIZE these opinions into a SINGLE, FINAL VERDICT.

**RULES FOR JUDGMENT:**
1.  **DATA MERGING (CRITICAL):**
    - **Asset Symbol:** If ANY model identifies a specific symbol (e.g., "BTC/USD", "NVDA") and others return "Asset" or "Unknown", **YOU MUST ADOPT THE SPECIFIC SYMBOL**. Do not default to "Asset".
    - **Price Levels:** If models differ slightly on price (e.g., 90445 vs 90450), prefer the one that aligns best with the identified Key Levels or FVG midpoints.
    - **Timeframe:** Adopt the consensus timeframe.

2.  **SYNERGY & CONSENSUS:**
    - **Combine Strengths:** If Model A identifies the correct Asset/Timeframe but misses the Setup, and Model B finds a valid Setup but misses the Asset, **COMBINE THEM**. Use Model B's Setup with Model A's Asset.
    - **Filter Hallucinations:** If one model sees a pattern that others explicitly contradict or miss, be skeptical. However, if the reasoning is sound and evidence is cited (e.g., specific candle times), give it weight.
    - **Handle Failures:** Some council members may have failed to report. Ignore their missing input and focus solely on the successful opinions.

3.  **STRICT STRATEGY ADHERENCE:**
    - The user's strategy is law. If a model proposes a trade that violates the strategy rules, REJECT IT.
    - If multiple valid setups are found, prioritize the one with the highest "Heat" (confluence) and best Risk:Reward.

4.  **UNIFIED OUTPUT:**
    - Produce a single JSON response following the exact format required by the system instruction.
    - **Reasoning Field:** In the 'strategySuggestion.reasoning' field, explicitly state: "The Council has spoken. [Model Name] identified [Key Feature], while [Model Name] clarified [Other Feature]. We have synthesized this into..."
    - Do NOT output a meta-commentary outside the JSON. Output the final JSON as if YOU performed the analysis, but backed by the wisdom of the council.

**THE OPINIONS:**
${councilTranscript}
`;

        // Attempt Judgment with Fallback
        let finalResponse: StandardizedResponse | null = null;
        let judgeError: any = null;

        // Priority 1: OpenAI (if available)
        if (this.apiConfig.openaiApiKey) {
            try {
                finalResponse = await tryJudge('openai');
            } catch (e) {
                judgeError = e;
                console.warn("Primary Judge (OpenAI) failed, attempting fallback to Gemini...");
            }
        }

        // Priority 2: Gemini (Fallback or Primary if OpenAI missing)
        if (!finalResponse) {
            try {
                finalResponse = await tryJudge('gemini');
            } catch (e) {
                judgeError = e; // Overwrite or set error
            }
        }

        if (!finalResponse) {
            throw new Error(`Council Judgment Failed: All Judge providers failed. Last error: ${judgeError?.message}`);
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
        // Use specific version to avoid alias resolution issues
        const primaryModel = modelOverride || 'gemini-1.5-flash-001';

        const contents = typeof userPrompt === 'string'
            ? [{ role: 'user', parts: [{ text: userPrompt }] }]
            : [{ role: 'user', parts: userPrompt }];

        try {
            const response = await client.models.generateContent({
                model: primaryModel,
                contents: contents,
                config: {
                    systemInstruction: systemInstruction,
                    maxOutputTokens: 65536,
                }
            });

            let text = response.text || "";
            if (!text && response.candidates && response.candidates.length > 0) {
                const candidate = response.candidates[0];
                if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                    text = `AI_GENERATION_FAILED: ${candidate.finishReason}`;
                }
            }

            return {
                text: text,
                usage: {
                    totalTokenCount: response.usageMetadata?.totalTokenCount || 0
                }
            };
        } catch (error: any) {
            // Fallback for 404 (Model Not Found) or other errors
            if (primaryModel.includes('flash') && (error.message?.includes('404') || error.message?.includes('not found'))) {
                console.warn(`Gemini model ${primaryModel} not found. Falling back to gemini-pro...`);
                try {
                    const fallbackResponse = await client.models.generateContent({
                        model: 'gemini-pro',
                        contents: contents,
                        config: {
                            systemInstruction: systemInstruction,
                        }
                    });
                    return {
                        text: fallbackResponse.text || "",
                        usage: {
                            totalTokenCount: fallbackResponse.usageMetadata?.totalTokenCount || 0
                        }
                    };
                } catch (fallbackError) {
                    throw fallbackError; // Throw the fallback error if that fails too
                }
            }
            throw error;
        }
    }

    private async generateOpenAI(systemInstruction: string, userPrompt: string | Part[], modelOverride?: string): Promise<StandardizedResponse> {
        const client = this.getOpenAIClient();
        let model = modelOverride || 'gpt-4o'; // Default to GPT-4o

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

        try {
            const response = await client.chat.completions.create({
                model: model,
                messages: messages,
                max_tokens: 4096,
            });

            return {
                text: response.choices[0].message.content || "",
                usage: {
                    totalTokenCount: response.usage?.total_tokens || 0
                }
            };
        } catch (error: any) {
            // Fallback to gpt-4o-mini if gpt-4o fails (e.g. rate limit or quota)
            if (model === 'gpt-4o' && (error.status === 429 || error.status === 402 || error.status === 400)) {
                console.warn("GPT-4o failed, falling back to GPT-4o-mini...", error);
                const fallbackResponse = await client.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: messages,
                    max_tokens: 4096,
                });
                return {
                    text: fallbackResponse.choices[0].message.content || "",
                    usage: {
                        totalTokenCount: fallbackResponse.usage?.total_tokens || 0
                    }
                };
            }
            throw error;
        }
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
            max_tokens: 4096,
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
        // Use specific version to avoid alias resolution issues
        const primaryModel = modelOverride || 'gemini-1.5-flash-001';

        // Convert history to Gemini format
        const geminiHistory = history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: typeof msg.content === 'string' ? [{ text: msg.content }] : msg.content
        }));

        const newParts = typeof newMessage === 'string' ? [{ text: newMessage }] : newMessage;

        try {
            const chat = client.chats.create({
                model: primaryModel,
                config: { systemInstruction, maxOutputTokens: 8192 },
                history: geminiHistory
            });

            const response = await chat.sendMessage({ message: newParts });

            return {
                text: response.text || "",
                usage: {
                    totalTokenCount: response.usageMetadata?.totalTokenCount || 0
                }
            };
        } catch (error: any) {
            // Fallback for 404 (Model Not Found) or other errors
            if (primaryModel.includes('flash') && (error.message?.includes('404') || error.message?.includes('not found'))) {
                console.warn(`Gemini Chat model ${primaryModel} not found. Falling back to gemini-pro...`);
                try {
                    const chat = client.chats.create({
                        model: 'gemini-pro',
                        config: { systemInstruction, maxOutputTokens: 8192 },
                        history: geminiHistory
                    });

                    const response = await chat.sendMessage({ message: newParts });

                    return {
                        text: response.text || "",
                        usage: {
                            totalTokenCount: response.usageMetadata?.totalTokenCount || 0
                        }
                    };
                } catch (fallbackError) {
                    throw fallbackError;
                }
            }
            throw error;
        }
    }

    private async chatOpenAI(
        systemInstruction: string,
        history: { role: 'user' | 'assistant', content: string | Part[] }[],
        newMessage: string | Part[],
        modelOverride?: string
    ): Promise<StandardizedResponse> {
        const client = this.getOpenAIClient();
        let model = modelOverride || 'gpt-4o';

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

        try {
            const response = await client.chat.completions.create({
                model: model,
                messages: messages,
                max_tokens: 4096,
            });

            return {
                text: response.choices[0].message.content || "",
                usage: {
                    totalTokenCount: response.usage?.total_tokens || 0
                }
            };
        } catch (error: any) {
            // Fallback to gpt-4o-mini if gpt-4o fails
            if (model === 'gpt-4o' && (error.status === 429 || error.status === 402 || error.status === 400)) {
                console.warn("GPT-4o Chat failed, falling back to GPT-4o-mini...", error);
                const fallbackResponse = await client.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: messages,
                    max_tokens: 4096,
                });
                return {
                    text: fallbackResponse.choices[0].message.content || "",
                    usage: {
                        totalTokenCount: fallbackResponse.usage?.total_tokens || 0
                    }
                };
            }
            throw error;
        }
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
            max_tokens: 4096,
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
