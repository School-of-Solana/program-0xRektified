use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Commitment {
    pub user_pk: Pubkey,
    pub position_amount: u64,
    pub weight: u64,
    pub pool_id: u8,
    pub epoch: u64,
}