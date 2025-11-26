/// <reference types="vite/client" />
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Part, Content } from "@google/genai";
import { StrategyLogicData, UserSettings, ApiConfiguration, ChatMessage, Trade, SavedCoachingSession, StrategyKey } from '../types';
import Logo from './Logo';
import ScreenCaptureModal from './ScreenCaptureModal';
import { storeImage, getImage } from '../idb';

interface CoachingViewProps {
    context: {
        strategy: StrategyLogicData;
        goal: 'learn_basics' | 'build_setup';
        session?: SavedCoachingSession;
        strategyKey: StrategyKey;
    };
    onClose: () => void;
    apiConfig: ApiConfiguration;
    userSettings: UserSettings;
    onLogTokenUsage: (tokens: number) => void;
    onSaveSession: (sessionId: string | null, title: string, chatHistory: ChatMessage[], goal: 'learn_basics' | 'build_setup') => void;
    onSaveTrade: (trade: Trade, strategies: string[], chatHistory: ChatMessage[]) => void;
}

// --- Helper Components & Icons ---
const UploadIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 0 0 1.09 1.03L9.25 4.636V13.25Z" /><path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" /></svg>;
const ScreenIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.25 3A2.25 2.25 0 0 0 1 5.25v9.5A2.25 2.25 0 0 0 3.25 17h13.5A2.25 2.25 0 0 0 19 14.75v-9.5A2.25 2.25 0 0 0 16.75 3H3.25Zm12.5 11.5H4.25a.75.75 0 0 1-.75-.75V6.25a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 .75.75v8.5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>;
const SaveIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4.5a2.5 2.5 0 0 1 5 0v2.086a.25.25 0 0 0 .25.25h3.5a.25.25 0 0 0 .25-.25V4.5a2.5 2.5 0 0 1 5 0v11a2.5 2.5 0 0 1-5 0V9.75a.75.75 0 0 0-1.5 0v5.75a.25.25 0 0 0 .25.25h3.5a.25.25 0 0 0 .25-.25V13.5a2.5 2.5 0 0 1 5 0v2a2.5 2.5 0 0 1-2.5 2.5h-10A2.5 2.5 0 0 1 2.5 17.5v-10A2.5 2.5 0 0 1 5 4.5Z" /></svg>;

const IdbImageDisplay: React.FC<{ imageKey: string, onZoom: (src: string) => void }> = ({ imageKey, onZoom }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        getImage(imageKey).then(url => {
            if (isMounted) setImageUrl(url || null);
        });
        return () => { isMounted = false; };
    }, [imageKey]);

    if (!imageUrl) return <div className="not-prose rounded-md my-2 animate-pulse bg-gray-600 h-32 w-48"></div>;

    return (
        <img
            src={imageUrl}
            alt="Example illustration"
            className="not-prose rounded-md my-2 max-w-xs cursor-pointer transition-transform hover:scale-105"
            onClick={() => onZoom(imageUrl)}
        />
    );
};


async function transformHistoryForApi(chatHistory: ChatMessage[]): Promise<Content[]> {
    const history: Content[] = [];
    for (const msg of chatHistory) {
        const role = msg.sender === 'user' ? 'user' : 'model';
        const parts: Part[] = [];

        // The API expects raw text, not HTML. We need to strip it so the model reads clean text.
        if (msg.text) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = msg.text;
            const text = tempDiv.textContent || msg.text;
            parts.push({ text });
        }

        if (msg.imageKeys && msg.imageKeys.length > 0) {
            for (const key of msg.imageKeys) {
                const base64 = await getImage(key);
                if (base64) {
                    const prefixMatch = base64.match(/^data:(image\/(?:png|jpeg|webp));base64,/);
                    if (prefixMatch) {
                        parts.push({ inlineData: { mimeType: prefixMatch[1], data: base64.substring(prefixMatch[0].length) } });
                    }
                }
            }
        }

        if (parts.length > 0) {
            history.push({ role, parts });
        }
    }
    return history;
}

