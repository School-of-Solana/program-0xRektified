import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getProgram, getNetworkFromRequest, getConfigPda } from '@/lib/api/rpc';
import { getAccount, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const network = getNetworkFromRequest(searchParams);
    const walletParam = searchParams.get('wallet');

    if (!walletParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'Wallet address is required',
        },
        { status: 400 }
      );
    }

    const program = await getProgram(network);
    const wallet = new PublicKey(walletParam);

    // Fetch config to get mint address
    const configPda = getConfigPda(program.programId);
    const configData = await program.account.config.fetch(configPda);
    const mint = configData.allowedMint;

    // Fetch positions and token balance in parallel
    const [positionsData, tokenBalanceData] = await Promise.all([
      // Fetch positions owned by this wallet
      program.account.positionAccount.all([
        {
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: wallet.toBase58(),
          },
        },
      ]).catch((error) => {
        console.error('Failed to fetch positions:', error);
        return [];
      }),

      // Fetch token balance
      (async () => {
        try {
          const connection = program.provider.connection;
          const ata = getAssociatedTokenAddressSync(
            mint,
            wallet,
            false,
            TOKEN_2022_PROGRAM_ID
          );

          const tokenAccount = await getAccount(
            connection,
            ata,
            'confirmed',
            TOKEN_2022_PROGRAM_ID
          );

          return Number(tokenAccount.amount);
        } catch {
          return 0;
        }
      })(),
    ]);

    // Convert positions to JSON-serializable format
    const positions = positionsData.map((pos) => ({
      publicKey: pos.publicKey.toString(),
      account: {
        owner: pos.account.owner.toString(),
        userIndex: pos.account.userIndex?.toNumber() || 0,
        globalId: pos.account.globalId?.toNumber() || 0,
        createdAt: pos.account.createdAt?.toNumber() || 0,
      },
    }));

    return NextResponse.json({
      success: true,
      network,
      wallet: walletParam,
      positions,
      tokenBalance: tokenBalanceData,
      mint: mint.toString(),
    });
  } catch (error: any) {
    console.error('API Error [/api/positions]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch positions',
      },
      { status: 500 }
    );
  }
}
