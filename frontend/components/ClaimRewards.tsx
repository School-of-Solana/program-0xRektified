'use client';

import { useState, useEffect } from 'react';
import { useAnchorProgram } from '@/hooks/useAnchorProgram';
import { useProtocol } from '@/contexts/ProtocolContext';
import { getEpochResultPda, getCommitmentPda } from '@/lib/pda';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import * as anchor from '@coral-xyz/anchor';

interface ClaimableReward {
  poolId: number;
  epoch: number;
  estimatedReward: number;
}

export function ClaimRewards() {
  const { program, wallet, programId } = useAnchorProgram();
  const { config, commitments, refetch, removeCommitment } = useProtocol();
  const [claimableRewards, setClaimableRewards] = useState<ClaimableReward[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!program || !wallet || !programId || !config || config.currentEpoch === 0) {
      setClaimableRewards([]);
      return;
    }

    const fetchClaimableRewards = async () => {
      try {
        const rewards: ClaimableReward[] = [];


        const pastCommitments = commitments.filter(c => c.epoch < config.currentEpoch);

        for (const commitment of pastCommitments) {
          try {
            const [epochResultPda] = getEpochResultPda(commitment.epoch, programId);
            const epochResult = await program.account.epochResult.fetch(epochResultPda);

            if (!epochResult.epochResultState ||
                (epochResult.epochResultState as any).resolved === undefined) {
              continue;
            }

            const winningPoolId = epochResult.winningPoolId;
            if (commitment.poolId !== winningPoolId) {
              removeCommitment(commitment.poolId, commitment.epoch);
              continue;
            }

            const [commitmentPda] = getCommitmentPda(
              wallet.publicKey,
              commitment.poolId,
              commitment.epoch,
              programId
            );

            try {
              const onChainCommitment = await program.account.commitment.fetch(commitmentPda);
              const userWeight = onChainCommitment.weight.toNumber();
              const totalWeight = epochResult.weight.toNumber();
              const totalPositionAmount = epochResult.totalPositionAmount.toNumber();
              const positionPrice = config.positionPrice;
              const totalReward = totalPositionAmount * positionPrice;
              const estimatedReward = totalWeight > 0 ? (userWeight / totalWeight) * totalReward : 0;

              const claimedKey = `claimed_${wallet.publicKey.toString()}_${commitment.poolId}_${commitment.epoch}`;
              const alreadyClaimed = localStorage.getItem(claimedKey) === 'true';

              if (!alreadyClaimed && estimatedReward > 0) {
                rewards.push({
                  poolId: commitment.poolId,
                  epoch: commitment.epoch,
                  estimatedReward,
                });
              } else if (alreadyClaimed) {
                removeCommitment(commitment.poolId, commitment.epoch);
              }
            } catch (err) {
              removeCommitment(commitment.poolId, commitment.epoch);
            }
          } catch (err) {
          }
        }

        setClaimableRewards(rewards);
      } catch (err: any) {
        console.error('Failed to fetch claimable rewards:', err);
      }
    };

    fetchClaimableRewards();
  }, [program, wallet, programId, config, commitments, removeCommitment]);

  const handleClaim = async (reward: ClaimableReward) => {
    if (!program || !wallet || !programId || !config) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const tx = await program.methods
        .claim(reward.poolId, new anchor.BN(reward.epoch))
        .accounts({
          signer: wallet.publicKey,
          tokenMint: config.allowedMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      const rewardAmount = (reward.estimatedReward / 1e9).toFixed(4);
      setSuccess(`Harvested ${rewardAmount} CRYS! Tx: ${tx.slice(0, 8)}...`);
      removeCommitment(reward.poolId, reward.epoch);

      const claimedKey = `claimed_${wallet.publicKey.toString()}_${reward.poolId}_${reward.epoch}`;
      localStorage.setItem(claimedKey, 'true');

      await refetch();

      // Remove this reward from the list
      setClaimableRewards(prev => prev.filter(r => r.poolId !== reward.poolId || r.epoch !== reward.epoch));
    } catch (err: any) {
      setError(err.message || 'Failed to claim rewards');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border-2 border-purple-100 dark:border-purple-900 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-purple-900 dark:text-purple-100 mb-2">
          SEASON REWARDS
        </h2>
        <p className="text-purple-600 dark:text-purple-400 text-sm">
          Harvest your winnings from successful bets
        </p>
      </div>

      {!wallet ? (
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <p className="text-purple-700 dark:text-purple-300 text-sm">
            Connect your wallet to view and claim rewards
          </p>
        </div>
      ) : claimableRewards.length === 0 ? (
        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
          <p className="text-slate-700 dark:text-slate-300 text-sm mb-2">
            No rewards available to harvest
          </p>
          {config && config.currentEpoch === 0 && (
            <p className="text-slate-600 dark:text-slate-400 text-xs">
              Complete at least one season to earn rewards
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {claimableRewards.map((reward) => (
          <div
            key={`${reward.epoch}-${reward.poolId}`}
            className="p-5 bg-slate-50 dark:bg-slate-700/50 rounded-lg shadow-md border-2 border-purple-200 dark:border-purple-800"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="text-lg">🏆</span>
                  Season {reward.epoch} - Auction #{reward.poolId}
                </p>
                <p className="text-sm text-purple-600 dark:text-purple-400 mt-2 font-semibold">
                  Reward: {(reward.estimatedReward / 1e9).toFixed(4)} CRYS
                </p>
              </div>
            </div>

            <button
              onClick={() => handleClaim(reward)}
              disabled={loading}
              className="w-full px-5 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg transition-all font-bold shadow-md hover:shadow-lg transform hover:scale-[1.02] disabled:transform-none"
            >
              {loading ? 'Harvesting...' : 'Harvest Reward'}
            </button>
          </div>
        ))}

        {error && (
          <div className="p-3 bg-pink-50 dark:bg-pink-900/20 rounded border border-pink-200 dark:border-pink-800">
            <p className="text-pink-700 dark:text-pink-300 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded border border-cyan-200 dark:border-cyan-800">
            <p className="text-cyan-700 dark:text-cyan-300 text-sm">{success}</p>
          </div>
        )}
        </div>
      )}
    </div>
  );
}
