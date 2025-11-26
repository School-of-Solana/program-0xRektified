use anchor_lang::prelude::*;
use crate::constants::{
    MAX_POOLS_PER_INIT
};

#[account]
#[derive(InitSpace)]
pub struct EpochResult {
    pub epoch: u64,
    pub weight: u64,
    pub total_position_amount: u64,
    pub end_at: i64,
    pub winning_pool_id: u8,
    pub epoch_result_state: EpochResultState,
    pub pool_count: u8,
    #[max_len(MAX_POOLS_PER_INIT)]
    pub pool_weights: [u64; MAX_POOLS_PER_INIT as usize],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, InitSpace)]
pub enum EpochResultState {
    Active,
    Pending,
    Resolved,
}