import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Faucet } from "../target/types/faucet";
import { TOKEN_2022_PROGRAM_ID, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getNetworkConfig, loadWallet } from "./utils/common";

async function main() {
  const args = process.argv.slice(2);
  const networkConfig = getNetworkConfig(args);

  console.log(`\nClaiming tokens from Faucet on ${networkConfig.cluster}...\n`);

  const connection = new anchor.web3.Connection(networkConfig.rpcUrl, networkConfig.commitment);

  const walletKeypair = loadWallet();
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: networkConfig.commitment,
  });
  anchor.setProvider(provider);

  const program = anchor.workspace.Faucet as Program<Faucet>;

  console.log(`Program ID: ${program.programId.toString()}`);
  console.log(`User: ${wallet.publicKey.toString()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL\n`);

  const [mintAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint_authority")],
    program.programId
  );

  const [mint] = PublicKey.findProgramAddressSync(
    [Buffer.from("mint"), mintAuthority.toBuffer()],
    program.programId
  );

  console.log(`Mint: ${mint.toString()}\n`);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  const configAccount = await program.account.config.fetch(configPda);
  const claimAmount = configAccount.claimAmount.toNumber();

  console.log(`Claim amount: ${claimAmount / 1e9} tokens (${claimAmount} raw)\n`);

  // Use Token-2022 program for ATA address calculation
  const userAta = getAssociatedTokenAddressSync(
    mint,
    wallet.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  console.log(`User ATA: ${userAta.toString()}\n`);

  // Check balance before claiming
  let balanceBefore = 0;
  try {
    const tokenAccountBefore = await getAccount(
      connection,
      userAta,
      networkConfig.commitment,
      TOKEN_2022_PROGRAM_ID
    );
    balanceBefore = Number(tokenAccountBefore.amount);
    console.log(`Balance before: ${balanceBefore / 1e9} tokens\n`);
  } catch (error: any) {
    console.log(`Balance before: 0 tokens (ATA doesn't exist yet)`);
    console.log(`Error: ${error.message}\n`);
  }

  console.log("Claiming tokens...");

  try {
    const tx = await program.methods
      .claim()
      .accounts({
        signer: wallet.publicKey,
      })
      .rpc();

    console.log(`Transaction: ${tx}`);
    console.log(`✅ Claim successful!\n`);

    // Wait for confirmation
    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const tokenAccount = await getAccount(
        connection,
        userAta,
        networkConfig.commitment,
        TOKEN_2022_PROGRAM_ID
      );

      const balanceAfter = Number(tokenAccount.amount);
      console.log(`Token Account: ${userAta.toString()}`);
      console.log(`Balance after: ${balanceAfter / 1e9} tokens`);
      console.log(`Claimed: ${(balanceAfter - balanceBefore) / 1e9} tokens\n`);
    } catch (error: any) {
      console.log(`⚠️  Could not fetch balance after claim`);
      console.log(`Token account: ${userAta.toString()}`);
      console.log(`Error: ${error.message}\n`);
    }
  } catch (error: any) {
    console.error("Claim failed:", error.message || error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
