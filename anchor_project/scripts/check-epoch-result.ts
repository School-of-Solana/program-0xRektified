import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { AnchorProject } from "../target/types/anchor_project";
import { getNetworkConfig } from "./utils/common";

async function main() {
  const args = process.argv.slice(2);
  const networkConfig = getNetworkConfig(args);
  const epochArg = args.find((arg) => arg.startsWith("--epoch="));
  const epoch = epochArg ? parseInt(epochArg.split("=")[1]) : 2;

  console.log(`\nChecking epoch ${epoch} result on ${networkConfig.cluster}...\n`);

  const programId = new PublicKey("DM5kNZoPPfJkow6oDv9RWaM2aNibRvRByZjyieriGKkG");
  const connection = new anchor.web3.Connection(networkConfig.rpcUrl, networkConfig.commitment);
  const provider = new anchor.AnchorProvider(
    connection,
    { publicKey: PublicKey.default, signTransaction: async () => { throw new Error(); }, signAllTransactions: async () => { throw new Error(); } },
    { commitment: networkConfig.commitment }
  );
  anchor.setProvider(provider);
  const program = anchor.workspace.AnchorProject as anchor.Program<AnchorProject>;

  const [epochResultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("epoch_result"), new anchor.BN(epoch).toArrayLike(Buffer, "le", 8)],
    programId
  );
  console.log("Epoch Result PDA:", epochResultPda.toString());
  
  try {
    const result = await program.account.epochResult.fetch(epochResultPda);
    console.log("\nEpoch:", result.epoch.toNumber());
    console.log("Winning Pool ID:", result.winningPoolId);
    console.log("Weight:", result.weight.toNumber());
    console.log("end_at:", result.endAt.toNumber());
    console.log("Total Position Amount:", result.totalPositionAmount.toNumber());
    console.log("Pool Count:", result.poolCount);
    console.log("Pool Weights:", result.poolWeights.map((w: any) => w.toNumber()));
    console.log("State:", JSON.stringify(result.epochResultState));
  } catch (e: any) {
    console.log("Error fetching epoch result:", e.message);
  }
}
main();
