'use client';

import { useMemo } from 'react';
import { useProtocol } from '@/contexts/ProtocolContext';

export function CurrentCommitments() {
  const { config, commitments, positions } = useProtocol();

  // Get user's commitments for the current epoch from localStorage
  const userCurrentEpochCommitments = useMemo(() => {
    if (!config || !commitments) return [];
    // Filter for current epoch, excluding legacy commitments with unknown epoch (-1)
    return commitments.filter(c => c.epoch === config.currentEpoch && c.epoch !== -1);
  }, [config, commitments]);

  // Calculate power for a position
  const calculatePower = (createdAt: number): number => {
    const ageInSeconds = Math.floor((Date.now() - createdAt * 1000) / 1000);
    return ageInSeconds;
  };

  // Group commitments by pool with bet count and total power
  const commitmentsByPool = useMemo(() => {
    const grouped: Record<number, { count: number; totalPower: number; hasLegacy: boolean }> = {};

    console.log('CurrentCommitments - Processing commitments:', userCurrentEpochCommitments);
    console.log('CurrentCommitments - Available positions:', positions);

    userCurrentEpochCommitments.forEach(c => {
      if (!grouped[c.poolId]) {
        grouped[c.poolId] = { count: 0, totalPower: 0, hasLegacy: false };
      }
      grouped[c.poolId].count += 1;

      // Find the position and calculate its power
      // positionId === -1 indicates legacy commitment (migrated from old format)
      if (c.positionId !== undefined && c.positionId !== -1) {
        console.log(`Looking for position with userIndex=${c.positionId}`);
        const position = positions.find(p => p.account.userIndex === c.positionId);
        if (position) {
          const power = calculatePower(position.account.createdAt);
          console.log(`Found position ${c.positionId}, calculated power: ${power}`);
          grouped[c.poolId].totalPower += power;
        } else {
          console.warn(`Position ${c.positionId} not found for commitment in pool ${c.poolId}`);
          console.warn('Available position indices:', positions.map(p => p.account.userIndex));
        }
      } else if (c.positionId === -1) {
        grouped[c.poolId].hasLegacy = true;
      }
    });

    console.log('CurrentCommitments - Final grouped data:', grouped);
    return grouped;
  }, [userCurrentEpochCommitments, positions]);

  const totalCommitments = useMemo(() => {
    return userCurrentEpochCommitments.length;
  }, [userCurrentEpochCommitments]);

  const totalPower = useMemo(() => {
    return Object.values(commitmentsByPool).reduce((sum, pool) => sum + pool.totalPower, 0);
  }, [commitmentsByPool]);

  if (!config) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border-2 border-blue-100 dark:border-blue-900">
      <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3 uppercase tracking-wide">
        Season {config.currentEpoch} Commitments
      </h3>

      {totalCommitments === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No active commitments this season
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pool breakdown */}
          {[0, 1, 2, 3].map((poolId) => {
            const poolData = commitmentsByPool[poolId];

            if (!poolData || poolData.count === 0) return null;

            return (
              <div
                key={poolId}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Auction #{poolId}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    {poolData.count} {poolData.count === 1 ? 'bet' : 'bets'}
                  </p>
                  {/* @note todo update that <p className="text-xs text-purple-600 dark:text-purple-400">
                    {poolData.totalPower > 0 ? (
                      `${poolData.totalPower.toLocaleString()} power`
                    ) : poolData.hasLegacy ? (
                      <span className="text-slate-400 dark:text-slate-500 italic">legacy bet</span>
                    ) : (
                      '0 power'
                    )}
                  </p> */}
                </div>
              </div>
            );
          })}

          {/* Total */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Total Bets
              </span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {totalCommitments}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Total Power
              </span>
              <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {totalPower.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
