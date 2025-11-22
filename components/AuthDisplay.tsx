
import React, { useState, useRef, useEffect } from 'react';
import { User, ActiveView } from '../types';
import Avatar from './Avatar';

interface AuthDisplayProps {
  currentUser: User;
  onLogout: () => void;
  onNavClick: (view: ActiveView) => void;
}

const AuthDisplay: React.FC<AuthDisplayProps> = ({ currentUser, onLogout, onNavClick }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);


    return (
        <div className="relative flex items-center gap-3" ref={menuRef}>
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
                <span className="text-xs font-bold text-yellow-400">PRO ACCESS</span>
            </div>
            <button onClick={() => setIsMenuOpen(prev => !prev)} className="flex items-center space-x-2 rounded-full transition-colors hover:bg-gray-700/50">
                <Avatar avatar={currentUser.avatar} size="sm" />
            </button>
            {isMenuOpen && (
                 <div className="absolute right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 animate-fadeIn top-full">
                     <div className="p-3 border-b border-gray-700">
                        <p className="text-sm font-semibold text-white truncate">{currentUser.anonymousUsername}</p>
                        <p className="text-xs text-gray-400">Full Access</p>
                     </div>
                     <nav className="py-1">
                        <MenuItem onClick={() => {onNavClick('profile'); setIsMenuOpen(false);}}>Profile</MenuItem>
                        <MenuItem onClick={() => {onNavClick('settings'); setIsMenuOpen(false);}}>Settings</MenuItem>
                     </nav>
                     <div className="p-1 border-t border-gray-700">
                         <MenuItem onClick={() => { onLogout(); setIsMenuOpen(false);}} isDanger={true}>Logout</MenuItem>
                     </div>
                </div>
            )}
             <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fadeIn { animation: fadeIn 0.15s ease-out forwards; }
            `}</style>
        </div>
    );
};

const MenuItem: React.FC<{onClick: () => void, children: React.ReactNode, isDanger?: boolean}> = ({ onClick, children, isDanger }) => (
    <button 
        onClick={onClick}
        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 rounded-md transition-colors ${
            isDanger ? 'text-red-400 hover:bg-red-500/10' : 'text-gray-300 hover:bg-gray-700/50'
        }`}
    >
        {children}
    </button>
);


export default AuthDisplay;
