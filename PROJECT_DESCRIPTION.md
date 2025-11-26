# Project Description

**Deployed Frontend URL:** https://time-weighted-commitment-protocol.vercel.app/app

**Solana Program ID:** `DM5kNZoPPfJkow6oDv9RWaM2aNibRvRByZjyieriGKkG`

---

## Project Overview

### Description

The **Time-Weighted Commitment Protocol (TWCP)** is a Solana program that rewards conviction through time-weighted participation in on-chain games, lotteries, and funding mechanisms. It addresses a core problem in crypto: participants increasingly prioritize short-term speculation over sustained commitment.

This protocol shifts incentives by rewarding long-term holders who demonstrate conviction. Users mint non-transferable, non-refundable "positions" that accumulate weight over time. The longer a position ages before being committed to a pool, the greater the user's allocation share when rewards are distributed.

---

### Key Features

- **Time-Weighted Positions**: Users mint positions that accumulate weight based on age, using configurable weight rates (e.g., 10 weight per 5 minutes)
- **Burn-to-Participate Mechanics**: Positions are consumed when committed to pools one position
- **Multi-Pool Competitive Epochs**: Users commit positions to pools in time-bound epochs; winning pool participants share rewards proportionally by weight
- **Flexible Resolution Systems**:
  - Admin resolution for curated outcomes, demos, and contests
  - Oracle resolution using Magic Block VRF for trustless, provably fair randomness
- **Token-2022 Support**: Compatible with any SPL Token-2022 mint for position payments
- **Non-Refundable, Non-Transferable Positions**: Positions cannot be redeemed or traded
- **Configurable Weight Models**:
  - `TimeBased`: Weight grows with position age using numerator/denominator rate
  - `Constant`: Fixed weight of 1.0 for all positions
- **Epoch End Enforcement**: Commits rejected after epoch deadline to ensure fair participation
- **Integrated Faucet Program**: Testing utility for unlimited token claims on localnet/devnet

---

### How to Use the dApp

1. **Connect Wallet**
   - Visit the frontend and connect a Solana wallet (Phantom, Backpack, Solflare)
   - Select your network (localnet/devnet) using the network switcher

2. **Claim Test Tokens (First Time)**
   - Click "Claim from Faucet to Start" to receive 10000 CRYS tokens
   - Faucet can only be claimed once per wallet (tracked in localStorage)
   - Balance displays at the top of the dashboard

3. **Forge Crystals (Mint Positions)**
   - Click "Forge New Crystal" to mint a position
   - Cost: 1000 CRYS per position (configurable)
   - Each position starts aging immediately upon creation
   - Weight accumulates over time: 10 weight per 5 minutes (default)

4. **Wait for Weight Accumulation**
   - Positions display real-time weight calculations with 3 decimal precision
   - Longer wait = higher weight = larger reward share

5. **Commit to a Pool**
   - Check the epoch countdown timer (60 seconds default)
   - Select a pool (0-3) from the "Season Arena"
   - Choose a position from your collection
   - Click "Commit Crystal" to burn position and join pool
   - Commitment cannot be undone position is consumed

6. **Wait for Epoch Resolution**
   - After epoch deadline, magic box vrf selects winning pool
   - Only participants in the winning pool are eligible for rewards
   - Your share = (your_weight / total_winning_pool_weight) * reward_amount

7. **Claim Rewards**
   - If your pool won, navigate to "Crystal Vault" section
   - View your unclaimed rewards from previous epochs
   - Click "Claim Rewards" to receive proportional CRYS tokens

---

## Program Architecture

The protocol uses a layered architecture separating data structures (`state/`), instruction handlers (`instructions/`), and supporting utilities.

### Core Data Flow

```
User Payment (CRYS) -> Treasury Account
   
Position Minted (with timestamp)
   
Weight Accumulates Over Time
   
Position Committed to Pool (burned)
   
Pool Total Weight Updated
   
Epoch Resolved (winning pool selected)
   
Rewards can be claimed
```

---

### PDA Usage

> All PDAs are derived using canonical seeds with specific byte ordering.

**PDAs Used:**

- **Config PDA**: `["config"]`
  - Purpose: Singleton account storing global protocol configuration
  - Ensures only one config per program deployment
  - Accessible by all instructions for validation

- **Treasury PDA**: `["treasury"]`
  - Purpose: PDA used to derive the Associated Token Account (ATA) for receiving position payments
  - The actual treasury is an ATA owned by this PDA
  - Funds accumulate for reward distribution

- **UserState PDA**: `["user_state", user_pubkey]`
  - Purpose: Tracks user's position count for deterministic PDA generation
  - Increments on each position mint
  - One per user
  - Used to derive next position_id

- **Position PDA**: `["position", user_pubkey, position_id ]`
  - Purpose: Unique address for each user position
  - Position ID derived from UserState.position_count
  - Enables unlimited positions per user without collisions
  - Closed (burned) when committed to pool

