import React from 'react';

interface ButtonProps {
  onClick: () => void;
  text: string;
  loading?: boolean;
  fullWidth?: boolean;
  small?: boolean;
  className?: string;
}

const Button: React.FC<ButtonProps> = ({ 
  onClick, 
  text, 
  loading = false, 
  fullWidth = false, 
  small = false,
  className = ''
}) => {
  const baseClassName = `
    inline-flex items-center justify-center
    px-4 py-2 min-w-[120px]
    font-medium text-sm
    rounded bg-primary text-white
    transition-all duration-200
    hover:bg-secondary hover:scale-[1.02]
    active:scale-100 active:bg-primary/80
    disabled:opacity-50 disabled:cursor-not-allowed
    ${fullWidth ? 'w-full' : ''}
    ${small ? 'px-3 py-1.5 min-w-[80px] text-xs' : ''}
    ${className}
  `;

  return (
    <button
      onClick={() => !loading && onClick()}
      className={baseClassName}
      disabled={loading}
    >
      {loading && (
        <svg 
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {text}
    </button>
  );
};

export default Button; 