
import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
    forwardRef,
    useImperativeHandle,
} from 'react';
import {
    GoogleGenAI,
    GenerateContentResponse,
    Part,
    Chat
} from "@google/genai";
import {
    AnalysisResults,
    StrategyKey,
    StrategyLogicData,
    UserSettings,
    UploadedImageKeys,
    UploadedImageData,
    ApiConfiguration,
    MarketDataCache,
    MarketDataCandle,
    Trade,
} from '../types';
import ClarityFeedback from './ClarityFeedback';
import Logo from './Logo';
import ScreenCaptureModal from './ScreenCaptureModal';

// --- SYSTEM PROMPTS ---

// System prompt for the new AI-driven guided chart acquisition
const generateGuidedAcquisitionSystemPrompt = (strategy: StrategyLogicData): string => {
    return `You are an AI data acquisition specialist for a trading analysis tool. Your sole purpose is to guide a user, step-by-step, to provide the necessary chart screenshots for a specific trading strategy.

**CONTEXT:**
- The user has selected the following strategy:
--- STRATEGY NAME: ${strategy.name} ---
--- CORE STRATEGY LOGIC (Your ONLY source of truth): ---
${strategy.prompt}
--- END STRATEGY ---

**YOUR PROTOCOL (Follow PRECISELY and CONCISELY):**

1.  **Your Goal:** Request charts sequentially until you have enough multi-timeframe context to satisfy the strategy's requirements. Typically, this means getting a high, medium, and low timeframe chart.
2.  **Be Specific:** Your requests MUST be clear and direct. Specify the EXACT timeframe (e.g., "Daily Chart", "15-Minute Chart") and explicitly state ANY required indicators based on the CORE STRATEGY LOGIC (e.g., "with the ADX and DMI indicators visible").
3.  **Analyze & Request:** When you receive a chart, briefly acknowledge it and then immediately make your next request. Your analysis is only for the purpose of deciding what to ask for next.
4.  **Completion Signal:** When you have gathered all necessary charts (usually 3-4 distinct timeframes), your FINAL response MUST be the exact string: \`[ANALYSIS_READY]\`. Do not say anything else.
5.  **Validation (CRITICAL):** If the user provides an incorrect chart (e.g., wrong timeframe, missing required indicators), you MUST politely reject it and re-issue your previous request with more clarity.
    - **Example Rejection:** "That appears to be the 1-Hour chart without the required RSI. I still need the **4-Hour Chart** with the **RSI indicator** visible. Please provide that one."
6.  **Keep it Brief:** Your responses should be a single, direct request. Do not add conversational fluff.`;
};


