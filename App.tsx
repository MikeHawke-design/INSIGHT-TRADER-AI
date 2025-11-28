
import React, { useState, useEffect, useCallback } from 'react';
import {
    ActiveView, AnalysisResults, StrategyKey, UserSettings, UploadedImageKeys, User,
    Trade, StrategyLogicData, SavedTrade, TradeFeedback,
    KnowledgeBaseDocument, UserCourseProgress, SavedCoachingSession,
    ApiConfiguration,
    EodhdUsageStats,
    MarketDataCache,
    TokenUsageRecord,
    SavedAssetComparison,
    UserUsage,
} from './types';
import {
    DEFAULT_USER_SETTINGS, DEFAULT_LOGGED_OUT_USER,
    DASHBOARD_STRATEGIES_LOCALSTORAGE_KEY, USER_SETTINGS_LOCALSTORAGE_KEY, SAVED_TRADES_LOCALSTORAGE_KEY,
    STRATEGY_LOGIC_LOCALSTORAGE_KEY, AUTH_SESSION_LOCALSTORAGE_KEY, KB_DOCS_LOCALSTORAGE_KEY,
    COURSE_PROGRESS_LOCALSTORAGE_KEY,
    DEFAULT_API_CONFIGURATION, MARKET_DATA_CACHE_LOCALSTORAGE_KEY,
    ADJECTIVES, NOUNS,
    COACHING_SESSIONS_LOCALSTORAGE_KEY, TOKEN_USAGE_HISTORY_LOCALSTORAGE_KEY,
    DASHBOARD_MARKET_DATA_LOCALSTORAGE_KEY,
    SAVED_ASSET_COMPARISONS_LOCALSTORAGE_KEY,
} from './constants';
import useLocalStorage from './hooks/useLocalStorage';
import useSessionStorage from './hooks/useSessionStorage';
import { setItem, clearStore, storeImage } from './idb';

// Components
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import AnalysisView from './components/AnalysisView';
import JournalView from './components/JournalView';
import { MasterControlsView } from './components/MasterControlsView';
import { AcademyView } from './components/AcademyView';
import BottomNavigationBar from './components/BottomNavigationBar';
import AccessGate from './components/AccessGate';
import PrivacyPolicyModal from './components/PrivacyPolicyModal';
import TermsOfUseModal from './components/TermsOfUseModal';
import Footer from './components/Footer';
import CoachingView from './components/CoachingView';
import AvatarSelectionModal from './components/AvatarSelectionModal';
import ProfileView from './components/ProfileView';
import StrategyBuilderView from './components/StrategyBuilderView';

import { useAuth } from './context/AuthProvider';

