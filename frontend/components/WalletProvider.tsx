'use client';

import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { NetworkProvider, useNetwork } from '@/contexts/NetworkContext';
import { getRpcEndpoint } from '@/lib/constants';
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProviderProps {
  children: ReactNode;
}

function WalletProviderInner({ children }: WalletProviderProps) {
  const { network } = useNetwork();

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  const endpoint = useMemo(() => getRpcEndpoint(network), [network]);

  return (
    <ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed', disableRetryOnRateLimit: true }}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

import { ProtocolProvider } from '@/contexts/ProtocolContext';

export const WalletProvider: FC<WalletProviderProps> = ({ children }) => {
  return (
    <NetworkProvider>
      <WalletProviderInner>
        <ProtocolProvider>
          {children}
        </ProtocolProvider>
      </WalletProviderInner>
    </NetworkProvider>
  );
};
