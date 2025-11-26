import { NextRequest, NextResponse } from 'next/server';
import { getProgram, getNetworkFromRequest, getConfigPda, getPoolPda } from '@/lib/api/rpc';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Maximum number of pools per epoch (from your protocol)
const MAX_POOLS = 10;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const network = getNetworkFromRequest(searchParams);
    const epochParam = searchParams.get('epoch');

    const program = await getProgram(network);

    let epoch: number;
    if (epochParam) {
      epoch = parseInt(epochParam);
    } else {
      const configPda = getConfigPda(program.programId);
      const configData = await program.account.config.fetch(configPda);
      epoch = configData.currentEpoch?.toNumber() || 0;
    }

    // This fetches only the pools for this epoch instead of all pools ever created
    const poolPromises = [];
    for (let poolId = 0; poolId < MAX_POOLS; poolId++) {
      const poolPda = getPoolPda(program.programId, poolId, epoch);
      poolPromises.push(
        program.account.pool.fetch(poolPda)
          .then((account) => ({ poolId, account, publicKey: poolPda }))
          .catch(() => null)
      );
    }

    const poolResults = await Promise.all(poolPromises);
    const poolsData = poolResults.filter((p) => p !== null);

    const pools = poolsData.map((pool) => ({
      publicKey: pool.publicKey.toString(),
      account: {
        epoch: pool.account.epoch?.toNumber() || 0,
        poolId: pool.account.id,
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
