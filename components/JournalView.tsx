
// ... (Previous imports and components remain the same until JournalView main component)
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { SavedTrade, TradeFeedback, StrategyLogicData, StrategyKey, SavedCoachingSession, ChatMessage, TradeOutcome, UserSettings, SavedAssetComparison, AssetComparisonResult } from '../types';
import TradeCard from './TradeCard';
import PerformanceChart from './PerformanceChart';
import ConfirmationModal from './ConfirmationModal';
import ImageViewerModal from './ImageViewerModal';
import OracleIcon from './OracleIcon';
import ScreenCaptureModal from './ScreenCaptureModal';
import { getImage, storeImage } from '../idb';

// ... (Helper components: TrashIcon, ContinueIcon, UploadIcon, ScreenIcon, HeatMeter, ChatMessageImage, IdbImage, ExpandIcon, CompressIcon, ScreenCaptureModal - keep unchanged)
const TrashIcon = (props:{className?:string}) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 1 0 .214 1.482l.025.007c.786.246 1.573.393 2.37.468v6.618A2.75 2.75 0 0 0 8.75 18h2.5A2.75 2.75 0 0 0 14 15.25V5.162c.797-.075 1.585-.222 2.37-.468a.75.75 0 1 0-.214-1.482l-.025-.007a33.58 33.58 0 0 0-2.365-.468V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V15.25a1.25 1.25 0 0 1-1.25 1.25h-2.5A1.25 1.25 0 0 1 7.5 15.25V4.075C8.327 4.025 9.16 4 10 4Z" clipRule="evenodd" /></svg>;
const ContinueIcon = (props:{className?:string}) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" /></svg>;
const UploadIcon = (props: {className?: string}) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 0 0 1.09 1.03L9.25 4.636V13.25Z" /><path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" /></svg>;
const ScreenIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.25 3A2.25 2.25 0 0 0 1 5.25v9.5A2.25 2.25 0 0 0 3.25 17h13.5A2.25 2.25 0 0 0 19 14.75v-9.5A2.25 2.25 0 0 0 16.75 3H3.25Zm12.5 11.5H4.25a.75.75 0 0 1-.75-.75V6.25a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 .75.75v8.5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>;
const HeatMeter: React.FC<{ level: number; }> = ({ level }) => {
    const colors = ['bg-gray-600', 'bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-green-500', 'bg-teal-400'];
    return (
        <div className="flex items-center space-x-1">
            <span className="text-xs font-medium text-gray-400">Heat:</span>
            <div className="flex space-x-1">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`w-3 h-4 rounded-sm ${i < level ? colors[Math.min(level, colors.length - 1)] : 'bg-gray-700'}`}></div>
                ))}
            </div>
        </div>
    );
};

const ChatMessageImage: React.FC<{ imageKey: string }> = ({ imageKey }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        getImage(imageKey).then(url => {
            if (isMounted && url) setImageUrl(url);
        });
        return () => { isMounted = false; };
    }, [imageKey]);

    const handleImageClick = () => {
        if (!imageUrl) return;
        const win = window.open();
        win?.document.write(`<body style="margin:0; background: #111827;"><img src="${imageUrl}" style="max-width: 100%; max-height: 100vh; margin: auto; display: block;"></body>`);
    };

    if (!imageUrl) {
        return <div className="animate-pulse bg-gray-600 rounded-md w-full h-32 my-2"></div>;
    }

    return (
        <img
            src={imageUrl}
            alt="Chat image"
            className="max-w-xs rounded-md my-2 cursor-pointer transition-transform hover:scale-105"
            onClick={handleImageClick}
        />
    );
};

const IdbImage: React.FC<{ imageKey: string, className?: string }> = ({ imageKey, className }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    useEffect(() => {
        let isMounted = true;
        getImage(imageKey).then(url => {
            if (isMounted && url) setImageUrl(url);
        });
        return () => { isMounted = false; };
    }, [imageKey]);

    if (!imageUrl) return <div className={`animate-pulse bg-gray-700 rounded-md ${className}`}></div>;

    return <img src={imageUrl} alt="Journaled asset" className={className} />;
}

const ExpandIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" /><path fillRule="evenodd" d="M.22 10a.75.75 0 0 1 .75-.75h18.06a.75.75 0 0 1 0 1.5H.97a.75.75 0 0 1-.75-.75ZM9.25 4.122a.75.75 0 0 1 1.5 0v11.756a.75.75 0 0 1-1.5 0V4.122ZM10 .22a.75.75 0 0 1 .75.75v18.06a.75.75 0 0 1-1.5 0V.97a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" /></svg>;
const CompressIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M6.22 8.22a.75.75 0 0 1 1.06 0l1.97 1.97V6.75a.75.75 0 0 1 1.5 0v4.5a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1 0-1.5h3.44L6.22 9.28a.75.75 0 0 1 0-1.06Z" /><path d="M13.78 11.78a.75.75 0 0 1-1.06 0l-1.97-1.97v3.44a.75.75 0 0 1-1.5 0v-4.5a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-3.44l1.97 1.97a.75.75 0 0 1 0 1.06Z" /></svg>;


interface AnalyticsData {
    totalTrades: number;
    winCount: number;
    lossCount: number;
    breakevenCount: number;
    winRate: number;
    totalR: number;
    topStrategy: string;
}

interface JournalViewProps {
    savedTrades: SavedTrade[];
    onUpdateTradeFeedback: (tradeId: string, feedback: TradeFeedback) => void;
    onRemoveTrade: (tradeId:string) => void;
    onAddResultImageToTrade: (tradeId: string, imageKey: string) => void;
    strategyLogicData: Record<StrategyKey, StrategyLogicData>;
    savedCoachingSessions: SavedCoachingSession[];
    onUpdateCoachingSessionNotes: (sessionId: string, notes: string) => void;
    onDeleteCoachingSession: (sessionId: string) => void;
    onStartNewCoachingSession: () => void;
    userSettings: UserSettings;
    onResumeCoachingSession: (session: SavedCoachingSession) => void;
    savedAssetComparisons: SavedAssetComparison[];
    onUpdateAssetComparisonNotes: (id: string, notes: string) => void;
    onDeleteAssetComparison: (id: string) => void;
}

// ... (CalculateRR and CalculateTradeResultInR functions remain the same)
const calculateRR = (trade: SavedTrade, target: 'TP1' | 'TP2'): number => {
    const entry = parseFloat(String(trade.entry).replace(/,/g, ''));
    const sl = parseFloat(String(trade.stopLoss).replace(/,/g, ''));
    const tp = parseFloat(String(target === 'TP1' ? trade.takeProfit1 : trade.takeProfit2).replace(/,/g, ''));

    if (isNaN(entry) || isNaN(sl) || isNaN(tp)) return 0;
    
    const risk = Math.abs(entry - sl);
    if (risk === 0) return 0;

    const reward = Math.abs(tp - entry);
    return reward / risk;
};

const calculateTradeResultInR = (trade: SavedTrade): number => {
    if (!trade.feedback.outcome) return 0;
    const partialExitPercentage = 0.5; 

    switch (trade.feedback.outcome) {
        case 'SL': return -1;
        case 'B/E': return 0;
        case 'TP1': return calculateRR(trade, 'TP1');
        case 'TP1 -> B/E': return calculateRR(trade, 'TP1') * partialExitPercentage;
        case 'TP1 & TP2':
            const r1 = calculateRR(trade, 'TP1');
            const r2 = calculateRR(trade, 'TP2');
            return (r1 * partialExitPercentage) + (r2 * (1 - partialExitPercentage));
        default: return 0;
    }
};


