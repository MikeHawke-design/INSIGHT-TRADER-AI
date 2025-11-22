import React, { useEffect, useRef } from 'react';
import { createChart, UTCTimestamp } from 'lightweight-charts';
import { MarketDataCandle } from '../types';

interface InteractiveChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartData: MarketDataCandle[];
  title: string;
}

const InteractiveChartModal: React.FC<InteractiveChartModalProps> = ({
  isOpen,
  onClose,
  chartData,
  title,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  useEffect(() => {
    if (!isOpen || !chartContainerRef.current || chartData.length === 0) {
      return;
    }

    const chartEl = chartContainerRef.current;
    
    // Read colors from computed styles of CSS variables
    const computedStyle = getComputedStyle(document.documentElement);
    const bgColor = computedStyle.getPropertyValue('--js-chart-bg').trim() || '#111827';
    const textColor = computedStyle.getPropertyValue('--js-chart-text').trim() || '#d1d5db';
    const gridColor = computedStyle.getPropertyValue('--js-chart-grid').trim() || '#374151';
    const borderColor = computedStyle.getPropertyValue('--js-chart-border').trim() || '#4b5563';


    const chart = createChart(chartEl, {
      width: chartEl.clientWidth,
      height: chartEl.clientHeight,
      layout: {
        background: { color: bgColor },
        textColor: textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      timeScale: {
        timeVisible: true,
        borderColor: borderColor,
      },
      rightPriceScale: {
        borderColor: borderColor,
      },
    });

    chartRef.current = chart;
    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: '#10b981', // green-500
      downColor: '#ef4444', // red-500
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981',
    });

    const formattedData = chartData.map(candle => ({
      time: (new Date(candle.date).getTime() / 1000) as UTCTimestamp, // lightweight-charts uses UNIX timestamp in seconds
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    })).sort((a, b) => a.time - b.time);

    candlestickSeries.setData(formattedData);
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.resize(chartContainerRef.current.clientWidth, chartContainerRef.current.clientHeight);
      }
    };
    
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      if(chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [isOpen, chartData]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-[100] p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[hsl(var(--color-bg-800))] p-4 md:p-6 rounded-lg shadow-xl w-full max-w-6xl h-[80vh] border border-yellow-500/50 flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-4 border-b border-[hsl(var(--color-border-700))] flex-shrink-0">
          <h2 className="text-xl font-bold text-yellow-400">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
            aria-label="Close chart viewer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div ref={chartContainerRef} className="flex-grow mt-4 w-full h-full"></div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
      `}</style>
    </div>
  );
};

export default InteractiveChartModal;