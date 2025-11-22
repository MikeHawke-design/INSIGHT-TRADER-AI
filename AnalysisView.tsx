
import React from 'react';
import { AnalysisResults, StrategyKey, UploadedImageKeys, User, Trade, UserSettings, SavedTrade, UserUsage, StrategyLogicData } from './types';
import { TIME_FRAMES_STEPS, CREDIT_COSTS, USER_TIERS } from './constants';
import TradeCard from './components/TradeCard';
import AISuggestionCard from './AISuggestionCard';

interface AnalysisViewProps {
  analysisResults: AnalysisResults;
  modifiedAnalysis: AnalysisResults | null;
  selectedStrategies: StrategyKey[];
  uploadedImages: UploadedImageKeys | null;
  onReset: () => void;
  onPerformRedo: (strategies?: StrategyKey[], settings?: UserSettings) => void;
  currentUser: User | null;
  userUsage: UserUsage;
  savedTrades: SavedTrade[];
  onSaveTrade: (trade: Trade, strategiesUsed: StrategyKey[]) => void;
  strategyLogicData: Record<StrategyKey, StrategyLogicData>;
  userSettings: UserSettings;
}

const TRADE_CATEGORIES: Array<keyof AnalysisResults> = ['Top Longs', 'Top Shorts'];

const formatStrategyName = (name: string = ''): string => name.replace(/^\d+-/, '').replace(/-/g, ' ');

const AnalyzedChartImage: React.FC<{step: any, imageSrc: string}> = ({ step, imageSrc }) => {
    return (
        <div className="text-center">
            <h4 className="text-sm font-semibold text-gray-300 mb-1">{step.title}</h4>
            <div className="relative group">
                <img 
                    src={imageSrc} 
                    alt={`Uploaded chart for ${step.title}`} 
                    className="w-full h-auto rounded-md border-2 border-gray-700 transition-transform duration-300 ease-in-out cursor-pointer 
                               hover:scale-125 hover:z-10 focus:scale-125 focus:z-10 active:scale-125 active:z-10"
                    style={{ objectFit: 'contain', maxHeight: '200px' }}
                    tabIndex={0}
                />
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
    userUsage,
    savedTrades,
    onSaveTrade,
    strategyLogicData,
    userSettings
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

    const isApprentice = currentUser?.tier === USER_TIERS.APPRENTICE;
    const analysisCreditCost = CREDIT_COSTS.ANALYSIS;
    const canPayWithCredits = userUsage.creditsRemaining >= analysisCreditCost;

    const canRedo = isApprentice || canPayWithCredits;
    
    let redoButtonText = "Redo Analysis";
    if (isApprentice) {
        redoButtonText = "Redo Analysis";
    } else if (canPayWithCredits) {
        redoButtonText = `Redo for ${analysisCreditCost} Credit`;
    } else {
        redoButtonText = "Not enough Credits";
    }
    
    const hasTrades = (analysisResults['Top Longs']?.length ?? 0) > 0 || (analysisResults['Top Shorts']?.length ?? 0) > 0;
    const strategyDisplayNames = selectedStrategies.map(s => formatStrategyName(strategyLogicData[s]?.name || s)).join(' + ');

    return (
    <div className="p-4 md:p-6 space-y-6">
        <div className="text-center">
            <h2 className="font-bold text-white" style={{ fontSize: `${userSettings.headingFontSize + 4}px` }}>Analysis Complete</h2>
            <p className="text-gray-400" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Using <span className="font-semibold text-yellow-400">
                {selectedStrategies.length > 1 
                    ? `Confluent (${strategyDisplayNames})` 
                    : strategyDisplayNames}
            </span> Strategy</p>
        </div>

        {analysisResults.strategySuggestion && (
            <AISuggestionCard 
                suggestion={analysisResults.strategySuggestion}
                onApply={(strategies, settings) => onPerformRedo(strategies, settings)}
                userUsage={userUsage}
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
                        const detectedLabel = analysisResults.chartMetadata?.[key] || TIME_FRAMES_STEPS.find(s => s.step === index + 1)?.title || `Chart ${index + 1}`;
                        
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
        
        {TRADE_CATEGORIES.map(category => {
            const tradesToDisplay = getDisplayTrades(category);
            const title = category === 'Top Longs' ? 'Top Long Setups' : 'Top Short Setups';
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
            <div className="flex flex-col items-center">
                <button
                    onClick={() => onPerformRedo()}
                    className="bg-blue-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-400 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                    disabled={!canRedo}
                >
                   {redoButtonText}
                </button>
            </div>
        </div>

        <div className="text-center text-xs text-gray-500 mt-6 border-t border-gray-700 pt-4">
            <p><strong>Disclaimer: Not Financial Advice.</strong> The analysis provided is AI-generated for educational and paper trading purposes only. All trade setups are hypothetical and should not be used for live trading. Trading involves significant risk, and you are solely responsible for your own decisions. Always do your own research.</p>
        </div>
    </div>
    );
};

export default AnalysisView;
