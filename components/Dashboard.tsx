
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnalysisResults, StrategyKey, UserSettings, UploadedImageKeys, User, UserUsage, StrategyLogicData, KnowledgeBaseDocument, ApiConfiguration, MarketDataCache, MarketDataCandle } from '../types';
import { USER_TIERS } from '../constants';
import ImageUploader, { ImageUploaderHandles } from './ImageUploader';
import StrategyRequirements from './StrategyRequirements';
import UserSettingsEditor from './UserSettings';
import Logo from './Logo';

interface DashboardProps {
  onAnalysisComplete: (results: AnalysisResults, strategies: StrategyKey[], images: UploadedImageKeys, useRealTimeContext: boolean) => void;
  userSettings: UserSettings;
  onUserSettingsChange: (settingKey: keyof UserSettings, value: any) => void;
  initialImages?: UploadedImageKeys | null;
  currentUser: User | null;
  userUsage: UserUsage;
  dashboardSelectedStrategies: StrategyKey[];
  onDashboardStrategyChange: (key: StrategyKey) => void;
  onSetDashboardStrategies: (keys: StrategyKey[]) => void;
  dashboardSelectedMarketData: string[];
  setDashboardSelectedMarketData: React.Dispatch<React.SetStateAction<string[]>>;
  strategyLogicData: Record<StrategyKey, StrategyLogicData>;
  knowledgeBaseDocuments: KnowledgeBaseDocument[];
  isAnalyzing: boolean;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  onLogTokenUsage: (tokens: number) => void;
  isUnrestrictedMode: boolean;
  apiConfig: ApiConfiguration;
  onInitiateCoaching: (strategy: StrategyLogicData, goal: 'learn_basics' | 'build_setup', strategyKey: StrategyKey) => void;
  viewedStrategy: StrategyKey | null;
  setViewedStrategy: (key: StrategyKey | null) => void;
  marketDataCache: MarketDataCache;
  onSaveAssetComparison: (comp: any) => void;
}

const LockIcon: React.FC<{className?: string}> = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002 2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" /></svg>;
const CheckIcon: React.FC<{className?: string}> = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>;
const WarningIcon: React.FC<{className?: string}> = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.636-1.1 2.29-1.1 2.926 0l5.578 9.663c.636 1.1-.18 2.488-1.463 2.488H4.142c-1.282 0-2.098-1.387-1.463-2.488l5.578-9.663zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>;
const CoachingIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" /></svg>;
const ChevronDownIcon = (props:{className?:string}) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>;


const Section: React.FC<{ number: number, title: string, children: React.ReactNode, disabled?: boolean, fontSize: number }> = ({ number, title, children, disabled, fontSize }) => (
    <div className={`transition-opacity ${disabled ? 'opacity-50' : 'opacity-100'}`}>
        <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500 text-gray-900 font-bold text-lg flex-shrink-0">{number}</div>
            <h3 className="font-bold text-white" style={{ fontSize: `${fontSize}px` }}>{title}</h3>
        </div>
        <div className="pl-12">
            {children}
        </div>
    </div>
);