- **Pool PDA**: `["pool", pool_id , epoch]`
  - Purpose: Stores pool data for specific pool ID in an epoch
  - Note: pool_id comes BEFORE epoch in seed order
  - Enables multiple pools per epoch (max 10, indexed 0-9)
  - Epoch number ensures isolation between rounds

- **EpochResult PDA**: `["epoch_result", epoch (u64 little-endian)]`
  - Purpose: Stores resolution outcome and metadata for an epoch
  - One per epoch, created when pools are initialized
  - Contains winning pool ID, end timestamp, pool weights array
  - State: Active → Pending (Oracle) → Resolved

- **Commitment PDA**: `["commitment", user_pubkey, pool_id (u8 little-endian), epoch (u64 little-endian)]`
  - Purpose: Records user's commitment to specific pool in epoch
  - One commitment per user per pool per epoch
  - Tracks accumulated weight and position_amount
  - No on-chain claimed flag (tracked client-side)

---

### Program Instructions

**Instructions Implemented:**

- **`initialize`**: Initialize protocol configuration
  - Creates Config PDA with weight model, resolution type, epoch settings
  - Sets up treasury token account for mint payments
  - Admin-only, called once per deployment
  - Validates Token-2022 mint compatibility

- **`mint_position`**: Mint a time-weighted position
  - Transfers `position_price` tokens 2022 from user to treasury
  - Creates Position PDA with current timestamp
  - Increments UserState position counter
  - Mints unlimited positions per user

- **`initialize_pool`**: Initialize pools for new epoch
  - Creates Pool PDAs for specified count (1-10)
  - Creates EpochResult PDA with end timestamp
  - Increments global epoch counter
  - Admin-only, called at start of each epoch

- **`commit`**: Commit position to pool
  - Burns Position PDA (closes account)
  - Calculates weight based on position age
  - Creates/updates Commitment PDA with weight
  - Updates Pool total weight
  - Validates epoch deadline not passed
  - Enforces minimum weight of 1.0 (10,000 scaled)

- **`resolve`**: Resolve epoch and select winner
  - **Admin mode**: Resolver directly selects winning pool ID
  - **Oracle mode**: Requests VRF randomness, stores pool weights in EpochResult
  - Increments epoch counter for next round
  - Resolver-only, called after epoch deadline

- **`callback_resolve`**: Oracle callback for VRF resolution
  - Called by VRF oracle with verified random value
  - Uses randomness to select winning pool index proportional to weights
  - Updates EpochResult with winning pool ID
  - Oracle-only, triggered after VRF generation

- **`claim`**: Claim rewards from winning pool
  - Validates user has unclaimed commitment in winning pool
  - Calculates proportional reward: `(user_weight / pool_total_weight) * reward_amount`
  - Transfers tokens from treasury/reward account to user
  - Marks commitment as claimed
  - Prevents double-claims

---

### Account Structure

```rust
#[account]
pub struct Config {
    pub admin: Pubkey,              // Protocol administrator
    pub resolver: Pubkey,            // Authorized to resolve epochs
    pub weight_model: WeightModel,   // TimeBased or Constant
    pub resolution_type: ResolutionType, // Admin or Oracle
    pub current_epoch: u64,          // Current epoch counter
    pub epoch_duration: i64,         // Seconds per epoch
    pub position_price: u64,         // Lamports to mint position
    pub allowed_mint: Pubkey,        // Token-2022 mint for payments
    pub treasury_ata: Pubkey,        // Treasury token account
    pub weight_rate_numerator: u64,  // Weight accumulation rate (numerator)
    pub weight_rate_denominator: u64, // Weight accumulation rate (denominator)
    pub total_positions_minted: u64, // Global position counter
    pub remaining_total_position: u64, // Optional position cap
}

#[account]
pub struct Position {
    pub owner: Pubkey,        // Position owner
    pub user_index: u64,      // Position ID per user (0, 1, 2, ...)
    pub global_id: u64,       // Unique ID across all positions
    pub created_at: i64,      // Unix timestamp for weight calculation
}

#[account]
pub struct Pool {
    pub epoch: u64,           // Epoch number this pool belongs to
    pub pool_id: u8,          // Pool ID within epoch (0-9)
    pub total_weight: u64,    // Sum of all committed weights (scaled 10,000x)
    pub total_positions: u64, // Count of positions committed
}

#[account]
pub struct EpochResult {
    pub epoch: u64,               // Epoch number
    pub winning_pool_id: u8,      // Selected winning pool (0-9)
    pub pool_weights: Vec<u64>,   // Pool weights for Oracle VRF selection
    pub end_at: i64,              // Epoch deadline timestamp
    pub total_position_amount: u64, // Total positions across all pools
    pub state: EpochResultState,  // Resolved or Pending
}

#[account]
pub struct Commitment {
    pub user: Pubkey,         // User who committed
    pub pool_id: u8,          // Pool committed to
    pub epoch: u64,           // Epoch number
    pub weight: u64,          // Weight contributed (scaled 10,000x)
    pub claimed: bool,        // Whether rewards claimed
}

#[account]
pub struct UserState {
    pub user: Pubkey,         // User pubkey
    pub position_count: u64,  // Counter for position PDA derivation
}

// Enums

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum WeightModel {
    Constant,      // All positions have weight 1.0
    TimeBased,     // Weight = (age � numerator � 10000) / denominator
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ResolutionType {
    Admin,         // Resolver manually selects winner
    Oracle,        // VRF oracle provides trustless randomness
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum EpochResultState {
    Resolved,      // Winning pool selected
    Pending,       // Awaiting Oracle callback
}
```

