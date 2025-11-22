
import React from 'react';
import { User, UserSettings, ApiConfiguration } from '../types';
import Avatar from './Avatar';

interface ProfileViewProps {
    currentUser: User;
    apiConfig: ApiConfiguration;
    onOpenAvatarSelection: () => void;
    userSettings: UserSettings;
}

const AvatarIcon = (props:{className?:string}) => <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.25 1.25 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18.25a9.957 9.957 0 0 0 6.125-2.345a1.25 1.25 0 0 0 .41-1.412A9.99 9.99 0 0 0 10 12.5a9.99 9.99 0 0 0-6.535 1.993Z" /></svg>;

const ProfileView: React.FC<ProfileViewProps> = ({ currentUser, onOpenAvatarSelection, userSettings }) => {
    const hasAvatar = !!currentUser?.avatar;

    return (
        <div className="p-4 md:p-6 mx-auto space-y-8">
            <div className="text-center">
                <h2 className="font-bold text-white" style={{ fontSize: `${userSettings.headingFontSize + 12}px` }}>Your Profile</h2>
                <p className="text-gray-400 mt-1" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Manage your identity.</p>
            </div>

            {/* Avatar Setup */}
            {!hasAvatar && (
                 <div className="bg-gray-800 rounded-lg p-6 border border-purple-700 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="font-bold text-purple-400" style={{ fontSize: `${userSettings.headingFontSize}px` }}>Set Up Your Profile</h3>
                        <p className="mt-1 text-gray-400" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Let's generate your unique AI avatar.</p>
                    </div>
                     <button onClick={onOpenAvatarSelection} className="w-full md:w-auto font-bold py-2 px-6 rounded-lg bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center gap-2">
                        <AvatarIcon className="w-5 h-5"/> Generate Avatar
                    </button>
                 </div>
            )}
            
            {/* User Info Card */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 flex flex-col md:flex-row items-center gap-6">
                <Avatar avatar={currentUser.avatar} size="lg" />
                <div className="flex-grow text-center md:text-left">
                    <h2 className="font-bold text-white" style={{ fontSize: `${userSettings.headingFontSize + 8}px` }}>{currentUser.anonymousUsername}</h2>
                    <p className="font-semibold text-purple-400" style={{ fontSize: `${userSettings.headingFontSize}px` }}>Pro Access</p>
                </div>
            </div>
            
            {/* Account Settings Placeholder */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <h3 className="font-bold text-yellow-400 mb-4" style={{ fontSize: `${userSettings.headingFontSize}px` }}>Account Settings</h3>
                <div className="space-y-4 opacity-50 cursor-not-allowed">
                    <div>
                        <label className="block font-medium text-gray-400" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Username</label>
                        <input type="text" value={currentUser.anonymousUsername} disabled className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white"/>
                    </div>
                    <div>
                        <label className="block font-medium text-gray-400" style={{ fontSize: `${userSettings.uiFontSize}px` }}>Email Address</label>
                        <input type="email" placeholder="Not required" disabled className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white"/>
                    </div>
                </div>
                 <p className="text-xs text-gray-500 mt-4">Account management is simplified for privacy.</p>
            </div>
        </div>
    );
};

export default ProfileView;
