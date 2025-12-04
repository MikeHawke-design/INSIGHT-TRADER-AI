import React from 'react';
import { RiskManagementSettings } from '../types';

interface TradingDashboardProps {
    riskSettings: RiskManagementSettings;
    onUpdateRiskSettings: (settings: RiskManagementSettings) => void;
}

const TradingDashboard: React.FC<TradingDashboardProps> = ({
    riskSettings,
    onUpdateRiskSettings
}) => {
    // Removed MEXC logic and state

    const handleRiskSettingChange = (key: keyof RiskManagementSettings, value: number | boolean) => {
        onUpdateRiskSettings({
            ...riskSettings,
            [key]: value
        });
    };

    return (
        <div className="space-y-6">
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