---

## Testing

### Test Coverage

The protocol includes comprehensive test coverage using Anchor's testing framework with `anchor-litesvm` for fast execution.

**Happy Path Tests:**

- **Initialize Config**: Creates protocol configuration with valid parameters, verifies all fields set correctly
- **Mint Position**: User mints position with payment, verifies Position PDA created with timestamp and treasury receives tokens
- **Initialize Pools**: Admin creates pools for new epoch, verifies Pool PDAs exist and EpochResult created with correct end timestamp
- **Commit Position**: User commits position to pool, verifies Position burned, Commitment created with correct weight, Pool total weight updated
- **Weight Calculation**: Positions age correctly, weight increases over time according to configured rate, minimum weight enforced
- **Resolve Epoch (Admin)**: Resolver selects winning pool, verifies EpochResult updated, epoch counter incremented
- **Claim Rewards**: User in winning pool claims proportional rewards, verifies tokens transferred, commitment marked claimed
- **Multiple Epochs**: Protocol cycles through multiple epochs, verifies state isolation between rounds
- **Multiple Users**: Multiple users mint, commit, and claim independently without conflicts


**Unhappy Path Tests:**

- **Unauthorized Initialize**: Non-admin cannot initialize config `Unauthorized` error
- **Mint Without Payment**: User attempts mint without sufficient balance Token transfer fails
- **Commit After Deadline**: User tries commit after epoch end timestamp `EpochEnded` error
- **Commit Non-Existent Position**: User provides invalid Position PDA Account not found error
- **Commit Same Position Twice**: User attempts to commit already-burned position Account not found error
- **Double Claim**: User tries claiming rewards twice `AlreadyClaimed` error
- **Claim Before Resolution**: User attempts claim before epoch resolved Invalid winning pool error
- **Claim From Losing Pool**: User in non-winning pool tries claim Not eligible error
- **Unauthorized Resolve**: Non-resolver attempts epoch resolution `Unauthorized` error
- **Resolve Before Deadline**: Resolver tries resolving before epoch ends Validation error (optional check)
- **Initialize Pool Without Admin**: Non-admin attempts pool creation `Unauthorized` error
- **Invalid Pool Count**: Admin initializes more than 10 pools Validation error
- **Oracle Callback Wrong Caller**: Non-oracle account calls callback Unauthorized error
- **Overflow Protection**: Large weight values don't cause arithmetic overflow Uses checked math


### Running Tests

```bash
# Run all tests (default: litesvm for speed)
anchor test
```

**Test Framework:** Anchor Test with `anchor-litesvm` for fast in-memory ledger simulation

**Coverage Areas:**
- All instruction handlers (initialize, mint, commit, resolve, claim)
- PDA derivation and account validation
- Weight calculation logic with time progression
- Token transfer mechanics (payments and rewards)
- Error handling and validation checks
- Multi-user and multi-epoch scenarios
- Admin and Oracle resolution modes

> Infortunatly no time for fzzing but i ll try to add it later

---

## Additional Notes for Evaluators

**Project Origin:** Built from scratch based on an original concept. The idea is simple positions that age and accumulate weight over time, then get burned when committed. Users who hold longer get a bigger share of the reward pool.

**Key Technical Features:**
- PDA derivation with multiple seeds and compound seed patterns
- Cross-program invocations (CPI) for Token-2022 transfers
- Oracle integration via VRF callbacks (Magic Block)
- Time-based weight logic with Clock sysvar


**Infrastructure:**
1. **Custom Token-2022 Faucet** - On-demand token minting for testing (localnet/devnet)
2. **Automated Keeper Bot** - Auto-resolves epochs and initializes pools without manual intervention (on my github not pushed in this repo)
3. **Dual Resolution** - Admin (demo/testing) + Oracle (trustless VRF randomness)

**Testing:** `anchor-litesvm` for fast iteration, time simulation via `set_clock`, deterministic tests. VRF tested on devnet (tests use admin mode).

---

**Contact:**

0xRektified - School of Solana Exam Project - https://x.com/0xRektified

---


