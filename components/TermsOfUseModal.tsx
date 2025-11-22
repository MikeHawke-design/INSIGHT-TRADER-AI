
import React from 'react';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TermsOfUseModal: React.FC<LegalModalProps> = ({ isOpen, onClose }) => {
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
          <h2 className="text-2xl font-display font-bold text-yellow-400">Terms of Access</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-500 hover:text-white transition-colors">&times;</button>
        </div>
        <div className="prose prose-sm prose-invert max-w-none text-gray-400 mt-6 overflow-y-auto pr-2 custom-scrollbar">
            <p><em>Last Updated: {new Date().toLocaleDateString()}</em></p>
            <p>By initializing INSIGHT TRADER ("the System"), you agree to these Terms.</p>

            <h4>1. Acceptance</h4>
            <p>Accessing the System constitutes full acceptance of these Terms. This platform is provided as a free, educational tool.</p>
            
            <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg my-6">
                <h4 className="!text-red-400 !mt-0 font-display uppercase tracking-wider">2. Financial Disclaimer (NFA)</h4>
                <p className="!text-red-200/80"><strong>The System does not provide financial advice.</strong> All outputs are simulated, AI-generated scenarios for educational and research purposes only. Nothing herein constitutes a recommendation to buy or sell.</p>
                <p className="!text-red-200/80">Trading involves significant risk. You assume full responsibility for all decisions. <strong>Use this tool for paper trading and analysis only.</strong></p>
            </div>

            <h4>3. Service Description</h4>
            <p>INSIGHT TRADER is an AI-enhanced analytical interface. It interprets market data based on user-defined logic parameters using generative AI models.</p>

            <h4>4. User Obligations</h4>
            <ul>
                <li>Use for lawful simulation only.</li>
                <li>Acknowledge the hypothetical nature of AI analysis.</li>
            </ul>

            <h4>5. IP Rights</h4>
            <p>The System architecture remains the property of the creators. User-generated strategies and journals remain the property of the user.</p>

            <h4>6. Liability</h4>
            <p>The creators are not liable for any financial losses incurred. The System is provided "AS IS" without warranty.</p>
        </div>
         <div className="flex-shrink-0 pt-6 mt-auto border-t border-gray-800">
            <button onClick={onClose} className="w-full font-bold py-3 px-6 rounded-lg transition-all bg-yellow-500 text-black hover:bg-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)]">
                Accept Protocols
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

export default TermsOfUseModal;
