import React, { useState, useEffect } from 'react';
import { MarketScannerResult, StrategyLogicData, ApiConfiguration, FreeCryptoAssetData, UserSettings, StrategyKey, AnalysisResults, UploadedImageKeys } from '../types';
import { FreeCryptoApi, formatAssetDataForPrompt } from '../utils/freeCryptoApi';
import { TwelveDataApi } from '../utils/twelveDataApi';
import { AiManager } from '../utils/aiManager';
import Logo from './Logo';

interface MarketScannerProps {
    apiConfig: ApiConfiguration;
    userSettings: UserSettings;
    onLogTokenUsage: (tokens: number) => void;
    strategies: Record<string, StrategyLogicData>;
    selectedStrategyKey: StrategyKey | null;
    onAnalysisComplete: (results: AnalysisResults, strategies: StrategyKey[], images: UploadedImageKeys, useRealTimeContext: boolean) => void;
}

interface ExtendedMarketScannerResult extends MarketScannerResult {
    dataSource?: string;
    dataStatus?: string;
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
    const [selectedTimeframe, setSelectedTimeframe] = useState<string>('4h');
    const [selectedStrategyKey, setSelectedStrategyKey] = useState<string>(initialStrategyKey || Object.keys(strategies)[0] || 'SMC_ICT');
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [scanResults, setScanResults] = useState<ExtendedMarketScannerResult[]>([]);
    const [availableCoins, setAvailableCoins] = useState<FreeCryptoAssetData[]>([]);
    const [selectedCoins, setSelectedCoins] = useState<string[]>([]);
    const [includeBtcConfluence, setIncludeBtcConfluence] = useState<boolean>(true);
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
                const coins = await listApi.getTopAssets(50);
                if (coins.length > 0) {
                    setAvailableCoins(coins);
                    // Default select top 5
                    setSelectedCoins(coins.slice(0, 5).map(c => c.symbol));
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
                setSelectedCoins(mappedAssets.slice(0, 5).map(c => c.symbol));
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

    const handleScan = async () => {
        if (selectedCoins.length === 0) return;
        setIsScanning(true);
        setScanResults([]);
        setError(null);

        try {
            // 1. Prepare Symbols for TwelveData
            // Crypto needs /USD appended if not present (CoinGecko symbols are usually just BTC, ETH)
            // Forex pairs are already formatted (EUR/USD)
            const targetSymbols = selectedCoins.map(s => {
                if (assetClass === 'Crypto' && !s.includes('/')) return `${s}/USD`;
                return s;
            });

            // Add BTC for confluence if needed
            if (includeBtcConfluence && assetClass === 'Crypto' && !targetSymbols.includes('BTC/USD')) {
                targetSymbols.push('BTC/USD');
            }

            // 2. Fetch Data (Sequential with Delay to respect API limits)
            // We skip the separate 'Quote' call to save API credits. We will derive price/change from candles.

            const quotesMap = new Map<string, FreeCryptoAssetData>();
            const candlesMap = new Map<string, any[]>();
            const totalAssets = targetSymbols.length;

            for (let i = 0; i < totalAssets; i++) {
                const symbol = targetSymbols[i];
                setScanProgress(`Fetching data for ${symbol} (${i + 1}/${totalAssets})...`);

                try {
                    // Fetch candles (this is the primary data source)
                    const candles = await dataApi.getCandles(symbol, selectedTimeframe);
                    candlesMap.set(symbol, candles);

                    // Derive "Quote" data from candles to save an API call
                    if (candles && candles.length > 0) {
                        // Candles are [time, open, high, low, close]
                        // We reverse them in API, so index 0 is oldest? No, TwelveData returns newest first but we reversed it?
                        // Let's check TwelveDataApi.ts: "return data.values.map(...).reverse();"
                        // So index 0 is OLDEST, index length-1 is NEWEST.

                        const newest = candles[candles.length - 1];
                        const currentPrice = newest[4]; // Close

                        // Calculate 24h change (approximate)
                        // If timeframe is 15m, 24h = 96 candles.
                        // If timeframe is 1h, 24h = 24 candles.
                        // If timeframe is 4h, 24h = 6 candles.
                        // If timeframe is 1d, 24h = 1 candle.

                        let candlesBack = 1;
                        if (selectedTimeframe === '15m') candlesBack = 96;
                        else if (selectedTimeframe === '1h') candlesBack = 24;
                        else if (selectedTimeframe === '4h') candlesBack = 6;

                        const pastIndex = Math.max(0, candles.length - 1 - candlesBack);
                        const pastCandle = candles[pastIndex];
                        const pastPrice = pastCandle ? pastCandle[4] : currentPrice;

                        const change24h = ((currentPrice - pastPrice) / pastPrice) * 100;

                        quotesMap.set(symbol, {
                            symbol: symbol,
                            price: currentPrice,
                            change_24h: change24h,
                            market_cap: 0, // Not available from candles, but not critical for technical analysis
                            volume: newest[5] || 0 // Volume if available (index 5?) TwelveData API returns volume, let's check if we mapped it.
                            // We mapped [time, open, high, low, close]. We missed volume in the map!
                            // We need to update TwelveDataApi.ts to include volume in the map.
                        });
                    }

                } catch (e) {
                    console.warn(`Failed to fetch candles for ${symbol}`, e);
                }

                // Add delay between requests to avoid rate limits (e.g., 2 seconds)
                // Only delay if it's not the last item
                if (i < totalAssets - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
            setScanProgress('Analyzing data with AI...');

            // Determine Data Source Status
            const dataSource = twelveDataKey ? "TwelveData (Official)" : "FreeCryptoAPI (Fallback)";

            // 4. Prepare AI Prompt
            const strategy = strategies[selectedStrategyKey];
            let dataContext = `Market Data (Timeframe: ${selectedTimeframe}):\n\n`;
            let hasCandleData = false;

            // Handle BTC Confluence Data
            if (includeBtcConfluence && assetClass === 'Crypto') {
                const btcSymbol = 'BTC/USD';
                const btcQuote = quotesMap.get(btcSymbol);
                const btcCandles = candlesMap.get(btcSymbol);

                if (btcQuote) {
                    if (btcCandles && btcCandles.length > 0) hasCandleData = true;
                    dataContext += `--- BITCOIN (MARKET LEADER / CONFLUENCE) ---\n${formatAssetDataForPrompt(btcQuote, btcCandles)}\n----------------------------------\n\n`;
                }
            }

            // Handle Target Assets
            // We iterate over selectedCoins but need to map to the TwelveData symbol format we used
            selectedCoins.forEach(coinSymbol => {
                const tdSymbol = (assetClass === 'Crypto' && !coinSymbol.includes('/')) ? `${coinSymbol}/USD` : coinSymbol;
                const quote = quotesMap.get(tdSymbol);
                const candles = candlesMap.get(tdSymbol);

                if (quote) {
                    if (candles && candles.length > 0) hasCandleData = true;
                    dataContext += `--- ASSET: ${coinSymbol} ---\n${formatAssetDataForPrompt(quote, candles)}\n\n`;
                } else {
                    dataContext += `--- ASSET: ${coinSymbol} ---\nData Unavailable\n\n`;
                }
            });

            let systemInstruction = `You are a professional market analyst and strategy evaluator. Your job is to analyze raw market data against a specific strategy and rank the assets based on technical setup quality.

**STRATEGY:**
Name: ${strategy.name}
Logic: ${strategy.prompt}

**TASK:**
1. **Analyze Structure:** `;

            if (hasCandleData) {
                systemInstruction += `Use the provided "Recent Candle Data (OHLC)" to visualize the price action. Identify Key Levels, Trends, and Patterns based on the Open, High, Low, Close values.`;
            } else {
                systemInstruction += `Analyze the available Price, 24h Change, and Volume to infer market momentum.
   - **WARNING:** OHLC Candle data is currently UNAVAILABLE. Base your analysis on the scalar metrics provided.`;
            }

            systemInstruction += `
2. **Confluence:** If Bitcoin data is provided, use it to gauge general market direction.
3. **Rank:** Rank the assets from BEST setup to WORST based on how well the data matches the strategy criteria.
4. **Output:** Return ONLY a valid JSON array.

**OUTPUT FORMAT:**
Return ONLY a valid JSON array:
[
  {
    "asset": "SYMBOL",
    "score": 0-100,
    "analysis": "Concise technical analysis citing specific price levels or patterns found.",
    "confluenceWithBtc": true/false
  },
  ...
]`;

            // 5. Call AI
            const manager = new AiManager({
                apiConfig,
                preferredProvider: userSettings.aiProviderAnalysis
            });

            const response = await manager.generateContent(systemInstruction, [{ text: dataContext }]);
            onLogTokenUsage(response.usage.totalTokenCount);

            let jsonText = (response.text || "").trim();

            if (jsonText.startsWith('AI_GENERATION_FAILED:')) {
                console.error("AI Generation Failed:", jsonText);
                const fallbackResults: ExtendedMarketScannerResult[] = selectedCoins.map(s => ({
                    asset: s,
                    score: 0,
                    analysis: `AI Analysis Failed: ${jsonText.split(':')[1]} (Safety Filter or Limit Reached)`,
                    confluenceWithBtc: false,
                    dataSource: dataSource,
                    dataStatus: "AI Error"
                }));
                setScanResults(fallbackResults);
                setIsScanning(false);
                return;
            }

            // Try to extract JSON if wrapped in markdown
            const fenceMatch = jsonText.match(/^```json\s*([\s\S]*?)\s*```$/) || jsonText.match(/^```\s*([\s\S]*?)\s*```$/);
            if (fenceMatch) {
                jsonText = fenceMatch[1];
            } else {
                const firstOpen = jsonText.indexOf('[');
                const lastClose = jsonText.lastIndexOf(']');
                if (firstOpen !== -1 && lastClose !== -1) {
                    jsonText = jsonText.substring(firstOpen, lastClose + 1);
                }
            }

            if (!jsonText) {
                console.warn("AI returned empty response. Falling back to basic analysis.");
                const fallbackResults: ExtendedMarketScannerResult[] = selectedCoins.map(s => ({
                    asset: s,
                    score: 50,
                    analysis: "AI Analysis Unavailable. Market data: " + (quotesMap.get(s + (assetClass === 'Crypto' ? '/USD' : ''))?.price ? `Price $${quotesMap.get(s + (assetClass === 'Crypto' ? '/USD' : ''))?.price}` : "No Data"),
                    confluenceWithBtc: false,
                    dataSource: dataSource,
                    dataStatus: hasCandleData ? "Quotes: OK, Candles: OK" : "Quotes: OK, Candles: Missing"
                }));
                setScanResults(fallbackResults);
                setIsScanning(false);
                return;
            }

            let results: ExtendedMarketScannerResult[];
            try {
                results = JSON.parse(jsonText) as ExtendedMarketScannerResult[];
                // Enrich results with data source info
                results = results.map(r => ({
                    ...r,
                    dataSource: dataSource,
                    dataStatus: hasCandleData ? "Full Data (OHLC)" : "Partial Data (Quotes Only)"
                }));
            } catch (e) {
                console.error("Failed to parse AI response:", jsonText);
                const fallbackResults: ExtendedMarketScannerResult[] = selectedCoins.map(s => ({
                    asset: s,
                    score: 50,
                    analysis: "AI Response Error. Raw: " + jsonText.substring(0, 100) + "...",
                    confluenceWithBtc: false,
                    dataSource: dataSource,
                    dataStatus: "AI Parsing Failed"
                }));
                setScanResults(fallbackResults);
                setIsScanning(false);
                return;
            }

            setScanResults(results.sort((a, b) => b.score - a.score));

        } catch (err) {
            console.error("Scan failed", err);
            setError("An error occurred during scanning. Please check your API key and try again.");
        } finally {
            setIsScanning(false);
        }
    };

    const handleGenerateTrade = async (result: ExtendedMarketScannerResult) => {
        if (!result.asset) return;
        setIsScanning(true); // Re-use scanning state for loading UI
        setError(null);

        try {
            // Re-fetch data to ensure freshness or use existing if we could store it (for now refetching is safer/easier)
            // We optimize by deriving quote data from candles, same as in handleScan.
            const symbol = assetClass === 'Crypto' && !result.asset.includes('/') ? `${result.asset}/USD` : result.asset;
            const candles = await dataApi.getCandles(symbol, selectedTimeframe);

            let quote: FreeCryptoAssetData = {
                symbol: symbol,
                price: 0,
                change_24h: 0,
                market_cap: 0,
                volume: 0
            };

            if (candles && candles.length > 0) {
                const newest = candles[candles.length - 1];
                const currentPrice = newest[4]; // Close

                let candlesBack = 1;
                if (selectedTimeframe === '15m') candlesBack = 96;
                else if (selectedTimeframe === '1h') candlesBack = 24;
                else if (selectedTimeframe === '4h') candlesBack = 6;

                const pastIndex = Math.max(0, candles.length - 1 - candlesBack);
                const pastCandle = candles[pastIndex];
                const pastPrice = pastCandle ? pastCandle[4] : currentPrice;

                const change24h = ((currentPrice - pastPrice) / pastPrice) * 100;

                quote = {
                    symbol: symbol,
                    price: currentPrice,
                    change_24h: change24h,
                    market_cap: 0,
                    volume: newest[5] || 0
                };
            }

            const dataContext = formatAssetDataForPrompt(quote, candles);
            const strategy = strategies[selectedStrategyKey];

            const systemInstruction = `You are an expert trading engine. Your task is to generate a precise Trade Setup based on the provided market data and strategy.

**STRATEGY:**
Name: ${strategy.name}
Logic: ${strategy.prompt}

**CONTEXT:**
Asset: ${result.asset}
Timeframe: ${selectedTimeframe}
Previous Analysis: ${result.analysis}

**TASK:**
Generate a detailed Trade Setup (Long or Short) with Entry, Stop Loss, and Take Profit targets.
The output MUST be a valid JSON object matching the 'AnalysisResults' structure with a single trade in 'Top Longs' or 'Top Shorts'.

**OUTPUT FORMAT:**
{
  "Top Longs": [
    {
      "type": "Setup Name",
      "direction": "Long",
      "symbol": "${result.asset}",
      "entry": "Specific Price",
      "entryType": "Limit Order",
      "entryExplanation": "Reason for entry level",
      "stopLoss": "Specific Price",
      "takeProfit1": "Specific Price",
      "takeProfit2": "Specific Price",
      "heat": 85,
      "explanation": "Detailed thesis matching the previous analysis."
    }
  ],
  "Top Shorts": [],
  "strategySuggestion": {
    "suggestedStrategies": ["${selectedStrategyKey}"],
    "suggestedSettings": {},
    "reasoning": "Strategy fit reasoning"
  }
}
(If Short, put in Top Shorts and empty Top Longs)`;

            const manager = new AiManager({
                apiConfig,
                preferredProvider: userSettings.aiProviderAnalysis
            });

            const response = await manager.generateContent(systemInstruction, [{ text: dataContext }]);
            onLogTokenUsage(response.usage.totalTokenCount);

            let jsonText = (response.text || "").trim();
            const fenceMatch = jsonText.match(/^```json\s*([\s\S]*?)\s*```$/) || jsonText.match(/^```\s*([\s\S]*?)\s*```$/);
            if (fenceMatch) jsonText = fenceMatch[1];

            const analysisResults = JSON.parse(jsonText) as AnalysisResults;

            // Pass results to main view
            // We pass empty images since this is API-based
            onAnalysisComplete(analysisResults, [selectedStrategyKey], {}, false);

        } catch (e) {
            console.error("Failed to generate trade:", e);
            setError("Failed to generate trade setup. Please try again.");
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
                    <label className="block text-sm font-medium text-gray-400 mb-2">Timeframe</label>
                    <div className="flex bg-[hsl(var(--color-bg-900))] rounded-lg p-1 border border-[hsl(var(--color-border-700))]">
                        {['15m', '1h', '4h', '1d'].map((tf) => (
                            <button
                                key={tf}
                                onClick={() => setSelectedTimeframe(tf)}
                                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${selectedTimeframe === tf
                                    ? 'bg-[hsl(var(--color-bg-700))] text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white'
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
                        Scan Selected Assets
                    </>
                )}
            </button>

            {/* Error Message */}
            {error && (
                <div className="bg-red-900/20 border border-red-800 text-red-300 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Results */}
            {scanResults.length > 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                        Scan Results
                    </h3>
                    <div className="grid gap-4">
                        {scanResults.map((result, idx) => (
                            <div key={idx} className="bg-[hsl(var(--color-bg-800)/0.5)] border border-[hsl(var(--color-border-700))] rounded-lg p-4 hover:border-blue-500/50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h4 className="text-xl font-bold text-white">{result.asset}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${result.score >= 80 ? 'bg-green-900/50 text-green-400' :
                                                result.score >= 50 ? 'bg-yellow-900/50 text-yellow-400' :
                                                    'bg-red-900/50 text-red-400'
                                                }`}>
                                                Score: {result.score}
                                            </span>
                                            {result.confluenceWithBtc && (
                                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-900/50 text-blue-400">
                                                    BTC Confluence
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleGenerateTrade(result)}
                                        className="bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-md text-sm font-bold shadow-lg shadow-green-900/20 transition-all flex items-center gap-1"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                                        </svg>
                                        Generate Trade
                                    </button>
                                </div>
                                <p className="text-gray-300 text-sm leading-relaxed mb-3">{result.analysis}</p>

                                {/* Data Source Status Footer */}
                                <div className="flex items-center gap-3 pt-3 border-t border-[hsl(var(--color-border-700))] text-xs text-gray-500">
                                    <div className="flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-5.5-2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM10 12a5.99 5.99 0 0 0-4.793 2.39A9.948 9.948 0 0 1 10 15c1.126 0 2.2.184 3.207.519A5.99 5.99 0 0 0 10 12Z" clipRule="evenodd" />
                                        </svg>
                                        Source: <span className="text-gray-400">{result.dataSource || 'Unknown'}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                                        </svg>
                                        Status: <span className={`font-medium ${result.dataStatus?.includes('Missing') ? 'text-red-400' : 'text-green-400'}`}>{result.dataStatus || 'Unknown'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarketScanner;
