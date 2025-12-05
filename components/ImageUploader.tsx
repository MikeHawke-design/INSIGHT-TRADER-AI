
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
        setError(null);
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
    }, [initialImages, phase]);


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

        try {
            const systemInstruction = generateGuidedAcquisitionSystemPrompt(primaryStrategy);
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
            const primaryStrategyKey = selectedStrategies[0];
            const primaryStrategy = strategyLogicData[primaryStrategyKey];
            const systemInstruction = primaryStrategy ? generateGuidedAcquisitionSystemPrompt(primaryStrategy) : "You are a helpful assistant.";

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

        stopMediaStream();
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" } as any, audio: false });
            streamRef.current = stream;
            setCaptureStream(stream);
            setIsCaptureModalOpen(true);

            // Handle stream ending (e.g. user clicks "Stop sharing" in browser UI)
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

        if (Object.keys(uploadedImagesData).length === 0) {
            setError("No context provided. Please complete the guided chart upload to run an analysis.");
            setIsAnalyzing(false);
            return;
        }

        const manager = getAiManager();
        let currentPrice: number | null = null;

        try {
            const systemInstruction = generateSystemInstructionContent(
                selectedStrategies, userSettings, uploadedImagesData, strategyLogicData,
                currentPrice, isComparisonMode
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
                ? imageParts
                : [{ text: "Analyze the provided cached historical data based on the system instructions." }];

            // Add "Output JSON" to the prompt to ensure JSON response from non-Gemini providers
            const promptWithJsonInstruction = [
                ...requestContents,
                { text: "\n\nIMPORTANT: Output ONLY valid JSON matching the expected format. Do not include markdown formatting like ```json." }
            ];

            const response = await manager.generateContent(systemInstruction, promptWithJsonInstruction);

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
                    entry: (trade.entry && String(trade.entry).trim()) ? String(trade.entry) : 'N/A'
                }));

            results['Top Longs'] = fillMissingEntry(results['Top Longs'] ?? [], 'Long');
            results['Top Shorts'] = fillMissingEntry(results['Top Shorts'] ?? [], 'Short');

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
        resetState,
    }));

    return (
        <div className="bg-gray-800/70 p-4 rounded-lg border border-gray-700">
            {/* Simplified Interaction for Direct Upload */}
            {(phase === 'idle' || (phase === 'ready' && conversation.length === 0)) && (
                <div>
                    <h4 className="font-bold text-gray-200">Provide Market Context</h4>
                    <p className="text-sm text-gray-400 mb-4">Upload screenshots of your charts for analysis.</p>

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
                                    <p className="text-sm">Oracle is thinking...</p>
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
