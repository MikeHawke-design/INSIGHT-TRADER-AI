import React, { useState } from 'react';
import Logo from './Logo';
import { BETA_ACCESS_KEYS } from '../constants';
import { validateAccessKey } from '../authUtils';

interface AccessGateProps {
  onAuthSuccess: () => void;
  onOpenLegal: (type: 'privacy' | 'terms') => void;
}

const EyeIcon: React.FC<{ className?: string }> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const EyeSlashIcon: React.FC<{ className?: string }> = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243l-4.243-4.243" />
  </svg>
);


const AccessGate: React.FC<AccessGateProps> = ({ onAuthSuccess, onOpenLegal }) => {
  const [email, setEmail] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setError("You must accept the Terms & Protocols.");
      return;
    }
    setError('');
    setIsProcessing(true);

    setTimeout(() => {
      // 1. Check Legacy Master Keys (BETA_ACCESS_KEYS)
      // These work without an email, or with any email.
      if (BETA_ACCESS_KEYS.includes(inputKey)) {
        onAuthSuccess();
        return;
      }

      // 2. Check Email-Based Access Keys
      if (email && validateAccessKey(email, inputKey)) {
        // Store email for session context if needed
        localStorage.setItem('currentUserEmail', email);
        onAuthSuccess();
        return;
      }

      // 3. Failed
      setError('INVALID ACCESS KEY. ACCESS DENIED.');
      setIsProcessing(false);
    }, 800); // Slightly longer delay for dramatic effect
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background grid effect */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgNDBoNDBWMEgwIiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgNDBoMXYtMWgtMVptMjAgMGgxdjEwMGgtMVptMCAwaDF2LTFoLTF6bTIwIDBoMXYtMWgtMSIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9Ii41IiBzdHJva2Utb3BhY2l0eT0iLjIiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjYSkiLz48L3N2Zz4=')] opacity-20 pointer-events-none"></div>

      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80"></div>

      <style>{`
        @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        .scanline::after {
            content: " ";
            display: block;
            position: absolute;
            top: 0; left: 0; bottom: 0; right: 0;
            background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
            z-index: 2;
            background-size: 100% 2px, 3px 100%;
            pointer-events: none;
        }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
      `}</style>

      <div className="max-w-md w-full text-center animate-fadeIn relative z-10 glass-panel p-8 rounded-xl shadow-2xl border border-yellow-500/10">
        <div className="mx-auto mb-6 relative">
          <div className="absolute inset-0 bg-yellow-500/30 blur-2xl rounded-full"></div>
          <Logo className="w-24 h-24 mx-auto relative z-10" />
        </div>

        <h1 className="text-4xl font-display font-bold text-white tracking-wider mb-1">INSIGHT TRADER</h1>
        <p className="text-yellow-500/60 text-xs tracking-[0.4em] font-mono uppercase mb-10">Terminal Access v2.0</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg blur opacity-20 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="relative block w-full bg-[#050505] border border-gray-700 text-white rounded-lg py-4 px-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-center font-mono tracking-wide text-base placeholder-gray-700 transition-all"
              placeholder="EMAIL ADDRESS (OPTIONAL)"
              disabled={isProcessing}
            />
          </div>

          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-600 to-blue-600 rounded-lg blur opacity-20 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex items-center">
              <input
                id="master-key"
                name="master-key"
                type={isKeyVisible ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="block w-full bg-[#050505] border border-gray-700 text-white rounded-lg py-4 px-4 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 text-center font-mono tracking-widest text-lg placeholder-gray-700 transition-all"
                placeholder="ENTER ACCESS KEY"
                disabled={isProcessing}
              />
              <button
                type="button"
                onClick={() => setIsKeyVisible(prev => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-600 hover:text-yellow-500 transition-colors"
              >
                {isKeyVisible ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-3 text-left p-2 bg-black/20 rounded border border-white/5">
            <input
              id="terms-agreement"
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => { setAgreedToTerms(e.target.checked); setError(''); }}
              className="h-4 w-4 rounded bg-gray-800 border-gray-600 text-yellow-500 focus:ring-yellow-500/50 cursor-pointer"
            />
            <label htmlFor="terms-agreement" className="text-xs text-gray-400 cursor-pointer select-none">
              Accept <button type="button" onClick={() => onOpenLegal('terms')} className="text-gray-200 hover:text-yellow-400 underline decoration-gray-600 underline-offset-2">Protocols</button> & <button type="button" onClick={() => onOpenLegal('privacy')} className="text-gray-200 hover:text-yellow-400 underline decoration-gray-600 underline-offset-2">Privacy</button>
            </label>
          </div>

          {error && <p className="text-red-500 font-mono text-xs animate-pulse border border-red-900/50 bg-red-900/10 p-2 rounded">{error}</p>}

          <button
            type="submit"
            disabled={isProcessing || !agreedToTerms}
            className="w-full font-display font-bold tracking-widest py-4 px-8 rounded-lg transition-all text-base disabled:cursor-not-allowed flex items-center justify-center mx-auto
            bg-white text-black hover:bg-yellow-400 hover:text-black disabled:bg-gray-800 disabled:text-gray-600 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(234,179,8,0.4)]"
          >
            {isProcessing ? <span className="animate-pulse">AUTHENTICATING...</span> : 'INITIALIZE'}
          </button>
        </form>

        <div className="mt-10 text-[10px] text-gray-600 text-center border-t border-gray-800 pt-4 font-mono">
          <p>CAUTION: EDUCATIONAL SIMULATION ENVIRONMENT.</p>
          <p>NOT FINANCIAL ADVICE. CAPITAL AT RISK.</p>
        </div>
      </div>
    </div>
  );
};

export default AccessGate;