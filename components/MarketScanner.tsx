
import React, { useState, useEffect, useMemo } from 'react';
import { StrategyKey, StrategyLogicData, ApiConfiguration, UserSettings, FreeCryptoAssetData, MarketScannerResult } from '../types';
import { FreeCryptoApi, formatAssetDataForPrompt } from '../utils/freeCryptoApi';
import { AiManager } from '../utils/aiManager';
import Logo from './Logo';

interface MarketScannerProps {
    selectedStrategyKey: StrategyKey | null;
    strategies: Record<StrategyKey, StrategyLogicData>;
    apiConfig: ApiConfiguration;
    userSettings: UserSettings;
    onLogTokenUsage: (tokens: number) => void;
}

const TIMEFRAMES = ['15m', '1h', '4h', '1d'];

const MarketScanner: React.FC<MarketScannerProps> = ({ selectedStrategyKey, strategies, apiConfig, userSettings, onLogTokenUsage }) => {
    const [selectedTimeframe, setSelectedTimeframe] = useState<string>('4h');
    const [availableCoins, setAvailableCoins] = useState<FreeCryptoAssetData[]>([]);
    const [selectedCoins, setSelectedCoins] = useState<string[]>([]);
    const [includeBtcConfluence, setIncludeBtcConfluence] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [scanResults, setScanResults] = useState<MarketScannerResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isLoadingCoins, setIsLoadingCoins] = useState(false);

    const api = useMemo(() => new FreeCryptoApi(apiConfig.freeCryptoApiKey), [apiConfig.freeCryptoApiKey]);

    useEffect(() => {
        const fetchCoins = async () => {
            setIsLoadingCoins(true);
            const coins = await api.getTopAssets(50);
            setAvailableCoins(coins);
            setIsLoadingCoins(false);
        };
        fetchCoins();
    }, [api]);

    const handleCoinToggle = (symbol: string) => {
        setSelectedCoins(prev =>
            prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
        );
    };

    const handleSelectAll = () => {
        if (selectedCoins.length === availableCoins.length) {
            setSelectedCoins([]);
        } else {
            setSelectedCoins(availableCoins.map(c => c.symbol));
        }
    };

    const handleScan = async () => {
        if (!selectedStrategyKey || selectedCoins.length === 0) return;

        setIsScanning(true);
        setError(null);
        setScanResults([]);

        try {
            // 1. Prepare Data (Use cached data to avoid API rate limits)
            let targetCoinsData: FreeCryptoAssetData[] = [];

            // Filter from available coins first
            targetCoinsData = availableCoins.filter(c => selectedCoins.includes(c.symbol));

            // If any selected coins are missing (shouldn't happen often), try to fetch them individually (throttled)
            // For now, we skip missing ones to protect API usage.

            let btcData = availableCoins.find(c => c.symbol === 'BTC');

            // If BTC is needed for confluence but not in available coins, fetch it
            if (includeBtcConfluence && !btcData) {
                try {
                    btcData = await api.getAssetData('BTC') || undefined;
                } catch (e) {
                    console.warn("Failed to fetch BTC for confluence");
                }
            }

            // 2. Fetch Candle Data (Parallelized)
            // Note: We fetch candles for ALL target coins to give the AI structure data.
            const candlePromises = targetCoinsData.map(async (coin) => {
                const candles = await api.getCandles(coin.symbol, selectedTimeframe);
                return { symbol: coin.symbol, candles };
            });

            if (includeBtcConfluence && btcData) {
                candlePromises.push(api.getCandles('BTC', selectedTimeframe).then(c => ({ symbol: 'BTC', candles: c })));
            }

            const candlesResults = await Promise.all(candlePromises);
            const candlesMap = new Map(candlesResults.map(r => [r.symbol, r.candles]));

            // 3. Prepare AI Prompt
            const strategy = strategies[selectedStrategyKey];

            let dataContext = `Market Data (Timeframe: ${selectedTimeframe}):\n\n`;
            let hasCandleData = false;

            if (includeBtcConfluence && btcData) {
                const btcCandles = candlesMap.get('BTC');
                if (btcCandles && btcCandles.length > 0) hasCandleData = true;
                dataContext += `--- BITCOIN (MARKET LEADER / CONFLUENCE) ---\n${formatAssetDataForPrompt(btcData, btcCandles)}\n----------------------------------\n\n`;
            }

            targetCoinsData.forEach(coin => {
                const candles = candlesMap.get(coin.symbol);
                if (candles && candles.length > 0) hasCandleData = true;
                dataContext += `--- ASSET: ${coin.symbol} ---\n${formatAssetDataForPrompt(coin, candles)}\n\n`;
            });

            let systemInstruction = `You are a high-frequency trading algorithm scanner. Your job is to analyze raw market data against a specific strategy and rank the assets.

**STRATEGY:**
Name: ${strategy.name}
Logic: ${strategy.prompt}

**TASK:**
1. **Analyze Structure:** `;

            if (hasCandleData) {
                systemInstruction += `Use the provided "Recent Candle Data (OHLC)" to mentally visualize the chart. Identify Swing Highs, Swing Lows, Trends, and Break of Structure (BOS) based on the Open, High, Low, Close values.
   - *Do not complain about missing images.* The OHLC data IS your chart.`;
            } else {
                systemInstruction += `Analyze the available Price, 24h Change, Volume, and Technical Indicators (RSI) to infer market structure and momentum.
   - **WARNING:** OHLC Candle data is currently UNAVAILABLE. You must do your best with the scalar metrics provided.`;
            }

            systemInstruction += `
2. **Confluence:** If Bitcoin data is provided, use it as a confluence filter.
3. **Rank:** Rank the assets from BEST setup to WORST based on how well the data matches the strategy.
4. **Output:** Return ONLY a valid JSON array.

**OUTPUT FORMAT:**
Return ONLY a valid JSON array:
[
  {
    "asset": "SYMBOL",
    "score": 0-100,
    "analysis": "Specific analysis of the market structure and indicators.",
    "confluenceWithBtc": true/false
  },
  ...
]`;

            // 3. Call AI
            const manager = new AiManager({
                apiConfig,
                preferredProvider: userSettings.aiProviderAnalysis // Use analysis provider
            });

            const response = await manager.generateContent(systemInstruction, [{ text: dataContext }]);
            onLogTokenUsage(response.usage.totalTokenCount);

            let jsonText = (response.text || "").trim();

            // Try to extract JSON if wrapped in markdown
            const fenceMatch = jsonText.match(/^```json\s*([\s\S]*?)\s*```$/) || jsonText.match(/^```\s*([\s\S]*?)\s*```$/);
            if (fenceMatch) {
                jsonText = fenceMatch[1];
            } else {
                // Fallback: find first [ and last ]
                const firstOpen = jsonText.indexOf('[');
                const lastClose = jsonText.lastIndexOf(']');
                if (firstOpen !== -1 && lastClose !== -1) {
                    jsonText = jsonText.substring(firstOpen, lastClose + 1);
                }
            }

            if (!jsonText) {
                throw new Error("AI returned empty response. This may be due to API limits or lack of data.");
            }

            let results: MarketScannerResult[];
            try {
                results = JSON.parse(jsonText) as MarketScannerResult[];
            } catch (e) {
                console.error("Failed to parse AI response:", jsonText);
                throw new Error("AI response was not valid JSON. Please try again.");
            }

            setScanResults(results.sort((a, b) => b.score - a.score));

        } catch (err) {
            console.error("Scan error:", err);
            setError(err instanceof Error ? err.message : "An error occurred during scanning.");
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-yellow-500">
                        <path fillRule="evenodd" d="M1 2.75A.75.75 0 0 1 1.75 2h16.5a.75.75 0 0 1 0 1.5H18v8.75A2.75 2.75 0 0 1 15.25 15h-1.072l.798 3.075a.75.75 0 0 1-1.452.376L13.13 17H6.87l-.396 1.451a.75.75 0 0 1-1.452-.376L5.822 15H4.75A2.75 2.75 0 0 1 2 12.25V3.5h-.25A.75.75 0 0 1 1 2.75ZM4.75 3.5h10.5a1.25 1.25 0 0 1 1.25 1.25v7.5a1.25 1.25 0 0 1-1.25 1.25H4.75A1.25 1.25 0 0 1 3.5 12.25v-7.5A1.25 1.25 0 0 1 4.75 3.5Z" clipRule="evenodd" />
                    </svg>
                    Market Scanner
                </h3>

                <div className="grid grid-cols-1 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">Timeframe</label>
                        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-600">
                            {TIMEFRAMES.map(tf => (
                                <button
                                    key={tf}
                                    onClick={() => setSelectedTimeframe(tf)}
                                    className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${selectedTimeframe === tf ? 'bg-gray-700 text-white shadow' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-400">Target Assets (Top 50)</label>
                        <button onClick={handleSelectAll} className="text-xs text-blue-400 hover:text-blue-300">
                            {selectedCoins.length === availableCoins.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    {isLoadingCoins ? (
                        <div className="text-center py-8 text-gray-500 animate-pulse">Loading market data...</div>
                    ) : availableCoins.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <p className="mb-2">No assets found.</p>
                            <button
                                onClick={() => { setIsLoadingCoins(true); api.getTopAssets(50).then(coins => { setAvailableCoins(coins); setIsLoadingCoins(false); }); }}
                                className="text-blue-400 hover:text-blue-300 underline"
                            >
                                Retry Fetching
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-48 overflow-y-auto custom-scrollbar p-2 bg-gray-900 rounded-lg border border-gray-700">
                            {availableCoins.map(coin => (
                                <button
                                    key={coin.symbol}
                                    onClick={() => handleCoinToggle(coin.symbol)}
                                    className={`text-xs py-2 px-1 rounded border transition-colors ${selectedCoins.includes(coin.symbol) ? 'bg-blue-900/40 border-blue-500 text-blue-200' : 'bg-gray-800 border-transparent text-gray-400 hover:bg-gray-700'}`}
                                >
                                    {coin.symbol}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4 mb-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeBtcConfluence}
                            onChange={(e) => setIncludeBtcConfluence(e.target.checked)}
                            className="rounded bg-gray-700 border-gray-600 text-yellow-500 focus:ring-yellow-500"
                        />
                        <span className="text-sm text-gray-300">Include BTC Confluence Check</span>
                    </label>
                </div>

                <button
                    onClick={handleScan}
                    disabled={isScanning || !selectedStrategyKey || selectedCoins.length === 0}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isScanning ? (
                        <>
                            <Logo className="w-5 h-5 animate-spin" />
                            Scanning Market...
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                            </svg>
                            Scan Selected Assets
                        </>
                    )}
                </button>

                {error && (
                    <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-200 text-sm">
                        {error}
                    </div>
                )}
            </div>

            {/* Results */}
            {scanResults.length > 0 && (
                <div className="space-y-4">
                    <h4 className="font-bold text-white text-lg">Scan Results</h4>
                    <div className="grid grid-cols-1 gap-4">
                        {scanResults.map((result, idx) => (
                            <div key={idx} className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col md:flex-row gap-4 items-start md:items-center">
                                <div className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 bg-gray-900 rounded-lg border border-gray-600">
                                    <span className="font-bold text-white">{result.asset}</span>
                                    <span className={`text-xs font-bold ${result.score >= 80 ? 'text-green-400' : result.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {result.score}%
                                    </span>
                                </div>
                                <div className="flex-grow">
                                    <p className="text-gray-300 text-sm">{result.analysis}</p>
                                    {result.confluenceWithBtc && (
                                        <span className="inline-block mt-2 text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded border border-green-800">
                                            BTC Confluence
                                        </span>
                                    )}
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
