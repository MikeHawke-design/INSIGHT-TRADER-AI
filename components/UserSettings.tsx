
import React from 'react';
import { UserSettings } from '../types';
import {
  RISK_APPETITE_OPTIONS,
  PREFERRED_TRADE_DURATION_OPTIONS,
  PREFERRED_TRADE_DURATION_DETAILS,
  STOP_LOSS_STRATEGY_OPTIONS,
  STOP_LOSS_STRATEGY_DETAILS,
  ASSET_CLASS_OPTIONS,
  MARKET_TIMING_OPTIONS
} from '../constants';

interface UserSettingsProps {
  userSettings: UserSettings;
  onUserSettingsChange: (settingKey: keyof UserSettings, value: any) => void;
}

const UserSettingsEditor: React.FC<UserSettingsProps> = ({ userSettings, onUserSettingsChange }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let processedValue: string | number | boolean = value;

    if (type === 'checkbox') {
      processedValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number' || type === 'range') {
      processedValue = parseFloat(value);
      if (isNaN(processedValue)) processedValue = 14;
    }
    onUserSettingsChange(name as keyof UserSettings, processedValue);
  };

  const handleRRChange = (newValue: number) => {
    // Clamp the value between 0 and 25 and round to 2 decimal places to avoid floating point issues
    const clampedValue = Math.round(Math.max(0, Math.min(25, newValue)) * 100) / 100;
    onUserSettingsChange('minRiskRewardRatio', clampedValue);
  };


  return (
    <div className="bg-[hsl(var(--color-bg-800)/0.7)] p-4 rounded-lg border border-[hsl(var(--color-border-700))] space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Appetite */}
        <div>
          <label htmlFor="riskAppetite" className="block text-sm font-medium text-gray-300 mb-1">Risk Appetite</label>
          <select
            id="riskAppetite"
            name="riskAppetite"
            value={userSettings.riskAppetite}
            onChange={handleInputChange}
            className="w-full bg-[hsl(var(--color-bg-700))] border border-[hsl(var(--color-border-600))] text-white rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 py-2 px-3 text-base"
          >
            {RISK_APPETITE_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Conservative prefers higher probability, Aggressive seeks higher reward.</p>
        </div>

        {/* Min Risk/Reward Ratio */}
        <div>
          <label htmlFor="minRiskRewardRatio" className="block text-sm font-medium text-gray-300 mb-1">Min. Risk/Reward Ratio (R:R)</label>
          <div className="flex items-center gap-4 mt-2">
            <input
              type="range"
              id="minRiskRewardRatio"
              name="minRiskRewardRatio"
              value={userSettings.minRiskRewardRatio}
              onChange={handleInputChange}
              min="0"
              max="25"
              step="0.25"
              className="w-full h-2 bg-[hsl(var(--color-bg-900))] rounded-lg appearance-none cursor-pointer accent-yellow-500"
            />
            <div className="flex items-center gap-1 bg-[hsl(var(--color-bg-900))] border border-[hsl(var(--color-border-600))] rounded-md p-0.5">
              <button
                onClick={() => handleRRChange(userSettings.minRiskRewardRatio - 0.25)}
                className="px-2 py-1 rounded text-lg font-bold text-gray-400 hover:bg-[hsl(var(--color-bg-700))] hover:text-white leading-none"
                aria-label="Decrement Risk/Reward Ratio"
              >
                -
              </button>
              <span className="font-mono font-bold text-yellow-400 text-base w-16 text-center select-none">
                {userSettings.minRiskRewardRatio.toFixed(2)}
              </span>
              <button
                onClick={() => handleRRChange(userSettings.minRiskRewardRatio + 0.25)}
                className="px-2 py-1 rounded text-lg font-bold text-gray-400 hover:bg-[hsl(var(--color-bg-700))] hover:text-white leading-none"
                aria-label="Increment Risk/Reward Ratio"
              >
                +
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">E.g., 2.00 means Take Profit is at least 2x Stop Loss distance.</p>
        </div>

        {/* Preferred Trade Duration */}
        <div>
          <label htmlFor="preferredTradeDuration" className="block text-sm font-medium text-gray-300 mb-1">Preferred Trade Duration</label>
          <select
            id="preferredTradeDuration"
            name="preferredTradeDuration"
            value={userSettings.preferredTradeDuration}
            onChange={handleInputChange}
            className="w-full bg-[hsl(var(--color-bg-700))] border border-[hsl(var(--color-border-600))] text-white rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 py-2 px-3 text-base"
          >
            {PREFERRED_TRADE_DURATION_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">{PREFERRED_TRADE_DURATION_DETAILS[userSettings.preferredTradeDuration]}</p>
        </div>

        {/* Trade Against Trend */}
        <div className="flex items-center pt-5">
          <input
            id="tradeAgainstTrend"
            name="tradeAgainstTrend"
            type="checkbox"
            checked={userSettings.tradeAgainstTrend}
            onChange={handleInputChange}
            className="h-4 w-4 text-yellow-500 border-[hsl(var(--color-border-600))] rounded focus:ring-yellow-400 bg-[hsl(var(--color-bg-700))]"
          />
          <label htmlFor="tradeAgainstTrend" className="ml-2 block text-sm font-medium text-gray-300">
            Allow Counter-Trend Trades?
          </label>
        </div>

        {/* New: Preferred Asset Class */}
        <div>
          <label htmlFor="preferredAssetClass" className="block text-sm font-medium text-gray-300 mb-1">Preferred Asset Class</label>
          <select
            id="preferredAssetClass"
            name="preferredAssetClass"
            value={userSettings.preferredAssetClass}
            onChange={handleInputChange}
            className="w-full bg-[hsl(var(--color-bg-700))] border border-[hsl(var(--color-border-600))] text-white rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 py-2 px-3 text-base"
          >
            {ASSET_CLASS_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Tells the AI which asset you primarily trade to adjust for volatility.</p>
        </div>

        {/* New: Market Timing */}
        <div>
          <label htmlFor="marketTiming" className="block text-sm font-medium text-gray-300 mb-1">Market Timing / Session</label>
          <select
            id="marketTiming"
            name="marketTiming"
            value={userSettings.marketTiming}
            onChange={handleInputChange}
            className="w-full bg-[hsl(var(--color-bg-700))] border border-[hsl(var(--color-border-600))] text-white rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 py-2 px-3 text-base"
          >
            {MARKET_TIMING_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">Guides the AI on session-specific behaviors like killzones or market opens.</p>
        </div>

        {/* Stop-Loss Strategy */}
        <div className="md:col-span-2">
          <label htmlFor="stopLossStrategy" className="block text-sm font-medium text-gray-300 mb-1">Stop-Loss Placement Logic</label>
          <select
            id="stopLossStrategy"
            name="stopLossStrategy"
            value={userSettings.stopLossStrategy}
            onChange={handleInputChange}
            className="w-full bg-[hsl(var(--color-bg-700))] border border-[hsl(var(--color-border-600))] text-white rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 py-2 px-3 text-base"
          >
            {STOP_LOSS_STRATEGY_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">{STOP_LOSS_STRATEGY_DETAILS[userSettings.stopLossStrategy]}</p>
        </div>

        {/* TwelveData API Key (Temporary Location until dedicated API settings) */}
        <div className="md:col-span-2 pt-4 border-t border-[hsl(var(--color-border-700))]">
          <label htmlFor="twelveDataApiKey" className="block text-sm font-medium text-gray-300 mb-1">TwelveData API Key (For Market Scanner)</label>
          <input
            type="password"
            id="twelveDataApiKey"
            name="twelveDataApiKey"
            value={(userSettings as any).twelveDataApiKey || ''}
            onChange={handleInputChange}
            placeholder="Enter your TwelveData API Key"
            className="w-full bg-[hsl(var(--color-bg-700))] border border-[hsl(var(--color-border-600))] text-white rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-yellow-500 py-2 px-3 text-base"
          />
          <p className="text-xs text-gray-500 mt-1">Required for real-time market data in Scanner. Get it from twelvedata.com.</p>
        </div>
      </div>
    </div>
  );
};

export default UserSettingsEditor;