const JournalView: React.FC<JournalViewProps> = ({ 
    savedTrades, 
    onUpdateTradeFeedback, 
    onRemoveTrade,
    onAddResultImageToTrade,
    strategyLogicData,
    savedCoachingSessions,
    onUpdateCoachingSessionNotes,
    onDeleteCoachingSession,
    onStartNewCoachingSession,
    userSettings,
    onResumeCoachingSession,
    savedAssetComparisons,
    onUpdateAssetComparisonNotes,
    onDeleteAssetComparison
}) => {
    const [activeTab, setActiveTab] = useState<'trades' | 'sessions' | 'comparisons'>('trades');
    
    const [tradeToRemove, setTradeToRemove] = useState<SavedTrade | null>(null);
    const [viewingImagesForTrade, setViewingImagesForTrade] = useState<SavedTrade | null>(null);
    const [viewingCoachingLogForTrade, setViewingCoachingLogForTrade] = useState<SavedTrade | null>(null);
    
    const [tradeForResultImage, setTradeForResultImage] = useState<string | null>(null);
    const resultImageInputRef = useRef<HTMLInputElement>(null);

    // ... (State for image upload, sessions etc. remains the same)
    const [isAddImageOptionsOpen, setIsAddImageOptionsOpen] = useState(false);
    const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
    const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
    const [captureError, setCaptureError] = useState<string | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    
    const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
    const [sessionNotes, setSessionNotes] = useState<Record<string, string>>({});
    const [sessionToDelete, setSessionToDelete] = useState<SavedCoachingSession | SavedAssetComparison | null>(null);

    const [sessionFontSize, setSessionFontSize] = useState<number>(14);
    const [fullscreenSessionId, setFullscreenSessionId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 6;


    // ... (Handlers handleOpenRemoveModal, handleConfirmRemove etc. remain the same)
    const handleOpenRemoveModal = (trade: SavedTrade) => {
        setTradeToRemove(trade);
    };

    const handleConfirmRemove = () => {
        if (tradeToRemove) {
            onRemoveTrade(tradeToRemove.id);
            setTradeToRemove(null);
        }
    };
    
    const handleConfirmSessionRemove = () => {
        if (sessionToDelete) {
            if ('chatHistory' in sessionToDelete) {
                onDeleteCoachingSession(sessionToDelete.id);
            } else {
                onDeleteAssetComparison(sessionToDelete.id);
            }
            setSessionToDelete(null);
        }
    };

    // ... (Image upload handlers remain the same)
    const uploadAndSaveResultImage = async (dataUrl: string) => {
        if (!tradeForResultImage) return;
        try {
            const imageKey = await storeImage(dataUrl);
            onAddResultImageToTrade(tradeForResultImage, imageKey);
        } catch (error) {
            console.error("Failed to store result image:", error);
            alert("Failed to save result image.");
        } finally {
            setIsAddImageOptionsOpen(false);
            setTradeForResultImage(null);
        }
    };
    
    const handleTriggerResultImageUpload = (tradeId: string) => {
        setTradeForResultImage(tradeId);
        setIsAddImageOptionsOpen(true);
    };

    const handleResultImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && tradeForResultImage) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                uploadAndSaveResultImage(dataUrl);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = '';
    };

    const handlePasteResultImage = async () => {
        try {
            if (!navigator.clipboard?.read) {
                alert("Your browser does not support pasting images directly. Please use the Upload button.");
                return;
            }
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (imageType) {
                    const blob = await item.getType(imageType);
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        uploadAndSaveResultImage(e.target?.result as string);
                    };
                    reader.readAsDataURL(blob);
                    return; 
                }
            }
            alert("No image found on the clipboard.");
        } catch (err) {
            console.error("Paste error:", err);
            alert("Could not paste image. Please check permissions.");
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
        setIsAddImageOptionsOpen(false);
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
        uploadAndSaveResultImage(dataUrl);
        setIsCaptureModalOpen(false);
        stopMediaStream();
    };


    const handleNotesChange = (sessionId: string, text: string) => {
        setSessionNotes(prev => ({...prev, [sessionId]: text}));
    };

    const handleSaveNotes = (sessionId: string, type: 'coaching' | 'comparison') => {
        if (sessionNotes[sessionId] !== undefined) {
            if (type === 'coaching') {
                onUpdateCoachingSessionNotes(sessionId, sessionNotes[sessionId]);
            } else {
                onUpdateAssetComparisonNotes(sessionId, sessionNotes[sessionId]);
            }
        }
    };
    
    const handleToggleExpandSession = (sessionId: string, type: 'coaching' | 'comparison') => {
        setExpandedSessionId(prev => {
            const newId = `${type}-${sessionId}`;
            if (prev === newId) {
                handleSaveNotes(sessionId, type);
                return null;
            } else {
                const session = type === 'coaching' 
                    ? savedCoachingSessions.find(s => s.id === sessionId)
                    : savedAssetComparisons.find(c => c.id === sessionId);
                if (session) {
                    setSessionNotes(prev => ({...prev, [sessionId]: session.userNotes}));
                }
                return newId;
            }
        });
    };

    const analytics: AnalyticsData = useMemo(() => {
        const tradesWithOutcome = savedTrades.filter(t => t.feedback.outcome);
        
        const winCount = tradesWithOutcome.filter(t => (t.feedback.outcome?.startsWith('TP'))).length;
        const lossCount = tradesWithOutcome.filter(t => t.feedback.outcome === 'SL').length;
        const breakevenCount = tradesWithOutcome.filter(t => t.feedback.outcome === 'B/E').length;
        
        const totalRatedForWinRate = winCount + lossCount;
        
        const strategyFrequency: Record<string, number> = {};
        tradesWithOutcome
            .filter(t => t.feedback.outcome?.startsWith('TP'))
            .forEach(t => {
                t.strategiesUsed.forEach(strategyKey => {
                    const stratName = strategyLogicData[strategyKey]?.name || strategyKey;
                    strategyFrequency[stratName] = (strategyFrequency[stratName] || 0) + 1;
                });
            });

        const topStrategyName = Object.keys(strategyFrequency).reduce((a, b) => strategyFrequency[a] > strategyFrequency[b] ? a : b, 'N/A');

        const totalRValue = tradesWithOutcome.reduce((sum, trade) => sum + calculateTradeResultInR(trade), 0);

        return {
            totalTrades: savedTrades.length,
            winCount,
            lossCount,
            breakevenCount,
            winRate: totalRatedForWinRate > 0 ? Math.round((winCount / totalRatedForWinRate) * 100) : 0,
            totalR: parseFloat(totalRValue.toFixed(2)),
            topStrategy: topStrategyName
        };
    }, [savedTrades, strategyLogicData]);

    // ... (PerformanceData and sorted logic remains same)
    const performanceData = useMemo(() => {
        const tradesForChart = [...savedTrades]
            .filter(t => t.feedback.outcome)
            .sort((a, b) => new Date(a.savedDate).getTime() - new Date(b.savedDate).getTime());
        
        let cumulativeR = 0;
        const dataPoints = [{x:0, y:0}];

        tradesForChart.forEach((trade) => {
            cumulativeR += calculateTradeResultInR(trade);
            dataPoints.push({ x: dataPoints.length, y: parseFloat(cumulativeR.toFixed(2))});
        });

        return dataPoints.length > 1 ? dataPoints.map(p => p.y) : [0];
    }, [savedTrades]);
    
    const sortedTradesForDisplay = [...savedTrades].sort((a, b) => new Date(b.savedDate).getTime() - new Date(a.savedDate).getTime());
    const sortedSessionsForDisplay = [...savedCoachingSessions].sort((a, b) => new Date(b.savedDate).getTime() - new Date(a.savedDate).getTime());
    const sortedComparisonsForDisplay = [...savedAssetComparisons].sort((a, b) => new Date(b.savedDate).getTime() - new Date(a.savedDate).getTime());

    const renderCoachingLogModal = () => {
        if (!viewingCoachingLogForTrade) return null;

        const trade = viewingCoachingLogForTrade;
        const chatHistory = trade.coachingSessionChat || [];

        return (
             <div className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-[100] p-4" onClick={() => setViewingCoachingLogForTrade(null)}>
                <div className="bg-[hsl(var(--color-bg-800))] p-4 md:p-6 rounded-lg shadow-xl max-w-2xl w-full border border-yellow-500/50 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center pb-4 border-b border-gray-700">
                        <h2 className="text-xl font-bold text-yellow-400">Coaching Log: {trade.symbol} {trade.direction}</h2>
                        <button onClick={() => setViewingCoachingLogForTrade(null)} className="p-1 rounded-full text-gray-400 hover:text-white">&times;</button>
                    </div>
                    <div className="flex-grow overflow-y-auto pt-4 space-y-4 pr-2">
                        {chatHistory.length > 0 ? chatHistory.map(msg => (
                            <div key={msg.id} className={`flex items-start gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.sender === 'oracle' && <OracleIcon className="w-6 h-6 flex-shrink-0 mt-1" />}
                                <div className={`p-2 rounded-lg max-w-[85%] text-sm ${msg.sender === 'user' ? 'bg-blue-600/20 text-blue-100' : 'bg-gray-700 text-gray-200'}`}>
                                    {msg.imageKeys && msg.imageKeys.map((key, idx) => <ChatMessageImage key={idx} imageKey={key} />)}
                                    {msg.displayImageKey && <ChatMessageImage imageKey={msg.displayImageKey} />}
                                    {msg.text && <div dangerouslySetInnerHTML={{ __html: msg.text }} />}
                                </div>
                            </div>
                        )) : (
                            <p className="text-gray-500 text-center">No chat history was saved for this trade.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // ... (renderTradeLog, renderSessionContent, renderMentorshipSessions, renderAssetComparisons remain largely same, no new imports)
    // IMPORTANT: The TradeCard prop strategyLogicData is passed here correctly.
    
    const renderTradeLog = () => {
        const totalPages = Math.ceil(sortedTradesForDisplay.length / ITEMS_PER_PAGE);
        const paginatedTrades = sortedTradesForDisplay.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

        return (
            <div className="space-y-8">
                {savedTrades.length > 0 && (
                    <div className="bg-[hsl(var(--color-bg-800))] rounded-lg p-4 md:p-6 border border-gray-700">
                         <h3 className="font-bold text-yellow-400 mb-4 text-center" style={{ fontSize: `${userSettings.headingFontSize}px` }}>Performance Curve (in R units)</h3>
                         <PerformanceChart data={performanceData} />
                    </div>
                )}
                <div className="bg-[hsl(var(--color-bg-800))] rounded-lg p-6 border border-gray-700">
                    <h3 className="font-bold text-yellow-400 mb-4 text-center" style={{ fontSize: `${userSettings.headingFontSize}px` }}>Performance Analytics</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                         <div className="bg-[hsl(var(--color-bg-900)/0.5)] p-4 rounded-lg"><p className="font-bold text-white" style={{ fontSize: `${userSettings.dataFontSize + 4}px` }}>{analytics.totalTrades}</p><p className="text-gray-400" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Total Logged</p></div>
                         <div className="bg-[hsl(var(--color-bg-900)/0.5)] p-4 rounded-lg"><p className={`font-bold ${analytics.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`} style={{ fontSize: `${userSettings.dataFontSize + 4}px` }}>{analytics.winRate}%</p><p className="text-gray-400" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Win Rate</p></div>
                         <div className="bg-[hsl(var(--color-bg-900)/0.5)] p-4 rounded-lg"><p className="font-bold" style={{ fontSize: `${userSettings.dataFontSize + 4}px` }}><span className="text-green-400">{analytics.winCount}</span>/<span className="text-red-400">{analytics.lossCount}</span>/<span className="text-blue-400">{analytics.breakevenCount}</span></p><p className="text-gray-400" style={{ fontSize: `${userSettings.uiFontSize}px` }}>W/L/BE</p></div>
                         <div className="bg-[hsl(var(--color-bg-900)/0.5)] p-4 rounded-lg"><p className="font-bold text-yellow-300" style={{ fontSize: `${userSettings.dataFontSize + 4}px` }}>{analytics.totalR}R</p><p className="text-gray-400" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Total R</p></div>
                         <div className="bg-[hsl(var(--color-bg-900)/0.5)] p-4 rounded-lg"><p className="font-bold text-purple-400 truncate" title={analytics.topStrategy} style={{ fontSize: `${userSettings.dataFontSize + 4}px` }}>{analytics.topStrategy}</p><p className="text-gray-400" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Top Strategy (Wins)</p></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-4 text-center">Metrics based on trades with a logged outcome. Win rate excludes break-even trades.</p>
                </div>
                <div>
                    <h3 className="font-semibold text-white mb-4 text-center" style={{ fontSize: `${userSettings.headingFontSize}px` }}>Logged Trade History</h3>
                    {sortedTradesForDisplay.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                                {paginatedTrades.map(trade => (
                                    <TradeCard 
                                        key={trade.id} 
                                        trade={trade} 
                                        userSettings={userSettings} 
                                        feedback={trade.feedback} 
                                        onFeedbackChange={(newFeedback) => onUpdateTradeFeedback(trade.id, newFeedback)} 
                                        onRemove={() => handleOpenRemoveModal(trade)} 
                                        onViewCoachingLog={() => setViewingCoachingLogForTrade(trade)} 
                                        onViewImages={() => setViewingImagesForTrade(trade)}
                                        onAddResultImage={() => handleTriggerResultImageUpload(trade.id)}
                                        strategyLogicData={strategyLogicData}
                                    />
                                ))}
                            </div>
                            {totalPages > 1 && (
                                <div className="flex justify-center items-center gap-4 mt-8">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="font-semibold py-2 px-4 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white">Previous</button>
                                    <span className="text-gray-400 font-medium">Page {currentPage} of {totalPages}</span>
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="font-semibold py-2 px-4 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white">Next</button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center bg-[hsl(var(--color-bg-800)/0.5)] rounded-lg py-12"><svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg><h3 className="mt-2 font-medium text-white" style={{ fontSize: `${userSettings.uiFontSize}px` }}>No saved trades</h3><p className="mt-1 text-gray-500" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Get started by saving a trade from an analysis.</p></div>
                    )}
                </div>
            </div>
        );
    };
    
    const renderSessionContent = (session: SavedCoachingSession, isFullscreenView: boolean) => (
         <>
            <div className={`flex items-center gap-4 p-2 bg-[hsl(var(--color-bg-900)/0.3)] rounded-t-md mb-2 ${isFullscreenView ? 'flex-shrink-0' : ''}`}>
                 <label htmlFor="font-size" className="text-xs text-gray-400">Font Size: {sessionFontSize}px</label>
                 <input type="range" id="font-size" min="12" max="20" step="1" value={sessionFontSize} onChange={(e) => setSessionFontSize(Number(e.target.value))} className="w-32 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-yellow-400" />
                 <div className="flex-grow"></div>
                 <button onClick={() => isFullscreenView ? setFullscreenSessionId(null) : setFullscreenSessionId(session.id)} className="p-1 text-gray-400 hover:text-yellow-300 transition-colors" title={isFullscreenView ? "Compress View" : "Expand View"}>
                    {isFullscreenView ? <CompressIcon className="w-5 h-5"/> : <ExpandIcon className="w-5 h-5" />}
                 </button>
            </div>
             <div className="space-y-2 max-h-96 overflow-y-auto bg-[hsl(var(--color-bg-900)/0.5)] p-3 rounded-md flex-grow" style={{fontSize: `${sessionFontSize}px`}}>
                {session.chatHistory.map(msg => (
                    <div key={msg.id} className={`flex items-start gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.sender === 'oracle' && <OracleIcon className="w-6 h-6 flex-shrink-0" />}
                        <div className={`p-2 rounded-lg max-w-[85%] ${msg.sender === 'user' ? 'bg-yellow-500/20' : 'bg-gray-700'}`}>
                            {msg.imageKeys && msg.imageKeys.map((key, idx) => <ChatMessageImage key={idx} imageKey={key} />)}
                            {msg.text && <div dangerouslySetInnerHTML={{ __html: msg.text }} />}
                        </div>
                    </div>
                ))}
            </div>
            <div className={`space-y-2 mt-2 ${isFullscreenView ? 'flex-shrink-0 w-full' : ''}`}>
                 <label htmlFor={`notes-${session.id}`} className="block font-medium text-gray-300" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Your Notes & Reflections:</label>
                 <textarea id={`notes-${session.id}`} value={sessionNotes[session.id] || ''} onChange={e => handleNotesChange(session.id, e.target.value)} onBlur={() => handleSaveNotes(session.id, 'coaching')} rows={4} className="w-full bg-gray-900 p-2 rounded-md text-gray-200 border border-gray-600 focus:ring-yellow-500 focus:border-yellow-500" placeholder="e.g., This trade worked well because..." style={{ fontSize: `${userSettings.uiFontSize}px` }} />
            </div>
         </>
    );

    const renderMentorshipSessions = () => (
        <div className="space-y-4">
             <div className="text-center p-4 bg-[hsl(var(--color-bg-800))] rounded-lg border border-gray-700">
                <h3 className="font-bold text-yellow-400 mb-2" style={{ fontSize: `${userSettings.headingFontSize}px` }}>Saved Mentorship Sessions</h3>
                <p className="text-gray-400 mb-4" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Review your past coaching sessions and add notes to reflect on your learning.</p>
                <button onClick={onStartNewCoachingSession} className="font-bold py-2 px-6 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-2 mx-auto">
                    <OracleIcon className="w-5 h-5"/> Start New Coaching Session
                </button>
            </div>
            {sortedSessionsForDisplay.length > 0 ? (
                sortedSessionsForDisplay.map(session => (
                    <div key={session.id} className="bg-[hsl(var(--color-bg-800))] rounded-lg border border-gray-700 group">
                        <div className="w-full p-4 text-left flex justify-between items-center">
                            <div className="flex-grow cursor-pointer" onClick={() => handleToggleExpandSession(session.id, 'coaching')}>
                                <p className="font-bold text-white" style={{ fontSize: `${userSettings.headingFontSize - 2}px` }}>{session.title}</p>
                                <p className="text-xs text-gray-500">Saved: {new Date(session.savedDate).toLocaleString()}</p>
                            </div>
                             <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); onResumeCoachingSession(session); }} className="p-2 rounded-full text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" title="Continue Session"><ContinueIcon className="w-5 h-5"/></button>
                                <button onClick={(e) => { e.stopPropagation(); setSessionToDelete(session); }} className="p-2 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Session"><TrashIcon className="w-5 h-5"/></button>
                                <button onClick={() => handleToggleExpandSession(session.id, 'coaching')} className="p-1">
                                    <span className={`transition-transform duration-300 ${expandedSessionId === `coaching-${session.id}` ? 'rotate-180' : ''}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </span>
                                </button>
                             </div>
                        </div>
                        {expandedSessionId === `coaching-${session.id}` && (
                             <div className="p-4 border-t border-gray-700 space-y-4">
                                {renderSessionContent(session, false)}
                             </div>
                        )}
                    </div>
                ))
            ) : (
                 <div className="text-center bg-[hsl(var(--color-bg-800)/0.5)] rounded-lg py-12"><svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg><h3 className="mt-2 font-medium text-white" style={{ fontSize: `${userSettings.uiFontSize}px` }}>No saved sessions</h3><p className="mt-1 text-gray-500" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Complete a Live Coaching session to save it here.</p></div>
            )}
        </div>
    );

    const renderAssetComparisons = () => (
        <div className="space-y-4">
            <div className="text-center p-4 bg-[hsl(var(--color-bg-800))] rounded-lg border border-gray-700">
                <h3 className="font-bold text-yellow-400 mb-2" style={{ fontSize: `${userSettings.headingFontSize}px` }}>Saved Asset Comparisons</h3>
                <p className="text-gray-400" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Review your past market scans and add notes.</p>
            </div>
            {sortedComparisonsForDisplay.length > 0 ? (
                sortedComparisonsForDisplay.map(comp => (
                    <div key={comp.id} className="bg-[hsl(var(--color-bg-800))] rounded-lg border border-gray-700 group">
                        <div className="w-full p-4 text-left flex justify-between items-center">
                            <div className="flex-grow cursor-pointer" onClick={() => handleToggleExpandSession(comp.id, 'comparison')}>
                                <p className="font-bold text-white" style={{ fontSize: `${userSettings.headingFontSize - 2}px` }}>
                                    Comparison using: <span className="text-purple-300">{strategyLogicData[comp.strategyKey]?.name || comp.strategyKey}</span>
                                </p>
                                <p className="text-xs text-gray-500">Saved: {new Date(comp.savedDate).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); setSessionToDelete(comp); }} className="p-2 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Comparison">
                                    <TrashIcon className="w-5 h-5"/>
                                </button>
                                <button onClick={() => handleToggleExpandSession(comp.id, 'comparison')} className="p-1">
                                    <span className={`transition-transform duration-300 ${expandedSessionId === `comparison-${comp.id}` ? 'rotate-180' : ''}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </span>
                                </button>
                            </div>
                        </div>
                        {expandedSessionId === `comparison-${comp.id}` && (
                             <div className="p-4 border-t border-gray-700 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <h4 className="font-semibold text-gray-300">Ranked Results</h4>
                                        {comp.results.map((result, index) => (
                                            <div key={index} className="bg-[hsl(var(--color-bg-900)/0.5)] p-3 rounded-md border border-gray-700/50">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h5 className="font-bold text-white">{result.asset}</h5>
                                                        <p className={`text-sm font-semibold ${result.sentiment === 'Bullish' ? 'text-green-400' : result.sentiment === 'Bearish' ? 'text-red-400' : 'text-gray-400'}`}>{result.sentiment}</p>
                                                    </div>
                                                    <HeatMeter level={result.heat}/>
                                                </div>
                                                <p className="text-xs text-gray-300 mt-2 italic">"{result.brief}"</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-semibold text-gray-300">Charts Analyzed</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.values(comp.imageKeys).filter(Boolean).map((key, i) => (
                                                <IdbImage key={i} imageKey={key!} className="w-full h-auto object-cover rounded-md border border-gray-600" />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor={`notes-${comp.id}`} className="block font-medium text-gray-300">Your Notes:</label>
                                    <textarea id={`notes-${comp.id}`} value={sessionNotes[comp.id] || ''} onChange={e => handleNotesChange(comp.id, e.target.value)} onBlur={() => handleSaveNotes(comp.id, 'comparison')} rows={3} className="w-full bg-gray-900 p-2 mt-1 rounded-md text-gray-200 border border-gray-600 focus:ring-yellow-500 focus:border-yellow-500" />
                                </div>
                            </div>
                        )}
                    </div>
                ))
            ) : (
                <div className="text-center bg-[hsl(var(--color-bg-800)/0.5)] rounded-lg py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <h3 className="mt-2 font-medium text-white" style={{ fontSize: `${userSettings.uiFontSize}px` }}>No saved comparisons</h3>
                    <p className="mt-1 text-gray-500" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Compare assets on the Oracle tab to save them here.</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="p-4 md:p-6 space-y-8">
            <h2 className="text-3xl font-bold text-white text-center" style={{ fontSize: `${userSettings.headingFontSize + 12}px` }}>Journal</h2>

            <div className="sticky top-[80px] z-30 bg-[hsl(var(--color-bg-800)/0.8)] backdrop-blur-sm -mx-4 md:-mx-6 px-4 md:px-6">
                <div className="border-b border-gray-700">
                    <nav className="-mb-px flex space-x-8 justify-center" aria-label="Tabs">
                        <button onClick={() => setActiveTab('trades')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${activeTab === 'trades' ? 'border-yellow-400 text-yellow-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Trade Log</button>
                        <button onClick={() => setActiveTab('sessions')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${activeTab === 'sessions' ? 'border-yellow-400 text-yellow-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Mentorship</button>
                        <button onClick={() => setActiveTab('comparisons')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg ${activeTab === 'comparisons' ? 'border-yellow-400 text-yellow-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>Comparisons</button>
                    </nav>
                </div>
            </div>

            <div className="mt-8">
                {activeTab === 'trades' && renderTradeLog()}
                {activeTab === 'sessions' && renderMentorshipSessions()}
                {activeTab === 'comparisons' && renderAssetComparisons()}
            </div>

            <ConfirmationModal 
                isOpen={!!tradeToRemove} 
                onConfirm={handleConfirmRemove} 
                onCancel={() => setTradeToRemove(null)} 
                title="Confirm Removal"
                message={`Are you sure you want to permanently remove this trade from your journal? This action cannot be undone.`}
            />

            <ConfirmationModal
                isOpen={!!sessionToDelete}
                onConfirm={handleConfirmSessionRemove}
                onCancel={() => setSessionToDelete(null)}
                title="Confirm Deletion"
                message={`Are you sure you want to permanently delete this item from your journal? This cannot be undone.`}
            />

            {viewingImagesForTrade && <ImageViewerModal trade={viewingImagesForTrade} onClose={() => setViewingImagesForTrade(null)} />}
            {renderCoachingLogModal()}
            {fullscreenSessionId && sortedSessionsForDisplay.find(s => s.id === fullscreenSessionId) && (
                <div className="fixed inset-0 bg-gray-900 z-[101] p-4 flex flex-col animate-fadeIn">
                    {renderSessionContent(sortedSessionsForDisplay.find(s => s.id === fullscreenSessionId)!, true)}
                </div>
            )}
            
            <ConfirmationModal
                isOpen={isAddImageOptionsOpen}
                onCancel={() => { setIsAddImageOptionsOpen(false); setTradeForResultImage(null); }}
                onConfirm={() => {}} 
                title="Add Outcome Chart"
                message="How would you like to add your image?"
            >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4">
                    <button onClick={() => resultImageInputRef.current?.click()} className="text-sm font-semibold p-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5"><UploadIcon className="w-4 h-4" /> Upload</button>
                    <button onClick={handlePasteResultImage} className="text-sm font-semibold p-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white">Paste Image</button>
                    <button onClick={handleInitiateScreenCapture} className="text-sm font-semibold p-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5"><ScreenIcon className="w-4 h-4" /> Share Screen</button>
                    <input type="file" ref={resultImageInputRef} onChange={handleResultImageSelected} accept="image/*" className="hidden" />
                </div>
            </ConfirmationModal>
            
            <ScreenCaptureModal isOpen={isCaptureModalOpen} stream={captureStream} onCapture={handleCaptureSubmit} onClose={() => { setIsCaptureModalOpen(false); stopMediaStream(); }} error={captureError} />

        </div>
    );
};

export default JournalView;
