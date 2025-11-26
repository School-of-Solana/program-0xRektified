use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod errors;
pub mod constants;

use instructions::*;
use state::*;

declare_id!("BUgW4g2BkcZVg1eNNXhkYDCCPomdWWeNnrUPQgZzsnDT");

#[program]
pub mod anchor_project {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, weight_model: WeightModel, resolution_type: ResolutionType, resolver: Pubkey, epoch_duration: i64, weight_rate_numerator: u64, weight_rate_denominator: u64) -> Result<()> {
        crate::instructions::initialize(ctx, weight_model, resolution_type, resolver, epoch_duration, weight_rate_numerator, weight_rate_denominator)
    }

    pub fn mint_position(ctx: Context<MintPosition>) -> Result<()> {
        crate::instructions::mint_position(ctx)
    }

    pub fn initialize_pool<'info>(ctx: Context<'_, '_, '_, 'info, StartContext<'info>>, num_pools: u8) -> Result<()> {
        crate::instructions::initialize_pool(ctx, num_pools)
    }

    pub fn commit(ctx: Context<Commit>, position_i: u64, pool_id: u8) -> Result<()> {
        crate::instructions::commit(ctx, position_i, pool_id)
    }

    pub fn resolve(ctx: Context<ResolveContext>, winning_pool_id: u8) -> Result<()> {
        crate::instructions::resolve(ctx, winning_pool_id)
    }

    pub fn claim(ctx: Context<ClaimContext>, pool_id: u8, epoch: u64) -> Result<()> {
        crate::instructions::claim(ctx, pool_id, epoch)
    }

    pub fn callback_resolve(ctx: Context<CallbackResolve>, randomness: [u8; 32],) -> Result<()> {
        crate::instructions::callback_resolve(ctx, randomness)
    }

    pub fn update_resolution_type(ctx: Context<UpdateConfig>, resolution_type: ResolutionType) -> Result<()> {
        crate::instructions::update_resolution_type(ctx, resolution_type)
    }
    
}
