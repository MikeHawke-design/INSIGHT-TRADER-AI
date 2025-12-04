import React from 'react';
import { AnalysisResults, StrategyKey, UploadedImageKeys, User, Trade, UserSettings, SavedTrade, UserUsage, StrategyLogicData } from '../types';

import TradeCard from './TradeCard';
import AISuggestionCard from './AISuggestionCard';
import HeatMeter from './HeatMeter';


interface AnalysisViewProps {
    analysisResults: AnalysisResults;
    modifiedAnalysis: AnalysisResults | null;
    selectedStrategies: StrategyKey[];
    uploadedImages: UploadedImageKeys | null;
    onReset: () => void;
    onPerformRedo: (strategies?: StrategyKey[], settings?: Partial<UserSettings>) => void;
    currentUser: User | null;
    userUsage: UserUsage;
    savedTrades: SavedTrade[];
    onSaveTrade: (trade: Trade, strategiesUsed: StrategyKey[]) => void;
    strategyLogicData: Record<StrategyKey, StrategyLogicData>;
    userSettings: UserSettings;
}

const TRADE_CATEGORIES: Array<keyof AnalysisResults> = ['Top Longs', 'Top Shorts'];

const formatStrategyName = (name: string = ''): string => name.replace(/^\d+-/, '').replace(/-/g, ' ');

