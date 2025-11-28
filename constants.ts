
import { TimeFrameStep, UserSettings, RiskAppetite, PreferredTradeDuration, User, CourseModule, GlossaryTerm, StopLossStrategy, ApiConfiguration, UserTier, SubscriptionPlan } from './types';

export const TIME_FRAMES_STEPS: TimeFrameStep[] = [
    { step: 1, title: 'Weekly Chart', subtitle: 'Long-term Macro View' },
    { step: 2, title: 'Daily Chart', subtitle: 'Overall Structure, Key OBs/Liquidity' },
    { step: 3, title: '4H Chart', subtitle: 'Refined Zones, Intermediate Trend' },
    { step: 4, title: '15m Chart', subtitle: 'Entry Confirmation, FVG, LTF Shift' },
    { step: 5, title: '1m Chart', subtitle: 'Scalp Entry Precision' },
];

export const DEFAULT_USER_SETTINGS: UserSettings = {
    riskAppetite: 'Moderate',
    minRiskRewardRatio: 2,
    preferredTradeDuration: 'Any',
    tradeAgainstTrend: false,
    stopLossStrategy: 'Standard',
    preferredAssetClass: 'Any',
    marketTiming: 'Any',
    // Font sizes
    uiFontSize: 14,
    headingFontSize: 18,
    dataFontSize: 16,
    chatFontSize: 14,
    uiDarkness: 0,
    aiProvider: 'gemini',
};

export const DEFAULT_API_CONFIGURATION: ApiConfiguration = {
    eodhdApiKey: '',
};

export const USER_TIERS = {
    APPRENTICE: 'Apprentice' as UserTier,
    TRADITIONAL_TRADER: 'Traditional Trader' as UserTier,
    ADVANCED_AI: 'Advanced AI' as UserTier,
};

export const CREDIT_COSTS = {
    ANALYSIS: 1,
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
    {
        id: USER_TIERS.APPRENTICE,
        name: 'Apprentice',
        description: 'For beginners learning the ropes.',
        price: 0,
        priceFrequency: 'Free Forever',
        features: ['Basic Strategies', 'Daily Market Data', 'Community Access'],
    },
    {
        id: USER_TIERS.TRADITIONAL_TRADER,
        name: 'Traditional Trader',
        description: 'Standard tools for serious traders.',
        price: 29,
        priceFrequency: '/month',
        features: ['Advanced Strategies', 'Unlimited Backtesting', 'Priority Support'],
        featured: true,
    },
    {
        id: USER_TIERS.ADVANCED_AI,
        name: 'Advanced AI (BYOA)',
        description: 'Bring Your Own API Key for unlimited power.',
        price: 9,
        priceFrequency: '/month',
        features: ['BYO API Key', 'Custom Models', 'API Access'],
        addOn: {
            name: 'Cloud GPU',
            description: 'Faster processing',
            price: 15
        }
    }
];

export const RISK_APPETITE_OPTIONS: RiskAppetite[] = ['Conservative', 'Moderate', 'Aggressive'];
export const PREFERRED_TRADE_DURATION_OPTIONS: PreferredTradeDuration[] = ['Any', 'Short-term', 'Medium-term', 'Long-term'];
export const PREFERRED_TRADE_DURATION_DETAILS: Record<PreferredTradeDuration, string> = {
    'Any': 'No preference, consider all types.',
    'Short-term': 'Focus on Scalps and quick Day Trades.',
    'Medium-term': 'Focus on Day Trades and shorter Swing Trades.',
    'Long-term': 'Focus on Swing Trades and longer-term positions.'
};

export const STOP_LOSS_STRATEGY_OPTIONS: StopLossStrategy[] = ['Standard', 'Structure-Buffered'];
export const STOP_LOSS_STRATEGY_DETAILS: Record<StopLossStrategy, string> = {
    'Standard': 'AI places stop-loss based on direct strategy rules.',
    'Structure-Buffered': 'AI places stop-loss with an extra buffer outside key market structure levels, useful for volatile assets.'
};

export const ASSET_CLASS_OPTIONS: string[] = ['Any', 'Forex', 'Crypto', 'Indices', 'Commodities', 'Stocks'];
export const MARKET_TIMING_OPTIONS: string[] = ['Any', 'Market Open (General)', 'London Session', 'New York Session', 'Asia Session', 'London Killzone', 'New York Killzone', 'Weekend (Crypto)'];

// --- Gamification Constants ---
export const ADJECTIVES = ['Nimble', 'Sharp', 'Clever', 'Wise', 'Quantum', 'Zen', 'Alpha', 'Stealthy', 'Dynamic', 'Fluid'];
export const NOUNS = ['Trader', 'Fox', 'Lynx', 'Oracle', 'Voyager', 'Specter', 'Edge', 'Nexus', 'Pioneer', 'Catalyst'];

