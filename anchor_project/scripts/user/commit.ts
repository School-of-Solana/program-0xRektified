import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { AnchorProject } from "../../target/types/anchor_project";
import { getNetworkConfig, loadWallet } from "../utils/common";

async function main() {
  const args = process.argv.slice(2);
  const networkConfig = getNetworkConfig(args);
  const positionIdArg = args.find((arg) => arg.startsWith("--position-id="));
  const poolIdArg = args.find((arg) => arg.startsWith("--pool-id="));

  const positionId = positionIdArg ? parseInt(positionIdArg.split("=")[1]) : undefined;
  const poolId = poolIdArg ? parseInt(poolIdArg.split("=")[1]) : undefined;

  if (positionId === undefined || poolId === undefined) {
    throw new Error("Missing required arguments: --position-id and --pool-id");
  }

  console.log(`\n🎯 Committing Position ${positionId} to Pool ${poolId} on ${networkConfig.cluster}...\n`);

  const connection = new anchor.web3.Connection(networkConfig.rpcUrl, networkConfig.commitment);
  const walletKeypair = loadWallet();
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: networkConfig.commitment });
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorProject as Program<AnchorProject>;

  console.log(`   Program ID: ${program.programId.toString()}`);
  console.log(`   User: ${wallet.publicKey.toString()}`);

  // Get config and current epoch
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  const configAccount = await program.account.config.fetch(configPda);
  const currentEpoch = configAccount.currentEpoch.toNumber();

  console.log(`   Current Epoch: ${currentEpoch}\n`);

  // Derive position PDA
  const [positionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("position"),
      wallet.publicKey.toBuffer(),
      new BN(positionId).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  // Check position exists
  const positionAccount = await program.account.positionAccount.fetch(positionPda);
  console.log(`   Position found:`);
  console.log(`   - User Index: ${positionAccount.userIndex.toNumber()}`);
  console.log(`   - Global ID: ${positionAccount.globalId.toNumber()}`);
  console.log(`   - Created At: ${positionAccount.createdAt.toNumber()}`);

  // Derive pool PDA
  const [poolPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool"),
      Buffer.from([poolId]),
      configAccount.currentEpoch.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  // Check pool exists
  try {
    const poolAccount = await program.account.pool.fetch(poolPda);
    console.log(`\n   Pool found:`);
    console.log(`   - ID: ${poolAccount.id}`);
    console.log(`   - Epoch: ${poolAccount.epoch.toNumber()}`);
    console.log(`   - Total Positions: ${poolAccount.totalPositions.toNumber()}`);
    console.log(`   - Total Weight: ${poolAccount.totalWeight.toNumber()}`);
  } catch (error) {
    throw new Error(`Pool ${poolId} not found for epoch ${currentEpoch}. Admin must initialize it first.`);
  }

  // Derive commitment PDA
  const [commitmentPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("commitment"),
      wallet.publicKey.toBuffer(),
      Buffer.from([poolId]),
      configAccount.currentEpoch.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  console.log(`\n   Commitment PDA: ${commitmentPda.toString()}`);

  try {
    const tx = await program.methods
      .commit(new BN(positionId), poolId)
      .accountsPartial({
        signer: wallet.publicKey,
        position: positionPda,
        commitment: commitmentPda,
      })
      .rpc();

    console.log(`\n   ✅ Position committed successfully!`);
    console.log(`   Transaction: ${tx}`);

    // Get transaction fee
    const txDetails = await connection.getTransaction(tx, {
      maxSupportedTransactionVersion: 0,
    });
    if (txDetails?.meta?.fee) {
      console.log(`   Fee: ${txDetails.meta.fee / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    }

    const commitmentAccount = await program.account.commitment.fetch(commitmentPda);
    console.log(`\n   Commitment Details:`);
    console.log(`   - User: ${commitmentAccount.userPk.toString()}`);
    console.log(`   - Pool ID: ${commitmentAccount.poolId}`);
    console.log(`   - Epoch: ${commitmentAccount.epoch.toNumber()}`);
    console.log(`   - Weight: ${commitmentAccount.weight.toNumber()}`);
    console.log(`   - Position Amount: ${commitmentAccount.positionAmount.toNumber()}`);

    console.log(`\n   ℹ️  Position has been burned. Weight is calculated based on time held.`);
    console.log(`   ℹ️  Wait for admin to resolve the epoch, then claim your rewards!\n`);
  } catch (error: any) {
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    console.error("\nUsage:");
    console.error("  ts-node scripts/user/commit.ts \\");
    console.error("    --network=localnet \\");
    console.error("    --position-id=0 \\");
    console.error("    --pool-id=0");
    process.exit(1);
  });
