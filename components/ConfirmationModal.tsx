import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmButtonClass?: string;
  isProcessing?: boolean;
  children?: React.ReactNode;
}

const LoadingSpinner = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
    isOpen, 
    onConfirm, 
    onCancel, 
    title, 
    message,
    confirmText = 'Confirm & Remove',
    confirmButtonClass = 'bg-red-600 hover:bg-red-500 focus:ring-red-500 text-white',
    isProcessing = false,
    children,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div 
        className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-[100] p-4 animate-fadeIn" 
        aria-modal="true" 
        role="dialog"
    >
      <div className={`bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full border ${confirmButtonClass.includes('red') ? 'border-red-500/50' : 'border-yellow-500/50'}`}>
        <h2 className={`text-xl font-bold mb-4 ${confirmButtonClass.includes('red') ? 'text-red-300' : 'text-yellow-300'}`}>{title}</h2>
        <p className="text-gray-300 mb-6 text-sm">{message}</p>
        {children}
        <div className={`flex justify-end space-x-3 ${children ? 'mt-6' : ''}`}>
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-wait ${confirmButtonClass}`}
          >
            {isProcessing ? <><LoadingSpinner /> Processing...</> : confirmText}
          </button>
        </div>
      </div>
       <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ConfirmationModal;