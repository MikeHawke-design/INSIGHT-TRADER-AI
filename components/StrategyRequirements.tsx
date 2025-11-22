


import React from 'react';
import { StrategyKey, StrategyLogicData } from '../types';

interface StrategyRequirementsProps {
  selectedStrategies: StrategyKey[];
  strategyLogicData: Record<StrategyKey, StrategyLogicData>;
}

const StrategyRequirements: React.FC<StrategyRequirementsProps> = ({ selectedStrategies, strategyLogicData }) => {
    const allRequirements = selectedStrategies.map(key => strategyLogicData[key]?.requirements).filter(Boolean);
    
    if (allRequirements.length === 0) return null;

    return (
        <div className="mt-4 bg-blue-900/20 border border-blue-500/50 rounded-md p-4">
             <div className="flex items-center mb-3">
                <svg className="w-5 h-5 text-blue-300 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <h4 className="font-bold text-blue-300">Strategy Requirements</h4>
            </div>
            <div className="space-y-3">
            {selectedStrategies.map((key) => {
                const req = strategyLogicData[key]?.requirements;
                const stratName = strategyLogicData[key]?.name || key;
                if (!req) return null;
                return (
                    <div key={key}>
                         <p className="font-semibold text-blue-200 text-sm">{req.title} ({stratName}):</p>
                         <ul className="list-disc list-inside space-y-1 text-sm text-blue-200/80 pl-2">
                             {req.items.map((item, itemIndex) => (
                                 <li key={itemIndex} dangerouslySetInnerHTML={{ __html: item }}></li>
                             ))}
                         </ul>
                    </div>
                )
            })}
            </div>
        </div>
    );
};

export default StrategyRequirements;