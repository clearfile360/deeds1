import React from 'react';

interface UnikornLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export default function UnikornLogo({ className = '', size = 'md', showText = true }: UnikornLogoProps) {
  const sizeMap = {
    sm: 'h-7 w-7',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
    xl: 'h-20 w-20'
  };

  const dim = sizeMap[size] || sizeMap.md;

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <img 
        src="/logo.svg" 
        alt="Unikorn360 AI Solutions Logo" 
        className={`${dim} shrink-0 object-contain drop-shadow-md`} 
      />
      {showText && (
        <div className="flex flex-col text-left">
          <span className="text-sm font-black tracking-wider text-white leading-tight uppercase font-sans">
            DeedOS<span className="text-amber-400">360</span>
          </span>
          <span className="text-[9px] font-extrabold tracking-widest text-amber-300/90 uppercase font-sans">
            by Unikorn360 AI Solutions
          </span>
        </div>
      )}
    </div>
  );
}
