import React, { useState } from 'react';
import { useLanguage, Language } from '../contexts/LanguageContext';
import { ChevronDownIcon, GlobeIcon } from './icons';

const LanguageSelector: React.FC = () => {
  const { language, setLanguage, t, isRTL } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'en' as Language, name: t('english'), flag: '🇺🇸' },
    { code: 'fa' as Language, name: t('persian'), flag: '🇮🇷' },
    { code: 'ru' as Language, name: t('russian'), flag: '🇷🇺' },
    { code: 'zh' as Language, name: t('chinese'), flag: '🇨🇳' }
  ];

  const currentLanguage = languages.find(lang => lang.code === language);

  const handleLanguageSelect = (langCode: Language) => {
    setLanguage(langCode);
    setIsOpen(false);
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
              <GlobeIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-200">{t('language')}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="text-lg">{currentLanguage?.flag}</span>
                {currentLanguage?.name}
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
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageSelect(lang.code)}
              className={`w-full p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${
                language === lang.code ? 'bg-orange-50 dark:bg-orange-900/20' : ''
              } ${isRTL ? 'text-right' : 'text-left'}`}
            >
              <div className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse space-x-3' : 'space-x-3'}`}>
                <span className="text-lg">{lang.flag}</span>
                <span className={`font-medium ${
                  language === lang.code 
                    ? 'text-orange-600 dark:text-orange-400' 
                    : 'text-slate-800 dark:text-slate-200'
                }`}>
                  {lang.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
