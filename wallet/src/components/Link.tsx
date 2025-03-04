import React from 'react';

interface LinkProps {
  onClick: () => void;
  text: string;
}

const Link: React.FC<LinkProps> = ({ onClick, text }) => {
  return (
    <div 
      onClick={onClick} 
      className="text-primary hover:text-secondary cursor-pointer text-center text-sm font-medium transition-colors"
    >
      <span className="border-b border-transparent hover:border-primary">
        {text}
      </span>
    </div>
  );
};

export default Link; 