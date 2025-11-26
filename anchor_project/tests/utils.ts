import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorProject } from "../target/types/anchor_project";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  MINT_SIZE,
} from "@solana/spl-token";
import { Keypair, SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { LiteSVM } from "litesvm";

// VRF Program ID from ephemeral-vrf-sdk
export const VRF_PROGRAM_ID = new PublicKey("Vrf1RNUjXmQGjmQrQLvJHs9SNkvDJEsRVFPkfSQUwGz");
// Default oracle queue from ephemeral-vrf-sdk
export const DEFAULT_ORACLE_QUEUE = new PublicKey("4qqRrJnj4FmFSRCXPn9PZ4t4rLRKjPeFLpDsCScqfqKH");

export const EPOCH_DURATION = 60;

// Weight rate configuration for tests
// Default: 1 weight per 1 second (simple for testing)
export const WEIGHT_RATE_NUMERATOR = 1;
export const WEIGHT_RATE_DENOMINATOR = 1;

import {
  createAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  
} from "@solana/spl-token";

export function getProgram() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  return anchor.workspace.anchorProject as Program<AnchorProject>;
}

export function getProvider() {
  return anchor.AnchorProvider.env();
}

export function findConfigPda(programId: anchor.web3.PublicKey) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
}

export function findTreasuryPda(programId: anchor.web3.PublicKey) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("treasury")],
    programId
  );
}

export async function findAccountAta(
  connection: anchor.web3.Connection,
  mint: anchor.web3.PublicKey,
  userKp: anchor.web3.Keypair
) {
  return createAssociatedTokenAccount(
        connection,
        userKp,
        mint,
        userKp.publicKey,
        undefined,
        TOKEN_PROGRAM_ID
      );
}

export async function findUserAta(
  mint: anchor.web3.PublicKey,
  user: anchor.web3.PublicKey,
  tokenProgramId: anchor.web3.PublicKey = TOKEN_2022_PROGRAM_ID
): Promise<anchor.web3.PublicKey> {
  return getAssociatedTokenAddress(
    mint,
    user,
    false,
    tokenProgramId,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

export function findUserStatePda(
  userPubkey: anchor.web3.PublicKey,
  programId: anchor.web3.PublicKey
) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user_state"), userPubkey.toBuffer()],
    programId
  );
}

export function findPositionPda(
  userPubkey: anchor.web3.PublicKey,
  userIndex: number,
  programId: anchor.web3.PublicKey
) {
  const indexBuffer = Buffer.alloc(8);
  indexBuffer.writeBigUInt64LE(BigInt(userIndex));
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("position"), userPubkey.toBuffer(), indexBuffer],
    programId
  );
}

export function findPoolPda(
  poolId: number,
  epoch: number,
  programId: anchor.web3.PublicKey
) {
  const poolIdBuffer = Buffer.alloc(1);
  poolIdBuffer.writeUInt8(poolId);
  const epochBuffer = Buffer.alloc(8);
  epochBuffer.writeBigUInt64LE(BigInt(epoch));
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), poolIdBuffer, epochBuffer],
    programId
  );
}

export function findCommitmentPda(
  user: anchor.web3.PublicKey,
  poolId: number,
  epoch: number,
  programId: anchor.web3.PublicKey
) {
  const poolIdBuffer = Buffer.alloc(1);
  poolIdBuffer.writeUInt8(poolId);
  const epochBuffer = Buffer.alloc(8);
  epochBuffer.writeBigUInt64LE(BigInt(epoch));
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("commitment"), user.toBuffer(), poolIdBuffer, epochBuffer],
    programId
  );
}

export function findEpochResultPda(
  epoch: number,
  programId: anchor.web3.PublicKey
) {
  const epochBuffer = Buffer.alloc(8);
  epochBuffer.writeBigUInt64LE(BigInt(epoch));
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("epoch_result"), epochBuffer],
    programId
  );
}

export async function airdrop(
  connection: anchor.web3.Connection,
  address: anchor.web3.PublicKey,
  amount: number = 10 * anchor.web3.LAMPORTS_PER_SOL
) {
  const signature = await connection.requestAirdrop(address, amount);
  await connection.confirmTransaction(signature);
}

/**
 * Creates a Token-2022 mint, mints 1B tokens, and transfers them to the specified address
 * Works with LiteSVM for testing
 */
/**
 * Get the current position count for a user
 */
