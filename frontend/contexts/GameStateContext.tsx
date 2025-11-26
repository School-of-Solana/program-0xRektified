'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNetwork } from '@/contexts/NetworkContext';

// Types matching the API responses
interface Config {
  admin: string;
  currentEpoch: number;
  totalPositionsMinted: number;
  positionPrice: number;
  remainingTotalPosition: number;
  allowedMint: string;
  treasuryAta: string;
  weightModel: any;
  resolutionType: any;
  resolver: string;
  epochDuration: number;
}

interface EpochResult {
  epoch: number;
  winningPoolId: number;
  weight: number;
  endAt: number;
  totalPositionAmount: number;
  poolCount: number;
  poolWeights: number[];
  epochResultState: any;
}

interface Pool {
  publicKey: string;
  account: {
    epoch: number;
    poolId: number;
    totalWeight: number;
    totalPositions: number;
  };
}

interface Position {
  publicKey: string;
  account: {
    owner: string;
    userIndex: number;
    globalId: number;
    createdAt: number;
  };
}

interface GameState {
  config: Config | null;
  currentEpoch: number;
  epochResult: EpochResult | null;
  pools: Pool[];
  positions: Position[];
  tokenBalance: number;
  mint: string | null;
  isLoading: boolean;
  lastUpdated: number;
}

interface GameStateContextType extends GameState {
  refetch: () => Promise<void>;
  refetchPools: () => Promise<void>;
  refetchPositions: () => Promise<void>;
}

const GameStateContext = createContext<GameStateContextType | null>(null);

const STORAGE_KEY = 'twcp_commitments';

interface GameStateProviderProps {
  children: ReactNode;
  pollingInterval?: number; // Polling interval in milliseconds (default: 5000)
}

export function GameStateProvider({
  children,
  pollingInterval = 5000
}: GameStateProviderProps) {
  const { publicKey } = useWallet();
  const { network } = useNetwork();

  const [gameState, setGameState] = useState<GameState>({
    config: null,
    currentEpoch: 0,
    epochResult: null,
    pools: [],
    positions: [],
    tokenBalance: 0,
    mint: null,
    isLoading: false,
    lastUpdated: 0,
  });

  // Fetch config (public data)
  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch(`/api/config?network=${network}`);
      const data = await response.json();

      if (data.success) {
        setGameState((prev) => ({
          ...prev,
          config: data.config,
          currentEpoch: data.config.currentEpoch,
          mint: data.config.allowedMint,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  }, [network]);

  // Fetch epoch and pools together (public data)
  // Pools are created at the same time as epoch changes, so fetch together
  const fetchEpochAndPools = useCallback(async () => {
    try {
      // Fetch epoch and pools in parallel
      const [epochResponse, poolsResponse] = await Promise.all([
        fetch(`/api/epoch?network=${network}`),
        fetch(`/api/pools?network=${network}`),
      ]);

      const [epochData, poolsData] = await Promise.all([
        epochResponse.json(),
        poolsResponse.json(),
      ]);

      // Update both atomically
      setGameState((prev) => {
        const updates: Partial<typeof prev> = {};

        if (epochData.success) {
          updates.currentEpoch = epochData.currentEpoch;
          updates.epochResult = epochData.epochResult;
        }

        if (poolsData.success) {
          updates.pools = poolsData.pools;
        }

        return { ...prev, ...updates };
      });
    } catch (error) {
      console.error('Failed to fetch epoch and pools:', error);
    }
  }, [network]);

  // Fetch user positions (requires wallet)
  const fetchPositions = useCallback(async () => {
    if (!publicKey) {
      setGameState((prev) => ({
        ...prev,
        positions: [],
        tokenBalance: 0,
      }));
      return;
    }

    try {
      const response = await fetch(
        `/api/positions?network=${network}&wallet=${publicKey.toString()}`
      );
      const data = await response.json();

      if (data.success) {
        setGameState((prev) => ({
          ...prev,
          positions: data.positions,
          tokenBalance: data.tokenBalance,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    }
  }, [network, publicKey]);

  // Fetch all data
  const refetch = useCallback(async () => {
    setGameState((prev) => ({ ...prev, isLoading: true }));

    await Promise.all([
      fetchConfig(),
      fetchEpochAndPools(),
      publicKey ? fetchPositions() : Promise.resolve(),
    ]);

    setGameState((prev) => ({
      ...prev,
      isLoading: false,
      lastUpdated: Date.now(),
    }));
  }, [fetchConfig, fetchEpochAndPools, fetchPositions, publicKey]);

  // Initial fetch
  useEffect(() => {
    refetch();
  }, [refetch]);

  // Poll for epoch and pool updates (public data changes frequently as users commit)
  // Fetch together since they're created at the same time
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchEpochAndPools();
    }, pollingInterval);

    return () => clearInterval(intervalId);
  }, [fetchEpochAndPools, pollingInterval]);

  // Refetch positions when wallet changes
  useEffect(() => {
    if (publicKey) {
      fetchPositions();
    }
  }, [publicKey, fetchPositions]);

  const value: GameStateContextType = {
    ...gameState,
    refetch,
    refetchPools: fetchEpochAndPools,
    refetchPositions: fetchPositions,
  };

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within GameStateProvider');
  }
  return context;
}
