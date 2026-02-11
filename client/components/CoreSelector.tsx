import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ChevronDownIcon } from './icons';

interface CoreOption {
  value: string;
  label: string;
}

interface CoreSelectorProps {
  coreType: 'v2ray' | 'warp' | 'wireguard';
  icon: React.ReactNode;
  title: string;
  options: CoreOption[];
  selectedValue?: string;
  onSelectionChange?: (value: string) => void;
  storageKey?: string;
}

const CoreSelector: React.FC<CoreSelectorProps> = ({ 
  coreType, 
  icon, 
  title, 
  options, 
  selectedValue,
  onSelectionChange,
  storageKey 
}) => {
  const { isRTL } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCore, setSelectedCore] = useState(() => {
    if (selectedValue !== undefined) {
      return selectedValue;
    }
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      return saved || options[0]?.value || '';
    }
    return options[0]?.value || '';
  });

  useEffect(() => {
    if (selectedValue !== undefined) {
      setSelectedCore(selectedValue);
    }
  }, [selectedValue]);

  useEffect(() => {
    if (storageKey && selectedValue === undefined) {
      localStorage.setItem(storageKey, selectedCore);
    }
  }, [selectedCore, storageKey, selectedValue]);

  const currentOption = options.find(option => option.value === selectedCore);

  const handleCoreSelect = (value: string) => {
    setSelectedCore(value);
    setIsOpen(false);
    if (onSelectionChange) {
      onSelectionChange(value);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
          isRTL ? 'text-right' : 'text-left'
        }`}
      >
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse space-x-3' : 'space-x-3'}`}>
            <div className="text-slate-600 dark:text-slate-400">
              {icon}
            </div>
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-200">{title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {currentOption?.label}
              </p>
            </div>
          </div>
          
          <ChevronDownIcon 
            className={`w-5 h-5 text-slate-400 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`} 
          />
        </div>
      </button>

      {isOpen && (
        <div className={`absolute ${isRTL ? 'right-0' : 'left-0'} mt-2 w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 z-10 overflow-hidden`}>
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleCoreSelect(option.value)}
              className={`w-full p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${
                selectedCore === option.value ? 'bg-orange-50 dark:bg-orange-900/20' : ''
              } ${isRTL ? 'text-right' : 'text-left'}`}
            >
              <span className={`font-medium ${
                selectedCore === option.value 
                  ? 'text-orange-600 dark:text-orange-400' 
                  : 'text-slate-800 dark:text-slate-200'
              }`}>
                {option.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoreSelector;
