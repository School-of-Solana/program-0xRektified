import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import IDL from '@/idl/anchor_project.json';
import type { AnchorProject } from '@/idl/anchor_project';

export type Network = 'localnet' | 'devnet' | 'testnet' | 'mainnet-beta';

// Server-side RPC URLs with private Helius endpoint for devnet
function getRpcUrl(network: Network): string {
  switch (network) {
    case 'localnet':
      return 'http://127.0.0.1:8899';
    case 'devnet':
      // Use Helius RPC from environment variable (private API key)
      return process.env.HELIUS_RPC_URL || 'https://api.devnet.solana.com';
    case 'testnet':
      return 'https://api.testnet.solana.com';
    case 'mainnet-beta':
      return process.env.MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com';
    default:
      return 'http://127.0.0.1:8899';
  }
}

// Get program ID from deployment files
async function getProgramId(network: Network): Promise<PublicKey> {
  try {
    const deployment = await import(`@/deployments/deployment-${network}.json`);
    return new PublicKey(deployment.programId);
  } catch (error) {
    throw new Error(`No deployment found for ${network}. Please deploy first.`);
  }
}

// Cached connections and programs to avoid recreating them on every request
const connectionCache = new Map<string, Connection>();
const programCache = new Map<string, Program<AnchorProject>>();

// Get or create a cached connection for a network
export function getConnection(network: Network): Connection {
  const rpcUrl = getRpcUrl(network);

  if (!connectionCache.has(rpcUrl)) {
    connectionCache.set(
      rpcUrl,
      new Connection(rpcUrl, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      })
    );
  }

  return connectionCache.get(rpcUrl)!;
}

// Get or create a cached program instance for a network
export async function getProgram(network: Network): Promise<Program<AnchorProject>> {
  const cacheKey = network;

  if (!programCache.has(cacheKey)) {
    const connection = getConnection(network);
    const programId = await getProgramId(network);

    // Create a read-only provider (no wallet needed for server-side reads)
    const provider = new AnchorProvider(
      connection,
      {
        publicKey: PublicKey.default,
        signTransaction: async () => { throw new Error('Not supported'); },
        signAllTransactions: async () => { throw new Error('Not supported'); },
      },
      {
        commitment: 'confirmed',
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      }
    );

    const program = new Program<AnchorProject>(
      IDL as AnchorProject,
      provider
    );

    programCache.set(cacheKey, program);
  }

  return programCache.get(cacheKey)!;
}

// Helper to get network from query params or default to devnet
export function getNetworkFromRequest(searchParams: URLSearchParams): Network {
  const network = searchParams.get('network') as Network | null;

  if (network && ['localnet', 'devnet', 'testnet', 'mainnet-beta'].includes(network)) {
    return network;
  }

  return 'devnet'; // default
}

// PDA helper functions (same as client-side constants)
export const CONFIG_SEED = 'config';
export const TREASURY_SEED = 'treasury';
export const USER_STATE_SEED = 'user_state';
export const POSITION_SEED = 'position';
export const POOL_SEED = 'pool';
export const COMMITMENT_SEED = 'commitment';
export const EPOCH_RESULT_SEED = 'epoch_result';

export function getConfigPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    programId
  );
  return pda;
}

export function getPoolPda(programId: PublicKey, epoch: number, poolId: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(POOL_SEED),
      Buffer.from(new Uint8Array(new BigUint64Array([BigInt(epoch)]).buffer)),
      Buffer.from([poolId])
    ],
    programId
  );
  return pda;
}

export function getEpochResultPda(programId: PublicKey, epoch: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from(EPOCH_RESULT_SEED),
      Buffer.from(new Uint8Array(new BigUint64Array([BigInt(epoch)]).buffer))
    ],
    programId
  );
  return pda;
}
