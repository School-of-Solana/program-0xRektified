'use client';

import { useMemo, useState, useEffect } from 'react';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useNetwork } from '@/contexts/NetworkContext';
import { getProgramId } from '@/lib/constants';
import IDL from '@/idl/faucet.json';
import type { Faucet } from '@/idl/faucet';

export function useFaucetProgram() {
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
    const provider = wallet
      ? new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
      : new AnchorProvider(
          connection,
          {
            publicKey: PublicKey.default,
            signTransaction: async () => { throw new Error('Wallet not connected'); },
            signAllTransactions: async () => { throw new Error('Wallet not connected'); },
          },
          { commitment: 'confirmed' }
        );

    return new Program<Faucet>(
      IDL as Faucet,
      provider
    );
  }, [connection, wallet, programId]);

  return { program, wallet, connection, network, programId, error };
}
