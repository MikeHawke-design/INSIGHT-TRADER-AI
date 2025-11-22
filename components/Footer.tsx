import React from 'react';

interface FooterProps {
  onOpenLegal: (type: 'privacy' | 'terms') => void;
}

const Footer: React.FC<FooterProps> = ({ onOpenLegal }) => {
  return (
    <footer className="w-full text-center p-6 mt-auto border-t border-white/5 flex-shrink-0 bg-black/20 backdrop-blur-sm">
      <div className="flex justify-center items-center space-x-4 text-[10px] uppercase tracking-widest text-gray-600 font-mono">
        <span>© {new Date().getFullYear()} INSIGHT TRADER</span>
        <span className="text-gray-800">|</span>
        <button onClick={() => onOpenLegal('terms')} className="hover:text-yellow-500 transition-colors">
          Terms
        </button>
        <span className="text-gray-800">|</span>
        <button onClick={() => onOpenLegal('privacy')} className="hover:text-yellow-500 transition-colors">
          Privacy
        </button>
      </div>
    </footer>
  );
};

export default Footer;