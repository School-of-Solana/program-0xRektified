'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAnchorProgram } from '@/hooks/useAnchorProgram';
import { usePools } from '@/hooks/usePools';
import { useProtocol } from '@/contexts/ProtocolContext';
import { getCommitmentPda } from '@/lib/pda';
import * as anchor from '@coral-xyz/anchor';

export function CommitPosition() {
  const { program, wallet, programId } = useAnchorProgram();
  const { config, positions: rawPositions, refetch, addCommitment } = useProtocol();
  const { currentEpochPools } = usePools();

  // Transform ProtocolContext positions to the format we need
  const positions = useMemo(() => {
    return rawPositions.map(pos => ({
      id: pos.account.userIndex,
      owner: pos.account.owner,
      userIndex: pos.account.userIndex,
      globalId: pos.account.globalId,
      createdAt: pos.account.createdAt,
      pda: pos.publicKey,
    }));
  }, [rawPositions]);
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [selectedPool, setSelectedPool] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Clear selections when epoch changes (pools are recreated each epoch)
  useEffect(() => {
    setSelectedPool(null);
    setSelectedPosition(null);
    setError(null);
    setSuccess(null);
  }, [config?.currentEpoch]);

  // Update current time every second to recalculate weight
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const calculateWeight = (createdAt: number): number => {
    if (!config) return 0;

    // WEIGHT_PRECISION = 10,000
    const WEIGHT_PRECISION = 10000;
    const ageInSeconds = Math.floor((currentTime - createdAt * 1000) / 1000);

    // Formula: (age * numerator * WEIGHT_PRECISION) / denominator
    // Then divide by WEIGHT_PRECISION to make it human-readable
    // Keep 3 decimal precision by multiplying result by 1000 before dividing by WEIGHT_PRECISION
    const calculatedWeight =
      (ageInSeconds * config.weightRateNumerator * WEIGHT_PRECISION) /
      config.weightRateDenominator /
      WEIGHT_PRECISION;

    return calculatedWeight;
  };

  const getWeightTier = (weight: number): { bg: string; border: string; text: string; glow: string } => {
    // Progression from gray to golden - more weight = more golden/legendary
    // Adjusted thresholds based on weight formula (not raw seconds)
    if (weight >= 20) { // High weight - Legendary Golden Diamond
      return {
        bg: 'bg-gradient-to-br from-yellow-200 via-amber-300 to-orange-300 dark:from-yellow-600/60 dark:via-amber-500/60 dark:to-orange-400/60',
        border: 'border-amber-400 dark:border-amber-400',
        text: 'text-amber-900 dark:text-amber-200',
        glow: 'shadow-lg shadow-amber-300/50 dark:shadow-amber-500/30'
      };
    } else if (weight >= 12) { // Medium-high weight - Gold Diamond
      return {
        bg: 'bg-gradient-to-br from-yellow-100 via-yellow-200 to-amber-200 dark:from-yellow-700/50 dark:via-yellow-600/50 dark:to-amber-600/50',
        border: 'border-yellow-400 dark:border-yellow-500',
        text: 'text-yellow-900 dark:text-yellow-200',
        glow: 'shadow-md shadow-yellow-300/40 dark:shadow-yellow-500/20'
      };
    } else if (weight >= 6) { // Medium weight - Light Gold
      return {
        bg: 'bg-gradient-to-br from-amber-50 via-yellow-100 to-yellow-200 dark:from-amber-800/40 dark:via-yellow-700/40 dark:to-yellow-600/40',
        border: 'border-yellow-300 dark:border-yellow-600',
        text: 'text-yellow-800 dark:text-yellow-300',
        glow: 'shadow-sm shadow-yellow-200/30'
      };
    } else if (weight >= 3) { // Low-medium weight - Silver-Gold
      return {
        bg: 'bg-gradient-to-br from-slate-100 via-zinc-100 to-yellow-100 dark:from-slate-700/40 dark:via-zinc-700/40 dark:to-yellow-700/40',
        border: 'border-zinc-300 dark:border-zinc-500',
        text: 'text-zinc-800 dark:text-zinc-300',
        glow: ''
      };
    } else if (weight >= 1) { // Low weight - Silver
      return {
        bg: 'bg-gradient-to-br from-slate-50 via-gray-100 to-zinc-100 dark:from-slate-700/30 dark:via-gray-700/30 dark:to-zinc-700/30',
        border: 'border-gray-300 dark:border-gray-500',
        text: 'text-gray-800 dark:text-gray-300',
        glow: ''
      };
    } else { // Very low weight - Basic Gray
      return {
        bg: 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600',
        border: 'border-gray-300 dark:border-gray-500',
        text: 'text-gray-700 dark:text-gray-300',
        glow: ''
      };
    }
  };

  const handleCommit = async () => {
    if (!program || !wallet || !programId || !config || selectedPosition === null || selectedPool === null) {
      setError('Please select a position and pool');
      return;
    }

    const position = positions.find(p => p.id === selectedPosition);
    if (!position) {
      setError('Position not found');
      return;
    }

    // Find the selected pool to verify its epoch
    const selectedPoolData = currentEpochPools.find(p => p.id === selectedPool);
    if (!selectedPoolData) {
      setError('Selected pool not found in current epoch');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const [commitmentPda] = getCommitmentPda(
        wallet.publicKey,
        selectedPool,
        selectedPoolData.epoch,
        programId
      );

      const tx = await program.methods
        .commit(new anchor.BN(position.id), selectedPool)
        .accountsPartial({
          signer: wallet.publicKey,
          position: position.pda,
          pool: selectedPoolData.pda,
          commitment: commitmentPda,
        })
        .rpc();

      setSuccess(`Position committed! Transaction: ${tx.slice(0, 8)}...`);

      // Calculate weight (time held in seconds)
      const currentTime = Math.floor(Date.now() / 1000);
      const weight = currentTime - position.createdAt;

      // Store commitment in localStorage and refetch data
      addCommitment({
        poolId: selectedPool,
        epoch: config.currentEpoch,
        claimed: false,
        positionId: position.id,
        weight,
      });

      await refetch();
    } catch (err: any) {
      console.error('Failed to commit position:', err);
      setError(err.message || 'Failed to commit position');
    } finally {
      setLoading(false);
    }
  };

  if (!wallet) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-blue-100 dark:border-blue-900 p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Auction status
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Choose your crystal and bet on an auction house to compete for rewards
          </p>
        </div>

        {/* Auction House Selection - Empty State */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              AUCTION HOUSE
            </h3>
            <span className="text-xs font-semibold text-blue-400 dark:text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
              Season --
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Select which auction to bet on
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((poolId) => (
              <div
                key={poolId}
                className="relative p-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 opacity-50 cursor-not-allowed"
              >
                <div className="absolute top-2 right-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                </div>

                <div className="text-center">
                  <p className="text-lg font-bold text-slate-500 dark:text-slate-400 mb-1">
                    Auction #{poolId}
                  </p>
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Bets: <span className="font-bold">--</span>
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Weight: <span className="font-bold">--</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Crystal Selection - Empty State */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                YOUR CRYSTALS
              </h3>
              <span className="text-xs text-purple-400 dark:text-purple-500 font-medium">
                0 Active
              </span>
            </div>
            <span className="text-xs font-semibold text-purple-400 dark:text-purple-500 bg-purple-50 dark:bg-purple-900/30 px-3 py-1 rounded-full">
              Forge Cost: -- CRYS
            </span>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            Select a crystal to bet with
          </p>
          <div className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-center border-2 border-dashed border-slate-300 dark:border-slate-600">
            <div className="text-4xl mb-2 opacity-50">💎</div>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              Connect wallet to view crystals
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Forge your first crystal to start competing
            </p>
          </div>
        </div>

        {/* Action Button - Disabled */}
        <button
          disabled
          className="w-full px-5 py-4 bg-gray-400 dark:bg-gray-600 text-white rounded-lg font-bold cursor-not-allowed"
        >
          Connect Wallet to Bet
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-blue-100 dark:border-blue-900 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Auction Status
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Choose your crystal and bet on an auction house to compete for rewards
        </p>
      </div>

      {/* Auction House Selection */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            AUCTION HOUSE
          </h3>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full">
            Season {config?.currentEpoch}
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          Select which auction to bet on
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((poolId) => {
            const pool = currentEpochPools.find(p => p.id === poolId);
            const isInitialized = !!pool;
            const isSelected = selectedPool === poolId;
            const canInteract = isInitialized && positions.length > 0;

            // Divide totalWeight by 10000 for human-readable display with 3 decimals
            const displayWeight = pool ? (pool.totalWeight / 10000).toFixed(3) : '--';

            return (
              <button
                key={poolId}
                type="button"
                onClick={() => canInteract && setSelectedPool(selectedPool === poolId ? null : poolId)}
                disabled={!canInteract}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 shadow-lg shadow-blue-500/20'
                    : !canInteract
                    ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-default'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:border-blue-400 hover:shadow-md'
                }`}
              >
                {/* Status Indicator */}
                <div className="absolute top-2 right-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    isInitialized
                      ? 'bg-cyan-500 shadow-sm shadow-cyan-400/50'
                      : 'bg-pink-500 shadow-sm shadow-pink-400/50'
                  }`} />
                </div>

                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                    Auction #{poolId}
                  </p>
                  {isInitialized ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Bets: <span className="font-bold text-blue-600 dark:text-blue-400">{pool.totalPositions}</span>
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Weight: <span className="font-bold text-purple-600 dark:text-purple-400">{displayWeight}</span>
                      </p>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                        Awaiting bids
                      </p>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Crystal Selection */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              YOUR CRYSTALS
            </h3>
            {positions.length > 0 && (
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                {positions.length} Active
              </span>
            )}
          </div>
          {config && (
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-3 py-1 rounded-full">
              Forge Cost: {config.positionPrice / 1e9} CRYS
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
          Select a crystal to bet with
        </p>
        {positions.length === 0 ? (
          <div className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-center border-2 border-dashed border-slate-300 dark:border-slate-600">
            <div className="text-4xl mb-2">💎</div>
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              No crystals yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Forge your first crystal to start competing
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Render actual positions */}
            {positions.map((position) => {
              const weight = calculateWeight(position.createdAt);
              const tier = getWeightTier(weight);
              const isSelected = selectedPosition === position.id;

              return (
                <button
                  key={position.id}
                  type="button"
                  onClick={() => setSelectedPosition(selectedPosition === position.id ? null : position.id)}
                  className={`relative p-3 rounded-lg border-2 transition-all duration-300 ${
                    isSelected
                      ? 'border-purple-500 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/40 dark:to-blue-900/40 shadow-lg shadow-purple-500/30 scale-105'
                      : `${tier.bg} ${tier.border} hover:scale-105`
                  } ${tier.glow}`}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-1">💎</div>
                    <p className={`text-xs font-semibold mb-1 ${tier.text}`}>
                      #{position.id}
                    </p>
                    <div className="text-xs">
                      <span className={`font-bold text-lg ${tier.text}`}>{weight.toFixed(3)}</span>
                      <div className={`text-[10px] mt-0.5 ${tier.text} opacity-80`}>weight</div>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Render empty slots to encourage forging more crystals */}
            {positions.length < 12 && Array.from({ length: 12 - positions.length }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="relative p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/30 opacity-50"
              >
                <div className="text-center">
                  <div className="text-3xl mb-1 opacity-30">💎</div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                    Empty
                  </p>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    <span className="text-[10px]">Forge more</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-pink-50 dark:bg-pink-900/20 rounded border border-pink-200 dark:border-pink-800">
          <p className="text-pink-700 dark:text-pink-300 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded border border-cyan-200 dark:border-cyan-800">
          <p className="text-cyan-700 dark:text-cyan-300 text-sm">{success}</p>
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handleCommit}
        disabled={loading || selectedPosition === null || selectedPool === null}
        className="w-full px-5 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg transition-all font-bold shadow-md hover:shadow-lg transform hover:scale-[1.02] disabled:transform-none"
      >
        {loading ? 'Placing Bet...' : 'Bet to Auction House'}
      </button>
    </div>
  );
}
