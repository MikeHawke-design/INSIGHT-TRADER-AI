
import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
    forwardRef,
    useImperativeHandle,
} from 'react';
import { Part } from "@google/genai";
import {
    AnalysisResults,
    StrategyKey,
    StrategyLogicData,
    UserSettings,
    UploadedImageKeys,
    UploadedImageData,
    ApiConfiguration,
    Trade,
} from '../types';
import ClarityFeedback from './ClarityFeedback';
import Logo from './Logo';
import ScreenCaptureModal from './ScreenCaptureModal';
import { AiManager } from '../utils/aiManager';

import { TwelveDataApi } from '../utils/twelveDataApi';
import { FreeCryptoApi } from '../utils/freeCryptoApi';
import { getMarketData, setMarketData } from '../idb';

// --- SYSTEM PROMPTS ---

// System prompt for the new AI-driven guided chart acquisition
// System prompt for the new AI-driven guided chart acquisition
const generateGuidedAcquisitionSystemPrompt = (strategies: StrategyLogicData[]): string => {
    const strategiesText = strategies.map(s => `
--- STRATEGY NAME: ${s.name} ---
--- CORE STRATEGY LOGIC: ---
${s.prompt}
--- END STRATEGY ---`).join('\n\n');

    return `You are an AI data acquisition specialist for a trading analysis tool. Your sole purpose is to guide a user, step-by-step, to provide the necessary chart screenshots for a COMBINED analysis of the following strategies.

**CONTEXT:**
- The user has selected the following strategies:
${strategiesText}

**YOUR PROTOCOL (Follow PRECISELY and CONCISELY):**

1.  **Your Goal:** Request charts sequentially until you have enough multi-timeframe context to satisfy the requirements of ALL selected strategies. Typically, this means getting a high, medium, and low timeframe chart that serves the confluence of these strategies.
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
    - **Chart Screenshots:** ${imageReferencesExplanation}
`;

    if (isComparisonMode) {
        return `${basePrompt}

**== STRICT STRATEGY ADHERENCE (CRITICAL) ==**
You are a disciplined Risk Manager. Your job is to strictly audit potential trades against the user's strategy.
- **DO NOT HALLUCINATE SETUPS:** If the chart does not show the specific conditions required by the strategy, do NOT invent them.
- **STRICT RULE FOLLOWING:** If the strategy requires a "Break of Structure" and there is none, the trade is INVALID (Heat 1).
- **NO "CLOSE ENOUGH":** A setup must meet the core criteria. If it's a "maybe", mark it as a "Confirmation Entry" with low heat (1-2).
- **EXPLAIN YOUR REASONING:** In the 'explanation' field, explicitly state WHICH rule was met and WHICH was missed.

**== ASSET COMPARISON PROTOCOL (ENABLED) ==**
The user has uploaded charts for MULTIPLE DIFFERENT ASSETS to compare them against the strategy criteria.
**YOUR GOAL:** Analyze the STRENGTH and POTENTIAL of a setup for EACH asset. Do NOT generate specific trade execution details (Entry/SL/TP).

1.  **IDENTIFY ASSETS:** Treat each image (or set of images) as a distinct asset. Identify the asset symbol/name.
2.  **EVALUATE EACH:** Apply the strategy logic to EACH asset independently.
3.  **RANKING:** Rank the assets from best fit to worst fit based on the strategy requirements.
4.  **OUTPUT:** Your response MUST be valid JSON.
    - **CRITICAL:** \`Top Longs\` and \`Top Shorts\` MUST BE EMPTY ARRAYS \`[]\`. Do not generate trades here.
    - **CRITICAL:** You MUST populate the \`assetComparisonResults\` array with an entry for EVERY analyzed asset.
    
    **Output JSON Structure for Comparison:**
    {
      "Top Longs": [],
      "Top Shorts": [],
      "strategySuggestion": { ... },
      "assetComparisonResults": [
         {
            "asset": "Asset Name (e.g., BTC/USD)",
            "sentiment": "Bullish" | "Bearish" | "Neutral",
            "heat": 1-5 (integer, 5 = Ready/Perfect, 1 = Bad/Wait),
            "brief": "Detailed explanation of the analysis. Why is it good? What are we waiting for? Use ||| to separate sections if needed, but keep it readable."
         },
         ...
      ]
    }
`;
    }

    return `${basePrompt}

**CRITICAL: STOP LOSS PLACEMENT PROTOCOL (${userSettings.stopLossStrategy || 'Standard'})**
${userSettings.stopLossStrategy === 'Structure-Buffered'
            ? `- **MANDATORY:** You MUST place the Stop Loss BEYOND a key market structure level (Swing High for Short, Swing Low for Long).
- **BUFFER:** You MUST add a buffer to this level (e.g., ATR or fixed % distance) to avoid liquidity sweeps.
- **INVALIDATION:** If the price hits this level, the trade thesis is proven wrong. Do not place SL arbitrarily.`
            : `- Place the Stop Loss according to the strategy's standard rules.
- Ensure it is logical, protects the trade from normal volatility, and is not placed at a random level.`}

**PRIORITY HIERARCHY:**
1. **STOP LOSS:** This is the MOST IMPORTANT part of the setup. Determine this FIRST based on structure/invalidation.
2. **ENTRY:** Determined secondary to the SL to ensure a valid Risk/Reward ratio.
3. **TAKE PROFIT:** Tertiary targets based on R:R and opposing structure.

**== EXECUTION PROTOCOL (NON-NEGOTIABLE) ==**

**== STRICT STRATEGY ADHERENCE (CRITICAL) ==**
You are a disciplined Risk Manager. Your job is to strictly audit potential trades against the user's strategy.
- **DO NOT HALLUCINATE SETUPS:** If the chart does not show the specific conditions required by the strategy, do NOT invent them.
- **STRICT RULE FOLLOWING:** If the strategy requires a "Break of Structure" and there is none, the trade is INVALID (Heat 1).
- **NO "CLOSE ENOUGH":** A setup must meet the core criteria. If it's a "maybe", mark it as a "Confirmation Entry" with low heat (1-2).
- **EXPLAIN YOUR REASONING:** In the 'explanation' field, explicitly state WHICH rule was met and WHICH was missed.

1.  **MANDATORY PRE-FLIGHT INDICATOR CHECK:**
    - Analyze the STRATEGY LOGIC for required indicators (e.g., ADX, RSI).
    - If indicators are missing, DO NOT ABORT. Instead, proceed with price action analysis but lower the 'heat' score and mention the missing confirmation in the explanation.

2.  **MANDATORY DATA COMPLETENESS (CRITICAL):**
    - **Symbol Extraction:** You MUST identify the asset symbol (e.g., "BTC/USD", "EUR/USD", "NVDA").
        - **LOOK EVERYWHERE:** Check top-left, top-right, watermarks in the background, and axis labels.
        - **PRICE HEURISTIC:** If the symbol is not explicitly clear, USE THE PRICE to guess. (e.g., Price ~90,000 = BTC; Price ~3,000 = ETH; Price ~1.05 = EUR/USD).
        - **DO NOT RETURN "ASSET" or "UNKNOWN":** Make your best educated guess based on the visual evidence.
    - **Timeframe Extraction:** You MUST identify the chart timeframe (e.g., "15m", "4H", "Daily"). Look next to the symbol.
    - **Entry/Exit Prices:** MUST be valid numeric strings. Do not use ranges (e.g., "1.05-1.06"). Pick a specific level.
    - **Take Profit 2 (TP2):** MANDATORY. You MUST provide a second take profit level. If the strategy doesn't specify one, calculate it as a logical extension (e.g., 2R or next resistance).
    - **Consistency:** Ensure the values in the JSON match the values mentioned in your explanation text.

3.  **APPLY LOGIC & JUSTIFY:**
    - For EACH trade, you MUST write an 'explanation' string that is strictly segmented into three parts using the delimiter "|||".
    - **Format:** "Strategy Match: [Why it fits] ||| Evidence: [Chart observations] ||| Execution & Risk: [Plan]"
    - **CRITICAL:** Do NOT use HTML tags in the explanation. Use plain text. The UI will handle formatting.
    - Keep it concise, professional, and direct. No fluff.

4.  **HEAT MAP (CONFIDENCE):**
    - Assign a 'heat' score (1-5) to every trade.
    - 5 = Perfect setup, all conditions met.
    - 1 = Weak setup, waiting for major confirmation.

5.  **MANDATORY CHART METADATA IDENTIFICATION:**
    - For each uploaded image, identify its timeframe (e.g., "Daily", "4H", "15m") and any other relevant labels (e.g., "BTCUSD"). Populate the \`chartMetadata\` field in the JSON output with this information, mapping the image index to its detected label.

6.  **DATA SYNERGY EXPLANATION (MANDATORY):**
    - For EACH trade, you MUST populate the \`dataSynergy\` field.
    - **Goal:** Explain specifically how the live numeric data (price, volume, indicators) confirmed or contradicted the visual patterns in the chart.
    - **Format:** "Live Data Confirmation: [Specific data point e.g., 'RSI at 65'] confirms [Visual pattern e.g., 'Bullish Divergence']. Volume [value] supports the move."
    - This is your "behind the curtain" explanation to the user.

**== OUTPUT FORMAT (NON-NEGOTIABLE) ==**
Your response MUST be a single, valid JSON object.
{
  "Top Longs": [/* Array of Trade objects with 'heat' property */],
  "Top Shorts": [/* Array of Trade objects with 'heat' property */],
  "strategySuggestion": {
    "suggestedStrategies": [],
    "suggestedSettings": {},
    "reasoning": "Mandatory explanation string using HTML formatting."
  },
  "chartMetadata": {
    "0": "Detected Label for Image 0 (e.g., '4H Chart')",
    "1": "Detected Label for Image 1 (e.g., '15m Chart')"
  }
}
`;
};

