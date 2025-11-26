'use client';

import { useState, useEffect } from 'react';
import { useProtocol } from '@/contexts/ProtocolContext';

export function EpochCountdown() {
  const { config, epochResult } = useProtocol();
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [epochDuration, setEpochDuration] = useState(300);

  // Calculate if epoch has not started (no epoch result available)
  const epochNotStarted = !epochResult;
  const endTimestamp = epochResult?.endAt || null;

  // Update countdown timer
  useEffect(() => {
    if (endTimestamp === null) {
      return;
    }

    // Initial calculation
    const now = Math.floor(Date.now() / 1000);
    const remaining = Math.max(0, endTimestamp - now);
    setTimeRemaining(remaining);

    if (remaining > 0) {
      setEpochDuration(remaining);
    }

    // Update every second
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, endTimestamp - now);
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [endTimestamp]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    if (epochDuration === 0) return 0;
    if (timeRemaining === 0) return 100;
    const elapsed = epochDuration - timeRemaining;
    return Math.min(100, (elapsed / epochDuration) * 100);
  };

  const getColorClasses = (): string => {
    if (endTimestamp === null) return 'text-gray-400';

    if (timeRemaining === 0) {
      return 'text-orange-600 dark:text-orange-400';
    }

    const percentage = (timeRemaining / epochDuration) * 100;

    if (percentage > 50) {
      return 'text-cyan-600 dark:text-cyan-400';
    } else if (percentage > 25) {
      return 'text-blue-600 dark:text-blue-400';
    } else {
      return 'text-pink-600 dark:text-pink-400';
    }
  };

  const getBarColorClasses = (): string => {
    if (endTimestamp === null) return 'bg-gray-400';

    if (timeRemaining === 0) {
      return 'bg-gradient-to-r from-orange-500 to-amber-500';
    }

    const percentage = (timeRemaining / epochDuration) * 100;

    if (percentage > 50) {
      return 'bg-gradient-to-r from-cyan-500 to-blue-500';
    } else if (percentage > 25) {
      return 'bg-gradient-to-r from-blue-500 to-purple-500';
    } else {
      return 'bg-gradient-to-r from-purple-500 to-pink-500';
    }
  };

  const getStatusText = (): string => {
    if (endTimestamp === null) return 'Loading epoch data...';
    if (timeRemaining === 0) return 'Awaiting resolution';
    return 'Time until epoch closes';
  };

  if (epochNotStarted) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-gray-300 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-700 dark:text-gray-300">
              EPOCH COUNTDOWN
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
              Epoch not initialized - awaiting setup
            </p>
          </div>
          <div className="text-4xl font-bold font-mono tabular-nums text-gray-400 dark:text-gray-600">
            --:--
          </div>
        </div>

        {/* Empty Progress Bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden shadow-inner">
          <div className="h-full bg-gray-300 dark:bg-gray-600" style={{ width: '0%' }} />
        </div>

        <div className="mt-3 flex items-center justify-between text-xs font-medium">
          <span className="text-gray-500 dark:text-gray-400">
            Waiting for admin to initialize pools
          </span>
          {config && (
            <span className="text-gray-500 dark:text-gray-500">
              Epoch #{config.currentEpoch}
            </span>
          )}
        </div>
      </div>
    );
  }

  // If timer reached zero, show waiting state with spinner
  if (timeRemaining === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-orange-100 dark:border-orange-900 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-orange-900 dark:text-orange-100">
              EPOCH COUNTDOWN
            </h3>
            <p className="text-sm text-orange-600 dark:text-orange-400 mt-1 font-medium">
              Awaiting resolution
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Spinner */}
            <svg
              className="animate-spin h-10 w-10 text-orange-600 dark:text-orange-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        </div>

        <div className="flex items-center justify-center py-2">
          <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">
            Waiting for admin to resolve epoch and create new pools...
          </p>
        </div>

        <div className="mt-3 flex items-center justify-center text-xs text-gray-500 dark:text-gray-500 font-medium">
          {config && (
            <span>
              Epoch #{config.currentEpoch}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-blue-100 dark:border-blue-900 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">
            EPOCH COUNTDOWN
          </h3>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-1 font-medium">
            {getStatusText()}
          </p>
        </div>
        <div className={`text-4xl font-bold font-mono tabular-nums ${getColorClasses()}`}>
          {endTimestamp === null ? '--:--' : formatTime(timeRemaining)}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden shadow-inner">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${getBarColorClasses()} shadow-lg`}
          style={{ width: `${getProgressPercentage()}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 font-medium">
        <span>Epoch Progress: {Math.floor(getProgressPercentage())}%</span>
        {config && (
          <span className="text-gray-500 dark:text-gray-500">
            Epoch #{config.currentEpoch}
          </span>
        )}
      </div>
    </div>
  );
}
