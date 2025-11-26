'use client';

import { useMemo, useState, useEffect } from 'react';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useNetwork } from '@/contexts/NetworkContext';
import { getProgramId } from '@/lib/constants';
import IDL from '@/idl/anchor_project.json';
import type { AnchorProject } from '@/idl/anchor_project';

export function useAnchorProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { network } = useNetwork();
  const [programId, setProgramId] = useState<PublicKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProgramId(network)
      .then(setProgramId)
      .catch((err) => {
        console.error('Failed to load program ID:', err);
        setError(err.message);
        setProgramId(null);
      });
  }, [network]);

  const program = useMemo(() => {
    if (!programId) return null;

    // Create a read-only provider when no wallet is connected
    // This allows fetching account data without requiring wallet connection
    // Disable skipPreflight and set preflightCommitment to reduce RPC calls
    const opts = {
      commitment: 'confirmed' as const,
      skipPreflight: false,
      preflightCommitment: 'confirmed' as const,
    };

    const provider = wallet
      ? new AnchorProvider(connection, wallet, opts)
      : new AnchorProvider(
          connection,
          {
            publicKey: PublicKey.default,
            signTransaction: async () => { throw new Error('Wallet not connected'); },
            signAllTransactions: async () => { throw new Error('Wallet not connected'); },
          },
          opts
        );

    return new Program<AnchorProject>(
      IDL as AnchorProject,
      provider
    );
  }, [connection, wallet, programId]);

  return { program, wallet, connection, network, programId, error };
}
