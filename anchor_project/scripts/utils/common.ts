import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

export interface NetworkConfig {
  cluster: string;
  rpcUrl: string;
  commitment: anchor.web3.Commitment;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  localnet: {
    cluster: "localnet",
    rpcUrl: "http://127.0.0.1:8899",
    commitment: "confirmed",
  },
  devnet: {
    cluster: "devnet",
    rpcUrl: "https://api.devnet.solana.com",
    commitment: "confirmed",
  },
  testnet: {
    cluster: "testnet",
    rpcUrl: "https://api.testnet.solana.com",
    commitment: "confirmed",
  },
};

/**
 * Load wallet keypair from ANCHOR_WALLET env var or default location
 * @returns Keypair from the wallet file
 */
export function loadWallet(): anchor.web3.Keypair {
  // Use ANCHOR_WALLET env var if set, otherwise default to ~/.config/solana/id.json
  const walletPath = process.env.ANCHOR_WALLET
    ? path.resolve(process.env.ANCHOR_WALLET.replace(/^~/, process.env.HOME || ""))
    : path.join(
        process.env.HOME || "",
        ".config",
        "solana",
        "id.json"
      );

  const walletKeypair = anchor.web3.Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  return walletKeypair;
}

/**
 * Get network configuration from command line args or env var
 * @param args Command line arguments
 * @returns NetworkConfig object
 */
export function getNetworkConfig(args: string[]): NetworkConfig {
  const networkArg = args.find((arg) => arg.startsWith("--network="));
  const network = networkArg
    ? networkArg.split("=")[1]
    : process.env.ANCHOR_PROVIDER_CLUSTER || "localnet";

  const config = NETWORKS[network];
  if (!config) {
    throw new Error(
      `Unknown network: ${network}. Available: ${Object.keys(NETWORKS).join(", ")}`
    );
  }

  return config;
}
