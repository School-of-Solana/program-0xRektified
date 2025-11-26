use anchor_lang::prelude::*;
use crate::state::{ResolutionType, Config};
use crate::constants::SEED_CONFIG;

pub fn update_resolution_type(
    ctx: Context<UpdateConfig>,
    resolution_type: ResolutionType,
) -> Result<()> {
    ctx.accounts.config.resolution_type = resolution_type;
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        constraint = config.admin == signer.key()
    )]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_CONFIG],
        bump
    )]
    pub config: Account<'info, Config>,
}