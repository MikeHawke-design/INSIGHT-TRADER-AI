

import React, { useState, useEffect } from 'react';
import { StrategyKey, StrategyLogicData } from '../types';

interface StrategyLogicViewProps {
    strategyLogicData: Record<StrategyKey, StrategyLogicData>;
}

const StrategyLogicView: React.FC<StrategyLogicViewProps> = ({ strategyLogicData }) => {
    const [strategyKey, setStrategyKey] = useState<StrategyKey | null>(null);
    const strategyKeys = Object.keys(strategyLogicData);

    useEffect(() => {
        // This effect ensures a valid strategy is always selected if one exists.
        if (strategyKeys.length > 0) {
            if (!strategyKey || !strategyKeys.includes(strategyKey)) {
                setStrategyKey(strategyKeys[0]);
            }
        } else {
            setStrategyKey(null);
        }
    }, [strategyKeys.join(','), strategyKey]);

    const logic = strategyKey ? strategyLogicData[strategyKey] : null;

    if (strategyKeys.length === 0) {
        return (
            <div className="p-4 md:p-6 space-y-6">
                <h2 className="text-2xl font-bold text-white text-center">Strategy Logic Deep Dive</h2>
                <div className="bg-gray-800 rounded-lg p-6 max-w-3xl mx-auto border border-gray-700 text-center">
                    <p className="text-gray-400">No custom strategies have been created yet.</p>
                    <p className="text-sm text-gray-500 mt-2">Go to Master Controls to create a new strategy from a knowledge source.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            <h2 className="text-2xl font-bold text-white text-center">Strategy Logic Deep Dive</h2>
            
            <div className="max-w-3xl mx-auto">
                <label htmlFor="logic-select" className="block text-sm font-medium text-gray-400 mb-2">Select strategy to view its core logic:</label>
                <select
                    id="logic-select"
                    value={strategyKey || ''}
                    onChange={(e) => setStrategyKey(e.target.value as StrategyKey)}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 py-2 px-3 text-base"
                >
                    {strategyKeys.map((key) => (
                        <option key={key} value={key}>{strategyLogicData[key]?.name || key}</option>
                    ))}
                </select>
            </div>

            {logic && (
                <div className="bg-gray-800 rounded-lg p-6 max-w-3xl mx-auto border border-gray-700">
                    <h3 className="text-xl font-bold text-yellow-400 mb-2">Active Strategy Logic: {logic.name}</h3>
                    <p className="text-gray-400 italic mb-4">
                        Note: This is a read-only view of the AI's core logic. Master-tier users can edit this in the Master Controls panel.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <h4 className="font-semibold text-white border-b border-gray-600 pb-1 mb-2">Strategy Description</h4>
                            <p className="text-gray-300">{logic.description}</p>
                        </div>
                        <div>
                            <h4 className="font-semibold text-white border-b border-gray-600 pb-1 mb-2">Base AI Prompt / Core Logic Outline</h4>
                            <pre className="bg-gray-900/70 p-4 rounded-md text-sm text-gray-300 whitespace-pre-wrap font-mono border border-gray-700/50">
                                {logic.prompt}
                            </pre>
                        </div>
                         {logic.requirements && (
                             <div>
                                <h4 className="font-semibold text-white border-b border-gray-600 pb-1 mb-2">{logic.requirements.title}</h4>
                                <ul className="list-disc list-inside space-y-1 text-sm text-gray-300 pl-2">
                                 {logic.requirements.items.map((item, itemIndex) => (
                                     <li key={itemIndex} dangerouslySetInnerHTML={{ __html: item }}></li>
                                 ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StrategyLogicView;