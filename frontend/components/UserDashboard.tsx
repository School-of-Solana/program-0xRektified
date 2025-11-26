'use client';

import { useState, useEffect } from 'react';
import { useFaucetProgram } from '@/hooks/useFaucetProgram';
import { useProtocol } from '@/contexts/ProtocolContext';
import { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { CurrentCommitments } from './CurrentCommitments';
import { useAnchorProgram } from '@/hooks/useAnchorProgram';
import { getPositionPda, getUserStatePda } from '@/lib/pda';

export function UserDashboard() {
  const { program: faucetProgram, wallet } = useFaucetProgram();
  const { program, programId } = useAnchorProgram();
  const { config, positions, refetch } = useProtocol();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [mintLoading, setMintLoading] = useState(false);
  const [faucetError, setFaucetError] = useState<string | null>(null);
  const [faucetSuccess, setFaucetSuccess] = useState<string | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintSuccess, setMintSuccess] = useState<string | null>(null);
  const [hasClaimed, setHasClaimed] = useState(false);

  // Check localStorage for faucet claim status
  useEffect(() => {
    if (!wallet) {
      setHasClaimed(false);
      return;
    }

    const claimKey = `faucet_claimed_${wallet.publicKey.toBase58()}`;
    const claimed = localStorage.getItem(claimKey);
    setHasClaimed(claimed === 'true');
  }, [wallet]);

  useEffect(() => {
    if (!wallet || !config || !faucetProgram) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        const userTokenAccount = getAssociatedTokenAddressSync(
          config.allowedMint,
          wallet.publicKey,
          false,
          TOKEN_2022_PROGRAM_ID
        );

        const tokenAccountInfo = await faucetProgram.provider.connection.getTokenAccountBalance(userTokenAccount);

        setBalance(tokenAccountInfo.value.uiAmount || 0);
      } catch (err) {
        setBalance(0);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [wallet, config, faucetProgram]);

  const handleFaucet = async () => {
    if (!faucetProgram || !wallet || !config) return;
    setLoading(true);
    setFaucetError(null);
    setFaucetSuccess(null);
    try {
      const tx = await faucetProgram.methods
        .claim()
        .accountsPartial({
          signer: wallet.publicKey,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      // Store claim status in localStorage
      const claimKey = `faucet_claimed_${wallet.publicKey.toBase58()}`;
      localStorage.setItem(claimKey, 'true');
      setHasClaimed(true);

      setFaucetSuccess(`Crystals claimed!`);
      console.log('Faucet transaction:', tx);
      setTimeout(() => setFaucetSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to call Faucet:', err);
      setFaucetError(err.message || 'Failed to claim');
      setTimeout(() => setFaucetError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async () => {
    if (!program || !wallet || !programId || !config) {
      setMintError('Please connect your wallet first');
      setTimeout(() => setMintError(null), 3000);
      return;
    }

    setMintLoading(true);
    setMintError(null);
    setMintSuccess(null);

    try {
      const [userStatePda] = getUserStatePda(wallet.publicKey, programId);

      let positionId = 0;
      try {
        const userStateAccount = await program.account.userState.fetch(userStatePda);
        positionId = userStateAccount.positionCount.toNumber();
      } catch (err) {
        positionId = 0;
      }

      const [positionPda] = getPositionPda(wallet.publicKey, positionId, programId);

      const tx = await program.methods
        .mintPosition()
        .accountsPartial({
          signer: wallet.publicKey,
          position: positionPda,
          mint: config.allowedMint,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      setMintSuccess(`Crystal forged! Transaction: ${tx.slice(0, 8)}...`);
      await refetch();
      setTimeout(() => setMintSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to mint position:', err);
      setMintError(err.message || 'Failed to forge crystal');
      setTimeout(() => setMintError(null), 3000);
    } finally {
      setMintLoading(false);
    }
  };

  if (!wallet) {
    return (
      <div className="space-y-4">
        {/* Crystal Shards Balance - Empty State */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border-2 border-blue-100 dark:border-blue-900">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">
                Crystal Shards
              </h3>
              <p className="text-3xl font-bold text-slate-400 dark:text-slate-500">
                --
                <span className="text-lg text-slate-400 dark:text-slate-500 ml-2">CRYS</span>
              </p>
            </div>
            <div className="text-right">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500/50 to-purple-500/50 rounded-full flex items-center justify-center text-3xl shadow-lg opacity-50">
                💰
              </div>
            </div>
          </div>

          <button
            disabled
            className="w-full px-4 py-3 bg-gray-400 dark:bg-gray-600 text-white rounded-lg font-semibold cursor-not-allowed"
          >
            Connect Wallet to Claim
          </button>
        </div>

        {/* Crystal Collection - Empty State */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border-2 border-purple-100 dark:border-purple-900">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
              Crystal Collection
            </h3>
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-full">
              -- CRYS
            </span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-2xl font-bold text-slate-400 dark:text-slate-500">0</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Active Crystals
              </p>
            </div>
            <div className="text-4xl opacity-50">💎</div>
          </div>

          <button
            disabled
            className="w-full px-4 py-3 bg-gray-400 dark:bg-gray-600 text-white rounded-lg font-semibold cursor-not-allowed"
          >
            Connect Wallet to Forge
          </button>
        </div>

        {/* Current Commitments - Empty State */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border-2 border-blue-100 dark:border-blue-900">
          <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3 uppercase tracking-wide">
            Season Commitments
          </h3>
          <div className="text-center py-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Connect wallet to view commitments
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Crystal Shards Balance */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border-2 border-blue-100 dark:border-blue-900">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">
              Crystal Shards
            </h3>
            <p className="text-3xl font-bold text-slate-900 dark:text-white">
              {balance !== null ? (
                <>
                  {balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                  <span className="text-lg text-slate-500 dark:text-slate-400 ml-2">CRYS</span>
                </>
              ) : (
                'Loading...'
              )}
            </p>
          </div>
          <div className="text-right">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-3xl shadow-lg">
              💰
            </div>
          </div>
        </div>

        {/* Faucet Button */}
        {!hasClaimed && (
          <button
            onClick={handleFaucet}
            disabled={loading}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg transition-all font-semibold shadow-md hover:shadow-lg transform hover:scale-[1.02] disabled:transform-none"
          >
            {loading ? 'Claiming...' : 'Claim from Faucet to Start'}
          </button>
        )}

        {faucetSuccess && (
          <div className="mt-3 p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
            <p className="text-cyan-700 dark:text-cyan-300 text-sm font-medium text-center">
              {faucetSuccess}
            </p>
          </div>
        )}

        {faucetError && (
          <div className="mt-3 p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200 dark:border-pink-800">
            <p className="text-pink-700 dark:text-pink-300 text-sm font-medium text-center">
              {faucetError}
            </p>
          </div>
        )}
      </div>

      {/* Crystal Collection Summary */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-6 border-2 border-purple-100 dark:border-purple-900">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">
            Crystal Collection
          </h3>
          {config && (
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-1 rounded-full">
              {config.positionPrice / 1e9} CRYS
            </span>
          )}
        </div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {positions.length}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Active Crystals
            </p>
          </div>
          <div className="text-4xl">💎</div>
        </div>

        {/* Forge Button */}
        <button
          onClick={handleMint}
          disabled={mintLoading || !config}
          className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg transition-all font-semibold shadow-md hover:shadow-lg transform hover:scale-[1.02] disabled:transform-none"
        >
          {mintLoading ? 'Forging...' : 'Forge New Crystal'}
        </button>

        {mintSuccess && (
          <div className="mt-3 p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
            <p className="text-cyan-700 dark:text-cyan-300 text-sm font-medium text-center">
              {mintSuccess}
            </p>
          </div>
        )}

        {mintError && (
          <div className="mt-3 p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg border border-pink-200 dark:border-pink-800">
            <p className="text-pink-700 dark:text-pink-300 text-sm font-medium text-center">
              {mintError}
            </p>
          </div>
        )}
      </div>

      {/* @todo Current Commitments */}
      {/* <CurrentCommitments /> */}
    </div>
  );
}