const Dashboard: React.FC<DashboardProps> = ({ 
    onAnalysisComplete, userSettings, onUserSettingsChange, initialImages, currentUser, userUsage,
    dashboardSelectedStrategies, onDashboardStrategyChange, onSetDashboardStrategies, 
    dashboardSelectedMarketData, setDashboardSelectedMarketData,
    strategyLogicData, knowledgeBaseDocuments, isAnalyzing, setIsAnalyzing, onLogTokenUsage, 
    isUnrestrictedMode, apiConfig, onInitiateCoaching,
    viewedStrategy, setViewedStrategy, marketDataCache
}) => {
    
    const uploaderRef = useRef<ImageUploaderHandles>(null);
    const [uploaderPhase, setUploaderPhase] = useState<'idle' | 'gathering' | 'validating' | 'ready' | 'analyzing'>('idle');
    const [useRealTimeContext, setUseRealTimeContext] = useState<boolean>(true);
    const [useHighRes, setUseHighRes] = useState<boolean>(true); // For Master tier toggle
    const [expandedConcepts, setExpandedConcepts] = useState<Record<StrategyKey, boolean>>({});
    const [tooltipState, setTooltipState] = useState<{ content: string; top: number; left: number } | null>(null);
    const [isPromptVisible, setIsPromptVisible] = useState(false);

    useEffect(() => {
        setIsPromptVisible(false);
    }, [viewedStrategy]);

    const handleMouseEnter = (e: React.MouseEvent<HTMLSpanElement>, content: string) => {
        const span = e.currentTarget;
        if (span.scrollWidth > span.clientWidth) {
            const rect = span.getBoundingClientRect();
            setTooltipState({
                content,
                top: rect.top,
                left: rect.left + rect.width / 2,
            });
        }
    };

    const handleMouseLeave = () => {
        setTooltipState(null);
    };

    const handleToggleExpand = (key: StrategyKey) => {
        setExpandedConcepts(prev => ({...prev, [key]: !prev[key]}));
    };
    
    const info = viewedStrategy ? strategyLogicData[viewedStrategy] : null;

    const handleTriggerAnalysis = () => {
        if (!uploaderRef.current) return;
        setIsAnalyzing(true);
        uploaderRef.current.triggerAnalysis(useRealTimeContext);
    }
    
    const canAnalyze = !!apiConfig.geminiApiKey;
    
    const isSubmitDisabled = (uploaderPhase !== 'ready' && dashboardSelectedMarketData.length === 0) || isAnalyzing || !canAnalyze || dashboardSelectedStrategies.length === 0;

    let submitButtonTooltip = "";
    if (!canAnalyze) {
        submitButtonTooltip = "Please set your API key in Master Controls.";
    } else if (dashboardSelectedStrategies.length === 0) {
        submitButtonTooltip = "Please select at least one strategy.";
    } else if (uploaderPhase !== 'ready' && dashboardSelectedMarketData.length === 0) {
        submitButtonTooltip = "Please complete the guided chart upload or select a cached dataset to enable analysis.";
    }

    const { parentStrategies, childrenByParent } = useMemo(() => {
        const parents: [StrategyKey, StrategyLogicData][] = [];
        const childrenMap: Record<StrategyKey, [StrategyKey, StrategyLogicData][]> = {};

        Object.entries(strategyLogicData).forEach(([key, strategyUntyped]) => {
            const strategy = strategyUntyped as StrategyLogicData;
            if (!strategy.isEnabled) return;

            if (strategy.parentId && strategyLogicData[strategy.parentId]) {
                if (!childrenMap[strategy.parentId]) {
                    childrenMap[strategy.parentId] = [];
                }
                childrenMap[strategy.parentId].push([key, strategy]);
            } else {
                parents.push([key, strategy]);
            }
        });
        return { parentStrategies: parents.sort((a, b) => a[1].name.localeCompare(b[1].name)), childrenByParent: childrenMap };
    }, [strategyLogicData]);

    const groupedMarketData = useMemo(() => {
        const grouped: Record<string, { key: string; timeframe: string; count: number; dateRange: string; }[]> = {};
        Object.entries(marketDataCache).forEach(([key, candlesUntyped]) => {
            const candles = candlesUntyped as MarketDataCandle[];
            if (!Array.isArray(candles) || candles.length === 0) return;
            
            const lastDashIndex = key.lastIndexOf('-');
            const symbol = lastDashIndex > -1 ? key.substring(0, lastDashIndex) : key;
            const timeframe = lastDashIndex > -1 ? key.substring(lastDashIndex + 1) : 'Unknown';
    
            if (!grouped[symbol]) {
                grouped[symbol] = [];
            }
    
            const sortedDates = candles.map(c => new Date(c.date)).sort((a, b) => a.getTime() - b.getTime());
            const startDate = sortedDates[0].toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' });
            const endDate = sortedDates[sortedDates.length - 1].toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' });
            
            grouped[symbol].push({
                key,
                timeframe,
                count: candles.length,
                dateRange: `${startDate} to ${endDate}`
            });
        });
        return grouped;
    }, [marketDataCache]);


    const handleMarketDataSelectionChange = (key: string) => {
        setDashboardSelectedMarketData(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return Array.from(newSet);
        });
    };

    return (
        <div className="p-4 md:p-6">
             {tooltipState && createPortal(
                <div
                    className="fixed z-[100] py-1 px-3 font-semibold text-white bg-gray-900 rounded-md shadow-lg border border-gray-700 pointer-events-none"
                    style={{
                        top: tooltipState.top,
                        left: tooltipState.left,
                        transform: 'translate(-50%, -120%)',
                        fontSize: `${userSettings.uiFontSize - 2}px`
                    }}
                >
                    {tooltipState.content}
                </div>,
                document.body
            )}
            {!currentUser && (
                <div className="max-w-3xl mx-auto bg-red-800/30 border border-red-600 rounded-lg p-6 mb-6 text-center">
                    <h3 className="text-xl font-bold text-red-300">Login Required</h3>
                    <p className="text-red-200 mt-2">Please log in to analyze charts and access your dashboard.</p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className={`lg:col-span-3 space-y-8 ${(!currentUser) ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Section number={1} title="Select Your Strategies" fontSize={userSettings.headingFontSize}>
                        <p className="text-gray-400 mb-3" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Build your analysis by selecting your custom-built strategies.</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="md:col-span-1 space-y-2">
                                <h4 className="font-semibold text-gray-400 text-xs uppercase tracking-wider">Your Strategies</h4>
                                {parentStrategies.length > 0 ? parentStrategies.map(([key, strategy]) => {
                                    const children = childrenByParent[key];
                                    const isExpanded = !!expandedConcepts[key];

                                    if (children && children.length > 0) {
                                        const childrenKeys = children.map(([childKey]) => childKey);
                                        const allKeysInGroup = [key, ...childrenKeys];
                                        const selectedCount = allKeysInGroup.filter(k => dashboardSelectedStrategies.includes(k)).length;
                                        const isAllSelected = selectedCount === allKeysInGroup.length;
                                        const isPartiallySelected = selectedCount > 0 && !isAllSelected;

                                        const handleMasterCheckboxChange = () => {
                                            const currentStrategies = new Set(dashboardSelectedStrategies);
                                            if (isAllSelected) {
                                                allKeysInGroup.forEach(k => currentStrategies.delete(k));
                                            } else {
                                                allKeysInGroup.forEach(k => currentStrategies.add(k));
                                            }
                                            onSetDashboardStrategies(Array.from(currentStrategies));
                                        };

                                        return (
                                            <div key={key} className="bg-gray-700/20 rounded-md">
                                                <div className="flex items-center p-3 rounded-t-md bg-gray-800 border-b border-gray-700">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isAllSelected || isPartiallySelected}
                                                        ref={input => { if (input) input.indeterminate = isPartiallySelected; }}
                                                        onChange={handleMasterCheckboxChange}
                                                        className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-yellow-500 focus:ring-yellow-500/50 mr-3"
                                                    />
                                                    <span className="font-semibold text-white">{strategy.name}</span>
                                                    <button onClick={() => handleToggleExpand(key)} className="ml-auto text-gray-400 hover:text-white">
                                                        <ChevronDownIcon className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </button>
                                                </div>
                                                {isExpanded && (
                                                    <div className="p-3 space-y-2 bg-gray-900/30">
                                                        {children.map(([childKey, childStrat]) => (
                                                            <label key={childKey} className="flex items-center p-2 rounded hover:bg-gray-700/50 cursor-pointer">
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={dashboardSelectedStrategies.includes(childKey)} 
                                                                    onChange={() => onDashboardStrategyChange(childKey)}
                                                                    className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-yellow-500 focus:ring-yellow-500/50" 
                                                                />
                                                                <span className="ml-3 text-sm text-gray-300">{childStrat.name}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={key} className="bg-gray-700/20 rounded-md p-3 flex items-center">
                                            <input 
                                                type="checkbox" 
                                                checked={dashboardSelectedStrategies.includes(key)} 
                                                onChange={() => onDashboardStrategyChange(key)}
                                                className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-yellow-500 focus:ring-yellow-500/50" 
                                            />
                                            <div className="ml-3 flex-grow">
                                                <span className="font-semibold text-white block">{strategy.name}</span>
                                                <p className="text-xs text-gray-400">{strategy.description.substring(0, 80)}...</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setViewedStrategy(key)} className="text-xs text-blue-400 hover:underline">Info</button>
                                                <button onClick={() => onInitiateCoaching(strategy, 'learn_basics', key)} className="text-gray-400 hover:text-yellow-400" title="Start Coaching">
                                                    <CoachingIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }) : <p className="text-sm text-gray-500">No strategies created yet. Go to Settings to create one.</p>}
                            </div>
                        </div>
                    </Section>

                    <Section number={2} title="Add Context" disabled={dashboardSelectedStrategies.length === 0} fontSize={userSettings.headingFontSize}>
                        <div className="grid grid-cols-1 gap-6">
                            <ImageUploader 
                                ref={uploaderRef}
                                onAnalysisComplete={onAnalysisComplete}
                                selectedStrategies={dashboardSelectedStrategies}
                                userSettings={userSettings}
                                initialImages={initialImages}
                                strategyLogicData={strategyLogicData}
                                isAnalyzing={isAnalyzing}
                                setIsAnalyzing={setIsAnalyzing}
                                onPhaseChange={setUploaderPhase}
                                apiConfig={apiConfig}
                                onLogTokenUsage={onLogTokenUsage}
                                marketDataCache={marketDataCache}
                                dashboardSelectedMarketData={dashboardSelectedMarketData}
                                analysisMode="setup"
                            />
                            
                            {Object.keys(groupedMarketData).length > 0 && (
                                <div className="bg-gray-800/70 p-4 rounded-lg border border-gray-700">
                                    <h4 className="font-bold text-gray-200 mb-3">Select Cached Market Data</h4>
                                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                        {Object.entries(groupedMarketData).map(([symbol, items]) => (
                                            <div key={symbol} className="bg-gray-900/50 p-3 rounded-md">
                                                <p className="font-semibold text-yellow-500 mb-2">{symbol}</p>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {(items as { key: string; timeframe: string; count: number; dateRange: string; }[]).map(item => (
                                                        <label key={item.key} className={`flex items-center p-2 rounded border cursor-pointer transition-colors ${dashboardSelectedMarketData.includes(item.key) ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-800 border-gray-700 hover:border-gray-600'}`}>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={dashboardSelectedMarketData.includes(item.key)} 
                                                                onChange={() => handleMarketDataSelectionChange(item.key)}
                                                                className="h-4 w-4 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500/50"
                                                            />
                                                            <div className="ml-2">
                                                                <span className="block text-sm text-gray-200 font-mono">{item.timeframe}</span>
                                                                <span className="block text-[10px] text-gray-500">{item.count} candles</span>
                                                            </div>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Section>

                    <Section number={3} title="Analyze" disabled={isSubmitDisabled} fontSize={userSettings.headingFontSize}>
                        <div className="flex flex-col gap-4">
                            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={useRealTimeContext} 
                                        onChange={(e) => setUseRealTimeContext(e.target.checked)}
                                        className="h-5 w-5 rounded bg-gray-700 border-gray-600 text-yellow-500 focus:ring-yellow-500/50"
                                    />
                                    <div>
                                        <span className="font-semibold text-white">Enable Real-Time Context</span>
                                        <p className="text-xs text-gray-400">Allows AI to use current date/time for seasonal awareness.</p>
                                    </div>
                                </label>
                            </div>

                            <button
                                onClick={handleTriggerAnalysis}
                                disabled={isSubmitDisabled}
                                title={submitButtonTooltip}
                                className="w-full py-4 px-6 bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-gray-900 font-bold text-lg rounded-lg shadow-lg transform transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <Logo className="w-6 h-6 animate-spin" />
                                        <span>Analyzing Market Structure...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>GENERATE TRADE SETUP</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                            <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                                        </svg>
                                    </>
                                )}
                            </button>
                            {isSubmitDisabled && !isAnalyzing && (
                                <p className="text-center text-sm text-red-400 flex items-center justify-center gap-2">
                                    <WarningIcon className="w-4 h-4" />
                                    {submitButtonTooltip}
                                </p>
                            )}
                        </div>
                    </Section>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 sticky top-24">
                        <h3 className="font-bold text-white mb-4" style={{ fontSize: `${userSettings.headingFontSize}px` }}>Configuration</h3>
                        <UserSettingsEditor userSettings={userSettings} onUserSettingsChange={onUserSettingsChange} />
                    </div>
                </div>
            </div>

            {viewedStrategy && info && (
                <div className="fixed inset-0 bg-gray-900/80 z-50 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setViewedStrategy(null)}>
                    <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl w-full border border-yellow-500/50 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-2xl font-bold text-yellow-400">{info.name}</h3>
                            <button onClick={() => setViewedStrategy(null)} className="text-gray-400 hover:text-white text-xl">&times;</button>
                        </div>
                        <div className="space-y-4 text-gray-300">
                            <div>
                                <h4 className="font-semibold text-white border-b border-gray-700 pb-1 mb-2">Description</h4>
                                <p>{info.description}</p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-white border-b border-gray-700 pb-1 mb-2">Strategy Profile</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    {info.assetClasses && <div><span className="text-gray-500">Asset Classes:</span><br/>{info.assetClasses.join(', ')}</div>}
                                    {info.tradingStyles && <div><span className="text-gray-500">Style:</span><br/>{info.tradingStyles.join(', ')}</div>}
                                    {info.timeZoneSpecificity && <div><span className="text-gray-500">Time Zone:</span><br/>{info.timeZoneSpecificity}</div>}
                                    {info.tags && <div><span className="text-gray-500">Tags:</span><br/>{info.tags.join(', ')}</div>}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold text-white border-b border-gray-700 pb-1 mb-2 flex justify-between items-center cursor-pointer" onClick={() => setIsPromptVisible(!isPromptVisible)}>
                                    <span>Core Logic Prompt</span>
                                    <span className="text-xs text-blue-400">{isPromptVisible ? 'Hide' : 'Show'}</span>
                                </h4>
                                {isPromptVisible && (
                                    <pre className="bg-gray-900 p-3 rounded text-xs text-gray-400 whitespace-pre-wrap font-mono border border-gray-700">
                                        {info.prompt}
                                    </pre>
                                )}
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button onClick={() => { setViewedStrategy(null); onInitiateCoaching(info, 'learn_basics', viewedStrategy); }} className="font-semibold py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-2">
                                <CoachingIcon className="w-5 h-5" /> Learn with AI Coach
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