export function getUserPositionCount(
  svm: LiteSVM,
  userPubkey: anchor.web3.PublicKey,
  programId: anchor.web3.PublicKey,
  program: anchor.Program<any>
): number {
  const [userStatePda] = findUserStatePda(userPubkey, programId);
  const userStateInfo = svm.getAccount(userStatePda);

  if (!userStateInfo) {
    return 0; // User hasn't minted any positions yet
  }

  const userState = program.coder.accounts.decode(
    "userState",
    Buffer.from(userStateInfo.data)
  );

  return userState.positionCount.toNumber();
}

/**
 * Creates a Token-2022 mint, mints 1B tokens, and transfers them to the specified address
 * Works with LiteSVM for testing
 */
export async function createAndMintToken2022(
  svm: LiteSVM,
  payer: Keypair,
  recipient: anchor.web3.PublicKey,
  decimals: number = 9
): Promise<{ mint: anchor.web3.PublicKey; recipientAta: anchor.web3.PublicKey }> {
  const mintKp = Keypair.generate();
  const LAMPORTS_FOR_MINT = 1_000_000_000;

  const createMintAccountIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mintKp.publicKey,
    lamports: LAMPORTS_FOR_MINT,
    space: MINT_SIZE,
    programId: TOKEN_2022_PROGRAM_ID,
  });

  const initMintIx = createInitializeMintInstruction(
    mintKp.publicKey,
    decimals,
    payer.publicKey,
    null,
    TOKEN_2022_PROGRAM_ID
  );

  const mintTx = new Transaction().add(createMintAccountIx, initMintIx);
  mintTx.recentBlockhash = svm.latestBlockhash();
  mintTx.feePayer = payer.publicKey;
  mintTx.sign(payer, mintKp);
  svm.sendTransaction(mintTx);

  const recipientAta = await getAssociatedTokenAddress(
    mintKp.publicKey,
    recipient,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const createAtaIx = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    recipientAta,
    recipient,
    mintKp.publicKey,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const ataTx = new Transaction().add(createAtaIx);
  ataTx.recentBlockhash = svm.latestBlockhash();
  ataTx.feePayer = payer.publicKey;
  ataTx.sign(payer);
  svm.sendTransaction(ataTx);

  const mintAmount = BigInt(1_000_000_000) * BigInt(10 ** decimals);

  const mintToIx = createMintToInstruction(
    mintKp.publicKey,
    recipientAta,
    payer.publicKey,
    mintAmount,
    [],
    TOKEN_2022_PROGRAM_ID
  );

  const mintToTx = new Transaction().add(mintToIx);
  mintToTx.recentBlockhash = svm.latestBlockhash();
  mintToTx.feePayer = payer.publicKey;
  mintToTx.sign(payer);
  svm.sendTransaction(mintToTx);

  return {
    mint: mintKp.publicKey,
    recipientAta,
  };
}

/**
 * Logs transaction result from LiteSVM for debugging
 * Handles both successful and failed transactions
 */
export function logSvmResult(txName: String , result: any): void {
  if (!result.err){
    console.log('No error')
    return;
  }
  console.log("Result constructor:", result.constructor.name);
  if (typeof result.err === 'function') {
    // Failed transaction
    const err = result.err();
    console.log("Error:", err);
    const meta = result.meta();
    const logs = meta.logs();
    console.log("Logs:", logs);
  } else {
    // Successful transaction
    console.log("Transaction succeeded!");
    const meta = result.meta();
    const logs = meta.logs();
    console.log("Logs:", logs);
  }
}

/**
 * Sets up mock accounts for VRF program in LiteSVM
 * Required when using the #[vrf] macro from ephemeral-vrf-sdk
 */
export function setupVrfMock(svm: LiteSVM): void {
  // Mock VRF program as executable (required by #[vrf] macro)
  // Use NativeLoader for simpler mocking in litesvm
  svm.setAccount(VRF_PROGRAM_ID, {
    lamports: LAMPORTS_PER_SOL,
    data: Buffer.alloc(36), // Minimal program data
    owner: new PublicKey("NativeLoader1111111111111111111111111111111"),
    executable: true,
  });

  // Mock oracle queue account
  svm.setAccount(DEFAULT_ORACLE_QUEUE, {
    lamports: LAMPORTS_PER_SOL,
    data: Buffer.alloc(100), // Dummy data
    owner: VRF_PROGRAM_ID,
    executable: false,
  });
}
