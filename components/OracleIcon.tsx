import React from 'react';

interface OracleIconProps {
  className?: string;
}

const OracleIcon: React.FC<OracleIconProps> = ({ className = "w-8 h-8" }) => (
    <svg 
    className={`${className} text-yellow-500`} 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path 
      d="M10 50 C10 50 30 20 50 20 C70 20 90 50 90 50 C90 50 70 80 50 80 C30 80 10 50 10 50 Z" 
      stroke="currentColor" 
      strokeWidth="5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
    <circle cx="50" cy="50" r="12" fill="currentColor" />
    <path d="M50 20 V10 M50 80 V90 M20 50 H10 M80 50 H90" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

export default OracleIcon;