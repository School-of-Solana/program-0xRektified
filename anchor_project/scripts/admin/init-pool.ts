import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { AnchorProject } from "../../target/types/anchor_project";
import { getNetworkConfig, loadWallet } from "../utils/common";

async function main() {
  const args = process.argv.slice(2);
  const networkConfig = getNetworkConfig(args);
  const numPoolsArg = args.find((arg) => arg.startsWith("--num-pools="));

  if (!numPoolsArg) {
    throw new Error("Missing required parameter: --num-pools=<NUMBER>");
  }

  const poolNbr = parseInt(numPoolsArg.split("=")[1]);

  if (isNaN(poolNbr) || poolNbr < 1 || poolNbr > 10) {
    throw new Error("--num-pools must be a number between 1 and 10");
  }

  console.log(`\n🏊 Initializing ${poolNbr} pool(s) on ${networkConfig.cluster}...\n`);

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

  console.log(`   Current Epoch: ${currentEpoch}\n`);

  const poolPdaList = [];
  for (let i=0; i < poolNbr; i++){
    // Derive pool PDA
    const [poolPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool"),
        Buffer.from([i]),
        configAccount.currentEpoch.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    poolPdaList.push(poolPda);
    console.log(`   Pool PDA: ${poolPda.toString()}`);
  }


  try {
    const tx = await program.methods
      .initializePool(poolNbr)
      .accountsPartial({
        signer: wallet.publicKey,
      })
      .remainingAccounts(
        poolPdaList.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: true,
        }))
      )
      .rpc();

    console.log(`\n   ✅  ${poolNbr} pool(s) initialized successfully!`);
    console.log(`   Transaction: ${tx}`);

    // Get transaction fee
    const txDetails = await connection.getTransaction(tx, {
      maxSupportedTransactionVersion: 0,
    });
    if (txDetails?.meta?.fee) {
      console.log(`   Fee: ${txDetails.meta.fee / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    }

    for (const poolPda of poolPdaList){
      const poolAccount = await program.account.pool.fetch(poolPda);
      console.log(`\n   Pool Details:`);
      console.log(`   - ID: ${poolAccount.id}`);
      console.log(`   - Epoch: ${poolAccount.epoch.toNumber()}`);
      console.log(`   - Total Positions: ${poolAccount.totalPositions.toNumber()}`);
      console.log(`   - Total Weight: ${poolAccount.totalWeight.toNumber()}\n`);
    }

   } catch (error: any) {
     console.log("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  });
