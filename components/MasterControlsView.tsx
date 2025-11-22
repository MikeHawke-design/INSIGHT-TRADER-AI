
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { ActiveView, StrategyKey, StrategyLogicData, User, UserSettings, TokenUsageRecord, ApiConfiguration, MarketDataCache, EodhdUsageStats, CourseModule, MarketDataCandle } from '../types';
// @ts-ignore - pdfjs-dist doesn't have proper TypeScript declarations
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import JSZip from 'jszip';
import ConfirmationModal from './ConfirmationModal';
import Logo from './Logo';
import { ALL_PERSISTENT_STORAGE_KEYS } from '../constants';
import { getAllEntries } from '../idb';
import InteractiveChartModal from './InteractiveChartModal';
import UserManualView from './UserManualView';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@5.4.149/build/pdf.worker.mjs`;

interface MasterControlsViewProps {
    strategyLogicData: Record<StrategyKey, StrategyLogicData>;
    setStrategyLogicData: React.Dispatch<React.SetStateAction<Record<string, StrategyLogicData>>>;
    apiConfig: ApiConfiguration;
    setApiConfig: React.Dispatch<React.SetStateAction<ApiConfiguration>>;
    userSettings: UserSettings;
    onUserSettingsChange: (key: keyof UserSettings, value: any) => void;
    currentUser: User | null;
    tokenUsageHistory: TokenUsageRecord[];
    onLogTokenUsage: (tokens: number) => void;
    onOpenLegal: (type: 'privacy' | 'terms') => void;
    marketDataCache: MarketDataCache;
    onFetchAndLoadData: (symbol: string, timeframe: string, from: string, to: string) => Promise<{ count: number; key: string; }>;
    onRemoveMarketData: (cacheKey: string) => void;
    onRestoreData: (data: Record<string, any>) => void;
    eodhdUsage: EodhdUsageStats | null;
    onFetchEodhdUsage: () => void;
    onNavClick: (view: ActiveView) => void;
}

// Helper function for retrying API calls with exponential backoff
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = 3,
    delay: number = 2000,
    onRetry: (attempt: number, delay: number, error: any) => void
): Promise<T> {
    let attempt = 1;
    while (true) {
        try {
            return await fn();
        } catch (error: any) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isOverloaded = errorMessage.includes('503') || errorMessage.toLowerCase().includes('overloaded') || errorMessage.toLowerCase().includes('unavailable');

            if (!isOverloaded || attempt >= retries) {
                throw error;
            }

            const currentDelay = delay * Math.pow(2, attempt - 1);
            onRetry(attempt, currentDelay, error);

            await new Promise(resolve => setTimeout(resolve, currentDelay));
            attempt++;
        }
    }
}

const EODHD_SYMBOLS = [
    // Forex
    'EURUSD.FOREX', 'GBPUSD.FOREX', 'USDJPY.FOREX', 'USDCHF.FOREX', 'AUDUSD.FOREX', 'USDCAD.FOREX', 'NZDUSD.FOREX',
    'EURGBP.FOREX', 'EURJPY.FOREX', 'GBPJPY.FOREX',
    // Crypto (Format: TICKER-CURRENCY.CC)
    'BTC-USD.CC', 'ETH-USD.CC', 'XRP-USD.CC', 'ADA-USD.CC', 'SOL-USD.CC', 'LTC-USD.CC',
    // Indices (Format: TICKER.INDX)
    'GSPC.INDX',  // S&P 500
    'NDX.INDX',   // NASDAQ 100
    'DJI.INDX',   // Dow Jones Industrial Average
    'VIX.INDX',   // CBOE Volatility Index
    'DAX.INDX',   // DAX Performance-Index (Germany)
    'FTSE.INDX',  // FTSE 100 (UK)
    // Commodities
    'XAUUSD.FOREX', // Gold
    'XAGUSD.FOREX', // Silver
    'CL.COMM',      // Crude Oil Futures
    'NG.COMM',      // Natural Gas Futures
    'HG.COMM',      // Copper Futures
    // US Stocks (Format: TICKER.US)
    'AAPL.US', 'MSFT.US', 'GOOGL.US', 'AMZN.US', 'TSLA.US', 'NVDA.US'
];


// --- ICONS ---
const ViewIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.18l.88-1.473a1.65 1.65 0 0 1 1.505-.882H16.95a1.65 1.65 0 0 1 1.505.882l.88 1.473c.447.746.447 1.613 0 2.358l-.88 1.473a1.65 1.65 0 0 1-1.505.882H3.05a1.65 1.65 0 0 1-1.505-.882l-.88-1.473ZM2.65 9.7a.15.15 0 0 1 .136.08l.88 1.473a.15.15 0 0 0 .137.08H16.19a.15.15 0 0 0 .136-.08l.88-1.473a.15.15 0 0 1 0-.16l-.88-1.473a.15.15 0 0 0-.136-.08H3.05a.15.15 0 0 0-.136.08l-.88 1.473a.15.15 0 0 1 0 .16Z" clipRule="evenodd" /></svg>;
const EditIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" /></svg>;
const TrashIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 1 0 .214 1.482l.025.007c.786.246 1.573.393 2.37.468v6.618A2.75 2.75 0 0 0 8.75 18h2.5A2.75 2.75 0 0 0 14 15.25V5.162c.797-.075 1.585-.222 2.37-.468a.75.75 0 1 0-.214-1.482l-.025-.007a33.58 33.58 0 0 0-2.365-.468V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V15.25a1.25 1.25 0 0 1-1.25 1.25h-2.5A1.25 1.25 0 0 1 7.5 15.25V4.075C8.327 4.025 9.16 4 10 4Z" clipRule="evenodd" /></svg>;
const ToggleOnIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm4.28 10.28a.75.75 0 0 0 0-1.06l-3-3a.75.75 0 1 0-1.06 1.06l1.72 1.72H8.25a.75.75 0 0 0 0 1.5h5.69l-1.72 1.72a.75.75 0 1 0 1.06 1.06l3-3Z" clipRule="evenodd" /></svg>;
const ToggleOffIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 0 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0-1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" /></svg>;
const ClipboardIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 1a2.5 2.5 0 0 0-2.5 2.5V4h-2A2.5 2.5 0 0 0 1 6.5v11A2.5 2.5 0 0 0 3.5 20h13a2.5 2.5 0 0 0 2.5-2.5v-11A2.5 2.5 0 0 0 16.5 4h-2v-.5A2.5 2.5 0 0 0 12 1H8ZM6 3.5A1 1 0 0 1 7 2.5h6a1 1 0 0 1 1 1V4H6v-.5ZM3.5 5.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-11a1 1 0 0 0-1-1h-13Z" clipRule="evenodd" /></svg>;
const UploadIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 0 0 1.09 1.03L9.25 4.636V13.25Z" /><path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" /></svg>;
const CheckIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z" clipRule="evenodd" /></svg>;

// --- COMPONENT ---

export const MasterControlsView: React.FC<MasterControlsViewProps> = ({
    strategyLogicData,
    setStrategyLogicData,
    apiConfig,
    setApiConfig,
    userSettings,
    onUserSettingsChange,
    currentUser: _currentUser,
    tokenUsageHistory: _tokenUsageHistory,
    onLogTokenUsage,
    onOpenLegal,
    marketDataCache,
    onFetchAndLoadData,
    onRemoveMarketData,
    onRestoreData,
    eodhdUsage,
    onFetchEodhdUsage,
    onNavClick: _onNavClick,
}) => {
    const [activeTab, setActiveTab] = useState<'strategies' | 'settings' | 'data' | 'manual'>('strategies');

    // Strategy Management State
    const [isEditing, setIsEditing] = useState<StrategyKey | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<StrategyLogicData>>({});
    const [isCreatingStrategy, setIsCreatingStrategy] = useState(false);
    const [creationProgress, setCreationProgress] = useState({ step: 0, total: 4, message: '' });
    const [strategyToDelete, setStrategyToDelete] = useState<StrategyKey | null>(null);
    const [pendingStrategy, setPendingStrategy] = useState<StrategyLogicData | null>(null);
    const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
    const [finalizeFormData, setFinalizeFormData] = useState({ name: '', generateCourse: false });
    const [isFinalizing, setIsFinalizing] = useState(false);

    // Paste Strategy State
    const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
    const [pasteName, setPasteName] = useState('');
    const [pasteText, setPasteText] = useState('');

    // Data Management State
    const [isExporting, setIsExporting] = useState(false);
    const backupFileInputRef = useRef<HTMLInputElement>(null);
    const [marketDataForm, setMarketDataForm] = useState({ symbol: '', timeframe: 'D', from: '', to: '' });
    const [isFetchingData, setIsFetchingData] = useState(false);
    const [fetchDataMessage, setFetchDataMessage] = useState('');
    const [cacheKeyToDelete, setCacheKeyToDelete] = useState<string | null>(null);
    const [viewingChartData, setViewingChartData] = useState<{ key: string, data: MarketDataCandle[] } | null>(null);

    // General State
    const [error, setError] = useState<string | null>(null);

    // API Key Local State
    const [localApiKeys, setLocalApiKeys] = useState(apiConfig);
    const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        setLocalApiKeys(apiConfig);
    }, [apiConfig]);

    const handleSaveApiKeys = () => {
        setApiConfig(localApiKeys);
        setSaveSuccessMessage("Saved!");
        setTimeout(() => setSaveSuccessMessage(null), 3000);
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const today = useMemo(() => new Date().toISOString().split('T')[0], []);



    useEffect(() => {
        if (activeTab === 'data' && apiConfig.eodhdApiKey) {
            onFetchEodhdUsage();
        }
    }, [activeTab, apiConfig.eodhdApiKey, onFetchEodhdUsage]);

    const getAiClient = useCallback(() => {
        const apiKey = apiConfig.geminiApiKey || import.meta.env.VITE_API_KEY;
        return new GoogleGenAI({ apiKey });
    }, [apiConfig.geminiApiKey]);

    // --- Strategy CRUD Handlers ---

    const handleEdit = (key: StrategyKey) => {
        setIsEditing(key);
        setEditFormData(strategyLogicData[key]);
    };

    const handleSave = (key: StrategyKey) => {
        setStrategyLogicData(prev => ({ ...prev, [key]: { ...prev[key], ...editFormData } as StrategyLogicData }));
        setIsEditing(null);
    };

    const handleCancel = () => {
        setIsEditing(null);
        setEditFormData({});
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDeleteStrategy = (key: StrategyKey) => {
        setStrategyLogicData(prev => {
            const newState = { ...prev };
            const strategyToDelete = newState[key] as StrategyLogicData;
            delete newState[key];

            Object.keys(newState).forEach(stratKey => {
                const strat = newState[stratKey] as StrategyLogicData;
                if (strat.parentId === key) {
                    newState[stratKey] = { ...strat, parentId: undefined };
                }
            });

            if (strategyToDelete.parentId && newState[strategyToDelete.parentId]) {
                const parent = newState[strategyToDelete.parentId] as StrategyLogicData;
                if (parent.confluence?.includes(key)) {
                    newState[strategyToDelete.parentId] = {
                        ...parent,
                        confluence: parent.confluence.filter(cKey => cKey !== key)
                    };
                }
            }

            return newState;
        });
        setStrategyToDelete(null);
    };

    const handleToggleEnable = (key: StrategyKey) => {
        setStrategyLogicData(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                isEnabled: !(prev[key].isEnabled ?? true)
            }
        }));
    };

    // --- New Strategy Creation ---

    const generateCourseForStrategy = async (strategy: StrategyLogicData): Promise<CourseModule> => {
        const ai = getAiClient();

        const systemInstruction = `You are an AI curriculum developer specializing in financial trading. Your task is to create a structured, interactive course module based on a user-provided trading strategy.