// System prompt for the final analysis
const generateSystemInstructionContent = (
    selectedStrategies: StrategyKey[],
    userSettings: UserSettings,
    uploadedImagesData: UploadedImageKeys,
    strategyLogicData: Record<StrategyKey, StrategyLogicData>,
    selectedMarketData: Record<string, any[]>,
    currentPrice: number | null,
    isComparisonMode: boolean
): string => {
    const strategyDetails = selectedStrategies.map(key => {
        const logic = strategyLogicData[key];
        if (!logic) return `// Invalid Strategy Key: ${key}`;
        return `
--- STRATEGY: ${logic.name} ---
${logic.prompt}
--- END STRATEGY ---
    `;
    }).join('\n\n');

    const imageReferencesExplanation = Object.keys(uploadedImagesData).length > 0 ?
        `The user has provided screenshots. These are your PRIMARY source for market conditions.` :
        "No screenshots were provided. Rely solely on the cached historical data.";

    const historicalDataContextPrompt = (Object.keys(selectedMarketData).length > 0) ? `
You have been provided with cached historical data for broader context. Use this data to establish a macro view.
Available Datasets:
${Object.keys(selectedMarketData).map(key => `- ${key}: ${selectedMarketData[key]?.length || 0} candles available.`).join('\n')}
` : '';

    const currentPriceAnchorPrompt = currentPrice ?
        `THE CURRENT PRICE IS \`${currentPrice.toFixed(4)}\`. This is your non-negotiable anchor point.` :
        `Your first step is to identify the 'current price' from the user's screenshots (the closing price of the most recent candle).`;

    const basePrompt = `You are The Oracle, a specialist AI that transforms user-defined trading strategies into concrete, actionable trade setups.

**PRIMARY DIRECTIVE: ALWAYS GENERATE A TRADE SETUP WITH FULL DATA**
You must ALWAYS generate a trade setup for every input, even if conditions are not fully met.
- If conditions are met: Set 'entryType' to "Limit Order".
- If conditions are NOT met: Set 'entryType' to "Confirmation Entry" and explain what needs to happen.
- **CRITICAL:** You MUST provide specific numeric values for 'entry', 'stopLoss', 'takeProfit1', and 'takeProfit2' for EVERY trade, even if it is a "Confirmation Entry".
  - For Confirmation Entries, use the key level (e.g., breakout point, support level) as the 'entry'.
  - NEVER return 'N/A', 'Pending', or empty strings for these fields.
  - NEVER return an empty trade list due to "market conditions".

**== INPUT DATA ==**
1.  **USER STRATEGY LOGIC:**\n${strategyDetails}
2.  **USER PREFERENCES:**
    - Risk Appetite: ${userSettings.riskAppetite}
    - Minimum R:R: ${userSettings.minRiskRewardRatio}:1
    - Stop Loss Logic: ${userSettings.stopLossStrategy}
3.  **MARKET DATA:**
    - **Current Price Anchor:** ${currentPriceAnchorPrompt}
    - **Cached Historical Data:** ${historicalDataContextPrompt}
    - **Chart Screenshots:** ${imageReferencesExplanation}
`;

    if (isComparisonMode) {
        return `${basePrompt}

**== ASSET COMPARISON PROTOCOL (ENABLED) ==**
The user has uploaded charts for MULTIPLE DIFFERENT ASSETS to compare them against the strategy criteria.
1.  **IDENTIFY ASSETS:** Treat each image (or set of images) as a distinct asset. Identify the asset symbol/name from the chart text if possible, or label them "Asset 1", "Asset 2", etc.
2.  **EVALUATE EACH:** Apply the strategy logic to EACH asset independently.
3.  **RANKING:** Rank the assets from best fit to worst fit based on the strategy requirements.
4.  **OUTPUT:** Your response MUST still be valid JSON.
    - Leave "Top Longs" and "Top Shorts" empty or include specific setups if they are exceptionally good.
    - **CRITICALLY:** Fill the \`assetComparisonResults\` array in the JSON output.
    
    **Output JSON Structure for Comparison:**
    {
      "Top Longs": [],
      "Top Shorts": [],
      "strategySuggestion": { ... },
      "assetComparisonResults": [
         {
            "asset": "Asset Name",
            "sentiment": "Bullish" | "Bearish" | "Neutral",
            "heat": 1-5 (integer),
            "brief": "Short explanation of why this asset ranks here."
         },
         ...
      ]
    }
`;
    }

    return `${basePrompt}

**== EXECUTION PROTOCOL (NON-NEGOTIABLE) ==**

1.  **MANDATORY PRE-FLIGHT INDICATOR CHECK:**
    - Analyze the STRATEGY LOGIC for required indicators (e.g., ADX, RSI).
    - If indicators are missing, DO NOT ABORT. Instead, proceed with price action analysis but lower the 'heat' score and mention the missing confirmation in the explanation.

2.  **MANDATORY DATA COMPLETENESS:**
    - **Symbol:** Identify the asset symbol (e.g., "EURUSD", "BTCUSDT"). If strictly invisible, use "Unknown Asset".
    - **Entry/Exit Prices:** MUST be valid numeric strings. Do not use ranges (e.g., "1.05-1.06"). Pick a specific level.
    - **Consistency:** Ensure the values in the JSON match the values mentioned in your explanation text.

3.  **APPLY LOGIC & JUSTIFY:**
    - For EACH trade, you MUST write an 'explanation' that quotes specific strategy rules and connects them to chart evidence.
    - **FORMATTING:** Your 'reasoning' and 'explanation' fields MUST use HTML for readability:
      - Use <ul> and <li> for lists.
      - Use <strong> for key terms (e.g., <strong>Market Structure:</strong>).
      - Use <span class="bullish">Bullish</span> and <span class="bearish">Bearish</span> for sentiment.
      - Keep it clean, structured, and "directed" (like a military briefing). Avoid conversational fluff.

4.  **HEAT MAP (CONFIDENCE):**
    - Assign a 'heat' score (1-5) to every trade.
    - 5 = Perfect setup, all conditions met.
    - 1 = Weak setup, waiting for major confirmation.

**== OUTPUT FORMAT (NON-NEGOTIABLE) ==**
Your response MUST be a single, valid JSON object.
{
  "Top Longs": [/* Array of Trade objects with 'heat' property */],
  "Top Shorts": [/* Array of Trade objects with 'heat' property */],
  "strategySuggestion": {
    "suggestedStrategies": [],
    "suggestedSettings": {},
    "reasoning": "Mandatory explanation string using HTML formatting."
  }
}
`;
};

