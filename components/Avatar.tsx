
import React from 'react';

interface AvatarProps {
  avatar: string | undefined; // base64 string
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses: Record<string, string> = {
  sm: 'w-10 h-10 p-0.5',
  md: 'w-16 h-16 p-1',
  lg: 'w-24 h-24 p-1.5',
  xl: 'w-32 h-32 p-2',
};

const Avatar: React.FC<AvatarProps> = ({ avatar, size = 'md' }) => {
  const containerSize = sizeClasses[size] || sizeClasses['md'];

  return (
    <div className={`relative rounded-full flex items-center justify-center bg-gray-700 ${containerSize} border-2 border-yellow-500`}>
      {avatar ? (
        <img
          src={avatar}
          alt="User avatar"
          className="w-full h-full object-cover rounded-full"
        />
      ) : (
        <svg className="w-full h-full text-gray-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
    </div>
  );
};

export default Avatar;
