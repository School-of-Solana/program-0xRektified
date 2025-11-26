import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { AnchorProject } from "../../target/types/anchor_project";
import { getNetworkConfig, loadWallet } from "../utils/common";

// Default oracle queue from ephemeral-vrf-sdk
const DEFAULT_ORACLE_QUEUE = new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");

async function main() {
  const args = process.argv.slice(2);
  console.log(args);

  const networkConfig = getNetworkConfig(args);
  const winningPoolArg = args.find((arg) => arg.startsWith("--winning-pool="));
  const numPoolsArg = args.find((arg) => arg.startsWith("--num-pools="));

  const winningPoolId = winningPoolArg ? parseInt(winningPoolArg.split("=")[1]) : 0;
  const numPools = numPoolsArg ?  parseInt(numPoolsArg.split("=")[1]) : 1;
  const poolIds = Array.from({ length: numPools }, (_, i) => i);

  console.log(`\n⚖️  Resolving Epoch on ${networkConfig.cluster}...\n`);

  const connection = new anchor.web3.Connection(networkConfig.rpcUrl, networkConfig.commitment);
  const walletKeypair = loadWallet();
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: networkConfig.commitment });
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorProject as Program<AnchorProject>;

  console.log(`   Program ID: ${program.programId.toString()}`);
  console.log(`   Admin: ${wallet.publicKey.toString()}`);

  // Get current epoch
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  const configAccount = await program.account.config.fetch(configPda);
  const currentEpoch = configAccount.currentEpoch.toNumber();

  console.log(`   Current Epoch: ${currentEpoch}`);
  console.log(`   Winning Pool ID: ${winningPoolId}`);
  console.log(`   Number of Pools: ${numPools}`);
  console.log(`   Pool IDs to process: ${poolIds.join(", ")}\n`);

  // Derive epoch result PDA
  const [epochResultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("epoch_result"), configAccount.currentEpoch.toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  // Derive all pool PDAs and check which ones exist
  const poolAccounts = [];
  const existingPools = [];

  for (const id of poolIds) {
    const [poolPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool"),
        Buffer.from([id]),
        configAccount.currentEpoch.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    console.log(`poolPda: ${poolPda}`);
    try {
      await program.account.pool.fetch(poolPda);
      poolAccounts.push({ pubkey: poolPda, isSigner: false, isWritable: true });
      existingPools.push(id);
    } catch (error) {
      console.log(`   ⚠️  Pool ${id} does not exist for epoch ${currentEpoch}, skipping...`);
    }
  }

  if (poolAccounts.length === 0) {
    throw new Error(`No pools found for epoch ${currentEpoch}. Please initialize pools first.`);
  }

  console.log(`   Pools to process: ${existingPools.join(", ")}`);
  console.log(`   Epoch Result PDA: ${epochResultPda.toString()}\n`);

  try {
    const tx = await program.methods
      .resolve(winningPoolId)
      .accountsPartial({
        signer: wallet.publicKey,
        config: configPda,
        epochResult: epochResultPda,
        oracleQueue: DEFAULT_ORACLE_QUEUE,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts(poolAccounts)
      .rpc();

    console.log(`   ✅ Epoch ${currentEpoch} resolved successfully!`);
    console.log(`   Transaction: ${tx}`);

    // Get transaction fee
    const txDetails = await connection.getTransaction(tx, {
      maxSupportedTransactionVersion: 0,
    });
    if (txDetails?.meta?.fee) {
      console.log(`   Fee: ${txDetails.meta.fee / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    }

    const epochResult = await program.account.epochResult.fetch(epochResultPda);
    console.log(`\n   Epoch Result:`);
    console.log(`   - Epoch: ${epochResult.epoch.toNumber()}`);
    console.log(`   - Winning Pool ID: ${epochResult.winningPoolId}`);
    console.log(`   - Total Weight: ${epochResult.weight.toNumber()}`);
    console.log(`   - Total Position Amount: ${epochResult.totalPositionAmount.toNumber()}`);

    const updatedConfig = await program.account.config.fetch(configPda);
    console.log(`\n   New Current Epoch: ${updatedConfig.currentEpoch.toNumber()}`);
    console.log(
      `   Remaining Total Position (forwarded): ${updatedConfig.remainingTotalPosition.toNumber()}\n`
    );

    if (epochResult.weight.toNumber() === 0) {
      console.log(`   ⚠️  Warning: Winning pool had NO participants!`);
      console.log(
        `   Rewards (${epochResult.totalPositionAmount.toNumber()} positions) forwarded to next epoch\n`
      );
    }
  } catch (error: any) {
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    console.error("\nUsage:");
    console.error("  ts-node scripts/admin/resolve.ts \\");
    console.error("    --network=localnet \\");
    console.error("    --winning-pool=0 \\");
    console.error("    --num-pools=3");
    process.exit(1);
  });
