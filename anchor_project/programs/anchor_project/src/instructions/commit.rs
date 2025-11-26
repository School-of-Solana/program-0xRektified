use anchor_lang::prelude::*;
use crate::state::{
    PositionAccount,
    Pool,
    Config,
    Commitment,
    EpochResult,
};

use crate::constants::{SEED_CONFIG, SEED_POSITION, SEED_POOL, SEED_COMMITMENT, SEED_EPOCH_RESULT};
use crate::errors::Errors;
use crate::instructions::weight::calculate_weight;

pub fn commit(
    ctx: Context<Commit>,
    _position_id: u64,
    _pool_id: u8,
) -> Result<()> {
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;

    require!(ctx.accounts.epoch_result.end_at > current_time, Errors::EpochEnded);

    let weight = calculate_weight(
        ctx.accounts.config.weight_model,
        ctx.accounts.position.created_at,
        current_time,
        ctx.accounts.config.weight_rate_numerator,
        ctx.accounts.config.weight_rate_denominator,
    )?;

    ctx.accounts.pool.total_positions = ctx.accounts.pool.total_positions
        .checked_add(1)
        .ok_or(error!(Errors::InvalidAdd))?;

    ctx.accounts.pool.total_weight = ctx.accounts.pool.total_weight
        .checked_add(weight)
        .ok_or(error!(Errors::InvalidAdd))?;

    // Initialize commitment on first use (init_if_needed creates zeroed account)
    if ctx.accounts.commitment.position_amount == 0 {
        ctx.accounts.commitment.user_pk = ctx.accounts.position.owner;
        ctx.accounts.commitment.pool_id = ctx.accounts.pool.id;
        ctx.accounts.commitment.epoch = ctx.accounts.pool.epoch;
    }

    // Accumulate weight and increment position count
    ctx.accounts.commitment.weight = ctx.accounts.commitment.weight
        .checked_add(weight)
        .ok_or(error!(Errors::InvalidAdd))?;
    ctx.accounts.commitment.position_amount = ctx.accounts.commitment.position_amount
        .checked_add(1)
        .ok_or(error!(Errors::InvalidAdd))?;

    msg!("Position committed - Weight: {}, Total positions: {}, Total weight: {}",
        weight, ctx.accounts.pool.total_positions, ctx.accounts.pool.total_weight);

    Ok(())
}


#[derive(Accounts)]
#[instruction(
    _position_id: u64,
    _pool_id: u8,
)]
pub struct Commit<'info> {

    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        seeds = [SEED_CONFIG],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [
            SEED_EPOCH_RESULT,
            config.current_epoch.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub epoch_result: Account<'info, EpochResult>,


    #[account(
        mut,
        close = signer,
        seeds = [
            SEED_POSITION,
            signer.key().as_ref(),
            _position_id.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub position: Account<'info, PositionAccount>,

    #[account(
        mut,
        seeds = [
            SEED_POOL,
            _pool_id.to_le_bytes().as_ref(),
            config.current_epoch.to_le_bytes().as_ref()
        ],
        bump,
        constraint = pool.epoch == config.current_epoch @ Errors::EpochMismatch
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + Commitment::INIT_SPACE,
        seeds = [
            SEED_COMMITMENT,
            signer.key().as_ref(),
            pool.id.to_le_bytes().as_ref(),
            pool.epoch.to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub commitment: Account<'info, Commitment>,

    pub system_program: Program<'info, System>,
}