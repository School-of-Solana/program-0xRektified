#!/bin/bash
set -e

NETWORK=${1:-localnet}

# Check for --mint parameter
if [[ "$2" != --mint=* ]]; then
  echo "❌ Error: Missing required parameter --mint=<MINT_ADDRESS>"
  echo ""
  echo "Usage: bash scripts/deploy.sh <NETWORK> --mint=<MINT_ADDRESS> --resolver=<RESOLVER_ADDRESS>"
  echo ""
  echo "Example:"
  echo "  bash scripts/deploy.sh localnet --mint=aNhPdEt6t6E7bV6M92u8gUUjEc13VEwBxoXRQgDweVN --resolver=YourResolverPubkey..."
  echo ""
  echo "💡 Tip: Deploy the faucet first to get a mint address:"
  echo "  yarn faucet:deploy:$NETWORK"
  exit 1
fi

# Check for --resolver parameter
if [[ "$3" != --resolver=* ]]; then
  echo "❌ Error: Missing required parameter --resolver=<RESOLVER_ADDRESS>"
  echo ""
  echo "Usage: bash scripts/deploy.sh <NETWORK> --mint=<MINT_ADDRESS> --resolver=<RESOLVER_ADDRESS>"
  echo ""
  echo "Example:"
  echo "  bash scripts/deploy.sh localnet --mint=aNhPdEt6t6E7bV6M92u8gUUjEc13VEwBxoXRQgDweVN --resolver=YourResolverPubkey..."
  echo ""
  echo "Note: The resolver is the address authorized to resolve epochs (can be same as deployer for testing)"
  exit 1
fi

MINT="${2#--mint=}"
RESOLVER="${3#--resolver=}"

echo "Deploying anchor_project to $NETWORK..."
echo "Using mint: $MINT"
echo "Using resolver: $RESOLVER"
echo ""

# Build and deploy anchor_project only
anchor keys sync
anchor build --program-name anchor_project
anchor deploy --program-name anchor_project --provider.cluster "$NETWORK"

ts-node scripts/initialize.ts --network="$NETWORK" --mint="$MINT" --resolver="$RESOLVER"

mkdir -p ../frontend/idl
cp target/idl/anchor_project.json ../frontend/idl/
cp target/types/anchor_project.ts ../frontend/idl/

echo "✅ Deployment complete!"
echo "   - Deployment info: ../frontend/deployments/deployment-$NETWORK.json"
echo "   - IDL: ../frontend/idl/anchor_project.json"
