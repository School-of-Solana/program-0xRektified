import { NextRequest, NextResponse } from 'next/server';
import { getProgram, getNetworkFromRequest, getConfigPda } from '@/lib/api/rpc';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const network = getNetworkFromRequest(searchParams);
    const epochParam = searchParams.get('epoch');

    const program = await getProgram(network);

    // Get current epoch if not specified
    let epoch: number;
    if (epochParam) {
      epoch = parseInt(epochParam);
    } else {
      const configPda = getConfigPda(program.programId);
      const configData = await program.account.config.fetch(configPda);
      epoch = configData.currentEpoch?.toNumber() || 0;
    }

    // Fetch all pools and filter by epoch on the server
    // This is more reliable than using memcmp filters with complex encodings
    const allPoolsData = await program.account.pool.all().catch((error) => {
      console.error('Failed to fetch pools:', error);
      return [];
    });

    // Filter pools for the specified epoch
    const poolsData = allPoolsData.filter(
      (pool) => pool.account.epoch?.toNumber() === epoch
    );

    // Convert pool data to JSON-serializable format
    const pools = poolsData.map((pool) => ({
      publicKey: pool.publicKey.toString(),
      account: {
        epoch: pool.account.epoch?.toNumber() || 0,
        poolId: pool.account.id, // 'id' field in the on-chain account
        totalWeight: pool.account.totalWeight?.toNumber() || 0,
        totalPositions: pool.account.totalPositions?.toNumber() || 0,
      },
    }));

    return NextResponse.json({
      success: true,
      network,
      epoch,
      pools,
      count: pools.length,
    });
  } catch (error: any) {
    console.error('API Error [/api/pools]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch pools',
      },
      { status: 500 }
    );
  }
}
