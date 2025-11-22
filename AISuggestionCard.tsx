
import React from 'react';
import { StrategySuggestion, UserSettings, StrategyKey, UserUsage, User, StrategyLogicData } from './types';
import { CREDIT_COSTS, USER_TIERS } from './constants';

interface AISuggestionCardProps {
  suggestion: StrategySuggestion;
  onApply: (strategies: StrategyKey[], settings: UserSettings) => void;
  userUsage: UserUsage;
  selectedStrategies: StrategyKey[];
  strategyLogicData: Record<StrategyKey, StrategyLogicData>;
  userSettings: UserSettings;
  currentUser: User | null;
  hasTrades: boolean;
}

const LightbulbIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.311a15.045 15.045 0 0 1-4.5 0m3.75-2.311a15.045 15.045 0 0 0 4.5 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 4.5h.008v.008H12v-.008Z" /></svg>;
const InfoIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9Z" clipRule="evenodd" /></svg>;

const AISuggestionCard: React.FC<AISuggestionCardProps> = ({ suggestion, onApply, userUsage, selectedStrategies, strategyLogicData, userSettings, currentUser, hasTrades }) => {
  const { suggestedStrategies, suggestedSettings, reasoning } = suggestion;
  
  const isApprentice = currentUser?.tier === USER_TIERS.APPRENTICE;
  const isActualSuggestion = suggestedStrategies.length > 0 || Object.keys(suggestedSettings).length > 0;

  // If no trades were found AND no new strategies/settings were suggested, it's an informational message.
  const isInformationalOnly = !hasTrades && !isActualSuggestion;

  const cardTheme = isInformationalOnly ? {
    bg: 'bg-blue-900/20',
    border: 'border-blue-500/50',
    iconColor: 'text-blue-300',
    title: "Market Conditions Update",
    icon: <InfoIcon/>
  } : {
    bg: 'bg-purple-900/20',
    border: 'border-purple-500/50',
    iconColor: 'text-purple-300',
    title: "Oracle's Suggestion",
    icon: <LightbulbIcon/>
  };

  const analysisCreditCost = CREDIT_COSTS.ANALYSIS;
  const canPayWithCredits = userUsage.creditsRemaining >= analysisCreditCost;
  const canRedo = isApprentice || canPayWithCredits;

  let buttonText = "Apply & Redo Analysis";
  if (isApprentice) {
      buttonText = "Apply & Redo Analysis";
  } else if (canPayWithCredits) {
      buttonText = `Apply & Redo for ${analysisCreditCost} Credit`;
  } else {
      buttonText = "Not enough Credits";
  }


  return (
    <div className={`${cardTheme.bg} border ${cardTheme.border} rounded-lg p-6 my-6 text-left mx-auto`}>
      <div className="flex items-center mb-4">
        {React.cloneElement(cardTheme.icon, { className: `h-6 w-6 ${cardTheme.iconColor} mr-3 flex-shrink-0` })}
        <h3 className={`font-bold ${cardTheme.iconColor}`} style={{ fontSize: `${userSettings.headingFontSize}px` }}>{cardTheme.title}</h3>
      </div>
      
      <div 
        className="text-gray-300 prose prose-sm prose-invert max-w-none [&_ul]:list-disc [&_ul]:ml-4 [&_strong]:font-semibold"
        style={{ fontSize: `${userSettings.uiFontSize}px` }}
        dangerouslySetInnerHTML={{ __html: reasoning }}
      />
      
      {isActualSuggestion && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 mb-5 pt-4 border-t border-gray-700/50">
            <div>
              <h4 className="font-semibold text-gray-200 mb-2" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Suggested Strategies:</h4>
              <div className="flex flex-wrap gap-2">
                {suggestedStrategies.map(key => (
                  <span key={key} className="px-3 py-1 text-sm font-bold bg-purple-600/80 text-purple-100 rounded-full" style={{ fontSize: `${userSettings.uiFontSize - 1}px` }}>
                    {strategyLogicData[key]?.name || key}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-200 mb-2" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Suggested Preferences:</h4>
              <ul className="text-gray-300/90 space-y-1" style={{ fontSize: `${userSettings.uiFontSize}px` }}>
                {Object.entries(suggestedSettings).map(([key, value]) => {
                    if (!userSettings.hasOwnProperty(key)) return null;
                    const originalValue = userSettings[key as keyof UserSettings];
                    const hasChanged = String(originalValue) !== String(value);
                    const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    
                    return (
                        <li key={key}>
                            <strong>{formattedKey}:</strong> {String(value)}
                            {hasChanged && <span className="text-xs text-gray-400 ml-2">(was {String(originalValue)})</span>}
                        </li>
                    );
                })}
              </ul>
            </div>
          </div>

          <button
            onClick={() => onApply(suggestedStrategies, suggestedSettings)}
            disabled={!canRedo}
            className="w-full bg-yellow-500 text-gray-900 font-bold py-3 px-6 rounded-lg hover:bg-yellow-400 transition-colors disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            {buttonText}
          </button>
        </>
      )}
    </div>
  );
};

export default AISuggestionCard;