const CoachingView: React.FC<CoachingViewProps> = ({
    context,
    onClose,
    apiConfig,
    userSettings: _userSettings,
    onLogTokenUsage,
    onSaveSession,
}) => {
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>(context.session?.chatHistory || []);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sessionTitle, setSessionTitle] = useState(context.session?.title || `Coaching: ${context.strategy.name}`);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    // Screen Capture State
    const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
    const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
    const [captureError, setCaptureError] = useState<string | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Annotation State
    const [isAnnotationModalOpen, setIsAnnotationModalOpen] = useState(false);
    const [pendingImage, setPendingImage] = useState<string | null>(null);
    const [annotationText, setAnnotationText] = useState('');

    useEffect(() => {
        if (chatHistory.length === 0) {
            // Initial greeting based on goal
            const greeting = context.goal === 'learn_basics'
                ? `Hello! I'm your AI coach for the <strong style="color: #FBBF24;">${context.strategy.name}</strong> strategy. I'm here to help you master the core concepts. What specific part would you like to tackle first?`
                : `Ready to build a trade setup using <strong style="color: #FBBF24;">${context.strategy.name}</strong>? Upload a chart or describe the market, and we'll find the edge.`;

            setChatHistory([{
                id: 'init',
                sender: 'oracle',
                text: greeting,
                timestamp: new Date(),
                type: 'text'
            }]);
        }
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const handleSendMessage = async (forcedInput?: string, imageKey?: string) => {
        const textToSend = forcedInput || input;
        if (!textToSend.trim() && !imageKey && !isSending) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            sender: 'user',
            text: textToSend,
            timestamp: new Date(),
            type: 'text',
            imageKeys: imageKey ? [imageKey] : undefined
        };

        const newHistory = [...chatHistory, userMsg];
        setChatHistory(newHistory);
        setInput('');
        setIsSending(true);

        try {
            // Use API key from config
            const ai = new GoogleGenAI({ apiKey: apiConfig.geminiApiKey || import.meta.env.VITE_API_KEY });

            // Transform history for API
            const apiHistory = await transformHistoryForApi(newHistory);

            // Separate previous history and the new message
            const historyForChat = apiHistory.slice(0, -1);
            const lastMessageContent = apiHistory[apiHistory.length - 1];

            // Define Strict System Instruction for formatting
            const systemInstruction = `You are an expert trading coach specializing in the "${context.strategy.name}" strategy.

**YOUR MANDATE:**
1.  **EXTREME CONCISENESS:** Do not ramble. Use short, punchy sentences. No fluff. No "It is important to remember". Just state the fact.
2.  **VISUAL STRUCTURE (HTML ONLY):**
    -   Use \`<h3>\` for section headers to segment the answer.
    -   Use \`<ul>\` and \`<li>\` for all lists, steps, or criteria.
    -   Use \`<p>\` for brief explanations (max 2 sentences).
3.  **COLOR CODING (MANDATORY):**
    -   Key Terms/Strategy Concepts: <strong style="color: #FBBF24;">Term</strong> (Gold)
    -   Bullish/Positive/Win: <span style="color: #34D399;">Bullish/Buy</span> (Green)
    -   Bearish/Negative/Risk: <span style="color: #F87171;">Bearish/Sell</span> (Red)
    -   Important/Warning: <strong>Note</strong> (White Bold)
4.  **DIRECTNESS:** Start answering immediately. Do not restate the user's question.

**STRATEGY LOGIC SOURCE:**
${context.strategy.prompt}`;

            // Create chat with history and system instruction
            const chat = ai.chats.create({
                model: "gemini-2.5-flash",
                history: historyForChat,
                config: {
                    systemInstruction: systemInstruction
                }
            });

            // Send the new message
            const response = await chat.sendMessage({
                message: lastMessageContent.parts || []
            });

            const text = response.text || "";

            onLogTokenUsage(response.usageMetadata?.totalTokenCount || 0);

            const botMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'oracle',
                text: text || "No response text generated.",
                timestamp: new Date(),
                type: 'text'
            };
            setChatHistory(prev => [...prev, botMsg]);

        } catch (error) {
            console.error("Chat error:", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                sender: 'oracle',
                text: `I'm having trouble connecting. Error: ${errorMessage}. Please check your connection.`,
                timestamp: new Date(),
                type: 'text'
            };
            setChatHistory(prev => [...prev, errorMsg]);
        } finally {
            setIsSending(false);
        }
    };

    const handleSave = () => {
        onSaveSession(context.session?.id || null, sessionTitle, chatHistory, context.goal);
        onClose();
    };

    // --- Image Upload & Capture Handlers ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                setPendingImage(dataUrl);
                setAnnotationText('');
                setIsAnnotationModalOpen(true);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = ''; // Reset input
    };

    const handleAnnotationSubmit = async () => {
        if (pendingImage) {
            const key = await storeImage(pendingImage);
            handleSendMessage(annotationText || "Here is a chart for analysis.", key);
            setIsAnnotationModalOpen(false);
            setPendingImage(null);
            setAnnotationText('');
        }
    };

    const stopMediaStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            setCaptureStream(null);
        }
    }, []);

    useEffect(() => {
        return () => stopMediaStream();
    }, [stopMediaStream]);

    const handleInitiateScreenCapture = async () => {
        setCaptureError(null);
        stopMediaStream();
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" } as any, audio: false });
            streamRef.current = stream;
            setCaptureStream(stream);
            setIsCaptureModalOpen(true);
            stream.getVideoTracks()[0].onended = () => {
                stopMediaStream();
                setIsCaptureModalOpen(false);
            };
        } catch (err) {
            console.error("Screen capture error:", err);
            setCaptureError("Could not start screen capture. Please ensure permissions are granted.");
            setIsCaptureModalOpen(true);
        }
    };

    const handleCaptureSubmit = async (dataUrl: string) => {
        const key = await storeImage(dataUrl);
        handleSendMessage("I've captured my screen for you to analyze.", key);
        setIsCaptureModalOpen(false);
        stopMediaStream();
    };

    return (
        <div className="flex flex-col h-full bg-[hsl(var(--color-bg-900))] text-gray-100 p-4 md:p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-4">
                <div>
                    <input
                        type="text"
                        value={sessionTitle}
                        onChange={(e) => setSessionTitle(e.target.value)}
                        className="bg-transparent text-xl font-bold text-yellow-400 border-none focus:ring-0 w-full"
                    />
                    <p className="text-sm text-gray-400">Goal: {context.goal === 'learn_basics' ? 'Learn Concepts' : 'Build Setup'}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleSave} className="p-2 bg-blue-600 rounded-full hover:bg-blue-500" title="Save to Mentorship Journal">
                        <SaveIcon className="w-5 h-5 text-white" />
                    </button>
                    <button onClick={onClose} className="p-2 bg-gray-700 rounded-full hover:bg-gray-600" title="Close">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-grow overflow-y-auto mb-4 space-y-4 pr-2 custom-scrollbar">
                {chatHistory.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.sender === 'oracle' ? 'bg-gray-700' : 'bg-blue-600'}`}>
                            {msg.sender === 'oracle' ? <Logo className="w-5 h-5" /> : <span className="font-bold text-xs">YOU</span>}
                        </div>
                        <div className={`max-w-[85%] p-3 rounded-lg text-sm ${msg.sender === 'oracle' ? 'bg-gray-800' : 'bg-blue-900/50'}`}>
                            {msg.imageKeys?.map(key => <IdbImageDisplay key={key} imageKey={key} onZoom={setZoomedImage} />)}
                            <div className="prose prose-sm prose-invert max-w-none leading-relaxed" dangerouslySetInnerHTML={{ __html: msg.text }} />
                        </div>
                    </div>
                ))}
                {isSending && (
                    <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center"><Logo className="w-5 h-5 animate-pulse" /></div>
                        <div className="bg-gray-800 p-3 rounded-lg text-sm text-gray-400">Thinking...</div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="flex gap-2 pt-4 border-t border-gray-700 items-center">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-yellow-400" title="Upload Image">
                    <UploadIcon className="w-6 h-6" />
                </button>
                <button onClick={handleInitiateScreenCapture} className="p-2 text-gray-400 hover:text-yellow-400" title="Screen Capture">
                    <ScreenIcon className="w-6 h-6" />
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />

                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type your message..."
                    className="flex-grow bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    disabled={isSending}
                />
                <button
                    onClick={() => handleSendMessage()}
                    disabled={isSending || !input.trim()}
                    className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Send
                </button>
            </div>

            {zoomedImage && (
                <div className="fixed inset-0 z-[150] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
                    <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-full object-contain" />
                </div>
            )}

            <ScreenCaptureModal isOpen={isCaptureModalOpen} stream={captureStream} onCapture={handleCaptureSubmit} onClose={() => { setIsCaptureModalOpen(false); stopMediaStream(); }} error={captureError} />

            {/* Annotation Modal */}
            {isAnnotationModalOpen && (
                <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4">
                    <div className="bg-gray-800 p-4 rounded-lg max-w-lg w-full flex flex-col gap-4">
                        <h3 className="text-lg font-bold text-white">Add Context to Image</h3>
                        {pendingImage && <img src={pendingImage} alt="Preview" className="max-h-64 object-contain rounded-md bg-black" />}
                        <textarea
                            value={annotationText}
                            onChange={(e) => setAnnotationText(e.target.value)}
                            placeholder="Describe what you see or ask a specific question..."
                            className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring-2 focus:ring-yellow-500"
                            rows={3}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => { setIsAnnotationModalOpen(false); setPendingImage(null); }} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-white">Cancel</button>
                            <button onClick={handleAnnotationSubmit} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-white font-bold">Send</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoachingView;
