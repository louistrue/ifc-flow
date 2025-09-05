import React from "react";

interface CoffeeSupportProps {
  className?: string;
  isHovered?: boolean;
}

const CoffeeSupport: React.FC<CoffeeSupportProps> = ({ className = "", isHovered = false }) => {
  return (
    <div className={`flex items-center text-xs text-[var(--muted-foreground)] text-center ${className}`}>
      <a
        href="https://buymeacoffee.com/louistrue"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy me a coffee"
        className="hover:text-[var(--primary)] transition-all duration-300 inline-flex items-center gap-1 relative"
      >
        {/* Always visible: coffee icon */}
        <img
          src="/icons8-buy-me-a-coffee-100.png"
          alt="Buy me a coffee"
          className="w-5 h-5 transition-all duration-300"
        />

        {/* Expandable text content */}
        <div className={`flex items-center gap-1 overflow-hidden transition-all duration-300 ${
          isHovered ? 'max-w-xs opacity-100' : 'max-w-0 opacity-0'
        }`}>
          <span className="text-xs whitespace-nowrap text-center">
            Made by Louis Trümpler • Support my coffee addiction
          </span>
          <img
            src="/icons8-buy-me-a-coffee-100.png"
            alt="Buy me a coffee"
            className="w-5 h-5"
          />
        </div>
      </a>
    </div>
  );
};

export default CoffeeSupport;