export const DEFAULT_LOGGED_OUT_USER: User | null = null;

// --- Beta Access Keys ---
export const BETA_ACCESS_KEYS = [
    'oracle-master-key-alpha-7'
];


// --- LocalStorage Keys ---
export const SAVED_TRADES_LOCALSTORAGE_KEY = 'chartOracle_savedTrades';
export const USER_SETTINGS_LOCALSTORAGE_KEY = 'chartOracle_userSettings';
export const DASHBOARD_STRATEGIES_LOCALSTORAGE_KEY = 'chartOracle_dashboardStrategies';
export const DASHBOARD_MARKET_DATA_LOCALSTORAGE_KEY = 'chartOracle_dashboardMarketData';
export const STRATEGY_LOGIC_LOCALSTORAGE_KEY = 'chartOracle_strategyLogicData';
export const KB_DOCS_LOCALSTORAGE_KEY = 'chartOracle_knowledgeBaseDocuments';
export const CHAT_MESSAGES_LOCALSTORAGE_KEY = 'chartOracle_chatMessages';
export const AUTH_SESSION_LOCALSTORAGE_KEY = 'chartOracle_sessionActive';
export const COURSE_PROGRESS_LOCALSTORAGE_KEY = 'chartOracle_courseProgress';
export const COACHING_ONBOARDING_LOCALSTORAGE_KEY = 'chartOracle_coachingOnboardingComplete';
export const COACHING_SESSIONS_LOCALSTORAGE_KEY = 'chartOracle_coachingSessions';
export const TOKEN_USAGE_HISTORY_LOCALSTORAGE_KEY = 'chartOracle_tokenUsageHistory';
export const MARKET_DATA_CACHE_LOCALSTORAGE_KEY = 'chartOracle_marketDataCache';
export const SAVED_ASSET_COMPARISONS_LOCALSTORAGE_KEY = 'chartOracle_assetComparisons';
export const API_CONFIG_LOCALSTORAGE_KEY = 'chartOracle_apiConfig';


// For the backup/restore feature
export const ALL_PERSISTENT_STORAGE_KEYS = [
    SAVED_TRADES_LOCALSTORAGE_KEY,
    USER_SETTINGS_LOCALSTORAGE_KEY,
    DASHBOARD_STRATEGIES_LOCALSTORAGE_KEY,
    DASHBOARD_MARKET_DATA_LOCALSTORAGE_KEY,
    STRATEGY_LOGIC_LOCALSTORAGE_KEY,
    KB_DOCS_LOCALSTORAGE_KEY,
    CHAT_MESSAGES_LOCALSTORAGE_KEY,
    AUTH_SESSION_LOCALSTORAGE_KEY,
    COURSE_PROGRESS_LOCALSTORAGE_KEY,
    COACHING_ONBOARDING_LOCALSTORAGE_KEY,
    COACHING_SESSIONS_LOCALSTORAGE_KEY,
    TOKEN_USAGE_HISTORY_LOCALSTORAGE_KEY,
    MARKET_DATA_CACHE_LOCALSTORAGE_KEY,
    SAVED_ASSET_COMPARISONS_LOCALSTORAGE_KEY,
    API_CONFIG_LOCALSTORAGE_KEY,
];

export const DEMO_TICKERS: string[] = [
    'AAPL.US', 'MSFT.US', 'TSLA.US', 'MCD.US', 'VTI.US', 'SWPPX.US', 'EURUSD.FOREX', 'BTC-USD.CC'
];

