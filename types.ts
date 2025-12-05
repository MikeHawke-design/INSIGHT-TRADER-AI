
// A type to represent the temporary, full-data format of an image before it's stored.
export interface UploadedImageData {
    name: string;
    type: string;
    dataUrl: string;
}

export type StrategyKey = string;

export type TradeDirection = 'Long' | 'Short';
export type EntryType = 'Limit Order' | 'Confirmation Entry';

export interface TradeManagement {
    move_to_breakeven_condition: string;
    partial_take_profit_1: string;
    partial_take_profit_2: string;
}

export interface Trade {
    type: string;
    direction: TradeDirection;
    symbol: string;
    entry: string;
    entryType: EntryType;
    entryExplanation: string;
    stopLoss: string;
    takeProfit1: string;
    takeProfit2: string;
    heat: number;
    explanation: string;
    isModified?: boolean; // Added for tracking modified trades
    tradeManagement?: TradeManagement;
}

export type TradeOutcome = 'TP1 & TP2' | 'TP1 -> B/E' | 'TP1' | 'B/E' | 'SL' | null;

export interface TradeFeedback {
    outcome: TradeOutcome;
    text: string;
}

export type UploadedImageKeys = Record<number, string | null>;

export interface AssetComparisonResult {
    asset: string;
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
    heat: number;
    brief: string;
}

export interface AnalysisResults {
    'Top Longs': Trade[];
    'Top Shorts': Trade[];
    strategySuggestion: StrategySuggestion;
    chartMetadata?: Record<string, string>;
    assetComparisonResults?: AssetComparisonResult[];
    councilDiscussion?: string;
}

export interface SavedTrade extends Trade {
    id: string;
    savedDate: string;
    feedback: TradeFeedback;
    strategiesUsed: StrategyKey[];
    uploadedImageKeys: UploadedImageKeys;
    resultImageKey?: string; // Optional key for result image
    analysisContext: {
        realTimeContextWasUsed: boolean;
    };
    isFromCoaching?: boolean;
    coachingSessionChat?: ChatMessage[];
    chartMetadata?: Record<string, string>;
}

export interface StrategySuggestion {
    suggestedStrategies: StrategyKey[];
    suggestedSettings: Partial<UserSettings>;
    reasoning: string;
}

export type UserTier = 'Apprentice' | 'Traditional Trader' | 'Advanced AI';

export interface User {
    name: string;
    anonymousUsername: string;
    avatar?: string;
    tier?: UserTier;
}

export interface UserUsage {
    creditsRemaining: number;
}

export interface SubscriptionPlan {
    id: UserTier;
    name: string;
    description: string;
    price: number;
    priceFrequency: string;
    features: string[];
    featured?: boolean;
    addOn?: {
        name: string;
        description: string;
        price: number;
    };
}

export type RiskAppetite = 'Conservative' | 'Moderate' | 'Aggressive';
export type PreferredTradeDuration = 'Any' | 'Short-term' | 'Medium-term' | 'Long-term';
export type StopLossStrategy = 'Standard' | 'Structure-Buffered';

export interface UserSettings {
    riskAppetite: RiskAppetite;
    minRiskRewardRatio: number;
    preferredTradeDuration: PreferredTradeDuration;
    tradeAgainstTrend: boolean;
    stopLossStrategy: StopLossStrategy;
    preferredAssetClass: string;
    marketTiming: string;
    // Appearance
    uiFontSize: number;
    headingFontSize: number;
    dataFontSize: number;
    chatFontSize: number;
    uiDarkness: number;
    aiSystemMode: 'single' | 'hybrid' | 'council';
    aiProvider: 'gemini' | 'openai' | 'groq';
    aiProviderAnalysis: 'gemini' | 'openai' | 'groq';
    aiProviderChat: 'gemini' | 'openai' | 'groq';
}

export interface StrategyLogicData {
    name: string;
    status: 'active' | 'beta' | 'archived';
    description: string;
    prompt: string;
    requirements?: {
        title: string;
        items: string[];
    };
    isEnabled?: boolean;
    parentId?: string; // For grouping strategies (e.g., "SMC" parent)
    confluence?: string[]; // Array of StrategyKeys that this relies on/combines with
    tags?: string[];
    assetClasses?: string[];
    timeZoneSpecificity?: string;
    tradingStyles?: string[];
    courseModule?: CourseModule; // Linked academy content
    imageLibrary?: { key: string; description: string }[]; // Images for coaching
}

export interface TimeFrameStep {
    step: number;
    title: string;
    subtitle: string;
}

export interface ChatMessage {
    id: string;
    sender: 'user' | 'oracle';
    text: string;
    timestamp: Date;
    type: 'text' | 'image_upload' | 'system';
    choices?: { text: string, prompt?: string }[];
    requiresImageUpload?: boolean;
    validationResult?: {
        status: 'passed' | 'failed';
        feedback: string;
    };
    imageKeys?: string[]; // For user uploads
    displayImageKey?: string; // For AI showing examples
    tradePlan?: Trade;
}

export interface SavedCoachingSession {
    id: string;
    title: string;
    savedDate: string;
    chatHistory: ChatMessage[];
    userNotes: string;
    sessionGoal: 'learn_basics' | 'build_setup';
    strategyKey: StrategyKey;
}

export interface KnowledgeBaseDocument {
    id: string;
    title: string;
    content: string; // Raw text or structured content
    tags: string[];
    dateAdded: string;
}

// Academy Types
export interface CourseModule {
    id: string;
    title: string;
    description: string;
    lessons: CourseLesson[];
    quiz: QuizQuestion[];
}

export interface CourseLesson {
    id: string;
    title: string;
    estimatedTime: string;
    blocks: LessonBlock[];
}

export type LessonBlock =
    | { type: 'text'; content: string }
    | { type: 'image'; url: string; caption?: string }
    | { type: 'exercise'; prompt: string; validationPrompt: string }; // validationPrompt for AI vision check

export interface LessonBlockExercise {
    status: 'pending' | 'passed' | 'failed';
    imageKey?: string;
    feedback?: string;
}

export interface QuizQuestion {
    question: string;
    options: string[];
    correctAnswer: string;
    explanationPrompt: string; // Prompt for AI to explain the answer
}

export interface UserCourseProgress {
    completedLessons: string[]; // IDs of completed lessons
    quizScores: Record<string, number>; // Module ID -> Score %
    exerciseStates: Record<string, LessonBlockExercise>; // LessonBlock ID -> State
}

export interface GlossaryTerm {
    displayName: string;
    description: string;
    imageUrl?: string;
}

export type ActiveView = 'analyze' | 'analyze_new' | 'academy' | 'journal' | 'settings' | 'profile' | 'strategy_builder';

export interface ApiConfiguration {
    geminiApiKey?: string;
    openaiApiKey?: string;
    groqApiKey?: string;
}

export interface RiskManagementSettings {
    riskPercentagePerTrade: number; // % of account to risk per trade (e.g., 1, 2, 3)
    maxPositionSize: number; // Maximum position size as % of account
    useStopLoss: boolean; // Always use stop loss
    useTakeProfit: boolean; // Always use take profit
    minRiskRewardRatio: number; // Minimum R:R ratio to accept (e.g., 1.5, 2, 3)
    maxDailyTrades: number; // Maximum number of trades per day
    maxOpenPositions: number; // Maximum concurrent open positions
}

export interface TokenUsageRecord {
    date: string;
    tokens: number;
}
