use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
pub enum WeightModel {
    Constant,      // weight = 1
    TimeBased,     // weight = age (current_time - created_at)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
pub enum ResolutionType {
    Admin,                              // Admin resolves manually
    Oracle, // Future: Oracle resolution
    // Timelock { resolve_at: i64 },    // Future: Time-based resolution
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub resolver: Pubkey,
    pub current_epoch: u64,
    pub total_positions_minted: u64,
    pub position_price: u64,
    pub remaining_total_position: u64,
    pub allowed_mint: Pubkey,
    pub treasury_ata: Pubkey,

    // Protocol configuration
    pub weight_model: WeightModel,
    pub resolution_type: ResolutionType,
    pub epoch_duration: i64,

    // Weight rate configuration (for TimeBased model)
    // Formula: weight = (age_seconds * numerator) / denominator
    // Example: 10 weight per 5 minutes = numerator: 10, denominator: 300
    pub weight_rate_numerator: u64,
    pub weight_rate_denominator: u64,
}
