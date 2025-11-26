# Protocol Architecture

This document describes the architecture of the Time-Weighted Commitment Protocol - a flexible, epoch-based system for managing time-sensitive commitments with proportional reward distribution.

## Overview

This protocol is a **primitive for irreversible, aging, burnable positions** used to express conviction, participate in games, or secure allocations in repeated on-chain rounds (epochs).

Each program deployment implements a distinct **market / arena / launchpad** with its own:
- Theme (lottery, game, contest, sale…)
- Token (any Token-2022 mint)
- Resolution logic (admin for now, oracle/VRF/DAO later)
- Reward policy (how much of the treasury is paid out per epoch)

This is **not** a traditional prediction market or staking system. It's closer to:
- **Time-weighted tickets**
- **Single-use, burn-to-participate positions**
- **Loyalty / conviction measured by time**
- **A base layer for new kinds of lotteries, games, and fundraising**

## Core Concept: Positions

**Positions are time-amplified commitment tickets:**

- **Minted** by paying a fixed `position_price` in a chosen token
- **Non-refundable** – cannot be redeemed back into the payment token
- **Non-transferable** – no secondary market by default
- **Time-weighted** – weight grows with age (depending on `WeightModel`)
- **Consumable** – burned on commitment; one position, one use

They're not staking, not LP shares, not prediction shares. They're closer to:

> **"Aging tickets that become more powerful the longer you hold them, and that you burn when you really care about an outcome or allocation."**

**Key characteristics:**

- **Irreversible commitment** — True skin in the game
- **Time amplification** — Weight grows with age
- **Capital efficiency** — No locked liquidity, AMMs, or order books
- **Proportional rewards** — Winners share based on weight contribution
- **Resolution agnostic** — Works with admin, oracle, DAO, or any resolution mechanism
- **Consumable design** — Burned when used, creating natural scarcity

## Folder Structure

```
programs/anchor_project/src/
├── protocol_core/          # Pure business logic (framework-agnostic)
│   ├── mod.rs
│   └── weight.rs          # Weight calculation functions
│
├── state/                  # Data structures
│   ├── mod.rs
│   ├── config.rs          # Config, WeightModel, ResolutionType
│   ├── position.rs        # PositionAccount, UserState
│   ├── pool.rs            # Pool
│   ├── commitment.rs      # Commitment
│   └── epoch_result.rs    # EpochResult
│
├── implementation/         # Orchestration layer (use-case specific)
│   ├── mod.rs
│   └── logic.rs           # commit_position()
│
├── instructions/           # Anchor entry points
│   ├── mod.rs
│   ├── initialize.rs      # Initialize protocol config
│   ├── mint_position.rs   # Mint user positions
│   ├── initialize_pool.rs # Initialize pools for epoch
│   ├── commit.rs          # Commit positions to pools
│   ├── resolve.rs         # Resolve epoch and select winner
│   └── claim.rs           # Claim rewards
│
├── errors.rs              # Error definitions
└── utils.rs               # Utility functions
```

## Layer Responsibilities

### protocol_core/ (Pure Functions)
**Purpose:** Generic, reusable business logic with no Solana/Anchor dependencies

**Characteristics:**
- Pure functions (no side effects)
- No account/context access
- Framework-agnostic
- Easily testable in isolation
- Can be used by any implementation

**Current Implementation:**
```rust
// protocol_core/weight.rs
pub fn calculate_weight(
    model: WeightModel,
    created_at: i64,
    current_time: i64,
) -> Result<u64>
```

### state/ (Data Structures)
**Purpose:** Shared account structures and configuration enums

**Characteristics:**
- `#[account]` structs
- Configuration enums
- Pure data, no methods
- Used across all layers

**Current Accounts:**

#### Config
Global protocol configuration:
```rust
pub struct Config {
    pub admin: Pubkey,
    pub current_epoch: u64,
    pub total_positions_minted: u64,
    pub position_price: u64,
    pub remaining_total_position: u64,
    pub allowed_mint: Pubkey,
    pub treasury_ata: Pubkey,
    pub weight_model: WeightModel,
    pub resolution_type: ResolutionType,
}
```

