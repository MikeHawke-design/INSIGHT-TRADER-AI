import React, { useMemo } from 'react';

interface PerformanceChartProps {
    data: number[];
    height?: number;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, height = 120 }) => {
    const chartHeight = height;
    const chartWidth = 800;
    const padding = { top: 10, right: 50, bottom: 10, left: 10 };

    const { path, areaPath, yAxisLabels, zeroLineY, currentR } = useMemo(() => {
        if (data.length <= 1) {
            return { path: '', areaPath: '', yAxisLabels: [], zeroLineY: chartHeight / 2, currentR: 0 };
        }

        const yMin = Math.min(0, ...data);
        const yMax = Math.max(0, ...data);
        const yRange = yMax - yMin === 0 ? 1 : yMax - yMin;

        // Add 10% padding to Y range so line doesn't hit edges
        const paddedYMin = yMin - (yRange * 0.1);
        const paddedYMax = yMax + (yRange * 0.1);
        const paddedRange = paddedYMax - paddedYMin;

        const getX = (index: number) => padding.left + (index / (data.length - 1)) * (chartWidth - padding.left - padding.right);
        const getY = (value: number) => (chartHeight - padding.bottom) - ((value - paddedYMin) / paddedRange) * (chartHeight - padding.top - padding.bottom);

        // Create smooth bezier curve
        const points = data.map((point, i) => ({ x: getX(i), y: getY(point) }));

        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            // Simple line for now, bezier can be complex to calculate manually without a lib
            d += ` L ${points[i].x} ${points[i].y}`;
        }

        const pathPoints = d;
        const areaPoints = `${pathPoints} L ${getX(data.length - 1)} ${chartHeight - padding.bottom} L ${getX(0)} ${chartHeight - padding.bottom} Z`;

        const labels = [];
        // Only show Max and Min labels on the right side
        labels.push({ value: yMax.toFixed(1), y: getY(yMax) });
        if (yMin < 0) labels.push({ value: yMin.toFixed(1), y: getY(yMin) });

        // Zero line
        const zeroY = getY(0);

        return {
            path: pathPoints,
            areaPath: areaPoints,
            yAxisLabels: labels,
            zeroLineY: zeroY,
            currentR: data[data.length - 1]
        };
    }, [data, chartHeight, chartWidth, padding]);

    return (
        <div className="w-full h-full relative group">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#facc15" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="#facc15" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Zero Line */}
                <line
                    x1={padding.left}
                    y1={zeroLineY}
                    x2={chartWidth - padding.right}
                    y2={zeroLineY}
                    stroke="#4b5563"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    opacity="0.5"
                />

                {/* Area Path */}
                <path d={areaPath} fill="url(#chartGradient)" />

                {/* Main Line Path */}
                <path d={path} fill="none" stroke="#facc15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                {/* Current Value Indicator (Right Side) */}
                <circle cx={chartWidth - padding.right} cy={path.split(' ').slice(-1)[0] /* Approximation, logic handled in useMemo better usually but SVG path string parsing is hard here. Let's rely on data last point */} r="3" fill="#facc15" />

                {/* Y-Axis Labels (Right Side) */}
                {yAxisLabels.map((label, i) => (
                    <text
                        key={i}
                        x={chartWidth - 5}
                        y={label.y}
                        dy="0.32em"
                        textAnchor="end"
                        fill="#6b7280"
                        fontSize="10"
                        className="font-mono select-none"
                    >
                        {label.value}R
                    </text>
                ))}
            </svg>

            {/* Current R Overlay */}
            <div className="absolute top-2 left-4 text-yellow-400 font-mono text-xs font-bold opacity-50 group-hover:opacity-100 transition-opacity">
                Current: {currentR > 0 ? '+' : ''}{currentR.toFixed(2)}R
            </div>
        </div>
    );
};

export default PerformanceChart;