import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { CheckIcon, XMarkIcon, SignalIcon, SpinnerIcon } from './icons';

interface Profile {
  id: string;
  name: string;
  url: string;
  protocol: string;
  isSelected: boolean;
  createdAt: Date;
  ping?: number;
  pingSuccess?: boolean;
  isPinging?: boolean;
}

interface ProfileSelectorProps {
  profiles: Profile[];
  onClose: () => void;
  onSelectProfile: (profileId: string) => void;
  onPingProfiles?: () => void;
}

const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  profiles,
  onClose,
  onSelectProfile,
  onPingProfiles
}) => {
  const { t, isRTL } = useLanguage();

  // Trigger ping when component mounts (only once)
  React.useEffect(() => {
    if (onPingProfiles) {
      onPingProfiles();
    }
  }, []); // Empty dependency array to run only once

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md mx-4 shadow-2xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">{t('selectProfile')}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {/* Profiles List */}
          <div className="p-4 space-y-3">
            {profiles.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500 dark:text-slate-400">{t('noProfiles')}</p>
              </div>
            ) : (
              profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => onSelectProfile(profile.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                    profile.isSelected
                      ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700'
                      : 'bg-slate-50 dark:bg-slate-700 border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                  } ${isRTL ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse space-x-3' : 'space-x-3'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      profile.isSelected
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                    }`}>
                      <span className="text-lg font-bold">{profile.name.charAt(0).toUpperCase()}</span>
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800 dark:text-slate-200">{profile.name}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{profile.protocol}</p>
                    </div>
                    
                    {/* Ping Result Display - Middle Position */}
                    <div className="flex items-center justify-center min-w-[80px]">
                      {profile.isPinging ? (
                        <div className={`flex items-center space-x-1.5 ${isRTL ? 'space-x-reverse' : ''}`}>
                          <SpinnerIcon className="w-4 h-4 text-blue-500 animate-spin" />
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Pinging...</span>
                        </div>
                      ) : profile.ping !== undefined ? (
                        <div className={`flex items-center space-x-1.5 ${isRTL ? 'space-x-reverse' : ''}`}>
                          {profile.pingSuccess ? (
                            <>
                              <SignalIcon className="w-4 h-4 text-green-500" />
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                {profile.ping}ms
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              </div>
                              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                                Failed
                              </span>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {profile.isSelected && (
                    <CheckIcon className="w-6 h-6 text-green-500" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSelector;