type Phase = 'idle' | 'gathering' | 'validating' | 'ready' | 'analyzing';

export interface ImageUploaderHandles {
    triggerAnalysis: (useRealTimeContext: boolean) => void;
}

interface ImageUploaderProps {
    onAnalysisComplete: (results: AnalysisResults, strategies: StrategyKey[], images: UploadedImageKeys, useRealTimeContext: boolean, tokenCount: number) => void;
    selectedStrategies: StrategyKey[];
    userSettings: UserSettings;
    initialImages?: UploadedImageKeys | null;
    strategyLogicData: Record<StrategyKey, StrategyLogicData>;
    isAnalyzing: boolean;
    setIsAnalyzing: (isAnalyzing: boolean) => void;
    onPhaseChange: (phase: Phase) => void;
    apiConfig: ApiConfiguration;
    onLogTokenUsage: (tokens: number) => void;
    marketDataCache: MarketDataCache;
    dashboardSelectedMarketData: string[];
    isComparisonMode: boolean;
}

const ImageUploader = forwardRef<ImageUploaderHandles, ImageUploaderProps>(({
    onAnalysisComplete,
    selectedStrategies,
    userSettings,
    initialImages,
    strategyLogicData,
    isAnalyzing,
    setIsAnalyzing,
    onPhaseChange,
    apiConfig,
    onLogTokenUsage,
    marketDataCache,
    dashboardSelectedMarketData,
    isComparisonMode,
}, ref) => {

    const [phase, setPhase] = useState<Phase>('idle');
    const [conversation, setConversation] = useState<{ sender: 'ai' | 'user', text?: string, image?: string }[]>([]);
    const [uploadedImagesData, setUploadedImagesData] = useState<UploadedImageKeys>({});
    const [error, setError] = useState<string | null>(null);

    // Screen Capture State
    const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
    const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
    const [captureError, setCaptureError] = useState<string | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatSessionRef = useRef<Chat | null>(null);

    const getAiClient = useCallback(() => {
        const apiKey = apiConfig.geminiApiKey || import.meta.env.VITE_API_KEY;
        if (!apiKey) {
            return null;
        }
        return new GoogleGenAI({ apiKey });
    }, [apiConfig.geminiApiKey]);

    useEffect(() => {
        onPhaseChange(phase);
    }, [phase, onPhaseChange]);

    const resetState = useCallback(() => {
        setPhase('idle');
        setConversation([]);
        setUploadedImagesData({});
        setError(null);
        chatSessionRef.current = null;
    }, []);

    useEffect(() => {
        if (phase !== 'idle') return;
        if (initialImages && Object.keys(initialImages).length > 0) {
            setUploadedImagesData(initialImages);
            setPhase('ready');
        } else {
            resetState();
        }
    }, [initialImages, phase, resetState]);


    const handleStartGuidedUpload = async () => {
        if (selectedStrategies.length === 0) return;
        const primaryStrategyKey = selectedStrategies[0];
        const primaryStrategy = strategyLogicData[primaryStrategyKey];
        if (!primaryStrategy) {
            setError("Could not find the logic for the selected strategy.");
            return;
        }

        resetState();
        setIsAnalyzing(true);
        setPhase('validating');

        const ai = getAiClient();
        if (!ai) {
            setError("API Key not configured.");
            setIsAnalyzing(false);
            return;
        }

        try {
            const systemInstruction = generateGuidedAcquisitionSystemPrompt(primaryStrategy);
            chatSessionRef.current = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: { systemInstruction },
            });

            const response = await chatSessionRef.current.sendMessage({ message: "Start." });
            onLogTokenUsage(response.usageMetadata?.totalTokenCount || 0);

            setConversation([{ sender: 'ai', text: response.text || "" }]);
            setPhase('gathering');
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred.";
            setError(`Failed to start guided session: ${errorMessage}`);
            resetState();
        } finally {
            setIsAnalyzing(false);
        }
    };


    const handleImageUpload = useCallback(async (imageData: UploadedImageData) => {
        // If in simple mode (no guided chat yet), add the image to list and render it
        if (!chatSessionRef.current) {
            setUploadedImagesData(prev => ({ ...prev, [Object.keys(prev).length]: imageData.dataUrl }));
            setConversation(prev => [...prev, { sender: 'user', image: imageData.dataUrl }]); // CRITICAL FIX: Add to conversation so it shows in UI
            setPhase('ready');
            return;
        }

        if (phase !== 'gathering' || isAnalyzing) return;

        setConversation(prev => [...prev, { sender: 'user', image: imageData.dataUrl }]);
        setPhase('validating');

        const prefixMatch = imageData.dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,/);
        if (!prefixMatch) {
            setConversation(prev => [...prev, { sender: 'ai', text: "Invalid image format. Please try again." }]);
            setPhase('gathering');
            return;
        }

        const mimeType = prefixMatch[1];
        const data = imageData.dataUrl.substring(prefixMatch[0].length);
        const imagePart: Part = { inlineData: { mimeType, data } };

        try {
            const response = await chatSessionRef.current.sendMessage({ message: [imagePart] });
            onLogTokenUsage(response.usageMetadata?.totalTokenCount || 0);
            const responseText = (response.text || "").trim();

            if (responseText === '[ANALYSIS_READY]') {
                setUploadedImagesData(prev => ({ ...prev, [Object.keys(prev).length]: imageData.dataUrl }));
                setConversation(prev => [...prev, { sender: 'ai', text: "All charts have been provided. The 'Analyze' button is now enabled." }]);
                setPhase('ready');
            } else {
                setUploadedImagesData(prev => ({ ...prev, [Object.keys(prev).length]: imageData.dataUrl }));
                setConversation(prev => [...prev, { sender: 'ai', text: responseText }]);
                setPhase('gathering');
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred communicating with the AI.";
            setConversation(prev => [...prev, { sender: 'ai', text: `An error occurred: ${errorMessage}. Please try uploading the image again.` }]);
            setPhase('gathering');
        }
    }, [phase, isAnalyzing, onLogTokenUsage]);


    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = event.target?.result;
                if (typeof result === 'string') {
                    handleImageUpload({
                        name: file.name,
                        type: file.type,
                        dataUrl: result
                    });
                }
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    // Screen Share Logic
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

    const handleCaptureSubmit = (dataUrl: string) => {
        handleImageUpload({
            name: `screen_capture_${Date.now()}.jpg`,
            type: 'image/jpeg',
            dataUrl: dataUrl
        });
        setIsCaptureModalOpen(false);
        stopMediaStream();
    };

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            // Enable paste if in gathering phase OR if in idle phase (to start)
            if (phase !== 'gathering' && phase !== 'idle' && phase !== 'ready') return;

            const items = event.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        event.preventDefault();
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const result = e.target?.result;
                            if (typeof result === 'string') {
                                handleImageUpload({
                                    name: `pasted_image_${Date.now()}.png`,
                                    type: file.type,
                                    dataUrl: result
                                });
                            }
                        };
                        reader.readAsDataURL(file);
                        return;
                    }
                }
            }
        };
        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [phase, handleImageUpload]);

    const triggerAnalysis = async (useRealTimeContext: boolean) => {
        setIsAnalyzing(true);
        setError(null);

        if (Object.keys(uploadedImagesData).length === 0 && dashboardSelectedMarketData.length === 0) {
            setError("No context provided. Please complete the guided chart upload or select cached market data to run an analysis.");
            setIsAnalyzing(false);
            return;
        }

        const ai = getAiClient();
        if (!ai) {
            setError("API Key not configured. Please set it in Master Controls.");
            setIsAnalyzing(false);
            return;
        }

        let currentPrice: number | null = null;
        let latestTimestamp = 0;

        const selectedMarketData = dashboardSelectedMarketData.reduce((acc, key) => {
            if (marketDataCache[key]) acc[key] = marketDataCache[key];
            return acc;
        }, {} as Record<string, MarketDataCandle[]>);

        if (Object.keys(selectedMarketData).length > 0) {
            Object.values(selectedMarketData).forEach(candlesUntyped => {
                const candles = candlesUntyped as MarketDataCandle[];
                if (candles && candles.length > 0) {
                    const sortedCandles = [...candles].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    const lastCandle = sortedCandles[sortedCandles.length - 1];
                    const candleTimestamp = new Date(lastCandle.date).getTime();
                    if (candleTimestamp > latestTimestamp) {
                        latestTimestamp = candleTimestamp;
                        currentPrice = lastCandle.close;
                    }
                }
            });
        }


        try {
            const systemInstruction = generateSystemInstructionContent(
                selectedStrategies, userSettings, uploadedImagesData, strategyLogicData,
                selectedMarketData, currentPrice, isComparisonMode
            );

            const imageParts: Part[] = [];
            const sortedImageKeys = Object.keys(uploadedImagesData).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

            for (const key of sortedImageKeys) {
                const dataUrl = uploadedImagesData[key as any];
                if (dataUrl) {
                    const prefixMatch = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,/);
                    if (prefixMatch) {
                        const mimeType = prefixMatch[1];
                        const data = dataUrl.substring(prefixMatch[0].length);
                        imageParts.push({ inlineData: { mimeType, data } });
                    }
                }
            }

            const requestContents = imageParts.length > 0
                ? { parts: imageParts }
                : "Analyze the provided cached historical data based on the system instructions.";

            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: requestContents,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: 'application/json'
                }
            });

            const totalTokenCount = response.usageMetadata?.totalTokenCount || 0;
            onLogTokenUsage(totalTokenCount);

            let jsonText = (response.text || "").trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonText.match(fenceRegex);
            if (match && match[2]) jsonText = match[2].trim();

            const results: AnalysisResults = JSON.parse(jsonText);

            // Ensure every trade has an entry price. If missing, use the current price (if known) or a placeholder.
            const fillMissingEntry = (trades: Trade[]) =>
                trades.map(trade => ({
                    ...trade,
                    entry: trade.entry && trade.entry.trim() ? trade.entry : (currentPrice !== null ? currentPrice.toFixed(4) : 'N/A')
                }));

            results['Top Longs'] = fillMissingEntry(results['Top Longs'] ?? []);
            results['Top Shorts'] = fillMissingEntry(results['Top Shorts'] ?? []);

            onAnalysisComplete(results, selectedStrategies, uploadedImagesData, useRealTimeContext, totalTokenCount);

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during analysis.";
            setError(`AI Analysis Failed: ${errorMessage}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    useImperativeHandle(ref, () => ({
        triggerAnalysis,
    }));

    return (
        <div className="bg-gray-800/70 p-4 rounded-lg border border-gray-700">
            {/* Simplified Interaction for Direct Upload */}
            {phase === 'idle' && (
                <div>
                    <h4 className="font-bold text-gray-200">Provide Market Context</h4>
                    <p className="text-sm text-gray-400 mb-4">Upload screenshots of your charts for analysis.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="text-sm font-semibold p-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                            Upload Image
                        </button>
                        <button className="text-sm font-semibold p-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors" title="Paste from Clipboard">
                            Paste Image
                        </button>
                        <button onClick={handleInitiateScreenCapture} className="text-sm font-semibold p-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                            Share Screen
                        </button>
                    </div>

                    {/* Guided Option Link */}
                    <button onClick={handleStartGuidedUpload} disabled={selectedStrategies.length === 0 || isAnalyzing} className="mt-4 text-xs text-yellow-500 hover:underline disabled:text-gray-600">
                        {isAnalyzing ? "Initializing..." : "Or start Guided Acquisition Assistant"}
                    </button>
                </div>
            )}

            {/* Chat Interface for Guided Mode OR Result Display */}
            {phase !== 'idle' && (
                <>
                    <div className="space-y-3 min-h-[100px] max-h-[300px] overflow-y-auto pr-2">
                        {conversation.map((msg, index) => (
                            <div key={index} className={`flex items-start gap-2 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                                {msg.sender === 'ai' && <Logo className="w-8 h-8 flex-shrink-0" />}
                                <div className={`p-3 rounded-lg max-w-sm ${msg.sender === 'ai' ? 'bg-gray-700' : 'bg-yellow-500/10'}`}>
                                    {msg.image && <img src={msg.image} alt="uploaded chart" className="rounded-md mb-2 max-h-40" />}
                                    {msg.text && <p className="text-sm" dangerouslySetInnerHTML={{ __html: msg.text }}></p>}
                                </div>
                            </div>
                        ))}
                        {(isAnalyzing || phase === 'validating') && (
                            <div className="flex items-start gap-2">
                                <Logo className="w-8 h-8 flex-shrink-0" isLoading={true} />
                                <div className="p-3 rounded-lg bg-gray-700 animate-pulse">
                                    <p className="text-sm">Oracle is thinking...</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 p-3 bg-gray-900/50 border-t border-gray-700">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button onClick={() => fileInputRef.current?.click()} className="text-xs font-semibold p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white">Upload</button>
                            <button className="text-xs font-semibold p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white" title="Press Ctrl+V">Paste</button>
                            <button onClick={handleInitiateScreenCapture} className="text-xs font-semibold p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white">Screen Share</button>
                        </div>
                    </div>
                </>
            )}

            {error && (
                <div className="mt-4">
                    <ClarityFeedback message={error} onDismiss={() => setError(null)} />
                </div>
            )}

            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
            <ScreenCaptureModal isOpen={isCaptureModalOpen} stream={captureStream} onCapture={handleCaptureSubmit} onClose={() => { setIsCaptureModalOpen(false); stopMediaStream(); }} error={captureError} />
        </div>
    );
});

export default ImageUploader;
