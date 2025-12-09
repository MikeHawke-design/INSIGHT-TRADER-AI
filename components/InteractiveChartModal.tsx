import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts';
import { getMarketData } from '../idb';
import { Trade } from '../types';

interface InteractiveChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  timeframe: string;
  trade?: Trade; // Made optional for pure data visualization
  timezone?: string;
}

const InteractiveChartModal: React.FC<InteractiveChartModalProps> = ({ isOpen, onClose, symbol, timeframe, trade, timezone = 'UTC' }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);

  useEffect(() => {
    setSelectedTimeframe(timeframe);
  }, [timeframe]);

  // Helper to resample candles
  const resampleCandles = (candles: CandlestickData[], sourceTf: string, targetTf: string): CandlestickData[] => {
    // Simple resampling logic (only supports minutes/hours aggregation for now)
    // This is a basic implementation.
    const tfToMinutes = (tf: string) => {
      if (tf.endsWith('m')) return parseInt(tf);
      if (tf.endsWith('h')) return parseInt(tf) * 60;
      if (tf.endsWith('d')) return parseInt(tf) * 60 * 24;
      return 0;
    };

    const sourceMin = tfToMinutes(sourceTf);
    const targetMin = tfToMinutes(targetTf);

    if (sourceMin === 0 || targetMin === 0 || sourceMin >= targetMin) return [];

    const resampled: CandlestickData[] = [];
    let currentCandle: any = null;
    let bucketStartTime = 0;

    // Sort by time just in case
    const sorted = [...candles].sort((a, b) => (a.time as number) - (b.time as number));

    for (const candle of sorted) {
      const time = candle.time as number;
      // Calculate bucket start
      // Assuming timestamps are seconds
      const bucketSizeSeconds = targetMin * 60;
      const bucketStart = Math.floor(time / bucketSizeSeconds) * bucketSizeSeconds;

      if (currentCandle && bucketStart !== bucketStartTime) {
        resampled.push(currentCandle);
        currentCandle = null;
      }

      if (!currentCandle) {
        bucketStartTime = bucketStart;
        currentCandle = {
          time: bucketStart as any,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        };
      } else {
        currentCandle.high = Math.max(currentCandle.high, candle.high);
        currentCandle.low = Math.min(currentCandle.low, candle.low);
        currentCandle.close = candle.close;
      }
    }
    if (currentCandle) resampled.push(currentCandle);
    return resampled;
  };

  // Helper to parse price strings safely
  const parsePrice = (priceStr: string | undefined): number | null => {
    if (!priceStr) return null;
    const clean = String(priceStr).replace(/,/g, '').replace(/[^0-9.]/g, '');
    const val = parseFloat(clean);
    return isNaN(val) ? null : val;
  };

  // Helper to fetch from Binance for more history (Visualization only)
  const fetchBinanceData = async (symbol: string, interval: string): Promise<CandlestickData[]> => {
    try {
      // Map symbol (e.g., BTC/USD -> BTCUSDT)
      const cleanSymbol = symbol.replace('/', '').replace('-', '').toUpperCase();
      // If it ends with USD, append T (USDT) if not present, or just try as is.
      // Binance usually uses USDT.
      let binanceSymbol = cleanSymbol;
      if (binanceSymbol.endsWith('USD') && !binanceSymbol.endsWith('USDT')) {
        binanceSymbol = binanceSymbol.replace('USD', 'USDT');
      }

      const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=500`);
      if (!response.ok) return [];

      const data = await response.json();
      // Binance format: [ [open_time, open, high, low, close, volume, ...], ... ]
      return data.map((d: any) => ({
        time: d[0] / 1000, // Unix timestamp in seconds
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
      }));
    } catch (e) {
      console.warn("Failed to fetch Binance data:", e);
      return [];
    }
  };

  useEffect(() => {
    if (!isOpen || !chartContainerRef.current) return;

    // Initialize Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111827' }, // bg-gray-900
        textColor: '#D1D5DB', // gray-300
      },
      grid: {
        vertLines: { color: '#374151' }, // gray-700
        horzLines: { color: '#374151' },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number, tickMarkType: any, _locale: string) => {
          const date = new Date(time * 1000);
          // Use Intl.DateTimeFormat for timezone support
          const options: Intl.DateTimeFormatOptions = {
            timeZone: timezone,
          };

          // Customize format based on tick type (simplified logic)
          if (tickMarkType === 2 || tickMarkType === 3) { // Day or Month
            options.month = 'short';
            options.day = 'numeric';
          } else {
            options.hour = 'numeric';
            options.minute = 'numeric';
            options.hour12 = false;
          }

          return new Intl.DateTimeFormat('en-US', options).format(date);
        }
      },
      localization: {
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
          }).format(date);
        }
      }
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e', // green-500
      downColor: '#ef4444', // red-500
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    // Fetch Data
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let chartData: CandlestickData[] = [];

        // 1. Try to get cached data first
        // 1. Try to get cached data first for SELECTED timeframe
        let rawData = await getMarketData(symbol, selectedTimeframe);

        // If not found, and selected != original, try to resample from original
        if ((!rawData || rawData.length === 0) && selectedTimeframe !== timeframe) {
          const originalData = await getMarketData(symbol, timeframe);
          if (originalData && originalData.length > 0) {
            // Convert original to CandlestickData first
            const baseCandles = originalData.map((d: any) => {
              let time = d[0];
              if (typeof time === 'string') {
                if (time.includes(' ') && !time.endsWith('Z') && !time.includes('+')) {
                  time = time.replace(' ', 'T') + 'Z';
                }
                time = new Date(time).getTime() / 1000;
              }
              return {
                time: time as any,
                open: parseFloat(d[1]),
                high: parseFloat(d[2]),
                low: parseFloat(d[3]),
                close: parseFloat(d[4]),
              };
            });
            // Resample
            const resampled = resampleCandles(baseCandles, timeframe, selectedTimeframe);
            if (resampled.length > 0) {
              chartData = resampled;
            }
          }
        } else if (rawData && rawData.length > 0) {
          // We found direct data
          chartData = rawData.map((d: any) => {
            let time = d[0];
            if (typeof time === 'string') {
              if (time.includes(' ') && !time.endsWith('Z') && !time.includes('+')) {
                time = time.replace(' ', 'T') + 'Z';
              }
              time = new Date(time).getTime() / 1000;
            }
            return {
              time: time as any,
              open: parseFloat(d[1]),
              high: parseFloat(d[2]),
              low: parseFloat(d[3]),
              close: parseFloat(d[4]),
            };
          });
        }



        // 2. If data is sparse or missing, try fetching from Binance (for crypto)
        // This adds "more history" as requested
        if (chartData.length < 100) {
          const binanceData = await fetchBinanceData(symbol, selectedTimeframe);
          if (binanceData.length > 0) {
            // Merge strategies: 
            // If we have no local data, just use Binance.
            // If we have local data, we prefer local for the "latest" but fill history with Binance.
            // For simplicity in this "visualization only" mode, if Binance returns good data, we can use it, 
            // but we must ensure we don't overwrite the specific candles the user might be analyzing if they differ.
            // However, since this is "purely for visualization", showing the longer history from Binance is likely preferred.

            // Let's merge: use Binance data, but overwrite with local data if timestamps match (local is truth).
            const dataMap = new Map();
            binanceData.forEach(d => dataMap.set(d.time, d));
            chartData.forEach(d => dataMap.set(d.time, d)); // Local overwrites Binance

            chartData = Array.from(dataMap.values()).sort((a, b) => (a.time as number) - (b.time as number));
          }
        }

        if (chartData.length === 0) {
          setError(`No data found for ${symbol} (${selectedTimeframe}).`);
          setIsLoading(false);
          return;
        }

        candlestickSeries.setData(chartData);

        // Add Price Lines (only if trade exists)
        if (trade) {
          const entryPrice = parsePrice(trade.entry);
          const slPrice = parsePrice(trade.stopLoss);
          const tp1Price = parsePrice(trade.takeProfit1);
          const tp2Price = parsePrice(trade.takeProfit2);

          if (entryPrice) {
            candlestickSeries.createPriceLine({
              price: entryPrice,
              color: '#3b82f6', // blue-500
              lineWidth: 2,
              lineStyle: 0, // Solid
              axisLabelVisible: true,
              title: 'ENTRY',
            });
          }

          if (slPrice) {
            candlestickSeries.createPriceLine({
              price: slPrice,
              color: '#ef4444', // red-500
              lineWidth: 2,
              lineStyle: 0,
              axisLabelVisible: true,
              title: 'SL',
            });
          }

          if (tp1Price) {
            candlestickSeries.createPriceLine({
              price: tp1Price,
              color: '#22c55e', // green-500
              lineWidth: 2,
              lineStyle: 1, // Dotted
              axisLabelVisible: true,
              title: 'TP1',
            });
          }

          if (tp2Price) {
            candlestickSeries.createPriceLine({
              price: tp2Price,
              color: '#22c55e', // green-500
              lineWidth: 2,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              title: 'TP2',
            });
          }
        }

        // Fit content
        chart.timeScale().fitContent();

      } catch (err) {
        console.error("Chart data error:", err);
        setError("Failed to load chart data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };

  }, [isOpen, symbol, selectedTimeframe, trade, timezone]); // Re-run when selectedTimeframe changes

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-6xl h-[80vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              {symbol}
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value)}
                className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
              >
                {['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'].map(tf => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </h3>
            <p className="text-xs text-gray-500">Interactive Chart • Scroll to Zoom • Drag to Pan • Timezone: {timezone}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chart Container */}
        <div className="flex-grow relative bg-[#111827]" ref={chartContainerRef}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-900/50">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-4 rounded-lg max-w-md text-center">
                <p className="font-bold mb-1">Chart Unavailable</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InteractiveChartModal;