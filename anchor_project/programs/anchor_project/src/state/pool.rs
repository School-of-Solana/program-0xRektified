use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub total_positions: u64,
    pub total_weight: u64,
    pub id: u8,
    pub epoch: u64,
}