export const STRATEGY_BUILDER_PROMPT = `
You are an expert Trading Strategy Architect. Your goal is to help the user define a robust, rule-based trading strategy.

**Your Role:**
1.  **Consultant:** Ask clarifying questions to understand the user's trading style (scalping, swing), preferred indicators (RSI, MACD, EMA), and risk tolerance.
2.  **Architect:** Synthesize their requirements into a structured strategy.
3.  **Guardian:** Prevent "hallucinations" or vague logic. Ensure every rule is precise and actionable (e.g., instead of "buy when strong", use "buy when price closes above the 200 EMA").
4.  **Output Generator:** When the strategy is clear, you MUST output a JSON object representing the strategy.

**Supported Concepts (Tried & Tested):**
- **Price Action:** Support/Resistance, Trendlines, Candlestick Patterns (Pin bar, Engulfing), Market Structure (HH/HL).
- **Indicators:** RSI, MACD, EMA/SMA, Bollinger Bands, ATR.
- **Concepts:** ICT (Fair Value Gaps, Order Blocks), Smart Money Concepts.

**Interaction Flow:**
- If the user's request is vague, ask for specific conditions for Entry, Stop Loss, and Take Profit.
- If the user suggests something risky or unproven, gently suggest a more standard alternative.
- Once the user confirms the rules, generate the JSON.

**JSON Output Format (Final Step):**
When the strategy is ready, output a JSON block like this:
\`\`\`json
{
  "name": "Strategy Name",
  "description": "Brief description of the strategy.",
  "prompt": "A detailed, step-by-step instruction for an AI analyst to execute this strategy. Use 'You must...' language. Include specific checks for Entry, Stop Loss placement, and Take Profit targets.",
  "requirements": {
    "title": "Strategy Rules",
    "items": [
      "Rule 1: ...",
      "Rule 2: ..."
    ]
  },
  "assetClasses": ["Crypto", "Forex"],
  "timeZoneSpecificity": "Any"
}
\`\`\`

**Crucial for the 'prompt' field:**
The 'prompt' you generate will be fed into another AI to analyze charts. It must be EXTREMELY detailed and follow this EXACT structure to ensure the analyzer understands it perfectly:

"**STRATEGY ANALYSIS PROTOCOL:**
1. **SETUP IDENTIFICATION:** [Detailed visual description of the pattern or market condition to look for. Be specific about candle shapes, trend direction, and indicator states.]
2. **ENTRY TRIGGER:** [The exact condition that signals an entry. e.g., 'Enter on the close of the bullish engulfing candle'.]
3. **STOP LOSS PLACEMENT:** [Precise rule for where to place the Stop Loss. e.g., '5 pips below the swing low'.]
4. **TAKE PROFIT TARGETS:** [Rules for TP1 and TP2. e.g., 'TP1 at 1:1.5 Risk/Reward, TP2 at next resistance'.]
5. **INVALIDATION CRITERIA:** [Specific conditions that would make this setup invalid. e.g., 'If price closes below the 200 EMA, invalidate'.]"

Use 'You must...' language. Do not be vague.
`;

// --- Glossary for Interactive Tooltips ---
export const GLOSSARY: Record<string, Omit<GlossaryTerm, 'imageUrl'>> = {
    BULLISH_PIN_BAR: {
        displayName: 'Bullish Pin Bar',
        description: 'A candlestick with a long lower wick and a small body, signaling potential bullish reversal as buyers rejected lower prices.',
    },
    BULLISH_ENGULFING: {
        displayName: 'Bullish Engulfing',
        description: 'A two-candle pattern where a small bearish candle is completely "engulfed" by a larger bullish candle, indicating a strong shift to buying pressure.',
    },
    INSIDE_BAR_BREAKOUT: {
        displayName: 'Inside Bar False Breakout',
        description: 'An "inside bar" forms within the range of the previous candle. A false breakout occurs when price briefly breaks one way (e.g., down) and then strongly reverses, trapping traders.',
    },
    HEAD_AND_SHOULDERS: {
        displayName: 'Head and Shoulders',
        description: 'A bearish reversal pattern with three peaks: a central "head" higher than the two "shoulders". A break of the "neckline" confirms the pattern.',
    },
    FAIR_VALUE_GAP: {
        displayName: 'Fair Value Gap',
        description: 'An inefficient 3-candle price move, leaving a gap between the wicks of the 1st and 3rd candles. These gaps often act as magnets for price to return to.',
    },
    ORDER_BLOCK: {
        displayName: 'Order Block',
        description: 'The last up or down candle before an impulsive move that breaks market structure. These zones are often revisited by price, offering potential entry points.',
    },
};

// --- Academy Course Content ---

// Shared validation prompt function to reduce redundancy
const createValidationPrompt = (instruction: string, passExample: string, failExample: string, specificRules: string): string => {
    return `You are an expert trading coach AI with advanced computer vision, tasked with evaluating a student's chart homework.

**The user was given this instruction:** "${instruction}"

**Your Evaluation Protocol (Follow these steps PRECISELY):**

1.  **CRITICAL DIRECTIVE: FIND THE USER'S MARKINGS.** Your first and most important job is to find what the user has drawn on the chart. Meticulously scrutinize the entire image for ANY user-added annotations like lines, boxes, circles, arrows, or text. They may be subtle or low-contrast. Do not conclude the chart is "clean" until you are absolutely certain there are no markings.
    - **CRITICAL RULE:** The standard 'current price line' (often dotted/dashed) is NOT a user annotation. IGNORE IT.
    - **If you find ANY markings:** You MUST proceed to Step 2 to evaluate them.
    - **Only if you are 100% certain the image is a raw, unmarked chart,** should you use the "FAIL: ... no markings" response. Your response in this case MUST be: "FAIL: It looks like you've uploaded a clean chart, but I don't see any markings to evaluate. Please use your trading platform's drawing tools to mark your answer as instructed. **For best results, use a bright color (like yellow or blue) and make your lines reasonably thick.** Then resubmit the chart!"

2.  **Evaluate Markings Against Rules:** If you identified annotations in Step 1, now you must evaluate them against the specific rules for this exercise.
    **Specific Rules:**
    ${specificRules}

3.  **Formulate Final Response:** Based on your evaluation in Step 2, your response MUST begin with "PASS:" or "FAIL:".
    - **If COMPLETELY correct:** Start with "PASS:". Congratulate the user and briefly confirm why their markings are correct. Example: "PASS: ${passExample}"
    - **If INCORRECT:** Start with "FAIL:". Provide clear, constructive, and specific feedback based on the rules. Explain the error precisely. Example: "FAIL: ${failExample}"`;
};

