import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { AnchorProject } from "../../target/types/anchor_project";
import { getNetworkConfig, loadWallet } from "../utils/common";

async function main() {
  const args = process.argv.slice(2);
  const networkConfig = getNetworkConfig(args);
  const resolutionArg = args.find((arg) => arg.startsWith("--resolution="));

  const resolution = resolutionArg ? resolutionArg.split("=")[1] : null;

  if (!resolution || !["admin", "oracle"].includes(resolution)) {
    throw new Error("Resolution type required. Use --resolution=admin or --resolution=oracle");
  }

  console.log(`\n🔄 Updating Resolution Type on ${networkConfig.cluster}...\n`);

  const connection = new anchor.web3.Connection(networkConfig.rpcUrl, networkConfig.commitment);
  const walletKeypair = loadWallet();
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: networkConfig.commitment });
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorProject as Program<AnchorProject>;

  console.log(`   Program ID: ${program.programId.toString()}`);
  console.log(`   Admin: ${wallet.publicKey.toString()}`);

  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);

  // Get current config
  const configAccount = await program.account.config.fetch(configPda);
  const currentResolution = Object.keys(configAccount.resolutionType)[0];
  console.log(`   Current Resolution: ${currentResolution}`);
  console.log(`   New Resolution: ${resolution}\n`);

  if (currentResolution === resolution) {
    console.log(`   ⚠️  Resolution type is already set to ${resolution}. No changes needed.\n`);
    return;
  }

  const resolutionType = resolution === "oracle"
    ? { oracle: {} } as const
    : { admin: {} } as const;

  try {
    const tx = await program.methods
      .updateResolutionType(resolutionType as any)
      .accountsPartial({
        signer: wallet.publicKey,
      })
      .rpc();

    console.log(`   ✅ Resolution type updated successfully!`);
    console.log(`   Transaction: ${tx}`);

    // Verify the update
    const updatedConfig = await program.account.config.fetch(configPda);
    const updatedResolution = Object.keys(updatedConfig.resolutionType)[0];
    console.log(`\n   Verified Resolution Type: ${updatedResolution}\n`);
  } catch (error: any) {
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Error:", error.message);
    console.error("\nUsage:");
    console.error("  ts-node scripts/admin/update-resolution.ts \\");
    console.error("    --network=devnet \\");
    console.error("    --resolution=oracle");
    console.error("\nOptions:");
    console.error("  --resolution=admin   Use admin-controlled resolution");
    console.error("  --resolution=oracle  Use VRF oracle for random resolution");
    process.exit(1);
  });
