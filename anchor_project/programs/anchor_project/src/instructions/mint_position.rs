use anchor_lang::prelude::*;
use crate::state::{Config, UserState, PositionAccount};
use crate::errors::Errors;
use crate::constants::{SEED_CONFIG, SEED_TREASURY, SEED_POSITION, SEED_USER_STATE};
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

pub fn mint_position(ctx: Context<MintPosition>) -> Result<()> {
    let clock = Clock::get()?;
    let timestamp = clock.unix_timestamp;

    let user_position_count = ctx.accounts.user_state.position_count;
    let global_id = ctx.accounts.config.total_positions_minted;

    ctx.accounts.position.owner = ctx.accounts.signer.key();
    ctx.accounts.position.user_index = user_position_count;
    ctx.accounts.position.global_id = global_id;
    ctx.accounts.position.created_at = timestamp;

    ctx.accounts.user_state.position_count = ctx.accounts.user_state.position_count
        .checked_add(1)
        .ok_or(error!(Errors::InvalidAdd))?;

    ctx.accounts.config.total_positions_minted = ctx.accounts.config.total_positions_minted
        .checked_add(1)
        .ok_or(error!(Errors::InvalidAdd))?;

    // Set transfer

    let transfer_accounts= TransferChecked{
        from: ctx.accounts.user_ata.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.treasury_ata.to_account_info(),
        authority: ctx.accounts.signer.to_account_info(),
    };

    let cpi_context = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        transfer_accounts
    );

    transfer_checked(
        cpi_context,
        ctx.accounts.config.position_price,
        ctx.accounts.mint.decimals,
    )?;

    msg!("Created Position - Global ID: {}, User Index: {}", global_id, user_position_count);
    Ok(())
}

#[derive(Accounts)]
pub struct MintPosition<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = signer,
        associated_token::token_program = token_program,
    )]
    pub user_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        address = config.allowed_mint @ Errors::InvalidAdd,
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK: Treasury PDA that owns the treasury ATA
    #[account(
        seeds = [SEED_TREASURY],
        bump
    )]
    pub treasury_pda: AccountInfo<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = treasury_pda,
        associated_token::token_program = token_program,
    )]
    pub treasury_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + UserState::INIT_SPACE,
        seeds = [SEED_USER_STATE, signer.key().as_ref()],
        bump
    )]
    pub user_state: Account<'info, UserState>,

    // @note todo remove this circuclar dependency
    #[account(
        init,
        payer = signer,
        space = 8 + PositionAccount::INIT_SPACE,
        seeds = [
            SEED_POSITION,
            signer.key().as_ref(),
            user_state.position_count.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub position: Account<'info, PositionAccount>,

    #[account(
        mut,
        seeds = [SEED_CONFIG],
        bump
    )]
    pub config: Account<'info, Config>,

    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}