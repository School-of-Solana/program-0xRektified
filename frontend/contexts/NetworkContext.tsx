'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Network } from '@/lib/constants';

interface NetworkContextType {
  network: Network;
  setNetwork: (network: Network) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [network, setNetworkState] = useState<Network>('devnet');

  useEffect(() => {
    const stored = localStorage.getItem('solana-network') as Network | null;
    if (stored && ['localnet', 'devnet' /*, 'testnet', 'mainnet-beta' */].includes(stored)) {
      setNetworkState(stored);
    }
  }, []);
  const setNetwork = (newNetwork: Network) => {
    setNetworkState(newNetwork);
    localStorage.setItem('solana-network', newNetwork);
  };

  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}
