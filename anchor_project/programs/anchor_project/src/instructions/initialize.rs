use anchor_lang::{prelude::*, solana_program::native_token::LAMPORTS_PER_SOL};
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{TokenAccount, TokenInterface},
};
use crate::{errors::Errors};
use crate::state::{Config, WeightModel, ResolutionType};
use crate::constants::{SEED_CONFIG, SEED_TREASURY};

pub fn initialize(
    ctx: Context<Initialize>,
    weight_model: WeightModel,
    resolution_type: ResolutionType,
    resolver: Pubkey,
    epoch_duration: i64,
    weight_rate_numerator: u64,
    weight_rate_denominator: u64,
) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.signer.to_account_info().key();
    config.resolver = resolver;
    config.current_epoch = 1;
    config.epoch_duration = epoch_duration;
    config.total_positions_minted = 0;
    config.remaining_total_position = 0;
    config.position_price = LAMPORTS_PER_SOL
        .checked_mul(1000)
        .ok_or(error!(Errors::InvalidMul))?;
    config.allowed_mint = ctx.accounts.mint.key();
    config.treasury_ata = ctx.accounts.treasury_ata.key();
    config.weight_model = weight_model;
    config.resolution_type = resolution_type;
    config.weight_rate_numerator = weight_rate_numerator;
    config.weight_rate_denominator = weight_rate_denominator;
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    /// CHECK: We only need to store the mint pubkey, not validate its data
    pub mint: AccountInfo<'info>,

    #[account(
        init,
        payer = signer,
        space = 8 + Config::INIT_SPACE,
        seeds = [SEED_CONFIG],
        bump
    )]
    pub config: Account<'info, Config>,

    /// CHECK: Tresury pda to sign transfer
    #[account(
        seeds = [SEED_TREASURY],
        bump
    )]
    pub treasury_pda: AccountInfo<'info>,

    #[account(
        init,
        payer= signer,
        associated_token::mint = mint,
        associated_token::authority = treasury_pda,
        associated_token::token_program = token_program
    )]
    pub treasury_ata: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}