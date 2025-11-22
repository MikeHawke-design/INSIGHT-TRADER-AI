
import React from 'react';

interface PermissionModalProps {
  isOpen: boolean;
  onAllow: () => void;
  onDeny: () => void;
  title: string;
  message: React.ReactNode; // Allow JSX for message
}

const PermissionModal: React.FC<PermissionModalProps> = ({ isOpen, onAllow, onDeny, title, message }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[100] p-4" aria-modal="true" role="dialog">
      <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full border border-gray-700">
        <h2 className="text-xl font-bold text-yellow-400 mb-4">{title}</h2>
        <div className="text-gray-300 mb-6 space-y-2 text-sm">
          {message}
        </div>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onDeny}
            className="px-4 py-2 rounded-md text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 transition-colors"
          >
            Deny
          </button>
          <button
            onClick={onAllow}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-400 transition-colors"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionModal;