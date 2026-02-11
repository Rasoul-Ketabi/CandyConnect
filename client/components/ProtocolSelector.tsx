import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { GetProtocols, PingProtocol, ConnectToProtocol, DisconnectAll } from '../services/api';
import type { VPNProtocol } from '../services/api';
import { SpinnerIcon } from './icons';

interface ProtocolSelectorProps {
  isConnected: boolean;
  connectedProtocol: string | null;
  onConnect: (protocolId: string) => void;
  onDisconnect: () => void;
}

const ProtocolSelector: React.FC<ProtocolSelectorProps> = ({
  isConnected,
  connectedProtocol,
  onConnect,
  onDisconnect,
}) => {
  const { t, isRTL } = useLanguage();
  const [protocols, setProtocols] = useState<VPNProtocol[]>([]);
  const [pings, setPings] = useState<Record<string, { latency: number; success: boolean; loading: boolean }>>({});
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    loadProtocols();
  }, []);

  const loadProtocols = async () => {
    const protos = await GetProtocols();
    setProtocols(protos);
    // Auto-ping all
    protos.forEach(p => {
      if (p.status === 'running') {
        pingProtocol(p.id);
      }
    });
  };

  const pingProtocol = async (id: string) => {
    setPings(prev => ({ ...prev, [id]: { latency: 0, success: false, loading: true } }));
    try {
      const result = await PingProtocol(id);
      setPings(prev => ({ ...prev, [id]: { latency: result.latency, success: result.success, loading: false } }));
    } catch {
      setPings(prev => ({ ...prev, [id]: { latency: 0, success: false, loading: false } }));
    }
  };

  const handleConnect = async (protocolId: string) => {
    if (connecting) return;
    if (isConnected && connectedProtocol === protocolId) {
      onDisconnect();
      return;
    }
    setConnecting(protocolId);
    try {
      onConnect(protocolId);
    } finally {
      setTimeout(() => setConnecting(null), 1500);
    }
  };

  const getStatusColor = (protocol: VPNProtocol) => {
    if (isConnected && connectedProtocol === protocol.id) return 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/20';
    if (protocol.status === 'stopped') return 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 opacity-60';
    return 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800';
  };

  return (
    <div className="space-y-3">
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">{t('selectProtocol')}</h3>
        <button
          onClick={loadProtocols}
          className="text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors"
        >
          {t('refresh')}
        </button>
      </div>

      <div className="space-y-2">
        {protocols.map((protocol) => {
          const ping = pings[protocol.id];
          const isCurrentlyConnected = isConnected && connectedProtocol === protocol.id;
          const isUnavailable = protocol.status === 'stopped';
          const isThisConnecting = connecting === protocol.id;

          return (
            <button
              key={protocol.id}
              onClick={() => !isUnavailable && handleConnect(protocol.id)}
              disabled={isUnavailable || (!!connecting && !isThisConnecting)}
              className={`w-full p-3.5 rounded-xl border-2 transition-all duration-200 ${getStatusColor(protocol)} ${
                !isUnavailable ? 'active:scale-[0.98]' : 'cursor-not-allowed'
              }`}
            >
              <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse space-x-3' : 'space-x-3'}`}>
                  <span className="text-2xl">{protocol.icon}</span>
                  <div className={isRTL ? 'text-right' : 'text-left'}>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                      {protocol.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('port')}: {protocol.port} · v{protocol.version}
                    </p>
                  </div>
                </div>

                <div className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse space-x-2' : 'space-x-2'}`}>
                  {/* Ping display */}
                  {ping && !ping.loading && ping.success && (
                    <span className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                      {ping.latency}ms
                    </span>
                  )}
                  {ping && ping.loading && (
                    <SpinnerIcon className="w-4 h-4 text-blue-500 animate-spin" />
                  )}
                  {ping && !ping.loading && !ping.success && (
                    <span className="text-xs font-medium text-red-500 dark:text-red-400">✕</span>
                  )}

                  {/* Status indicator */}
                  {isThisConnecting ? (
                    <SpinnerIcon className="w-5 h-5 text-orange-500 animate-spin" />
                  ) : isCurrentlyConnected ? (
                    <span className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-xs font-bold text-green-600 dark:text-green-400">{t('connected')}</span>
                    </span>
                  ) : isUnavailable ? (
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">{t('offline')}</span>
                  ) : (
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProtocolSelector;
