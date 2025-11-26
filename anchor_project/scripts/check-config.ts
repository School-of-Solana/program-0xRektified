import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { AnchorProject } from "../target/types/anchor_project";
import { getNetworkConfig } from "./utils/common";

async function main() {
  const args = process.argv.slice(2);
  const networkConfig = getNetworkConfig(args);

  console.log(`\nChecking config on ${networkConfig.cluster}...\n`);

  const programId = new PublicKey("BQ2A6Mw7vLXB1Z7e6uLmHG5PXBizx6KLdgzXDKyMxu6t");
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
  console.log("Config PDA:", configPda.toString());

  const connection = new anchor.web3.Connection(networkConfig.rpcUrl, networkConfig.commitment);
  const provider = new anchor.AnchorProvider(
    connection,
    { publicKey: PublicKey.default, signTransaction: async () => { throw new Error(); }, signAllTransactions: async () => { throw new Error(); } },
    { commitment: networkConfig.commitment }
  );
  anchor.setProvider(provider);
  const program = anchor.workspace.AnchorProject as anchor.Program<AnchorProject>;

  const config = await program.account.config.fetch(configPda);
  console.log("\n=== CONFIG DETAILS ===");
  console.log("Admin:", config.admin.toString());
  console.log("Allowed Mint:", config.allowedMint.toString());
  console.log("Treasury ATA:", config.treasuryAta.toString());
  console.log("Current Epoch:", config.currentEpoch.toNumber());
  console.log("Total Positions Minted:", config.totalPositionsMinted.toNumber());
  console.log("Position Price:", config.positionPrice.toNumber());
  console.log("Remaining Total Position:", config.remainingTotalPosition.toNumber());
  console.log("Weight Model:", JSON.stringify(config.weightModel));
  console.log("Resolution Type:", JSON.stringify(config.resolutionType));
}

main();
