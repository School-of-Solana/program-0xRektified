import { useGameState as useGameStateContext } from '@/contexts/GameStateContext';
import { useMemo } from 'react';

/**
 * Custom hook providing convenient access to game state with computed values
 */
export function useGameState() {
  const context = useGameStateContext();

  // Compute additional derived values
  const derived = useMemo(() => {
    const { config, currentEpoch, epochResult, pools, positions } = context;

    // Calculate epoch end time
    const epochEndTime = config
      ? Math.floor(Date.now() / 1000) + config.epochDuration
      : 0;

    // Check if epoch has ended
    const hasEpochEnded = epochResult
      ? Date.now() / 1000 >= epochResult.endAt
      : false;

    // Get pools for current epoch
    const currentPools = pools.filter((p) => p.account.epoch === currentEpoch);

    // Get total positions count
    const totalPositions = positions.length;

    // Calculate total weight across all pools
    const totalPoolWeight = currentPools.reduce(
      (sum, pool) => sum + pool.account.totalWeight,
      0
    );

    // Calculate total commitments across all pools
    const totalCommitments = currentPools.reduce(
      (sum, pool) => sum + pool.account.totalPositions,
      0
    );

    // Get position price in tokens (for display)
    const positionPriceDisplay = config ? config.positionPrice / 1e9 : 0;

    // Get token balance in display format
    const tokenBalanceDisplay = context.tokenBalance / 1e9;

    // Check if user can mint position
    const canMintPosition = context.tokenBalance >= (config?.positionPrice || 0);

    return {
      epochEndTime,
      hasEpochEnded,
      currentPools,
      totalPositions,
      totalPoolWeight,
      totalCommitments,
      positionPriceDisplay,
      tokenBalanceDisplay,
      canMintPosition,
    };
  }, [context]);

  return {
    ...context,
    ...derived,
  };
}

/**
 * Hook to get a specific pool by ID for the current epoch
 */
export function usePool(poolId: number) {
  const { currentPools } = useGameState();

  return useMemo(
    () => currentPools.find((p) => p.account.poolId === poolId) || null,
    [currentPools, poolId]
  );
}

/**
 * Hook to get the winning pool for a specific epoch
 */
export function useWinningPool(epoch?: number) {
  const { pools, epochResult, currentEpoch } = useGameState();
  const targetEpoch = epoch ?? currentEpoch;

  return useMemo(() => {
    if (!epochResult || epochResult.epoch !== targetEpoch) {
      return null;
    }

    return pools.find(
      (p) =>
        p.account.epoch === targetEpoch &&
        p.account.poolId === epochResult.winningPoolId
    ) || null;
  }, [pools, epochResult, targetEpoch, currentEpoch]);
}

/**
 * Hook to check if a pool won in a specific epoch
 */
export function useIsWinningPool(poolId: number, epoch?: number) {
  const { epochResult, currentEpoch } = useGameState();
  const targetEpoch = epoch ?? currentEpoch;

  return useMemo(() => {
    if (!epochResult || epochResult.epoch !== targetEpoch) {
      return false;
    }

    return epochResult.winningPoolId === poolId;
  }, [epochResult, poolId, targetEpoch, currentEpoch]);
}
