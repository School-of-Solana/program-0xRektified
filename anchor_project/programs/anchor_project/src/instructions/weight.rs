use anchor_lang::prelude::*;
use crate::state::WeightModel;
use crate::errors::Errors;

/// Precision multiplier for weight calculations
/// All weights are stored as weight * WEIGHT_PRECISION
/// This allows for sub-second precision while using integer math
pub const WEIGHT_PRECISION: u64 = 10_000;

/// Calculate weight based on the configured weight model
/// Returns weight scaled by WEIGHT_PRECISION (10,000)
pub fn calculate_weight(
    model: WeightModel,
    created_at: i64,
    current_time: i64,
    weight_rate_numerator: u64,
    weight_rate_denominator: u64,
) -> Result<u64> {
    match model {
        WeightModel::Constant => {
            // Constant weight = 1.0 = 10,000 (scaled)
            Ok(WEIGHT_PRECISION)
        },

        WeightModel::TimeBased => {
            // Calculate age in seconds
            let age = current_time
                .checked_sub(created_at)
                .ok_or(error!(Errors::InvalidCalculation))?;

            if age < 0 {
                return err!(Errors::InvalidCalculation);
            }

            // Prevent division by zero
            if weight_rate_denominator == 0 {
                return err!(Errors::InvalidCalculation);
            }

            let age_u64 = age as u64;

            // Calculate weight using the rate formula with precision scaling
            // Formula: (age * numerator * WEIGHT_PRECISION) / denominator
            //
            // Example: 10 weight per 300 seconds (5 min), WEIGHT_PRECISION = 10,000
            //   - After 300 seconds: (300 * 10 * 10,000) / 300 = 100,000 (= 10.0000)
            //   - After 150 seconds: (150 * 10 * 10,000) / 300 = 50,000 (= 5.0000)
            //   - After 30 seconds:  (30 * 10 * 10,000) / 300 = 10,000 (= 1.0000)
            //   - After 15 seconds:  (15 * 10 * 10,000) / 300 = 5,000 (= 0.5000)
            //   - After 3 seconds:   (3 * 10 * 10,000) / 300 = 1,000 (= 0.1000)
            //
            // This maintains precision even for fractional weights
            let calculated_weight = age_u64
                .checked_mul(weight_rate_numerator)
                .ok_or(error!(Errors::InvalidMul))?
                .checked_mul(WEIGHT_PRECISION)
                .ok_or(error!(Errors::InvalidMul))?
                .checked_div(weight_rate_denominator)
                .ok_or(error!(Errors::InvalidDiv))?;

            // Always ensure minimum weight of 1.0 (= WEIGHT_PRECISION) to prevent gaming
            // This prevents:
            // 1. Zero weight from instant mint+commit (age = 0)
            // 2. Zero weight from very young positions when rate is slow
            let weight = calculated_weight.max(WEIGHT_PRECISION);

            Ok(weight)
        },
    }
}
