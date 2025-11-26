use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PositionAccount {
    pub owner: Pubkey,
    pub user_index: u64,
    pub global_id: u64,
    pub created_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct UserState {
    pub position_count: u64,
}
