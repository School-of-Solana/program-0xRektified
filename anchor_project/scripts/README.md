# Scripts Guide

This directory contains scripts for deploying and interacting with the prediction market game.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Deployment](#deployment)
- [Faucet (Testing Only)](#faucet-testing-only)
- [Admin Operations](#admin-operations)
- [User Operations](#user-operations)
- [Complete Game Flow](#complete-game-flow)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Set up your Solana CLI for the target network:

```bash
# For devnet
solana config set --url devnet

# Check balance
solana balance

# Airdrop SOL if needed
solana airdrop 2
```

### Wallet Configuration

All scripts support the `ANCHOR_WALLET` environment variable to specify a custom wallet path:

```bash
# Use default wallet (~/.config/solana/id.json)
yarn user:mint --network=localnet

# Use a custom wallet
ANCHOR_WALLET=~/.config/solana/my-wallet.json yarn user:mint --network=localnet

# Use a different wallet for admin operations
ANCHOR_WALLET=~/.config/solana/admin-keypair.json yarn admin:init-pool --network=devnet --num-pools=3
```

If `ANCHOR_WALLET` is not set, scripts will default to `~/.config/solana/id.json`.

## Deployment

### Deploy and Initialize Program

Deploy the program and initialize with required parameters:

```bash
# Localnet
yarn deploy:localnet

# Devnet
yarn deploy:devnet

# Testnet
yarn deploy:testnet
```

**Required Parameters:**
- `--network`: Target network (localnet, devnet, testnet)
- `--mint`: Token-2022 mint address for game currency
- `--resolver`: Public key authorized to resolve epochs

**Example:**
```bash
yarn initialize --network=devnet \
  --mint=BWTTmj5XiLyczo2Dr732zputh8NS5MNzEWweewbSEFcb \
  --resolver=YourResolverPublicKey...
```

**What it creates:**
- Program deployment on target network
- Game configuration with admin and resolver
- Treasury account for rewards
- `deployment-{network}.json` with deployment info

**Key Concepts:**
- **Admin**: The deployer, manages protocol settings
- **Resolver**: Separate account authorized to resolve epochs (can be same as admin for testing)
- **Epoch Duration**: 60 seconds (1 minute per epoch)

## Faucet (Testing Only)

> ⚠️ **WARNING: TESTING ONLY**
> The faucet provides unlimited tokens with no restrictions. Never use in production.

### Deploy Faucet

Deploy and initialize the test faucet for claiming tokens:

```bash
# Localnet (defaults: 10B tokens initial supply, 10k per claim)
yarn faucet:deploy:localnet

# Devnet (defaults: 10B tokens initial supply, 10k per claim)
yarn faucet:deploy:devnet
```

**Note:** The deploy script automatically builds, deploys, and initializes the faucet. To customize initialization parameters, modify `scripts/faucet-deploy.sh` to pass `--amount` and `--claim-amount` arguments to the initialize script.

### Claim Tokens

```bash
# Localnet
yarn faucet:claim:localnet

# Devnet
yarn faucet:claim:devnet
```

## Admin Operations

All admin operations require the admin/deployer wallet.

### Initialize Pools

Create pools for the current epoch. Can initialize up to 10 pools at once.

```bash
# Single pool
yarn admin:init-pool --network=localnet --num-pools=1

# Multiple pools (creates pool IDs 0-4)
yarn admin:init-pool --network=devnet --num-pools=5
```

**Important:**
- Must be called before users can commit
- Creates pools with IDs 0 to (num-pools - 1)
- Can only be called once per epoch
- Pool accounts exist only for the current epoch

### Resolve Epoch

Resolve the current epoch and select the winning pool. **Requires resolver wallet.**

```bash
# Resolve with pool 0 winning
yarn admin:resolve --network=localnet --winning-pool=0 --num-pools=3

# Resolve with pool 2 winning
yarn admin:resolve --network=devnet --winning-pool=2 --num-pools=5
```

**Parameters:**
- `--winning-pool`: Pool ID that won (0-255)
- `--num-pools`: Total number of pools that were initialized

**What it does:**
- Marks winning pool in EpochResult
- Calculates total weight across all pools
- Increments epoch counter
- Forwards rewards if winning pool is empty
- Closes all pool accounts
- **Validates epoch has ended** (current time >= end_at timestamp)

**Authorization:**
- Only the resolver account can call this
- Attempting with unauthorized account fails with `UnauthorizedResolver` error

### Update Resolution Type

Change how epochs are resolved (admin only):

```bash
yarn admin:update-resolution --network=localnet
```

Switches between:
- `Admin`: Manual resolution by resolver
- `Oracle`: VRF-based random resolution (requires oracle queue)

## User Operations

### Mint Position

Mint a new position NFT (costs position_price tokens from your wallet):

```bash
# Localnet
yarn user:mint --network=localnet

# Devnet
yarn user:mint --network=devnet
```

**Cost:** 1000 tokens (burned)
**Result:** Position account with creation timestamp
**Weight:** Accrues over time (longer hold = more weight)

### Commit Position

Commit a position to a pool for the current epoch:

```bash
# Commit position 0 to pool 0
yarn user:commit --network=localnet --position-id=0 --pool-id=0

# Commit position 1 to pool 2
yarn user:commit --network=devnet --position-id=1 --pool-id=2
```

**Requirements:**
- Position must exist
- Pool must exist for current epoch
- **Epoch must not have ended** (current time < end_at)

**What it does:**
- Calculates weight: `current_time - position.created_at`
- Burns position account
- Creates commitment with calculated weight
- Updates pool's total_weight and total_positions

**Important:** Cannot commit after epoch ends. Must commit before the epoch's `end_at` timestamp.

### Claim Rewards

Claim rewards from a winning pool:

```bash
# Claim from pool 0, epoch 1
yarn user:claim --network=localnet --pool-id=0 --epoch=1

# Claim from pool 1, epoch 3
yarn user:claim --network=devnet --pool-id=1 --epoch=3
```

**Requirements:**
- Commitment exists for that pool/epoch
- Epoch is resolved
- Pool was the winner
- Not already claimed

**Reward Formula:**
```
your_reward = (your_weight / total_weight) * total_pot
```

## Complete Game Flow

### 1. Setup (Admin)

```bash
# Start localnet
yarn localnet

# Deploy in another terminal (replace with actual values)
yarn initialize --network=localnet \
  --mint=<MINT_ADDRESS> \
  --resolver=<RESOLVER_PUBKEY>

# Initialize 3 pools for current epoch
yarn admin:init-pool --network=localnet --num-pools=3
```

### 2. Users Get Tokens

```bash
# Claim from faucet (testing only)
yarn faucet:claim:localnet
```

### 3. Users Mint & Wait

```bash
# Mint position at time T
yarn user:mint --network=localnet

# Position 0 is created with created_at = T
# Weight accrues: wait longer = more weight
```

### 4. Users Commit (Before Epoch Ends)

```bash
# User A commits to pool 0 at time T+100 (weight = 100)
yarn user:commit --network=localnet --position-id=0 --pool-id=0

# User B commits to pool 0 at time T+200 (weight = 200)
yarn user:commit --network=localnet --position-id=1 --pool-id=0

# User C commits to pool 1 at time T+150 (weight = 150)
yarn user:commit --network=localnet --position-id=2 --pool-id=1
```

**Must commit before epoch duration expires (60 seconds from epoch start).**

### 5. Admin Resolves (After Epoch Ends)

```bash
# Wait for epoch to end (60 seconds)
# Then resolve with pool 0 as winner
yarn admin:resolve --network=localnet --winning-pool=0 --num-pools=3
```

**Can only resolve after epoch's `end_at` timestamp.**

### 6. Winners Claim

```bash
# Users A and B can claim (they committed to pool 0)
yarn user:claim --network=localnet --pool-id=0 --epoch=1

# Rewards split by weight:
# User A: 100/(100+200) = 33.3% of pot
# User B: 200/(100+200) = 66.7% of pot

# User C cannot claim (wrong pool)
```

### 7. Repeat

Epoch automatically increments to 2. Admin initializes new pools and the cycle repeats.

## Advanced Features

### Reward Forwarding

If the winning pool has no participants:
- Rewards remain in treasury
- `remaining_total_position` counter increments
- Next epoch's winners receive accumulated rewards

**Example:**
```bash
# Epoch 1: Pool 1 wins but is empty
yarn user:commit --network=localnet --position-id=0 --pool-id=0
yarn admin:resolve --network=localnet --winning-pool=1 --num-pools=2
# No one can claim (pool 1 is empty)

# Epoch 2: Pool 0 wins with participants
yarn user:commit --network=localnet --position-id=1 --pool-id=0
yarn admin:resolve --network=localnet --winning-pool=0 --num-pools=2
yarn user:claim --network=localnet --pool-id=0 --epoch=2
# Winner receives rewards from BOTH epochs
```

### Epoch End Validation

- Each epoch has an `end_at` timestamp (epoch_start + 60 seconds)
- **Users cannot commit** after `end_at`
- **Admin cannot resolve** before `end_at`
- Prevents race conditions and ensures fair gameplay

## Troubleshooting

### "Insufficient balance"
Need 1000 tokens to mint a position. Claim from faucet or get tokens from deployer.

### "Pool not found"
Admin must initialize pools first: `yarn admin:init-pool --network=localnet --num-pools=3`

### "Epoch has ended"
Cannot commit after the 60-second epoch duration. Wait for next epoch.

### "Epoch not resolved"
Admin must resolve epoch before claiming: `yarn admin:resolve --network=localnet --winning-pool=0 --num-pools=3`

### "Cannot claim from a losing pool"
You committed to a pool that didn't win. No rewards available.

### "Already claimed"
Can only claim once per pool/epoch combination.

### "Unauthorized: Only the resolver can call this function"
The `resolve` instruction must be signed by the resolver account specified during initialization.

## Tips

1. **Position IDs are per-user**: Each user's positions are numbered 0, 1, 2, ...
2. **Wait before committing**: Longer hold time = more weight = bigger reward share
3. **Track epoch timing**: Each epoch lasts 60 seconds
4. **Only winners claim**: Losing pools cannot claim rewards
5. **One claim per commitment**: Cannot claim twice from same pool/epoch
6. **Use resolver account**: Keep resolver private key secure (controls epoch resolution)
