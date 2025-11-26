'use client';
import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  ReactNode
} from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useNetwork } from '@/contexts/NetworkContext';
import { PublicKey } from '@solana/web3.js';

interface PositionAccount {
  owner: PublicKey;
  userIndex: number;
  globalId: number;
  createdAt: number;
}

interface Position {
  publicKey: PublicKey;
  account: PositionAccount;
}

interface Commitment {
  poolId: number;
  epoch: number;
  claimed: boolean;
  positionId: number;
  weight: number; // Power at time of commitment
}

interface WeightModel {
  timeBased?: Record<string, never>;
}

interface ResolutionType {
  oracle?: Record<string, never>;
}

interface Config {
  admin: PublicKey;
  currentEpoch: number;
  totalPositionsMinted: number;
  positionPrice: number;
  remainingTotalPosition: number;
  allowedMint: PublicKey;
  treasuryAta: PublicKey;
  weightModel: WeightModel;
  resolutionType: ResolutionType;
  weightRateNumerator: number;
  weightRateDenominator: number;
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

interface ProtocolData {
  positions: Position[];
  tokenBalance: number;
  currentEpoch: number;
  epochResult: EpochResult | null;
  previousEpochResult: EpochResult | null;
  pools: any[];
  commitments: Commitment[];
  config: Config | null;
  mint: PublicKey | null;
  isLoading: boolean;
}

interface ProtocolContextType extends ProtocolData {
  refetch: () => Promise<void>;
  updatePositions: (positions: Position[]) => void;
  updateTokenBalance: (balance: number) => void;
  addCommitment: (commitment: Commitment) => void;
  markCommitmentClaimed: (poolId: number, epoch: number) => void;
}

const ProtocolContext = createContext<ProtocolContextType | null>(null);

const STORAGE_KEY = 'twcp_commitments';

export function ProtocolProvider({ children }: { children: ReactNode }) {
  const { publicKey } = useWallet();
  const { network } = useNetwork();

  const [protocolData, setProtocolData] = useState<ProtocolData>({
    positions: [],
    tokenBalance: 0,
    currentEpoch: 0,
    epochResult: null,
    previousEpochResult: null,
    pools: [],
    commitments: [],
    config: null,
    mint: null,
    isLoading: false,
  });

  // Load commitments from localStorage
  useEffect(() => {
    if (!publicKey) return;

    const stored = localStorage.getItem(`${STORAGE_KEY}_${publicKey.toString()}_${network}`);
    if (stored) {
      try {
        const commitments = JSON.parse(stored);

        const migratedCommitments = commitments.map((c: any) => {
          let migrated: Commitment = { ...c };

          if (c.weight !== undefined || c.timestamp !== undefined) {
            console.warn('Migrating very old commitment format (weight/timestamp)', c);
            migrated = {
              poolId: c.poolId,
              epoch: -1, // Unknown epoch
              claimed: c.claimed || false,
              positionId: -1, // Unknown position
              weight: c.weight || 0,
            };
          }
          else if (c.epoch !== undefined && c.positionId === undefined) {
            console.warn('Migrating old commitment without positionId', c);
            migrated = {
              poolId: c.poolId,
              epoch: c.epoch,
              claimed: c.claimed || false,
              positionId: -1, // Mark as legacy
              weight: c.weight || 0,
            };
          }

          return migrated;
        });

        setProtocolData(prev => ({ ...prev, commitments: migratedCommitments }));
      } catch (e) {
        console.error('Failed to parse stored commitments', e);
      }
    }
  }, [publicKey, network]);

  useEffect(() => {
    if (!publicKey) return;

    localStorage.setItem(
      `${STORAGE_KEY}_${publicKey.toString()}_${network}`,
      JSON.stringify(protocolData.commitments)
    );
  }, [publicKey, network, protocolData.commitments]);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch(`/api/config?network=${network}`);
      const data = await response.json();

      if (data.success && data.config) {
        const config: Config = {
          admin: new PublicKey(data.config.admin),
          currentEpoch: data.config.currentEpoch,
          totalPositionsMinted: data.config.totalPositionsMinted,
          positionPrice: data.config.positionPrice,
          remainingTotalPosition: data.config.remainingTotalPosition,
          allowedMint: new PublicKey(data.config.allowedMint),
          treasuryAta: new PublicKey(data.config.treasuryAta),
          weightModel: data.config.weightModel,
          resolutionType: data.config.resolutionType,
          weightRateNumerator: data.config.weightRateNumerator || 0,
          weightRateDenominator: data.config.weightRateDenominator || 0,
        };

        setProtocolData(prev => ({
          ...prev,
          currentEpoch: config.currentEpoch,
          config,
          mint: config.allowedMint,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  }, [network]);

  const fetchCommitments = useCallback(async () => {
    if (!publicKey) return;

    try {
      const response = await fetch(
        `/api/commitments?network=${network}&wallet=${publicKey.toString()}`
      );
      const data = await response.json();

      if (data.success && data.commitments) {
        // Transform blockchain commitments to our format
        const blockchainCommitments: Commitment[] = data.commitments.map((c: any) => ({
          poolId: c.account.poolId,
          epoch: c.account.epoch,
          claimed: false, // We'll check this separately via localStorage
          positionId: -1, // Not stored on-chain after burn
          weight: c.account.weight,
        }));

        // Merge with localStorage to get claimed status
        const stored = localStorage.getItem(`${STORAGE_KEY}_${publicKey.toString()}_${network}`);
        let localCommitments: Commitment[] = [];
        if (stored) {
          try {
            localCommitments = JSON.parse(stored);
          } catch (e) {
            console.error('Failed to parse stored commitments', e);
          }
        }

        // Merge: use blockchain data but preserve claimed status from localStorage
        const mergedCommitments = blockchainCommitments.map(bc => {
          const local = localCommitments.find(lc =>
            lc.poolId === bc.poolId && lc.epoch === bc.epoch
          );
          return {
            ...bc,
            claimed: local?.claimed || false,
          };
        });

        setProtocolData(prev => ({
          ...prev,
          commitments: mergedCommitments,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch commitments:', error);
    }
  }, [network, publicKey]);

  const fetchUserData = useCallback(async () => {
    if (!publicKey) return;

    setProtocolData(prev => ({ ...prev, isLoading: true }));

    try {
      const [positionsResponse] = await Promise.all([
        fetch(`/api/positions?network=${network}&wallet=${publicKey.toString()}`),
        fetchCommitments(),
      ]);

      const positionsData = await positionsResponse.json();

      if (positionsData.success) {
        const positions: Position[] = positionsData.positions.map((pos: any) => ({
          publicKey: new PublicKey(pos.publicKey),
          account: {
            owner: new PublicKey(pos.account.owner),
            userIndex: pos.account.userIndex,
            globalId: pos.account.globalId,
            createdAt: pos.account.createdAt,
          },
        }));

        setProtocolData(prev => ({
          ...prev,
          positions,
          tokenBalance: positionsData.tokenBalance,
          isLoading: false,
        }));
      } else {
        setProtocolData(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      setProtocolData(prev => ({ ...prev, isLoading: false }));
    }
  }, [network, publicKey, fetchCommitments]);

  const fetchEpochAndPools = useCallback(async () => {
    try {
      const [epochResponse, poolsResponse] = await Promise.all([
        fetch(`/api/epoch?network=${network}`),
        fetch(`/api/pools?network=${network}`),
      ]);

      const [epochData, poolsData] = await Promise.all([
        epochResponse.json(),
        poolsResponse.json(),
      ]);

      // If current epoch > 0, also fetch previous epoch result
      let previousEpochData = null;
      if (epochData.success && epochData.currentEpoch > 0) {
        try {
          const prevEpochResponse = await fetch(`/api/epoch?network=${network}&epoch=${epochData.currentEpoch - 1}`);
          const prevData = await prevEpochResponse.json();
          if (prevData.success) {
            previousEpochData = prevData.epochResult;
          }
        } catch (error) {
          // Previous epoch result might not exist yet
          console.log('Previous epoch result not found');
        }
      }

      setProtocolData(prev => {
        const updates: Partial<typeof prev> = {};

        if (epochData.success) {
          updates.currentEpoch = epochData.currentEpoch;
          updates.epochResult = epochData.epochResult || null;
          updates.previousEpochResult = previousEpochData || null;
        }

        if (poolsData.success) {
          updates.pools = poolsData.pools.map((pool: any) => ({
            publicKey: new PublicKey(pool.publicKey),
            account: {
              epoch: pool.account.epoch,
              poolId: pool.account.poolId,
              totalWeight: pool.account.totalWeight,
              totalPositions: pool.account.totalPositions,
            },
          }));
        }

        return { ...prev, ...updates };
      });
    } catch (error: any) {
      if (!error.message?.includes('429')) {
        console.error('Failed to fetch epoch and pools:', error);
      }
    }
  }, [network]);

  const fetchAllData = useCallback(async () => {
    await Promise.all([
      fetchConfig(),
      publicKey ? fetchUserData() : Promise.resolve(),
      fetchEpochAndPools(),
    ]);
  }, [fetchConfig, fetchUserData, fetchEpochAndPools, publicKey]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (publicKey) {
      fetchUserData();
    }
  }, [publicKey, fetchUserData]);

  useEffect(() => {
    fetchEpochAndPools();
    const intervalId = setInterval(fetchEpochAndPools, 5000);

    return () => clearInterval(intervalId);
  }, [fetchEpochAndPools]);

  // Refetch commitments when epoch changes (to get previous epoch rewards)
  useEffect(() => {
    if (publicKey && protocolData.currentEpoch > 0) {
      fetchCommitments();
    }
  }, [protocolData.currentEpoch, publicKey, fetchCommitments]);

  const updatePositions = useCallback((positions: Position[]) => {
    setProtocolData(prev => ({ ...prev, positions }));
  }, []);

  const updateTokenBalance = useCallback((balance: number) => {
    setProtocolData(prev => ({ ...prev, tokenBalance: balance }));
  }, []);

  const addCommitment = useCallback((commitment: Commitment) => {
    setProtocolData(prev => {
      const exists = prev.commitments.some(c =>
        c.poolId === commitment.poolId &&
        c.epoch === commitment.epoch &&
        c.positionId === commitment.positionId
      );
      if (exists) {
        console.log('Commitment already exists, skipping duplicate:', commitment);
        return prev;
      }

      return {
        ...prev,
        commitments: [...prev.commitments, commitment],
      };
    });
  }, []);

  const markCommitmentClaimed = useCallback((poolId: number, epoch: number) => {
    setProtocolData(prev => ({
      ...prev,
      commitments: prev.commitments.map(c =>
        c.poolId === poolId && c.epoch === epoch ? { ...c, claimed: true } : c
      ),
    }));
  }, []);

  const value: ProtocolContextType = {
    ...protocolData,
    refetch: fetchAllData,
    updatePositions,
    updateTokenBalance,
    addCommitment,
    markCommitmentClaimed,
  };

  return (
    <ProtocolContext.Provider value={value}>
      {children}
    </ProtocolContext.Provider>
  );
}

export function useProtocol() {
  const context = useContext(ProtocolContext);
  if (!context) {
    throw new Error('useProtocol must be used within ProtocolProvider');
  }
  return context;
}
