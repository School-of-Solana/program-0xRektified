import { PublicKey } from '@solana/web3.js';
import {
  CONFIG_SEED,
  TREASURY_SEED,
  USER_STATE_SEED,
  POSITION_SEED,
  POOL_SEED,
  COMMITMENT_SEED,
  EPOCH_RESULT_SEED,
} from './constants';

/**
 * Derives the Config PDA
 */
export function getConfigPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    programId
  );
}

/**
 * Derives the Treasury PDA
 */
export function getTreasuryPda(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TREASURY_SEED)],
    programId
  );
}

/**
 * Derives the UserState PDA
 */
export function getUserStatePda(
  userPubkey: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(USER_STATE_SEED), userPubkey.toBuffer()],
    programId
  );
}

/**
 * Derives the Position PDA
 */
export function getPositionPda(
  userPubkey: PublicKey,
  positionId: number,
  programId: PublicKey
): [PublicKey, number] {
  const positionIdBuffer = new Uint8Array(8);
  const view = new DataView(positionIdBuffer.buffer);
  view.setBigUint64(0, BigInt(positionId), true); // true = little endian

  return PublicKey.findProgramAddressSync(
    [Buffer.from(POSITION_SEED), userPubkey.toBuffer(), Buffer.from(positionIdBuffer)],
    programId
  );
}

/**
 * Derives the Pool PDA
 */
export function getPoolPda(
  poolId: number,
  epoch: number,
  programId: PublicKey
): [PublicKey, number] {
  const poolIdBuffer = new Uint8Array([poolId]);
  const epochBuffer = new Uint8Array(8);
  const view = new DataView(epochBuffer.buffer);
  view.setBigUint64(0, BigInt(epoch), true); // true = little endian

  return PublicKey.findProgramAddressSync(
    [Buffer.from(POOL_SEED), Buffer.from(poolIdBuffer), Buffer.from(epochBuffer)],
    programId
  );
}

/**
 * Derives the Commitment PDA
 */
export function getCommitmentPda(
  userPubkey: PublicKey,
  poolId: number,
  epoch: number,
  programId: PublicKey
): [PublicKey, number] {
  const poolIdBuffer = new Uint8Array([poolId]);
  const epochBuffer = new Uint8Array(8);
  const view = new DataView(epochBuffer.buffer);
  view.setBigUint64(0, BigInt(epoch), true); // true = little endian

  return PublicKey.findProgramAddressSync(
    [Buffer.from(COMMITMENT_SEED), userPubkey.toBuffer(), Buffer.from(poolIdBuffer), Buffer.from(epochBuffer)],
    programId
  );
}

/**
 * Derives the EpochResult PDA
 */
export function getEpochResultPda(
  epoch: number,
  programId: PublicKey
): [PublicKey, number] {
  const epochBuffer = new Uint8Array(8);
  const view = new DataView(epochBuffer.buffer);
  view.setBigUint64(0, BigInt(epoch), true); // true = little endian

  return PublicKey.findProgramAddressSync(
    [Buffer.from(EPOCH_RESULT_SEED), Buffer.from(epochBuffer)],
    programId
  );
}
