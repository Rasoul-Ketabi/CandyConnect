import React from 'react';
import { ChevronRightIcon, LogsIcon, NetworkIcon } from './icons';
import { useLanguage } from '../contexts/LanguageContext';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  badge?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, onClick, badge }) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center p-3 text-slate-700 dark:text-slate-300 hover:bg-orange-200/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors group"
  >
    <div className="text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
        {icon}
    </div>
    <span className="ml-4 text-xl font-bold flex-1 text-left">{label}</span>
    {badge && (
      <span className="mr-2 px-2 py-0.5 text-xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full">
        {badge}
      </span>
    )}
    <div className="ml-auto text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
        <ChevronRightIcon className="w-6 h-6" />
    </div>
  </button>
);

interface SettingsMenuProps {
  onProfilesClick?: () => void;
  onAccountClick?: () => void;
  onProxyClick?: () => void;
  onLogsClick?: () => void;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ onProfilesClick, onAccountClick, onProxyClick, onLogsClick }) => {
  const { t, isRTL } = useLanguage();

  return (
    <div className={`space-y-2 ${isRTL ? 'text-right' : 'text-left'}`}>
      <MenuItem
        icon={
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
        }
        label={t('profiles')}
        onClick={onProfilesClick}
      />
      <MenuItem
        icon={
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        }
        label={t('accountInfo')}
        onClick={onAccountClick}
      />
      <MenuItem
        icon={<NetworkIcon className="w-7 h-7" />}
        label={t('proxy')}
        onClick={onProxyClick}
      />
      <MenuItem
        icon={<LogsIcon className="w-7 h-7" />}
        label={t('logs')}
        onClick={onLogsClick}
      />
    </div>
  );
};

export default SettingsMenu;
