import { NextRequest, NextResponse } from 'next/server';
import { getProgram, getNetworkFromRequest } from '@/lib/api/rpc';
import { PublicKey } from '@solana/web3.js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const network = getNetworkFromRequest(searchParams);
    const walletParam = searchParams.get('wallet');

    if (!walletParam) {
      return NextResponse.json(
        { success: false, error: 'Wallet parameter required' },
        { status: 400 }
      );
    }

    const program = await getProgram(network);
    const walletPubkey = new PublicKey(walletParam);

    // Fetch all commitment accounts for this wallet
    const commitments = await program.account.commitment.all([
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: walletPubkey.toBase58(),
        },
      },
    ]);

    // Transform to JSON-serializable format
    const commitmentsData = commitments.map((commitment) => ({
      publicKey: commitment.publicKey.toString(),
      account: {
        userPk: commitment.account.userPk.toString(),
        positionAmount: commitment.account.positionAmount?.toNumber() || 0,
        weight: commitment.account.weight?.toNumber() || 0,
        poolId: commitment.account.poolId,
        epoch: commitment.account.epoch?.toNumber() || 0,
      },
    }));

    return NextResponse.json({
      success: true,
      network,
      commitments: commitmentsData,
    });
  } catch (error: any) {
    console.error('API Error [/api/commitments]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch commitments',
      },
      { status: 500 }
    );
  }
}
