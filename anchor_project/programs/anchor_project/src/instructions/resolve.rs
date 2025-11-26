use anchor_lang::prelude::*;
use anchor_lang::AccountDeserialize;
use crate::state::{Config, ResolutionType, Pool, EpochResult, EpochResultState};
use crate::{errors::Errors};
use crate::constants::{SEED_CONFIG, SEED_EPOCH_RESULT};
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;

pub fn callback_resolve(
    ctx: Context<CallbackResolve>,
    randomness: [u8; 32],
) -> Result<()> {
    let pool_count = ctx.accounts.epoch_result.pool_count;
    let rnd_u8 = ephemeral_vrf_sdk::rnd::random_u8_with_range(
        &randomness,
         0,
         pool_count - 1
    );
    let winning_weight = ctx.accounts.epoch_result.pool_weights[rnd_u8 as usize];

    ctx.accounts.epoch_result.winning_pool_id = rnd_u8;
    ctx.accounts.epoch_result.weight = winning_weight;

    if winning_weight == 0 {
        ctx.accounts.config.remaining_total_position = ctx.accounts.epoch_result.total_position_amount;
    }
    ctx.accounts.epoch_result.epoch_result_state = EpochResultState::Resolved;

    Ok(())
}

/// Calculate totals, store pool weights, and delete pool PDAs
fn weight_and_reward_split_with_delete<'info>(
    accounts: &mut ResolveContext<'_>,
    remaining_accounts: &[AccountInfo<'info>],
) -> Result<()>{
    let current_epoch = accounts.config.current_epoch;

    let mut total_position_amount: u64 = 0;
    if accounts.config.remaining_total_position > 0 {
        total_position_amount = total_position_amount
            .checked_add(accounts.config.remaining_total_position)
            .ok_or(error!(crate::errors::Errors::InvalidAdd))?;
        accounts.config.remaining_total_position = 0;
    }

    let pool_count = remaining_accounts.len() as u8;
    accounts.epoch_result.pool_count = pool_count;

    for account_info in remaining_accounts.iter() {
        let mut data: &[u8] = &account_info.try_borrow_data()?;
        let pool = Pool::try_deserialize(&mut data)?;

        require!(pool.epoch == current_epoch, Errors::EpochMismatch);
        total_position_amount = total_position_amount
            .checked_add(pool.total_positions)
            .ok_or(error!(crate::errors::Errors::InvalidAdd))?;

        accounts.epoch_result.pool_weights[pool.id as usize] = pool.total_weight;

        // Delete pool pda
        let pool_lamport = account_info.lamports();
        **account_info.try_borrow_mut_lamports()? = 0;
        **accounts.signer.to_account_info().try_borrow_mut_lamports()? += pool_lamport;
    }
    accounts.epoch_result.total_position_amount = total_position_amount;
    accounts.epoch_result.epoch = current_epoch;
    accounts.config.current_epoch = current_epoch
        .checked_add(1)
        .ok_or(error!(Errors::InvalidAdd))?;
    Ok(())
}

pub fn resolve(
    ctx: Context<ResolveContext>,
    client_seed: u8,
) -> Result<()>{

    // Check that epoch has ended before allowing resolution
    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp;
    require!(
        current_time >= ctx.accounts.epoch_result.end_at,
        Errors::EpochNotEnded
    );

    match ctx.accounts.config.resolution_type {
        ResolutionType::Admin => {
            ctx.accounts.epoch_result.epoch_result_state = EpochResultState::Pending;
            // Delete pools and store weights in epoch_result
            weight_and_reward_split_with_delete(ctx.accounts, &ctx.remaining_accounts)?;

            // Read winning weight from stored array
            let weight = ctx.accounts.epoch_result.pool_weights[client_seed as usize];
            if weight == 0 {
                ctx.accounts.config.remaining_total_position = ctx.accounts.epoch_result.total_position_amount;
            }
            ctx.accounts.epoch_result.weight = weight;
            ctx.accounts.epoch_result.winning_pool_id = client_seed;
            ctx.accounts.epoch_result.epoch_result_state = EpochResultState::Resolved;
        },
        ResolutionType::Oracle => {
            // Callback accounts + signer (receives lamports from deleted pools)
            let account_metas = vec![
                SerializableAccountMeta {
                    pubkey: ctx.accounts.epoch_result.key(),
                    is_signer: false,
                    is_writable: true,
                },
                SerializableAccountMeta {
                    pubkey: ctx.accounts.config.key(),
                    is_signer: false,
                    is_writable: true,
                },
            ];

            msg!("Requesting randomness...");
            let ix = create_request_randomness_ix(RequestRandomnessParams {
                payer: ctx.accounts.signer.key(),
                oracle_queue: ctx.accounts.oracle_queue.key(),
                callback_program_id: crate::ID,
                callback_discriminator: crate::instruction::CallbackResolve::DISCRIMINATOR.to_vec(),
                caller_seed: [client_seed; 32],
                accounts_metas: Some(account_metas),
                ..Default::default()
            });
            // Store pool weights BEFORE CPI so callback can read them
            ctx.accounts.epoch_result.pool_count = ctx.remaining_accounts.len() as u8;
            for account_info in ctx.remaining_accounts.iter() {
                let mut data: &[u8] = &account_info.try_borrow_data()?;
                let pool = Pool::try_deserialize(&mut data)?;
                ctx.accounts.epoch_result.pool_weights[pool.id as usize] = pool.total_weight;
            }

            // IMPORTANT: CPI must happen BEFORE lamport manipulation
            // See: https://github.com/solana-labs/solana/issues/9711
            ctx.accounts
                .invoke_signed_vrf(&ctx.accounts.signer.to_account_info(), &ix)?;

            // Now process totals and delete pools AFTER the CPI
            weight_and_reward_split_with_delete(ctx.accounts, &ctx.remaining_accounts)?;
            ctx.accounts.epoch_result.epoch_result_state = EpochResultState::Pending;
        },
        // _ => return Err(error![Errors::UnsupportedResolution]),
    }
    Ok(())
}

#[vrf]
#[derive(Accounts)]
pub struct ResolveContext<'info> {
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
        mut,
        seeds = [
            SEED_EPOCH_RESULT,
            config.current_epoch.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub epoch_result: Account<'info, EpochResult>,

    /// CHECK: The oracle queue
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CallbackResolve<'info> {
    /// This check ensure that the vrf_program_identity (which is a PDA) is a signer
    /// enforcing the callback is executed by the VRF program through CPI
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,

    // Note: We use epoch_result.epoch for the seed, not config.current_epoch
    // because current_epoch was already incremented during resolve
    #[account(
        mut,
        seeds = [SEED_EPOCH_RESULT, epoch_result.epoch.to_le_bytes().as_ref()],
        bump
    )]
    pub epoch_result: Account<'info, EpochResult>,

    #[account(
        mut,
        seeds = [SEED_CONFIG],
        bump
    )]
    pub config: Account<'info, Config>,
}