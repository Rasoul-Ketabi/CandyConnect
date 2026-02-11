import React from 'react';

interface ConnectButtonProps {
  isConnected: boolean;
  isConnecting: boolean;
  onClick: () => void;
}

const ConnectButton: React.FC<ConnectButtonProps> = ({ isConnected, isConnecting, onClick }) => {
  const baseClasses = "w-full rounded-2xl text-white text-3xl font-extrabold py-4 border-b-4 transition-all duration-200 ease-in-out transform focus:outline-none shadow-[0_10px_20px_rgba(0,0,0,0.1),inset_0_2px_4px_rgba(255,255,255,0.3)] dark:shadow-[0_10px_20px_rgba(0,0,0,0.3),inset_0_2px_4px_rgba(255,255,255,0.1)]";
  const activeClasses = "active:translate-y-1 active:border-b-2";

  const getButtonState = () => {
    if (isConnecting) {
      return {
        text: 'CONNECTING...',
        classes: 'bg-yellow-500 border-yellow-700 cursor-not-allowed',
        disabled: true,
      };
    }
    if (isConnected) {
      return {
        text: 'DISCONNECT',
        classes: `bg-green-500 border-green-700 hover:bg-green-600 shadow-green-500/40 ${activeClasses}`,
        disabled: false,
      };
    }
    return {
      text: 'CONNECT',
      classes: `bg-red-500 border-red-700 hover:bg-red-600 shadow-red-500/40 ${activeClasses}`,
      disabled: false,
    };
  };

  const { text, classes, disabled } = getButtonState();


  return (
    <div className="flex flex-col items-center space-y-3">
      {/* Candy SVG indicator */}
      <div className={`relative transition-all duration-500 ${isConnecting ? 'animate-pulse' : ''}`}>
        {/* Glow ring behind candy when connected */}
        {isConnected && !isConnecting && (
          <div className="absolute inset-0 -z-10 rounded-full bg-green-400/20 dark:bg-green-500/10 blur-xl scale-125"></div>
        )}
      </div>

      {/* Button */}
      <button
        onClick={onClick}
        disabled={disabled}
        className={`${baseClasses} ${classes}`}
      >
        {text}
      </button>
    </div>
  );
};

export default ConnectButton;
