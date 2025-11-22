
import React from 'react';
import { ActiveView, User, UserSettings } from '../types';
import Logo from './Logo';
import AuthDisplay from './AuthDisplay';

interface HeaderProps {
  activeView: ActiveView;
  currentUser: User | null;
  onNavClick: (view: ActiveView) => void;
  onLogout: () => void;
  isPageScrolled: boolean;
  isAnalyzing: boolean;
  userSettings: UserSettings;
}

const NavButton: React.FC<{
    onClick: () => void;
    isActive: boolean;
    children: React.ReactNode;
    fontSize: number;
}> = ({ onClick, isActive, children, fontSize }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 font-display font-bold tracking-wide uppercase transition-all duration-200 rounded border ${
            isActive
                ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]'
                : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
        }`}
        style={{ fontSize: `${Math.max(12, fontSize - 2)}px`}} // Slightly smaller font for tech look
    >
        {children}
    </button>
);

const Header: React.FC<HeaderProps> = ({ 
    activeView, 
    currentUser, 
    onNavClick, 
    onLogout, 
    isPageScrolled,
    isAnalyzing,
    userSettings
}) => {
    
    // Glassmorphic header base classes
    const headerBaseClasses = "py-3 px-6 flex items-center md:justify-between justify-center gap-6 border-b fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out backdrop-blur-xl";
    const scrolledClasses = "bg-[#050505]/80 border-white/10 shadow-lg";
    const topClasses = "bg-transparent border-transparent";

    return (
        <header className={`${headerBaseClasses} ${isPageScrolled ? scrolledClasses : topClasses}`}>
            {/* Left Section - Logo */}
            <div className="flex justify-start items-center">
                <button
                    onClick={() => onNavClick('analyze')}
                    aria-label="Go to homepage"
                    className="flex items-center space-x-3 bg-transparent border-none p-0 cursor-pointer text-left group"
                >
                    <div className="relative">
                        <div className="absolute inset-0 bg-yellow-500/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <Logo className="w-14 h-14 relative z-10" isLoading={isAnalyzing} />
                    </div>
                    <div className="flex flex-col">
                        <h1 
                            className="font-display font-bold text-white tracking-widest leading-none"
                            style={{ fontSize: `${userSettings.headingFontSize + 4}px` }}
                        >
                            INSIGHT
                        </h1>
                        <span className="font-display font-medium text-yellow-500 tracking-[0.3em] text-[10px] leading-none mt-0.5">
                            TRADER
                        </span>
                    </div>
                </button>
            </div>

            {/* Center Section - Navigation */}
            {currentUser && (
                <nav className="hidden md:flex flex-initial items-center justify-center space-x-1 bg-black/30 p-1 rounded-lg border border-white/10 backdrop-blur-sm">
                    <NavButton onClick={() => onNavClick('analyze')} isActive={activeView.startsWith('analyze')} fontSize={userSettings.uiFontSize}>Terminal</NavButton>
                    <NavButton onClick={() => onNavClick('academy')} isActive={activeView === 'academy'} fontSize={userSettings.uiFontSize}>Academy</NavButton>
                    <NavButton onClick={() => onNavClick('journal')} isActive={activeView === 'journal'} fontSize={userSettings.uiFontSize}>Journal</NavButton>
                    <NavButton onClick={() => onNavClick('settings')} isActive={activeView === 'settings'} fontSize={userSettings.uiFontSize}>
                        System
                    </NavButton>
                </nav>
            )}

            {/* Right Section - User Info & Auth */}
            <div className="flex justify-end items-center">
                {currentUser && (
                    <AuthDisplay 
                        currentUser={currentUser}
                        onLogout={onLogout}
                        onNavClick={onNavClick}
                    />
                )}
            </div>
        </header>
    );
};

export default Header;
