import React, { useState, useEffect } from 'react';
import { GetNetworkSpeed } from '../services/api';
import type { NetworkSpeed } from '../services/api';

const SpeedMonitor: React.FC = () => {
  const [speed, setSpeed] = useState<NetworkSpeed | null>(null);

  useEffect(() => {
    const fetchSpeed = async () => {
      try {
        const networkSpeed = await GetNetworkSpeed();
        setSpeed(networkSpeed);
      } catch (error) {
        console.error('Failed to fetch network speed:', error);
      }
    };

    fetchSpeed();
    const interval = setInterval(fetchSpeed, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatSpeed = (speedKBps: number): string => {
    if (speedKBps < 1) {
      return `${Math.round(speedKBps * 1024)} B/s`;
    } else if (speedKBps < 1024) {
      return `${speedKBps.toFixed(1)} KB/s`;
    } else {
      return `${(speedKBps / 1024).toFixed(1)} MB/s`;
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  };

  if (!speed) {
    return (
      <div className="w-full flex items-center justify-center p-3 bg-slate-50/50 dark:bg-slate-700/30 rounded-lg border border-slate-200/50 dark:border-slate-600/50 transition-colors h-[52px]">
        <span className="text-xs text-slate-500 dark:text-slate-400">Loading...</span>
      </div>
    );
  }

  const isActive = speed.downloadSpeed > 0 || speed.uploadSpeed > 0;

  return (
    <div className="w-full p-3 bg-slate-50/50 dark:bg-slate-700/30 rounded-lg border border-slate-200/50 dark:border-slate-600/50 transition-colors">
      <div className="flex items-center justify-between">
        {/* Speed indicators */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {formatSpeed(speed.downloadSpeed)}
            </span>
          </div>
          <div className="flex items-center space-x-1.5">
            <svg className="w-3.5 h-3.5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-1-11a1 1 0 112 0v3.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 011.414-1.414L9 10.586V7z" clipRule="evenodd" transform="rotate(180 10 10)" />
            </svg>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {formatSpeed(speed.uploadSpeed)}
            </span>
          </div>
        </div>

        {/* Total usage */}
        <div className="text-right">
          <div className="text-xs text-slate-500 dark:text-slate-500 leading-tight">
            ↓{formatBytes(speed.totalDownload)} ↑{formatBytes(speed.totalUpload)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeedMonitor;
