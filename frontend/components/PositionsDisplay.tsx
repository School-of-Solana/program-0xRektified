'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useProtocol } from '@/contexts/ProtocolContext';

export function PositionsDisplay() {
  const { publicKey } = useWallet();
  const { positions, isLoading } = useProtocol();
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second to recalculate weights
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const calculateCurrentWeight = (createdAt: number): number => {
    const ageInSeconds = Math.floor((currentTime - createdAt * 1000) / 1000);
    return ageInSeconds;
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  if (!publicKey) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Your Positions
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          Connect your wallet to view positions
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Your Positions
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">Loading positions...</p>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Your Positions
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          No positions yet. Mint your first position to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Your Positions
      </h3>
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {positions.map((position) => {
          const currentWeight = calculateCurrentWeight(position.account.createdAt);
          return (
            <div
              key={position.publicKey.toString()}
              className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">💎</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      Position #{position.account.userIndex}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Created: {new Date(position.account.createdAt * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Weight</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {currentWeight}s
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {formatTime(currentWeight)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Total Positions: <span className="font-semibold text-gray-900 dark:text-white">{positions.length}</span>
        </p>
      </div>
    </div>
  );
}
