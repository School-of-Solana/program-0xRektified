'use client';

import { useNetwork } from '@/contexts/NetworkContext';
import { Network } from '@/lib/constants';

export function NetworkSwitcher() {
  const { network, setNetwork } = useNetwork();

  const networks: { value: Network; label: string }[] = [
    { value: 'localnet', label: 'Localnet' },
    { value: 'devnet', label: 'Devnet' },
    // { value: 'testnet', label: 'Testnet' },
    // { value: 'mainnet-beta', label: 'Mainnet' },
  ];

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="network-select" className="text-sm font-medium">
        Network:
      </label>
      <select
        id="network-select"
        value={network}
        onChange={(e) => setNetwork(e.target.value as Network)}
        className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {networks.map((net) => (
          <option key={net.value} value={net.value}>
            {net.label}
          </option>
        ))}
      </select>
    </div>
  );
}
