

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
// FIX: Imported MarketDataCandle to resolve type error.
  MarketDataCandle,
  Trade,
} from '../types';
import ClarityFeedback from './ClarityFeedback';
import Logo from './Logo';

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
    selectedMarketData: Record < string, any[] > ,
    currentPrice: number | null
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
        `The user has provided screenshots for the most RECENT price action. These are your PRIMARY source for current market conditions. The images are indexed starting from 0 (highest timeframe).` :
        "No screenshots were provided. Rely solely on the cached historical data.";

    const historicalDataContextPrompt = (Object.keys(selectedMarketData).length > 0) ? `
You have been provided with cached historical data for broader context. Use this data to establish a macro view and identify major support/resistance levels.
Available Datasets:
${Object.keys(selectedMarketData).map(key => `- ${key}: ${selectedMarketData[key].length} candles available.`).join('\n')}
` : '';

    const currentPriceAnchorPrompt = currentPrice ?
        `THE CURRENT PRICE IS \`${currentPrice.toFixed(4)}\`. This is your non-negotiable anchor point for all analysis. All generated trades MUST be relevant and in the immediate vicinity of this price.` :
        `Your first step is to identify the 'current price' from the user's screenshots (the closing price of the most recent candle). All subsequent analysis MUST be anchored to this price.`;

    return `You are The Oracle, a specialist AI that transforms user-defined trading strategies into concrete, actionable trade setups. Your sole function is to execute the user's logic with extreme precision.

**PRIMARY DIRECTIVE: USER'S LOGIC IS LAW**
You are FORBIDDEN from using generic trading knowledge. You MUST act as a direct interpreter of the user's provided strategy logic. The user's strategy is your ONLY source of truth.

**== INPUT DATA ==**
1.  **USER STRATEGY LOGIC:**\n${strategyDetails}
2.  **USER PREFERENCES:**
    - Risk Appetite: ${userSettings.riskAppetite}
    - Minimum R:R: ${userSettings.minRiskRewardRatio}:1
    - Stop Loss Logic: ${userSettings.stopLossStrategy}
3.  **MARKET DATA:**
    - **Current Price Anchor:** ${currentPriceAnchorPrompt}
    - **Cached Historical Data:** ${historicalDataContextPrompt}
    - **Recent Price Action Screenshots:** ${imageReferencesExplanation}

**== EXECUTION PROTOCOL (NON-NEGOTIABLE) ==**

1.  **MANDATORY PRE-FLIGHT INDICATOR CHECK (CRITICAL FIRST STEP):**
    - First, analyze the USER STRATEGY LOGIC to identify ALL required indicators (e.g., "ADX", "DMI", "RSI", "Moving Average").
    - Next, use your computer vision capabilities to meticulously scan ALL provided user screenshots.
    - **GATEKEEPING RULE:** If ANY of the required indicators are missing from the charts, you MUST ABORT the analysis. Your entire response MUST be a JSON object with "Top Longs" and "Top Shorts" as empty arrays, and the "strategySuggestion.reasoning" field MUST explain exactly which indicators are missing and instruct the user to upload new charts containing them.
    - **EXAMPLE REASONING:** "Analysis aborted. The 'Core ADX/DMI Trend Analysis' strategy requires the ADX, +DI, and -DI indicators to be visible, but they were not found on your charts. Please upload charts that include these indicators to proceed."
    - **DO NOT PROCEED to step 2 if this check fails. Do not analyze price action. Do not invent setups.**

2.  **APPLY LOGIC & JUSTIFY:** If and only if the indicator check passes, proceed. For EACH trade you generate, you MUST write an 'explanation' that:
    - Explicitly quotes or paraphrases a specific rule from the USER STRATEGY LOGIC.
    - Connects that rule to specific evidence on the chart (e.g., price levels, candle patterns).
    - **EXAMPLE:** "Entry is based on the 'Bullish Order Block' rule from your strategy; the price has returned to the last down-candle at \`<strong style='color: #FBBF24;'>112000</strong>\` before the break of structure, as required."

3.  **PROXIMITY GATEKEEPER:** Every generated trade's entry price MUST be within a reasonable distance of the current price anchor. Discard any trades that are far from the current price.

**== OUTPUT FORMAT (NON-NEGOTIABLE) ==**
Your response MUST be a single, valid JSON object. Adhere strictly to this structure:
{
  "Top Longs": [/* Array of Trade objects or empty */],
  "Top Shorts": [/* Array of Trade objects or empty */],
  "strategySuggestion": {
    "suggestedStrategies": [/* Array of strategy key strings or empty */],
    "suggestedSettings": { /* A UserSettings object or empty object {} */ },
    "reasoning": "A string explanation. THIS IS A MANDATORY FIELD."
  }
}

- **CRITICAL:** The \`strategySuggestion\` object and its \`reasoning\` field are mandatory. If no trades are found, use the \`reasoning\` field to explain why (e.g., "Market is consolidating, no clear setups..."). If you abort due to the Pre-Flight Indicator Check, state the reason here.
- **'heat':** Every trade MUST have a 'heat' score (integer 1-5).
- **'explanation':** Every trade MUST have a detailed 'explanation' quoting strategy rules. Format key concepts with styled \`<strong>\` tags (e.g., \`<strong style='color: #60A5FA;'>break of structure</strong>\`).
`;
};

