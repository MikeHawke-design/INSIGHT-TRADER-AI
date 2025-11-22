

import React from 'react';

interface HeatMeterProps {
  level: number;
}

const HeatMeter: React.FC<HeatMeterProps> = ({ level }) => {
    const colors = ['bg-gray-600', 'bg-red-500', 'bg-orange-500', 'bg-yellow-400', 'bg-green-500', 'bg-teal-400'];
    const blocks = Array.from({ length: 5 });

    return (
        <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-gray-400">Heat:</span>
            <div className="flex space-x-1">
                {blocks.map((_, i) => (
                    <div key={i} className={`w-4 h-5 rounded-sm ${i < level ? colors[Math.min(level, colors.length -1)] : 'bg-gray-700'}`}></div>
                ))}
            </div>
        </div>
    );
};

export default HeatMeter;