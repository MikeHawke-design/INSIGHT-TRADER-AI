import React, { useState, useRef, useEffect } from 'react';
import { UserSettings, StrategyLogicData, ChatMessage } from '../types';
import { GoogleGenAI } from '@google/genai';
import { STRATEGY_BUILDER_PROMPT } from '../constants';

interface StrategyBuilderViewProps {
    userSettings: UserSettings;
    onSaveStrategy: (strategy: StrategyLogicData) => void;
    onCancel: () => void;
    apiConfig: { geminiApiKey?: string };
}

const StrategyBuilderView: React.FC<StrategyBuilderViewProps> = ({
    userSettings,
    onSaveStrategy,
    onCancel,
    apiConfig
}) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: 'welcome',
            sender: 'oracle',
            text: "Hello! I'm your Strategy Architect. Tell me about the trading strategy you'd like to build. I can help you define entry rules, stop loss logic, and take profit targets based on proven concepts like ICT, Price Action, or standard indicators.",
            timestamp: new Date(),
            type: 'text'
        }
    ]);
    const [input, setInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentDraft, setCurrentDraft] = useState<Partial<StrategyLogicData> | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim() || isGenerating) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: input,
            timestamp: new Date(),
            type: 'text'
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsGenerating(true);

        try {
            const apiKey = apiConfig.geminiApiKey || import.meta.env.VITE_API_KEY;

            if (!apiKey) {
                throw new Error("API Key missing");
            }

            const genAI = new GoogleGenAI({ apiKey });

            const contentHistory = messages
                .filter(m => m.id !== 'welcome')
                .map(m => ({
                    role: m.sender === 'user' ? 'user' : 'model',
                    parts: [{ text: m.text }]
                }));

            const fullContents = [
                ...contentHistory,
                { role: 'user', parts: [{ text: input }] }
            ];

            const result = await genAI.models.generateContent({
                model: "gemini-2.5-flash",
                contents: fullContents,
                config: {
                    systemInstruction: STRATEGY_BUILDER_PROMPT
                }
            });

            const responseText = result.text || "";

            // Try to extract JSON if the AI decided to finalize the strategy
            let aiText = responseText;

            // Robust JSON extraction
            const fenceRegex = /```json\s*([\s\S]*?)\s*```/;
            const match = responseText.match(fenceRegex);

            if (match && match[1]) {
                try {
                    const jsonStr = match[1].trim();
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.name && parsed.prompt) {
                        // Strip the JSON from the displayed text to keep chat clean
                        // We replace the whole code block with a placeholder message
                        aiText = responseText.replace(fenceRegex, "I've drafted the strategy based on your requirements. Check the preview panel on the right!");
                        setCurrentDraft(parsed);
                    }
                } catch (e) {
                    console.error("Failed to parse strategy JSON", e);
                }
            }

            const aiMsg: ChatMessage = {
                id: Date.now().toString(),
                sender: 'oracle',
                text: aiText,
                timestamp: new Date(),
                type: 'text'
            };

            setMessages(prev => [...prev, aiMsg]);

        } catch (error) {
            console.error("Strategy generation error:", error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                sender: 'oracle',
                text: "I encountered an error while processing your request. Please try again.",
                timestamp: new Date(),
                type: 'text'
            }]);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = () => {
        if (currentDraft && currentDraft.name && currentDraft.prompt) {
            // Ensure all required fields are present
            const finalStrategy: StrategyLogicData = {
                name: currentDraft.name,
                description: currentDraft.description || "Custom Strategy",
                prompt: currentDraft.prompt,
                status: 'active',
                requirements: currentDraft.requirements || { title: "Rules", items: [] },
                isEnabled: true,
                ...currentDraft
            };
            onSaveStrategy(finalStrategy);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[hsl(var(--color-bg-900))] text-white p-4 gap-4 md:flex-row">
            {/* Chat Section */}
            <div className="flex-1 flex flex-col bg-[hsl(var(--color-bg-800))] rounded-lg border border-[hsl(var(--color-border-700))] overflow-hidden">
                <div className="p-4 border-b border-[hsl(var(--color-border-700))] flex justify-between items-center">
                    <h2 className="font-bold text-lg text-purple-300">Strategy Architect</h2>
                    <button onClick={onCancel} className="text-gray-400 hover:text-white">Exit</button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ fontSize: `${userSettings.chatFontSize}px` }}>
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] p-3 rounded-lg ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-[hsl(var(--color-bg-700))] text-gray-200'}`}>
                                <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                            </div>
                        </div>
                    ))}
                    {isGenerating && (
                        <div className="flex justify-start">
                            <div className="bg-[hsl(var(--color-bg-700))] p-3 rounded-lg">
                                <span className="animate-pulse text-purple-400">Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-[hsl(var(--color-border-700))]">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Describe your strategy (e.g., 'Buy when RSI < 30 and price is above 200 EMA')..."
                            className="flex-1 bg-[hsl(var(--color-bg-900))] border border-[hsl(var(--color-border-600))] rounded-md p-2 text-sm focus:outline-none focus:border-purple-500"
                            disabled={isGenerating}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={isGenerating || !input.trim()}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>

            {/* Preview Section */}
            <div className="w-full md:w-1/3 bg-[hsl(var(--color-bg-800))] rounded-lg border border-[hsl(var(--color-border-700))] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[hsl(var(--color-border-700))] bg-[hsl(var(--color-bg-900)/0.5)]">
                    <h3 className="font-bold text-gray-200">Strategy Preview</h3>
                </div>

                <div className="flex-1 p-4 overflow-y-auto">
                    {currentDraft ? (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500 uppercase font-semibold">Name</label>
                                <p className="text-lg font-bold text-white">{currentDraft.name}</p>
                            </div>

                            <div>
                                <label className="text-xs text-gray-500 uppercase font-semibold">Description</label>
                                <p className="text-sm text-gray-300">{currentDraft.description}</p>
                            </div>

                            {currentDraft.requirements && (
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-semibold">Key Rules</label>
                                    <ul className="list-disc list-inside text-sm text-gray-300 mt-1 space-y-1">
                                        {currentDraft.requirements.items.map((item, i) => (
                                            <li key={i}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="pt-4 border-t border-[hsl(var(--color-border-700))]">
                                <p className="text-xs text-yellow-500 mb-2">
                                    <span className="font-bold">Note:</span> This strategy will be saved to your local browser storage.
                                </p>
                                <button
                                    onClick={handleSave}
                                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-md transition-colors"
                                >
                                    Add to Strategies
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center p-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                            <p className="text-sm">Chat with the Architect to build your strategy. A preview will appear here once drafted.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StrategyBuilderView;