#### PositionAccount
User-owned positions that accrue weight over time:
```rust
pub struct PositionAccount {
    pub owner: Pubkey,
    pub user_index: u64,    // User's position counter
    pub global_id: u64,     // Protocol-wide position ID
    pub created_at: i64,    // Unix timestamp for weight calculation
}
```

#### UserState
Tracks user's position count for PDA derivation:
```rust
pub struct UserState {
    pub position_count: u64,  // Increments with each position minted
}
```

#### Pool
Pools for each epoch where users commit positions:
```rust
pub struct Pool {
    pub id: u8,
    pub epoch: u64,
    pub total_positions: u64,
    pub total_weight: u64,
}
```

#### Commitment
Records user's commitment to a pool in an epoch:
```rust
pub struct Commitment {
    pub user_pk: Pubkey,
    pub position_amount: u64,  // Number of positions committed
    pub weight: u64,           // Total weight accumulated
    pub pool_id: u8,
    pub epoch: u64,
}
```

#### EpochResult
Stores resolution results for an epoch:
```rust
pub struct EpochResult {
    pub epoch: u64,
    pub weight: u64,                 // Total weight of winning pool
    pub total_position_amount: u64,  // Total positions in winning pool
    pub winning_pool_id: u8,
}
```

**Enums:**

```rust
pub enum WeightModel {
    Constant,    // weight = 1
    TimeBased,   // weight = age (current_time - created_at)
}

pub enum ResolutionType {
    Admin,  // Admin resolves manually
    // Future: Oracle, Timelock
}
```

### implementation/ (Orchestration)
**Purpose:** Implementation-specific business logic that coordinates operations

**Characteristics:**
- Uses protocol_core functions
- Access to accounts/context
- Coordinates multiple operations
- Contains game-specific rules

**Current Implementation:**
```rust
// implementation/logic.rs
pub fn commit_position(
    pool: &mut Pool,
    position: &PositionAccount,
    config: &Config,
    commitment: &mut Commitment,
) -> Result<()> {
    let clock = Clock::get()?;
    let weight = calculate_weight(
        config.weight_model,
        position.created_at,
        clock.unix_timestamp,
    )?;

    pool.total_positions += 1;
    pool.total_weight += weight;

    commitment.weight += weight;
    commitment.position_amount += 1;

    Ok(())
}
```

### instructions/ (Anchor Entry Points)
**Purpose:** Thin wrappers that validate accounts and delegate to implementation

**Characteristics:**
- `#[derive(Accounts)]` structs
- Account constraints and validation
- Minimal business logic
- Extracts accounts and calls implementation

**Current Instructions:**

1. **initialize** - Initialize protocol configuration
2. **mint_position** - Mint a new position (burns tokens, creates position account)
3. **initialize_pool** - Create a pool for the current epoch
4. **commit** - Commit a position to a pool (burns position, records commitment)
5. **resolve** - Resolve an epoch and select winning pool
6. **claim** - Claim rewards from winning pool

## Design Principles

### 1. Separation of Concerns
- **Pure logic** (protocol_core) is separate from **state management** (implementation)
- **Account validation** (instructions) is separate from **business logic** (implementation)

### 2. Reusability
- protocol_core functions can be:
  - Tested independently
  - Reused in different implementations
  - Composed to build complex logic

### 3. Extensibility
To add new features:
1. Add pure calculation logic to `protocol_core/`
2. Add orchestration to `implementation/`
3. Add instruction wrapper to `instructions/`

### 4. Testability
- protocol_core functions can be unit tested without Solana
- implementation functions can be tested with mock accounts
- instructions are integration tested end-to-end

## Game Flow

### 1. Protocol Initialization (Admin)
```
initialize() → Creates Config account with admin, mint, treasury
```

### 2. Epoch Setup (Admin)
```
initialize_pool(pool_id=0) → Creates Pool for current epoch
initialize_pool(pool_id=1) → Creates another Pool
```

### 3. User Participation
```
mint_position() → User pays tokens → Position created (starts aging)
  ↓ (wait for weight to accumulate)
commit(position_id, pool_id) → Position burned → Commitment recorded
```

### 4. Epoch Resolution (Admin)
```
resolve(pool_ids=[0,1,2]) → Selects winning pool → Creates EpochResult
  ↓ (increments current_epoch)
New epoch begins → Back to step 2
```

