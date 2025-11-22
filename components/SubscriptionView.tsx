
import React, { useState } from 'react';
import { User, UserTier, SubscriptionPlan } from '../types';
import { SUBSCRIPTION_PLANS, USER_TIERS } from '../constants';

interface SubscriptionViewProps {
  currentUser: User | null;
  onUpgradeTier: (newTier: UserTier) => void;
}

const CheckIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0Z" clipRule="evenodd" /></svg>;
const ChevronDownIcon = (props:{className?:string}) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>;


const SubscriptionPlanCard: React.FC<{
  plan: SubscriptionPlan;
  isCurrent: boolean;
  onSelect: () => void;
}> = ({ plan, isCurrent, onSelect }) => {
  const [isAddOnSelected, setIsAddOnSelected] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const displayPrice = plan.addOn ? plan.price + (isAddOnSelected ? plan.addOn.price : 0) : plan.price;

  const cardClasses = `bg-gray-800 rounded-lg p-8 border-2 flex flex-col transition-transform duration-300 relative ${
    plan.featured ? 'border-purple-500 transform lg:scale-105' : 'border-gray-700'
  } ${isCurrent ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-gray-900' : ''}`;

  const visibleFeatures = isExpanded ? plan.features : plan.features.slice(0, 5);

  return (
    <div className={cardClasses}>
      {plan.featured && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider">
          Best Value
        </div>
      )}
      <h3 className="text-2xl font-semibold text-white">{plan.name}</h3>
      <p className="mt-2 text-gray-400 text-sm h-12">{plan.description}</p>
      
      <div className="mt-6">
        <span className="text-4xl font-bold text-white">${displayPrice.toFixed(2)}</span>
        <span className="text-base font-medium text-gray-400">{plan.priceFrequency}</span>
      </div>
      
      <ul className="mt-8 space-y-4 flex-grow">
        {visibleFeatures.map(feature => (
          <li key={feature} className="flex items-start">
            <div className="flex-shrink-0">
              <CheckIcon className="h-5 w-5 text-green-400 mt-0.5" />
            </div>
            <p className="ml-3 text-base text-gray-300">{feature}</p>
          </li>
        ))}
      </ul>
      
      {plan.features.length > 5 && (
        <button 
          onClick={() => setIsExpanded(prev => !prev)} 
          className="mt-4 text-sm font-semibold text-yellow-400 hover:text-yellow-300 flex items-center gap-2 mx-auto"
        >
          {isExpanded ? 'Show Less' : `Show All ${plan.features.length} Features`}
          <ChevronDownIcon className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      )}

      {plan.id === 'Advanced AI' && (
          <div className="mt-6 p-3 bg-yellow-900/20 rounded-lg border border-yellow-500/50 text-center">
              <p className="text-sm font-semibold text-yellow-300">Important: BYOA Costs</p>
              <p className="text-xs text-yellow-200/80 mt-1">
                  You are responsible for all costs incurred on your personal API key, subject to your API provider's pricing and limits.
              </p>
          </div>
      )}

      {plan.addOn && (
        <div className="mt-6 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <label className="flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    checked={isAddOnSelected}
                    onChange={() => setIsAddOnSelected(p => !p)}
                    className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-purple-500 focus:ring-purple-500"
                />
                <div className="ml-3">
                    <p className="font-semibold text-white">Add: {plan.addOn.name}</p>
                    <p className="text-xs text-gray-400">{plan.addOn.description}</p>
                </div>
                <span className="ml-auto font-bold text-purple-300">+${plan.addOn.price.toFixed(2)}</span>
            </label>
        </div>
      )}

      <button
        onClick={onSelect}
        disabled={isCurrent}
        className={`mt-8 block w-full py-3 px-6 border border-transparent rounded-md text-center font-medium
          ${isCurrent ? 'bg-yellow-500 text-gray-900 cursor-default' : 
           plan.featured ? 'bg-purple-600 text-white hover:bg-purple-500' :
           plan.price === 0 ? 'bg-blue-600 text-white hover:bg-blue-500' :
           'bg-blue-600 text-white hover:bg-blue-500'}`}
      >
        {isCurrent ? 'Current Plan' : plan.price === 0 ? 'Choose Plan' : 'Choose Plan'}
      </button>
    </div>
  );
};

const SubscriptionView: React.FC<SubscriptionViewProps> = ({ currentUser, onUpgradeTier }) => {
  const isTraditionalTrader = currentUser?.tier === USER_TIERS.TRADITIONAL_TRADER;
  const isAdvancedAI = currentUser?.tier === USER_TIERS.ADVANCED_AI;
  
  return (
    <div className="p-4 md:p-8 min-h-[calc(100vh-200px)]">
      <div className="mx-auto">
        <h2 className="text-3xl font-bold text-white text-center">Plans & Pricing</h2>
        <p className="mt-4 max-w-2xl mx-auto text-center text-lg text-gray-400">
          Choose the plan that fits your trading journey.
        </p>
        
        <div className="mt-16 mx-auto max-w-6xl space-y-12 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-8 lg:items-center">
          {SUBSCRIPTION_PLANS.map(plan => (
            <SubscriptionPlanCard
              key={plan.id}
              plan={plan}
              isCurrent={currentUser?.tier === plan.id}
              onSelect={() => onUpgradeTier(plan.id)}
            />
          ))}
        </div>

        {currentUser && (
            <div className="mt-20 max-w-2xl mx-auto text-center">
                <h3 className="text-2xl font-bold text-white">Need More Power?</h3>
                <div className={`mt-6 bg-gray-800 rounded-lg p-8 border-2 ${isAdvancedAI ? 'border-gray-700' : 'border-green-500'}`}>
                    <h4 className="text-xl font-semibold text-white">Purchase Extra Credits</h4>
                    <p className="mt-2 text-gray-400">Add 100 credits to your account. Credits roll over and can be stored up to a maximum of 600.</p>
                    <div className="mt-6">
                        <span className="text-4xl font-bold text-white">
                            {isTraditionalTrader ? '$14.75' : '$29.50'}
                        </span>
                        {isTraditionalTrader && (
                             <div className="mt-1">
                                <span className="line-through text-gray-500">$29.50</span>
                                <span className="ml-2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">50% OFF</span>
                             </div>
                        )}
                    </div>
                     {!isTraditionalTrader && !isAdvancedAI && (
                        <p className="mt-2 text-sm text-green-300">
                            <span className="font-bold">Traditional Trader</span> members get <span className="font-bold">50% OFF!</span>
                        </p>
                    )}
                    <button
                        className="mt-8 block w-full py-3 px-6 border border-transparent rounded-md text-center font-medium bg-green-600 text-white hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        disabled={isAdvancedAI}
                        title={isAdvancedAI ? "Not applicable for your unlimited plan" : ""}
                    >
                        Purchase 100 Credits
                    </button>
                    {isAdvancedAI && (
                         <p className="mt-2 text-xs text-gray-500">
                            The BYOA plan provides unlimited AI usage, so extra credits are not needed.
                        </p>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionView;
