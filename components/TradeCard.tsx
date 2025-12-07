
import React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Trade, TradeFeedback, SavedTrade, UserSettings, StrategyKey, StrategyLogicData, TradeOutcome } from '../types';
import HeatMeter from './HeatMeter';

import html2canvas from 'html2canvas';
import InteractiveChartModal from './InteractiveChartModal';

interface TradeCardProps {
    trade: Trade | SavedTrade;
    userSettings: UserSettings;
    isModified?: boolean;
    strategyLogicData: Record<StrategyKey, StrategyLogicData>;
    activeStrategies?: StrategyKey[];
    onSave?: (trade: Trade) => void;
    isSaved?: boolean;
    feedback?: TradeFeedback;
    onFeedbackChange?: (feedback: TradeFeedback) => void;
    isSubmittingFeedback?: boolean;
    onRemove?: () => void;
    onViewAndDiscussTrade?: () => void;
    onAddResultImage?: () => void;
    onViewImages?: () => void;
    onViewCoachingLog?: () => void;
    councilDiscussion?: string;
}

const TRADE_CARD_ANIMATION_STYLE_ID = 'tradecard-animations';

const ensureAnimationStyles = () => {
    if (typeof document === 'undefined' || document.getElementById(TRADE_CARD_ANIMATION_STYLE_ID)) {
        return;
    }
    const styleElement = document.createElement('style');
    styleElement.id = TRADE_CARD_ANIMATION_STYLE_ID;
    styleElement.innerHTML = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn {
      animation: fadeIn 0.3s ease-out;
    }
    /* Custom Scrollbar for Council Transcript */
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(139, 92, 246, 0.3);
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(139, 92, 246, 0.5);
    }
  `;
    document.head.appendChild(styleElement);
};

const extractPrice = (priceString: string | number): number => {
    if (typeof priceString === 'number') return priceString;
    if (!priceString) return NaN;

    // 1. Try direct parsing first (handles simple "91750.0")
    const directParse = parseFloat(String(priceString).replace(/,/g, ''));
    if (!isNaN(directParse) && isFinite(directParse) && !String(priceString).includes(' ')) {
        return directParse;
    }

    // 2. Robust extraction
    const cleanString = String(priceString)
        .replace(/<[^>]*>/g, ' ') // Remove HTML
        .replace(/&nbsp;/g, ' ')  // Remove non-breaking spaces
        .trim();

    // Match all number-like sequences (e.g. 123, 123.45, 1,234.56)
    const matches = cleanString.match(/(\d{1,3}(,\d{3})*(\.\d+)?|\d+(\.\d+)?)/g);

    if (!matches) return NaN;

    // Parse all found numbers
    const validNumbers = matches
        .map(m => parseFloat(m.replace(/,/g, '')))
        .filter(n => !isNaN(n) && isFinite(n));

    if (validNumbers.length === 0) return NaN;

    // Return the last valid number found (heuristic for "TP1: 100")
    return validNumbers[validNumbers.length - 1];
};

const formatStrategyName = (name: string = ''): string => name.replace(/^\d+-/, '').replace(/-/g, ' ');

const InfoIcon = (props: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
);

const AddResultImageIcon = (props: { className?: string }) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v5.034a.75.75 0 0 1-1.5 0V5.25a.75.75 0 0 0-.75-.75H3.25a.75.75 0 0 0-.75.75v9.5c0 .414.336.75.75.75h5.034a.75.75 0 0 1 0 1.5H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Z" />
        <path d="m3.25 12.25 2.47-2.47a.75.75 0 0 1 1.06 0l2.22 2.22 1.53-2.04a.75.75 0 0 1 1.2 0l2.75 3.667a.75.75 0 0 1-.98 1.133L13.5 13.62l-1.53 2.04a.75.75 0 0 1-1.2 0L8.28 13.2l-2.47 2.47a.75.75 0 0 1-1.06 0l-1.5-1.5a.75.75 0 0 1 0-1.06Z" />
        <path d="M14 12.25a.75.75 0 0 1 .75.75v1.25h1.25a.75.75 0 0 1 0 1.5h-1.25v1.25a.75.75 0 0 1-1.5 0v-1.25h-1.25a.75.75 0 0 1 .75-.75Z" />
    </svg>
);

const ClipboardIcon = (props: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
    </svg>
);

const CheckIcon = (props: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);

const CopyButton = ({ text, className }: { text: string | undefined | null, className?: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!text) return;

        try {
            // Strip HTML tags if present and ensure it's a string
            const cleanText = String(text).replace(/<[^>]*>/g, '').trim();
            await navigator.clipboard.writeText(cleanText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text:', err);
            // Optional: Show a toast or visual feedback for failure
        }
    };

    if (!text) return null; // Don't render button if no text

    return (
        <button onClick={handleCopy} className={`text-gray-500 hover:text-white transition-colors p-1 rounded hover:bg-gray-700 ${className}`} title="Copy to clipboard">
            {copied ? <CheckIcon className="w-3 h-3 text-green-400" /> : <ClipboardIcon className="w-3 h-3" />}
        </button>
    );
};

const EditIcon = (props: { className?: string }) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
        <path d="M5.433 13.917l1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918a4 4 0 0 1-1.343.885l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
        <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
    </svg>
);

const OUTCOME_BUTTONS: { outcome: TradeOutcome; label: string; color: string }[] = [
    { outcome: 'TP1 & TP2', label: 'TP1 & TP2', color: 'green' },
    { outcome: 'TP1 -> B/E', label: 'TP1 > B/E', color: 'green' },
    { outcome: 'TP1', label: 'TP1', color: 'green' },
    { outcome: 'B/E', label: 'B/E', color: 'blue' },
    { outcome: 'SL', label: 'SL', color: 'red' },
];

const TradeCard: React.FC<TradeCardProps> = ({
    trade,
    userSettings,
    isModified,
    onSave,
    isSaved,
    feedback,
    onFeedbackChange,
    isSubmittingFeedback,
    onRemove,
    onViewAndDiscussTrade,
    onAddResultImage,
    onViewImages,
    onViewCoachingLog,
    strategyLogicData,
    activeStrategies,
    councilDiscussion,
}) => {
    const isLong = trade.direction === 'Long';
    const [isExplanationOpen, setIsExplanationOpen] = useState(!onSave || isSaved);
    const [isEntryExplanationVisible, setIsEntryExplanationVisible] = useState(false);
    const [isCouncilOpen, setIsCouncilOpen] = useState(false);
    const [feedbackText, setFeedbackText] = useState(feedback?.text || '');
    const isCoachingTrade = 'isFromCoaching' in trade && trade.isFromCoaching;
    const cardRef = useRef<HTMLDivElement>(null);
    const shareCardRef = useRef<HTMLDivElement>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [isChartOpen, setIsChartOpen] = useState(false);

    const handleShareCard = async () => {
        if (!shareCardRef.current) return;

        setIsSharing(true);
        try {
            // 1. Copy Trade Details to Clipboard
            const tradeDetailsText = `🚀 TRADE SETUP: ${trade.symbol || 'ASSET'} (${trade.direction})