### 5. Claiming Rewards (Users)
```
claim(pool_id, epoch) → Verifies commitment → Transfers proportional reward
```

## Weight Calculation

### TimeBased Model (Default)
Position weight increases linearly with age:
```
weight = current_time - created_at
```

**Example:**
- Position created at timestamp 1000
- Committed at timestamp 1500
- Weight = 1500 - 1000 = 500

**Strategy:** Users who hold positions longer before committing get more weight and thus larger rewards.

### Constant Model
All positions have equal weight:
```
weight = 1
```

**Use case:** When timing doesn't matter, only the number of positions.

## Reward Distribution

Rewards are distributed proportionally based on weight:

```
user_reward = (user_weight / total_winning_pool_weight) × total_position_cost
```

**Example:**
- 3 users committed to winning pool
- User A: weight 100 (1 position held 100 seconds)
- User B: weight 200 (1 position held 200 seconds)
- User C: weight 300 (1 position held 300 seconds)
- Total weight: 600
- Total position cost: 3000 tokens

Rewards:
- User A: (100/600) × 3000 = 500 tokens
- User B: (200/600) × 3000 = 1000 tokens
- User C: (300/600) × 3000 = 1500 tokens

## Key Features

### Position Lifecycle
1. **Mint** - User pays tokens, receives position
2. **Age** - Position accumulates weight over time
3. **Commit** - Position is burned, commitment recorded with weight
4. **Claim** - If pool won, user claims proportional reward

### Multi-Commitment Support
Users can commit multiple positions to the same pool:
- Each commitment adds to the user's total weight
- `commitment.position_amount` tracks how many positions
- `commitment.weight` accumulates across all committed positions

### Epoch Advancement
When an epoch is resolved:
1. Winning pool is selected
2. EpochResult is created
3. `config.current_epoch` is incremented
4. New pools can be initialized for the new epoch

### Reward Forwarding
If the winning pool has no participants:
- Rewards are kept in treasury
- Effectively forwarded to the next epoch's pool

## PDA Seeds

**Config:**
```
["config"]
```

**Treasury:**
```
["treasury"]
```

**User State:**
```
["user_state", user_pubkey]
```

**Position:**
```
["position", user_pubkey, position_id_le_bytes]
```
- `position_id` comes from `user_state.position_count`
- Increments even when positions are burned

**Pool:**
```
["pool", pool_id_byte, epoch_le_bytes]
```

**Commitment:**
```
["commitment", user_pubkey, pool_id_byte, epoch_le_bytes]
```

**Epoch Result:**
```
["epoch_result", epoch_le_bytes]
```

## Future Extensions

### Adding New Weight Models
1. Add variant to `WeightModel` enum in `state/config.rs`
2. Add calculation logic in `protocol_core/weight.rs`
3. No changes needed in implementation or instructions!

**Example: Exponential weight**
```rust
pub enum WeightModel {
    Constant,
    TimeBased,
    Exponential { base: u64 },  // weight = base^age
}
```

### Adding Oracle Resolution
1. Add `Oracle { oracle_pubkey: Pubkey }` to `ResolutionType`
2. Create `protocol_core/oracle.rs` for verification logic
3. Update `instructions/resolve.rs` to accept oracle signatures

### Adding NFT Positions
Currently positions are stored in program accounts. Could be extended to:
1. Mint Token-2022 NFTs instead
2. Store metadata in position account
3. Allow transferability

## Benefits of This Architecture

1. **Clean separation** - Each layer has a single responsibility
2. **Easy to test** - Pure functions can be tested without Solana
3. **Reusable** - Core logic works with any implementation
4. **Extensible** - Add features without modifying existing code
5. **Fork-friendly** - Others can reuse protocol_core with their own implementation

## Scripts and Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for deployment instructions.
See [scripts/README.md](scripts/README.md) for interaction script usage.

### Admin Scripts
- `yarn admin:init-pool --network=localnet --pool-id=0`
- `yarn admin:resolve --network=localnet --pool-ids=0,1,2`

### User Scripts
- `yarn user:mint --network=localnet`
- `yarn user:commit --network=localnet --position-id=0 --pool-id=0`
- `yarn user:claim --network=localnet --pool-id=0 --epoch=1`
