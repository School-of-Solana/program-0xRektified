use anchor_lang::prelude::*;
use crate::{errors::Errors};
use crate::state::{
    Commitment, EpochResult, Config
};
use crate::constants::{
    SEED_CONFIG,
    SEED_EPOCH_RESULT,
    SEED_COMMITMENT,
    SEED_TREASURY
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{
        Mint,
        TokenAccount,
        TransferChecked,
        transfer_checked,
        TokenInterface
    }
};

pub fn claim(ctx: Context<ClaimContext>, pool_id: u8, epoch: u64) -> Result<()> {
    let token_amount = ctx.accounts.epoch_result.total_position_amount
        .checked_mul(ctx.accounts.config.position_price)
        .ok_or(error!(crate::errors::Errors::InvalidMul))?;

    let numerator = ctx.accounts.commitment.weight
        .checked_mul(token_amount)
        .ok_or(error!(crate::errors::Errors::InvalidMul))?;

    let reward = numerator
        .checked_div(ctx.accounts.epoch_result.weight)
        .ok_or(error!(crate::errors::Errors::InvalidDiv))?;

    let treasury_seed = SEED_TREASURY;
    let signer_seeds: &[&[&[u8]]] = &[&[
        treasury_seed,
        &[ctx.bumps.treasury_pda],
    ]];

    let transfer_accounts = TransferChecked {
        from: ctx.accounts.treasury_ata.to_account_info(),
        to: ctx.accounts.user_ata.to_account_info(),
        authority: ctx.accounts.treasury_pda.to_account_info(),
        mint: ctx.accounts.token_mint.to_account_info(),
    };

    let cpi_context = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        transfer_accounts,
        signer_seeds,
    );

    transfer_checked(
        cpi_context,
        reward,
        ctx.accounts.token_mint.decimals,
    )?;

    msg!("Claimed reward: {} tokens for epoch: {}, pool: {}",
        reward, epoch, pool_id);

    Ok(())
}


#[derive(Accounts)]
#[instruction(pool_id: u8, epoch: u64)]
pub struct ClaimContext<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        seeds = [SEED_CONFIG],
        bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [SEED_EPOCH_RESULT, epoch.to_le_bytes().as_ref()],
        bump
    )]
    pub epoch_result: Account<'info, EpochResult>,

    #[account(
        mut,
        close = signer,
        seeds = [
            SEED_COMMITMENT,
            signer.key().as_ref(),
            pool_id.to_le_bytes().as_ref(),
            epoch.to_le_bytes().as_ref(),
        ],
        bump,
        constraint = epoch_result.winning_pool_id == pool_id @ Errors::LosingPool,
    )]
    pub commitment: Account<'info, Commitment>,

    /// CHECK: Treasury PDA that owns the treasury ATA
    #[account(
        seeds = [SEED_TREASURY],
        bump
    )]
    pub treasury_pda: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = treasury_pda,
        associated_token::token_program = token_program,
    )]
    pub treasury_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = signer,
        associated_token::token_program = token_program,
    )]
    pub user_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        address = config.allowed_mint @ Errors::InvalidAdd,
    )]
    pub token_mint: InterfaceAccount<'info, Mint>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
}