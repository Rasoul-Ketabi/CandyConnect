import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { UpdateIcon } from './icons';

const AutoUpdateToggle: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [autoUpdate, setAutoUpdate] = useState(() => {
    const saved = localStorage.getItem('candyconnect-autoupdate');
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('candyconnect-autoupdate', JSON.stringify(autoUpdate));
  }, [autoUpdate]);

  const toggleAutoUpdate = () => {
    setAutoUpdate(!autoUpdate);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse space-x-3' : 'space-x-3'}`}>
          <div className="text-slate-600 dark:text-slate-400">
            <UpdateIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-200">{t('autoUpdate')}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('autoUpdateDesc')}
            </p>
          </div>
        </div>
        
        <button
          onClick={toggleAutoUpdate}
          className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${
            autoUpdate
              ? 'bg-orange-500'
              : 'bg-slate-200 dark:bg-slate-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              autoUpdate ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  );
};

export default AutoUpdateToggle;
