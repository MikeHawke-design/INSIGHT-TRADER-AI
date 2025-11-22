import React, { useMemo } from 'react';

interface PerformanceChartProps {
    data: number[];
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data }) => {
    const chartHeight = 300;
    const chartWidth = 800;
    const padding = { top: 20, right: 40, bottom: 20, left: 40 };

    const { path, areaPath, yAxisLabels, zeroLineY } = useMemo(() => {
        if (data.length <= 1) {
            return { path: '', areaPath: '', yAxisLabels: [], zeroLineY: chartHeight / 2 };
        }

        const yMin = Math.min(0, ...data);
        const yMax = Math.max(0, ...data);
        const yRange = yMax - yMin === 0 ? 1 : yMax - yMin;

        const getX = (index: number) => padding.left + (index / (data.length - 1)) * (chartWidth - padding.left - padding.right);
        const getY = (value: number) => (chartHeight - padding.bottom) - ((value - yMin) / yRange) * (chartHeight - padding.top - padding.bottom);

        const pathPoints = data.map((point, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(point)}`).join(' ');
        
        const areaPoints = `${pathPoints} L ${getX(data.length - 1)} ${chartHeight - padding.bottom} L ${getX(0)} ${chartHeight - padding.bottom} Z`;

        const labels = [];
        if (yMax > 0) labels.push({ value: yMax.toFixed(1), y: getY(yMax) });
        if (yMin < 0) labels.push({ value: yMin.toFixed(1), y: getY(yMin) });
        if (yMin < 0 && yMax > 0) labels.push({ value: '0', y: getY(0) });
        else if (labels.length === 0) labels.push({ value: '0', y: getY(0) });

        return {
            path: pathPoints,
            areaPath: areaPoints,
            yAxisLabels: labels,
            zeroLineY: getY(0)
        };
    }, [data, chartHeight, chartWidth, padding]);

    return (
        <div className="w-full h-full relative">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id="glowGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#facc15" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
                    </linearGradient>
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Grid Lines (optional, for reference) */}
                {yAxisLabels.map((label, i) => (
                     <line
                        key={i}
                        x1={padding.left}
                        y1={label.y}
                        x2={chartWidth - padding.right}
                        y2={label.y}
                        stroke="#374151"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                    />
                ))}

                {/* Zero Line */}
                 <line
                    x1={padding.left}
                    y1={zeroLineY}
                    x2={chartWidth - padding.right}
                    y2={zeroLineY}
                    stroke="#6b7280"
                    strokeWidth="1.5"
                />

                {/* Area Path */}
                <path d={areaPath} fill="url(#glowGradient)" />

                {/* Main Line Path */}
                <path d={path} fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{filter: 'url(#glow)'}} />
                
                {/* Y-Axis Labels */}
                {yAxisLabels.map((label, i) => (
                     <text
                        key={i}
                        x={padding.left - 10}
                        y={label.y}
                        dy="0.32em"
                        textAnchor="end"
                        fill="#9ca3af"
                        fontSize="12"
                        className="font-mono"
                    >
                        {label.value}R
                    </text>
                ))}
            </svg>
        </div>
    );
};

export default PerformanceChart;