Entry: ${trade.entry}
SL: ${trade.stopLoss}
TP1: ${trade.takeProfit1}
TP2: ${trade.takeProfit2 || 'N/A'}
R:R: 1:${rr.toFixed(2)}`;

            try {
                await navigator.clipboard.writeText(tradeDetailsText);
                // We'll notify the user about this in the final alert/toast
            } catch (clipboardErr) {
                console.warn('Failed to copy trade details to clipboard:', clipboardErr);
            }

            // 2. Capture the simplified share card as canvas
            const canvas = await html2canvas(shareCardRef.current, {
                backgroundColor: '#1f2937', // Match the card background
                scale: 2, // Higher quality
                logging: false,
                useCORS: true,
            });

            // 3. Convert canvas to blob and Share/Download
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    alert('Failed to generate image');
                    setIsSharing(false);
                    return;
                }

                const file = new File([blob], `trade-${trade.symbol || 'call'}-${Date.now()}.png`, { type: 'image/png' });

                // Check if Web Share API is available
                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            files: [file],
                            title: `${trade.symbol} - ${trade.direction} Trade Call`,
                            text: tradeDetailsText // Try to pass text to the native share sheet too
                        });
                    } catch (err) {
                        if ((err as Error).name !== 'AbortError') {
                            // Fallback to download if share was not aborted by user
                            downloadImage(canvas);
                            alert("Trade card downloaded! Trade details have also been copied to your clipboard.");
                        }
                    }
                } else {
                    // Fallback: download the image
                    downloadImage(canvas);
                    alert("Trade card downloaded! Trade details have also been copied to your clipboard.");
                }
                setIsSharing(false);
            }, 'image/png');
        } catch (error) {
            console.error('Error sharing card:', error);
            alert('Failed to share trade card');
            setIsSharing(false);
        }
    };

    const downloadImage = (canvas: HTMLCanvasElement) => {
        const link = document.createElement('a');
        link.download = `trade-${trade.symbol || 'call'}-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const rr = useMemo(() => {
        const entry = extractPrice(trade.entry);
        const sl = extractPrice(trade.stopLoss);
        const tp1 = extractPrice(trade.takeProfit1);

        if (isNaN(entry) || isNaN(sl) || isNaN(tp1)) return 0;

        const risk = Math.abs(entry - sl);
        const reward = Math.abs(tp1 - entry);

        if (risk === 0) return 0; // Avoid division by zero

        return reward / risk;
    }, [trade.entry, trade.stopLoss, trade.takeProfit1]);

    const rrColor = useMemo(() => {
        if (rr >= 2) return 'text-green-400';
        if (rr >= 1) return 'text-yellow-400';
        return 'text-red-400';
    }, [rr]);

    const isEntryDescriptive = useMemo(() => String(trade.entry || '').includes(' '), [trade.entry]);
    const isSlDescriptive = useMemo(() => String(trade.stopLoss || '').includes(' '), [trade.stopLoss]);

    useEffect(() => { ensureAnimationStyles(); }, []);
    useEffect(() => { setFeedbackText(feedback?.text || ''); }, [feedback?.text]);

    const handleToggleExplanation = () => setIsExplanationOpen(prev => !prev);

    const handleOutcomeChange = (newOutcome: TradeOutcome) => {
        if (!onFeedbackChange || isSubmittingFeedback) return;
        onFeedbackChange({ outcome: newOutcome, text: feedbackText });
    };

    const handleSubmitFeedback = () => {
        if (!onFeedbackChange || !feedback?.outcome || isSubmittingFeedback) return;
        onFeedbackChange({ outcome: feedback.outcome, text: feedbackText });
    };

    const titleSymbol = trade.symbol && trade.symbol !== "N/A" ? `${trade.symbol}` : "ASSET";
    const showFeedbackSection = !!onFeedbackChange;
    const hasResultImage = 'resultImageKey' in trade && !!trade.resultImageKey;

    const displayStrategies = 'strategiesUsed' in trade ? trade.strategiesUsed : (activeStrategies || []);
    const formattedStrategies = displayStrategies.map(s => formatStrategyName(strategyLogicData[s]?.name || s)).join(', ');

    // -- EXPLANATION SEGMENT PARSING --
    // We expect the AI to output segments separated by "|||".
    // If found, we render specific titled boxes. If not, we render the legacy text block.
    const explanationSegments = useMemo(() => {
        if (!trade.explanation) return [];
        return trade.explanation.split('|||').map(seg => seg.trim()).filter(Boolean);
    }, [trade.explanation]);

    const isSegmented = explanationSegments.length >= 2; // Assume structured if at least 2 parts found.

    return (
        <>
            <div ref={cardRef} className="bg-[hsl(var(--color-bg-800))] border border-[hsl(var(--color-border-700))] rounded-lg p-4 flex flex-col h-full">
                <div className="space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="flex-grow space-y-1">
                            <div className="flex items-center space-x-2 flex-wrap">
                                <h3 className={`font-bold ${isLong ? 'text-teal-400' : 'text-red-400'}`} style={{ fontSize: `${userSettings.headingFontSize}px` }}>
                                    {titleSymbol} <span>-</span> {(trade.direction || 'UNKNOWN').toUpperCase()}
                                </h3>
                                {isModified && <span className="px-2 py-0.5 text-xs font-semibold bg-purple-600 text-purple-100 rounded-full">MODIFIED</span>}
                            </div>
                            {'savedDate' in trade ? (
                                <p className="text-xs text-gray-500">Journaled: {new Date(trade.savedDate).toLocaleString()}</p>
                            ) : (
                                <p className="text-xs text-gray-500">Generated Just Now</p>
                            )}
                        </div>
                        {onSave && (
                            <button onClick={() => onSave(trade)} disabled={isSaved} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${isSaved ? 'bg-green-600 text-white cursor-default' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
                                {isSaved ? 'Saved ✔' : 'Save Trade'}
                            </button>
                        )}
                    </div>

                    <HeatMeter level={trade.heat} />

                    {displayStrategies.length > 0 && (
                        <div className="p-2 bg-[hsl(var(--color-bg-900)/0.5)] rounded-md border border-[hsl(var(--color-border-700)/0.5)] text-xs">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-gray-400">
                                <span className="truncate">
                                    <span className="font-semibold text-gray-300">Strategy: </span>
                                    <span className="text-purple-300" title={formattedStrategies}>{formattedStrategies}</span>
                                </span>
                                {('analysisContext' in trade) && (trade as SavedTrade).analysisContext.realTimeContextWasUsed && (
                                    <span className="text-green-400 flex items-center flex-shrink-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        Real-Time
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <div className="col-span-2 text-left">
                            <p className="text-gray-400 uppercase font-semibold" style={{ fontSize: `${userSettings.uiFontSize - 2}px` }}>Entry</p>
                            <div className="flex items-center justify-center gap-2 mt-1">
                                <div className={`${isEntryDescriptive ? '' : 'font-mono text-center'} font-bold text-white`} style={{ fontSize: `${isEntryDescriptive ? userSettings.dataFontSize - 2 : userSettings.dataFontSize}px`, lineHeight: isEntryDescriptive ? '1.5' : '1' }} dangerouslySetInnerHTML={{ __html: trade.entry || '-' }} />
                                <CopyButton text={trade.entry} />
                            </div>
                            <div className={`mt-1 flex items-center ${isEntryDescriptive ? 'justify-start' : 'justify-center'} space-x-2`}>
                                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${trade.entryType === 'Limit Order' ? 'bg-blue-600 text-blue-100' : 'bg-orange-600 text-orange-100'}`}>{trade.entryType}</span>
                                {trade.entryType === 'Confirmation Entry' && trade.entryExplanation && (
                                    <div className="relative">
                                        <button onMouseEnter={() => setIsEntryExplanationVisible(true)} onMouseLeave={() => setIsEntryExplanationVisible(false)} className="text-gray-400 hover:text-yellow-300"><InfoIcon className="w-4 h-4" /></button>
                                        {isEntryExplanationVisible && (
                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-[240px] bg-[hsl(var(--color-bg-900))] text-white rounded-lg py-2 px-3 z-10 border border-[hsl(var(--color-border-600))] shadow-lg text-left animate-fadeIn whitespace-normal" style={{ fontSize: `${userSettings.uiFontSize - 1}px` }}>{trade.entryExplanation}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="col-span-2 text-left">
                            <p className="text-red-400 uppercase font-semibold" style={{ fontSize: `${userSettings.uiFontSize - 2}px` }}>Stop Loss</p>
                            <div className="flex items-center justify-center gap-2 mt-1">
                                <div className={`${isSlDescriptive ? '' : 'font-mono text-center'} font-bold text-white`} style={{ fontSize: `${isSlDescriptive ? userSettings.dataFontSize - 2 : userSettings.dataFontSize}px`, lineHeight: isSlDescriptive ? '1.5' : '1' }} dangerouslySetInnerHTML={{ __html: trade.stopLoss || '-' }} />
                                <CopyButton text={trade.stopLoss} />
                            </div>
                        </div>
                        <div className="col-span-2 text-center py-2 my-1 border-y-2 border-[hsl(var(--color-border-700)/0.5)]">
                            <p className={`font-mono font-bold ${rrColor}`} style={{ fontSize: `${userSettings.dataFontSize + 8}px` }}>{rr.toFixed(2)} : 1</p>
                            <p className="text-gray-400 uppercase font-semibold" style={{ fontSize: `${userSettings.uiFontSize - 2}px` }}>Risk / Reward Ratio <span className="normal-case">(to TP1)</span></p>
                        </div>
                        <div className="text-center">
                            <p className="text-green-400 uppercase font-semibold" style={{ fontSize: `${userSettings.uiFontSize - 2}px` }}>TP 1</p>
                            <div className="flex items-center justify-center gap-2">
                                <p className="font-mono font-bold text-white" style={{ fontSize: `${userSettings.dataFontSize}px` }} dangerouslySetInnerHTML={{ __html: trade.takeProfit1 }} />
                                <CopyButton text={trade.takeProfit1} />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-green-400 uppercase font-semibold" style={{ fontSize: `${userSettings.uiFontSize - 2}px` }}>TP 2</p>
                            <div className="flex items-center justify-center gap-2">
                                <p className="font-mono font-bold text-white" style={{ fontSize: `${userSettings.dataFontSize}px` }} dangerouslySetInnerHTML={{ __html: trade.takeProfit2 }} />
                                <CopyButton text={trade.takeProfit2} />
                            </div>
                        </div>
                    </div>

                    {trade.tradeManagement && (
                        <div className="text-gray-300 bg-[hsl(var(--color-bg-900)/0.5)] p-3 rounded-md border border-[hsl(var(--color-border-700)/0.5)] mt-1" style={{ fontSize: `${userSettings.uiFontSize}px` }}>
                            <h5 className="font-semibold text-gray-200 mb-1">Trade Management Plan:</h5>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                                <li dangerouslySetInnerHTML={{ __html: trade.tradeManagement.partial_take_profit_1 }}></li>
                                <li dangerouslySetInnerHTML={{ __html: trade.tradeManagement.move_to_breakeven_condition }}></li>
                            </ul>
                        </div>
                    )}

                    <div>
                        <div
                            className="flex items-center cursor-pointer select-none"
                            onClick={handleToggleExplanation}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExplanationOpen}
                        >
                            <p className="text-xs text-gray-400 font-semibold mb-1">Analysis Reasoning:</p>
                            <span className="ml-2 text-yellow-400 transition-transform duration-200" style={{ transform: isExplanationOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                        </div>

                        {isExplanationOpen && (
                            <div className="animate-fadeIn mt-2 space-y-2">
                                {isSegmented ? (
                                    <>
                                        {/* 1. Strategy Match Box */}
                                        <div className="bg-blue-900/10 border border-blue-500/30 rounded-md p-2">
                                            <div className="text-blue-300 text-[10px] font-bold uppercase tracking-wider mb-0.5">Strategy Match</div>
                                            <div className="text-gray-300 text-xs leading-relaxed">{explanationSegments[0].replace(/Strategy Match:?/i, '').trim()}</div>
                                        </div>

                                        {/* 2. Evidence Box */}
                                        {explanationSegments[1] && (
                                            <div className="bg-yellow-900/10 border border-yellow-500/30 rounded-md p-2">
                                                <div className="text-yellow-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Chart Evidence</div>
                                                <div className="text-gray-300 text-xs leading-relaxed">{explanationSegments[1].replace(/Evidence:?/i, '').trim()}</div>
                                            </div>
                                        )}

                                        {/* 3. Execution/Risk Box */}
                                        {explanationSegments[2] && (
                                            <div className="bg-red-900/10 border border-red-500/30 rounded-md p-2">
                                                <div className="text-red-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Execution & Risk</div>
                                                <div className="text-gray-300 text-xs leading-relaxed">{explanationSegments[2].replace(/Execution & Risk:?/i, '').trim()}</div>
                                            </div>
                                        )}

                                        {/* 4. Data Synergy Box (New) */}
                                        {trade.dataSynergy && (
                                            <div className="bg-purple-900/10 border border-purple-500/30 rounded-md p-2">
                                                <div className="text-purple-400 text-[10px] font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                    </svg>

                                                    Live Data Synergy
                                                </div>
                                                <div className="text-gray-300 text-xs leading-relaxed">{trade.dataSynergy}</div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    // Legacy Fallback for older trades without segmentation
                                    <div
                                        className="text-gray-300 bg-[hsl(var(--color-bg-900)/0.5)] p-3 rounded-md border border-[hsl(var(--color-border-700)/0.5)] mt-1 prose prose-sm prose-invert max-w-none"
                                        style={{ fontSize: `${userSettings.uiFontSize}px` }}
                                        dangerouslySetInnerHTML={{ __html: trade.explanation }}
                                    ></div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Council Discussion Section */}
                    {councilDiscussion && (
                        <div className="mt-2">
                            <div
                                className="flex items-center cursor-pointer select-none"
                                onClick={() => setIsCouncilOpen(!isCouncilOpen)}
                                role="button"
                                tabIndex={0}
                                aria-expanded={isCouncilOpen}
                            >
                                <p className="text-xs text-purple-400 font-semibold mb-1">Council Discussion:</p>
                                <span className="ml-2 text-purple-400 transition-transform duration-200" style={{ transform: isCouncilOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                            </div>

                            {isCouncilOpen && (
                                <div className="animate-fadeIn mt-2 bg-purple-900/10 border border-purple-500/30 rounded-md p-3">
                                    <div className="space-y-4">
                                        {(() => {
                                            // Parse the transcript
                                            const opinions = councilDiscussion.split('------------------------------------------------').filter(s => s.trim().length > 0);
                                            const parsedOpinions = opinions.map(opinionBlock => {
                                                const match = opinionBlock.match(/--- OPINION FROM (.*?) ---\s*([\s\S]*)/);
                                                if (!match) return null;
                                                const provider = match[1].trim();
                                                const content = match[2].trim();

                                                let parsedContent: any = null;
                                                try {
                                                    // Try to find JSON block
                                                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                                                    if (jsonMatch) {
                                                        parsedContent = JSON.parse(jsonMatch[0]);
                                                    }
                                                } catch (e) {
                                                    // Failed to parse JSON, keep as string
                                                }

                                                return { provider, content, parsedContent };
                                            }).filter(Boolean);

                                            if (parsedOpinions.length === 0) {
                                                // Fallback to raw text if parsing fails completely
                                                return (
                                                    <div className="text-gray-300 text-xs leading-relaxed whitespace-pre-wrap font-mono max-h-60 overflow-y-auto custom-scrollbar">
                                                        {councilDiscussion}
                                                    </div>
                                                );
                                            }

                                            return parsedOpinions.map((op, idx) => (
                                                <div key={idx} className="bg-purple-900/20 rounded-md p-3 border border-purple-500/20">
                                                    <h5 className="text-purple-300 text-xs font-bold uppercase mb-2 border-b border-purple-500/20 pb-1">{op?.provider}</h5>

                                                    {op?.parsedContent ? (
                                                        <div className="space-y-2">
                                                            {/* Reasoning */}
                                                            {op.parsedContent.strategySuggestion?.reasoning && (
                                                                <div>
                                                                    <span className="text-gray-400 text-[10px] uppercase font-semibold">Reasoning:</span>
                                                                    <p className="text-gray-300 text-xs mt-0.5 leading-relaxed">{op.parsedContent.strategySuggestion.reasoning}</p>
                                                                </div>
                                                            )}

                                                            {/* Found Trades Summary */}
                                                            {(() => {
                                                                const longs = op.parsedContent['Top Longs'] || [];
                                                                const shorts = op.parsedContent['Top Shorts'] || [];
                                                                const allTrades = [...longs.map((t: any) => ({ ...t, dir: 'Long' })), ...shorts.map((t: any) => ({ ...t, dir: 'Short' }))];

                                                                if (allTrades.length > 0) {
                                                                    return (
                                                                        <div className="mt-2">
                                                                            <span className="text-gray-400 text-[10px] uppercase font-semibold">Proposed Setups:</span>
                                                                            <ul className="mt-1 space-y-1">
                                                                                {allTrades.map((t: any, tIdx: number) => (
                                                                                    <li key={tIdx} className="text-xs text-gray-300 flex items-center gap-2 bg-black/20 p-1.5 rounded">
                                                                                        <span className={`font-bold ${t.dir === 'Long' ? 'text-green-400' : 'text-red-400'}`}>{t.dir}</span>
                                                                                        <span className="font-mono text-gray-400">{t.symbol || 'Asset'}</span>
                                                                                        <span className="text-gray-500">@</span>
                                                                                        <span className="font-mono text-white">{t.entry}</span>
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                    );
                                                                } else {
                                                                    return (
                                                                        <div className="mt-2 text-xs text-gray-500 italic">No valid setups found.</div>
                                                                    );
                                                                }
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <p className="text-gray-300 text-xs whitespace-pre-wrap">{op?.content}</p>
                                                    )}
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-grow"></div>

                {showFeedbackSection && (
                    <div className="pt-4 mt-4 border-t border-[hsl(var(--color-border-700)/0.5)]">
                        <div className="space-y-3">
                            <h4 className="font-semibold text-gray-300 text-center" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Log Trade Outcome</h4>

                            <div className="flex flex-wrap gap-2 justify-center">
                                {OUTCOME_BUTTONS.map(({ outcome, label, color }) => {
                                    const isSelected = feedback?.outcome === outcome;
                                    const colorClasses = {
                                        green: `bg-green-500/20 border-green-500 text-green-300`,
                                        red: `bg-red-500/20 border-red-500 text-red-300`,
                                        blue: `bg-blue-500/20 border-blue-500 text-blue-300`,
                                    };
                                    return (
                                        <button
                                            key={outcome}
                                            onClick={() => handleOutcomeChange(outcome)}
                                            disabled={isSubmittingFeedback}
                                            className={`flex-grow p-2 rounded-md border-2 transition-colors text-xs font-semibold disabled:opacity-50 ${isSelected ? colorClasses[color as keyof typeof colorClasses] : 'bg-[hsl(var(--color-bg-700)/0.5)] border-[hsl(var(--color-border-600))] text-gray-400 hover:border-gray-500'}`}
                                            aria-pressed={isSelected}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="space-y-2 animate-fadeIn">
                                <textarea
                                    value={feedbackText}
                                    onChange={(e) => setFeedbackText(e.target.value)}
                                    onBlur={handleSubmitFeedback}
                                    placeholder="Optional: Add journaling notes..."
                                    rows={2}
                                    className="w-full bg-[hsl(var(--color-bg-900)/0.7)] p-2 rounded-md text-gray-300 border border-[hsl(var(--color-border-600))] focus:ring-yellow-500 focus:border-yellow-500 transition-colors disabled:opacity-50"
                                    style={{ fontSize: `${userSettings.uiFontSize}px` }}
                                    disabled={isSubmittingFeedback}
                                />
                            </div>

                            {/* Interactive Chart Modal */}
                            {trade.symbol && (trade as any).timeframe && (
                                <InteractiveChartModal
                                    isOpen={isChartOpen}
                                    onClose={() => setIsChartOpen(false)}
                                    symbol={trade.symbol}
                                    timeframe={(trade as any).timeframe}
                                    trade={trade}
                                />
                            )}
                            {/* Hidden Simplified Share Card - Only used for capturing/sharing */}
                            <div
                                ref={shareCardRef}
                                className="fixed -left-[9999px] top-0 w-[600px]"
                                style={{ position: 'fixed', left: '-9999px' }}
                            >
                                <div className="bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-yellow-500/50 rounded-xl p-8 shadow-2xl">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <h2 className={`text-4xl font-bold ${isLong ? 'text-green-400' : 'text-red-400'}`}>
                                                {trade.symbol || 'ASSET'}
                                            </h2>
                                            <span className={`px-4 py-2 rounded-lg font-bold text-xl ${isLong ? 'bg-green-500/20 text-green-300 border border-green-500/50' : 'bg-red-500/20 text-red-300 border border-red-500/50'}`}>
                                                {trade.direction?.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm text-gray-400">Risk:Reward</div>
                                            <div className="text-3xl font-bold text-yellow-400">1:{rr.toFixed(2)}</div>
                                        </div>
                                    </div>

                                    {/* Heat Meter */}
                                    <div className="mb-6">
                                        <HeatMeter level={trade.heat} />
                                    </div>

                                    {/* Trade Details Grid */}
                                    <div className="space-y-4">
                                        {/* Entry */}
                                        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                                            <div className="text-sm text-gray-400 mb-1">Entry Price</div>
                                            <div className="text-2xl font-bold text-white">{trade.entry}</div>
                                            <div className="text-xs text-gray-500 mt-1">{trade.entryType}</div>
                                        </div>

                                        {/* Stop Loss */}
                                        <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/30">
                                            <div className="text-sm text-red-300 mb-1">Stop Loss</div>
                                            <div className="text-2xl font-bold text-red-400">{trade.stopLoss}</div>
                                        </div>

                                        {/* Take Profits */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-green-900/20 rounded-lg p-4 border border-green-500/30">
                                                <div className="text-sm text-green-300 mb-1">Take Profit 1</div>
                                                <div className="text-2xl font-bold text-green-400">{trade.takeProfit1}</div>
                                            </div>
                                            <div className="bg-green-900/20 rounded-lg p-4 border border-green-500/30">
                                                <div className="text-sm text-green-300 mb-1">Take Profit 2</div>
                                                <div className="text-2xl font-bold text-green-400">{trade.takeProfit2 || 'N/A'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="mt-6 pt-4 border-t border-gray-700 text-center">
                                        <div className="text-xs text-gray-500">Generated by Insight Trader AI</div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default TradeCard;
