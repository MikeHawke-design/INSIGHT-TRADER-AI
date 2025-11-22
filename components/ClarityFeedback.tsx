

import React from 'react';

interface ClarityFeedbackProps {
  message: string;
  onDismiss: () => void; // Changed from onTryAgain to onDismiss
  title?: string; // Title is now optional
}

const ClarityFeedback: React.FC<ClarityFeedbackProps> = ({ message, onDismiss, title }) => (
    <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 m-4 md:m-6 text-center">
        <div className="flex justify-center mb-4">
           <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
           </svg>
        </div>
        <h3 className="text-xl font-bold text-red-300">{title || "Important Message"}</h3>
        <p className="text-red-200 mt-2 mb-4" dangerouslySetInnerHTML={{ __html: message }}></p>
        <button
            onClick={onDismiss}
            className="bg-yellow-500 text-gray-900 font-bold py-2 px-6 rounded-lg hover:bg-yellow-400 transition-colors"
        >
            OK
        </button>
    </div>
);

export default ClarityFeedback;