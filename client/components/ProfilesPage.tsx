import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { GetProtocols, GetV2RaySubProtocols, PingProtocol, LoadSettings, SaveSettings } from '../services/api';
import type { VPNProtocol, V2RaySubProtocol } from '../services/api';
import { ArrowLeftIcon, SpinnerIcon } from './icons';

interface ProfilesPageProps {
  isConnected: boolean;
  connectedProtocol: string | null;
  onConnect: (protocolId: string) => void;
  onDisconnect: () => void;
  onBack: () => void;
}

const ProfilesPage: React.FC<ProfilesPageProps> = ({
  isConnected,
  connectedProtocol,
  onConnect,
  onDisconnect,
  onBack,
}) => {
  const { t, isRTL } = useLanguage();
  const [protocols, setProtocols] = useState<VPNProtocol[]>([]);
  const [v2raySubProtocols, setV2raySubProtocols] = useState<V2RaySubProtocol[]>([]);
  const [showV2RayPage, setShowV2RayPage] = useState(false);
  const [selectedV2RaySub, setSelectedV2RaySub] = useState<string | null>(null);
  const [pings, setPings] = useState<Record<string, { latency: number; success: boolean; loading: boolean }>>({});
  const [connecting, setConnecting] = useState<string | null>(null);
  const [autoPilot, setAutoPilot] = useState(false);
  const [autoPilotRunning, setAutoPilotRunning] = useState(false);

  useEffect(() => {
    loadProtocols();
    loadAutoPilotSetting();
  }, []);

  const loadProtocols = async () => {
    const protos = await GetProtocols();
    setProtocols(protos);
    const v2raySubs = await GetV2RaySubProtocols();
    setV2raySubProtocols(v2raySubs);
    // Auto-ping all running protocols
    protos.forEach(p => {
      if (p.status === 'running') {
        pingProtocol(p.id);
      }
    });
  };

  const loadAutoPilotSetting = async () => {
    const settings = await LoadSettings();
    setAutoPilot(settings.autoPilot || false);
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

  const handleAutoPilotToggle = async () => {
    const newValue = !autoPilot;
    setAutoPilot(newValue);
    await SaveSettings({ autoPilot: newValue });

    if (newValue) {
      runAutoPilot();
    }
  };

  const runAutoPilot = useCallback(async () => {
    setAutoPilotRunning(true);
    // Ping all running protocols and connect to the best one
    const runningProtocols = protocols.filter(p => p.status === 'running');
    let bestProtocol: string | null = null;
    let bestLatency = Infinity;

    for (const proto of runningProtocols) {
      try {
        const result = await PingProtocol(proto.id);
        setPings(prev => ({ ...prev, [proto.id]: { latency: result.latency, success: result.success, loading: false } }));
        if (result.success && result.latency < bestLatency) {
          bestLatency = result.latency;
          bestProtocol = proto.id;
        }
      } catch {}
    }

    if (bestProtocol) {
      onConnect(bestProtocol);
    }
    setAutoPilotRunning(false);
  }, [protocols, onConnect]);

  const getStatusColor = (proto: { status: string; id?: string }) => {
    const id = (proto as any).id;
    if (isConnected && connectedProtocol === id) return 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/20';
    if (proto.status === 'stopped') return 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 opacity-60';
    return 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800';
  };

  // V2Ray Sub-Protocol Detail Page
  if (showV2RayPage) {
    return (
      <div className={`space-y-4 ${isRTL ? 'text-right' : 'text-left'}`}>
        {/* Header */}
        <div className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse space-x-4' : 'space-x-4'}`}>
          <button onClick={() => setShowV2RayPage(false)} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors">
            <ArrowLeftIcon className={`w-6 h-6 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">⚡ V2Ray (Xray)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('selectProtocol')}</p>
          </div>
        </div>

        {/* V2Ray sub-protocol list — select one */}
        <div className="space-y-2">
          {v2raySubProtocols.map((sub) => {
            const isUnavailable = sub.status === 'stopped';
            const isSelected = selectedV2RaySub === sub.id;
            const isThisConnecting = connecting === sub.id;
            const isActiveConnection = isConnected && connectedProtocol === 'v2ray' && selectedV2RaySub === sub.id;

            const transportIcons: Record<string, string> = {
              websocket: '🌊',
              grpc: '⚙️',
              tcp: '🔌',
            };

            const securityBadgeColor: Record<string, string> = {
              tls: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
              reality: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
              aead: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
            };

            return (
              <button
                key={sub.id}
                onClick={() => {
                  if (isUnavailable) return;
                  if (isActiveConnection) {
                    // Disconnect if tapping the active one
                    onDisconnect();
                    setSelectedV2RaySub(null);
                    return;
                  }
                  // Select this sub-protocol and connect
                  setSelectedV2RaySub(sub.id);
                  setConnecting(sub.id);
                  onConnect('v2ray');
                  setTimeout(() => setConnecting(null), 1500);
                }}
                disabled={isUnavailable || (!!connecting && !isThisConnecting)}
                className={`w-full p-3.5 rounded-xl border-2 transition-all duration-200 ${
                  isUnavailable
                    ? 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 opacity-60 cursor-not-allowed'
                    : isActiveConnection
                      ? 'border-green-400 dark:border-green-500 bg-green-50 dark:bg-green-900/20'
                      : isSelected && !isConnected
                        ? 'border-orange-300 dark:border-orange-600 bg-orange-50 dark:bg-orange-900/10'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 active:scale-[0.98]'
                }`}
              >
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse space-x-3' : 'space-x-3'}`}>
                    <span className="text-xl">{transportIcons[sub.transport] || '⚡'}</span>
                    <div className={isRTL ? 'text-right' : 'text-left'}>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{sub.name}</p>
                      <div className={`flex items-center gap-2 mt-0.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{t('port')}: {sub.port}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${securityBadgeColor[sub.security] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                          {sub.security.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse space-x-2' : 'space-x-2'}`}>
                    {isThisConnecting ? (
                      <SpinnerIcon className="w-5 h-5 text-orange-500 animate-spin" />
                    ) : isActiveConnection ? (
                      <span className="flex items-center space-x-1">
                        <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-xs font-bold text-green-600 dark:text-green-400">{t('connected')}</span>
                      </span>
                    ) : isUnavailable ? (
                      <span className="text-xs font-medium text-slate-400">{t('offline')}</span>
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
  }

  // Main Profiles Page
  return (
    <div className={`space-y-4 ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse space-x-4' : 'space-x-4'}`}>
          <button onClick={onBack} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors">
            <ArrowLeftIcon className={`w-6 h-6 ${isRTL ? 'rotate-180' : ''}`} />
          </button>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{t('profiles')}</h2>
        </div>
        <button
          onClick={loadProtocols}
          className="text-xs text-orange-500 hover:text-orange-600 font-semibold transition-colors"
        >
          {t('refresh')}
        </button>
      </div>

      {/* Auto Pilot */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-4 border border-orange-200/60 dark:border-orange-800/40">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className={`flex items-center flex-1 min-w-0 ${isRTL ? 'flex-row-reverse space-x-reverse space-x-3' : 'space-x-3'}`}>
            <span className="text-2xl">🤖</span>
            <div className="min-w-0">
              <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{t('autoPilot')}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('autoPilotDesc')}</p>
            </div>
          </div>
          <div className={`flex items-center ${isRTL ? 'space-x-reverse space-x-2' : 'space-x-2'}`}>
            {autoPilotRunning && (
              <SpinnerIcon className="w-4 h-4 text-orange-500 animate-spin" />
            )}
            <button
              onClick={handleAutoPilotToggle}
              disabled={autoPilotRunning}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                autoPilot ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                autoPilot ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
        {autoPilot && !autoPilotRunning && (
          <button
            onClick={runAutoPilot}
            className="mt-3 w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white text-xs font-bold transition-all"
          >
            {t('findBestConnection')}
          </button>
        )}
      </div>

      {/* Protocol List */}
      <div className="space-y-2">
        {protocols.map((protocol) => {
          const ping = pings[protocol.id];
          const isCurrentlyConnected = isConnected && connectedProtocol === protocol.id;
          const isUnavailable = protocol.status === 'stopped';
          const isThisConnecting = connecting === protocol.id;
          const hasSubProtocols = protocol.id === 'v2ray' && v2raySubProtocols.length > 0;

          return (
            <button
              key={protocol.id}
              onClick={() => {
                if (isUnavailable) return;
                if (hasSubProtocols) {
                  setShowV2RayPage(true);
                } else {
                  handleConnect(protocol.id);
                }
              }}
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
                      {hasSubProtocols && ` · ${v2raySubProtocols.length} configs`}
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

export default ProfilesPage;
