import { clusterApiUrl, PublicKey } from '@solana/web3.js';

export type Network = 'localnet' | 'devnet' | 'testnet' | 'mainnet-beta';

export function getRpcEndpoint(network: Network): string {
  switch (network) {
    case 'localnet':
      return 'http://127.0.0.1:8899';
    case 'devnet':
      return clusterApiUrl('devnet');
    case 'testnet':
      return clusterApiUrl('testnet');
    case 'mainnet-beta':
      return clusterApiUrl('mainnet-beta');
    default:
      return 'http://127.0.0.1:8899';
  }
}

export async function getProgramId(network: Network): Promise<PublicKey> {
  try {
    const deployment = await import(`../deployments/deployment-${network}.json`);
    return new PublicKey(deployment.programId);
  } catch (error) {
    console.error(`Failed to load deployment for ${network}:`, error);
    throw new Error(`No deployment found for ${network}. Please deploy first.`);
  }
}

export const CONFIG_SEED = 'config';
export const TREASURY_SEED = 'treasury';
export const USER_STATE_SEED = 'user_state';
export const POSITION_SEED = 'position';
export const POOL_SEED = 'pool';
export const COMMITMENT_SEED = 'commitment';
export const EPOCH_RESULT_SEED = 'epoch_result';
