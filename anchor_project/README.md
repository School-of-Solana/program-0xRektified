# Time-Weighted Commitment Protocol

**A protocol that rewards conviction through time-weighted participation in on-chain games, lotteries, and funding mechanisms.**

> **"A generic engine for time-weighted, burn-to-participate tickets that can be plugged into different games, lotteries, or allocation mechanisms."**

---

## Table of Contents

- [Quick Start](#quick-start)
- [Overview](#overview)
- [Core Concept](#core-concept)
- [Protocol Components](#protocol-components)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Operations](#operations)

---

## Quick Start

### Prerequisites

- **Rust** 1.75+
- **Solana CLI** 1.18+
- **Anchor** 0.31.1
- **Node.js** 18+ and Yarn

### Installation

```bash
# Clone the repository
cd anchor_project

# Install dependencies
yarn install

# Build the program
yarn build
```

This will:
1. Sync program keys with `Anchor.toml`
2. Build the Rust program
3. Generate and copy IDL files to the frontend

### Deploy to Localnet

```bash
# Terminal 1: Start local validator
yarn localnet

# Terminal 2: Deploy faucet (for testing)
yarn faucet:deploy:localnet

# Terminal 3: Deploy protocol
WALLET=$(solana address)
yarn deploy:localnet --mint=<FAUCET_MINT_ADDRESS> --resolver=$WALLET

# Claim test tokens
yarn faucet:claim:localnet
```

### Run Tests

```bash
# cd into the anchor proejct repo
cd anchor_project

# run tests
anchor test
```

### Available Commands

```bash
# Build
yarn build              # Build the program and copiy idl to frontend
anchor build            # Build without key sync

# Testing
anchor test            # Same as above

# Deployment
yarn deploy:localnet   # Deploy to local validator
yarn deploy:devnet     # Deploy to Devnet

# Faucet (for testing)
yarn faucet:build                 # Build faucet program
yarn faucet:deploy:localnet      # Deploy faucet to localnet
yarn faucet:claim:localnet       # Claim tokens from faucet

# Admin Operations
yarn admin:init-pool             # Initialize pools for new epoch
yarn admin:resolve               # Resolve current epoch
yarn admin:update-resolution     # Update resolution type

# User Operations
yarn user:mint                   # Mint a position
yarn user:commit                 # Commit position to pool
yarn user:claim                  # Claim rewards

# Development
yarn localnet          # Start local validator
yarn logs             # Watch Solana logs
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for more options.

### Project Structure

```
anchor_project/
├── programs/
│   ├── anchor_project/     # Main protocol program
│   │   └── src/
│   │       ├── instructions/       # Anchor entry points
│   │       ├── state/              # Data structures
│   │       ├── constants.rs        # Protocol constants
│   │       ├── errors.rs           # Error definitions
│   │       ├── utils.rs            # Utility functions
│   │       └── lib.rs              # Program entrypoint
│   └── faucet/             # Token faucet for testing
├── tests/                  # Anchor tests
├── scripts/                # Deployment and admin scripts
│   ├── admin/              # Admin operation scripts
│   ├── user/               # User operation scripts
│   └── utils/              # Script utilities
├── runbooks/               # Operational runbooks
├── target/
│   ├── idl/                # Generated IDL files
│   └── types/              # Generated TypeScript types
├── Anchor.toml             # Anchor configuration
├── Cargo.toml              # Rust dependencies
├── ARCHITECTURE.md         # Architecture documentation
└── DEPLOYMENT.md           # Deployment guide
```

---

## Overview

### The Problem

In crypto, participants increasingly prioritize **short-term speculation** over **sustained commitment**.

### The Solution

This protocol shifts incentives by rewarding long-term holders who demonstrate conviction in a project.

**How it works:**
- Time held **directly determines** allocation weight
- The longer you hold before committing, the **greater your share**
- This changes the game theory: **patience and belief are rewarded** over quick exits

### What Makes This Different?

This protocol is a **primitive for irreversible, aging, burnable positions** used to express conviction, participate in games, or secure allocations in repeated on-chain rounds (epochs).

Each program deployment implements a distinct **market / arena / launchpad** with its own:

- **Theme**: lottery, game, contest, sale…
- **Token**: any Token-2022 mint
- **Resolution logic**: VRF oracle for trustless randomness, or admin for curated outcomes
- **Reward policy**: how much of the treasury is paid out per epoch

This is **not** a traditional staking system. It's closer to:

- **Time-weighted tickets**
- **Single-use, burn-to-participate positions**
- **Loyalty / conviction measured by time**
- **A base layer for new kinds of lotteries, games, and fundraising**

---

## Core Concept

### What are Positions?

Positions are **time-amplified commitment tickets**:

- **Minted** by paying a fixed `position_price` in a chosen token
- **Non-refundable** – cannot be redeemed back into the payment token
- **Non-transferable** – no secondary market by default
- **Time-weighted** – weight grows with age (depending on `WeightModel`)
- **Consumable** – burned on commitment; one position, one use

They're not staking, not LP shares, not tradeable assets. They're closer to:

> **"Aging tickets that accumulate weight over time. When you burn them to commit, your accumulated weight determines your share of the reward pool—the longer you held, the greater your allocation."**

**Key characteristics:**

- **Irreversible commitment** — True skin in the game
- **Time amplification** — Weight grows with age
- **Capital efficiency** — No locked liquidity, AMMs, or order books
- **Proportional rewards** — Winners share based on weight contribution
- **Resolution agnostic** — Works with admin, oracle, DAO, or any resolution mechanism
- **Consumable design** — Burned when used, creating natural scarcity

### Core Mechanic

- Users **pay** in a token (e.g. USDC or any SPL-2022 mint) to **mint positions**
- Each position **ages** over time and accumulates **weight**
- Users **burn** positions to commit to a **pool** (choice / option / game bucket)
- When the epoch is **resolved**, a pool (or set of pools) is selected
- A configured **reward pot** (from treasury or a dedicated reward account) is distributed **proportionally by weight** to eligible participants

By design:

- Position mint payments go into a **treasury account**
- The protocol does **not** automatically redistribute "loser stakes" to winners
- Each deployment chooses **how much** to pay out per epoch and **in which token**

---

## Protocol Components

### 1. Positions

- Minted by paying `position_price` in `allowed_mint` (default: 1000 SOL, configurable)
- Weight computed using a `WeightModel`:
  - `Constant` → weight = 1.0 (scaled to 10,000)
  - `TimeBased` → weight grows based on age and configured rate
- Cannot be refunded or transferred
- Burned when committed to a pool

**Weight Calculation (TimeBased Model)**:

The protocol uses a configurable weight rate system with high precision:

```text
Formula: weight = (age_seconds × numerator × 10,000) / denominator

Example: 10 weight per 5 minutes (300 seconds)
- numerator = 10, denominator = 300
- After 300s: (300 × 10 × 10,000) / 300 = 100,000 (= 10.0000)
- After 150s: (150 × 10 × 10,000) / 300 = 50,000 (= 5.0000)
- After 30s:  (30 × 10 × 10,000) / 300 = 10,000 (= 1.0000)

Minimum weight: Always 1.0 (10,000 scaled) to prevent gaming via instant commits
Precision: 10,000x multiplier provides 4 decimal places of accuracy
```

**Why the 10,000x multiplier?**
- Allows sub-second precision while using integer math
- Fair weight calculation even for very young positions
- Prevents rounding errors in weight distribution

**→ Positions = irreversible, time-amplified participation tickets**

---

### 2. Pools

Pools are **commitment targets** inside each epoch. They can represent:

- Lottery entries (random winner selection)
- Game teams / factions (competitive pools)
- Contest submissions (judged outcomes)
- Any discrete "bucket" of participation

**Current Implementation (Multi-Pool Competitive Mode)**:

- Users burn positions into pools during each epoch
- `Pool.total_weight` tracks time-weighted support/participation per pool
- One pool per epoch is selected as the "winner" via resolution (Admin or VRF Oracle)
- Only participants in the winning pool receive rewards, distributed proportionally by their weight

**Reward Distribution Formula**:
```text
user_reward = (user_weight_in_winning_pool / total_winning_pool_weight) × reward_amount
```

**Planned Feature - Single-Pool Modes**:

> 🚧 **Not Yet Implemented**: Single-pool modes where ALL participants receive allocations pro-rata by weight (useful for Conviction ICOs, fundraising, or allocation rounds) will be added in future updates for different use cases.

**→ Pools = where users direct their tickets in competitive rounds.**

---

### 3. Epochs

Epochs are **discrete rounds** with time-bound participation windows:

- Each epoch has its own set of pools (up to 10 pools max)
- Duration is configurable via `epoch_duration` (e.g., 60 seconds, 1 day, 1 week)
- Users commit positions during the epoch **before the deadline**
- **Epoch End Validation**: Users cannot commit after `epoch_result.end_at` timestamp
  - This prevents late commits after outcomes are known
  - Ensures fair participation windows
- At resolution:
  - A winning pool is selected via Admin decision or VRF Oracle randomness
  - Participants in the winning pool become eligible to claim rewards
- `config.current_epoch` increments and the next epoch begins

**Epoch Lifecycle**:
```text
1. Admin calls initialize_pool(num_pools)
   → Creates pools and EpochResult
   → Sets end_at = current_time + epoch_duration

2. Users mint positions and commit to pools
   → Commits rejected if current_time > end_at

3. Resolver calls resolve(winning_pool_id)
   → Selects winner and increments epoch
   → Users can now claim rewards
```

**→ Epochs = recurring competitive or distribution cycles with enforced deadlines.**

---

### 4. Resolution Types

Resolution defines **how outcomes are decided**. The core protocol is agnostic — only the `ResolutionType` and `resolve` logic differ.

**Implemented**:

- **Admin**
  - A designated resolver account selects the winning pool or finalizes an epoch
  - Resolver is separate from admin (can be same address for testing)
  - Admin manages protocol config, resolver handles epoch outcomes
  - Best for internal games, demos, curated contests, and early-stage deployments

- **Oracle** ✅ **(Implemented with Magic Block VRF)**
  - Trustless randomness via Verifiable Random Function (VRF)
  - VRF oracle provides cryptographically secure random selection
  - Automatic callback-based resolution (no admin intervention needed)
  - Perfect for lotteries, random draws, and provably fair games

  **How Oracle Resolution Works**:
  ```text
  1. Resolver calls resolve() with Oracle mode
     → Stores pool weights in EpochResult
     → Makes CPI to VRF oracle requesting randomness
     → Sets EpochResult state to "Pending"

  2. VRF oracle generates randomness off-chain
     → Calls back to callback_resolve() with verified randomness
     → Protocol uses randomness to select winning pool index
     → Sets EpochResult state to "Resolved"

  3. Users can claim rewards from the randomly selected pool
  ```

**Planned**:

- **Off-chain judge / AI / panel**
  - For creative or subjective contests where human or AI judgment is required

**Key Roles**:
- **Admin**: Manages protocol configuration, can update settings
- **Resolver**: Authorized to resolve epochs (trigger winner selection)
- Can be the same address or separate for security/governance

**→ Resolution = who/what decides what an epoch's pools "mean" and who is eligible to claim.**

---

### 5. Rewards

Rewards come from a **configurable reward source**, usually:

- the `treasury_ata` (where mint payments accumulate), or
- a dedicated reward account / pot per-market or per-epoch

For a winning pool in a game mode:

```text
user_reward = (user_weight / total_winning_pool_weight) × reward_pool_amount
```

**→ Rewards = proportional distribution based on time-weighted commitment.**

---

## Architecture

### Layer Responsibilities

#### state/ (Data Structures)
**Purpose:** Shared account structures and configuration enums

- `Config`: Protocol configuration (weight model, resolution type, epoch settings)
- `Position`: User position with creation timestamp for weight calculation
- `Pool`: Commitment target with total weight tracking
- `EpochResult`: Epoch state and resolution outcome
- `Commitment`: User commitment to a specific pool

#### instructions/ (Anchor Entry Points)
**Purpose:** Anchor-specific instruction handlers

**Available Instructions:**
- `initialize`: Initialize protocol config
- `mint_position`: Mint user positions
- `initialize_pool`: Initialize pools for epoch
- `commit`: Commit positions to pools
- `resolve`: Resolve epoch and select winner
- `callback_resolve`: Oracle callback for VRF resolution
- `claim`: Claim rewards

#### Supporting Modules
- `constants.rs`: Protocol constants and configuration defaults
- `errors.rs`: Custom error definitions
- `utils.rs`: Utility functions for weight calculation and validation

---

## Configuration

### Core Settings

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `weight_model` | WeightModel | How positions accumulate weight | `TimeBased` or `Constant` |
| `resolution_type` | ResolutionType | How epochs are resolved | `Admin` or `Oracle` |
| `resolver` | Pubkey | Account authorized to resolve epochs | Can be admin or separate address |
| `epoch_duration` | i64 | Seconds users can commit in each epoch | `60` (1 min), `86400` (1 day) |
| `position_price` | u64 | Lamports to mint one position | `1000000000000` (1000 SOL) |
| `allowed_mint` | Pubkey | Token-2022 mint for position payments | Your token mint address |

### Weight Rate Settings (TimeBased Model Only)

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `weight_rate_numerator` | u64 | Weight units to accumulate | `10` |
| `weight_rate_denominator` | u64 | Time period in seconds | `300` (5 minutes) |

**Example Configuration**:
```rust
// 10 weight per 5 minutes, with 1-day epochs
weight_model: TimeBased
weight_rate_numerator: 10
weight_rate_denominator: 300  // 5 minutes
epoch_duration: 86400  // 1 day
```

This means:
- Users who hold positions for 5 minutes get 10.0 weight
- Users who hold for 2.5 minutes get 5.0 weight
- Instant commits still get minimum 1.0 weight
- All values use 10,000x precision internally

### Security Features

✅ **Epoch End Enforcement**: Commits rejected after deadline  
✅ **Minimum Weight**: Prevents gaming via instant commits (always ≥ 1.0)  
✅ **Resolver Authorization**: Only designated resolver can trigger outcomes  
✅ **VRF Verification**: Oracle randomness is cryptographically verified  
✅ **Integer Math**: All calculations use checked arithmetic to prevent overflow

---

## Deployment

### Prerequisites

1. **Install Solana CLI**
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   ```

2. **Install Anchor CLI**
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   avm install 0.31.1
   avm use 0.31.1
   ```

3. **Configure Solana CLI**
   ```bash
   # For localnet
   solana config set --url localhost

   # For devnet
   solana config set --url devnet
   ```

4. **Create or configure your wallet**
   ```bash
   # Generate a new keypair (if needed)
   solana-keygen new --outfile ~/.config/solana/id.json

   # Or set an existing keypair
   solana config set --keypair ~/.config/solana/id.json
   ```

5. **Fund your wallet**
   ```bash
   # For localnet (when running test validator)
   solana airdrop 10

   # For devnet
   solana airdrop 2 --url devnet
   ```

### Deployment Steps

#### 1. Build the Program

```bash
yarn build
```

This will:
- Sync the program ID from the keypair to `lib.rs` and `Anchor.toml` using `anchor keys sync`
- Compile the Rust program
- Generate the IDL

#### 2. Deploy to Localnet (Testing)

First, start a local validator:

```bash
# In a separate terminal
yarn localnet
# or
solana-test-validator
```

**Option A: Using the Faucet (Recommended for Testing)**

If you don't have a Token-2022 mint, deploy the faucet for unlimited test tokens:

```bash
# 1. Deploy and initialize the faucet (creates Token-2022 mint with 1B initial supply)
yarn faucet:deploy:localnet

# 2. The faucet will output the mint address - copy it for the next step
# Example output: "Mint: BWTTmj5XiLyczo2Dr732zputh8NS5MNzEWweewbSEFcb"

# 3. Deploy the protocol with the faucet mint
WALLET=$(solana address)
yarn deploy:localnet --mint=<FAUCET_MINT_ADDRESS> --resolver=$WALLET

# 4. Claim tokens from the faucet whenever you need them
yarn faucet:claim:localnet
```

**Faucet Features:**
- Unlimited token claims (10,000 tokens per claim by default)
- Token-2022 compatible mint
- ⚠️ **Testing only** - never use in production

**Option B: Using Your Own Token-2022 Mint**

```bash
# Deploy with your existing Token-2022 mint
yarn deploy:localnet --mint=<YOUR_MINT_ADDRESS> --resolver=<RESOLVER_PUBKEY>
```

**Required Parameters:**
- `--mint`: Token-2022 mint address for position payments
- `--resolver`: Public key authorized to resolve epochs (can be same as admin)

**What the deployment does:**
- Sync program IDs with `anchor keys sync`
- Build the program
- Deploy the program to localnet
- Initialize the protocol config with:
  - Weight model: TimeBased
  - Resolution type: Admin (or Oracle if configured)
  - Epoch duration: 60 seconds (configurable in script)
  - Weight rate: 10 weight per 300 seconds (5 minutes)
  - Position price: 1000 SOL
- Save deployment info to `deployment-localnet.json`

#### 3. Deploy to Devnet

**Option A: Using the Faucet (Recommended for Testing)**

```bash
# 1. Make sure you have devnet SOL
solana balance --url devnet

# 2. Deploy and initialize the faucet (creates Token-2022 mint)
yarn faucet:deploy:devnet

# 3. Copy the mint address from the output and deploy the protocol
WALLET=$(solana address)
yarn deploy:devnet --mint=<FAUCET_MINT_ADDRESS> --resolver=$WALLET

# 4. Claim tokens from the faucet
yarn faucet:claim:devnet
```

**Option B: Using Your Own Token-2022 Mint**

```bash
# Make sure you have devnet SOL
solana balance --url devnet

# Deploy with required parameters
yarn deploy:devnet --mint=<YOUR_MINT_ADDRESS> --resolver=<RESOLVER_PUBKEY>
```

### Post-Deployment

After deployment, you'll find a `deployment-{network}.json` file with:
- Program ID
- Token mint address
- Deployer address
- Deployment timestamp

**Important:** Save the mint address! You'll need it for:
- Minting user positions
- Committing to pools
- Claiming rewards

### Useful Commands

**Check Program Deployment**

```bash
# Get program info
solana program show <PROGRAM_ID>

# Check program account
anchor account config <CONFIG_PDA>
```

**Monitor Logs**

```bash
# In localnet
yarn logs

# In devnet/testnet
solana logs <PROGRAM_ID> --url devnet
```

**Update Program**

If you need to update the program after deployment:

```bash
anchor build
anchor upgrade <PROGRAM_ID> target/deploy/anchor_project.so --provider.cluster devnet
```

### Troubleshooting

**Insufficient Balance**

If deployment fails due to insufficient balance:

```bash
# Check balance
solana balance

# Airdrop (devnet/testnet only)
solana airdrop 2
```

**Program Already Deployed**

If the program is already deployed and you want to upgrade:

```bash
anchor upgrade <PROGRAM_ID> target/deploy/anchor_project.so
```

**Config Already Initialized**

If the initialization script says "Config already initialized", that's normal. The script detects this and continues.

---

## Operations

### Admin Operations

```bash
# Initialize pools for a new epoch
yarn admin:init-pool --network=<localnet|devnet> --num-pools=<number>
# Example: yarn admin:init-pool --network=devnet --num-pools=4

# Resolve the current epoch (requires resolver wallet)
ANCHOR_WALLET=~/.config/solana/keeper-keypair.json \
yarn admin:resolve --network=<localnet|devnet> --winning-pool=<pool_id> --num-pools=<number>
# Example: yarn admin:resolve --network=localnet --winning-pool=0 --num-pools=4

# Update resolution type
yarn admin:update-resolution
```

### User Operations

```bash
# Mint a position
yarn user:mint --network=<localnet|devnet>
# Example: yarn user:mint --network=localnet

# Commit a position to a pool
yarn user:commit --network=<localnet|devnet> --position-id=<id> --pool-id=<id>
# Example: yarn user:commit --network=localnet --position-id=0 --pool-id=1

# Claim rewards
yarn user:claim --network=<localnet|devnet>
```

### Utility Scripts

```bash
# Check protocol configuration
yarn ts-node scripts/check-config.ts

# Check epoch result
yarn ts-node scripts/check-epoch-result.ts --epoch=<epoch_number>
# Example: yarn ts-node scripts/check-epoch-result.ts --epoch=1
```

---

## License

ISC

---

## Author

0xRektified - School of Solana Exam Project