const AssetComparisonCard: React.FC<{ result: any; userSettings: UserSettings }> = ({ result, userSettings }) => {
    const [isExpanded, setIsExpanded] = React.useState(true);
    const sentimentColors = {
        'Bullish': 'text-green-400 bg-green-400/10 border-green-400/30',
        'Bearish': 'text-red-400 bg-red-400/10 border-red-400/30',
        'Neutral': 'text-gray-400 bg-gray-400/10 border-gray-400/30'
    };
    const sentimentColor = sentimentColors[result.sentiment as keyof typeof sentimentColors] || sentimentColors['Neutral'];

    return (
        <div className="bg-[hsl(var(--color-bg-800))] border border-[hsl(var(--color-border-700))] rounded-lg p-4 flex flex-col h-full animate-fadeIn">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="font-bold text-white" style={{ fontSize: `${userSettings.headingFontSize}px` }}>{result.asset}</h3>
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full border mt-1 ${sentimentColor}`}>
                        {result.sentiment.toUpperCase()}
                    </span>
                </div>
                <div className="text-right">
                    <span className="text-xs text-gray-500 block mb-1">Setup Potential</span>
                    <HeatMeter level={result.heat} />
                </div>
            </div>

            <div className="mt-2">
                <div
                    className="flex items-center cursor-pointer select-none mb-2"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <p className="text-xs text-gray-400 font-semibold">Analysis:</p>
                    <span className="ml-2 text-yellow-400 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                </div>

                {isExpanded && (
                    <div className="bg-[hsl(var(--color-bg-900)/0.5)] p-3 rounded-md border border-[hsl(var(--color-border-700)/0.5)] text-gray-300 leading-relaxed animate-fadeIn" style={{ fontSize: `${userSettings.uiFontSize}px` }}>
                        {result.brief.split('|||').map((segment: string, i: number) => (
                            <p key={i} className="mb-2 last:mb-0">{segment.trim()}</p>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};



const AnalysisView: React.FC<AnalysisViewProps> = ({
    analysisResults,
    modifiedAnalysis,
    selectedStrategies,
    uploadedImages,
    onReset,
    onPerformRedo,
    currentUser,
    savedTrades,
    onSaveTrade,
    strategyLogicData,
    userSettings,
}) => {

    const getDisplayTrades = (category: keyof AnalysisResults): Trade[] => {
        if (!analysisResults || !analysisResults[category]) return [];
        const originalTradesForCategory = (analysisResults[category] as Trade[]) || [];
        const modifiedTradesForCategory = modifiedAnalysis ? ((modifiedAnalysis[category] as Trade[]) || []) : [];

        if (modifiedTradesForCategory.length === 0) return originalTradesForCategory;

        const modifiedTradesMap = new Map<string, Trade>();
        modifiedTradesForCategory.forEach(modTrade => {
            const key = `${modTrade.symbol}:${modTrade.direction}:${modTrade.type}`;
            modifiedTradesMap.set(key, { ...modTrade, isModified: true });
        });

        return originalTradesForCategory.map(origTrade => {
            const key = `${origTrade.symbol}:${origTrade.direction}:${origTrade.type}`;
            const modifiedTrade = modifiedTradesMap.get(key);
            return modifiedTrade || origTrade;
        });
    };

    const normalizePrice = (priceString: string | number): string => {
        if (typeof priceString === 'number') return priceString.toFixed(5);
        if (!priceString) return "INVALID_PRICE";
        const textContent = String(priceString).replace(/<[^>]*>/g, ' ');
        const match = textContent.match(/(\d{1,3}(,\d{3})*(\.\d+)?|\d+(\.\d+)?)/g);
        if (match) {
            const lastMatch = match[match.length - 1];
            try {
                return parseFloat(lastMatch.replace(/,/g, '')).toFixed(5);
            } catch (e) {
                return "INVALID_PRICE";
            }
        }
        return "INVALID_PRICE";
    };

    const isTradeSaved = (trade: Trade): boolean => {
        const tradeEntryStr = normalizePrice(trade.entry);
        const tradeSlStr = normalizePrice(trade.stopLoss);
        const tradeTp1Str = normalizePrice(trade.takeProfit1);

        if ([tradeEntryStr, tradeSlStr, tradeTp1Str].includes("INVALID_PRICE")) return false;

        return savedTrades.some(saved =>
            saved.symbol === trade.symbol &&
            saved.direction === trade.direction &&
            saved.type === trade.type &&
            normalizePrice(saved.entry) === tradeEntryStr &&
            normalizePrice(saved.stopLoss) === tradeSlStr &&
            normalizePrice(saved.takeProfit1) === tradeTp1Str
        );
    };



    const hasTrades = (analysisResults['Top Longs']?.length ?? 0) > 0 || (analysisResults['Top Shorts']?.length ?? 0) > 0;
    const strategyDisplayNames = selectedStrategies.map(s => formatStrategyName(strategyLogicData[s]?.name || s)).join(' + ');

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="text-center">
                <h2 className="font-bold text-white" style={{ fontSize: `${userSettings.headingFontSize + 4}px` }}>Analysis Complete</h2>
                <p className="text-gray-400" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Using <span className="font-semibold text-yellow-400">
                    {selectedStrategies.length > 1
                        ? `Confluent(${strategyDisplayNames})`
                        : strategyDisplayNames}
                </span> Strategy</p>
            </div>

            {analysisResults.strategySuggestion && (
                <AISuggestionCard
                    suggestion={analysisResults.strategySuggestion}
                    onApply={(strategies, settings) => onPerformRedo(strategies, settings)}

                    selectedStrategies={selectedStrategies}
                    strategyLogicData={strategyLogicData}
                    userSettings={userSettings}
                    currentUser={currentUser}
                    hasTrades={hasTrades}
                />
            )}

            {uploadedImages && Object.keys(uploadedImages).length > 0 && (
                <div className="my-6">
                    <h3 className="font-semibold text-white mb-3 border-b-2 border-yellow-500 pb-2 text-center" style={{ fontSize: `${userSettings.headingFontSize}px` }}>Analyzed Charts</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 p-4 bg-gray-800/50 rounded-lg">
                        {Object.keys(uploadedImages).map((key) => {
                            const index = parseInt(key, 10);
                            const imageSrc = uploadedImages[index as keyof typeof uploadedImages];
                            const detectedLabel = analysisResults.chartMetadata?.[key] || `Chart ${index + 1}`;

                            if (imageSrc) {
                                return (
                                    <div className="text-center" key={key}>
                                        <h4 className="text-sm font-semibold text-gray-300 mb-1">{detectedLabel}</h4>
                                        <img
                                            src={imageSrc}
                                            alt={`Uploaded chart ${index + 1}`}
                                            className="w-full h-auto rounded-md border-2 border-gray-700"
                                            style={{ objectFit: 'contain', maxHeight: '200px' }}
                                        />
                                    </div>
                                );
                            }
                            return null;
                        })}
                    </div>
                </div>
            )}

            {analysisResults.assetComparisonResults && analysisResults.assetComparisonResults.length > 0 && (
                <div className="mb-8">
                    <h3 className="font-semibold text-white mb-3 border-b-2 border-blue-500 pb-2" style={{ fontSize: `${userSettings.headingFontSize}px` }}>Asset Comparison & Ranking</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {analysisResults.assetComparisonResults.map((result, index) => (
                            <AssetComparisonCard key={index} result={result} userSettings={userSettings} />
                        ))}
                    </div>
                </div>
            )}

            {TRADE_CATEGORIES.map(category => {
                const tradesToDisplay = getDisplayTrades(category);
                const title = category === 'Top Longs' ? 'Top Long Setups' : 'Top Short Setups';

                if (analysisResults.assetComparisonResults && analysisResults.assetComparisonResults.length > 0 && tradesToDisplay.length === 0) {
                    return null;
                }

                return (
                    <div key={category}>
                        <h3 className="font-semibold text-white mb-3 border-b-2 border-yellow-500 pb-2" style={{ fontSize: `${userSettings.headingFontSize}px` }}>{title}</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                            {tradesToDisplay.length > 0 ? tradesToDisplay.map((trade, index) => (
                                <TradeCard
                                    key={`${trade.symbol}-${trade.direction}-${trade.type}-${index}`}
                                    trade={trade}
                                    userSettings={userSettings}
                                    isModified={trade.isModified}
                                    onSave={() => onSaveTrade(trade, selectedStrategies)}
                                    isSaved={isTradeSaved(trade)}
                                    strategyLogicData={strategyLogicData}
                                    activeStrategies={selectedStrategies}
                                />
                            )) : (
                                <p className="text-gray-400 col-span-full text-center py-4" style={{ fontSize: `${userSettings.uiFontSize}px` }}>No {category === 'Top Longs' ? 'long' : 'short'} setups generated by the AI for this analysis.</p>
                            )}
                        </div>
                    </div>
                )
            })}

            <div className="text-center pt-4 flex flex-col sm:flex-row flex-wrap justify-center items-center gap-4">
                <button
                    onClick={onReset}
                    className="bg-yellow-500 text-gray-900 font-bold py-2 px-6 rounded-lg hover:bg-yellow-400 transition-colors"
                    disabled={!currentUser}
                >
                    Start New Analysis
                </button>
            </div>

            <div className="text-center text-xs text-gray-500 mt-6 border-t border-gray-700 pt-4">
                <p><strong>Disclaimer: Not Financial Advice.</strong> The analysis provided is AI-generated for educational and paper trading purposes only. All trade setups are hypothetical and should not be used for live trading. Trading involves significant risk, and you are solely responsible for your own decisions. Always do your own research.</p>
            </div>
        </div>
    );
};

export default AnalysisView;
