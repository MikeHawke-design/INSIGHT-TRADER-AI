import React from 'react';

interface LogoProps {
  className?: string;
  isLoading?: boolean;
}

const Logo: React.FC<LogoProps> = ({ className = "w-16 h-16", isLoading = false }) => ( 
  <svg 
    className={`${className} text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]`} 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Outer Hexagon Ring */}
    <path 
      d="M50 5 L93.3 30 V80 L50 105 L6.7 80 V30 L50 5Z" 
      stroke="currentColor" 
      strokeWidth="2"
      strokeOpacity="0.3"
      fill="none"
      transform="scale(0.9) translate(5.5, -2.5)"
    />

    {/* Inner Tech Eye Shape */}
    <path 
      d="M10 50 C10 50 30 20 50 20 C70 20 90 50 90 50 C90 50 70 80 50 80 C30 80 10 50 10 50 Z" 
      stroke="currentColor" 
      strokeWidth="4" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className={isLoading ? "animate-pulse" : ""}
    />
    
    {isLoading ? (
      <g>
        {/* Loading Spinner inside Eye */}
        <circle 
          cx="50" 
          cy="50" 
          r="15" 
          stroke="currentColor" 
          strokeWidth="3" 
          strokeDasharray="40 20" 
          strokeLinecap="round"
          fill="none"
        >
          <animateTransform
            attributeName="transform"
            attributeType="XML"
            type="rotate"
            from="0 50 50"
            to="360 50 50"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    ) : (
      <>
        {/* Iris / Chart Elements */}
        <circle cx="50" cy="50" r="8" fill="currentColor" />
        
        {/* Data Lines cutting through */}
        <path d="M85 50 H95" stroke="currentColor" strokeWidth="2" strokeOpacity="0.5"/>
        <path d="M5 50 H15" stroke="currentColor" strokeWidth="2" strokeOpacity="0.5"/>
        <path d="M50 20 V10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.5"/>
        <path d="M50 80 V90" stroke="currentColor" strokeWidth="2" strokeOpacity="0.5"/>
        
        {/* Candlestick abstractions */}
        <rect x="46" y="35" width="8" height="30" rx="1" stroke="currentColor" strokeWidth="1" fill="transparent" />
      </>
    )}
  </svg>
);

export default Logo;