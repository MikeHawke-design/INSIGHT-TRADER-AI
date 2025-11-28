import React, { useState, useEffect } from 'react';
import { ApiConfiguration, RiskManagementSettings } from '../types';
import { getMexcAccountInfo, getUserAuthorizedSymbols, MexcBalance } from '../mexcApi';

interface TradingDashboardProps {
    apiConfig: ApiConfiguration;
    riskSettings: RiskManagementSettings;
    onUpdateRiskSettings: (settings: RiskManagementSettings) => void;
}

const TradingDashboard: React.FC<TradingDashboardProps> = ({
    apiConfig,
    riskSettings,
    onUpdateRiskSettings
}) => {
    const [balances, setBalances] = useState<MexcBalance[]>([]);
    const [totalBalanceUSDT, setTotalBalanceUSDT] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [authorizedSymbols, setAuthorizedSymbols] = useState<string[]>([]);
    const [isLoadingSymbols, setIsLoadingSymbols] = useState(false);

    const hasMexcCredentials = apiConfig.mexcApiKey && apiConfig.mexcSecretKey;

    const fetchBalances = async () => {
        if (!hasMexcCredentials) return;

        setIsLoading(true);
        setError(null);

        try {
            const accountInfo = await getMexcAccountInfo({
                apiKey: apiConfig.mexcApiKey!,
                secretKey: apiConfig.mexcSecretKey!
            });

            // Filter out zero balances
            const nonZeroBalances = accountInfo.balances.filter(
                b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
            );

            setBalances(nonZeroBalances);

            // Calculate total in USDT
            let total = 0;
            for (const balance of nonZeroBalances) {
                const amount = parseFloat(balance.free) + parseFloat(balance.locked);
                if (balance.asset === 'USDT') {
                    total += amount;
                } else {
                    // For other assets, we'd need to fetch their USDT price
                    // For now, just add USDT balance
                }
            }
            setTotalBalanceUSDT(total);
            setLastUpdate(new Date());
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balances';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAuthorizedSymbols = async () => {
        if (!hasMexcCredentials) return;

        setIsLoadingSymbols(true);

        try {
            const symbols = await getUserAuthorizedSymbols({
                apiKey: apiConfig.mexcApiKey!,
                secretKey: apiConfig.mexcSecretKey!
            });
            setAuthorizedSymbols(symbols);
        } catch (err) {
            console.error('Failed to fetch authorized symbols:', err);
            // Don't set error state for symbols, just log it
        } finally {
            setIsLoadingSymbols(false);
        }
    };

    useEffect(() => {
        if (hasMexcCredentials) {
            fetchBalances();
            fetchAuthorizedSymbols();
        }
    }, [apiConfig.mexcApiKey, apiConfig.mexcSecretKey]);

    const handleRiskSettingChange = (key: keyof RiskManagementSettings, value: number | boolean) => {
        onUpdateRiskSettings({
            ...riskSettings,
            [key]: value
        });
    };

    if (!hasMexcCredentials) {
        return (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
                <h3 className="text-xl font-bold text-yellow-400 mb-3">Trading Dashboard</h3>
                <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-md p-4">
                    <p className="text-yellow-300 font-semibold">⚠️ MEXC API Not Configured</p>
                    <p className="text-sm text-gray-300 mt-2">
                        Please add your MEXC API credentials in the Settings tab to enable live trading features.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Account Balance Section */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-yellow-500/30 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-yellow-400">Account Balance</h3>
                    <button
                        onClick={fetchBalances}
                        disabled={isLoading}
                        className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold px-4 py-2 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                        Refresh
                    </button>
                </div>

                {error && (
                    <div className="bg-red-900/30 border border-red-500/50 rounded-md p-3 mb-4">
                        <p className="text-red-300 text-sm">{error}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-900/50 rounded-lg p-4">
                        <p className="text-gray-400 text-sm mb-1">Total Balance (USDT)</p>
                        <p className="text-3xl font-bold text-white">${totalBalanceUSDT.toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-4">
                        <p className="text-gray-400 text-sm mb-1">Risk Per Trade</p>
                        <p className="text-3xl font-bold text-yellow-400">
                            ${(totalBalanceUSDT * (riskSettings.riskPercentagePerTrade / 100)).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{riskSettings.riskPercentagePerTrade}% of balance</p>
                    </div>
                </div>

                {balances.length > 0 && (
                    <div className="bg-gray-900/30 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-300 mb-3">Asset Breakdown</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {balances.map((balance, idx) => {
                                const total = parseFloat(balance.free) + parseFloat(balance.locked);
                                return (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400 font-mono">{balance.asset}</span>
                                        <div className="text-right">
                                            <span className="text-white font-semibold">{total.toFixed(8)}</span>
                                            {parseFloat(balance.locked) > 0 && (
                                                <span className="text-yellow-500 text-xs ml-2">
                                                    ({parseFloat(balance.locked).toFixed(8)} locked)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {lastUpdate && (
                    <p className="text-xs text-gray-500 mt-3">
                        Last updated: {lastUpdate.toLocaleTimeString()}
                    </p>
                )}
            </div>

            {/* Authorized Trading Pairs Section */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-yellow-500/30 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-yellow-400">Authorized Trading Pairs</h3>
                    <button
                        onClick={fetchAuthorizedSymbols}
                        disabled={isLoadingSymbols}
                        className="bg-yellow-500 hover:bg-yellow-400 text-gray-900 font-semibold px-4 py-2 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${isLoadingSymbols ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                        Refresh
                    </button>
                </div>

                <div className="bg-blue-900/30 border border-blue-500/30 rounded-md p-4 mb-4">
                    <p className="text-blue-300 font-semibold text-sm">ℹ️ About Trading Pairs</p>
                    <p className="text-xs text-gray-300 mt-2">
                        These are the trading pairs you've authorized for your API key on MEXC. Only these pairs can be traded through this application.
                        To add more pairs, go to your MEXC API settings and update the "Trading Pair Settings" for your API key.
                    </p>
                </div>

                {isLoadingSymbols ? (
                    <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400"></div>
                        <p className="text-gray-400 mt-2">Loading authorized pairs...</p>
                    </div>
                ) : authorizedSymbols.length > 0 ? (
                    <div className="bg-gray-900/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-gray-300">
                                Your Authorized Pairs ({authorizedSymbols.length})
                            </h4>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 max-h-64 overflow-y-auto">
                            {authorizedSymbols.map((symbol, idx) => (
                                <div
                                    key={idx}
                                    className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-center hover:border-yellow-500/50 transition-colors"
                                >
                                    <span className="text-white font-mono text-sm">{symbol}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-md p-4 text-center">
                        <p className="text-yellow-300 font-semibold">⚠️ No Trading Pairs Authorized</p>
                        <p className="text-sm text-gray-300 mt-2">
                            You haven't authorized any trading pairs for your API key yet.
                            Please go to your MEXC account and configure trading pairs for your API key.
                        </p>
                    </div>
                )}
            </div>

            {/* Risk Management Settings */}
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-yellow-500/30 rounded-lg p-6">
                <h3 className="text-2xl font-bold text-yellow-400 mb-4">Risk Management</h3>

                <div className="space-y-4">
                    {/* Risk Per Trade */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Risk Per Trade (%)
                        </label>
                        <input
                            type="number"
                            min="0.1"
                            max="10"
                            step="0.1"
                            value={riskSettings.riskPercentagePerTrade}
                            onChange={(e) => handleRiskSettingChange('riskPercentagePerTrade', parseFloat(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Recommended: 1-2% for conservative, 2-3% for moderate, 3-5% for aggressive
                        </p>
                    </div>

                    {/* Max Position Size */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Max Position Size (% of account)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="100"
                            step="1"
                            value={riskSettings.maxPositionSize}
                            onChange={(e) => handleRiskSettingChange('maxPositionSize', parseFloat(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                        />
                    </div>

                    {/* Min Risk/Reward Ratio */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Minimum Risk/Reward Ratio
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            step="0.1"
                            value={riskSettings.minRiskRewardRatio}
                            onChange={(e) => handleRiskSettingChange('minRiskRewardRatio', parseFloat(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Trades below this R:R ratio will be flagged
                        </p>
                    </div>

                    {/* Max Daily Trades */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Max Daily Trades
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="50"
                            step="1"
                            value={riskSettings.maxDailyTrades}
                            onChange={(e) => handleRiskSettingChange('maxDailyTrades', parseInt(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                        />
                    </div>

                    {/* Max Open Positions */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">
                            Max Open Positions
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            step="1"
                            value={riskSettings.maxOpenPositions}
                            onChange={(e) => handleRiskSettingChange('maxOpenPositions', parseInt(e.target.value))}
                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                        />
                    </div>

                    {/* Toggles */}
                    <div className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3">
                        <span className="text-sm font-semibold text-gray-300">Always Use Stop Loss</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={riskSettings.useStopLoss}
                                onChange={(e) => handleRiskSettingChange('useStopLoss', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                    </div>

                    <div className="flex items-center justify-between bg-gray-900/50 rounded-lg p-3">
                        <span className="text-sm font-semibold text-gray-300">Always Use Take Profit</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={riskSettings.useTakeProfit}
                                onChange={(e) => handleRiskSettingChange('useTakeProfit', e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                    </div>
                </div>

                <div className="mt-6 bg-blue-900/30 border border-blue-500/30 rounded-md p-4">
                    <p className="text-blue-300 font-semibold text-sm">💡 Risk Management Tips</p>
                    <ul className="text-xs text-gray-300 mt-2 space-y-1 list-disc list-inside">
                        <li>Never risk more than you can afford to lose</li>
                        <li>Always use stop losses to protect your capital</li>
                        <li>Maintain a minimum 2:1 risk/reward ratio</li>
                        <li>Limit daily trades to avoid overtrading</li>
                        <li>Diversify across multiple positions</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default TradingDashboard;
