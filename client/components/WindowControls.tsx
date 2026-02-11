import React from 'react';

interface WindowControlsProps {
  onMinimize?: () => void;
  onClose?: () => void;
}

const WindowControls: React.FC<WindowControlsProps> = ({ onMinimize, onClose }) => {
  const handleMinimize = () => {
    if (onMinimize) {
      onMinimize();
    }
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().minimize();
    }).catch(() => {
      console.log("Mock: Window Minimize");
    });
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().close();
    }).catch(() => {
      console.log("Mock: Window Close");
    });
  };



  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleClose}
        className="w-4 h-4 rounded-full bg-red-400 hover:bg-red-500 transition-colors flex items-center justify-center text-white text-xs font-bold"
        title="Close"
      >
        ×
      </button>
      <button
        onClick={handleMinimize}
        className="w-4 h-4 rounded-full bg-yellow-400 hover:bg-yellow-500 transition-colors flex items-center justify-center text-white text-xs font-bold"
        title="Minimize"
      >
        −
      </button>
      <span className="w-4 h-4 rounded-full bg-green-400"></span>
    </div>
  );
};

export default WindowControls;
