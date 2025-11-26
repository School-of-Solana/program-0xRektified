use anchor_lang::prelude::*;

use anchor_lang::solana_program::system_instruction::create_account;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::Discriminator;

use crate::state::{Config, Pool, EpochResult, EpochResultState};
use crate::{errors::Errors};
use crate::constants::{
    SEED_CONFIG,
    SEED_EPOCH_RESULT,
    SEED_POOL,
    MAX_POOLS_PER_INIT
};


// @note Explicit 'info lifetime required because we iterate over ctx.remaining_accounts
// while also accessing ctx.accounts, creating overlapping borrows that need explicit lifetimes.
pub fn initialize_pool<'info>(
    ctx: Context<'_, '_, '_, 'info, StartContext<'info>>,
    num_pools: u8) -> Result<()> {
    require!(num_pools <= MAX_POOLS_PER_INIT, Errors::TooManyPools);
    require!(
        ctx.remaining_accounts.len() >= num_pools as usize,
        Errors::NotEnoughAccounts
    );
    let current_epoch = ctx.accounts.config.current_epoch;
    let space = 8 + Pool::INIT_SPACE;
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(space);

    for (i, remaining_account) in ctx.remaining_accounts
        .iter().take(num_pools as usize).enumerate() {
        let index = i as u8;
        let seeds = &[
            SEED_POOL,
            &index.to_be_bytes(),
            &current_epoch.to_le_bytes(),
        ];
        let (expected_pda, bump) = Pubkey::find_program_address(
            seeds,
            ctx.program_id
        );
        require_keys_eq!(remaining_account.key(), expected_pda);

        let seeds_with_bump = &[
            SEED_POOL,
            &index.to_be_bytes(),
            &current_epoch.to_le_bytes(),
            &bump.to_le_bytes(),
        ];

        let ix = create_account(
            ctx.accounts.signer.key,
            &expected_pda,
            lamports,
            space as u64,
            ctx.program_id,
        );

        invoke_signed(
            &ix,
            &[
                ctx.accounts.signer.to_account_info(),
                remaining_account.clone(),
                ctx.accounts.system_program.to_account_info(),
                ],
            &[seeds_with_bump],
        )?;

        let mut data = remaining_account.try_borrow_mut_data()?;
        // Write the discriminator (8 bytes)
        data[0..8].copy_from_slice(&<Pool as Discriminator>::DISCRIMINATOR);
        // Now write the Pool struct fields in order
        // Based on Pool struct: { total_positions: u64, total_weight: u64, id: u8, epoch: u64 }
        let mut offset = 8;
        // total_positions: u64 (8 bytes)
        data[offset..offset + 8].copy_from_slice(&0u64.to_le_bytes());
        offset += 8;
        // total_weight: u64 (8 bytes)
        data[offset..offset + 8].copy_from_slice(&0u64.to_le_bytes());
        offset += 8;
        // id: u8 (1 byte)
        data[offset] = index;
        offset += 1;
        // epoch: u64 (8 bytes)
        data[offset..offset + 8].copy_from_slice(&current_epoch.to_le_bytes());
    }

    let clock = Clock::get()?;
    let timestamp = clock.unix_timestamp;
    ctx.accounts.epoch_result.epoch = current_epoch;
    ctx.accounts.epoch_result.epoch_result_state = EpochResultState::Active;
    ctx.accounts.epoch_result.pool_count = num_pools;
    ctx.accounts.epoch_result.end_at = timestamp + ctx.accounts.config.epoch_duration;

    Ok(())
}

#[derive(Accounts)]
#[instruction(id: u8)]
pub struct StartContext<'info>{

    #[account(
        mut,
        constraint = signer.key() == config.resolver.key()
    )]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_CONFIG],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = signer,
        space = 8 + EpochResult::INIT_SPACE,
        seeds = [
            SEED_EPOCH_RESULT,
            config.current_epoch.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub epoch_result: Account<'info, EpochResult>,

    pub system_program: Program<'info, System>,
}
