use anchor_lang::prelude::*;

#[error_code]
pub enum Errors {
    #[msg("Increase position amount failed")]
    InvalidAdd,

    #[msg("Multiply operation failed")]
    InvalidMul,

    #[msg("Divide operation failed")]
    InvalidDiv,

    #[msg("Invalid calculation - possibly negative age or overflow")]
    InvalidCalculation,

    #[msg("Invalid resolution - invalide resolution")]
    UnsupportedResolution,

    #[msg("Pool epoch does not match the expected epoch")]
    EpochMismatch,

    #[msg("Winning pool not found in provided pools")]
    WinningPoolNotFound,

    #[msg("No pools provided for resolution")]
    NoPoolsProvided,

    #[msg("Invalid pool ID - does not match commitment")]
    InvalidPoolId,

    #[msg("Invalid epoch - does not match commitment")]
    InvalidEpoch,

    #[msg("Commitment has already been claimed")]
    AlreadyClaimed,

    #[msg("Cannot claim from a losing pool")]
    LosingPool,

    #[msg("Oracle queue is required for Oracle resolution")]
    OracleQueueRequired,

    #[msg("Invalid oracle queue address")]
    InvalidOracleQueue,

    #[msg("Invalid pool amount - max 10")]
    TooManyPools,

    #[msg("Invalid pool amount - doesn't match pdas")]
    NotEnoughAccounts,

    #[msg("Epoch has ended - no new commitments allowed")]
    EpochEnded,

    #[msg("Unauthorized: Only the resolver can call this function")]
    UnauthorizedResolver,

    #[msg("Epoch has not ended yet - resolution not allowed")]
    EpochNotEnded,
}