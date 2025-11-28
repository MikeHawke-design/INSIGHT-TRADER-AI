import React, { useState, useEffect } from 'react';
import { Trade, RiskManagementSettings } from '../types';
import { placeMexcOrder, getMexcPrice, calculatePositionSize, calculateRiskReward } from '../mexcApi';

interface MexcTradeExecutionModalProps {
    isOpen: boolean;
    trade: Trade;
    onClose: () => void;
    mexcCredentials: {
        apiKey: string;
        secretKey: string;
    } | null;
    accountBalance: number;
    riskSettings: RiskManagementSettings;
}

const MexcTradeExecutionModal: React.FC<MexcTradeExecutionModalProps> = ({
    isOpen,
    trade,
    onClose,
    mexcCredentials,
    accountBalance,
    riskSettings
}) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [symbol, setSymbol] = useState('BTCUSDT');
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [calculatedQuantity, setCalculatedQuantity] = useState<string>('0');
    const [riskRewardRatio, setRiskRewardRatio] = useState<number>(0);
    const [riskAmount, setRiskAmount] = useState<number>(0);

    useEffect(() => {
        if (isOpen && symbol) {
            // Fetch current price
            getMexcPrice(symbol)
                .then(price => setCurrentPrice(price))
                .catch(err => console.error('Failed to fetch price:', err));
        }
    }, [isOpen, symbol]);

    useEffect(() => {
        if (isOpen && trade) {
            // Calculate position size based on risk settings
            const entryPrice = parseFloat(trade.entry.toString());
            const stopLossPrice = parseFloat(trade.stopLoss.toString());
            const takeProfitPrice = parseFloat(trade.takeProfit1.toString());

            // Calculate risk amount
            const riskAmt = accountBalance * (riskSettings.riskPercentagePerTrade / 100);
            setRiskAmount(riskAmt);

            // Calculate position size
            const positionSize = calculatePositionSize(
                accountBalance,
                riskSettings.riskPercentagePerTrade,
                entryPrice,
                stopLossPrice
            );

            setCalculatedQuantity(positionSize.toFixed(8));

            // Calculate R:R ratio
            const rrRatio = calculateRiskReward(entryPrice, stopLossPrice, takeProfitPrice);
            setRiskRewardRatio(rrRatio);
        }
    }, [isOpen, trade, accountBalance, riskSettings]);

    const handleExecute = async () => {
        if (!mexcCredentials) {
            setError('MEXC API credentials not configured. Please add them in Settings.');
            return;
        }

        // Validate risk/reward ratio
        if (riskRewardRatio < riskSettings.minRiskRewardRatio) {
            setError(`Risk/Reward ratio (${riskRewardRatio.toFixed(2)}) is below minimum (${riskSettings.minRiskRewardRatio}). Trade rejected.`);
            return;
        }

        setIsExecuting(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await placeMexcOrder(
                mexcCredentials,
                trade,
                symbol,
                calculatedQuantity
            );

            setSuccess(`Order placed successfully! Order ID: ${response.orderId}`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleClose = () => {
        setError(null);
        setSuccess(null);
        onClose();
    };

    if (!isOpen) return null;

    const isRiskRewardAcceptable = riskRewardRatio >= riskSettings.minRiskRewardRatio;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4">
            <div className="bg-gray-800 rounded-lg max-w-3xl w-full p-6 border border-yellow-500/50 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-yellow-400">Execute Trade on MEXC</h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {!mexcCredentials ? (
                    <div className="bg-red-900/30 border border-red-500/50 rounded-md p-4 mb-4">
                        <p className="text-red-300 font-semibold">⚠️ MEXC API Not Configured</p>
                        <p className="text-sm text-gray-300 mt-2">
                            Please add your MEXC API credentials in the Settings tab before executing trades.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Trade Details */}
                        <div className="space-y-4 mb-6">
                            <div className="bg-gray-900/50 p-4 rounded-md">
                                <h3 className="font-semibold text-white mb-3">Trade Details</h3>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-400">Direction:</span>
                                        <span className={`ml-2 font-bold ${trade.direction === 'Long' ? 'text-green-400' : 'text-red-400'}`}>
                                            {trade.direction}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Entry Type:</span>
                                        <span className="ml-2 text-white">{trade.entryType}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Entry Price:</span>
                                        <span className="ml-2 text-white">{trade.entry}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Current Price:</span>
                                        <span className="ml-2 text-white">{currentPrice?.toFixed(2) || 'Loading...'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Stop Loss:</span>
                                        <span className="ml-2 text-red-400">{trade.stopLoss}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Take Profit:</span>
                                        <span className="ml-2 text-green-400">{trade.takeProfit1}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Risk Analysis */}
                            <div className={`p-4 rounded-md ${isRiskRewardAcceptable ? 'bg-green-900/30 border border-green-500/50' : 'bg-red-900/30 border border-red-500/50'}`}>
                                <h3 className="font-semibold text-white mb-3">Risk Analysis</h3>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-400">Risk Amount:</span>
                                        <span className="ml-2 text-white font-bold">${riskAmount.toFixed(2)}</span>
                                        <span className="ml-1 text-gray-500">({riskSettings.riskPercentagePerTrade}%)</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Position Size:</span>
                                        <span className="ml-2 text-white font-bold">{calculatedQuantity}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-400">Risk/Reward Ratio:</span>
                                        <span className={`ml-2 font-bold text-lg ${isRiskRewardAcceptable ? 'text-green-400' : 'text-red-400'}`}>
                                            1:{riskRewardRatio.toFixed(2)}
                                        </span>
                                        {!isRiskRewardAcceptable && (
                                            <span className="ml-2 text-red-300 text-xs">
                                                (Below minimum {riskSettings.minRiskRewardRatio})
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Symbol Selection */}
                            <div className="bg-gray-900/50 p-4 rounded-md">
                                <h3 className="font-semibold text-white mb-3">Order Configuration</h3>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">Trading Pair</label>
                                    <select
                                        value={symbol}
                                        onChange={(e) => setSymbol(e.target.value)}
                                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                                    >
                                        <option value="BTCUSDT">BTC/USDT</option>
                                        <option value="ETHUSDT">ETH/USDT</option>
                                        <option value="SOLUSDT">SOL/USDT</option>
                                        <option value="BNBUSDT">BNB/USDT</option>
                                        <option value="XRPUSDT">XRP/USDT</option>
                                        <option value="ADAUSDT">ADA/USDT</option>
                                        <option value="DOGEUSDT">DOGE/USDT</option>
                                    </select>
                                </div>
                            </div>

                            {/* Warnings */}
                            <div className="bg-yellow-900/30 border border-yellow-500/30 rounded-md p-4">
                                <p className="text-yellow-300 font-semibold text-sm">⚠️ Important</p>
                                <ul className="text-xs text-gray-300 mt-2 space-y-1 list-disc list-inside">
                                    <li>This will place a REAL order on MEXC exchange</li>
                                    <li>Position size calculated based on your risk settings ({riskSettings.riskPercentagePerTrade}% risk)</li>
                                    <li>Ensure you have sufficient USDT balance in your MEXC account</li>
                                    <li>Stop loss and take profit orders may need to be placed separately</li>
                                    <li>Review all details carefully before confirming</li>
                                </ul>
                            </div>

                            {/* Error/Success Messages */}
                            {error && (
                                <div className="bg-red-900/30 border border-red-500/50 rounded-md p-4">
                                    <p className="text-red-300 font-semibold">❌ Error</p>
                                    <p className="text-sm text-gray-300 mt-1">{error}</p>
                                </div>
                            )}

                            {success && (
                                <div className="bg-green-900/30 border border-green-500/50 rounded-md p-4">
                                    <p className="text-green-300 font-semibold">✅ Success</p>
                                    <p className="text-sm text-gray-300 mt-1">{success}</p>
                                </div>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleClose}
                                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExecute}
                                disabled={isExecuting || !isRiskRewardAcceptable || !!success}
                                className={`flex-1 font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 ${isRiskRewardAcceptable && !success
                                    ? 'bg-green-600 hover:bg-green-500 text-white'
                                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {isExecuting ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Executing...
                                    </>
                                ) : success ? (
                                    '✅ Order Placed'
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                                            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                                        </svg>
                                        Execute Trade
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default MexcTradeExecutionModal;
