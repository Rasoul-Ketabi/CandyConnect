import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowLeftIcon } from './icons';
import type { ClientAccount } from '../services/api';

interface AccountInfoProps {
  account: ClientAccount;
  onBack: () => void;
}

const AccountInfo: React.FC<AccountInfoProps> = ({ account, onBack }) => {
  const { t, isRTL } = useLanguage();

  const trafficPercent = account.trafficLimit.unit === 'MB'
    ? ((account.trafficUsed * 1024) / account.trafficLimit.value) * 100
    : (account.trafficUsed / account.trafficLimit.value) * 100;

  const trafficDisplay = account.trafficLimit.unit === 'MB'
    ? `${(account.trafficUsed * 1024).toFixed(0)} / ${account.trafficLimit.value} MB`
    : `${account.trafficUsed.toFixed(1)} / ${account.trafficLimit.value} GB`;

  const timeRemaining = account.timeLimit.value - account.timeUsed;
  const timePercent = (account.timeUsed / account.timeLimit.value) * 100;

  const getBarColor = (pct: number) => {
    if (pct > 90) return 'bg-red-500';
    if (pct > 70) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const enabledProtocolsList = Object.entries(account.enabledProtocols)
    .filter(([_, enabled]) => enabled)
    .map(([id]) => id);

  const protocolNames: Record<string, string> = {
    v2ray: 'V2Ray', wireguard: 'WireGuard', openvpn: 'OpenVPN',
    ikev2: 'IKEv2', l2tp: 'L2TP', dnstt: 'DNSTT',
    slipstream: 'SlipStream', trusttunnel: 'TrustTunnel',
  };

  const protocolIcons: Record<string, string> = {
    v2ray: '⚡', wireguard: '🛡️', openvpn: '🔒',
    ikev2: '🔐', l2tp: '📡', dnstt: '🌐',
    slipstream: '💨', trusttunnel: '🏰',
  };

  return (
    <div className={`space-y-4 ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Header */}
      <div className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse space-x-4' : 'space-x-4'}`}>
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors">
          <ArrowLeftIcon className={`w-6 h-6 ${isRTL ? 'rotate-180' : ''}`} />
        </button>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{t('accountInfo')}</h2>
      </div>

      {/* User Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <div className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse space-x-3' : 'space-x-3'}`}>
          <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-xl font-bold text-white">{account.username.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 dark:text-slate-200 text-lg truncate">{account.username}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{account.comment}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
            account.enabled
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }`}>
            {account.enabled ? t('active') : t('disabled')}
          </span>
        </div>
      </div>

      {/* Traffic Usage */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('trafficUsage')}</h3>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{trafficPercent.toFixed(1)}%</span>
        </div>
        <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getBarColor(trafficPercent)}`}
            style={{ width: `${Math.min(100, trafficPercent)}%` }}
          />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">{trafficDisplay}</p>
      </div>

      {/* Time Remaining */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t('timeRemaining')}</h3>
          {account.timeLimit.onHold && (
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              ⏸ {t('onHold')}
            </span>
          )}
        </div>
        <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getBarColor(timePercent)}`}
            style={{ width: `${Math.min(100, timePercent)}%` }}
          />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
          {timeRemaining} {account.timeLimit.mode} {t('remaining')}
        </p>
      </div>

      {/* Dates */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50 space-y-3">
        <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="text-sm text-slate-500 dark:text-slate-400">{t('createdAt')}</span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{account.createdAt}</span>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-700"></div>
        <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="text-sm text-slate-500 dark:text-slate-400">{t('expiresAt')}</span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{account.expiresAt}</span>
        </div>
      </div>

      {/* Enabled Protocols */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">{t('enabledProtocols')}</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(account.enabledProtocols).map(([id, enabled]) => (
            <span
              key={id}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                enabled
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-600'
              }`}
            >
              <span>{protocolIcons[id] || '●'}</span>
              {protocolNames[id] || id}
            </span>
          ))}
        </div>
      </div>

      {/* Connection History */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
        <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">{t('connectionHistory')}</h3>
        <div className="space-y-2">
          {account.connectionHistory.map((entry, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <div className={isRTL ? 'text-right' : 'text-left'}>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{entry.protocol}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{entry.time}</p>
              </div>
              <div className={isRTL ? 'text-left' : 'text-right'}>
                <p className="text-xs text-slate-500 dark:text-slate-400">{entry.ip}</p>
                <p className={`text-xs font-medium ${
                  entry.duration === 'Active'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}>
                  {entry.duration}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AccountInfo;
