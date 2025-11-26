import React, { useState } from 'react';
import Logo from './Logo';
import { BETA_ACCESS_KEYS } from '../constants';
import { validateAccessKey } from '../authUtils';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

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
  const [password, setPassword] = useState(''); // Acts as Password or Access Key
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isKeyVisible, setIsKeyVisible] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleGoogleLogin = async () => {
    if (!agreedToTerms) {
      setError("You must accept the Terms & Protocols.");
      return;
    }
    setError('');
    setIsProcessing(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      await signInWithPopup(auth, provider);
      // Auth state change will be picked up by AuthProvider -> App
      localStorage.setItem('chartOracle_isAdmin', 'false');
      onAuthSuccess();
    } catch (err: any) {
      console.error("Google Login Error:", err);
      setError(err.message || "Google Sign-In Failed.");
      setIsProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToTerms) {
      setError("You must accept the Terms & Protocols.");
      return;
    }
    setError('');
    setIsProcessing(true);

    // 1. Legacy/Beta Key Check (If no email is provided, or if email provided but we want to check key first? No, standard is email/pass)
    // If Email is empty, assume Access Key mode
    if (!email) {
      setTimeout(() => {
        if (BETA_ACCESS_KEYS.includes(password)) {
          localStorage.setItem('chartOracle_isAdmin', 'true');
          onAuthSuccess();
          return;
        }
        setError('INVALID ACCESS KEY. EMAIL REQUIRED FOR LOGIN.');
        setIsProcessing(false);
      }, 800);
      return;
    }

    // 2. Firebase Auth
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        // Try Firebase Login
        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch (loginErr: any) {
          // If Firebase login fails, check if the "password" was actually a valid access key for this email
          // This preserves the "Email + Access Key" flow if it exists in validateAccessKey
          if (validateAccessKey(email, password)) {
            localStorage.setItem('currentUserEmail', email);
            localStorage.setItem('chartOracle_isAdmin', 'false');
            onAuthSuccess();
            return;
          }
          throw loginErr; // Re-throw if not a valid access key either
        }
      }
      localStorage.setItem('chartOracle_isAdmin', 'false');
      onAuthSuccess();
    } catch (err: any) {
      console.error("Auth Error:", err);
      let msg = "Authentication Failed.";
      if (err.code === 'auth/invalid-credential') msg = "Invalid email or password.";
      if (err.code === 'auth/email-already-in-use') msg = "Email already in use.";
      if (err.code === 'auth/weak-password') msg = "Password should be at least 6 characters.";
      setError(msg);
      setIsProcessing(false);
    }
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
              placeholder={isSignUp ? "ENTER EMAIL" : "EMAIL (OPTIONAL FOR KEY)"}
              disabled={isProcessing}
            />
          </div>

          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-600 to-blue-600 rounded-lg blur opacity-20 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative flex items-center">
              <input
                id="password"
                name="password"
                type={isKeyVisible ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full bg-[#050505] border border-gray-700 text-white rounded-lg py-4 px-4 focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 text-center font-mono tracking-widest text-lg placeholder-gray-700 transition-all"
                placeholder={isSignUp ? "CREATE PASSWORD" : "PASSWORD / ACCESS KEY"}
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
            {isProcessing ? <span className="animate-pulse">PROCESSING...</span> : (isSignUp ? 'REGISTER' : 'INITIALIZE')}
          </button>

          <div className="flex flex-col gap-3 mt-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isProcessing || !agreedToTerms}
              className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>

            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-xs text-gray-400 hover:text-white underline decoration-gray-600 underline-offset-4"
            >
              {isSignUp ? "Already have an account? Sign In" : "Need an account? Sign Up"}
            </button>
          </div>

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