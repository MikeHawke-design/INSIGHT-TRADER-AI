
import React from 'react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PrivacyPolicyModal: React.FC<LegalModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[110] p-4 backdrop-blur-sm animate-fadeIn"
      aria-modal="true"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 p-8 rounded-xl shadow-2xl w-full max-w-3xl border border-white/10 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center pb-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-2xl font-display font-bold text-yellow-400">Privacy Protocol</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:text-white transition-colors">&times;</button>
        </div>
        <div className="prose prose-sm prose-invert max-w-none text-gray-400 mt-6 overflow-y-auto pr-2 custom-scrollbar">
            <p><em>Last Updated: {new Date().toLocaleDateString()}</em></p>
            <p>Your data sovereignty is paramount. This protocol outlines how INSIGHT TRADER handles information.</p>
            
            <h4>1. Local-First Architecture</h4>
            <p>INSIGHT TRADER operates on a privacy-first architecture. All personal data, trade journals, and settings are stored <strong>locally on your device</strong> within the browser's secure storage. We do not operate a central database for user journals.</p>
            <ul>
                <li><strong>Stored Locally:</strong> Journals, Settings, Strategies, Chat Logs.</li>
                <li><strong>Ephemeral Transmission:</strong> When analyzing, necessary data (images, text prompts) is transmitted securely to the AI provider (Google Gemini) for processing via the platform's secure API connection. This data is not retained by us.</li>
            </ul>

            <h4>2. Information Usage</h4>
            <ul>
                <li><strong>Functionality:</strong> Local data is used solely to render your dashboard and history.</li>
                <li><strong>AI Analysis:</strong> Data sent to the AI API is subject to <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">Google's Data Policy</a>.</li>
            </ul>
            
            <h4>3. Third Parties</h4>
            <p>We do not sell or share your identifiable data.</p>

            <h4>4. Security</h4>
            <p>Security relies on your device integrity. Ensure your environment is secure.</p>

            <h4>5. Data Control</h4>
            <p>You possess full administrative control:</p>
            <ul>
                <li><strong>Export:</strong> Create full backups via the System panel.</li>
                <li><strong>Wipe:</strong> Delete specific data or reset the application entirely via browser settings.</li>
            </ul>
        </div>
        <div className="flex-shrink-0 pt-6 mt-auto border-t border-gray-800">
            <button onClick={onClose} className="w-full font-bold py-3 px-6 rounded-lg transition-all bg-yellow-500 text-black hover:bg-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                Acknowledge
            </button>
        </div>
      </div>
       <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.2s ease-out; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      `}</style>
    </div>
  );
};

export default PrivacyPolicyModal;
