
import React from 'react';
import { ActiveView, User } from '../types';

interface BottomNavigationBarProps {
  activeView: ActiveView;
  onNavClick: (view: ActiveView) => void;
  currentUser: User | null;
}

interface NavItemProps {
  view: ActiveView;
  currentView: ActiveView;
  onClick: (view: ActiveView) => void;
  icon: React.ReactElement<{ className?: string }>;
  label: string;
  disabled?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ view, currentView, onClick, icon, label, disabled }) => {
  const isActive = view === 'analyze' ? currentView.startsWith('analyze') : currentView === view;

  return (
    <button
      onClick={() => !disabled && onClick(view)}
      disabled={disabled}
      className={`flex flex-col items-center justify-center flex-1 py-2 px-1 text-xs transition-colors rounded-md group
            ${disabled ? 'text-gray-600 cursor-not-allowed'
          : isActive ? 'text-yellow-400 bg-yellow-500/10'
            : 'text-gray-400 hover:text-yellow-300 hover:bg-gray-700/50'
        }`}
      aria-current={isActive ? 'page' : undefined}
    >
      {React.cloneElement(icon, { className: `w-5 h-5 mb-0.5 ${disabled ? 'text-gray-600' : isActive ? 'text-yellow-400' : 'text-gray-400 group-hover:text-yellow-300'}` })}
      {label}
    </button>
  );
}


// Icons
const AcademyIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-5.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14v6.055M18.835 17.177l-6.834 3.886-6.835-3.886M12 22.055V14" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l-9-5 9-5 9 5-9 5z" /></svg>;
const AnalyzeIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h12M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-1.5m-6 0h1.5m-1.5 0h-1.5m0 0A2.25 2.25 0 0 1 6 14.25V3.75M17.25 21L21 17.25M17.25 17.25L21 21M15 10.5h.008v.008H15v-.008ZM15 6.75h.008v.008H15v-.008Zm-3.75 3.75h.008v.008H11.25v-.008Zm0-3.75h.008v.008H11.25v-.008Z" /></svg>;
const JournalIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>;
const ControlsIcon = (props: { className?: string }) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 6.75a5.25 5.25 0 0 1 5.25 5.25A5.25 5.25 0 0 1 12 17.25a5.25 5.25 0 0 1-5.25-5.25A5.25 5.25 0 0 1 12 6.75Zm-7.5-5.25a.75.75 0 0 0-1.5 0v2.25a.75.75 0 0 0 1.5 0V1.5ZM21 4.5a.75.75 0 0 0-1.5 0v2.25a.75.75 0 0 0 1.5 0V4.5ZM19.5 12a.75.75 0 0 0 0-1.5h-2.25a.75.75 0 0 0 0 1.5h2.25ZM6.75 12a.75.75 0 0 0 0-1.5H4.5a.75.75 0 0 0 0 1.5h2.25ZM12 19.5a.75.75 0 0 0-.75.75v2.25a.75.75 0 0 0 1.5 0v-2.25a.75.75 0 0 0-.75-.75ZM3 19.5a.75.75 0 0 0-.75.75v2.25a.75.75 0 0 0 1.5 0v-2.25a.75.75 0 0 0-.75-.75Z" clipRule="evenodd" /></svg>;

const BottomNavigationBar: React.FC<BottomNavigationBarProps> = ({ activeView, onNavClick, currentUser }) => {
  const isUserLoggedIn = !!currentUser;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[hsl(var(--color-bg-800)/0.8)] backdrop-blur-sm border-t border-gray-700/50 shadow-lg flex justify-around items-center h-16 z-40 px-1 gap-1">
      <NavItem view='analyze' currentView={activeView} onClick={onNavClick} icon={<AnalyzeIcon />} label='Terminal' disabled={!isUserLoggedIn} />
      <NavItem view='academy' currentView={activeView} onClick={onNavClick} icon={<AcademyIcon />} label='Academy' />
      <NavItem view='journal' currentView={activeView} onClick={onNavClick} icon={<JournalIcon />} label='Journal' disabled={!isUserLoggedIn} />
      <NavItem view='settings' currentView={activeView} onClick={onNavClick} icon={<ControlsIcon />} label='Settings' disabled={!isUserLoggedIn} />
    </nav>
  );
};

export default BottomNavigationBar;
