import { NextRequest, NextResponse } from 'next/server';
import { getProgram, getNetworkFromRequest, getConfigPda, getEpochResultPda } from '@/lib/api/rpc';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const network = getNetworkFromRequest(searchParams);
    const epochParam = searchParams.get('epoch');

    const program = await getProgram(network);
    const configPda = getConfigPda(program.programId);

    // Fetch config to get current epoch
    const configData = await program.account.config.fetch(configPda);
    const currentEpoch = configData.currentEpoch?.toNumber() || 0;

    // Get epoch to query (default to current)
    const epoch = epochParam ? parseInt(epochParam) : currentEpoch;

    // Fetch epoch result if available
    let epochResult = null;
    try {
      const epochResultPda = getEpochResultPda(program.programId, epoch);
      const epochResultData = await program.account.epochResult.fetch(epochResultPda);

      epochResult = {
        epoch: epochResultData.epoch?.toNumber() || 0,
        winningPoolId: epochResultData.winningPoolId,
        weight: epochResultData.weight?.toNumber() || 0,
        endAt: epochResultData.endAt?.toNumber() || 0,
        totalPositionAmount: epochResultData.totalPositionAmount?.toNumber() || 0,
        poolCount: epochResultData.poolCount,
        poolWeights: epochResultData.poolWeights?.map((w: any) => w.toNumber()) || [],
        epochResultState: epochResultData.epochResultState,
      };
    } catch (error) {
      // Epoch result doesn't exist yet (not resolved)
      epochResult = null;
    }

    return NextResponse.json({
      success: true,
      network,
      currentEpoch,
      epoch,
      epochResult,
    });
  } catch (error: any) {
    console.error('API Error [/api/epoch]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch epoch data',
      },
      { status: 500 }
    );
  }
}
