#!/bin/bash
set -e

NETWORK=${1:-localnet}

echo "🚰 Deploying faucet to $NETWORK..."

# Build and deploy faucet
anchor build --program-name faucet
anchor deploy --program-name faucet --provider.cluster "$NETWORK"

# Initialize (this writes deployment info to ../frontend/deployments/)
ts-node scripts/faucet-initialize.ts --network="$NETWORK"

# Copy IDL and types to frontend
mkdir -p ../frontend/idl
cp target/idl/faucet.json ../frontend/idl/
cp target/types/faucet.ts ../frontend/idl/

echo "✅ Faucet deployment complete!"
echo "   - Deployment info: ../frontend/deployments/faucet-deployment-$NETWORK.json"
echo "   - IDL: ../frontend/idl/faucet.json"
