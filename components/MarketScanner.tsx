import React, { useState, useEffect } from 'react';
import { StrategyLogicData, ApiConfiguration, FreeCryptoAssetData, UserSettings, StrategyKey, AnalysisResults, UploadedImageKeys } from '../types';
import { FreeCryptoApi } from '../utils/freeCryptoApi';
import { TwelveDataApi } from '../utils/twelveDataApi';
import { AiManager } from '../utils/aiManager';
import { getMarketData, setMarketData } from '../idb';
import Logo from './Logo';

interface MarketScannerProps {
    apiConfig: ApiConfiguration;
    userSettings: UserSettings;
    onLogTokenUsage: (tokens: number) => void;
    strategies: Record<string, StrategyLogicData>;
    selectedStrategyKey: StrategyKey | null;
    onAnalysisComplete: (results: AnalysisResults, strategies: StrategyKey[], images: UploadedImageKeys, useRealTimeContext: boolean) => void;
}

const FOREX_PAIRS = [
    "EUR/USD", "USD/JPY", "GBP/USD", "AUD/USD", "USD/CAD", "USD/CHF", "NZD/USD",
    "EUR/JPY", "GBP/JPY", "EUR/GBP", "AUD/JPY", "EUR/AUD", "EUR/CHF", "AUD/NZD",
    "GBP/AUD", "GBP/CHF", "CAD/JPY", "EUR/CAD", "AUD/CAD", "NZD/JPY"
];

const INDICES = [
    "SPX", "NDX", "DJI", "VIX", "RUT", "FTSE", "N225", "GDAXI", "FCHI", "STOXX50E"
];

const STOCKS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "BRK.B", "LLY", "V",
    "JPM", "WMT", "XOM", "MA", "PG", "COST", "JNJ", "HD", "MRK", "ABBV"
];

const MarketScanner: React.FC<MarketScannerProps> = ({ apiConfig, userSettings, onLogTokenUsage, strategies, selectedStrategyKey: initialStrategyKey, onAnalysisComplete }) => {
    const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(['4h']);
    const [selectedStrategyKey, setSelectedStrategyKey] = useState<string>(initialStrategyKey || Object.keys(strategies)[0] || 'SMC_ICT');
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [availableCoins, setAvailableCoins] = useState<FreeCryptoAssetData[]>([]);
    const [selectedCoins, setSelectedCoins] = useState<string[]>([]);
    const [includeBtcConfluence, setIncludeBtcConfluence] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [assetClass, setAssetClass] = useState<'Crypto' | 'Forex' | 'Indices' | 'Stocks'>('Crypto');

    const [scanProgress, setScanProgress] = useState<string>('');

    // Initialize APIs
    const listApi = new FreeCryptoApi(apiConfig.freeCryptoApiKey);
    // Use the key from apiConfig, with a fallback to userSettings if it was legacy
    const twelveDataKey = apiConfig.twelveDataApiKey || (userSettings as any).twelveDataApiKey;
    const dataApi = new TwelveDataApi(twelveDataKey);

    useEffect(() => {
        console.log("MarketScanner Mounted/Updated. AssetClass:", assetClass);
        fetchAssetList();
    }, [assetClass]);

    const fetchAssetList = async () => {
        setError(null);
        try {
            if (assetClass === 'Crypto') {
                // Fetch more than 50 to allow for filtering
                const coins = await listApi.getTopAssets(100);
                if (coins.length > 0) {
                    const EXCLUDED_COINS = [
                        'USDT', 'STETH', 'WSTETH', 'WBETH', 'WBTC', 'BTCUSD', 'USDS',
                        'WETH', 'WEETH', 'USDE', 'CBBTC', 'USDTO', 'SUSDS', 'PYUSD', 'SUSDE', 'USD1',
                        'USDC', 'DAI', 'FDUSD', 'TUSD' // Added common stablecoins just in case
                    ];

                    const filteredCoins = coins.filter(c => !EXCLUDED_COINS.includes(c.symbol.toUpperCase()));
                    const finalCoins = filteredCoins.slice(0, 50);

                    setAvailableCoins(finalCoins);
                    // Default select NONE (User request: uncheck top 5 selection by default)
                    setSelectedCoins([]);
                } else {
                    setError("Failed to load crypto assets.");
                }
            } else {
                let assets: string[] = [];
                if (assetClass === 'Forex') assets = FOREX_PAIRS;
                else if (assetClass === 'Indices') assets = INDICES;
                else if (assetClass === 'Stocks') assets = STOCKS;

                const mappedAssets = assets.map(symbol => ({
                    symbol: symbol,
                    price: 0,
                    change_24h: 0,
                    market_cap: 0,
                    volume: 0
                }));
                setAvailableCoins(mappedAssets);
                // Default select NONE
                setSelectedCoins([]);
            }
        } catch (err) {
            console.error("Failed to fetch assets", err);
            setError("Failed to load assets. Please try again.");
        }
    };

    const toggleCoinSelection = (symbol: string) => {
        if (selectedCoins.includes(symbol)) {
            setSelectedCoins(selectedCoins.filter(s => s !== symbol));
        } else {
            if (selectedCoins.length >= 10) {
                alert("Max 10 assets allowed per scan to save API credits.");
                return;
            }
            setSelectedCoins([...selectedCoins, symbol]);
        }
    };

    const toggleTimeframe = (tf: string) => {
        if (selectedTimeframes.includes(tf)) {
            // Prevent deselecting the last one
            if (selectedTimeframes.length > 1) {
                setSelectedTimeframes(selectedTimeframes.filter(t => t !== tf));
            }
        } else {
            if (selectedTimeframes.length < 3) {
                setSelectedTimeframes([...selectedTimeframes, tf]);
            }
        }
    };

    const handleScan = async () => {
        if (selectedCoins.length === 0) return;
        setIsScanning(true);
        setError(null);

        try {
            // 1. Prepare Symbols for TwelveData
            const targetSymbols = selectedCoins.map(s => {
                if (assetClass === 'Crypto' && !s.includes('/')) return `${s}/USD`;
                return s;
            });

            // Add BTC for confluence if needed
            if (includeBtcConfluence && assetClass === 'Crypto' && !targetSymbols.includes('BTC/USD')) {
                targetSymbols.push('BTC/USD');
            }

            // 2. Fetch Data (Sequential with Delay to respect API limits)
            // Map key: "SYMBOL_TIMEFRAME" -> candles[]
            const candlesMap = new Map<string, any[]>();
            const quotesMap = new Map<string, FreeCryptoAssetData>();
            const totalAssets = targetSymbols.length;

            for (let i = 0; i < totalAssets; i++) {
                const symbol = targetSymbols[i];
                setScanProgress(`Fetching data for ${symbol} (${i + 1}/${totalAssets})...`);

                // Fetch for ALL selected timeframes
                for (const tf of selectedTimeframes) {
                    try {
                        // --- SMART FETCH LOGIC ---
                        // 1. Check IDB for existing data
                        const storedCandles = await getMarketData(symbol, tf) || [];
                        let startDate: string | undefined;

                        if (storedCandles.length > 0) {
                            const lastCandle = storedCandles[storedCandles.length - 1];
                            const lastTime = Array.isArray(lastCandle) ? lastCandle[0] : (lastCandle.time || lastCandle.date);
                            if (lastTime) startDate = lastTime;
                        }

                        // 2. Fetch New Data
                        let newCandles: any[] = [];
                        if (twelveDataKey) {
                            // TwelveData supports start_date
                            newCandles = await dataApi.getCandles(symbol, tf, startDate);
                        } else {
                            // FreeCryptoAPI fallback (fetch all/limit and merge)
                            newCandles = await listApi.getCandles(symbol, tf);
                        }

                        // 3. Merge & Save
                        let mergedCandles = [...storedCandles];
                        if (newCandles.length > 0) {
                            const getTime = (c: any) => new Date(Array.isArray(c) ? c[0] : (c.time || c.date)).getTime();
                            const existingTimes = new Set(storedCandles.map(c => getTime(c)));
                            const uniqueNew = newCandles.filter(c => !existingTimes.has(getTime(c)));
                            mergedCandles = [...storedCandles, ...uniqueNew];
                            mergedCandles.sort((a, b) => getTime(a) - getTime(b));

                            // Save to IDB
                            await setMarketData(symbol, tf, mergedCandles);
                        }

                        // Use merged candles for analysis
                        candlesMap.set(`${symbol}_${tf}`, mergedCandles);

                        // Derive "Quote" data from the PRIMARY timeframe (first selected)
                        if (tf === selectedTimeframes[0] && mergedCandles.length > 0) {
                            const newest = mergedCandles[mergedCandles.length - 1];
                            const currentPrice = newest[4]; // Close

                            let candlesBack = 1;
                            if (tf === '1m') candlesBack = 1440;
                            else if (tf === '5m') candlesBack = 288;
                            else if (tf === '15m') candlesBack = 96;
                            else if (tf === '1h') candlesBack = 24;
                            else if (tf === '4h') candlesBack = 6;

                            const pastIndex = Math.max(0, mergedCandles.length - 1 - candlesBack);
                            const pastCandle = mergedCandles[pastIndex];
                            const pastPrice = pastCandle ? pastCandle[4] : currentPrice;

                            const change24h = ((currentPrice - pastPrice) / pastPrice) * 100;

                            quotesMap.set(symbol, {
                                symbol: symbol,
                                price: currentPrice,
                                change_24h: change24h,
                                market_cap: 0,
                                volume: newest[5] || 0
                            });
                        }

                    } catch (e) {
                        console.warn(`Failed to fetch/process candles for ${symbol} ${tf}`, e);
                    }
                }

                // Add delay between assets
                if (i < totalAssets - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            }
            setScanProgress('Analyzing data with AI...');

            // 4. Prepare AI Prompt
            const strategy = strategies[selectedStrategyKey];
            let dataContext = `Market Data (Timeframes: ${selectedTimeframes.join(', ')}):\n\n`;

            // Helper to format multi-timeframe data
            const formatMultiTfData = (sym: string) => {
                let output = `--- ASSET: ${sym} ---\n`;
                const quote = quotesMap.get(sym);
                if (quote) {
                    output += `Price: ${quote.price} | 24h Change: ${quote.change_24h.toFixed(2)}% | Volume: ${quote.volume}\n`;
                }

                selectedTimeframes.forEach(tf => {
                    const candles = candlesMap.get(`${sym}_${tf}`);
                    if (candles && candles.length > 0) {
                        output += `\n[Timeframe: ${tf}]\n`;
                        // Last 5 candles
                        const last5 = candles.slice(-5);
                        last5.forEach(c => {
                            const [t, o, h, l, cl] = Array.isArray(c) ? c : [c.datetime, c.open, c.high, c.low, c.close];
                            output += `  ${t}: O:${o} H:${h} L:${l} C:${cl}\n`;
                        });
                    } else {
                        output += `\n[Timeframe: ${tf}]: No Data\n`;
                    }
                });
                return output + "\n";
            };

            // Handle BTC Confluence Data
            if (includeBtcConfluence && assetClass === 'Crypto') {
                dataContext += `--- BITCOIN (MARKET LEADER / CONFLUENCE) ---\n`;
                dataContext += formatMultiTfData('BTC/USD');
                dataContext += `----------------------------------\n\n`;
            }

            // Handle Target Assets
            selectedCoins.forEach(coinSymbol => {
                const tdSymbol = (assetClass === 'Crypto' && !coinSymbol.includes('/')) ? `${coinSymbol}/USD` : coinSymbol;
                dataContext += formatMultiTfData(tdSymbol);
            });

            const systemInstruction = `You are an expert trading engine. Your task is to analyze the provided market data for multiple assets and generate precise Trade Setups for the best opportunities.

**STRATEGY:**
Name: ${strategy.name}
Logic: ${strategy.prompt}

**TASK:**
1. **Scan & Filter:** Analyze the data for ALL provided assets. Filter for those that match the strategy logic across the provided timeframes (${selectedTimeframes.join(', ')}).
2. **Generate Setups:** For the matching assets, generate detailed trade setups (Long or Short).
3. **Output:** Return a SINGLE JSON object containing lists of 'Top Longs' and 'Top Shorts'.

**CRITICAL: STOP LOSS PLACEMENT PROTOCOL (${userSettings.stopLossStrategy || 'Standard'})**
${userSettings.stopLossStrategy === 'Structure-Buffered'
                    ? `- **MANDATORY:** You MUST place the Stop Loss BEYOND a key market structure level.
  - **FOR LONG TRADES:** The SL must be BELOW the most recent significant Swing Low.
  - **FOR SHORT TRADES:** The SL must be ABOVE the most recent significant Swing High.
  - **BUFFER:** You MUST add a buffer to this level (e.g., ATR or fixed % distance).
  - **PROHIBITED:** Do NOT place the SL inside the consolidation or 'chop'. It must be protected by structure.
  - **VERIFICATION:** In your 'explanation', you MUST explicitly state: "Structure Level identified at [Price], SL placed at [Price] (Buffer added)".`
                    : `- Place the Stop Loss according to the strategy's standard rules.`}

**RISK/REWARD REQUIREMENT:**
- You MUST respect the user's minimum Risk/Reward Ratio of **${userSettings.minRiskRewardRatio}**.
- Adjust Take Profit levels to ensure this ratio is met.
- If a trade cannot logically meet this R:R, DO NOT suggest it.

**HEAT SCORE (0-100) - SKEPTICISM PROTOCOL:**
- **100:** IMPOSSIBLE. Do not use.
- **90-99:** Legendary. Perfect alignment of all indicators, timeframes, and market structure. Rare.
- **80-89:** Strong. Textbook setup with high probability.
- **60-79:** Valid. Good setup but carries standard market risk or minor conflicting signals.
- **<60:** Weak. Do not suggest.
- **CRITICAL:** Be a harsh critic. Do not inflate scores. A score of 95+ requires extraordinary evidence.

**OUTPUT FORMAT:**
{
  "Top Longs": [
    {
      "type": "Setup Name",
      "direction": "Long",
      "symbol": "SYMBOL",
      "entry": "Specific Price",
      "entryType": "Limit Order",
      "entryExplanation": "Reason for entry level",
      "stopLoss": "Specific Price",
      "takeProfit1": "Specific Price",
      "takeProfit2": "Specific Price",
      "heat": 85,
      "explanation": "Strategy Match: [Detailed explanation of how the strategy logic applies] ||| Chart Evidence: [Specific price action, indicators, or patterns observed] ||| Execution & Risk: [Plan for entry, stop loss placement, and risk management]"
    }
  ],
  "Top Shorts": [ ... ],
  "strategySuggestion": {
    "suggestedStrategies": ["${selectedStrategyKey}"],
    "suggestedSettings": {},
    "reasoning": "Summary of market conditions and why these assets were chosen."
  }
}`;

            // 5. Call AI
            const manager = new AiManager({
                apiConfig,
                preferredProvider: userSettings.aiProviderAnalysis
            });

            const response = await manager.generateContent(systemInstruction, [{ text: dataContext }]);
            const tokenUsage = response.usage.totalTokenCount;
            onLogTokenUsage(tokenUsage);

            let jsonText = (response.text || "").trim();

            if (jsonText.startsWith('AI_GENERATION_FAILED:')) {
                setError(`AI Generation Failed: ${jsonText.split(':')[1]}`);
                setIsScanning(false);
                return;
            }

            // Try to extract JSON if wrapped in markdown
            const fenceMatch = jsonText.match(/^```json\s*([\s\S]*?)\s*```$/) || jsonText.match(/^```\s*([\s\S]*?)\s*```$/);
            if (fenceMatch) {
                jsonText = fenceMatch[1];
            } else {
                const firstOpen = jsonText.indexOf('{');
                const lastClose = jsonText.lastIndexOf('}');
                if (firstOpen !== -1 && lastClose !== -1) {
                    jsonText = jsonText.substring(firstOpen, lastClose + 1);
                }
            }

            let analysisResults: AnalysisResults;
            try {
                analysisResults = JSON.parse(jsonText) as AnalysisResults;
            } catch (e) {
                console.error("Failed to parse AI response:", jsonText);
                setError("Failed to parse AI response. Please try again.");
                setIsScanning(false);
                return;
            }

            // Enrich results with context and token usage
            const enrichTrade = (t: any) => ({
                ...t,
                timeframe: selectedTimeframes[0], // Use primary timeframe
                analysisContext: { realTimeContextWasUsed: true },
                tokenUsage: tokenUsage
            });

            if (analysisResults['Top Longs']) {
                analysisResults['Top Longs'] = analysisResults['Top Longs'].map(enrichTrade);
            }
            if (analysisResults['Top Shorts']) {
                analysisResults['Top Shorts'] = analysisResults['Top Shorts'].map(enrichTrade);
            }

            // Directly complete analysis and show results
            onAnalysisComplete(analysisResults, [selectedStrategyKey], {}, true);

        } catch (err: any) {
            console.error("Scan failed", err);
            const msg = err.message || "An error occurred during scanning.";
            setError(`${msg} (Please check your API key/limits)`);
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <Logo className="w-8 h-8 text-blue-500" />
                <h3 className="text-xl font-bold text-white">
                    Market Scanner
                </h3>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Asset Class Selector */}
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Asset Class</label>
                    <div className="flex bg-[hsl(var(--color-bg-900))] rounded-lg p-1 border border-[hsl(var(--color-border-700))]">
                        {(['Crypto', 'Forex', 'Indices', 'Stocks'] as const).map((ac) => (
                            <button
                                key={ac}
                                onClick={() => setAssetClass(ac)}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${assetClass === ac
                                    ? 'bg-[hsl(var(--color-bg-700))] text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {ac}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Timeframes (Max 3)</label>
                    <div className="flex flex-wrap gap-1 bg-[hsl(var(--color-bg-900))] rounded-lg p-1 border border-[hsl(var(--color-border-700))]">
                        {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => (
                            <button
                                key={tf}
                                onClick={() => toggleTimeframe(tf)}
                                className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedTimeframes.includes(tf)
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white hover:bg-[hsl(var(--color-bg-800))]'
                                    }`}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Strategy</label>
                    <select
                        value={selectedStrategyKey}
                        onChange={(e) => setSelectedStrategyKey(e.target.value)}
                        className="w-full bg-[hsl(var(--color-bg-900))] border border-[hsl(var(--color-border-700))] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        {Object.entries(strategies).map(([key, strategy]) => (
                            <option key={key} value={key}>{strategy.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Asset Selection */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-400">Target Assets (Select up to 10)</label>
                    <div className="space-x-2">
                        <button
                            onClick={() => setSelectedCoins(availableCoins.slice(0, 5).map(c => c.symbol))}
                            className="text-xs text-blue-400 hover:text-blue-300"
                        >
                            Select Top 5
                        </button>
                        <button
                            onClick={() => setSelectedCoins([])}
                            className="text-xs text-gray-500 hover:text-gray-300"
                        >
                            Deselect All
                        </button>
                    </div>
                </div>

                {availableCoins.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 bg-[hsl(var(--color-bg-900)/0.5)] rounded-lg border border-dashed border-[hsl(var(--color-border-700))]">
                        <p>No assets found.</p>
                        <button onClick={fetchAssetList} className="mt-2 text-blue-400 hover:underline text-sm">Retry Fetching</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-2 bg-[hsl(var(--color-bg-900)/0.3)] rounded-lg border border-[hsl(var(--color-border-700))]">
                        {availableCoins.map(coin => (
                            <button
                                key={coin.symbol}
                                onClick={() => toggleCoinSelection(coin.symbol)}
                                className={`px-2 py-1.5 text-xs font-medium rounded border transition-all ${selectedCoins.includes(coin.symbol)
                                    ? 'bg-blue-900/30 border-blue-500 text-blue-200'
                                    : 'bg-[hsl(var(--color-bg-800))] border-[hsl(var(--color-border-700))] text-gray-400 hover:border-gray-500'
                                    }`}
                            >
                                {coin.symbol}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* BTC Confluence Checkbox */}
            {assetClass === 'Crypto' && (
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="btcConfluence"
                        checked={includeBtcConfluence}
                        onChange={(e) => setIncludeBtcConfluence(e.target.checked)}
                        className="h-4 w-4 text-blue-600 rounded border-gray-600 bg-[hsl(var(--color-bg-700))]"
                    />
                    <label htmlFor="btcConfluence" className="ml-2 text-sm text-gray-300">
                        Include BTC Confluence Check
                    </label>
                </div>
            )}

            {/* Scan Button */}
            <button
                onClick={handleScan}
                disabled={isScanning || selectedCoins.length === 0}
                className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${isScanning || selectedCoins.length === 0
                    ? 'bg-gray-700 cursor-not-allowed opacity-50'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-900/20'
                    }`}
            >
                {isScanning ? (
                    <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {scanProgress || 'Scanning Market...'}
                    </>
                ) : (
                    <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Scan & Generate Trades
                    </>
                )}
            </button>

            {/* Error Message */}
            {error && (
                <div className="bg-red-900/20 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}
        </div>
    );
};

export default MarketScanner;
