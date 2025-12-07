import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts';
import { getMarketData } from '../idb';
import { Trade } from '../types';

interface InteractiveChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  timeframe: string;
  trade: Trade;
}

const InteractiveChartModal: React.FC<InteractiveChartModalProps> = ({ isOpen, onClose, symbol, timeframe, trade }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to parse price strings safely
  const parsePrice = (priceStr: string | undefined): number | null => {
    if (!priceStr) return null;
    const clean = String(priceStr).replace(/,/g, '').replace(/[^0-9.]/g, '');
    const val = parseFloat(clean);
    return isNaN(val) ? null : val;
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
      },
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
        const rawData = await getMarketData(symbol, timeframe);
        if (!rawData || rawData.length === 0) {
          setError(`No cached data found for ${symbol} (${timeframe}).`);
          setIsLoading(false);
          return;
        }

        // Format data for lightweight-charts
        // Expected format: { time: '2018-12-22', open: 75.16, high: 82.84, low: 36.16, close: 45.72 }
        // Stored format: [time, open, high, low, close, volume]
        // Time from TwelveData is "YYYY-MM-DD HH:mm:ss" or timestamp.
        // Lightweight charts handles string dates well if formatted correctly, or unix timestamp.

        const chartData: CandlestickData[] = rawData.map((d: any) => {
          // Check if time is timestamp or string
          let time = d[0];
          if (typeof time === 'string' && time.includes(' ')) {
            // Convert "YYYY-MM-DD HH:mm:ss" to unix timestamp
            time = new Date(time).getTime() / 1000;
          } else if (typeof time === 'string') {
            // "YYYY-MM-DD"
            // keep as string
          }

          return {
            time: time as any,
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
          };
        });

        // Sort by time
        chartData.sort((a, b) => (a.time as number) - (b.time as number));

        // Remove duplicates
        const uniqueData: CandlestickData[] = [];
        const seenTimes = new Set();
        for (const item of chartData) {
          if (!seenTimes.has(item.time)) {
            seenTimes.add(item.time);
            uniqueData.push(item);
          }
        }

        candlestickSeries.setData(uniqueData);

        // Add Price Lines
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
  }, [isOpen, symbol, timeframe, trade]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-6xl h-[80vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              {symbol} <span className="text-sm text-gray-400 font-normal">({timeframe})</span>
            </h3>
            <p className="text-xs text-gray-500">Interactive Chart • Scroll to Zoom • Drag to Pan</p>
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