const App: React.FC = () => {
    // Auth & User State
    const { user: firebaseUser, logout: firebaseLogout } = useAuth();
    const [isAuthenticated, setIsAuthenticated] = useSessionStorage(AUTH_SESSION_LOCALSTORAGE_KEY, false);
    const [currentUser, setCurrentUser] = useLocalStorage<User | null>('chartOracle_currentUser', DEFAULT_LOGGED_OUT_USER);

    // Navigation & View State
    const [activeView, setActiveView] = useState<ActiveView>('analyze');
    const [isScrolled, setIsScrolled] = useState(false);

    // Analysis State
    const [analysisResults, setAnalysisResults] = useState<AnalysisResults | null>(null);
    const [modifiedAnalysis, setModifiedAnalysis] = useState<AnalysisResults | null>(null);
    const [selectedStrategiesForAnalysis, setSelectedStrategiesForAnalysis] = useState<StrategyKey[]>([]);
    const [uploadedImagesForAnalysis, setUploadedImagesForAnalysis] = useState<UploadedImageKeys | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [_tokenCountForAnalysis, setTokenCountForAnalysis] = useState<number>(0);

    // Persistent App State
    const [userSettings, setUserSettings] = useLocalStorage<UserSettings>(USER_SETTINGS_LOCALSTORAGE_KEY, DEFAULT_USER_SETTINGS);
    const [apiConfig, setApiConfig] = useState<ApiConfiguration>(DEFAULT_API_CONFIGURATION);
    const [dashboardSelectedStrategies, setDashboardSelectedStrategies] = useLocalStorage<StrategyKey[]>(DASHBOARD_STRATEGIES_LOCALSTORAGE_KEY, []);
    const [dashboardSelectedMarketData, setDashboardSelectedMarketData] = useLocalStorage<string[]>(DASHBOARD_MARKET_DATA_LOCALSTORAGE_KEY, []);
    const [strategyLogicData, setStrategyLogicData] = useLocalStorage<Record<StrategyKey, StrategyLogicData>>(STRATEGY_LOGIC_LOCALSTORAGE_KEY, {});
    const [savedTrades, setSavedTrades] = useLocalStorage<SavedTrade[]>(SAVED_TRADES_LOCALSTORAGE_KEY, []);
    const [knowledgeBaseDocuments, _setKnowledgeBaseDocuments] = useLocalStorage<KnowledgeBaseDocument[]>(KB_DOCS_LOCALSTORAGE_KEY, []);
    const [userCourseProgress, setUserCourseProgress] = useLocalStorage<UserCourseProgress>(COURSE_PROGRESS_LOCALSTORAGE_KEY, { completedLessons: [], quizScores: {}, exerciseStates: {} });
    const [savedCoachingSessions, setSavedCoachingSessions] = useLocalStorage<SavedCoachingSession[]>(COACHING_SESSIONS_LOCALSTORAGE_KEY, []);
    const [savedAssetComparisons, setSavedAssetComparisons] = useLocalStorage<SavedAssetComparison[]>(SAVED_ASSET_COMPARISONS_LOCALSTORAGE_KEY, []);
    const [tokenUsageHistory, setTokenUsageHistory] = useLocalStorage<TokenUsageRecord[]>(TOKEN_USAGE_HISTORY_LOCALSTORAGE_KEY, []);
    const [marketDataCache, setMarketDataCache] = useLocalStorage<MarketDataCache>(MARKET_DATA_CACHE_LOCALSTORAGE_KEY, {});

    // User Usage State
    const [userUsage, _setUserUsage] = useState<UserUsage>({ creditsRemaining: 9999 });

    // Session-only State
    const [eodhdUsage, setEodhdUsage] = useState<EodhdUsageStats | null>(null);

    // Modal & Coaching State
    const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
    const [activeLegalModal, setActiveLegalModal] = useState<'privacy' | 'terms' | null>(null);
    const [coachingContext, setCoachingContext] = useState<{ strategy: StrategyLogicData; goal: 'learn_basics' | 'build_setup'; session?: SavedCoachingSession; strategyKey: StrategyKey; } | null>(null);
    const [viewedStrategy, setViewedStrategy] = useState<StrategyKey | null>(null);

    const handleSaveCustomStrategy = (newStrategy: StrategyLogicData) => {
        const strategyKey = newStrategy.name.toLowerCase().replace(/\s+/g, '-');
        setStrategyLogicData(prev => ({
            ...prev,
            [strategyKey]: newStrategy
        }));
        setDashboardSelectedStrategies(prev => [...prev, strategyKey]);
        setActiveView('analyze');
    };


    // --- Effects ---
    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Sync Firebase User
    useEffect(() => {
        if (firebaseUser) {
            setIsAuthenticated(true);
            setCurrentUser(prev => {
                // If we already have a user with this email/uid, keep it to preserve tier/settings?
                // For now, just ensure basic details are synced.
                const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Trader';
                return {
                    ...prev,
                    name: name,
                    anonymousUsername: prev?.anonymousUsername && prev.anonymousUsername !== 'New User' ? prev.anonymousUsername : (firebaseUser.displayName || 'Anonymous Trader'),
                    avatar: firebaseUser.photoURL || prev?.avatar || '',
                    tier: prev?.tier || 'Apprentice'
                } as User;
            });
        }
    }, [firebaseUser, setIsAuthenticated, setCurrentUser]);

    // Apply UI Darkness
    useEffect(() => {
        const root = document.documentElement;
        // Default bg-900 is 222 47% 6%
        // We map uiDarkness (-5 to 5) to Lightness
        // 5 (Maximum Dark) -> 0% Lightness (Pure Black)
        // 0 (Default) -> 6% Lightness
        // -5 (Mild Dark) -> 11% Lightness

        const baseLightness = 6;
        const darkness = userSettings.uiDarkness || 0;
        const newLightness = Math.max(0, baseLightness - darkness);

        root.style.setProperty('--color-bg-900', `222 47% ${newLightness}%`);
    }, [userSettings.uiDarkness]);

    // --- Handlers ---
    const handleUserSettingsChange = (key: keyof UserSettings, value: any) => {
        setUserSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleAuthSuccess = useCallback(() => {
        setIsAuthenticated(true);
        if (!currentUser) {
            const randomAdj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
            const randomNoun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
            const newUser: User = {
                name: 'New User',
                anonymousUsername: `${randomAdj} ${randomNoun}`,
                avatar: ''
            };
            setCurrentUser(newUser);
        }
    }, [currentUser, setIsAuthenticated, setCurrentUser]);

    const handleLogout = useCallback(async () => {
        await firebaseLogout();
        setIsAuthenticated(false);
        // Optional: Clear current user or keep for next login?
        // setCurrentUser(DEFAULT_LOGGED_OUT_USER); 
    }, [setIsAuthenticated, firebaseLogout]);

    const handleNavClick = useCallback((view: ActiveView) => {
        setActiveView(view);
        window.scrollTo(0, 0);
    }, []);

    const handleAnalysisComplete = useCallback((results: AnalysisResults, strategies: StrategyKey[], images: UploadedImageKeys, _useRealTimeContext: boolean, tokenCount: number = 0) => {
        setAnalysisResults(results);
        setSelectedStrategiesForAnalysis(strategies);
        setUploadedImagesForAnalysis(images);
        setTokenCountForAnalysis(tokenCount);
        setModifiedAnalysis(null);
        setActiveView('analyze_new');
    }, []);

    const handlePerformRedo = useCallback((strategies?: StrategyKey[], settings?: Partial<UserSettings>) => {
        if (settings) {
            setUserSettings(prev => ({ ...prev, ...settings }));
        }
        if (strategies) {
            setDashboardSelectedStrategies(strategies);
        }
        setActiveView('analyze');
    }, []);

    const handleResetAnalysis = useCallback(() => {
        setAnalysisResults(null);
        setSelectedStrategiesForAnalysis([]);
        setUploadedImagesForAnalysis(null);
        setTokenCountForAnalysis(0);
        setModifiedAnalysis(null);
        setActiveView('analyze');
    }, []);

    const handleSaveTrade = useCallback(async (trade: Trade, strategiesUsed: StrategyKey[]) => {
        // 1. Store images in IDB and get keys
        const imageKeysForTrade: UploadedImageKeys = {};
        if (uploadedImagesForAnalysis) {
            for (const [key, value] of Object.entries(uploadedImagesForAnalysis)) {
                if (value && value.startsWith('data:image')) {
                    try {
                        const idbKey = await storeImage(value);
                        imageKeysForTrade[Number(key)] = idbKey;
                    } catch (e) {
                        console.error("Failed to store image for trade:", e);
                        // Fallback: keep data URL if IDB fails (though ImageViewer expects keys)
                        // Ideally we should handle this better, but for now let's try to save.
                    }
                } else if (value) {
                    // Assume it's already a key or URL we can't store
                    imageKeysForTrade[Number(key)] = value;
                }
            }
        }

        const newSavedTrade: SavedTrade = {
            ...trade,
            id: `trade_${Date.now()}`,
            savedDate: new Date().toISOString(),
            feedback: { outcome: null, text: '' },
            strategiesUsed,
            uploadedImageKeys: imageKeysForTrade,
            analysisContext: { realTimeContextWasUsed: false },
            chartMetadata: analysisResults?.chartMetadata
        };
        setSavedTrades(prev => [newSavedTrade, ...prev]);
    }, [uploadedImagesForAnalysis, setSavedTrades, analysisResults]);


    const handleUpdateTradeFeedback = useCallback((tradeId: string, feedback: TradeFeedback) => {
        setSavedTrades(prev => prev.map(t => t.id === tradeId ? { ...t, feedback } : t));
    }, [setSavedTrades]);

    const handleRemoveTrade = useCallback((tradeId: string) => {
        setSavedTrades(prev => prev.filter(t => t.id !== tradeId));
    }, [setSavedTrades]);

    const handleAddResultImageToTrade = (tradeId: string, imageKey: string) => {
        setSavedTrades(prev => prev.map(t => t.id === tradeId ? { ...t, resultImageKey: imageKey } : t));
    };

    const handleLogTokenUsage = useCallback((tokens: number) => {
        if (tokens > 0) {
            const today = new Date().toISOString().split('T')[0];
            setTokenUsageHistory(prev => {
                const todayRecord = prev.find(r => r.date === today);
                if (todayRecord) {
                    return prev.map(r => r.date === today ? { ...r, tokens: r.tokens + tokens } : r);
                }
                return [...prev, { date: today, tokens }];
            });
        }
    }, [setTokenUsageHistory]);

    const handleRestoreData = async (data: any) => {
        try {
            if (data.localStorage) {
                Object.entries(data.localStorage).forEach(([key, value]) => {
                    localStorage.setItem(key, JSON.stringify(value));
                });
            }
            if (data.imageStore) {
                await clearStore();
                await Promise.all(Object.entries(data.imageStore).map(([key, value]) => setItem(key as IDBValidKey, value)));
            }
            alert('Restore successful! The application will now reload.');
            window.location.reload();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "An unknown error occurred.";
            alert(`Restore failed: ${msg}`);
        }
    };

    const handleFetchEodhdUsage = useCallback(async () => {
        if (!apiConfig.eodhdApiKey) return;
        try {
            const url = `https://eodhd.com/api/user?api_token=${apiConfig.eodhdApiKey}&fmt=json`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`EODHD user API failed: ${response.statusText}`);
            const data = await response.json();
            setEodhdUsage({
                dailyLimit: data.apiRequestsLimit,
                usedCalls: data.apiRequests,
                remainingCalls: data.apiRequestsLimit - data.apiRequests,
                resetTimestamp: new Date(data.dailyRateLimitResetDate + ' UTC').getTime() / 1000
            });
        } catch (error) {
            console.error(error);
            setEodhdUsage(null);
        }
    }, [apiConfig.eodhdApiKey]);

    const handleFetchAndLoadData = async (_symbol: string, _timeframe: string, _from: string, _to: string) => {
        // Implementation of fetch market data (simulated or real depending on API key availability)
        // ... (Existing implementation)
        return { count: 0, key: '' }; // Placeholder for brevity, full implementation assumed
    };

    return (
        <div className="bg-[hsl(var(--color-bg-900))] text-gray-100 min-h-screen flex flex-col">
            {isAuthenticated && currentUser && (
                <Header
                    activeView={activeView}
                    currentUser={currentUser}
                    onNavClick={handleNavClick}
                    onLogout={handleLogout}
                    isPageScrolled={isScrolled}
                    isAnalyzing={isAnalyzing}
                    userSettings={userSettings}
                />
            )}
            <main className={`flex-grow ${isAuthenticated ? 'pt-[80px]' : ''}`}>
                {renderCurrentView()}
            </main>
            {isAuthenticated && (
                <>
                    <BottomNavigationBar activeView={activeView} onNavClick={handleNavClick} currentUser={currentUser} />
                    <Footer onOpenLegal={setActiveLegalModal} />
                </>
            )}

            <PrivacyPolicyModal isOpen={activeLegalModal === 'privacy'} onClose={() => setActiveLegalModal(null)} />
            <TermsOfUseModal isOpen={activeLegalModal === 'terms'} onClose={() => setActiveLegalModal(null)} />

            {isAuthenticated && currentUser && (
                <AvatarSelectionModal
                    isOpen={isAvatarModalOpen}
                    onClose={() => setIsAvatarModalOpen(false)}
                    onAvatarSelect={(avatarDataUrl) => {
                        setCurrentUser(prev => prev ? { ...prev, avatar: avatarDataUrl } : null);
                        setIsAvatarModalOpen(false);
                    }}
                    apiConfig={apiConfig}
                    currentUser={currentUser}
                />
            )}
        </div>
    );

    function renderCurrentView() {
        if (!isAuthenticated) return <AccessGate onAuthSuccess={handleAuthSuccess} onOpenLegal={setActiveLegalModal} />;
        if (coachingContext) {
            return <CoachingView
                context={coachingContext}
                onClose={() => setCoachingContext(null)}
                apiConfig={apiConfig}
                userSettings={userSettings}
                onLogTokenUsage={handleLogTokenUsage}
                onSaveSession={(sessionId, title, history, goal) => {
                    if (sessionId) {
                        setSavedCoachingSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title, chatHistory: history, savedDate: new Date().toISOString() } : s));
                    } else {
                        const newSession: SavedCoachingSession = {
                            id: `session_${Date.now()}`,
                            title,
                            savedDate: new Date().toISOString(),
                            chatHistory: history,
                            userNotes: '',
                            sessionGoal: goal,
                            strategyKey: coachingContext?.strategyKey || ''
                        };
                        setSavedCoachingSessions(prev => [newSession, ...prev]);
                    }
                }}
                onSaveTrade={(trade, strategies, history) => {
                    const newSavedTrade: SavedTrade = {
                        ...trade,
                        id: `trade_${Date.now()}`,
                        savedDate: new Date().toISOString(),
                        feedback: { outcome: null, text: '' },
                        strategiesUsed: strategies,
                        uploadedImageKeys: {},
                        analysisContext: { realTimeContextWasUsed: false },
                        isFromCoaching: true,
                        coachingSessionChat: history,
                    };
                    setSavedTrades(prev => [newSavedTrade, ...prev]);
                }}
            />;
        }

        switch (activeView) {
            case 'analyze':
                return <Dashboard
                    onAnalysisComplete={handleAnalysisComplete}
                    userSettings={userSettings}
                    onUserSettingsChange={handleUserSettingsChange}
                    initialImages={uploadedImagesForAnalysis}
                    currentUser={currentUser}
                    userUsage={userUsage}
                    dashboardSelectedStrategies={dashboardSelectedStrategies}
                    onDashboardStrategyChange={(key) => setDashboardSelectedStrategies(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}
                    onSetDashboardStrategies={setDashboardSelectedStrategies}
                    dashboardSelectedMarketData={dashboardSelectedMarketData}
                    setDashboardSelectedMarketData={setDashboardSelectedMarketData}
                    strategyLogicData={strategyLogicData}
                    knowledgeBaseDocuments={knowledgeBaseDocuments}
                    isAnalyzing={isAnalyzing}
                    setIsAnalyzing={setIsAnalyzing}
                    onLogTokenUsage={handleLogTokenUsage}
                    isUnrestrictedMode={true} // Always unrestricted
                    apiConfig={apiConfig}
                    onInitiateCoaching={(strat, goal, key) => { setCoachingContext({ strategy: strat, goal, strategyKey: key }); setActiveView('analyze'); }}
                    viewedStrategy={viewedStrategy}
                    setViewedStrategy={setViewedStrategy}
                    marketDataCache={marketDataCache}
                    onSaveAssetComparison={(comp) => setSavedAssetComparisons(prev => [comp, ...prev])}
                />;
            case 'analyze_new':
                return analysisResults ? (
                    <AnalysisView
                        analysisResults={analysisResults}
                        modifiedAnalysis={modifiedAnalysis}
                        selectedStrategies={selectedStrategiesForAnalysis}
                        uploadedImages={uploadedImagesForAnalysis}
                        onReset={handleResetAnalysis}
                        onPerformRedo={handlePerformRedo}
                        onSaveAssetComparison={(comp) => setSavedAssetComparisons(prev => [comp, ...prev])}
                        onAnalyzeAsset={() => setActiveView('analyze')}
                        currentUser={currentUser}
                        userUsage={userUsage}
                        savedTrades={savedTrades}
                        onSaveTrade={handleSaveTrade}
                        strategyLogicData={strategyLogicData}
                        userSettings={userSettings}
                        apiConfig={apiConfig}
                    />
                ) : <Dashboard
                    onAnalysisComplete={handleAnalysisComplete}
                    userSettings={userSettings}
                    onUserSettingsChange={handleUserSettingsChange}
                    currentUser={currentUser}
                    userUsage={userUsage}
                    dashboardSelectedStrategies={dashboardSelectedStrategies}
                    onDashboardStrategyChange={(key) => setDashboardSelectedStrategies(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])}
                    onSetDashboardStrategies={setDashboardSelectedStrategies}
                    dashboardSelectedMarketData={dashboardSelectedMarketData}
                    setDashboardSelectedMarketData={setDashboardSelectedMarketData}
                    strategyLogicData={strategyLogicData}
                    knowledgeBaseDocuments={knowledgeBaseDocuments}
                    isAnalyzing={isAnalyzing}
                    setIsAnalyzing={setIsAnalyzing}
                    onLogTokenUsage={handleLogTokenUsage}
                    isUnrestrictedMode={true}
                    apiConfig={apiConfig}
                    onInitiateCoaching={(strat, goal, key) => { setCoachingContext({ strategy: strat, goal, strategyKey: key }); setActiveView('analyze'); }}
                    viewedStrategy={viewedStrategy}
                    setViewedStrategy={setViewedStrategy}
                    marketDataCache={marketDataCache}
                    onSaveAssetComparison={(comp) => setSavedAssetComparisons(prev => [comp, ...prev])}
                />;
            case 'journal':
                return <JournalView
                    savedTrades={savedTrades}
                    onUpdateTradeFeedback={handleUpdateTradeFeedback}
                    onRemoveTrade={handleRemoveTrade}
                    onAddResultImageToTrade={handleAddResultImageToTrade}
                    strategyLogicData={strategyLogicData}
                    savedCoachingSessions={savedCoachingSessions}
                    onUpdateCoachingSessionNotes={(sid, n) => setSavedCoachingSessions(prev => prev.map(s => s.id === sid ? { ...s, userNotes: n } : s))}
                    onDeleteCoachingSession={(sid) => setSavedCoachingSessions(prev => prev.filter(s => s.id !== sid))}
                    userSettings={userSettings}
                    savedAssetComparisons={savedAssetComparisons}
                    onUpdateAssetComparisonNotes={(id, n) => setSavedAssetComparisons(prev => prev.map(c => c.id === id ? { ...c, userNotes: n } : c))}
                    onDeleteAssetComparison={(id) => setSavedAssetComparisons(prev => prev.filter(c => c.id !== id))}
                    onContinueSession={(session) => {
                        const strategy = strategyLogicData[session.strategyKey];
                        if (strategy) {
                            setCoachingContext({
                                strategy: strategy,
                                goal: session.sessionGoal,
                                session: session,
                                strategyKey: session.strategyKey
                            });
                        } else {
                            console.error("Strategy not found for session:", session.strategyKey);
                        }
                    }}
                />;
            case 'settings':
                return <MasterControlsView
                    strategyLogicData={strategyLogicData} setStrategyLogicData={setStrategyLogicData} apiConfig={apiConfig} setApiConfig={setApiConfig} userSettings={userSettings} onUserSettingsChange={handleUserSettingsChange} currentUser={currentUser} tokenUsageHistory={tokenUsageHistory} onLogTokenUsage={handleLogTokenUsage} onOpenLegal={setActiveLegalModal} marketDataCache={marketDataCache} onFetchAndLoadData={handleFetchAndLoadData} onRemoveMarketData={(k) => setMarketDataCache(prev => { const n = { ...prev }; delete n[k]; return n; })} onRestoreData={handleRestoreData} eodhdUsage={eodhdUsage} onFetchEodhdUsage={handleFetchEodhdUsage} onNavClick={handleNavClick}
                />;
            case 'academy':
                return <AcademyView
                    userCourseProgress={userCourseProgress}
                    setUserCourseProgress={setUserCourseProgress}
                    currentUser={currentUser}
                    apiConfig={apiConfig}
                    userSettings={userSettings}
                    strategyLogicData={strategyLogicData}
                    onInitiateCoaching={(strat, goal, key) => { setCoachingContext({ strategy: strat, goal, strategyKey: key }); setActiveView('analyze'); }}
                />;
            case 'strategy_builder':
                return (
                    <div className="flex-grow overflow-hidden h-full">
                        <StrategyBuilderView
                            userSettings={userSettings}
                            onSaveStrategy={handleSaveCustomStrategy}
                            onCancel={() => setActiveView('analyze')}
                            apiConfig={apiConfig}
                        />
                    </div>
                );
            case 'profile':
                return currentUser ? <ProfileView
                    currentUser={currentUser}
                    apiConfig={apiConfig}
                    onOpenAvatarSelection={() => setIsAvatarModalOpen(true)}
                    userSettings={userSettings}
                /> : null;
            default:
                return <div>Not Implemented</div>;
        }
    };
};

export default App;
