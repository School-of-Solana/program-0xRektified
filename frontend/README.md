# Time-Weighted Commitment Protocol - Frontend

Web interface for the Time-Weighted Commitment Protocol, enabling users to mint time-weighted positions, commit to pools, and claim rewards.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

The app automatically detects the deployed network from `deployments/deployment-{network}.json` files. Switch networks in the UI.

## Prerequisites

- Node.js 18+
- Solana wallet (Phantom, Backpack, or compatible)
- Program deployed on target network
- IDL files in `idl/` directory

## Features

- **Faucet**: Claim test tokens (10000 CRYS)
- **Position Minting**: Forge time-weighted crystals
- **Pool Commitments**: Commit positions to pools in active epochs
- **Weight Display**: Real-time weight calculation with aging
- **Reward Claims**: Claim proportional rewards from winning pools

## Project Structure

```
frontend/
├── app/                        # Next.js App Router
│   ├── api/                   # Server-side API routes
│   │   ├── config/           # Protocol configuration
│   │   ├── pools/            # Pool data
│   │   ├── positions/        # User positions
│   │   ├── epoch/            # Current epoch
│   │   └── commitments/      # User commitments
│   ├── page.tsx              # Main page
│   └── layout.tsx            # Root layout
├── components/                # React components
│   ├── UserDashboard.tsx     # Balance & minting
│   ├── CommitPosition.tsx    # Pool commitments
│   ├── ClaimRewards.tsx      # Reward claims
│   ├── EpochCountdown.tsx    # Epoch timer
│   ├── NetworkSwitcher.tsx   # Network selector
│   ├── PreviousWinner.tsx    # Winner display
│   └── WalletProvider.tsx    # Wallet integration
├── contexts/                  # React contexts
│   └── ProtocolContext.tsx   # Global state
├── hooks/                     # Custom hooks
│   ├── useAnchorProgram.ts   # Main program
│   ├── useFaucetProgram.ts   # Faucet program
│   ├── useGameState.ts       # Game state
│   └── usePools.ts           # Pool fetching
├── lib/                       # Utilities
│   ├── api/rpc.ts            # Server-side RPC
│   ├── pda.ts                # PDA derivation
│   └── constants.ts          # Constants
├── idl/                       # Generated IDL & types
│   ├── anchor_project.json   # Main program IDL
│   ├── anchor_project.ts     # TypeScript types
│   ├── faucet.json           # Faucet IDL
│   └── faucet.ts             # Faucet types
└── deployments/               # Deployment info
    └── deployment-{network}.json
```

## API Routes

All routes return JSON:

- `GET /api/config` - Protocol configuration (weight model, epoch duration, position price)
- `GET /api/pools?epoch=N` - Pools for epoch N (defaults to current)
- `GET /api/positions?owner=<pubkey>` - User positions

## Weight Calculation

The protocol uses time-based weight accumulation:

```
weight = (age_seconds × numerator × 10000) / denominator
```

**Default:** 10 weight per 5 minutes (300 seconds)
- 5 minutes → 10.0 weight
- 2.5 minutes → 5.0 weight
- Minimum: 1.0 weight (prevents instant commit gaming)

Precision: 10,000x multiplier for 4 decimal places

## Development

```bash
npm run dev          # Development server (port 3000)
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
```

## IDL Update

After rebuilding Anchor programs, regenerate IDL:

```bash
cd ../anchor_project
npm run build        # Regenerates IDL in target/idl/
# IDL automatically copied to frontend/idl/ via postbuild script
```

## Troubleshooting

**Module not found errors:**
```bash
rm -rf node_modules package-lock.json yarn.lock
npm install
```

**Wallet not connecting:**
- Check network matches deployed program
- Ensure wallet extension is installed
- Try refreshing the page

**Program not found:**
- Verify program is deployed to selected network
- Check `idl/anchor_project.json` contains correct program ID
- Restart dev server after IDL updates

**Weight not updating:**
- Weight refreshes every 1 second
- Check browser console for errors
- Verify position exists and is not already committed

## Built With

- [Next.js 15](https://nextjs.org) - React framework
- [Anchor 0.31](https://www.anchor-lang.com) - Solana framework
- [@solana/web3.js](https://solana-labs.github.io/solana-web3.js/) - Solana JavaScript API
- [@solana/wallet-adapter](https://github.com/anza-xyz/wallet-adapter) - Wallet integration
- [Tailwind CSS](https://tailwindcss.com) - Styling
