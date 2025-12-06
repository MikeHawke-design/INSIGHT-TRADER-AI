import { GoogleGenAI, Part } from "@google/generative-ai";
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
1.  **DATA MERGING (CRITICAL):**
    - **Asset Symbol:** If ANY model identifies a specific symbol (e.g., "BTC/USD", "NVDA") and others return "Asset" or "Unknown", **YOU MUST ADOPT THE SPECIFIC SYMBOL**. Do not default to "Asset".
    - **Price Levels:** If models differ slightly on price (e.g., 90445 vs 90450), prefer the one that aligns best with the identified Key Levels or FVG midpoints.
    - **Timeframe:** Adopt the consensus timeframe.

2.  **SYNERGY & CONSENSUS:**
    - **Combine Strengths:** If Model A identifies the correct Asset/Timeframe but misses the Setup, and Model B finds a valid Setup but misses the Asset, **COMBINE THEM**. Use Model B's Setup with Model A's Asset.
    - **Filter Hallucinations:** If one model sees a pattern that others explicitly contradict or miss, be skeptical. However, if the reasoning is sound and evidence is cited (e.g., specific candle times), give it weight.

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
        // Fallback to gemini-pro if flash is causing issues, or use the override
        const modelName = modelOverride || 'gemini-pro';

        // For maximum compatibility, we do NOT pass systemInstruction to getGenerativeModel
        // because older models (like gemini-pro) or certain API versions might not support it.
        // Instead, we prepend it to the user prompt.
        const model = client.getGenerativeModel({
            model: modelName,
            generationConfig: {
                maxOutputTokens: 65536
            }
        });

        let finalPrompt: Part[] = [];

        // Add system instruction as the first text part
        finalPrompt.push({ text: `SYSTEM INSTRUCTION: ${systemInstruction}\n\nUSER REQUEST:` });

        // Add user prompt parts
        if (typeof userPrompt === 'string') {
            finalPrompt.push({ text: userPrompt });
        } else {
            finalPrompt = finalPrompt.concat(userPrompt);
        }

        const contents = [{ role: 'user', parts: finalPrompt }];

        let retries = 0;
        const maxRetries = 3;

        while (true) {
            try {
                const result = await model.generateContent({
                    contents: contents
                });
                const response = await result.response;

                let text = response.text() || "";
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
                // Check for 429 Resource Exhausted
                if (error.status === 429 || error.code === 429 || (error.message && error.message.includes('429'))) {
                    retries++;
                    if (retries > maxRetries) {
                        throw error;
                    }

                    // Extract retry delay from error message or default to 2s * retries
                    let delay = 2000 * retries;

                    // Try to parse "Please retry in X.Xs"
                    const match = error.message?.match(/retry in ([0-9.]+)s/);
                    if (match) {
                        delay = parseFloat(match[1]) * 1000 + 100; // Add 100ms buffer
                    }

                    console.warn(`Gemini Rate Limit Hit. Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                throw error;
            }
        }
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
            max_tokens: 4096,
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
        const modelName = modelOverride || 'gemini-pro';

        const model = client.getGenerativeModel({
            model: modelName,
            generationConfig: {
                maxOutputTokens: 8192
            }
        });

        // Convert history to Gemini format
        const geminiHistory = history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: typeof msg.content === 'string' ? [{ text: msg.content }] : msg.content
        }));

        // Prepend system instruction as a user message at the start of history
        // This is a workaround for models/APIs that don't support systemInstruction natively
        geminiHistory.unshift({
            role: 'user',
            parts: [{ text: `SYSTEM INSTRUCTION: ${systemInstruction}` }]
        });

        // We need to ensure the next message is a model response to maintain turn-taking if we just inserted a user message?
        // Actually, Gemini Pro is lenient, but usually it expects User -> Model -> User.
        // If we insert a User message at the start, and the first message in history was User, we have User -> User.
        // To fix this, we can merge it into the first user message if it exists.

        if (geminiHistory.length > 1 && geminiHistory[1].role === 'user') {
            // Merge system instruction into the first user message
            const firstUserMsg = geminiHistory[1];
            const sysMsg = geminiHistory.shift(); // Remove the one we just added
            if (sysMsg && sysMsg.parts[0].text) {
                const firstPart = firstUserMsg.parts[0];
                if (firstPart.text) {
                    firstPart.text = `${sysMsg.parts[0].text}\n\n${firstPart.text}`;
                }
            }
        }

        const chat = model.startChat({
            history: geminiHistory
        });

        const newParts = typeof newMessage === 'string' ? [{ text: newMessage }] : newMessage;

        const result = await chat.sendMessage(newParts);
        const response = await result.response;

        return {
            text: response.text() || "",
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
            max_tokens: 4096,
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