type Phase = 'idle' | 'gathering' | 'validating' | 'ready' | 'analyzing';

export interface ImageUploaderHandles {
  triggerAnalysis: (useRealTimeContext: boolean) => void;
}

interface ImageUploaderProps {
  onAnalysisComplete: (results: AnalysisResults, strategies: StrategyKey[], images: UploadedImageKeys, useRealTimeContext: boolean) => void;
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
}, ref) => {
    
    const [phase, setPhase] = useState<Phase>('idle');
    const [conversation, setConversation] = useState<{sender: 'ai' | 'user', text?: string, image?: string}[]>([]);
    const [uploadedImagesData, setUploadedImagesData] = useState<UploadedImageKeys>({});
    const [error, setError] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatSessionRef = useRef<Chat | null>(null);

    const getAiClient = useCallback(() => {
        if (!apiConfig.geminiApiKey) {
            return null;
        }
        return new GoogleGenAI({ apiKey: apiConfig.geminiApiKey });
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
        setPhase('validating'); // Show loading state immediately

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
            
            setConversation([{ sender: 'ai', text: response.text }]);
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
        if (phase !== 'gathering' || isAnalyzing || !chatSessionRef.current) return;

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
            const responseText = response.text.trim();

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
    // FIX: Removed conversation and uploadedImagesData from dependency array to avoid re-creating the function on every state change.
    }, [phase, isAnalyzing, onLogTokenUsage]);
    

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                handleImageUpload({
                    name: file.name,
                    type: file.type,
                    dataUrl: event.target?.result as string
                });
            };
            reader.readAsDataURL(file);
        }
        e.target.value = ''; // Allow re-selecting the same file
    };

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (phase !== 'gathering') return;
            const items = event.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        event.preventDefault();
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            handleImageUpload({
                                name: `pasted_image_${Date.now()}.png`,
                                type: file.type,
                                dataUrl: e.target?.result as string
                            });
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

        // FIX: Correctly typed the initial value of the reduce function to prevent type errors.
        const selectedMarketData = dashboardSelectedMarketData.reduce((acc, key) => {
            if (marketDataCache[key]) acc[key] = marketDataCache[key];
            return acc;
        }, {} as Record < string, MarketDataCandle[] > );

        if (Object.keys(selectedMarketData).length > 0) {
            Object.values(selectedMarketData).forEach(candlesUntyped => {
                // FIX: Add type assertion for candles.
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
                selectedMarketData, currentPrice
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
            
            // FIX: Corrected the `contents` property to pass a single Content object for multi-modal requests, as this is the expected format.
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
            
            let jsonText = response.text.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonText.match(fenceRegex);
            if (match && match[2]) jsonText = match[2].trim();

            const results: AnalysisResults = JSON.parse(jsonText);

            onAnalysisComplete(results, selectedStrategies, uploadedImagesData, useRealTimeContext);

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
             {phase === 'idle' && (
                <div>
                    <h4 className="font-bold text-gray-200">Provide Screenshots for Recent Price Action</h4>
                    <p className="text-sm text-gray-400 mb-2">Upload screenshots to give the AI the most current view of the market, which supplements the cached historical data.</p>
                     <div className="mt-4">
                        <button onClick={handleStartGuidedUpload} disabled={selectedStrategies.length === 0 || isAnalyzing} className="w-full font-bold py-2 px-4 rounded-lg transition-colors bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-600 disabled:cursor-not-allowed">
                            {isAnalyzing ? "Initializing..." : "Start Guided Chart Upload"}
                        </button>
                    </div>
                </div>
            )}

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

                    {phase === 'gathering' && (
                        <div className="mt-4 p-3 bg-yellow-900/20 border-l-4 border-yellow-500">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button onClick={() => fileInputRef.current?.click()} className="text-sm font-semibold p-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white">Upload Image</button>
                                <button className="text-sm font-semibold p-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white" title="Press Ctrl+V or Cmd+V to paste an image">Paste Image</button>
                            </div>
                        </div>
                    )}
                </>
            )}
            
            {error && (
                <div className="mt-4">
                     <ClarityFeedback message={error} onDismiss={() => setError(null)} />
                </div>
            )}
            
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
        </div>
    );
});

export default ImageUploader;