**The user's strategy is:**
- Name: ${strategy.name}
- Description: ${strategy.description}
- Core Logic: ${strategy.prompt}

**Your output MUST be a single, valid JSON object conforming to the 'CourseModule' type.**

**Course Module Structure:**
{
  "id": "string",
  "title": "string",
  "description": "string",
  "lessons": [
    {
      "id": "string",
      "title": "string",
      "estimatedTime": "string",
      "blocks": [
        { "type": "text", "content": "string" },
        { "type": "exercise", "prompt": "string", "validationPrompt": "string" }
      ]
    }
  ],
  "quiz": [
    { "question": "string", "options": ["string"], "correctAnswer": "string", "explanationPrompt": "string" }
  ]
}

**CRITICAL INSTRUCTIONS:**
- Create 2-3 lessons. Each lesson must have at least one 'text' block and one 'exercise' block.
- Create 3-4 quiz questions.
- The 'validationPrompt' for exercises is for an AI with computer vision. It MUST instruct the AI how to validate a user's chart markup, including PASS/FAIL examples. It MUST be extremely detailed.
- Use unique IDs for the module and lessons (e.g., "C_${Date.now()}").
- The entire response must be ONLY the JSON object, without any markdown formatting.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Generate a course for the provided strategy.`,
            config: { systemInstruction, responseMimeType: 'application/json' }
        });
        onLogTokenUsage(response.usageMetadata?.totalTokenCount || 0);

        let jsonText = (response.text || "").trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonText.match(fenceRegex);
        if (match && match[2]) jsonText = match[2];

        return JSON.parse(jsonText);
    };

    const handleFinalizeAndSaveStrategy = async () => {
        if (!pendingStrategy) return;

        setIsFinalizing(true);

        try {
            let finalStrategy = { ...pendingStrategy, name: finalizeFormData.name };

            if (finalizeFormData.generateCourse) {
                const courseModule = await generateCourseForStrategy(finalStrategy);
                finalStrategy.courseModule = courseModule;
            }

            const newKey: StrategyKey = `strat_${Date.now()}`;
            setStrategyLogicData(prev => ({ ...prev, [newKey]: finalStrategy }));

            // Reset state
            setIsFinalizeModalOpen(false);
            setPendingStrategy(null);
            setFinalizeFormData({ name: '', generateCourse: false });
        } catch (e) {
            const friendlyMessage = e instanceof Error ? e.message : "An unknown error occurred.";
            setError(`Failed to finalize strategy: ${friendlyMessage}`);
        } finally {
            setIsFinalizing(false);
        }
    };

    const handleCreateStrategyFromText = async (content: string, fileName: string) => {
        if (!content) return;

        setIsCreatingStrategy(true);
        setError(null);

        const generatePart = async (step: number, _partName: string, systemInstruction: string, retries = 3, isJson = false): Promise<string> => {
            const ai = getAiClient();

            const config: any = { systemInstruction };
            if (isJson) {
                config.responseMimeType = 'application/json';
            }

            const fn = async () => {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `Here is the user's trading strategy document:\n\n---\n\n${content}`,
                    config: config
                });
                onLogTokenUsage(response.usageMetadata?.totalTokenCount || 0);
                return response.text || "";
            };

            const onRetry = (attempt: number, delay: number, _error: any) => {
                setCreationProgress({ step, total: 4, message: `AI is overloaded. Retrying in ${delay / 1000}s... (Attempt ${attempt})` });
            };

            return retryWithBackoff(fn, retries, 2000, onRetry);
        };

        try {
            setCreationProgress({ step: 1, total: 4, message: 'Analyzing document structure...' });
            const summary = await generatePart(1, 'summary', "You are a strategy analyst. Read the provided trading document and generate a concise, one-paragraph summary (50-100 words) describing the core idea of the strategy. Your output must be only the paragraph of text.", 3, false);

            setCreationProgress({ step: 2, total: 4, message: 'Extracting core logic...' });
            const logic = await generatePart(2, 'logic', "You are an AI prompt engineer. Read the provided trading document and convert its rules into a clear, structured, step-by-step set of instructions for a trading analysis AI. Use markdown for lists and bolding. This will be the AI's core logic prompt. Be detailed and precise.", 3, false);

            setCreationProgress({ step: 3, total: 4, message: 'Defining requirements...' });
            const requirementsText = await generatePart(3, 'requirements', "You are a strategy analyst. Read the document and extract any specific requirements for the user to provide when analyzing a chart. Your response MUST be a JSON object with two keys: 'title' (a string, e.g., 'Chart Requirements for Analysis') and 'items' (an array of strings, where each string is a single requirement, e.g., 'Provide a Daily chart for macro trend.'). Use HTML `<strong>` tags for emphasis inside the strings. If no requirements, return empty items array.", 3, true);

            let cleanedRequirementsText = requirementsText.trim();
            const reqMatch = cleanedRequirementsText.match(/^```(\w*)?\s*\n?(.*?)\n?\s*```$/s);
            if (reqMatch && reqMatch[2]) {
                cleanedRequirementsText = reqMatch[2].trim();
            }
            const requirements = JSON.parse(cleanedRequirementsText);

            setCreationProgress({ step: 4, total: 4, message: 'Finalizing strategy...' });
            const finalizationText = await generatePart(4, 'finalization', "You are a strategy classifier. Based on the document, determine the best-fit categories. Your response MUST be a JSON object with keys: `tags` (array of 3-5 strings like 'Scalping', 'SMC', 'Reversal'), `assetClasses` (array of strings from ['Forex', 'Crypto', 'Indices', 'Stocks', 'Commodities']), `timeZoneSpecificity` (a string, e.g., 'New York Killzone', 'None'), and `tradingStyles` (array of strings from ['Scalping', 'Day Trading', 'Swing Trading', 'Position Trading']).", 3, true);

            let cleanedFinalizationText = finalizationText.trim();
            const finalMatch = cleanedFinalizationText.match(/^```(\w*)?\s*\n?(.*?)\n?\s*```$/s);
            if (finalMatch && finalMatch[2]) {
                cleanedFinalizationText = finalMatch[2].trim();
            }
            const finalization = JSON.parse(cleanedFinalizationText);

            const newStrategy: StrategyLogicData = {
                name: fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
                status: 'beta',
                description: summary,
                prompt: logic,
                // SAFE CHECK ADDED: Ensure requirements.items is a valid array before checking length
                requirements: (requirements && Array.isArray(requirements.items) && requirements.items.length > 0) ? requirements : undefined,
                isEnabled: true,
                tags: finalization.tags,
                assetClasses: finalization.assetClasses,
                timeZoneSpecificity: finalization.timeZoneSpecificity,
                tradingStyles: finalization.tradingStyles,
            };

            setPendingStrategy(newStrategy);
            setFinalizeFormData({ name: newStrategy.name, generateCourse: false });
            setIsFinalizeModalOpen(true);

        } catch (e) {
            const friendlyMessage = e instanceof Error ? e.message : "An unknown error occurred.";
            setError(`Strategy Creation Failed: ${friendlyMessage}`);
        } finally {
            setIsCreatingStrategy(false);
            setCreationProgress({ step: 0, total: 4, message: '' });
        }
    };

    const handleStrategyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const arrayBuffer = event.target?.result as ArrayBuffer;
                try {
                    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                    let textContent = '';
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const page = await pdf.getPage(i);
                        const text = await page.getTextContent();
                        textContent += text.items.map((item: any) => 'str' in item ? item.str : '').join(' ') + '\n';
                    }
                    await handleCreateStrategyFromText(textContent, file.name);
                } catch (pdfError) {
                    setError('Failed to parse PDF file.');
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const textContent = event.target?.result as string;
                await handleCreateStrategyFromText(textContent, file.name);
            };
            reader.readAsText(file);
        }

        if (e.target) e.target.value = '';
    };

    const handlePasteSubmit = () => {
        if (!pasteText.trim()) return;
        const name = pasteName.trim() || "New Strategy";
        handleCreateStrategyFromText(pasteText, name);
        setIsPasteModalOpen(false);
        setPasteName('');
        setPasteText('');
    };

    // --- Data Management Handlers ---

    const handleExportData = async () => {
        setIsExporting(true);
        try {
            const backupData: Record<string, any> = {
                localStorage: {},
                imageStore: {}
            };

            ALL_PERSISTENT_STORAGE_KEYS.forEach(key => {
                const item = localStorage.getItem(key);
                if (item !== null) {
                    backupData.localStorage[key] = JSON.parse(item);
                }
            });

            const allImages = await getAllEntries();
            backupData.imageStore = Object.fromEntries(allImages);

            const zip = new JSZip();
            zip.file("chart-oracle-backup.json", JSON.stringify(backupData));
            const content = await zip.generateAsync({ type: "blob" });

            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = `chart-oracle-backup_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            alert('Failed to export data. See console for details.');
            console.error(error);
        } finally {
            setIsExporting(false);
        }
    };

    const handleRestoreBackupClick = () => {
        backupFileInputRef.current?.click();
    };

    const handleBackupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        if (file.name.endsWith('.zip')) {
            reader.onload = async (event) => {
                try {
                    if (!event.target?.result) throw new Error("File could not be read.");
                    const zip = await JSZip.loadAsync(event.target.result as ArrayBuffer);
                    const jsonFile = zip.file("chart-oracle-backup.json");
                    if (jsonFile) {
                        const content = await jsonFile.async("string");
                        const data = JSON.parse(content);
                        onRestoreData(data);
                    } else {
                        alert('Invalid backup ZIP file. "chart-oracle-backup.json" not found inside.');
                    }
                } catch (error) {
                    console.error("ZIP Restore Error:", error);
                    alert('Failed to read or parse the backup ZIP file. It may be corrupt.');
                }
            };
            reader.readAsArrayBuffer(file);
        } else if (file.name.endsWith('.json')) {
            reader.onload = (event) => {
                try {
                    if (!event.target?.result) throw new Error("File could not be read.");
                    const content = event.target.result as string;
                    const data = JSON.parse(content);
                    // A quick validation to see if it looks like a backup file
                    if (data.localStorage && data.imageStore) {
                        onRestoreData(data);
                    } else {
                        alert('Invalid JSON backup file. The file does not have the expected structure.');
                    }
                } catch (error) {
                    console.error("JSON Restore Error:", error);
                    alert('Failed to parse the JSON backup file. It may be corrupt.');
                }
            };
            reader.readAsText(file);
        } else {
            alert('Unsupported file type. Please select a .zip or .json backup file.');
        }

        e.target.value = '';
    };

    const handleFetchMarketData = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsFetchingData(true);
        setFetchDataMessage('');
        try {
            const { count, key } = await onFetchAndLoadData(marketDataForm.symbol, marketDataForm.timeframe, marketDataForm.from, marketDataForm.to);
            setFetchDataMessage(`Success! Fetched ${count} candles for ${key}.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : "An unknown error occurred.";
            setFetchDataMessage(`Error: ${message}`);
        } finally {
            setIsFetchingData(false);
        }
    };

    const { parentStrategies, childrenByParent } = useMemo(() => {
        const parents: [StrategyKey, StrategyLogicData][] = [];
        const childrenMap: Record<StrategyKey, [StrategyKey, StrategyLogicData][]> = {};

        Object.entries(strategyLogicData).forEach(([key, strat]: [string, StrategyLogicData]) => {
            if (strat.parentId && strategyLogicData[strat.parentId]) {
                if (!childrenMap[strat.parentId]) {
                    childrenMap[strat.parentId] = [];
                }
                childrenMap[strat.parentId].push([key, strat]);
            } else {
                parents.push([key, strat]);
            }
        });

        return { parentStrategies: parents.sort((a, b) => a[1].name.localeCompare(b[1].name)), childrenByParent: childrenMap };
    }, [strategyLogicData]);

    // --- RENDER METHODS ---

    const renderStrategyList = () => (
        <div className="space-y-4">
            {parentStrategies.map(([key, strat]) => (
                <div key={key} className="bg-gray-700/30 rounded-lg">
                    <StrategyListItem strategy={strat} strategyKey={key} onEdit={handleEdit} setStrategyToDelete={setStrategyToDelete} onToggleEnable={handleToggleEnable} />
                    {childrenByParent[key] && (
                        <div className="pl-6 pr-2 pb-2 space-y-2">
                            {childrenByParent[key].map(([childKey, childStrat]) => (
                                <StrategyListItem key={childKey} strategy={childStrat} strategyKey={childKey} onEdit={handleEdit} setStrategyToDelete={setStrategyToDelete} onToggleEnable={handleToggleEnable} isChild />
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );

    const renderStrategyEditForm = () => {
        if (!isEditing || !editFormData) return null;

        const parentCandidateKeys = Object.keys(strategyLogicData).filter(key => key !== isEditing && !strategyLogicData[key].parentId);

        return (
            <div className="fixed inset-0 bg-gray-900/80 z-50 flex items-center justify-center p-4 animate-fadeIn">
                <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-4xl border border-gray-700 max-h-[90vh] flex flex-col">
                    <h3 className="text-xl font-bold text-yellow-400 mb-4">Editing: {strategyLogicData[isEditing].name}</h3>
                    <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                        <InputField label="Name" name="name" value={editFormData.name || ''} onChange={handleFormChange} />
                        <TextareaField label="Description" name="description" value={editFormData.description || ''} onChange={handleFormChange} rows={3} />
                        <TextareaField label="Core Logic Prompt" name="prompt" value={editFormData.prompt || ''} onChange={handleFormChange} rows={10} isMono />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SelectField label="Parent Strategy (for grouping)" name="parentId" value={editFormData.parentId || ''} onChange={handleFormChange} options={parentCandidateKeys.map(key => ({ value: key, label: strategyLogicData[key].name }))} />
                            <InputField label="Tags (comma-separated)" name="tags" value={(editFormData.tags || []).join(', ')} onChange={e => setEditFormData(prev => ({ ...prev, tags: e.target.value.split(',').map(t => t.trim()) }))} />
                        </div>
                    </div>
                    <div className="flex justify-end gap-4 mt-6 flex-shrink-0">
                        <button onClick={handleCancel} className="font-semibold py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-500 text-white">Cancel</button>
                        <button onClick={() => handleSave(isEditing)} className="font-semibold py-2 px-4 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900">Save Changes</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderDataManagement = () => (
        <div className="space-y-6">
            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <h4 className="font-semibold text-white mb-3">Backup & Restore</h4>
                <p className="text-sm text-gray-400 mb-4">Export all your local data (strategies, journal, settings) to a single file for backup or transfer to another device.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={handleExportData} disabled={isExporting} className="flex-1 font-semibold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-500">
                        {isExporting ? 'Exporting...' : 'Backup All Data'}
                    </button>
                    <button onClick={handleRestoreBackupClick} className="flex-1 font-semibold py-2 px-4 rounded-lg bg-green-600 hover:bg-green-500 text-white">
                        Restore from Backup
                    </button>
                    <input type="file" ref={backupFileInputRef} onChange={handleBackupFileChange} className="hidden" accept=".json,.zip" />
                </div>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <h4 className="font-semibold text-white mb-3">Market Data Feed (EODHD)</h4>
                {!apiConfig.eodhdApiKey ? (
                    <div className="space-y-2">
                        <p className="text-sm text-yellow-300">To fetch historical market data, please add your EODHD API key.</p>
                        <input
                            type="password"
                            placeholder="Enter EODHD API Key"
                            className="w-full bg-gray-800 border border-gray-600 p-2 rounded-md text-sm"
                            onChange={(e) => setApiConfig(prev => ({ ...prev, eodhdApiKey: e.target.value }))}
                        />
                    </div>
                ) : (
                    <>
                        {eodhdUsage && (
                            <div className="text-sm text-gray-400 mb-4 p-3 bg-gray-800 rounded-md border border-gray-700/50">
                                API Usage: <span className="font-bold text-white">{eodhdUsage.usedCalls || 0} / {eodhdUsage.dailyLimit || 'N/A'}</span> calls used.
                                {eodhdUsage.resetTimestamp && !isNaN(eodhdUsage.resetTimestamp) ? (
                                    <> Resets at <span className="font-bold text-white">{new Date(eodhdUsage.resetTimestamp * 1000).toLocaleTimeString()}</span>.</>
                                ) : ' Reset time unknown.'}
                            </div>
                        )}
                        <form onSubmit={handleFetchMarketData} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <label htmlFor="symbol" className="block text-xs font-medium text-gray-400">Symbol</label>
                                    <input list="symbols" id="symbol" value={marketDataForm.symbol} onChange={e => setMarketDataForm(p => ({ ...p, symbol: e.target.value.toUpperCase() }))} required className="mt-1 w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm" />
                                    <datalist id="symbols">
                                        {EODHD_SYMBOLS.map(s => <option key={s} value={s} />)}
                                    </datalist>
                                </div>
                                <div>
                                    <label htmlFor="timeframe" className="block text-xs font-medium text-gray-400">Timeframe</label>
                                    <select id="timeframe" value={marketDataForm.timeframe} onChange={e => setMarketDataForm(p => ({ ...p, timeframe: e.target.value }))} required className="mt-1 w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm">
                                        <option value="D">Daily</option>
                                        <option value="W">Weekly</option>
                                        <option value="M">Monthly</option>
                                        <option value="1h">1 Hour</option>
                                        <option value="5m">5 Minute</option>
                                        <option value="1m">1 Minute</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="from" className="block text-xs font-medium text-gray-400">From</label>
                                    <input type="date" id="from" value={marketDataForm.from} onChange={e => setMarketDataForm(p => ({ ...p, from: e.target.value }))} required className="mt-1 w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm" max={marketDataForm.to || today} />
                                </div>
                                <div>
                                    <label htmlFor="to" className="block text-xs font-medium text-gray-400">To</label>
                                    <input type="date" id="to" value={marketDataForm.to} onChange={e => setMarketDataForm(p => ({ ...p, to: e.target.value }))} required className="mt-1 w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm" min={marketDataForm.from} max={today} />
                                </div>
                            </div>
                            <button type="submit" disabled={isFetchingData} className="w-full font-semibold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-500">
                                {isFetchingData ? 'Fetching...' : 'Fetch & Cache Data'}
                            </button>
                            {fetchDataMessage && <p className={`text-sm text-center ${fetchDataMessage.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>{fetchDataMessage}</p>}
                        </form>
                    </>
                )}
            </div>

            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                <h4 className="font-semibold text-white mb-3">Cached Market Data</h4>
                <div className="max-h-96 overflow-y-auto pr-2 space-y-2">
                    {Object.keys(marketDataCache).length > 0 ? Object.entries(marketDataCache).map(([key, data]) => (
                        <div key={key} className="bg-gray-800 p-3 rounded-md flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-white">{key}</p>
                                <p className="text-xs text-gray-400">
                                    {/* SAFE CHECK ADDED: Ensure data is array before accessing length */}
                                    {Array.isArray(data) ? (data as MarketDataCandle[]).length : 0} candles
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setViewingChartData({ key, data: data as MarketDataCandle[] })} className="p-2 text-gray-400 hover:text-blue-400 rounded-full hover:bg-blue-500/10"><ViewIcon className="w-5 h-5" /></button>
                                <button onClick={() => setCacheKeyToDelete(key)} className="p-2 text-gray-500 hover:text-red-400 rounded-full hover:bg-red-500/10"><TrashIcon className="w-5 h-5" /></button>
                            </div>
                        </div>
                    )) : <p className="text-sm text-gray-500 text-center py-4">No data cached yet.</p>}
                </div>
            </div>
        </div>
    );

    const renderSettings = () => {
        return (
            <div className="space-y-6">
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                    <h4 className="font-semibold text-white mb-3">API Configuration</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block font-medium text-sm text-gray-300 mb-1">Gemini API Key</label>
                            <input
                                type="password"
                                value={localApiKeys.geminiApiKey}
                                onChange={(e) => setLocalApiKeys(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                                placeholder="Enter your Google Gemini API Key"
                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">Required for AI analysis. Your key is stored locally in your browser.</p>
                        </div>
                        <div>
                            <label className="block font-medium text-sm text-gray-300 mb-1">EODHD API Key (Optional)</label>
                            <input
                                type="password"
                                value={localApiKeys.eodhdApiKey}
                                onChange={(e) => setLocalApiKeys(prev => ({ ...prev, eodhdApiKey: e.target.value }))}
                                placeholder="Enter EODHD API Key for market data"
                                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSaveApiKeys}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
                            >
                                <CheckIcon className="w-4 h-4" /> Save API Keys
                            </button>
                            {saveSuccessMessage && (
                                <span className="text-green-400 text-sm font-medium animate-fadeIn flex items-center gap-1">
                                    <CheckIcon className="w-4 h-4" /> {saveSuccessMessage}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                    <h4 className="font-semibold text-white mb-3">Appearance</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block font-medium text-sm text-gray-300">UI Darkness: {userSettings.uiDarkness}</label>
                            <input
                                type="range"
                                name="uiDarkness"
                                min="-5"
                                max="5"
                                value={userSettings.uiDarkness}
                                onChange={(e) => onUserSettingsChange('uiDarkness', parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                            />
                            <p className="text-xs text-gray-500 mt-1">Adjust the background darkness intensity.</p>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                    <h4 className="font-semibold text-white mb-3">Legal & About</h4>
                    <div className="flex gap-4">
                        <button onClick={() => onOpenLegal('terms')} className="text-blue-400 hover:underline">Terms of Use</button>
                        <button onClick={() => onOpenLegal('privacy')} className="text-blue-400 hover:underline">Privacy Policy</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-6">Settings & Master Controls</h2>

            <div className="sticky top-[80px] z-30 bg-[hsl(var(--color-bg-900))] backdrop-blur-md -mx-4 md:-mx-6 px-4 md:px-6 border-b border-gray-700 shadow-md">
                <div className="overflow-x-auto mobile-tab-scroll">
                    <nav className="-mb-px flex space-x-6 min-w-max" aria-label="Tabs">
                        <TabButton name="strategies" activeTab={activeTab} setActiveTab={setActiveTab}>My Strategies</TabButton>
                        <TabButton name="settings" activeTab={activeTab} setActiveTab={setActiveTab}>Settings</TabButton>
                        <TabButton name="data" activeTab={activeTab} setActiveTab={setActiveTab}>Data Management</TabButton>
                        <TabButton name="manual" activeTab={activeTab} setActiveTab={setActiveTab}>User Manual</TabButton>
                    </nav>
                </div>
            </div>
            <style>{`
                /* Custom scrollbar for tab container on small screens */
                .mobile-tab-scroll::-webkit-scrollbar {
                    height: 4px;
                }
                .mobile-tab-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }
                .mobile-tab-scroll::-webkit-scrollbar-thumb {
                    background: #4b5563; /* gray-600 */
                    border-radius: 2px;
                }
            `}</style>

            <div className="mt-8 max-w-5xl mx-auto">
                {activeTab === 'strategies' && (
                    <div className="space-y-6">
                        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                            <h4 className="font-semibold text-white mb-3">Add New Strategy</h4>
                            <p className="text-sm text-gray-400 mb-2">Upload a PDF or text file containing your trading strategy, or paste the text directly. The AI will analyze it and create a new, usable logic blueprint.</p>
                            <div className="space-y-4">
                                {isCreatingStrategy ? (
                                    <div className="p-4 bg-gray-800 rounded-lg text-center">
                                        <Logo className="w-12 h-12 mx-auto mb-2" isLoading={true} />
                                        <p className="font-semibold text-yellow-300">Creating Strategy... ({creationProgress.step}/{creationProgress.total})</p>
                                        <p className="text-sm text-gray-400">{creationProgress.message}</p>
                                        <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
                                            <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: `${(creationProgress.step / creationProgress.total) * 100}%` }}></div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                                        <button onClick={() => fileInputRef.current?.click()} className="font-semibold py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:bg-gray-500 flex items-center justify-center gap-2">
                                            <UploadIcon className="w-5 h-5" /> Upload File (.pdf, .txt)
                                        </button>
                                        <button onClick={() => setIsPasteModalOpen(true)} className="font-semibold py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:bg-gray-500 flex items-center justify-center gap-2">
                                            <ClipboardIcon className="w-5 h-5" /> Paste Text Strategy
                                        </button>
                                    </div>
                                )}
                                <p className="text-sm text-gray-500 text-center sm:text-left">
                                    Unlimited strategy slots enabled.
                                </p>
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleStrategyFileChange} accept=".pdf,.txt,.md" className="hidden" />
                            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
                        </div>
                        {renderStrategyList()}
                    </div>
                )}
                {activeTab === 'settings' && renderSettings()}
                {activeTab === 'data' && renderDataManagement()}
                {activeTab === 'manual' && <UserManualView />}
            </div>

            {renderStrategyEditForm()}

            <ConfirmationModal
                isOpen={!!strategyToDelete}
                onConfirm={() => strategyToDelete && handleDeleteStrategy(strategyToDelete)}
                onCancel={() => setStrategyToDelete(null)}
                title="Confirm Deletion"
                message={`Are you sure you want to delete the "${strategyToDelete ? strategyLogicData[strategyToDelete]?.name : ''}" strategy? This action cannot be undone.`}
            />

            <ConfirmationModal
                isOpen={!!cacheKeyToDelete}
                onConfirm={() => { onRemoveMarketData(cacheKeyToDelete!); setCacheKeyToDelete(null); }}
                onCancel={() => setCacheKeyToDelete(null)}
                title="Confirm Deletion"
                message={`Are you sure you want to delete the cached data for "${cacheKeyToDelete}"?`}
            />

            {viewingChartData && (
                <InteractiveChartModal
                    isOpen={!!viewingChartData}
                    onClose={() => setViewingChartData(null)}
                    chartData={viewingChartData.data}
                    title={viewingChartData.key}
                />
            )}

            {isFinalizeModalOpen && pendingStrategy && (
                <div className="fixed inset-0 bg-gray-900/80 z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg border border-gray-700">
                        <h3 className="text-xl font-bold text-yellow-400 mb-4">Finalize New Strategy</h3>
                        <div className="space-y-4">
                            <InputField
                                label="Strategy Name"
                                name="name"
                                value={finalizeFormData.name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFinalizeFormData(prev => ({ ...prev, name: e.target.value }))}
                            />
                            <div>
                                <label className="flex items-center gap-3 text-sm text-gray-300">
                                    <input
                                        type="checkbox"
                                        name="generateCourse"
                                        checked={finalizeFormData.generateCourse}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFinalizeFormData(prev => ({ ...prev, generateCourse: e.target.checked }))}
                                        className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-yellow-500 focus:ring-yellow-500/50"
                                    />
                                    <span>Generate an interactive course for the Academy</span>
                                </label>
                            </div>
                        </div>
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={() => setIsFinalizeModalOpen(false)} className="font-semibold py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-500 text-white">Cancel</button>
                            <button onClick={handleFinalizeAndSaveStrategy} disabled={isFinalizing} className="font-semibold py-2 px-4 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900 disabled:bg-gray-500 flex items-center justify-center w-40">
                                {isFinalizing ? <><Logo className="w-5 h-5 mr-2" isLoading />Saving...</> : 'Save Strategy'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Paste Strategy Modal */}
            {isPasteModalOpen && (
                <div className="fixed inset-0 bg-gray-900/80 z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg border border-gray-700 flex flex-col max-h-[90vh]">
                        <h3 className="text-xl font-bold text-yellow-400 mb-4">Paste Strategy Text</h3>
                        <div className="space-y-4 flex-grow overflow-y-auto">
                            <InputField
                                label="Strategy Name (Optional)"
                                name="pasteName"
                                value={pasteName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPasteName(e.target.value)}
                            />
                            <TextareaField
                                label="Strategy Content"
                                name="pasteText"
                                value={pasteText}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPasteText(e.target.value)}
                                rows={10}
                            />
                        </div>
                        <div className="flex justify-end gap-4 mt-6 flex-shrink-0">
                            <button
                                onClick={() => { setIsPasteModalOpen(false); setPasteName(''); setPasteText(''); }}
                                className="font-semibold py-2 px-4 rounded-lg bg-gray-600 hover:bg-gray-500 text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePasteSubmit}
                                disabled={!pasteText.trim()}
                                className="font-semibold py-2 px-4 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-gray-900 disabled:bg-gray-500"
                            >
                                Create Strategy
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// --- SUB-COMPONENTS ---

const TabButton: React.FC<{ name: 'strategies' | 'settings' | 'data' | 'manual'; activeTab: 'strategies' | 'settings' | 'data' | 'manual'; setActiveTab: (name: 'strategies' | 'settings' | 'data' | 'manual') => void; children: React.ReactNode }> = ({ name, activeTab, setActiveTab, children }) => (
    <button onClick={() => setActiveTab(name)} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${activeTab === name ? 'border-yellow-400 text-yellow-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
        {children}
    </button>
);

const StrategyListItem: React.FC<{ strategy: StrategyLogicData; strategyKey: string; onEdit: (k: string) => void; setStrategyToDelete: (k: string) => void; onToggleEnable: (k: string) => void; isChild?: boolean }> = ({ strategy, strategyKey, onEdit, setStrategyToDelete, onToggleEnable, isChild }) => {
    const isEnabled = strategy.isEnabled ?? true;
    return (
        <div className={`flex items-center gap-2 p-2 rounded-md ${isChild ? 'bg-gray-800/50' : ''} group`}>
            <button onClick={() => onToggleEnable(strategyKey)} title={isEnabled ? "Disable Strategy" : "Enable Strategy"} className="p-1">
                {isEnabled ? <ToggleOnIcon className="w-6 h-6 text-green-400" /> : <ToggleOffIcon className="w-6 h-6 text-gray-500" />}
            </button>
            <div className="flex-grow">
                <p className={`font-semibold ${isEnabled ? 'text-white' : 'text-gray-500 line-through'}`}>{strategy.name}</p>
                <p className={`text-xs ${isEnabled ? 'text-gray-400' : 'text-gray-600'}`}>{strategy.description.substring(0, 100)}...</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(strategyKey)} className="p-2 text-gray-400 hover:text-yellow-400 rounded-full hover:bg-yellow-500/10"><EditIcon className="w-5 h-5" /></button>
                <button onClick={() => setStrategyToDelete(strategyKey)} className="p-2 text-gray-500 hover:text-red-400 rounded-full hover:bg-red-500/10"><TrashIcon className="w-5 h-5" /></button>
            </div>
        </div>
    );
};


const InputField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string }> = ({ label, name, value, onChange, type = 'text' }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-300">{label}</label>
        <input type={type} name={name} id={name} value={value} onChange={onChange} className="mt-1 w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm" />
    </div>
);
const TextareaField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; rows: number; isMono?: boolean }> = ({ label, name, value, onChange, rows, isMono }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-300">{label}</label>
        <textarea name={name} id={name} value={value} onChange={onChange} rows={rows} className={`mt-1 w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm ${isMono ? 'font-mono' : ''}`} />
    </div>
);
const SelectField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: string; label: string }[] }> = ({ label, name, value, onChange, options }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-300">{label}</label>
        <select name={name} id={name} value={value} onChange={onChange} className="mt-1 w-full bg-gray-700 border border-gray-600 p-2 rounded-md text-sm">
            <option value="">None</option>
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);
