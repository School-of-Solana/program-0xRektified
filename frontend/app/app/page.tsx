'use client';

import Link from 'next/link';
import { WalletButton } from '@/components/WalletButton';
import { NetworkSwitcher } from '@/components/NetworkSwitcher';
import { useAnchorProgram } from '@/hooks/useAnchorProgram';
import { UserDashboard } from '@/components/UserDashboard';
import { EpochCountdown } from '@/components/EpochCountdown';
import { CommitPosition } from '@/components/CommitPosition';
import { ClaimRewards } from '@/components/ClaimRewards';
import { CurrentCommitments } from '@/components/CurrentCommitments';
import { PreviousWinner } from '@/components/PreviousWinner';

export default function AppPage() {
  const { program, network, error } = useAnchorProgram();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                ← Learn more
              </Link>
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Demo app
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <NetworkSwitcher />
              </div>
              {error ? (
                <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  Not Connected
                </span>
              ) : program ? (
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Connected
                </span>
              ) : null}
              <WalletButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">
              Connection Error
            </p>
            <p className="text-red-500 dark:text-red-500 text-xs mt-1">
              Make sure you have deployed the program to {network} first.
            </p>
          </div>
        )}

        {/* Season Countdown - Full Width, Prominent */}
        <EpochCountdown />

        {/* Previous Winner Banner */}
        <div className="mt-6">
          <PreviousWinner />
        </div>

        {/* Main Grid Layout */}
        <div className="mt-6 grid lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Collection */}
          <div className="lg:col-span-1 space-y-6">
            <ClaimRewards />
            <UserDashboard />
          </div>

          {/* Main Content - Battle Preparation */}
          <div className="lg:col-span-2">
            <CommitPosition />
          </div>
        </div>
      </main>
    </div>
  );
}
