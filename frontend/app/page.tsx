import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-24 text-center">
          {/* Hero Title */}
          <div className="mb-12">
            <h1 className="text-6xl md:text-7xl font-extrabold text-gray-900 dark:text-white mb-6 tracking-tight">
              Time-Weighted<br />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Commitment Protocol
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Rewarding conviction through time-weighted participation in on-chain games, lotteries, and funding mechanisms
            </p>
          </div>

          {/* Problem/Solution Card */}
          <div className="max-w-4xl mx-auto mb-16">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Problem Card */}
              <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-2xl p-8 border-2 border-red-200 dark:border-red-800 shadow-lg">
                <div className="flex items-center justify-center w-12 h-12 bg-red-400 dark:bg-red-600 rounded-xl mb-4 mx-auto">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">The Problem</h2>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  In crypto, participants increasingly prioritize <strong className="text-red-600 dark:text-red-400">short-term speculation</strong> over <strong>sustained commitment</strong>.
                </p>
              </div>

              {/* Solution Card */}
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-8 border-2 border-green-200 dark:border-green-800 shadow-lg">
                <div className="flex items-center justify-center w-12 h-12 bg-green-500 dark:bg-green-600 rounded-xl mb-4 mx-auto">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">The Solution</h2>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  Shift incentives by rewarding <strong className="text-green-600 dark:text-green-400">long-term holders</strong> who demonstrate conviction.
                </p>
              </div>
            </div>

            {/* Key Benefits */}
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center justify-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                How It Works
              </h3>
              <div className="grid md:grid-cols-3 gap-6 text-left">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Time held <strong className="text-gray-900 dark:text-white">directly determines</strong> allocation weight
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    Longer conviction equals <strong className="text-gray-900 dark:text-white">greater share</strong> of rewards
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mt-0.5">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    <strong className="text-gray-900 dark:text-white">Patience and belief</strong> rewarded over quick exits
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <Link
            href="/app"
            className="inline-flex items-center gap-2 px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl text-lg transition-all shadow-2xl hover:shadow-blue-500/50 hover:scale-105 transform"
          >
            Launch Demo App
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>

        <div className="py-20 bg-gradient-to-b from-transparent to-blue-50/30 dark:to-blue-900/10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              What are Positions?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Positions are <strong className="text-blue-600 dark:text-blue-400">time-amplified commitment tickets</strong> that grow in value as you hold them
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            <div className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-blue-100 dark:border-blue-900 hover:border-blue-500">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center text-2xl shadow-lg">
                  💰
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Minted
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Pay a fixed price in any token to create your position. Once minted, the clock starts ticking on your conviction.
              </p>
            </div>

            <div className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-blue-100 dark:border-blue-900 hover:border-blue-500">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center text-2xl shadow-lg">
                  ⏰
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Time-weighted
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Weight grows with age — longer conviction equals greater allocation. Patience is literally rewarded.
              </p>
            </div>

            <div className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-blue-100 dark:border-blue-900 hover:border-blue-500">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center text-2xl shadow-lg">
                  🔒
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Non-refundable
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                True skin in the game — irreversible commitment. No exit, no refund. Your conviction is locked in.
              </p>
            </div>

            <div className="group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 border-2 border-blue-100 dark:border-blue-900 hover:border-blue-500">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center text-2xl shadow-lg">
                  🔥
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Consumable
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                Burned when committed — one position, one use. Your accumulated weight is permanent and non-transferable.
              </p>
            </div>
          </div>
        </div>

        <div className="py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Four simple steps from minting to rewards
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="relative">
              {/* Connecting Line */}
              <div className="hidden md:block absolute left-16 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 via-blue-600 to-cyan-600"></div>

              <div className="space-y-12">
                {/* Step 1 */}
                <div className="relative flex items-start gap-8">
                  <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-2xl flex items-center justify-center font-bold text-2xl shadow-xl z-10">
                    1
                  </div>
                  <div className="flex-1 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border-2 border-blue-100 dark:border-blue-900">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                      Mint Positions
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                      Pay in any token (USDC, SOL, or any SPL-2022 mint) to mint positions that start aging immediately. Your conviction journey begins.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="relative flex items-start gap-8">
                  <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-2xl flex items-center justify-center font-bold text-2xl shadow-xl z-10">
                    2
                  </div>
                  <div className="flex-1 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border-2 border-blue-100 dark:border-blue-900">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                      Accumulate Weight
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                      Each position ages and accumulates weight over time. The longer you hold, the more conviction you demonstrate — patience is mathematically rewarded.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="relative flex items-start gap-8">
                  <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-2xl flex items-center justify-center font-bold text-2xl shadow-xl z-10">
                    3
                  </div>
                  <div className="flex-1 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border-2 border-blue-100 dark:border-blue-900">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                      Commit to Pools
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                      Burn positions to commit to a pool (choice, team, or project). Your accumulated weight is locked in — expressing irreversible conviction.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="relative flex items-start gap-8">
                  <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-2xl flex items-center justify-center font-bold text-2xl shadow-xl z-10">
                    4
                  </div>
                  <div className="flex-1 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border-2 border-blue-100 dark:border-blue-900">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                      Epoch Resolution
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">
                      When the epoch resolves, a winning pool is selected via VRF or admin decision. Rewards are distributed proportionally — your conviction translates directly to allocation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="py-24 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-3xl my-16">
          <div className="text-center max-w-4xl mx-auto px-8">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Ready to Demonstrate Your Conviction?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-12 leading-relaxed">
              Join the protocol that rewards patience and belief. Connect your wallet and start building conviction-weighted positions.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/app"
                className="inline-flex items-center gap-2 px-12 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-xl text-xl transition-all shadow-2xl hover:shadow-blue-500/50 hover:scale-105 transform"
              >
                Launch Demo App
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>

              <a
                href="https://github.com/0xRektified"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-12 py-6 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold rounded-xl text-xl transition-all shadow-lg border-2 border-gray-300 dark:border-gray-600"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                View on GitHub
              </a>
            </div>

            <p className="mt-12 text-sm text-gray-500 dark:text-gray-500 italic">
              The longer you hold before committing, the greater your share. Patience is power.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 dark:border-gray-700 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600 dark:text-gray-400 text-sm">
          <p>MIT License - Built with Anchor on Solana</p>
          <p className="mt-2">
            Original Author:{' '}
            <a
              href="https://github.com/0xRektified"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              0xRektified
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
