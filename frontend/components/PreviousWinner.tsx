'use client';

import { useProtocol } from '@/contexts/ProtocolContext';

export function PreviousWinner() {
  const { previousEpochResult } = useProtocol();

  // Only show if we have a resolved previous epoch result
  if (!previousEpochResult) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border-2 border-green-200 dark:border-green-800 p-4 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-green-900 dark:text-green-100">
              Season {previousEpochResult.epoch} Winner
            </p>
            <p className="text-xs text-green-700 dark:text-green-300">
              Epoch resolved successfully
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            Auction #{previousEpochResult.winningPoolId}
          </p>
          {/* <p className="text-xs text-green-600 dark:text-green-500 font-medium">
            {previousEpochResult.totalPositionAmount} total positions
          </p> */}
        </div>
      </div>
    </div>
  );
}
