import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { AnchorProject } from "../../target/types/anchor_project";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { getNetworkConfig, loadWallet } from "../utils/common";

async function main() {
  const args = process.argv.slice(2);
  const networkConfig = getNetworkConfig(args);

  console.log(`\n🎫 Minting Position on ${networkConfig.cluster}...\n`);

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

  // Get config
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  const configAccount = await program.account.config.fetch(configPda);
  const positionPrice = configAccount.positionPrice.toNumber();

  console.log(`   Mint: ${mint.toString()}`);
  console.log(`   Position Price: ${positionPrice / 10 ** 9} tokens\n`);

  // Check token balance
  const userAta = await getAssociatedTokenAddress(
    mint,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const accountInfo = await connection.getAccountInfo(userAta);
  if (!accountInfo) {
    throw new Error(`No token account found. User needs ${positionPrice / 10 ** 9} tokens to mint a position.`);
  }

  const balance = Buffer.from(accountInfo.data).readBigUInt64LE(64);
  console.log(`   Current Balance: ${Number(balance) / 10 ** 9} tokens`);

  if (Number(balance) < positionPrice) {
    throw new Error(
      `Insufficient balance. Need ${positionPrice / 10 ** 9} tokens, have ${Number(balance) / 10 ** 9} tokens`
    );
  }

  // Get user's position count from user_state account
  const [userStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user_state"), wallet.publicKey.toBuffer()],
    program.programId
  );

  let positionId = 0;
  try {
    const userStateAccount = await program.account.userState.fetch(userStatePda);
    positionId = userStateAccount.positionCount.toNumber();
  } catch (error) {
    // User state doesn't exist yet, this is the first position (ID = 0)
    positionId = 0;
  }

  console.log(`   Next Position ID: ${positionId}\n`);

  // Derive position PDA using the position count from user_state
  const [positionPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("position"),
      wallet.publicKey.toBuffer(),
      new anchor.BN(positionId).toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  console.log(`   Position PDA: ${positionPda.toString()}\n`);

  try {
    const tx = await program.methods
      .mintPosition()
      .accountsPartial({
        signer: wallet.publicKey,
        position: positionPda,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    console.log(`\n   ✅ Position minted successfully!`);
    console.log(`   Transaction: ${tx}`);

    // Get transaction fee
    const txDetails = await connection.getTransaction(tx, {
      maxSupportedTransactionVersion: 0,
    });
    if (txDetails?.meta?.fee) {
      console.log(`   Fee: ${txDetails.meta.fee / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    }

    const positionAccount = await program.account.positionAccount.fetch(positionPda);
    console.log(`\n   Position Details:`);
    console.log(`   - User Index: ${positionAccount.userIndex.toNumber()}`);
    console.log(`   - Global ID: ${positionAccount.globalId.toNumber()}`);
    console.log(`   - Created At: ${positionAccount.createdAt.toNumber()}`);
    console.log(`   - Owner: ${positionAccount.owner.toString()}`);

    // Check new balance
    const newAccountInfo = await connection.getAccountInfo(userAta);
    const newBalance = Buffer.from(newAccountInfo!.data).readBigUInt64LE(64);
    console.log(`\n   New Balance: ${Number(newBalance) / 10 ** 9} tokens`);
    console.log(`   Spent: ${positionPrice / 10 ** 9} tokens\n`);
  } catch (error: any) {
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });
