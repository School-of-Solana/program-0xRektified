import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Faucet } from "../target/types/faucet";
import * as fs from "fs";
import * as path from "path";
import { getNetworkConfig, loadWallet } from "./utils/common";

async function main() {
  const args = process.argv.slice(2);
  const networkConfig = getNetworkConfig(args);

  const amountArg = args.find((arg) => arg.startsWith("--amount="));
  const initialSupply = amountArg
    ? BigInt(amountArg.split("=")[1])
    : BigInt(10_000_000_000) * BigInt(10 ** 9);

  const claimAmountArg = args.find((arg) => arg.startsWith("--claim-amount="));
  const claimAmount = claimAmountArg
    ? parseInt(claimAmountArg.split("=")[1])
    : null;

  console.log(`\nInitializing Faucet on ${networkConfig.cluster}...\n`);
  console.log(`Initial Supply: ${initialSupply.toString()} (${Number(initialSupply) / 1e9} tokens)`);
  console.log(`Claim Amount: ${claimAmount ?? 10_000} tokens\n`);

  const connection = new anchor.web3.Connection(networkConfig.rpcUrl, networkConfig.commitment);

  const walletKeypair = loadWallet();
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: networkConfig.commitment,
  });
  anchor.setProvider(provider);

  const program = anchor.workspace.Faucet as Program<Faucet>;

  console.log(`Program ID: ${program.programId.toString()}`);
  console.log(`Deployer: ${wallet.publicKey.toString()}`);

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

  console.log(`PDAs:`);
  console.log(`Mint Authority: ${mintAuthority.toString()}`);
  console.log(`Mint: ${mint.toString()}\n`);

  try {
    const mintInfo = await connection.getAccountInfo(mint);
    if (mintInfo) {
      console.log(`Faucet already initialized!`);
      console.log(`Mint: ${mint.toString()}`);
      console.log(`Skipping initialization.\n`);

      const deploymentInfo = {
        network: networkConfig.cluster,
        programId: program.programId.toString(),
        mint: mint.toString(),
        mintAuthority: mintAuthority.toString(),
        deployer: wallet.publicKey.toString(),
        timestamp: new Date().toISOString(),
      };

      const deploymentPath = path.join(
        __dirname,
        "..",
        "..",
        "frontend",
        "deployments",
        `faucet-deployment-${networkConfig.cluster}.json`
      );
      fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
      fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
      console.log(`Deployment info saved to ../frontend/deployments/${path.basename(deploymentPath)}\n`);

      return;
    }
  } catch {
  }

  console.log("Initializing faucet...");

  try {
    const tx = await program.methods
      .initialize(
        new anchor.BN(initialSupply.toString()),
        claimAmount !== null ? new anchor.BN(claimAmount) : null
      )
      .accounts({
        signer: wallet.publicKey,
      })
      .rpc();

    console.log(`Transaction: ${tx}`);
    console.log(`Faucet initialized successfully\n`);

    const deploymentInfo = {
      network: networkConfig.cluster,
      programId: program.programId.toString(),
      mint: mint.toString(),
      mintAuthority: mintAuthority.toString(),
      deployer: wallet.publicKey.toString(),
      timestamp: new Date().toISOString(),
      initTx: tx,
    };

    const deploymentPath = path.join(
      __dirname,
      "..",
      "..",
      "frontend",
      "deployments",
      `faucet-deployment-${networkConfig.cluster}.json`
    );
    fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`Deployment info saved to ../frontend/deployments/${path.basename(deploymentPath)}\n`);

    const rpcUrl = networkConfig.rpcUrl;
    console.log("Next steps:");
    console.log(`1. Share the mint address with users: ${mint.toString()}`);
    console.log(`2. Users can claim tokens using: yarn faucet:claim:${networkConfig.cluster}`);
    console.log(`3. Check mint info: spl-token display ${mint.toString()} --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb --url ${rpcUrl}\n`);
  } catch (error) {
    console.error("Initialization failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
