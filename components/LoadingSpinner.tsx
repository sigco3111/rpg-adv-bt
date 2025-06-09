import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex justify-center items-center">
      <div 
        className="animate-spin rounded-none h-6 w-6 border-4 border-[var(--pixel-bg-dark)] border-t-[var(--pixel-highlight)] border-l-[var(--pixel-highlight)]"
        style={{ imageRendering: 'pixelated' }} // Ensure crisp edges for the spinner
      ></div>
    </div>
  );
};