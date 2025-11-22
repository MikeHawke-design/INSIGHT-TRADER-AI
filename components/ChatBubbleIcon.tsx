import React from 'react';

interface ChatBubbleIconProps {
  className?: string;
}

const ChatBubbleIcon: React.FC<ChatBubbleIconProps> = ({ className = "w-8 h-8" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
    aria-hidden="true"
  >
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
    <path d="M0 0h24v24H0z" fill="none"/>
</svg>
);

export default ChatBubbleIcon;