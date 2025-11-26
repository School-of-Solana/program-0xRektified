import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { AnchorProject } from "../target/types/anchor_project";
import { TOKEN_2022_PROGRAM_ID, getMint } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { getNetworkConfig, loadWallet } from "./utils/common";

// Epoch duration constant (1 minute = 60 seconds)
const EPOCH_DURATION = 60;

// Weight rate configuration
// Default: 10 weight per 5 minutes (300 seconds) for production
const WEIGHT_RATE_NUMERATOR = 10;
const WEIGHT_RATE_DENOMINATOR = 300;

async function main() {
  const args = process.argv.slice(2);
  const networkConfig = getNetworkConfig(args);

  const mintArg = args.find((arg) => arg.startsWith("--mint="));
  const resolverArg = args.find((arg) => arg.startsWith("--resolver="));

  if (!mintArg) {
    throw new Error(
      "Missing required parameter: --mint=<MINT_ADDRESS>\n" +
      "Usage: ts-node scripts/initialize.ts --network=<NETWORK> --mint=<MINT_ADDRESS> --resolver=<RESOLVER_ADDRESS>"
    );
  }

  if (!resolverArg) {
    throw new Error(
      "Missing required parameter: --resolver=<RESOLVER_ADDRESS>\n" +
      "Usage: ts-node scripts/initialize.ts --network=<NETWORK> --mint=<MINT_ADDRESS> --resolver=<RESOLVER_ADDRESS>\n" +
      "Note: The resolver is the address authorized to resolve epochs"
    );
  }

  const mintAddress = mintArg.split("=")[1];
  const resolverAddress = resolverArg.split("=")[1];

  console.log(`\n1 - Initializing program on ${networkConfig.cluster}...`);
  console.log(`   RPC: ${networkConfig.rpcUrl}`);

  const connection = new anchor.web3.Connection(
    networkConfig.rpcUrl,
    networkConfig.commitment
  );

  const walletKeypair = loadWallet();
  const wallet = new anchor.Wallet(walletKeypair);

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: networkConfig.commitment,
  });
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorProject as Program<AnchorProject>;

  console.log(`   Program ID: ${program.programId.toString()}`);
  console.log(`   Deployer: ${wallet.publicKey.toString()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`   Balance: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL\n`);

  // Parse and validate mint address
  let mint: PublicKey;
  try {
    mint = new PublicKey(mintAddress);
  } catch {
    throw new Error(`Invalid mint address: ${mintAddress}`);
  }

  // Parse and validate resolver address
  let resolver: PublicKey;
  try {
    resolver = new PublicKey(resolverAddress);
  } catch {
    throw new Error(`Invalid resolver address: ${resolverAddress}`);
  }

  console.log(`2 - Validating mint...`);
  console.log(`   Mint: ${mint.toString()}`);

  // Verify mint exists and is Token-2022
  try {
    const mintInfo = await getMint(
      connection,
      mint,
      networkConfig.commitment,
      TOKEN_2022_PROGRAM_ID
    );
    console.log(`   ✅ Mint verified (decimals: ${mintInfo.decimals})\n`);
  } catch (error: any) {
    throw new Error(
      `Failed to fetch mint. Make sure it exists and is a Token-2022 mint.\n` +
      `Error: ${error.message}`
    );
  }

  console.log(`3 - Resolver address: ${resolver.toString()}\n`);

  // Check if config already exists
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  try {
    const existingConfig = await program.account.config.fetch(configPda);
    console.log(`⚠️  Config already initialized!`);
    console.log(`   Existing Mint: ${existingConfig.allowedMint.toString()}`);
    console.log(`   Resolver: ${existingConfig.resolver.toString()}`);
    console.log(`   Treasury ATA: ${existingConfig.treasuryAta.toString()}`);
    console.log(`   Current Epoch: ${existingConfig.currentEpoch.toNumber()}\n`);
    console.log(`   Skipping initialization - using existing deployment.\n`);
    return;
  } catch {
    console.log("Initializing program...");

    const weightModel = { timeBased: {} };
    const resolutionType = { oracle: {} };

    const tx = await program.methods
      .initialize(
        weightModel,
        resolutionType,
        resolver,
        new BN(EPOCH_DURATION),
        new BN(WEIGHT_RATE_NUMERATOR),
        new BN(WEIGHT_RATE_DENOMINATOR)
      )
      .accountsPartial({
        signer: wallet.publicKey,
        mint: mint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    console.log(`   Transaction: ${tx}`);
    console.log(`   ✅ Config initialized successfully\n`);
  }

  const deploymentInfo = {
    network: networkConfig.cluster,
    programId: program.programId.toString(),
    mint: mint.toString(),
    resolver: resolver.toString(),
    deployer: wallet.publicKey.toString(),
    timestamp: new Date().toISOString(),
  };

  // Save to both frontend and anchor_project deployments folders
  const frontendDeploymentPath = path.join(
    __dirname,
    "..",
    "..",
    "frontend",
    "deployments",
    `deployment-${networkConfig.cluster}.json`
  );
  const backendDeploymentPath = path.join(
    __dirname,
    "..",
    "deployments",
    `deployment-${networkConfig.cluster}.json`
  );

  // Create directories if they don't exist
  fs.mkdirSync(path.dirname(frontendDeploymentPath), { recursive: true });
  fs.mkdirSync(path.dirname(backendDeploymentPath), { recursive: true });

  // Write to both locations
  fs.writeFileSync(frontendDeploymentPath, JSON.stringify(deploymentInfo, null, 2));
  fs.writeFileSync(backendDeploymentPath, JSON.stringify(deploymentInfo, null, 2));

  console.log(`📄 Deployment info saved to:`);
  console.log(`   - frontend/deployments/deployment-${networkConfig.cluster}.json`);
  console.log(`   - anchor_project/deployments/deployment-${networkConfig.cluster}.json`);
  console.log("\n✅ Deployment complete!\n");
  console.log("📋 Configuration:");
  console.log(`   Mint: ${mint.toString()}`);
  console.log(`   Resolver: ${resolver.toString()}`);
  console.log(`   Admin/Deployer: ${wallet.publicKey.toString()}`);
  console.log("\n📝 Next steps:");
  console.log(`   1. Fund the treasury before users start playing`);
  console.log(`   2. Use the resolver address to call resolve instructions`);
  console.log(`   3. Users can mint positions with the configured mint\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
