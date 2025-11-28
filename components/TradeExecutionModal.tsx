import React, { useState } from 'react';
import { Trade } from '../types';
import { placeBlofinOrder, getBlofinPrice } from '../blofinApi';

interface TradeExecutionModalProps {
    isOpen: boolean;
    trade: Trade;
    onClose: () => void;
    blofinCredentials: {
        apiKey: string;
        secretKey: string;
        passphrase: string;
    } | null;
}

const TradeExecutionModal: React.FC<TradeExecutionModalProps> = ({
    isOpen,
    trade,
    onClose,
    blofinCredentials
}) => {
    const [isExecuting, setIsExecuting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [instrument, setInstrument] = useState('BTC-USDT');
    const [contractSize, setContractSize] = useState('0.1');
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);

    React.useEffect(() => {
        if (isOpen) {
            // Fetch current price when modal opens
            getBlofinPrice(instrument)
                .then(price => setCurrentPrice(price))
                .catch(err => console.error('Failed to fetch price:', err));
        }
    }, [isOpen, instrument]);

    const handleExecute = async () => {
        if (!blofinCredentials) {
            setError('BloFin API credentials not configured. Please add them in Settings.');
            return;
        }

        setIsExecuting(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await placeBlofinOrder(
                blofinCredentials,
                trade,
                instrument
            );

            if (response.code === '0' && response.data[0].code === '0') {
                setSuccess(`Order placed successfully! Order ID: ${response.data[0].orderId}`);
            } else {
                setError(`Order failed: ${response.data[0].msg || response.msg}`);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
            setError(errorMessage);
        } finally {
            setIsExecuting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4">
            <div className="bg-gray-800 rounded-lg max-w-2xl w-full p-6 border border-yellow-500/50">
                <h2 className="text-2xl font-bold text-yellow-400 mb-4">Execute Trade on BloFin</h2>

                {!blofinCredentials ? (
                    <div className="bg-red-900/30 border border-red-500/50 rounded-md p-4 mb-4">
                        <p className="text-red-300 font-semibold">⚠️ BloFin API Not Configured</p>
                        <p className="text-sm text-gray-300 mt-2">
                            Please add your BloFin API credentials in the Settings tab before executing trades.
                        </p>
                    </div>
                ) : (
                    <>
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
                                        <span className="ml-2 text-white">{currentPrice || 'Loading...'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Stop Loss:</span>
                                        <span className="ml-2 text-red-400">{trade.stopLoss}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">Take Profit 1:</span>
                                        <span className="ml-2 text-green-400">{trade.takeProfit1}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-gray-400">Take Profit 2:</span>
                                        <span className="ml-2 text-green-400">{trade.takeProfit2}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-900/50 p-4 rounded-md">
                                <h3 className="font-semibold text-white mb-3">Order Configuration</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Instrument</label>
                                        <select
                                            value={instrument}
                                            onChange={(e) => setInstrument(e.target.value)}
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                                        >
                                            <option value="BTC-USDT">BTC-USDT</option>
                                            <option value="ETH-USDT">ETH-USDT</option>
                                            <option value="SOL-USDT">SOL-USDT</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-1">Contract Size (minimum 0.1)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0.1"
                                            value={contractSize}
                                            onChange={(e) => setContractSize(e.target.value)}
                                            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-md p-4">
                                <p className="text-yellow-300 font-semibold text-sm">⚠️ Important</p>
                                <ul className="text-xs text-gray-300 mt-2 space-y-1 list-disc list-inside">
                                    <li>This will place a REAL order on BloFin exchange</li>
                                    <li>Ensure you have sufficient balance in your BloFin account</li>
                                    <li>Stop Loss and Take Profit will be set automatically</li>
                                    <li>Review all details carefully before confirming</li>
                                </ul>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-900/30 border border-red-500/50 rounded-md p-3 mb-4">
                                <p className="text-red-300 text-sm">{error}</p>
                            </div>
                        )}

                        {success && (
                            <div className="bg-green-900/30 border border-green-500/50 rounded-md p-3 mb-4">
                                <p className="text-green-300 text-sm">{success}</p>
                            </div>
                        )}
                    </>
                )}

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-white font-semibold"
                    >
                        {success ? 'Close' : 'Cancel'}
                    </button>
                    {blofinCredentials && !success && (
                        <button
                            onClick={handleExecute}
                            disabled={isExecuting}
                            className="px-6 py-2 bg-green-600 hover:bg-green-500 rounded-md text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isExecuting ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Executing...
                                </>
                            ) : (
                                'Execute Trade'
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TradeExecutionModal;
