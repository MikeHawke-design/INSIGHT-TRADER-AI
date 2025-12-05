
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AnalysisResults, StrategyKey, UserSettings, UploadedImageKeys, User, UserUsage, StrategyLogicData, KnowledgeBaseDocument, ApiConfiguration } from '../types';
import ImageUploader, { ImageUploaderHandles } from './ImageUploader';
import UserSettingsEditor from './UserSettings';
import Logo from './Logo';
import OracleIcon from './OracleIcon';

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
}

const WarningIcon: React.FC<{ className?: string }> = (props) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.636-1.1 2.29-1.1 2.926 0l5.578 9.663c.636 1.1-.18 2.488-1.463 2.488H4.142c-1.282 0-2.098-1.387-1.463-2.488l5.578-9.663zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>;
const CoachingIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" /></svg>;


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
    onAnalysisComplete, userSettings, onUserSettingsChange, initialImages, currentUser,
    dashboardSelectedStrategies, onDashboardStrategyChange: _onDashboardStrategyChange, onSetDashboardStrategies,
    strategyLogicData, isAnalyzing, setIsAnalyzing, onLogTokenUsage,
    apiConfig, onInitiateCoaching,
    viewedStrategy, setViewedStrategy
}) => {

    const uploaderRef = useRef<ImageUploaderHandles>(null);
    const [uploaderPhase, setUploaderPhase] = useState<'idle' | 'gathering' | 'validating' | 'ready' | 'analyzing'>('idle');
    const [isComparisonMode, setIsComparisonMode] = useState<boolean>(false);
    const [isPromptVisible, setIsPromptVisible] = useState(false);

    useEffect(() => {
        setIsPromptVisible(false);
    }, [viewedStrategy]);

    // Reset uploader state when switching analysis modes to ensure a clean slate
    useEffect(() => {
        if (uploaderRef.current) {
            uploaderRef.current.resetState();
        }
    }, [isComparisonMode]);

    const info = viewedStrategy ? strategyLogicData[viewedStrategy] : null;

    const handleTriggerAnalysis = () => {
        if (!uploaderRef.current) return;
        setIsAnalyzing(true);
        uploaderRef.current.triggerAnalysis(true);
    }

    // Allow analysis if ANY API key is in config OR environment variable
    const canAnalyze = !!apiConfig.geminiApiKey || !!apiConfig.openaiApiKey || !!apiConfig.groqApiKey || !!import.meta.env.VITE_API_KEY;

    const isSubmitDisabled = (uploaderPhase !== 'ready') || isAnalyzing || !canAnalyze || dashboardSelectedStrategies.length === 0;

    let submitButtonTooltip = "";
    if (!canAnalyze) {
        submitButtonTooltip = "Please set your API key in Master Controls.";
    } else if (dashboardSelectedStrategies.length === 0) {
        submitButtonTooltip = "Please select at least one strategy.";
    } else if (uploaderPhase !== 'ready') {
        submitButtonTooltip = "Please complete the guided chart upload to enable analysis.";
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



    return (
        <div className="p-4 md:p-6">
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

                                    return (
                                        <div key={key} className="space-y-2">
                                            {/* Parent Strategy Item */}
                                            <div
                                                className={`rounded-md p-3 flex items-center cursor-pointer transition-colors border ${dashboardSelectedStrategies.includes(key) ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-gray-700/20 border-transparent hover:bg-gray-700/40'}`}
                                                onClick={() => onSetDashboardStrategies([key])}
                                            >
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 ${dashboardSelectedStrategies.includes(key) ? 'border-yellow-500' : 'border-gray-500'}`}>
                                                    {dashboardSelectedStrategies.includes(key) && <div className="w-2 h-2 rounded-full bg-yellow-500" />}
                                                </div>
                                                <div className="flex-grow">
                                                    <span className={`font-semibold block ${dashboardSelectedStrategies.includes(key) ? 'text-yellow-400' : 'text-white'}`}>{strategy.name}</span>
                                                    <p className="text-xs text-gray-400">{strategy.description.substring(0, 80)}...</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onInitiateCoaching(strategy, 'learn_basics', key); }}
                                                        className="text-gray-400 hover:text-yellow-400 p-2 hover:bg-gray-700/50 rounded-full transition-colors"
                                                        title="Chat with Oracle about this strategy"
                                                    >
                                                        <OracleIcon className="w-6 h-6" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Children Strategies */}
                                            {children && children.length > 0 && (
                                                <div className="pl-6 space-y-2">
                                                    {children.map(([childKey, childStrat]) => (
                                                        <div
                                                            key={childKey}
                                                            className={`rounded-md p-2 flex items-center cursor-pointer transition-colors border ${dashboardSelectedStrategies.includes(childKey) ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-gray-700/20 border-transparent hover:bg-gray-700/40'}`}
                                                            onClick={() => onSetDashboardStrategies([childKey])}
                                                        >
                                                            <div className={`w-3 h-3 rounded-full border flex items-center justify-center mr-3 ${dashboardSelectedStrategies.includes(childKey) ? 'border-yellow-500' : 'border-gray-500'}`}>
                                                                {dashboardSelectedStrategies.includes(childKey) && <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />}
                                                            </div>
                                                            <span className={`text-sm ${dashboardSelectedStrategies.includes(childKey) ? 'text-yellow-400' : 'text-gray-300'}`}>{childStrat.name}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }) : <p className="text-sm text-gray-500">No strategies created yet. Go to Settings to create one.</p>}
                            </div>
                        </div>

                        {/* Selected Strategy Requirements Display */}
                        {dashboardSelectedStrategies.length > 0 && strategyLogicData[dashboardSelectedStrategies[0]] && (
                            <div className="mt-6 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 animate-fadeIn">
                                <h4 className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                                    </svg>
                                    Strategy Requirements
                                </h4>
                                {strategyLogicData[dashboardSelectedStrategies[0]].requirements?.items && strategyLogicData[dashboardSelectedStrategies[0]].requirements?.items.length ? (
                                    <ul className="space-y-2">
                                        {strategyLogicData[dashboardSelectedStrategies[0]].requirements?.items.map((req, idx) => (
                                            <li key={idx} className="text-sm text-gray-300 flex items-start gap-2">
                                                <span className="text-blue-500 mt-1">•</span>
                                                <span dangerouslySetInnerHTML={{ __html: req }} />
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-gray-500 italic">No specific requirements listed for this strategy.</p>
                                )}
                            </div>
                        )}
                    </Section>

                    <Section number={2} title="Add Context" disabled={dashboardSelectedStrategies.length === 0} fontSize={userSettings.headingFontSize}>
                        <div className="flex flex-col gap-6">
                            <div className="mb-2">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Analysis Mode</p>
                                <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-700 max-w-md">
                                    <button
                                        onClick={() => setIsComparisonMode(false)}
                                        className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ${!isComparisonMode
                                            ? 'bg-gray-700 text-white shadow-md'
                                            : 'text-gray-400 hover:text-gray-200'
                                            }`}
                                    >
                                        Standard Analysis
                                    </button>
                                    <button
                                        onClick={() => setIsComparisonMode(true)}
                                        className={`flex-1 py-2 px-4 rounded-md text-sm font-semibold transition-all ${isComparisonMode
                                            ? 'bg-blue-700 text-white shadow-md'
                                            : 'text-gray-400 hover:text-gray-200'
                                            }`}
                                    >
                                        Asset Comparison
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    {isComparisonMode
                                        ? "Rank multiple assets against each other based on strategy criteria."
                                        : "Deep dive analysis into a single asset or setup with multi-timeframe context."}
                                </p>
                            </div>

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
                                isComparisonMode={isComparisonMode}
                            />
                        </div>
                    </Section>

                    <Section number={3} title="Analyze" disabled={isSubmitDisabled} fontSize={userSettings.headingFontSize}>
                        <div className="flex flex-col gap-4">


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
                                        <span>{isComparisonMode ? 'COMPARE ASSETS' : 'GENERATE TRADE SETUP'}</span>
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
                                    {info.assetClasses && <div><span className="text-gray-500">Asset Classes:</span><br />{info.assetClasses.join(', ')}</div>}
                                    {info.tradingStyles && <div><span className="text-gray-500">Style:</span><br />{info.tradingStyles.join(', ')}</div>}
                                    {info.timeZoneSpecificity && <div><span className="text-gray-500">Time Zone:</span><br />{info.timeZoneSpecificity}</div>}
                                    {info.tags && <div><span className="text-gray-500">Tags:</span><br />{info.tags.join(', ')}</div>}
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