type Phase = 'idle' | 'gathering' | 'validating' | 'ready' | 'analyzing';

export interface ImageUploaderHandles {
    triggerAnalysis: (useRealTimeContext: boolean) => void;
    resetState: () => void;
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
    isComparisonMode,
}, ref) => {

    const [phase, setPhase] = useState<Phase>('idle');
    const [conversation, setConversation] = useState<{ sender: 'ai' | 'user', text?: string, image?: string }[]>([]);
    const [uploadedImagesData, setUploadedImagesData] = useState<UploadedImageKeys>({});
    const [error, setError] = useState<string | null>(null);

    const [useLiveData, setUseLiveData] = useState<boolean>(false);
    const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(['1d', '4h', '15m']); // Multi-timeframe selection
    const [selectedProvider, setSelectedProvider] = useState<'twelvedata' | 'freecrypto'>('twelvedata');
    const [progressMessage, setProgressMessage] = useState<string>('');

    // Screen Capture State
    const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
    const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
    const [captureError, setCaptureError] = useState<string | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    // 3. Remove chatSessionRef usage for API calls.
    // const chatSessionRef = useRef<Chat | null>(null);

    // 2. Replace getAiClient with getAiManager.
    const getAiManager = useCallback(() => {
        let provider: 'gemini' | 'openai' | 'groq' | 'council';

        if (userSettings.aiSystemMode === 'council') {
            provider = 'council';
        } else if (userSettings.aiSystemMode === 'hybrid') {
            provider = userSettings.aiProviderAnalysis;
        } else {
            provider = userSettings.aiProvider;
        }

        return new AiManager({
            apiConfig,
            preferredProvider: provider
        });
    }, [apiConfig, userSettings.aiProvider, userSettings.aiProviderAnalysis, userSettings.aiSystemMode]);

    // 4. Implement 'callAiChat' helper to construct history and call aiManager.generateChat.
    const callAiChat = useCallback(async (newMessage: string | Part[], systemInstruction: string) => {
        const manager = getAiManager();

        // Construct history from conversation state
        const history = conversation.map(msg => {
            let content: string | Part[] = msg.text || '';

            // If message has images, we need to resolve them
            // Note: The local conversation state stores 'image' as a data URL string directly in the message for the user's last upload.
            // But for history, we might need to look up uploadedImagesData if we were storing keys.
            // However, the current logic in handleImageUpload stores the image in conversation as 'image: dataUrl'.
            // So we can use that directly.

            if (msg.image) {
                const parts: Part[] = [];
                if (msg.text) parts.push({ text: msg.text });

                const dataUrl = msg.image;
                const prefixMatch = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,/);
                if (prefixMatch) {
                    const mimeType = prefixMatch[1];
                    const data = dataUrl.substring(prefixMatch[0].length);
                    parts.push({
                        inlineData: {
                            mimeType: mimeType,
                            data: data
                        }
                    });
                }
                content = parts;
            }

            return {
                role: msg.sender === 'ai' ? 'assistant' as const : 'user' as const,
                content: content
            };
        });

        return await manager.generateChat(systemInstruction, history, newMessage);
    }, [getAiManager, conversation]);


    useEffect(() => {
        onPhaseChange(phase);
    }, [phase, onPhaseChange]);

    const resetState = useCallback(() => {
        setPhase('idle');
        setConversation([]);
        setUploadedImagesData({});
        setUploadedImagesData({});
        setError(null);
        setProgressMessage('');
    }, []);

    useEffect(() => {
        if (initialImages && Object.keys(initialImages).length > 0) {
            setUploadedImagesData(initialImages);
            if (phase === 'idle') setPhase('ready');
        } else if (initialImages === null && phase === 'idle') {
            // Explicitly reset if initialImages is null and we are idle (e.g. new analysis)
            setUploadedImagesData({});
            setConversation([]);
        }
        // Initialize provider from settings
        if (userSettings.defaultDataProvider) {
            setSelectedProvider(userSettings.defaultDataProvider);
        }
    }, [initialImages, phase, userSettings.defaultDataProvider]);


    // Initialize timeframes based on strategy
    useEffect(() => {
        if (selectedStrategies.length > 0) {
            const strategy = strategyLogicData[selectedStrategies[0]];
            if (strategy && strategy.preferredTimeframes && strategy.preferredTimeframes.length > 0) {
                setSelectedTimeframes(strategy.preferredTimeframes.slice(0, 3));
            }
        }
    }, [selectedStrategies, strategyLogicData]);

    const handleTimeframeToggle = (tf: string) => {
        if (selectedTimeframes.includes(tf)) {
            setSelectedTimeframes(prev => prev.filter(t => t !== tf));
        } else {
            if (selectedTimeframes.length < 3) {
                setSelectedTimeframes(prev => [...prev, tf]);
            }
        }
    };

    const handleStartGuidedUpload = async () => {
        if (selectedStrategies.length === 0) return;
        try {
            const strategies = selectedStrategies.map(key => strategyLogicData[key]).filter(Boolean);
            if (strategies.length === 0) {
                setError("Could not find logic for selected strategies.");
                return;
            }
            const systemInstruction = generateGuidedAcquisitionSystemPrompt(strategies);
            // Start the chat with "Start."
            const response = await callAiChat("Start.", systemInstruction);
            onLogTokenUsage(response.usage.totalTokenCount);

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
        if (conversation.length === 0 && (phase === 'idle' || phase === 'ready')) {
            setUploadedImagesData(prev => ({ ...prev, [Date.now()]: imageData.dataUrl }));
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
            // Regenerate system instruction as we don't persist it
            const strategies = selectedStrategies.map(key => strategyLogicData[key]).filter(Boolean);
            const systemInstruction = strategies.length > 0 ? generateGuidedAcquisitionSystemPrompt(strategies) : "You are a helpful assistant.";

            // We need to add the new image to uploadedImagesData BEFORE calling callAiChat
            // because callAiChat uses uploadedImagesData to resolve images in history.
            // However, React state updates are async.
            // So we need to construct the new message manually with the image part.

            // Actually, callAiChat uses conversation state. We just added the user message to conversation state.
            // But we haven't added the image data to uploadedImagesData yet in the state (we do it after success in the original code).
            // But for callAiChat to work, it needs to find the image data.
            // Let's add it to uploadedImagesData temporarily or pass it directly.

            // To be safe, let's pass the imagePart directly in the new message to callAiChat.
            // callAiChat takes (newMessage, systemInstruction).

            const response = await callAiChat([imagePart], systemInstruction);
            onLogTokenUsage(response.usage.totalTokenCount);
            const responseText = (response.text || "").trim();

            if (responseText.includes('[ANALYSIS_READY]')) {
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
    }, [phase, isAnalyzing, onLogTokenUsage, conversation.length, selectedStrategies, callAiChat]);


    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            Array.from(e.target.files).forEach(file => {
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
            });
        }
        e.target.value = '';
    };

    const handlePasteClick = async () => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            let foundImage = false;
            for (const item of clipboardItems) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const result = e.target?.result;
                        if (typeof result === 'string') {
                            handleImageUpload({
                                name: `pasted_image_${Date.now()}.png`,
                                type: imageType,
                                dataUrl: result
                            });
                        }
                    };
                    reader.readAsDataURL(blob);
                    foundImage = true;
                }
            }
            if (!foundImage) {
                setError("No image found in clipboard.");
            }
        } catch (err) {
            console.error("Failed to read clipboard:", err);
            setError("Clipboard access denied. Please allow clipboard permissions in your browser settings (click the lock icon in the URL bar) or use Ctrl+V / Cmd+V to paste.");
        }
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

        // Reuse existing stream if active
        if (streamRef.current && streamRef.current.active) {
            setIsCaptureModalOpen(true);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "always"
                } as any,
                audio: false
            });

            streamRef.current = stream;
            setCaptureStream(stream);
            setIsCaptureModalOpen(true);

            // Handle stream stop (user clicks "Stop sharing")
            stream.getVideoTracks()[0].onended = () => {
                stopMediaStream();
            };
        } catch (err) {
            console.error("Screen capture error:", err);
            setCaptureError("Could not start screen capture. Please ensure permissions are granted.");
            setIsCaptureModalOpen(true);
        }
    };

    const handleCaptureSubmit = (imageDataUrl: string) => {
        if (!imageDataUrl) {
            setCaptureError("Failed to capture image.");
            return;
        }

        handleImageUpload({
            name: `screen_capture_${Date.now()}.png`,
            type: 'image/png',
            dataUrl: imageDataUrl
        });

        setIsCaptureModalOpen(false);
        // Do NOT stop the stream here, allowing reuse
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
        setProgressMessage("Initializing analysis...");

        if (Object.keys(uploadedImagesData).length === 0) {
            setError("No context provided. Please complete the guided chart upload to run an analysis.");
            setIsAnalyzing(false);
            return;
        }

        // Generate base system instruction
        let systemInstruction = generateSystemInstructionContent(
            selectedStrategies,
            userSettings,
            uploadedImagesData,
            strategyLogicData,
            null, // We will inject current price later if found
            isComparisonMode
        );

        const manager = getAiManager();
        let currentPrice: number | null = null;
        let identifiedTimeframe: string | null = null;
        let liveMarketDataContext = ''; // Initialize here, will be appended to systemInstruction later

        // --- HYBRID ANALYSIS FLOW ---
        if (useLiveData) {
            try {
                setProgressMessage("Identifying asset from charts...");
                // Step 1: Identify Asset from Images
                const identificationPrompt = `
                    Identify the trading asset symbol (e.g., BTC/USD, EUR/USD, NVDA) and the primary timeframe (e.g., 15m, 4h, 1d) shown in these charts.
                    Return ONLY a JSON object: { "symbol": "STRING", "timeframe": "STRING" }.
                    If uncertain, return { "symbol": null, "timeframe": null }.
                `;

                const imageParts: Part[] = [];
                for (const key of Object.keys(uploadedImagesData)) {
                    const dataUrl = uploadedImagesData[key as any];
                    if (dataUrl) {
                        const prefixMatch = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,/);
                        if (prefixMatch) {
                            imageParts.push({ inlineData: { mimeType: prefixMatch[1], data: dataUrl.substring(prefixMatch[0].length) } });
                        }
                    }
                }

                // Use generateChat for identification
                const idResponse = await manager.generateChat(
                    "You are a market data assistant that identifies assets and timeframes from chart images.",
                    [], // No history
                    [{ text: identificationPrompt }, ...imageParts]
                );
                onLogTokenUsage(idResponse.usage.totalTokenCount);

                let idJson = (idResponse.text || "").trim();
                const fenceMatch = idJson.match(/^```json\s*([\s\S]*?)\s*```$/) || idJson.match(/^```\s*([\s\S]*?)\s*```$/);
                if (fenceMatch) idJson = fenceMatch[1];

                let idResult: { symbol: string | null, timeframe: string | null } = { symbol: null, timeframe: null };
                try {
                    idResult = JSON.parse(idJson);
                } catch (e) {
                    console.warn("Failed to parse ID response JSON:", e);
                }


                if (idResult.symbol) {
                    const symbol = idResult.symbol.toUpperCase();
                    // Use user selected timeframe if available, otherwise fallback to detected
                    const primaryTimeframe = selectedTimeframes[0] || idResult.timeframe || '4h';
                    identifiedTimeframe = primaryTimeframe;

                    // Determine which timeframes we actually need to fetch
                    // If user selected specific ones, use those. Otherwise just the primary.
                    const timeframesToFetch = useLiveData && selectedTimeframes.length > 0 ? selectedTimeframes : [primaryTimeframe];

                    setProgressMessage(`Identified ${symbol}. Checking stored data for ${timeframesToFetch.join(', ')}...`);

                    // Step 2: Smart Data Fetching (Glueing) & Economic API Use
                    const marketDataMap: Record<string, any[]> = {};
                    currentPrice = null; // Reset currentPrice for multi-timeframe logic

                    for (const tf of timeframesToFetch) {
                        // Check IDB first
                        const storedCandles = await getMarketData(symbol, tf) || [];
                        let candlesToUse = storedCandles;

                        // Simple "freshness" check: if we have data, is the last candle recent?
                        // For now, we'll just check if we have ANY data.
                        // To be truly economic, we should only fetch if the last candle is too old.
                        // But for simplicity and robustness, let's try to append if we have data.

                        if (storedCandles.length > 0) {
                            // Logic to check freshness could go here
                        }

                        // We will ALWAYS try to fetch a little bit of new data to ensure live price is fresh,
                        // unless we just fetched it seconds ago (not implemented yet).
                        // But we limit the batch size.

                        if (selectedProvider === 'twelvedata') {
                            const twelveDataKey = apiConfig.twelveDataApiKey || (userSettings as any).twelveDataApiKey;
                            if (twelveDataKey) {
                                const api = new TwelveDataApi(twelveDataKey);
                                // Fetch small batch if we have history, larger if we don't
                                const outputSize = storedCandles.length > 0 ? 5 : 50;

                                try {
                                    // Note: TwelveData doesn't support start_date perfectly for all plans,
                                    // so we might just fetch latest N and merge.
                                    const newCandles = await api.getTimeSeries(symbol, tf, outputSize);

                                    if (newCandles.length > 0) {
                                        // Merge logic
                                        const merged = [...storedCandles];
                                        const existingTimes = new Set(merged.map(c => Array.isArray(c) ? c[0] : (c.time || c.date)));

                                        newCandles.forEach((c: any) => {
                                            const t = c.datetime || c.date; // TwelveData uses datetime
                                            // Normalize time format if needed (TwelveData returns "YYYY-MM-DD HH:mm:ss")
                                            if (!existingTimes.has(t)) {
                                                // Convert to array format for consistency if needed, or keep object
                                                // Our IDB stores whatever we put in. Let's standardize on Array [time, open, high, low, close, volume]
                                                // TwelveData returns objects. Let's convert to array for storage efficiency if we want,
                                                // but our app seems to handle both. Let's stick to the API return for now but ensure we handle it.
                                                // Actually, getMarketData returns what was stored.
                                                // Let's store arrays: [time, open, high, low, close, volume]
                                                const candleArr = [
                                                    c.datetime,
                                                    parseFloat(c.open),
                                                    parseFloat(c.high),
                                                    parseFloat(c.low),
                                                    parseFloat(c.close),
                                                    parseFloat(c.volume)
                                                ];
                                                merged.push(candleArr);
                                            }
                                        });

                                        // Sort by time
                                        merged.sort((a, b) => {
                                            const tA = new Date(Array.isArray(a) ? a[0] : a.datetime).getTime();
                                            const tB = new Date(Array.isArray(b) ? b[0] : b.datetime).getTime();
                                            return tA - tB;
                                        });

                                        candlesToUse = merged;
                                        // Update Store
                                        await setMarketData(symbol, tf, merged);

                                        // Update current price from the very last candle of the primary timeframe
                                        if (tf === primaryTimeframe) {
                                            const last = merged[merged.length - 1];
                                            currentPrice = Array.isArray(last) ? last[4] : parseFloat(last.close);
                                        }
                                    }
                                } catch (err) {
                                    console.warn(`Failed to fetch ${tf} for ${symbol}:`, err);
                                }
                            }
                        } else {
                            // FreeCryptoApi fallback logic (simplified for brevity, similar merge needed)
                            const api = new FreeCryptoApi(apiConfig.freeCryptoApiKey);
                            try {
                                const newCandles = await api.getCandles(symbol, tf); // This fetches ~100
                                if (newCandles.length > 0) {
                                    // Overwrite/Merge
                                    candlesToUse = newCandles.map(c => [c.time, c.open, c.high, c.low, c.close, c.volume]);
                                    await setMarketData(symbol, tf, candlesToUse);
                                    if (tf === primaryTimeframe) {
                                        currentPrice = candlesToUse[candlesToUse.length - 1][4];
                                    }
                                }
                            } catch (e) { console.warn("Free API failed", e); }
                        }

                        marketDataMap[tf] = candlesToUse.slice(-50); // Keep last 50 for context window efficiency
                    }

                    // Format Data for Prompt
                    let marketDataContext = `**LIVE MARKET DATA (${symbol})**\n`;
                    for (const [tf, candles] of Object.entries(marketDataMap)) {
                        if (candles.length > 0) {
                            const last = candles[candles.length - 1];
                            const lastClose = Array.isArray(last) ? last[4] : last.close;
                            marketDataContext += `- **${tf}**: Last Price ${lastClose} (based on ${candles.length} candles)\n`;
                            // Add a mini-table of last 5 candles for this timeframe
                            marketDataContext += `  Last 5 candles (${tf}):\n`;
                            candles.slice(-5).forEach(c => {
                                const [t, o, h, l, cl] = Array.isArray(c) ? c : [c.datetime, c.open, c.high, c.low, c.close];
                                marketDataContext += `  [${t}]: O:${o} H:${h} L:${l} C:${cl}\n`;
                            });
                        } else {
                            marketDataContext += `- **${tf}**: No data available.\n`;
                        }
                    }

                    // Replace the generic prompt with this rich context
                    liveMarketDataContext = `\n\n${marketDataContext}`;

                    // Also update the current price anchor if we found it
                    if (currentPrice) {
                        liveMarketDataContext += `\nTHE CURRENT PRICE IS \`${currentPrice}\` (derived from live ${selectedProvider} data). This is your non-negotiable anchor.`;
                    }
                }
            } catch (err) {
                console.error("Live data fetch failed:", err);
                setProgressMessage("Live data unavailable. Proceeding with visual analysis only...");
            }
        } else {
            // STRICT HALLUCINATION PREVENTION
            liveMarketDataContext = `\n\n**IMPORTANT: NO EXTERNAL MARKET DATA AVAILABLE.**\n- You must rely SOLELY on the visual information in the provided chart screenshots.\n- Do NOT hallucinate or invent prices, indicators, or dates.\n- If a value is not visible, estimate it from the chart axis or state that it is unknown.\n- Your analysis must be purely visual.`;
        }

        // Append the live data context to the system instruction
        systemInstruction = generateSystemInstructionContent(
            selectedStrategies, userSettings, uploadedImagesData, strategyLogicData,
            currentPrice, isComparisonMode
        );
        systemInstruction += liveMarketDataContext;

        // Force explanation format for UI segmentation
        systemInstruction += `\n\n**IMPORTANT OUTPUT FORMATTING:**\nFor the "explanation" field in your JSON output, you MUST use the following format with "|||" separators:\n"Strategy Match: [text] ||| Chart Evidence: [text] ||| Execution & Risk: [text]"`;

        setProgressMessage("Analyzing charts & data...");

        // 3. Call AI for Final Analysis
        // We use the chat interface to maintain context if needed, but for this single-shot analysis,
        // we can just send the user message with images.

        // Construct the user message part
        const userMessageText = `Analyze these charts based on the strategy logic provided in the system prompt.

        ${useLiveData ? `I have provided live market data context above. Use it to validate the chart's visual information.` : ''}

        Generate the JSON output as specified.`;

        const imagePartsForAnalysis = Object.values(uploadedImagesData)
            .filter(d => d)
            .map(d => ({ inlineData: { mimeType: 'image/png', data: d!.split(',')[1] } }));

        try {
            // Use generateChat for the final analysis
            const response = await manager.generateChat(
                systemInstruction,
                [], // No history
                [{ text: userMessageText }, ...imagePartsForAnalysis]
            );

            const totalTokenCount = response.usage.totalTokenCount;
            onLogTokenUsage(totalTokenCount);

            let fullResponseText = (response.text || "").trim();
            let councilDiscussion = "";

            // Extract Council Transcript if present
            const transcriptStartMarker = "<<<COUNCIL_TRANSCRIPT_START>>>";
            const transcriptEndMarker = "<<<COUNCIL_TRANSCRIPT_END>>>";
            const transcriptStartIndex = fullResponseText.indexOf(transcriptStartMarker);

            if (transcriptStartIndex !== -1) {
                const transcriptEndIndex = fullResponseText.indexOf(transcriptEndMarker);
                if (transcriptEndIndex !== -1) {
                    councilDiscussion = fullResponseText.substring(transcriptStartIndex + transcriptStartMarker.length, transcriptEndIndex).trim();
                    // Remove transcript from the text to be parsed as JSON
                    fullResponseText = fullResponseText.substring(0, transcriptStartIndex).trim();
                }
            }

            let jsonText = fullResponseText;
            const firstOpen = jsonText.indexOf('{');
            const lastClose = jsonText.lastIndexOf('}');

            if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
                jsonText = jsonText.substring(firstOpen, lastClose + 1);
            }

            const results: AnalysisResults = JSON.parse(jsonText);
            if (councilDiscussion) {
                results.councilDiscussion = councilDiscussion;
            }

            // Ensure every trade has an entry price and correct direction.
            const fillMissingEntry = (trades: Trade[], direction: 'Long' | 'Short') =>
                trades.map(trade => ({
                    ...trade,
                    direction: direction,
                    entry: (trade.entry && String(trade.entry).trim()) ? String(trade.entry) : 'N/A',
                    tokenUsage: totalTokenCount,
                    // Inject timeframe if we identified it during hybrid analysis
                    timeframe: undefined
                }));



            results['Top Longs'] = fillMissingEntry(results['Top Longs'] ?? [], 'Long');
            results['Top Shorts'] = fillMissingEntry(results['Top Shorts'] ?? [], 'Short');

            if (identifiedTimeframe) {
                // Inject analysis context and timeframe into trades
                const enrichTrade = (t: any) => ({
                    ...t,
                    timeframe: identifiedTimeframe || '4h',
                    analysisContext: {
                        realTimeContextWasUsed: useLiveData
                    }
                });

                if (results['Top Longs']) {
                    results['Top Longs'] = results['Top Longs'].map(enrichTrade);
                }
                if (results['Top Shorts']) {
                    results['Top Shorts'] = results['Top Shorts'].map(enrichTrade);
                }
            }

            onAnalysisComplete(results, selectedStrategies, uploadedImagesData, useRealTimeContext, totalTokenCount);

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : "An unknown error occurred during analysis.";
            setError(`AI Analysis Failed: ${errorMessage}`);
        } finally {
            setIsAnalyzing(false);
            setProgressMessage('');
        }
    };

    useImperativeHandle(ref, () => ({
        triggerAnalysis,
        resetState,
    }));

    return (
        <div className="bg-gray-800/70 p-4 rounded-lg border border-gray-700">
            {/* Simplified Interaction for Direct Upload */}
            {(phase === 'idle' || (phase === 'ready' && conversation.length === 0)) && (
                <div>
                    <h4 className="font-bold text-gray-200">Provide Market Context</h4>
                    <p className="text-sm text-gray-400 mb-4">Upload screenshots of your charts for analysis.</p>

                    <div className="mb-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2 mb-2">
                            <input
                                type="checkbox"
                                id="useLiveData"
                                checked={useLiveData}
                                onChange={(e) => setUseLiveData(e.target.checked)}
                                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="useLiveData" className="text-sm text-gray-300 select-none cursor-pointer">
                                Enhance with Live Data (Multi-Timeframe Analysis)
                            </label>
                        </div>

                        {useLiveData && (
                            <div className="pl-6 space-y-3 animate-fadeIn">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Select Timeframes (Max 3)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {['1w', '1d', '4h', '1h', '30m', '15m', '5m', '1m'].map(tf => (
                                            <button
                                                key={tf}
                                                onClick={() => handleTimeframeToggle(tf)}
                                                className={`px-3 py-1 text-xs rounded-full border transition-colors ${selectedTimeframes.includes(tf)
                                                    ? 'bg-blue-600 border-blue-500 text-white'
                                                    : 'bg-gray-800 border-gray-600 text-gray-400 hover:border-gray-500'
                                                    }`}
                                            >
                                                {tf}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-1">
                                        Selected: {selectedTimeframes.join(', ')}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">Data Provider</label>
                                    <select
                                        value={selectedProvider}
                                        onChange={(e) => setSelectedProvider(e.target.value as any)}
                                        className="bg-gray-800 border border-gray-600 text-gray-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
                                    >
                                        <option value="twelvedata">Twelve Data (High Quality)</option>
                                        <option value="freecrypto">Free Crypto API (Basic)</option>
                                    </select>
                                </div>
                            </div>
                        )}</div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                        <button onClick={() => fileInputRef.current?.click()} className="text-sm font-semibold p-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                            Upload Image
                        </button>
                        <button onClick={handlePasteClick} className="text-sm font-semibold p-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors" title="Paste from Clipboard">
                            Paste Image
                        </button>
                        <button onClick={handleInitiateScreenCapture} className="text-sm font-semibold p-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors">
                            Share Screen
                        </button>
                    </div>

                    {/* Uploaded Images Gallery */}
                    {Object.keys(uploadedImagesData).length > 0 && (
                        <div className="mb-4">
                            <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Uploaded Context ({Object.keys(uploadedImagesData).length})</h5>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {Object.entries(uploadedImagesData).map(([key, url]) => (
                                    <div key={key} className="relative group aspect-video bg-gray-900 rounded-md overflow-hidden border border-gray-700">
                                        {url && <img src={url} alt={`Uploaded ${key}`} className="w-full h-full object-cover" />}
                                        <button
                                            onClick={() => {
                                                setUploadedImagesData(prev => {
                                                    const newState = { ...prev };
                                                    delete newState[parseInt(key)];
                                                    return newState;
                                                });
                                                // Also remove from conversation if present (optional, but good for consistency if we switch modes)
                                            }}
                                            className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Remove Image"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Guided Option Link */}
                    <button onClick={handleStartGuidedUpload} disabled={selectedStrategies.length === 0 || isAnalyzing} className="mt-4 text-xs text-yellow-500 hover:underline disabled:text-gray-600">
                        {isAnalyzing ? "Initializing..." : "Or start Guided Acquisition Assistant"}
                    </button>
                </div>
            )}

            {/* Chat Interface for Guided Mode OR Result Display */}
            {phase !== 'idle' && !(phase === 'ready' && conversation.length === 0) && (
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
                                    <p className="text-sm">{progressMessage || "Oracle is thinking..."}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 p-3 bg-gray-900/50 border-t border-gray-700">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button onClick={() => fileInputRef.current?.click()} className="text-xs font-semibold p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white">Upload</button>
                            <button onClick={handlePasteClick} className="text-xs font-semibold p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white" title="Paste from Clipboard">Paste</button>
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

            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" multiple className="hidden" />
            <ScreenCaptureModal isOpen={isCaptureModalOpen} stream={captureStream} onCapture={handleCaptureSubmit} onClose={() => { setIsCaptureModalOpen(false); stopMediaStream(); }} error={captureError} />
        </div>
    );
});

export default ImageUploader;