export const FOUNDATIONAL_MODULES: CourseModule[] = [
    {
        id: 'M1',
        title: 'Module 1: The Foundations',
        description: 'Start your journey here. Learn the absolute basics of reading a chart, understanding market movements, and identifying simple trends.',
        lessons: [
            {
                id: 'M1_L1', title: 'What is a Candlestick?', estimatedTime: '8 min',
                blocks: [{
                    type: 'text',
                    content: `Welcome to your first lesson! A candlestick chart is the most common way traders visualize price. Think of each candle as a story of a battle between buyers (bulls) and sellers (bears) over a specific time period (e.g., 15 minutes, 1 day).\n\nA candle has four key price points:\n- <strong>Open:</strong> The price at the beginning of the period.\n- <strong>High:</strong> The highest price reached during the period.\n- <strong>Low:</strong> The lowest price reached during the period.\n- <strong>Close:</strong> The price at the end of the period.\n\nThe 'body' of the candle is the rectangular part, representing the range between the open and close. The thin lines, called 'wicks' or 'shadows', show the full range from high to low.\n\n- If the <strong class="text-green-400">close is higher than the open</strong>, it's a <em>bullish</em> (up) candle, usually colored green or white. Buyers won the session.\n- If the <strong class="text-red-400">close is lower than the open</strong>, it's a <em>bearish</em> (down) candle, usually colored red or black. Sellers won the session.\n\nThe length of the wicks tells a story of the battle. A long upper wick on a bearish candle means buyers tried to push the price up, but sellers overwhelmed them and pushed it back down, showing strong selling pressure. A long lower wick on a bullish candle means sellers tried to push price down, but buyers stepped in forcefully, showing strong buying pressure. Analyzing these wicks is crucial for understanding momentum.`
                },
                {
                    type: 'exercise',
                    prompt: `<strong class="text-yellow-200">Exercise: Identify a Bullish Candle.</strong> Find a bullish (up) candle on any chart. Please mark the candle's <strong>body</strong> and its <strong>lower wick</strong>.`,
                    validationPrompt: createValidationPrompt(
                        "Find a bullish (up) candle on any chart. Mark the candle's body and its lower wick.",
                        "That's perfect. You've correctly identified the body (the range between the open and close) and the lower wick, showing where sellers tried to push the price before buyers took over.",
                        "Good start, but there's a small correction needed. Remember, the 'body' of the candle is the thicker, rectangular part. The 'wick' is the thin line extending from it. Make sure you've marked those two distinct parts on a bullish (up) candle.",
                        `1.  **Check for Bullish Candle:** Confirm the user has selected a candle where the close price is higher than the open price (typically green or white).
2.  **Validate Body Marking:** Has the user clearly marked the rectangular part of the candle?
3.  **Validate Wick Marking:** Has the user clearly marked the thin line extending from the bottom of the body?`
                    )
                }]
            },
            // ... (Keep remaining lessons - truncated for brevity in this update as they are content)
        ],
        quiz: [
            { question: "What does a long lower wick on a bullish (green) candle typically signify?", options: ["Strong selling pressure", "Buyers successfully defended a lower price and pushed it back up", "The market is undecided"], correctAnswer: "Buyers successfully defended a lower price and pushed it back up", explanationPrompt: "Explain why a long lower wick shows buying pressure, representing buyers stepping in to purchase at lower prices and driving the price higher before the candle closed." },
            { question: "Which timeframe is best for determining the main, overall trend direction?", options: ["1-minute", "15-minute", "Daily"], correctAnswer: "Daily", explanationPrompt: "Explain that higher timeframes like the Daily chart are used to establish the overall market bias, while lower timeframes are for refining entries within that bias." },
            // ...
        ]
    },
    // ... (Other modules)
];
