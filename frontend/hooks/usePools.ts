'use client';

import { useMemo } from 'react';
import { useProtocol } from '@/contexts/ProtocolContext';
import { PublicKey } from '@solana/web3.js';

export interface Pool {
  id: number;
  epoch: number;
  totalPositions: number;
  totalWeight: number;
  pda: PublicKey;
}

export function usePools(includePreviousEpoch: boolean = false) {
  const { pools, config, currentEpoch, isLoading } = useProtocol();

  const currentEpochPools = useMemo(() => {
    if (!config) {
      return [];
    }

    return pools
      .filter(p => p.account.epoch === currentEpoch)
      .map(p => ({
        id: p.account.poolId,
        epoch: p.account.epoch,
        totalPositions: p.account.totalPositions,
        totalWeight: p.account.totalWeight,
        pda: p.publicKey,
      }));
  }, [pools, config, currentEpoch]);

  const previousEpochPools = useMemo(() => {
    if (!config || !includePreviousEpoch || currentEpoch === 0) return [];

    const previousEpoch = currentEpoch - 1;
    return pools
      .filter(p => p.account.epoch === previousEpoch)
      .map(p => ({
        id: p.account.poolId,
        epoch: p.account.epoch,
        totalPositions: p.account.totalPositions,
        totalWeight: p.account.totalWeight,
        pda: p.publicKey,
      }));
  }, [pools, config, currentEpoch, includePreviousEpoch]);

  return {
    currentEpochPools,
    previousEpochPools,
    loading: isLoading,
    error: null
  };
}
