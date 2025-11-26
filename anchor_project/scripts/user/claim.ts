import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { AnchorProject } from "../../target/types/anchor_project";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { getNetworkConfig, loadWallet } from "../utils/common";

async function main() {
  const args = process.argv.slice(2);
  const networkConfig = getNetworkConfig(args);
  const poolIdArg = args.find((arg) => arg.startsWith("--pool-id="));
  const epochArg = args.find((arg) => arg.startsWith("--epoch="));

  const poolId = poolIdArg ? parseInt(poolIdArg.split("=")[1]) : undefined;
  const epoch = epochArg ? parseInt(epochArg.split("=")[1]) : undefined;

  if (poolId === undefined || epoch === undefined) {
    throw new Error("Missing required arguments: --pool-id and --epoch");
  }

  console.log(`\n💰 Claiming Rewards from Pool ${poolId}, Epoch ${epoch} on ${networkConfig.cluster}...\n`);

  const connection = new anchor.web3.Connection(networkConfig.rpcUrl, networkConfig.commitment);
  const walletKeypair = loadWallet();
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: networkConfig.commitment });
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorProject as Program<AnchorProject>;

  console.log(`   Program ID: ${program.programId.toString()}`);
  console.log(`   User: ${wallet.publicKey.toString()}`);

  // Load deployment info
  const deploymentPath = path.join(__dirname, "..", "..", "deployments", `deployment-${networkConfig.cluster}.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}. Run: yarn deploy:${networkConfig.cluster}`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
  const mint = new PublicKey(deployment.mint);

  console.log(`   Mint: ${mint.toString()}\n`);

  // Check commitment exists
  const [commitmentPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("commitment"),
      wallet.publicKey.toBuffer(),
      Buffer.from([poolId]),
      new BN(epoch).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  try {
    const commitmentAccount = await program.account.commitment.fetch(commitmentPda);
    console.log(`   Commitment found:`);
    console.log(`   - Pool ID: ${commitmentAccount.poolId}`);
    console.log(`   - Epoch: ${commitmentAccount.epoch.toNumber()}`);
    console.log(`   - Weight: ${commitmentAccount.weight.toNumber()}`);
    console.log(`   - Position Amount: ${commitmentAccount.positionAmount.toNumber()}`);
  } catch (error) {
    throw new Error(`No commitment found for pool ${poolId} in epoch ${epoch}. Did you commit to this pool?`);
  }

  // Check epoch result
  const [epochResultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("epoch_result"), new BN(epoch).toArrayLike(Buffer, "le", 8)],
    program.programId
  );

  try {
    const epochResult = await program.account.epochResult.fetch(epochResultPda);
    console.log(`\n   Epoch Result:`);
    console.log(`   - Winning Pool ID: ${epochResult.winningPoolId}`);
    console.log(`   - Total Weight: ${epochResult.weight.toNumber()}`);
    console.log(`   - Total Position Amount: ${epochResult.totalPositionAmount.toNumber()}`);

    if (epochResult.winningPoolId !== poolId) {
      throw new Error(
        `Pool ${poolId} did not win epoch ${epoch}. Winning pool was ${epochResult.winningPoolId}`
      );
    }

    if (epochResult.weight.toNumber() === 0) {
      throw new Error(`Winning pool had no participants. Rewards were forwarded to next epoch.`);
    }
  } catch (error: any) {
    // Re-throw specific validation errors
    if (error.message?.includes('did not win') || error.message?.includes('no participants')) {
      throw error;
    }
    // Only catch account fetch failures (epoch not resolved)
    throw new Error(`Epoch ${epoch} not resolved yet. Wait for admin to resolve the epoch.`);
  }

  // Get token balance before claim
  const userAta = await getAssociatedTokenAddress(
    mint,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  let balanceBefore = BigInt(0);
  const accountInfo = await connection.getAccountInfo(userAta);
  if (accountInfo) {
    balanceBefore = Buffer.from(accountInfo.data).readBigUInt64LE(64);
    console.log(`\n   Current Balance: ${Number(balanceBefore) / 10 ** 9} tokens`);
  }

  try {
    const tx = await program.methods
      .claim(poolId, new BN(epoch))
      .accountsPartial({
        signer: wallet.publicKey,
        tokenMint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    console.log(`\n   ✅ Rewards claimed successfully!`);
    console.log(`   Transaction: ${tx}`);

    // Get transaction fee
    const txDetails = await connection.getTransaction(tx, {
      maxSupportedTransactionVersion: 0,
    });
    if (txDetails?.meta?.fee) {
      console.log(`   Fee: ${txDetails.meta.fee / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    }

    // Get new balance
    const newAccountInfo = await connection.getAccountInfo(userAta);
    if (newAccountInfo) {
      const balanceAfter = Buffer.from(newAccountInfo.data).readBigUInt64LE(64);
      const reward = balanceAfter - balanceBefore;

      console.log(`\n   Reward Details:`);
      console.log(`   - Reward Received: ${Number(reward) / 10 ** 9} tokens`);
      console.log(`   - New Balance: ${Number(balanceAfter) / 10 ** 9} tokens\n`);
    }
  } catch (error: any) {
    if (error.message?.includes("already claimed")) {
      throw new Error(`Rewards already claimed for pool ${poolId} in epoch ${epoch}`);
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    console.error("\nUsage:");
    console.error("  ts-node scripts/user/claim.ts \\");
    console.error("    --network=localnet \\");
    console.error("    --pool-id=0 \\");
    console.error("    --epoch=1");
    process.exit(1);
  });
