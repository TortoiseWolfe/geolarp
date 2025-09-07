'use client';

import React from 'react';

interface DiceFaceProps {
  value: number;
  isRolling?: boolean;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'classic' | 'fantasy' | 'neon';
}

export function DiceFace({ 
  value, 
  isRolling = false,
  size = 'md',
  theme = 'classic' 
}: DiceFaceProps) {
  const sizeClasses = {
    sm: 'w-12 h-12 text-lg',
    md: 'w-16 h-16 text-2xl',
    lg: 'w-20 h-20 text-3xl'
  };

  const themeClasses = {
    classic: 'bg-white text-black border-gray-300',
    fantasy: 'bg-amber-100 text-amber-900 border-amber-600',
    neon: 'bg-black text-cyan-400 border-cyan-500 shadow-neon'
  };

  const renderPips = () => {
    if (value === 7) {
      return <span className="text-yellow-500">★</span>;
    }

    const pipPositions: { [key: number]: string[] } = {
      1: ['col-start-2 row-start-2'],
      2: ['col-start-1 row-start-1', 'col-start-3 row-start-3'],
      3: ['col-start-1 row-start-1', 'col-start-2 row-start-2', 'col-start-3 row-start-3'],
      4: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
      5: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-2 row-start-2', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
      6: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-1 row-start-2', 'col-start-3 row-start-2', 'col-start-1 row-start-3', 'col-start-3 row-start-3']
    };

    const positions = pipPositions[value] || [];
    
    return (
      <div className="grid grid-cols-3 grid-rows-3 w-full h-full p-1">
        {positions.map((position, index) => (
          <div key={index} className={`${position} flex items-center justify-center`}>
            <div className="w-2 h-2 bg-current rounded-full"></div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      className={`
        ${sizeClasses[size]} 
        ${themeClasses[theme]}
        rounded-lg border-2 font-bold
        flex items-center justify-center
        transition-all duration-300
        ${isRolling ? 'animate-bounce opacity-50' : ''}
        ${value === 7 ? 'ring-2 ring-yellow-400' : ''}
        ${value === 1 && !isRolling ? 'ring-2 ring-red-400' : ''}
      `}
    >
      {isRolling ? (
        <span className="animate-pulse">?</span>
      ) : value <= 6 ? (
        renderPips()
      ) : (
        <span className="text-yellow-500">★</span>
      )}
    </div>
  );
}